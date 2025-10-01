import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
	DynamoDBDocumentClient,
	GetCommand,
	QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { fromIni } from "@aws-sdk/credential-providers";
import { useState } from "react";
import * as path from "node:path";
import { loadTypeScriptFiles } from "../utils/load-typescript";
// Load config from current working directory or CLI environment
const getConfig = async () => {
	// Use CLI config path if available, otherwise use current working directory
	const configPath = process.env.ELECTRO_VIEWER_CONFIG_PATH || 
		path.resolve(process.cwd(), "electro-viewer-config.ts");
	const configModule = await import(/* @vite-ignore */ configPath);
	return configModule.config;
};
import { buildElectroDBKey } from "../utils/electrodb-keys";
import { EntityQueryResultsTable } from "../components/EntityQueryResultsTable";

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

// Server function to get entity schema by name
const getEntitySchema = createServerFn({
	method: "GET",
})
	.validator((entityName: string) => entityName)
	.handler(async ({ data: entityName }) => {
		try {
			// Load config from current working directory
			const config = await getConfig();

			// Dynamically import the entity files using glob patterns
			const serviceModule = await loadTypeScriptFiles(
				config.entityConfigPaths,
				config.tsconfigPath,
				config.env,
			);

			for (const [name, entityData] of Object.entries(serviceModule)) {
				const entity = entityData.module;

				if (entity && typeof entity === "object" && "model" in entity) {
					const model = (entity as any).model;
					if (model.entity === entityName) {
						const indexes: EntitySchema["indexes"] = {};

						// Extract primary index
						if (model.indexes && model.indexes.primary) {
							const primary = model.indexes.primary;
							indexes.primary = {
								pk: {
									field: primary.pk.field || "pk",
									composite: primary.pk.facets || primary.pk.composite || [],
								},
							}

							if (primary.sk) {
								indexes.primary.sk = {
									field: primary.sk.field || "sk",
									composite: primary.sk.facets || primary.sk.composite || [],
								}
							}
						}

						// Extract GSI indexes
						if (model.indexes) {
							for (const [indexName, indexDef] of Object.entries(
								model.indexes,
							)) {
								if (indexName !== "primary") {
									const idx = indexDef as any;
									indexes[indexName] = {
										pk: {
											field: idx.pk?.field || `${indexName}pk`,
											composite: idx.pk?.facets || idx.pk?.composite || [],
										},
									}

									if (idx.sk) {
										indexes[indexName].sk = {
											field: idx.sk?.field || `${indexName}sk`,
											composite: idx.sk?.facets || idx.sk?.composite || [],
										}
									}
								}
							}
						}

						const attributes: string[] = [];
						if (model.schema?.attributes) {
							attributes.push(...Object.keys(model.schema.attributes));
						}

						return {
							name: model.entity,
							version: model.version,
							service: model.service,
							indexes,
							attributes,
						} as EntitySchema
					}
				}
			}
			throw new Error(`Entity '${entityName}' not found in entity files matching: ${config.entityConfigPaths.join(", ")}`);
		} catch (error: any) {
			console.error("Error loading entity schema:", error);

			// Provide more helpful error messages
			if (error.code === 'MODULE_NOT_FOUND') {
				const config = await getConfig();
				throw new Error(`Could not find entity config files matching: ${config.entityConfigPaths.join(", ")}\n\nPlease update the 'entityConfigPaths' in your electro-viewer-config.ts file.`);
			}

			throw error;
		}
	})

