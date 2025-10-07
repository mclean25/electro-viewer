/**
 * Zod schema for validating ElectroDB entity schemas
 */
import { z } from "zod";

/**
 * Attribute definition schema
 */
export type AttributeDefinition = {
  type: string;
  required?: boolean;
  readonly?: boolean;
  default?: any;
  properties?: Record<string, AttributeDefinition>;
  items?: string | AttributeDefinition;
};

export const attributeDefinitionSchema: z.ZodType<AttributeDefinition> = z.object({
  type: z.string(),
  required: z.boolean().optional(),
  readonly: z.boolean().optional(),
  default: z.any().optional(),
  properties: z.lazy(() => z.record(z.string(), attributeDefinitionSchema)).optional(),
  items: z.union([z.string(), z.lazy(() => attributeDefinitionSchema)]).optional(),
});

/**
 * Index definition schema
 */
const indexDefinitionSchema = z.object({
  indexName: z.string().optional(),
  pk: z.object({
    field: z.string(),
    composite: z.array(z.string()),
    template: z.string().optional(),
  }),
  sk: z
    .object({
      field: z.string(),
      composite: z.array(z.string()),
      template: z.string().optional(),
    })
    .optional(),
});

export type IndexDefinition = z.infer<typeof indexDefinitionSchema>;

/**
 * Entity schema validation
 */
export const entitySchemaSchema = z.object({
  name: z.string(),
  version: z.string(),
  service: z.string(),
  sourceFile: z.string(),
  indexes: z.record(z.string(), indexDefinitionSchema),
  attributes: z.record(z.string(), attributeDefinitionSchema),
});

export type EntitySchema = z.infer<typeof entitySchemaSchema>;

/**
 * Schema cache validation
 */
export const schemaCacheSchema = z.object({
  entities: z.array(entitySchemaSchema),
  generatedAt: z.string(),
  config: z.object({
    entityConfigPaths: z.array(z.string()),
    tsconfigPath: z.string().optional(),
  }),
});

export type SchemaCache = z.infer<typeof schemaCacheSchema>;
