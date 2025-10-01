import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import * as path from "node:path";
import { loadTypeScriptFiles } from "../utils/load-typescript";
import {
	useReactTable,
	getCoreRowModel,
	createColumnHelper,
	flexRender,
} from "@tanstack/react-table";
// Load config from current working directory or CLI environment
const getConfig = async () => {
	// Use CLI config path if available, otherwise use current working directory
	const configPath = process.env.ELECTRO_VIEWER_CONFIG_PATH || 
		path.resolve(process.cwd(), "electro-viewer-config.ts");
	const configModule = await import(/* @vite-ignore */ configPath);
	return configModule.config;
};

interface EntitySchema {
	name: string;
	version: string;
	service: string;
	sourceFile: string;
	indexes: {
		[key: string]: {
			pk: {
				field: string;
				composite: string[];
				template?: string;
			}
			sk?: {
				field: string;
				composite: string[];
				template?: string;
			}
		}
	}
	attributes: string[];
}

const getEntitySchemas = createServerFn({
	method: "GET",
}).handler(async () => {
	try {
		// Load config from current working directory
		const config = await getConfig();

		console.log("Loading entity schemas from patterns:", config.entityConfigPaths);

		try {
			// Dynamically import the entity files using glob patterns
			const serviceModule = await loadTypeScriptFiles(
				config.entityConfigPaths,
				config.tsconfigPath,
				config.env,
			);

			const schemas: EntitySchema[] = [];

			for (const [_name, entityData] of Object.entries(serviceModule)) {
				const entity = entityData.module;
				const sourceFile = entityData.sourceFile;

				if (entity && typeof entity === "object" && "model" in entity) {
					const model = (entity as any).model;
					const indexes: EntitySchema["indexes"] = {};

					// Extract primary index
					// In ElectroDB, the primary index is either named "primary" or is the one without an "index" property
					let primaryIndex = model.indexes?.primary;
					let primaryIndexName = "primary";

					// If no "primary" index, find the index without an "index" property (that's the primary)
					if (!primaryIndex && model.indexes) {
						for (const [indexName, indexDef] of Object.entries(model.indexes)) {
							const idx = indexDef as any;
							if (!idx.index) {
								primaryIndex = idx;
								primaryIndexName = indexName;
								break;
							}
						}
					}

					if (primaryIndex) {
						indexes.primary = {
							pk: {
								field: primaryIndex.pk.field || "pk",
								composite:
									primaryIndex.pk.facets?.map((f: any) => f.name) ||
									primaryIndex.pk.composite ||
									[],
								template: model.prefixes?.[primaryIndexName]?.pk?.prefix || model.prefixes?.[""]?.pk?.prefix || "",
							},
						}

						if (primaryIndex.sk) {
							indexes.primary.sk = {
								field: primaryIndex.sk.field || "sk",
								composite:
									primaryIndex.sk.facets?.map((f: any) => f.name) ||
									primaryIndex.sk.composite ||
									[],
								template: model.prefixes?.[primaryIndexName]?.sk?.prefix || model.prefixes?.[""]?.sk?.prefix || "",
							}
						}
					}

					// Extract GSI indexes
					if (model.indexes) {
						for (const [indexName, indexDef] of Object.entries(model.indexes)) {
							if (indexName !== "primary") {
								const idx = indexDef as any;
								indexes[indexName] = {
									pk: {
										field: idx.pk?.field || `${indexName}pk`,
										composite:
											idx.pk?.facets?.map((f: any) => f.name) ||
											idx.pk?.composite ||
											[],
										template: "",
									},
								}

								if (idx.sk) {
									indexes[indexName].sk = {
										field: idx.sk?.field || `${indexName}sk`,
										composite:
											idx.sk?.facets?.map((f: any) => f.name) ||
											idx.sk?.composite ||
											[],
										template: "",
									}
								}
							}
						}
					}

					// Extract attributes from the entity schema
					const attributes: string[] = [];
					if (model.schema?.attributes) {
						attributes.push(...Object.keys(model.schema.attributes));
					}

					schemas.push({
						name: model.entity,
						version: model.version,
						service: model.service,
						sourceFile,
						indexes,
						attributes,
					})
				}
			}

			console.log(`Total entities found via dynamic import: ${schemas.length}`);
			return schemas;
		} catch (importError: any) {
			console.error("Failed to import entity config files:", importError);

			// Provide helpful error message
			const errorMessage = importError.code === 'MODULE_NOT_FOUND'
				? `Could not find entity config files matching: ${config.entityConfigPaths.join(", ")}\n\nPlease update the 'entityConfigPaths' in your electro-viewer-config.ts file to point to your ElectroDB entity files.`
				: `Failed to load entity config files from: ${config.entityConfigPaths.join(", ")}\n\nError: ${importError.message}`;

			throw new Error(errorMessage);
		}
	} catch (error) {
		console.error("Error loading entity schemas:", error);
		throw error;
	}
});

