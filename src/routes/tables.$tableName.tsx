import { createFileRoute, Outlet } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { DynamoDBClient, ListTablesCommand } from "@aws-sdk/client-dynamodb";
import { fromIni } from "@aws-sdk/credential-providers";
import * as path from "node:path";
import { loadTypeScriptFiles } from "../utils/load-typescript";
import { SideNav } from "../components/SideNav";

const getConfig = async () => {
	const configPath = process.env.ELECTRO_VIEWER_CONFIG_PATH ||
		path.resolve(process.cwd(), "electro-viewer-config.ts");
	const configModule = await import(/* @vite-ignore */ configPath);
	return configModule.config;
};

const listTables = createServerFn({
	method: "GET",
}).handler(async () => {
	const config = await getConfig();
	const client = new DynamoDBClient({
		region: config.region,
		credentials: fromIni({ profile: config.profile }),
	});
	const command = new ListTablesCommand({});
	const result = await client.send(command);
	return result.TableNames || [];
});

interface EntitySchema {
	name: string;
	version: string;
	service: string;
	sourceFile: string;
}

const getEntitySchemas = createServerFn({
	method: "GET",
}).handler(async () => {
	const config = await getConfig();
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
			schemas.push({
				name: model.entity,
				version: model.version,
				service: model.service,
				sourceFile,
			});
		}
	}

	return schemas;
});

export const Route = createFileRoute("/tables/$tableName")({
	component: TableLayout,
	loader: async ({ params }) => {
		const [tables, entities] = await Promise.all([
			listTables(),
			getEntitySchemas(),
		]);
		return { tables, entities, tableName: params.tableName };
	},
});

function TableLayout() {
	const { tables, entities, tableName } = Route.useLoaderData();

	return (
		<div className="flex">
			<SideNav currentTable={tableName} tables={tables} entities={entities} />
			<div className="ml-64 flex-1">
				<div className="container mx-auto py-8 px-8 font-mono">
					<Outlet />
				</div>
			</div>
		</div>
	);
}