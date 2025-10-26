/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import { buildSchemaCache } from "./build-schema-cache";

describe("buildSchemaCache", () => {
  it("should parse Employee entity correctly", async () => {
    const cache = await buildSchemaCache(["test/dynamo/entities/employee.ts"]);

    const employee = cache.entities.find((e) => e.name === "employee");
    expect(employee).toBeDefined();
    expect(employee?.name).toBe("employee");
    expect(employee?.version).toBe("1");
    expect(employee?.service).toBe("taskapp");

    // Check primary index (named "employee")
    expect(employee?.indexes.employee).toBeDefined();
    expect(employee?.indexes.employee.pk.field).toBe("pk");
    expect(employee?.indexes.employee.pk.composite).toEqual(["employee"]);

    expect(employee?.indexes.employee.sk).toBeDefined();
    expect(employee?.indexes.employee.sk?.field).toBe("sk");
    expect(employee?.indexes.employee.sk?.composite).toEqual([]);

    // Ensure no null values in composite arrays
    expect(employee?.indexes.employee.pk.composite).not.toContain(null);
    expect(employee?.indexes.employee.sk?.composite).not.toContain(null);
  });

  it("should parse Task entity correctly", async () => {
    const cache = await buildSchemaCache(["test/dynamo/entities/task.ts"]);

    const task = cache.entities.find((e) => e.name === "task");
    expect(task).toBeDefined();
    expect(task?.name).toBe("task");
    expect(task?.version).toBe("1");
    expect(task?.service).toBe("taskapp");

    // Check primary index
    expect(task?.indexes.task).toBeDefined();
    expect(task?.indexes.task.pk.field).toBe("pk");
    expect(task?.indexes.task.pk.composite).toEqual(["task"]);

    expect(task?.indexes.task.sk).toBeDefined();
    expect(task?.indexes.task.sk?.field).toBe("sk");
    expect(task?.indexes.task.sk?.composite).toEqual(["project", "employee"]);

    // Ensure no null values in composite arrays
    expect(task?.indexes.task.pk.composite).not.toContain(null);
    expect(task?.indexes.task.pk.composite).not.toContain(undefined);
    expect(task?.indexes.task.sk?.composite).not.toContain(null);
    expect(task?.indexes.task.sk?.composite).not.toContain(undefined);
  });

  it("should parse Office entity with GSI correctly", async () => {
    const cache = await buildSchemaCache(["test/dynamo/entities/office.ts"]);

    const office = cache.entities.find((e) => e.name === "office");
    expect(office).toBeDefined();
    expect(office?.name).toBe("office");
    expect(office?.version).toBe("1");
    expect(office?.service).toBe("taskapp");

    // Check primary index (named "locations")
    expect(office?.indexes.locations).toBeDefined();
    expect(office?.indexes.locations.pk.field).toBe("pk");
    expect(office?.indexes.locations.pk.composite).toEqual(["country", "state"]);

    expect(office?.indexes.locations.sk).toBeDefined();
    expect(office?.indexes.locations.sk?.field).toBe("sk");
    expect(office?.indexes.locations.sk?.composite).toEqual(["city", "zip", "office"]);

    // Check GSI (named "office")
    expect(office?.indexes.office).toBeDefined();
    expect(office?.indexes.office.pk.field).toBe("gsi1pk");
    expect(office?.indexes.office.pk.composite).toEqual(["office"]);

    expect(office?.indexes.office.sk).toBeDefined();
    expect(office?.indexes.office.sk?.field).toBe("gsi1sk");
    expect(office?.indexes.office.sk?.composite).toEqual([]);

    // Ensure no null values in composite arrays
    expect(office?.indexes.locations.pk.composite).not.toContain(null);
    expect(office?.indexes.locations.sk?.composite).not.toContain(null);
    expect(office?.indexes.office.pk.composite).not.toContain(null);
    expect(office?.indexes.office.sk?.composite).not.toContain(null);
  });

  it("should parse all three entities", async () => {
    const cache = await buildSchemaCache([
      "test/dynamo/entities/employee.ts",
      "test/dynamo/entities/task.ts",
      "test/dynamo/entities/office.ts",
    ]);

    expect(cache.entities).toHaveLength(3);

    const entityNames = cache.entities.map((e) => e.name);
    expect(entityNames).toContain("employee");
    expect(entityNames).toContain("task");
    expect(entityNames).toContain("office");
  });

  it("should extract attributes with full metadata", async () => {
    const cache = await buildSchemaCache(["test/dynamo/entities/employee.ts"]);

    const employee = cache.entities.find((e) => e.name === "employee");
    expect(employee?.attributes).toBeDefined();

    // Check attribute names are present
    expect(employee?.attributes.employee).toBeDefined();
    expect(employee?.attributes.firstName).toBeDefined();
    expect(employee?.attributes.lastName).toBeDefined();
    expect(employee?.attributes.office).toBeDefined();
    expect(employee?.attributes.title).toBeDefined();
    expect(employee?.attributes.team).toBeDefined();

    // Check attribute metadata
    expect(employee?.attributes.employee.type).toBe("string");
    expect(employee?.attributes.firstName.type).toBe("string");
    expect(employee?.attributes.lastName.type).toBe("string");
  });

  it("should parse Employee entity with multiple GSIs", async () => {
    const cache = await buildSchemaCache(["test/dynamo/entities/employee.ts"]);

    const employee = cache.entities.find((e) => e.name === "employee");
    expect(employee).toBeDefined();

    // Check that multiple GSIs are parsed
    expect(employee?.indexes.coworkers).toBeDefined();
    expect(employee?.indexes.teams).toBeDefined();
    expect(employee?.indexes.employeeLookup).toBeDefined();
    expect(employee?.indexes.roles).toBeDefined();
    expect(employee?.indexes.directReports).toBeDefined();

    // Check coworkers GSI
    expect(employee?.indexes.coworkers.pk.field).toBe("gsi1pk");
    expect(employee?.indexes.coworkers.pk.composite).toEqual(["office"]);
    expect(employee?.indexes.coworkers.sk?.composite).toEqual([
      "team",
      "title",
      "employee",
    ]);

    // Check teams GSI
    expect(employee?.indexes.teams.pk.field).toBe("gsi2pk");
    expect(employee?.indexes.teams.pk.composite).toEqual(["team"]);
    expect(employee?.indexes.teams.sk?.composite).toEqual([
      "title",
      "salary",
      "employee",
    ]);
  });

  it("should parse Task entity with multiple GSIs", async () => {
    const cache = await buildSchemaCache(["test/dynamo/entities/task.ts"]);

    const task = cache.entities.find((e) => e.name === "task");
    expect(task).toBeDefined();

    // Check multiple indexes
    expect(task?.indexes.task).toBeDefined();
    expect(task?.indexes.project).toBeDefined();
    expect(task?.indexes.assigned).toBeDefined();

    // Check project GSI
    expect(task?.indexes.project.indexName).toBe("gsi1");
    expect(task?.indexes.project.pk.field).toBe("gsi1pk");
    expect(task?.indexes.project.pk.composite).toEqual(["project"]);
    expect(task?.indexes.project.sk?.composite).toEqual(["employee", "task"]);

    // Check assigned GSI
    expect(task?.indexes.assigned.indexName).toBe("gsi3");
    expect(task?.indexes.assigned.pk.field).toBe("gsi3pk");
    expect(task?.indexes.assigned.pk.composite).toEqual(["employee"]);
    expect(task?.indexes.assigned.sk?.composite).toEqual(["project", "task"]);
  });

  it("should ensure no null/undefined values in any composite arrays", async () => {
    const cache = await buildSchemaCache([
      "test/dynamo/entities/employee.ts",
      "test/dynamo/entities/task.ts",
      "test/dynamo/entities/office.ts",
    ]);

    for (const entity of cache.entities) {
      for (const [indexName, index] of Object.entries(entity.indexes)) {
        // Check PK composites
        expect(
          index.pk.composite.every((c) => c !== null && c !== undefined),
          `${entity.name}.${indexName}.pk.composite should not contain null/undefined`,
        ).toBe(true);

        // Check SK composites if present
        if (index.sk) {
          expect(
            index.sk.composite.every((c) => c !== null && c !== undefined),
            `${entity.name}.${indexName}.sk.composite should not contain null/undefined`,
          ).toBe(true);
        }
      }
    }
  });

  it("should include metadata about the cache generation", async () => {
    const cache = await buildSchemaCache([
      "test/dynamo/entities/employee.ts",
      "test/dynamo/entities/task.ts",
      "test/dynamo/entities/office.ts",
    ]);

    expect(cache.generatedAt).toBeDefined();
    expect(cache.config).toBeDefined();
    expect(cache.config.entityConfigPaths).toEqual([
      "test/dynamo/entities/employee.ts",
      "test/dynamo/entities/task.ts",
      "test/dynamo/entities/office.ts",
    ]);
  });
});
