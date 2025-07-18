import { Router } from "express";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { homedir } from "node:os";

export const entitiesRouter = Router();

interface EntityIndex {
  name: string;
  pk: string[];
  sk?: string[];
}

interface ParsedEntity {
  name: string;
  service: string;
  indexes: EntityIndex[];
}

entitiesRouter.get("/", async (req: any, res: any) => {
  try {
    // First get the config to know where entities file is
    const configPath = join(process.cwd(), "electroviewer.config.json");
    const configData = await readFile(configPath, "utf-8");
    const config = JSON.parse(configData);

    // Resolve the entities file path
    let entitiesPath = config.entities;
    if (entitiesPath.startsWith("~")) {
      entitiesPath = entitiesPath.replace("~", homedir());
    }
    entitiesPath = resolve(process.cwd(), entitiesPath);
    const entitiesUrl = pathToFileURL(entitiesPath).href;

    // Dynamic import the entities file
    const entitiesModule = await import(entitiesUrl);

    // Look for entities in different possible exports
    let entities = entitiesModule.entities || entitiesModule.default;

    // If no entities found, try to get them from a service export
    if (!entities || typeof entities !== "object") {
      const service = entitiesModule.ModelService || entitiesModule.default;
      if (service?.entities) {
        entities = service.entities;
      }
    }

    if (!entities || typeof entities !== "object") {
      return res.status(400).json({
        error:
          'Entities file must export an "entities" object or a service with entities',
      });
    }

    // Parse each entity to extract indexes
    const parsedEntities: ParsedEntity[] = [];

    for (const [entityName, entity] of Object.entries(entities)) {
      if (!entity || typeof entity !== "object") continue;

      const entityConfig = entity as any;
      const model = entityConfig.model;
      const service = entityConfig.service || config.service || "unknown";

      if (!model || !model.indexes) continue;

      const indexes: EntityIndex[] = [];

      for (const [indexName, indexConfig] of Object.entries(model.indexes)) {
        const index = indexConfig as any;
        if (index.pk) {
          indexes.push({
            name: indexName,
            pk: Array.isArray(index.pk.composite) ? index.pk.composite : [],
            sk: Array.isArray(index.sk?.composite) ? index.sk.composite : undefined,
          });
        }
      }

      parsedEntities.push({
        name: entityName,
        service,
        indexes,
      });
    }

    res.json(parsedEntities);
  } catch (error: any) {
    console.error("Error parsing entities:", error);
    res.status(500).json({
      error: "Failed to parse entities file",
      details: error.message,
    });
  }
});
