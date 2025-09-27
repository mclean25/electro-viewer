import { describe, it, expect } from "vitest";
import { buildElectroDBKey } from "./electrodb-keys";

describe("buildElectroDBKey", () => {
  describe("FileModel entity", () => {
    const fileModelSchema = {
      name: "fileModel",
      version: "1",
      service: "model",
    };

    it("should generate correct PK with companyId", () => {
      const pk = buildElectroDBKey(
        true, // isPartitionKey
        ["companyId"], // composite attributes
        { companyId: "1353d4c0-8ba6-4c13-a679-cdd6d6dba7ea" },
        fileModelSchema
      );
      
      expect(pk).toBe("$model#companyid_1353d4c0-8ba6-4c13-a679-cdd6d6dba7ea");
    });

    it("should generate correct SK with fileId", () => {
      const sk = buildElectroDBKey(
        false, // not partition key (this is SK)
        ["fileId"], // composite attributes
        { fileId: "file-123" },
        fileModelSchema
      );
      
      expect(sk).toBe("$filemodel_1#fileid_file-123");
    });
  });

  describe("Company entity", () => {
    const companySchema = {
      name: "company",
      version: "1",
      service: "model",
    };

    describe("Primary Key (PK)", () => {
      it("should generate correct PK for company with no composite attributes", () => {
        const pk = buildElectroDBKey(
          true, // isPartitionKey
          [], // no composite attributes
          {}, // no values needed
          companySchema
        );
        
        expect(pk).toBe("$model");
      });
    });

    describe("Sort Key (SK)", () => {
      it("should generate correct SK for company with companyId", () => {
        const sk = buildElectroDBKey(
          false, // not partition key (this is SK)
          ["companyId"], // composite attributes
          { companyId: "1353d4c0-8ba6-4c13-a679-cdd6d6dba7ea" },
          companySchema
        );
        
        expect(sk).toBe("$company_1#companyid_1353d4c0-8ba6-4c13-a679-cdd6d6dba7ea");
      });

      it("should generate correct SK with empty companyId", () => {
        const sk = buildElectroDBKey(
          false, // not partition key (this is SK)
          ["companyId"], // composite attributes
          { companyId: "" }, // empty value
          companySchema
        );
        
        expect(sk).toBe("$company_1#companyid_");
      });

      it("should generate correct SK with different companyId", () => {
        const sk = buildElectroDBKey(
          false, // not partition key (this is SK)
          ["companyId"], // composite attributes
          { companyId: "3512568b-1a5a-48ed-be13-771f167aafdf" },
          companySchema
        );
        
        expect(sk).toBe("$company_1#companyid_3512568b-1a5a-48ed-be13-771f167aafdf");
      });
    });
  });

  describe("Version handling", () => {
    it("should include version 1 in SK", () => {
      const schema = {
        name: "user",
        version: "1",
        service: "app",
      };

      const sk = buildElectroDBKey(
        false,
        ["userId"],
        { userId: "123" },
        schema
      );

      expect(sk).toBe("$user_1#userid_123");
    });

    it("should include version 2 in SK", () => {
      const schema = {
        name: "user",
        version: "2",
        service: "app",
      };

      const sk = buildElectroDBKey(
        false,
        ["userId"],
        { userId: "123" },
        schema
      );

      expect(sk).toBe("$user_2#userid_123");
    });

    it("should NOT include entity name in PK with composites", () => {
      const schema = {
        name: "product",
        version: "3",
        service: "catalog",
      };

      const pk = buildElectroDBKey(
        true,
        ["categoryId"],
        { categoryId: "electronics" },
        schema
      );

      expect(pk).toBe("$catalog#categoryid_electronics");
    });
  });

  describe("Other entity patterns", () => {
    it("should generate PK with composite attributes", () => {
      const schema = {
        name: "user",
        version: "2",
        service: "app",
      };

      const pk = buildElectroDBKey(
        true, // isPartitionKey
        ["organizationId", "departmentId"],
        { organizationId: "org123", departmentId: "dept456" },
        schema
      );

      expect(pk).toBe("$app#organizationid_org123#departmentid_dept456");
    });

    it("should generate static SK for entity with no SK composites", () => {
      const schema = {
        name: "config",
        version: "1",
        service: "system",
      };

      const sk = buildElectroDBKey(
        false, // not partition key
        [], // no composite attributes
        {},
        schema
      );

      expect(sk).toBe("$config_1");
    });

    it("should handle multiple SK composite attributes", () => {
      const schema = {
        name: "product",
        version: "3",
        service: "catalog",
      };

      const sk = buildElectroDBKey(
        false, // not partition key
        ["categoryId", "productId"],
        { categoryId: "electronics", productId: "laptop123" },
        schema
      );

      expect(sk).toBe("$product_3#categoryid_electronics#productid_laptop123");
    });
  });
});