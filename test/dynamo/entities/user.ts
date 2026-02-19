import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { Entity } from "electrodb";

const client = new DynamoDBClient({ region: "us-west-1" });

export const User = new Entity(
  {
    model: {
      entity: "user",
      version: "1",
      service: "testapp",
    },
    attributes: {
      userId: {
        type: "string",
      },
      name: {
        type: "string",
      },
      email: {
        type: "string",
      },
      age: {
        type: "number",
      },
      address: {
        type: "map",
        properties: {
          street: { type: "string" },
          city: { type: "string" },
          state: { type: "string" },
          zip: { type: "string" },
        },
      },
      preferences: {
        type: "map",
        properties: {
          theme: { type: "string" },
          language: { type: "string" },
          notifications: {
            type: "map",
            properties: {
              email: { type: "boolean" },
              sms: { type: "boolean" },
              push: { type: "boolean" },
            },
          },
        },
      },
      tags: {
        type: "list",
        items: { type: "string" },
      },
      createdAt: {
        type: "string",
      },
    },
    indexes: {
      user: {
        pk: {
          field: "pk",
          composite: ["userId"],
        },
        sk: {
          field: "sk",
          composite: [],
        },
      },
      byOrg: {
        index: "gsi1",
        pk: {
          field: "gsi1pk",
          composite: ["name"],
        },
        sk: {
          field: "gsi1sk",
          composite: ["userId"],
        },
      },
    },
  },
  { client, table: "my-test-table" },
);
