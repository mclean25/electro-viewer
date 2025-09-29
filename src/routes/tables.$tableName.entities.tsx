import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import * as path from "node:path";
import { config } from "../../electro-viewer-config";

interface EntitySchema {
	name: string;
	version: string;
	service: string;
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
		// Resolve the service config path relative to the current working directory
		const serviceConfigPath = path.resolve(process.cwd(), config.serviceConfigPath);
		
		console.log("Loading entity schemas from:", serviceConfigPath);

		try {
			// Dynamically import the service config module
			const serviceModule = await import(/* @vite-ignore */ serviceConfigPath);

			const schemas: EntitySchema[] = [];

			for (const [_name, entity] of Object.entries(serviceModule)) {
				if (entity && typeof entity === "object" && "model" in entity) {
					const model = (entity as any).model;
					const indexes: EntitySchema["indexes"] = {};

					// Extract primary index
					if (model.indexes?.primary) {
						const primary = model.indexes.primary;
						indexes.primary = {
							pk: {
								field: primary.pk.field || "pk",
								composite:
									primary.pk.facets?.map((f: any) => f.name) ||
									primary.pk.composite ||
									[],
								template: model.prefixes?.[""]?.pk?.prefix || "",
							},
						}

						if (primary.sk) {
							indexes.primary.sk = {
								field: primary.sk.field || "sk",
								composite:
									primary.sk.facets?.map((f: any) => f.name) ||
									primary.sk.composite ||
									[],
								template: model.prefixes?.[""]?.sk?.prefix || "",
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
						indexes,
						attributes,
					})
				}
			}

			console.log(`Total entities found via dynamic import: ${schemas.length}`);
			return schemas;
		} catch (importError: any) {
			console.error("Failed to import service config file:", importError);
			
			// Provide helpful error message
			const errorMessage = importError.code === 'MODULE_NOT_FOUND' 
				? `Could not find service config file at: ${serviceConfigPath}\n\nPlease update the 'serviceConfigPath' in your electro-viewer-config.ts file to point to your ElectroDB service configuration file.`
				: `Failed to load service config from: ${serviceConfigPath}\n\nError: ${importError.message}`;
			
			throw new Error(errorMessage);
		}
	} catch (error) {
		console.error("Error loading entity schemas:", error);
		throw error;
	}
});

export const Route = createFileRoute("/tables/$tableName/entities")({
	component: EntitiesViewer,
	loader: async ({ params }) => {
		const schemas = await getEntitySchemas();
		return { schemas, tableName: params.tableName };
	},
});

function EntitiesViewer() {
	const { schemas, tableName } = Route.useLoaderData();

	return (
		<div style={{ padding: "20px", fontFamily: "monospace" }}>
			<h1>ElectroDB Entity Definitions for {tableName}</h1>
			{!schemas && <div>Didn't load any schemas...</div>}
			<p>Total entities: {schemas?.length}</p>

			{schemas?.map((schema) => (
				<div
					key={schema.name}
					style={{
						marginBottom: "30px",
						padding: "15px",
						border: "1px solid #ccc",
						borderRadius: "5px",
						backgroundColor: "#f9f9f9",
					}}
				>
					<h2 style={{ color: "#333", marginTop: 0 }}>
						<Link
							to="/tables/$tableName/entity/$entityName"
							params={{ tableName, entityName: schema.name }}
							style={{ color: "#333", textDecoration: "none" }}
							onMouseEnter={(e) =>
								(e.currentTarget.style.textDecoration = "underline")
							}
							onMouseLeave={(e) =>
								(e.currentTarget.style.textDecoration = "none")
							}
						>
							{schema.name}
						</Link>{" "}
						<span style={{ fontSize: "14px", color: "#666" }}>
							(v{schema.version})
						</span>
					</h2>
					<p style={{ color: "#666" }}>Service: {schema.service}</p>
					<p style={{ fontSize: "12px" }}>
						<Link
							to="/tables/$tableName/entity/$entityName"
							params={{ tableName, entityName: schema.name }}
							style={{ color: "#0066cc" }}
						>
							→ Query this entity
						</Link>
					</p>

					<h3>Indexes:</h3>
					{Object.entries(schema.indexes).map(([indexName, index]) => (
						<div
							key={indexName}
							style={{
								marginLeft: "20px",
								marginBottom: "15px",
								padding: "10px",
								backgroundColor: "#fff",
								border: "1px solid #ddd",
								borderRadius: "3px",
							}}
						>
							<h4 style={{ margin: "0 0 10px 0", color: "#555" }}>
								{indexName} {indexName !== "primary" && "(GSI)"}
							</h4>

							<div style={{ marginLeft: "10px" }}>
								<div>
									<strong>PK:</strong>
									<div style={{ marginLeft: "15px" }}>
										<div>Field: {index.pk.field}</div>
										<div>
											Composite: [{index.pk.composite.join(", ") || "none"}]
										</div>
										{index.pk.template && (
											<div style={{ color: "#0066cc", fontSize: "13px" }}>
												Pattern: {index.pk.template}
											</div>
										)}
									</div>
								</div>

								{index.sk && (
									<div style={{ marginTop: "10px" }}>
										<strong>SK:</strong>
										<div style={{ marginLeft: "15px" }}>
											<div>Field: {index.sk.field}</div>
											<div>Composite: [{index.sk.composite.join(", ")}]</div>
											{index.sk.template && (
												<div style={{ color: "#0066cc", fontSize: "13px" }}>
													Pattern: {index.sk.template}
												</div>
											)}
										</div>
									</div>
								)}
							</div>
						</div>
					))}

					<details style={{ marginTop: "10px" }}>
						<summary style={{ cursor: "pointer", color: "#666" }}>
							Attributes ({schema.attributes.length})
						</summary>
						<div style={{ marginLeft: "20px", marginTop: "10px" }}>
							{schema.attributes.map((attr) => (
								<span
									key={attr}
									style={{
										display: "inline-block",
										margin: "2px",
										padding: "3px 8px",
										backgroundColor: "#e0e0e0",
										borderRadius: "3px",
										fontSize: "12px",
									}}
								>
									{attr}
								</span>
							))}
						</div>
					</details>
				</div>
			))}
		</div>
	)
}
