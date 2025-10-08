#!/usr/bin/env node
/**
 * Node.js HTTP server runtime for TanStack Start
 * This wraps the built fetch handler in a Node HTTP server
 */
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import the built server fetch handler
const serverModule = await import(resolve(__dirname, 'dist/server/server.js'));
const { default: server } = serverModule;

const port = process.env.PORT || 3030;
const host = process.env.HOST || '0.0.0.0';

// Create HTTP server that wraps the fetch handler
const httpServer = createServer(async (req, res) => {
  try {
    // Convert Node.js request to Web Request
    const url = `http://${req.headers.host}${req.url}`;

    // Read body for POST/PUT requests
    const body = await new Promise((resolve) => {
      if (req.method === 'GET' || req.method === 'HEAD') {
        resolve(null);
        return;
      }

      const chunks = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(buffer.length > 0 ? buffer : null);
      });
    });

    const request = new Request(url, {
      method: req.method,
      headers: req.headers,
      body,
    });

    // Call the fetch handler
    const response = await server.fetch(request);

    // Convert Web Response to Node.js response
    res.statusCode = response.status;

    // Set headers
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    // Send body
    if (response.body) {
      const reader = response.body.getReader();
      const pump = async () => {
        const { done, value } = await reader.read();
        if (done) {
          res.end();
          return;
        }
        res.write(value);
        await pump();
      };
      await pump();
    } else {
      res.end();
    }
  } catch (error) {
    console.error('Server error:', error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Internal Server Error');
    }
  }
});

httpServer.listen(port, host, () => {
  console.log(`✅ Server listening on http://${host}:${port}`);
});

// Handle shutdown gracefully
process.on('SIGTERM', () => {
  console.log('\n👋 SIGTERM received, shutting down gracefully...');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n👋 SIGINT received, shutting down gracefully...');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
