// app/routes/index.tsx
import * as fs from "node:fs";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";

export const Route = createFileRoute("/")({
  component: Home,
  loader: async () => {
    const client = new DynamoDBClient({
      region: "us-east-1",
      profile: "rc",
    });

    try {
      const result = await client.send(
        new QueryCommand({
          TableName: "dev-review-corral-main",
          KeyConditionExpression: "pk = :pk",
          ExpressionAttributeValues: {
            ":pk": { S: "$rc#orgid_113743432" },
          },
          Limit: 10,
        }),
      );
      console.log("DynamoDB result:", JSON.stringify(result, null, 2));
      return result.Items || [];
    } catch (error) {
      console.error("Error querying DynamoDB:", error);
      return [];
      // throw new Error("Failed to fetch data from DynamoDB");
    }
  },
});

function Home() {
  const state = Route.useLoaderData();

  return <div>{JSON.stringify(state, null, 2)}</div>;
}
