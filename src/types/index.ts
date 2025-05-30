export interface ElectroViewerConfig {
  entities: string;
  tableName: string;
  region: string;
  service: string;
}

export interface EntityIndex {
  name: string;
  pk: string[];
  sk?: string[];
}

export interface ParsedEntity {
  name: string;
  service: string;
  indexes: EntityIndex[];
}

export interface QueryRequest {
  entityName: string;
  indexName: string;
  pkValues: Record<string, string>;
  skValues?: Record<string, string>;
}

export interface QueryResponse {
  success: boolean;
  data: any[];
  count: number;
}