// Server function to query DynamoDB
const queryDynamoDB = createServerFn({
	method: "POST",
})
	.validator(
		(params: {
			pk: string;
			sk?: string;
			indexName?: string;
			entityName?: string;
			tableName: string;
		}) => params,
	)
	.handler(async ({ data }) => {
		const { pk, sk, indexName, entityName, tableName } = data;

		try {
			// Load config from current working directory
			const config = await getConfig();
			
			// Use AWS SDK's fromIni credential provider for SSO profiles
			const client = new DynamoDBClient({
				region: config.region,
				credentials: fromIni({ profile: config.profile }),
			})

			const docClient = DynamoDBDocumentClient.from(client);

			if (sk) {
				// Use GetItem for exact match
				const command = new GetCommand({
					TableName: tableName,
					Key: {
						pk,
						sk,
					},
				})

				const result = await docClient.send(command);
				return {
					success: true,
					data: result.Item ? [result.Item] : [],
					count: result.Item ? 1 : 0,
				}
			} else {
				// Use Query for PK-only queries with entity filter
				const queryParams: any = {
					TableName: tableName,
					IndexName: indexName,
					KeyConditionExpression: "pk = :pk",
					ExpressionAttributeValues: {
						":pk": pk,
					},
				}

				// Add entity filter when entityName is provided
				// This is to filter for relevant results when the PK contains other items
				if (entityName) {
					queryParams.FilterExpression = "#edb_e = :entityName";
					queryParams.ExpressionAttributeNames = { "#edb_e": "__edb_e__" };
					queryParams.ExpressionAttributeValues[":entityName"] = entityName;
				}

				const command = new QueryCommand(queryParams);

				const result = await docClient.send(command);
				return {
					success: true,
					data: result.Items || [],
					count: result.Count || 0,
				}
			}
		} catch (error: any) {
			console.error("DynamoDB query error:", error);
			return {
				success: false,
				error: error.message || "Unknown error occurred",
				errorType: error.name || "UnknownError",
			}
		}
	})

export const Route = createFileRoute("/tables/$tableName/entity/$entityName")({
	component: EntityDetail,
	loader: async ({ params }) => {
		const schema = await getEntitySchema({ data: params.entityName });
		return { entityName: params.entityName, tableName: params.tableName, schema };
	},
});

