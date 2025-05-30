import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFile } from 'fs/promises';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { configRouter } from './routes/config.js';
import { entitiesRouter } from './routes/entities.js';
import { queryRouter } from './routes/query.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 4002;

// Middleware
app.use(cors());
app.use(express.json());

// API routes
app.use('/api/config', configRouter);
app.use('/api/entities', entitiesRouter);
app.use('/api/query', queryRouter);

// Serve static files from Vite build
const distPath = join(__dirname, '../dist');
app.use(express.static(distPath));

// Catch-all handler for React Router
app.get('*', async (req, res) => {
  try {
    const html = await readFile(join(distPath, 'index.html'), 'utf-8');
    res.send(html);
  } catch (error) {
    console.error('Error serving index.html:', error);
    res.status(500).send('Server Error');
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Electro Viewer running at http://localhost:${PORT}`);
  console.log('📁 Looking for electroviewer.config.json in current directory');
});