import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { Service } from "electrodb";
import { Employee } from "./entities/employee";
import { Office } from "./entities/office";
import { Task } from "./entities/task";

const client = new DynamoDBClient({ region: "us-west-1" });

const table = "projectmanagement";

export const EmployeeApp = new Service(
  {
    employees: Employee,
    tasks: Task,
    offices: Office,
  },
  { client, table },
);
