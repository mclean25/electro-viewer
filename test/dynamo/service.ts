import { Entity } from "electrodb";

// Stub out the imports that would cause dependency issues
const FeatureType = {} as any;
const CreatedVia = "manual" as const;
const ColKey = {} as any;
const DetectedFye = {} as any;
const FyeOverride = {} as any;
const SyntheticFormulasByMetric = {} as any;
const SyntheticMetricsLastUpdatedBy = {} as any;
const SyntheticRowsMapByMetric = {} as any;
const LiteLatestReported = {} as any;
const AllFilingFilters = {} as any;
const EXTERNAL_SOURCES = {} as any;
const FILING_FORM_TYPES = {} as any;
const IMPORT_TRIGGERS = {} as any;
const InvokeLlmPriority = {} as any;
const LlmBillingProps = {} as any;
const EXPORT_TYPE_VALUES = {} as any;
const UploadMethod = {} as any;
const GenerateExcelModelOverrides = {} as any;
const GenerateExcelModelQueryOptions = {} as any;
const COMPANY_MODEL_STATUS_VALUES = "string";
const COMPANY_MODEL_TRIGGER_VALUES = "string";
const FILE_MODEL_STATUS_VALUES = "string";
const dayInMilliseconds = 86400000;
const GenerateModelOptionsSerialized = {} as any;
const CustomAttributeType = (type: string) => type;
const copiedFrom = {
  type: "string",
  required: false,
};

// Mock client and table - create a minimal valid DynamoDB client mock
const client = {
  send: () => Promise.resolve({}),
  config: {},
  middlewareStack: { add: () => {}, remove: () => {} },
} as any;
const table = "test-table";

// Mock getters/setters
const publicCompanyQueryGetter = () => {};
const publicCompanyQuerySetter = () => {};

const service = "model";

export const Company = new Entity(
  {
    model: {
      entity: "company",
      version: "1",
      service,
    },
    attributes: {
      companyId: {
        type: "string",
        required: true,
        readonly: true,
      },
      companyName: {
        type: "string",
        required: true,
      },
      publicCompanyInfo: {
        type: "map",
        properties: {
          cik: {
            type: "string",
            required: true,
          },
          ticker: {
            type: "string",
            required: true,
          },
          exchange: {
            type: "string",
            required: true,
          },
          reportedName: {
            type: "string",
            required: true,
          },
          ignoreUpdates: {
            type: "boolean",
          },
        },
      },
      publicCompanyQuery: {
        type: "string",
        get: publicCompanyQueryGetter,
        set: publicCompanyQuerySetter,
      },
      fileCount: {
        type: "number",
        required: true,
        default: 0,
      },
      modifiedBy: {
        type: "set",
        items: "string",
        required: false,
      },
      createdBy: {
        type: "string",
      },
      createdVia: {
        type: "string",
        required: false,
        readonly: true,
      },
      fyeOverride: {
        type: "map",
        properties: {
          date: {
            type: "map",
            required: true,
            properties: {
              year: {
                type: "number",
                required: true,
              },
              month: {
                type: "number",
                required: true,
              },
              day: {
                type: "number",
                required: true,
              },
            },
          },
          fyDateAdjustment: {
            type: "string",
            required: true,
          },
        },
      },
      createdAt: {
        type: "number",
        readOnly: true,
        required: true,
        default: () => Date.now(),
        set: () => Date.now(),
      },
      updatedAt: {
        type: "number",
        watch: "*",
        required: true,
        default: () => Date.now(),
        set: () => Date.now(),
      },
      copiedFrom,
    },
    indexes: {
      primary: {
        pk: {
          field: "pk",
          composite: [],
        },
        sk: {
          field: "sk",
          composite: ["companyId"],
        },
      },
    },
  },
  { client, table },
);

export const FileModel = new Entity(
  {
    model: {
      entity: "fileModel",
      version: "1",
      service,
    },
    attributes: {
      companyId: {
        type: "string",
        required: true,
      },
      fileId: {
        type: "string",
        required: true,
        readonly: true,
      },
      fileName: {
        type: "string",
        required: false,
      },
      fileLocation: {
        type: "string",
        required: false,
      },
      status: {
        type: FILE_MODEL_STATUS_VALUES,
        required: true,
      },
      uploadMethod: {
        type: "string",
        required: false,
      },
      pageCount: {
        type: "number",
        required: false,
      },
      createdBy: {
        type: "string",
      },
      createdVia: {
        type: "string",
        required: false,
        readonly: true,
      },
      archivedAt: {
        type: "number",
      },
      createdAt: {
        type: "number",
        readOnly: true,
        required: true,
        default: () => Date.now(),
        set: () => Date.now(),
      },
      updatedAt: {
        type: "number",
        watch: "*",
        required: true,
        default: () => Date.now(),
        set: () => Date.now(),
      },
      copiedFrom,
    },
    indexes: {
      primary: {
        pk: {
          field: "pk",
          composite: ["companyId"],
        },
        sk: {
          field: "sk",
          composite: ["fileId"],
        },
      },
    },
  },
  { client, table },
);

export const CompanyModel = new Entity(
  {
    model: {
      entity: "companyModel",
      version: "1",
      service,
    },
    attributes: {
      companyId: {
        type: "string",
        required: true,
      },
      status: {
        type: COMPANY_MODEL_STATUS_VALUES,
        required: true,
      },
      isInitial: {
        type: "boolean",
      },
      trigger: {
        type: COMPANY_MODEL_TRIGGER_VALUES,
      },
      executionArn: {
        type: "string",
      },
      excelModel: {
        type: "map",
        required: true,
        properties: {
          location: {
            type: "string",
          },
          generatedAt: {
            type: "number",
          },
          dataSize: {
            type: "number",
          },
        },
      },
      numberOfTables: {
        type: "number",
        required: false,
      },
      liteModel: {
        type: "map",
        required: true,
        properties: {
          location: {
            type: "string",
          },
          version: {
            type: "string",
          },
          generatedAt: {
            type: "number",
          },
          dataSize: {
            type: "number",
          },
        },
      },
      createdAt: {
        type: "number",
        readOnly: true,
        required: true,
        default: () => Date.now(),
        set: () => Date.now(),
      },
      updatedAt: {
        type: "number",
        watch: "*",
        required: true,
        default: () => Date.now(),
        set: () => Date.now(),
      },
      copiedFrom,
    },
    indexes: {
      primary: {
        pk: {
          field: "pk",
          composite: ["companyId"],
        },
        sk: {
          field: "sk",
          composite: ["createdAt"],
        },
      },
      byStatus: {
        index: "gsi1",
        pk: {
          field: "gsi1pk",
          composite: ["companyId"],
        },
        sk: {
          field: "gsi1sk",
          composite: ["status", "createdAt"],
        },
      },
    },
  },
  { client, table },
);