function EntityDetail() {
	const { entityName, tableName, schema } = Route.useLoaderData();
	const [selectedIndex, setSelectedIndex] = useState("primary");
	const [pkValues, setPkValues] = useState<Record<string, string>>({});
	const [skValues, setSkValues] = useState<Record<string, string>>({});
	const [queryResult, setQueryResult] = useState<any>(null);
	const [isQuerying, setIsQuerying] = useState(false);

	const currentIndex = schema.indexes[selectedIndex];

	const handleQuery = async () => {
		setIsQuerying(true);
		setQueryResult(null);

		try {
			// Build PK using ElectroDB logic
			let pk = buildElectroDBKey(
				true,
				currentIndex.pk.composite,
				pkValues,
				schema,
			)

			// Build SK if present using ElectroDB logic
			let sk: string | undefined = undefined;
			if (currentIndex.sk) {
				const skKey = buildElectroDBKey(
					false,
					currentIndex.sk.composite,
					skValues,
					schema,
				)
				// Only include SK if it has meaningful values (not just the static template)
				// Check if any SK values were actually provided
				const hasSkValues = currentIndex.sk.composite.some(
					(field) => skValues[field] && skValues[field].trim() !== "",
				)
				if (hasSkValues || currentIndex.sk.composite.length === 0) {
					sk = skKey
				}
			}

			const result = await queryDynamoDB({
				data: {
					pk,
					sk,
					indexName: selectedIndex === "primary" ? undefined : selectedIndex,
					entityName: schema.name,
					tableName,
				},
			})

			// Add the actual query keys to the result for display
			setQueryResult({
				...result,
				queryKeys: {
					pk,
					sk,
					indexName: selectedIndex === "primary" ? undefined : selectedIndex,
				},
			})
		} catch (error) {
			console.error("Query error:", error);
			setQueryResult({
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
				queryKeys: {
					pk: buildElectroDBKey(
						true,
						currentIndex.pk.composite,
						pkValues,
						schema,
					),
					sk: currentIndex.sk
						? buildElectroDBKey(
								false,
								currentIndex.sk.composite,
								skValues,
								schema,
							)
						: undefined,
					indexName: selectedIndex === "primary" ? undefined : selectedIndex,
				},
			})
		} finally {
			setIsQuerying(false);
		}
	}

	return (
		<div className="p-5 font-mono">
			<div className="mb-4">
				<Link 
					to="/tables/$tableName/entities" 
					params={{ tableName }}
					className="text-blue-600 hover:text-blue-700 text-sm"
				>
					← Back to {tableName} Entities
				</Link>
			</div>
			
			<h1 className="text-2xl mb-2">Entity: {entityName}</h1>
			<p className="text-gray-600 mb-5">
				Version: {schema.version} | Service: {schema.service} | Table: {tableName}
			</p>

			<div className="mb-5">
				<h3 className="text-lg mb-2">Select Index:</h3>
				<select
					value={selectedIndex}
					onChange={(e) => {
						setSelectedIndex(e.target.value);
						setPkValues({})
						setSkValues({})
						setQueryResult(null);
					}}
					className="p-2 text-sm border border-gray-300 rounded"
				>
					{Object.keys(schema.indexes).map((indexName) => (
						<option key={indexName} value={indexName}>
							{indexName} {indexName !== "primary" && "(GSI)"}
						</option>
					))}
				</select>
			</div>

			<div className="mb-5 p-4 bg-gray-50 rounded">
				<h3 className="text-lg mb-3">Build Query Keys</h3>

				<div className="mb-4">
					<h4 className="font-semibold mb-2">Partition Key ({currentIndex.pk.field})</h4>
					{currentIndex.pk.composite.length === 0 ? (
						<div>
							<p className="text-gray-600 text-xs mb-2">
								No composite attributes (static key)
							</p>
							<div className="mb-2">
								<strong>Key Pattern:</strong>{" "}
								<code className="bg-white p-1 border border-gray-300 rounded text-xs">
									${"{service}"}
								</code>
							</div>
							<div>
								<strong>Constructed Key:</strong>{" "}
								<code className="bg-green-100 p-1 border border-green-500 text-green-800 font-semibold text-xs">
									{buildElectroDBKey(
										true,
										currentIndex.pk.composite,
										pkValues,
										schema,
									)}
								</code>
							</div>
						</div>
					) : (
						<>
							{currentIndex.pk.composite.map((field) => (
								<div key={field} className="mb-2">
									<label className="block mb-1 text-sm">
										{field}:
									</label>
									<input
										type="text"
										value={pkValues[field] || ""}
										onChange={(e) =>
											setPkValues({ ...pkValues, [field]: e.target.value })
										}
										placeholder={"Enter ${field}"}
										className="p-2 w-80 border border-gray-300 rounded"
									/>
								</div>
							))}
							<div className="mb-2">
								<strong>Key Pattern:</strong>{" "}
								<code className="bg-white p-1 border border-gray-300 rounded text-xs">
									${"{service}"}#
									{currentIndex.pk.composite.map((c) => `{${c}}`).join("#")}
								</code>
							</div>
							<div>
								<strong>Constructed Key:</strong>{" "}
								<code className="bg-green-100 p-1 border border-green-500 text-green-800 font-semibold text-xs">
									{buildElectroDBKey(
										true,
										currentIndex.pk.composite,
										pkValues,
										schema,
									) || "(Enter values to see constructed key)"}
								</code>
							</div>
						</>
					)}
				</div>

				{currentIndex.sk && (
					<div className="mb-4">
						<h4 className="font-semibold mb-2">Sort Key ({currentIndex.sk.field})</h4>
						{currentIndex.sk.composite.length === 0 ? (
							<div>
								<p className="text-gray-600 text-xs mb-2">
									No composite attributes
								</p>
								<div className="mb-2">
									<strong>Key Pattern:</strong>{" "}
									<code className="bg-white p-1 border border-gray-300 rounded text-xs">
										${"{entity}"}_{"{version}"}
									</code>
								</div>
								<div>
									<strong>Constructed Key:</strong>{" "}
									<code className="bg-green-100 p-1 border border-green-500 text-green-800 font-semibold text-xs">
										{buildElectroDBKey(
											false,
											currentIndex.sk.composite,
											skValues,
											schema,
										)}
									</code>
								</div>
							</div>
						) : (
							<>
								{currentIndex.sk.composite.map((field) => (
									<div key={field} className="mb-2">
										<label className="block mb-1 text-sm">
											{field}:
										</label>
										<input
											type="text"
											value={skValues[field] || ""}
											onChange={(e) =>
												setSkValues({ ...skValues, [field]: e.target.value })
											}
											placeholder={"Enter ${field}"}
											className="p-2 w-80 border border-gray-300 rounded"
										/>
									</div>
								))}
								<div className="mb-2">
									<strong>Key Pattern:</strong>{" "}
									<code className="bg-white p-1 border border-gray-300 rounded text-xs">
										${"{entity}"}_{"{version}"}#
										{currentIndex.sk.composite.map((c) => `{${c}}`).join("#")}
									</code>
								</div>
								<div>
									<strong>Constructed Key:</strong>{" "}
									<code className="bg-green-100 p-1 border border-green-500 text-green-800 font-semibold text-xs">
										{buildElectroDBKey(
											false,
											currentIndex.sk.composite,
											skValues,
											schema,
										) || "(Enter values to see constructed key)"}
									</code>
								</div>
							</>
						)}
					</div>
				)}

				<button
					onClick={handleQuery}
					disabled={isQuerying}
					className={`px-5 py-2 text-white border-none rounded cursor-pointer text-sm ${
						isQuerying 
							? "bg-gray-400 cursor-not-allowed" 
							: "bg-blue-600 hover:bg-blue-700"
					}`}
				>
					{isQuerying ? "Querying..." : "Query DynamoDB"}
				</button>
			</div>

			{queryResult && (
				<div className={`mt-5 p-4 border rounded ${
					queryResult.success 
						? "bg-green-50 border-green-500" 
						: "bg-red-50 border-red-500"
				}`}>
					<h3 className="text-lg mb-3">Query Result</h3>

					{/* Show the actual query keys used */}
					<div className="mb-4 p-3 bg-gray-100 rounded border border-gray-300">
						<h4 className="m-0 mb-2 text-sm text-gray-700">
							Query Keys Used:
						</h4>
						<div className="text-xs font-mono">
							<div className="mb-1">
								<strong>PK:</strong>
								<code className="ml-2 p-1 bg-white border border-gray-300 rounded text-xs">
									{queryResult.queryKeys?.pk}
								</code>
							</div>
							{queryResult.queryKeys?.sk && (
								<div className="mb-1">
									<strong>SK:</strong>
									<code className="ml-2 p-1 bg-white border border-gray-300 rounded text-xs">
										{queryResult.queryKeys.sk}
									</code>
								</div>
							)}
							{queryResult.queryKeys?.indexName && (
								<div>
									<strong>Index:</strong>
									<code className="ml-2 p-1 bg-white border border-gray-300 rounded text-xs">
										{queryResult.queryKeys.indexName}
									</code>
								</div>
							)}
						</div>
					</div>

					{queryResult.success ? (
						<>
							<p>Found {queryResult.count} item(s)</p>
							{queryResult.data.length > 0 ? (
								<EntityQueryResultsTable data={queryResult.data} />
							) : (
								<p className="text-gray-600">No items found with these keys</p>
							)}
						</>
					) : (
						<div>
							<p className="text-red-500">
								<strong>Error:</strong> {queryResult.error}
							</p>
							{queryResult.errorType && (
								<p className="text-gray-600 text-xs">
									Type: {queryResult.errorType}
								</p>
							)}
						</div>
					)}
				</div>
			)}
		</div>
	)
}