// Helper function to format key patterns for display
function formatKeyPattern(
	composite: string[],
	template: string | undefined,
	prefix: string,
): string {
	if (composite.length === 0) {
		return template || prefix;
	}
	const fields = composite.map((f) => `\${${f}}`).join("#");
	return template ? `${template}#${fields}` : `${prefix}#${fields}`;
}

export const Route = createFileRoute("/tables/$tableName/entities")({
	component: EntitiesViewer,
	loader: async ({ params }) => {
		const schemas = await getEntitySchemas();
		return { schemas, tableName: params.tableName };
	},
});

function EntitiesViewer() {
	const { schemas, tableName } = Route.useLoaderData();

	const columnHelper = createColumnHelper<EntitySchema>();

	const columns = [
		columnHelper.accessor("name", {
			header: "Entity Name",
			cell: (info) => (
				<Link
					to="/tables/$tableName/entity/$entityName"
					params={{ tableName, entityName: info.getValue() }}
					style={{ color: "#0066cc", textDecoration: "none" }}
				>
					{info.getValue()}
				</Link>
			),
		}),
		columnHelper.accessor("service", {
			header: "Service Name",
			cell: (info) => info.getValue(),
		}),
		columnHelper.accessor("sourceFile", {
			header: "Source File",
			cell: (info) => (
				<span style={{ fontSize: "12px", fontFamily: "monospace" }}>
					{info.getValue()}
				</span>
			),
		}),
		columnHelper.display({
			id: "pkPattern",
			header: "PK Pattern",
			cell: (info) => {
				const schema = info.row.original;
				const primaryIndex = schema.indexes.primary;
				if (!primaryIndex) return "N/A";
				return (
					<code style={{ fontSize: "11px" }}>
						{formatKeyPattern(
							primaryIndex.pk.composite,
							primaryIndex.pk.template,
							`$\{${schema.service}}`,
						)}
					</code>
				);
			},
		}),
		columnHelper.display({
			id: "skPattern",
			header: "SK Pattern",
			cell: (info) => {
				const schema = info.row.original;
				const primaryIndex = schema.indexes.primary;
				if (!primaryIndex?.sk) return "N/A";
				return (
					<code style={{ fontSize: "11px" }}>
						{formatKeyPattern(
							primaryIndex.sk.composite,
							primaryIndex.sk.template,
							`$\{${schema.name}}_$\{${schema.version}}`,
						)}
					</code>
				);
			},
		}),
		columnHelper.accessor("attributes", {
			header: "No. of Fields",
			cell: (info) => info.getValue().length,
		}),
	];

	const table = useReactTable({
		data: schemas || [],
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	return (
		<div style={{ padding: "20px", fontFamily: "monospace" }}>
			<h1>ElectroDB Entity Definitions for {tableName}</h1>
			{!schemas && <div>Didn't load any schemas...</div>}
			<p>Total entities: {schemas?.length}</p>

			<table
				style={{
					width: "100%",
					borderCollapse: "collapse",
					marginTop: "20px",
					fontSize: "14px",
				}}
			>
				<thead>
					{table.getHeaderGroups().map((headerGroup) => (
						<tr key={headerGroup.id}>
							{headerGroup.headers.map((header) => (
								<th
									key={header.id}
									style={{
										textAlign: "left",
										padding: "12px",
										borderBottom: "2px solid #333",
										backgroundColor: "#f5f5f5",
										fontWeight: "bold",
									}}
								>
									{flexRender(
										header.column.columnDef.header,
										header.getContext(),
									)}
								</th>
							))}
						</tr>
					))}
				</thead>
				<tbody>
					{table.getRowModel().rows.map((row) => (
						<tr
							key={row.id}
							style={{
								borderBottom: "1px solid #ddd",
							}}
						>
							{row.getVisibleCells().map((cell) => (
								<td
									key={cell.id}
									style={{
										padding: "12px",
										verticalAlign: "top",
									}}
								>
									{flexRender(cell.column.columnDef.cell, cell.getContext())}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
