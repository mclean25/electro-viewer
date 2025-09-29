// src/routes/index.tsx
import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { DynamoDBClient, ListTablesCommand } from "@aws-sdk/client-dynamodb";
import { fromIni } from "@aws-sdk/credential-providers";
import * as path from "node:path";

// Load config from current working directory or CLI environment
const getConfig = async () => {
	// Use CLI config path if available, otherwise use current working directory
	const configPath = process.env.ELECTRO_VIEWER_CONFIG_PATH || 
		path.resolve(process.cwd(), "electro-viewer-config.ts");
	const configModule = await import(/* @vite-ignore */ configPath);
	return configModule.config;
};

// Server function to list DynamoDB tables
const listTables = createServerFn({
	method: "GET",
}).handler(async () => {
	try {
		// Load config from current working directory
		const config = await getConfig();
		
		const client = new DynamoDBClient({
			region: config.region,
			credentials: fromIni({ profile: config.profile }),
		});

		const command = new ListTablesCommand({});
		const result = await client.send(command);

		return {
			success: true,
			tables: result.TableNames || [],
			config,
		};
	} catch (error: any) {
		console.error("Error listing tables:", error);
		return {
			success: false,
			error: error.message || "Unknown error occurred",
			tables: [],
			config: null,
		};
	}
});

export const Route = createFileRoute("/")({
	component: Home,
	loader: async () => await listTables(),
});

function Home() {
	const router = useRouter();
	const data = Route.useLoaderData();

	return (
		<div className="p-5 font-mono">
			<h1 className="text-2xl mb-5">Electro Viewer</h1>
			
			<div className="mb-8">
				<h2 className="text-lg mb-2">AWS Configuration</h2>
				<div className="bg-gray-100 p-3 rounded text-sm">
					<div><span className="font-bold">Region:</span> {data.config?.region}</div>
					<div><span className="font-bold">Profile:</span> {data.config?.profile}</div>
				</div>
			</div>

			{data.success ? (
				<div className="mb-8">
					<h2 className="text-lg mb-2">
						Available DynamoDB Tables ({data.tables.length})
					</h2>
					{data.tables.length > 0 ? (
						<div className="bg-gray-50 p-4 rounded">
							{data.tables.map((tableName: string) => (
								<Link
									key={tableName}
									to={`/tables/$tableName/entities`}
									params={{ tableName }}
									className="block p-2 mb-1 rounded text-sm hover:opacity-80 transition-opacity bg-white border border-gray-300 hover:bg-gray-50"
								>
									{tableName}
								</Link>
							))}
						</div>
					) : (
						<p className="text-gray-600">No DynamoDB tables found in this region/profile.</p>
					)}
				</div>
			) : (
				<div className="mb-8">
					<h2 className="text-lg mb-2 text-red-500">
						Error Loading Tables
					</h2>
					<div className="bg-red-50 p-3 rounded text-red-500">
						{data.error}
					</div>
				</div>
			)}

		</div>
	);
}
