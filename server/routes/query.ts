import { Router } from 'express';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { readFile } from 'fs/promises';
import { join, resolve } from 'path';
import { pathToFileURL } from 'url';

export const queryRouter = Router();

interface QueryRequest {
  entityName: string;
  indexName: string;
  pkValues: Record<string, string>;
  skValues?: Record<string, string>;
}

queryRouter.post('/', async (req: any, res: any) => {
  try {
    const { entityName, indexName, pkValues, skValues }: QueryRequest = req.body;
    
    if (!entityName || !indexName || !pkValues) {
      return res.status(400).json({
        error: 'Missing required fields: entityName, indexName, pkValues'
      });
    }
    
    // Get config
    const configPath = join(process.cwd(), 'electroviewer.config.json');
    const configData = await readFile(configPath, 'utf-8');
    const config = JSON.parse(configData);
    
    // Load entities
    const entitiesPath = resolve(process.cwd(), config.entities);
    const entitiesUrl = pathToFileURL(entitiesPath).href;
    const entitiesModule = await import(entitiesUrl);
    const entities = entitiesModule.entities || entitiesModule.default;
    
    const entity = entities[entityName];
    if (!entity) {
      return res.status(404).json({
        error: `Entity "${entityName}" not found`
      });
    }
    
    // Initialize DynamoDB client
    const dynamoClient = new DynamoDBClient({
      region: config.region || process.env.AWS_REGION || 'us-east-1'
    });
    
    // Create ElectroDB entity instance
    const entityInstance = new (entity as any)(dynamoClient);
    
    // Build query based on index
    let query = entityInstance.query[indexName];
    
    if (!query) {
      return res.status(400).json({
        error: `Index "${indexName}" not found on entity "${entityName}"`
      });
    }
    
    // Apply PK values
    const model = entity.model;
    const indexConfig = model.indexes[indexName];
    
    if (indexConfig.pk?.composite) {
      for (const pkField of indexConfig.pk.composite) {
        if (pkValues[pkField]) {
          query = query.eq({ [pkField]: pkValues[pkField] });
        }
      }
    }
    
    // Apply SK values if provided
    if (skValues && indexConfig.sk?.composite) {
      for (const skField of indexConfig.sk.composite) {
        if (skValues[skField]) {
          query = query.eq({ [skField]: skValues[skField] });
        }
      }
    }
    
    // Execute query
    const results = await query.go();
    
    res.json({
      success: true,
      data: results.data,
      count: results.data?.length || 0
    });
    
  } catch (error: any) {
    console.error('Query error:', error);
    res.status(500).json({
      error: 'Failed to execute query',
      details: error.message
    });
  }
});