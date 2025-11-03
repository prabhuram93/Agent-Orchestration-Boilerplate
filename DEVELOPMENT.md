# Development Guide

This guide covers local development setup and workflow for the Agent Orchestration Boilerplate.

## Architecture Overview

The project consists of two main packages:

1. **Web Package** (`packages/web/`): React frontend built with Vite and Adobe React Spectrum
2. **Worker Package** (`packages/worker/`): Cloudflare Worker backend with Hono framework

### Request Flow

```
Browser → Web (Vite:3000) → Proxy → Worker (Wrangler:8787) → Cloudflare Sandbox
```

The web application runs on port 3000 and proxies API requests to the worker running on port 8787.

## Initial Setup

### 1. Environment Configuration

Create environment files from the examples:

```bash
# Root directory
cp .env.example .env

# Web package
cd packages/web
cp .env.example .env
cd ../..
```

### 2. Install Dependencies

```bash
# Install worker dependencies
cd packages/worker
npm install

# Install web dependencies
cd ../web
npm install
```

## Running the Application

You need to run both packages in separate terminal windows:

### Terminal 1: Start the Worker

```bash
cd packages/worker
npm run dev
```

This starts the Cloudflare Worker on `http://localhost:8787`

**Expected output:**
```
⛅️ wrangler 4.x.x
-------------------
Your worker has some bindings:
- Durable Objects:
  - Sandbox: Sandbox
```

### Terminal 2: Start the Web App

```bash
cd packages/web
npm run dev
```

This starts the Vite dev server on `http://localhost:3000`

**Expected output:**
```
  VITE v7.x.x  ready in xxx ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: use --host to expose
```

### 3. Open the Application

Navigate to `http://localhost:3000` in your browser.

## Port Configuration

Ports can be customized via environment variables:

### Root `.env` file:
```bash
# Development Port Configuration
WEB_PORT=3000
WORKER_PORT=8787
VITE_WORKER_URL=http://localhost:8787
```

### Web package `.env` file:
```bash
VITE_WORKER_URL=http://localhost:8787
```

### Changing Ports

If you need to use different ports:

1. Update `packages/worker/wrangler.jsonc`:
   ```json
   "dev": {
     "port": 9000,  // your custom port
     "ip": "0.0.0.0"
   }
   ```

2. Update `packages/web/.env`:
   ```bash
   VITE_WORKER_URL=http://localhost:9000
   ```

3. Restart both services

## How the Proxy Works

The web application's Vite configuration (`packages/web/vite.config.ts`) includes a proxy:

```typescript
server: {
  port: 3000,
  proxy: {
    '/api': {
      target: process.env.VITE_WORKER_URL || 'http://localhost:8787',
      changeOrigin: true,
      secure: false,
    },
  },
}
```

**What this means:**
- Any request to `http://localhost:3000/api/*` is forwarded to `http://localhost:8787/api/*`
- The worker receives the request and processes it
- Responses are sent back through the proxy to the browser

## API Endpoints

### `POST /api/analyze`

Main endpoint for repository analysis.

**Request:**
```json
{
  "repo": "https://github.com/owner/repo",
  "sessionId": "optional-session-id",
  "selectedModules": ["Module1", "Module2"],
  "rootPath": "/workspace/repo",
  "envVars": {
    "CUSTOM_VAR": "value"
  }
}
```

**Response:** NDJSON stream

```json
{"type":"progress","message":"Starting analysis...","sessionId":"m2-1234567890"}
{"type":"progress","message":"Fetching repository..."}
{"type":"result","data":{"results":[...]}}
```

## Troubleshooting

### Port Already in Use

If you get "port already in use" errors:

```bash
# Find and kill the process using the port
lsof -ti:3000 | xargs kill -9  # for web
lsof -ti:8787 | xargs kill -9  # for worker
```

### Worker Not Responding

1. Check that the worker is running: `curl http://localhost:8787/api/analyze`
2. Verify the port in `wrangler.jsonc` matches your `.env` configuration
3. Check worker logs in the terminal where you ran `npm run dev`

### CORS Issues

CORS is configured in the worker (`packages/worker/src/index.ts`):

```typescript
app.use('/*', cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
  credentials: true,
}));
```

If you change the web port, update the CORS origins accordingly.

### Proxy Not Working

If API requests fail:

1. Check the browser console for errors
2. Verify `VITE_WORKER_URL` in `packages/web/.env`
3. Restart the Vite dev server after changing `.env` files
4. Check the Network tab in browser DevTools to see where requests are going

## Development Workflow

### Making Changes

1. **Frontend changes** (`packages/web/src/*`): Hot module replacement works automatically
2. **Worker changes** (`packages/worker/src/*`): Wrangler will reload automatically
3. **Environment changes**: Restart the affected service

### Testing the API

You can test the worker directly:

```bash
curl -X POST http://localhost:8787/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"repo":"https://github.com/magento/magento2"}'
```

### Browser DevTools

- **Network Tab**: See all requests to `/api/*` and their responses
- **Console**: View logs from the React app
- **Application Tab**: Check localStorage for theme settings

## Common Tasks

### Adding a New API Endpoint

1. Add the route in `packages/worker/src/index.ts`:
   ```typescript
   app.get('/api/health', (c) => {
     return c.json({ status: 'ok' })
   })
   ```

2. Call it from the web app:
   ```typescript
   const response = await fetch('/api/health')
   const data = await response.json()
   ```

### Adding Environment Variables

1. Add to worker's `wrangler.jsonc` (for Cloudflare secrets):
   ```json
   "vars": {
     "MY_VAR": "value"
   }
   ```

2. Add to web's `.env` file (must start with `VITE_`):
   ```bash
   VITE_MY_VAR=value
   ```

3. Access in code:
   ```typescript
   // Worker
   const myVar = c.env.MY_VAR
   
   // Web
   const myVar = import.meta.env.VITE_MY_VAR
   ```

## Production Deployment

### Worker Deployment

```bash
cd packages/worker
npm run deploy
```

### Web Deployment

```bash
cd packages/web
npm run build
# Deploy dist/ folder to your hosting service
```

After deployment, update the web app to point to your production worker URL:

```bash
VITE_WORKER_URL=https://your-worker.workers.dev
```

## Additional Resources

- [Vite Documentation](https://vitejs.dev/)
- [Hono Documentation](https://hono.dev/)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [React Spectrum Documentation](https://react-spectrum.adobe.com/)

