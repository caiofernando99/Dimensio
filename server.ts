import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { unifiedApiRouter } from './src/server/api/unifiedRouter.ts';
import { getOpenApiSpec, renderApiDocsHtml } from './src/server/api/docs.ts';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.text({ limit: '10mb' }));

// Static route for Dev Test Sandbox (WMS, ERP, Totem, and API test bench)
app.use('/test-sandbox', express.static(path.join(process.cwd(), 'test-sandbox')));

// Chrome Enterprise extension update manifest XML endpoint
app.get('/api/extension/updates.xml', (_req, res) => {
  res.setHeader('Content-Type', 'application/xml');
  res.send(`<?xml version='1.0' encoding='UTF-8'?>
<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>
  <app appid='dimensio-chrome-extension'>
    <updatecheck codebase='http://127.0.0.1:${PORT}/chrome-extension.crx' version='1.0.0' />
  </app>
</gupdate>`);
});

// OpenAPI 3.0 JSON Specification endpoint
app.get(['/api/openapi.json', '/api/v1/openapi.json'], (req, res) => {
  const protocol = req.protocol || 'http';
  const host = req.get('host') || `localhost:${PORT}`;
  const baseUrl = `${protocol}://${host}`;
  res.json(getOpenApiSpec(baseUrl));
});

// Interactive Swagger UI API Documentation
app.get(['/api/docs', '/api/v1/docs'], (req, res) => {
  const protocol = req.protocol || 'http';
  const host = req.get('host') || `localhost:${PORT}`;
  const baseUrl = `${protocol}://${host}`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(renderApiDocsHtml(baseUrl));
});

// Mount the Refined Unified REST API
// Accessible as modern versioned /api/v1/* AND root /api/* for complete backward-compatibility
app.use('/api/v1', unifiedApiRouter);
app.use('/api', unifiedApiRouter);

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Dimensio Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
