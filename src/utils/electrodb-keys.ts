export interface EntitySchema {
  name: string;
  version: string;
  service: string;
}

export const buildElectroDBKey = (
  isPartitionKey: boolean,
  composite: string[],
  values: Record<string, string>,
  schema: EntitySchema,
) => {
  if (isPartitionKey) {
    // For PK with composites - no entity name, just service and composites
    const prefix = `$${schema.service.toLowerCase()}#`;
    if (composite.length === 0) {
      // Remove the trailing #
      return prefix.slice(0, -1);
    }
    const compositeValues = composite
      .filter((field) => field)
      .map((field) => {
        const value = values[field] || "";
        return `${field.toLowerCase()}_${value}`;
      })
      .join("#");
    return prefix + compositeValues;
  } else {
    // For SK (sort keys) - always include version
    const entityName = schema.name.toLowerCase();
    const version = schema.version || "1";
    const entityPart = `${entityName}_${version}`;

    if (composite.length === 0) {
      return `$${entityPart}`; // Static sort key with entity prefix and version
    }
    // SK with composites includes entity prefix and version
    const prefix = `$${entityPart}#`;
    const compositeValues = composite
      .filter((field) => field)
      .map((field) => {
        const value = values[field] || "";
        return `${field.toLowerCase()}_${value}`;
      })
      .join("#");
    return prefix + compositeValues;
  }
};
