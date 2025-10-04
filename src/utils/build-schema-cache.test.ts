/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import { buildSchemaCache } from "./build-schema-cache";

describe("buildSchemaCache", () => {
  it("should parse Company entity correctly", async () => {
    const cache = await buildSchemaCache([
      "test/dynamo/service.ts",
    ]);

    const company = cache.entities.find((e) => e.name === "company");
    expect(company).toBeDefined();
    expect(company?.name).toBe("company");
    expect(company?.version).toBe("1");
    expect(company?.service).toBe("model");

    // Check primary index
    expect(company?.indexes.primary).toBeDefined();
    expect(company?.indexes.primary.pk.field).toBe("pk");
    expect(company?.indexes.primary.pk.composite).toEqual([]);

    expect(company?.indexes.primary.sk).toBeDefined();
    expect(company?.indexes.primary.sk?.field).toBe("sk");
    expect(company?.indexes.primary.sk?.composite).toEqual(["companyId"]);

    // Ensure no null values in composite arrays
    expect(company?.indexes.primary.pk.composite).not.toContain(null);
    expect(company?.indexes.primary.sk?.composite).not.toContain(null);
  });

  it("should parse FileModel entity correctly", async () => {
    const cache = await buildSchemaCache([
      "test/dynamo/service.ts",
    ]);

    const fileModel = cache.entities.find((e) => e.name === "fileModel");
    expect(fileModel).toBeDefined();
    expect(fileModel?.name).toBe("fileModel");
    expect(fileModel?.version).toBe("1");
    expect(fileModel?.service).toBe("model");

    // Check primary index
    expect(fileModel?.indexes.primary).toBeDefined();
    expect(fileModel?.indexes.primary.pk.field).toBe("pk");
    expect(fileModel?.indexes.primary.pk.composite).toEqual(["companyId"]);

    expect(fileModel?.indexes.primary.sk).toBeDefined();
    expect(fileModel?.indexes.primary.sk?.field).toBe("sk");
    expect(fileModel?.indexes.primary.sk?.composite).toEqual(["fileId"]);

    // Ensure no null values in composite arrays
    expect(fileModel?.indexes.primary.pk.composite).not.toContain(null);
    expect(fileModel?.indexes.primary.pk.composite).not.toContain(undefined);
    expect(fileModel?.indexes.primary.sk?.composite).not.toContain(null);
    expect(fileModel?.indexes.primary.sk?.composite).not.toContain(undefined);
  });

  it("should parse CompanyModel entity with GSI correctly", async () => {
    const cache = await buildSchemaCache([
      "test/dynamo/service.ts",
    ]);

    const companyModel = cache.entities.find((e) => e.name === "companyModel");
    expect(companyModel).toBeDefined();
    expect(companyModel?.name).toBe("companyModel");
    expect(companyModel?.version).toBe("1");
    expect(companyModel?.service).toBe("model");

    // Check primary index
    expect(companyModel?.indexes.primary).toBeDefined();
    expect(companyModel?.indexes.primary.pk.field).toBe("pk");
    expect(companyModel?.indexes.primary.pk.composite).toEqual(["companyId"]);

    expect(companyModel?.indexes.primary.sk).toBeDefined();
    expect(companyModel?.indexes.primary.sk?.field).toBe("sk");
    expect(companyModel?.indexes.primary.sk?.composite).toEqual(["createdAt"]);

    // Check GSI
    expect(companyModel?.indexes.byStatus).toBeDefined();
    expect(companyModel?.indexes.byStatus.pk.field).toBe("gsi1pk");
    expect(companyModel?.indexes.byStatus.pk.composite).toEqual(["companyId"]);

    expect(companyModel?.indexes.byStatus.sk).toBeDefined();
    expect(companyModel?.indexes.byStatus.sk?.field).toBe("gsi1sk");
    expect(companyModel?.indexes.byStatus.sk?.composite).toEqual(["status", "createdAt"]);

    // Ensure no null values in composite arrays
    expect(companyModel?.indexes.primary.pk.composite).not.toContain(null);
    expect(companyModel?.indexes.primary.sk?.composite).not.toContain(null);
    expect(companyModel?.indexes.byStatus.pk.composite).not.toContain(null);
    expect(companyModel?.indexes.byStatus.sk?.composite).not.toContain(null);
  });

  it("should parse all three entities", async () => {
    const cache = await buildSchemaCache([
      "test/dynamo/service.ts",
    ]);

    expect(cache.entities).toHaveLength(3);

    const entityNames = cache.entities.map((e) => e.name);
    expect(entityNames).toContain("company");
    expect(entityNames).toContain("fileModel");
    expect(entityNames).toContain("companyModel");
  });

  it("should extract attributes correctly", async () => {
    const cache = await buildSchemaCache([
      "test/dynamo/service.ts",
    ]);

    const company = cache.entities.find((e) => e.name === "company");
    expect(company?.attributes).toBeDefined();
    expect(company?.attributes).toContain("companyId");
    expect(company?.attributes).toContain("companyName");
    expect(company?.attributes).toContain("createdAt");
    expect(company?.attributes).toContain("updatedAt");
  });

  it("should ensure no null/undefined values in any composite arrays", async () => {
    const cache = await buildSchemaCache([
      "test/dynamo/service.ts",
    ]);

    for (const entity of cache.entities) {
      for (const [indexName, index] of Object.entries(entity.indexes)) {
        // Check PK composites
        expect(
          index.pk.composite.every((c) => c !== null && c !== undefined),
          `${entity.name}.${indexName}.pk.composite should not contain null/undefined`
        ).toBe(true);

        // Check SK composites if present
        if (index.sk) {
          expect(
            index.sk.composite.every((c) => c !== null && c !== undefined),
            `${entity.name}.${indexName}.sk.composite should not contain null/undefined`
          ).toBe(true);
        }
      }
    }
  });

  it("should include metadata about the cache generation", async () => {
    const cache = await buildSchemaCache([
      "test/dynamo/service.ts",
    ]);

    expect(cache.generatedAt).toBeDefined();
    expect(cache.config).toBeDefined();
    expect(cache.config.entityConfigPaths).toEqual([
      "test/dynamo/service.ts",
    ]);
  });
});
