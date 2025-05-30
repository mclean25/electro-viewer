import { Router } from 'express';
import { readFile } from 'fs/promises';
import { join, resolve } from 'path';
import { pathToFileURL } from 'url';

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

entitiesRouter.get('/', async (req: any, res: any) => {
  try {
    // First get the config to know where entities file is
    const configPath = join(process.cwd(), 'electroviewer.config.json');
    const configData = await readFile(configPath, 'utf-8');
    const config = JSON.parse(configData);
    
    // Resolve the entities file path
    const entitiesPath = resolve(process.cwd(), config.entities);
    const entitiesUrl = pathToFileURL(entitiesPath).href;
    
    // Dynamic import the entities file
    const entitiesModule = await import(entitiesUrl);
    const entities = entitiesModule.entities || entitiesModule.default;
    
    if (!entities || typeof entities !== 'object') {
      return res.status(400).json({
        error: 'Entities file must export an "entities" object'
      });
    }
    
    // Parse each entity to extract indexes
    const parsedEntities: ParsedEntity[] = [];
    
    for (const [entityName, entity] of Object.entries(entities)) {
      if (!entity || typeof entity !== 'object') continue;
      
      const entityConfig = entity as any;
      const model = entityConfig.model;
      const service = entityConfig.service || config.service || 'unknown';
      
      if (!model || !model.indexes) continue;
      
      const indexes: EntityIndex[] = [];
      
      for (const [indexName, indexConfig] of Object.entries(model.indexes)) {
        const index = indexConfig as any;
        if (index.pk) {
          indexes.push({
            name: indexName,
            pk: Array.isArray(index.pk.composite) ? index.pk.composite : [],
            sk: Array.isArray(index.sk?.composite) ? index.sk.composite : undefined
          });
        }
      }
      
      parsedEntities.push({
        name: entityName,
        service,
        indexes
      });
    }
    
    res.json(parsedEntities);
    
  } catch (error: any) {
    console.error('Error parsing entities:', error);
    res.status(500).json({
      error: 'Failed to parse entities file',
      details: error.message
    });
  }
});