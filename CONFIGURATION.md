# Configuration Guide

This document describes the configuration setup for connecting the web frontend to the worker backend.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser                                  │
│                     http://localhost:3000                        │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       │ fetch('/api/analyze', ...)
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Vite Dev Server                               │
│                   (packages/web)                                 │
│                   Port: 3000                                     │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  Proxy Configuration (vite.config.ts)                  │   │
│  │  /api/* → http://localhost:8787/api/*                 │   │
│  └────────────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       │ Proxied request
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Cloudflare Worker                                │
│                  (packages/worker)                               │
│                  Port: 8787                                      │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  Hono Server with CORS                                 │   │
│  │  POST /api/analyze                                     │   │
│  │  Origins: http://localhost:3000                        │   │
│  └────────────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
               Cloudflare Sandbox
                (Code Execution)
```

## Configuration Files

### 1. Root `.env.example`

**Location:** `/Agent-Orchestration-Boilerplate/.env.example`

```bash
# Development Port Configuration

# Web application port (Vite dev server)
WEB_PORT=3000

# Worker application port (Wrangler dev server)
WORKER_PORT=8787

# Worker URL (used by web app to proxy API requests)
VITE_WORKER_URL=http://localhost:8787
```

**Purpose:** Defines the default ports for local development at the project root level.

### 2. Web Package `.env.example`

**Location:** `/Agent-Orchestration-Boilerplate/packages/web/.env.example`

```bash
# Worker API URL for local development
# This should point to where your Cloudflare Worker is running locally
VITE_WORKER_URL=http://localhost:8787
```

**Purpose:** Tells the web app where to find the worker API. This value is read by Vite and used in the proxy configuration.

**Important:** Environment variables in Vite must be prefixed with `VITE_` to be exposed to the client code.

### 3. Vite Configuration

**Location:** `/Agent-Orchestration-Boilerplate/packages/web/vite.config.ts`

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: process.env.VITE_WORKER_URL || 'http://localhost:8787',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
```

**Key configurations:**
- `port: 3000` - Web server runs on port 3000
- `proxy: { '/api': {...} }` - Any request to `/api/*` is forwarded to the worker
- `target: process.env.VITE_WORKER_URL || 'http://localhost:8787'` - Reads from .env or defaults to localhost:8787
- `changeOrigin: true` - Changes the origin header to match the target
- `secure: false` - Allows proxying to http (non-https) for local development

### 4. Worker Configuration

**Location:** `/Agent-Orchestration-Boilerplate/packages/worker/wrangler.jsonc`

```json
{
  "name": "boilerplate-m2-analysis",
  "main": "src/index.ts",
  "compatibility_date": "2025-05-06",
  "compatibility_flags": ["nodejs_compat"],
  "dev": {
    "port": 8787,
    "ip": "0.0.0.0"
  },
  "vars": {
    "ENV": "local"
  },
  // ... other configuration
}
```

**Key configurations:**
- `dev.port: 8787` - Worker dev server runs on port 8787
- `dev.ip: "0.0.0.0"` - Listens on all network interfaces

### 5. Worker CORS Configuration

**Location:** `/Agent-Orchestration-Boilerplate/packages/worker/src/index.ts`

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getSandbox } from '@cloudflare/sandbox';

const app = new Hono();

// Enable CORS for local development
app.use('/*', cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
  credentials: true,
}));
```

**Key configurations:**
- `origin: ['http://localhost:3000', 'http://127.0.0.1:3000']` - Allows requests from the web app
- `allowMethods: ['GET', 'POST', 'OPTIONS']` - Permits these HTTP methods
- `credentials: true` - Allows cookies and authorization headers

### 6. Package Scripts

**Root package.json:**
```json
{
  "scripts": {
    "dev:worker": "cd packages/worker && npm run dev",
    "dev:web": "cd packages/web && npm run dev",
    "install:all": "cd packages/worker && npm install && cd ../web && npm install"
  }
}
```

**Worker package.json:**
```json
{
  "scripts": {
    "dev": "npx wrangler dev --port 8787",
    "deploy": "npx wrangler deploy"
  }
}
```

**Web package.json:**
```json
{
  "scripts": {
    "dev": "vite --port 3000",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview"
  }
}
```

## Request Flow

1. **User action in browser** - User clicks "Analyze" button in the web app
2. **Frontend makes request** - React app calls `fetch('/api/analyze', {...})`
3. **Vite proxy intercepts** - The `/api/analyze` request is intercepted by Vite's proxy
4. **Request forwarded to worker** - Proxy sends request to `http://localhost:8787/api/analyze`
5. **CORS check** - Worker validates origin is allowed (localhost:3000)
6. **Worker processes request** - Hono router handles the POST request
7. **Response sent back** - Worker streams NDJSON response back through proxy to browser

## Environment Variable Precedence

For the web app (`VITE_WORKER_URL`):
1. `packages/web/.env` (local, not committed)
2. `packages/web/.env.example` (template, committed)
3. Hardcoded default in `vite.config.ts`: `'http://localhost:8787'`

## Customizing Ports

To use different ports (e.g., 5000 for web, 9000 for worker):

1. **Update root `.env`:**
   ```bash
   WEB_PORT=5000
   WORKER_PORT=9000
   VITE_WORKER_URL=http://localhost:9000
   ```

2. **Update `packages/web/.env`:**
   ```bash
   VITE_WORKER_URL=http://localhost:9000
   ```

3. **Update `packages/worker/wrangler.jsonc`:**
   ```json
   "dev": {
     "port": 9000,
     "ip": "0.0.0.0"
   }
   ```

4. **Update `packages/worker/package.json`:**
   ```json
   "dev": "npx wrangler dev --port 9000"
   ```

5. **Update `packages/web/vite.config.ts`:**
   ```typescript
   server: {
     port: 5000,
     // proxy config stays the same (reads from .env)
   }
   ```

6. **Update worker CORS origins in `packages/worker/src/index.ts`:**
   ```typescript
   app.use('/*', cors({
     origin: ['http://localhost:5000', 'http://127.0.0.1:5000'],
     // ...
   }));
   ```

7. **Restart both services**

## Troubleshooting

### Issue: "CORS policy: No 'Access-Control-Allow-Origin' header"

**Cause:** CORS origins in the worker don't include the web app's origin.

**Solution:** Update `packages/worker/src/index.ts` to include your web app's URL:
```typescript
origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
```

### Issue: "Failed to fetch" or "Network Error"

**Cause:** Worker is not running or running on wrong port.

**Solution:**
1. Check that worker is running: `curl http://localhost:8787/api/analyze`
2. Verify worker port in `wrangler.jsonc` and `package.json`
3. Check web app's `.env` has correct `VITE_WORKER_URL`

### Issue: Proxy not working

**Cause:** Vite needs to be restarted after `.env` changes.

**Solution:**
1. Stop the web dev server (Ctrl+C)
2. Run `npm run dev` again
3. Check browser DevTools Network tab to see if requests go to `/api/*` or `http://localhost:8787/api/*`

### Issue: "Port already in use"

**Cause:** Another process is using port 3000 or 8787.

**Solution:**
```bash
# Find and kill the process
lsof -ti:3000 | xargs kill -9  # for web
lsof -ti:8787 | xargs kill -9  # for worker

# Or change to different ports (see "Customizing Ports" above)
```

## Production Configuration

For production deployment:

1. **Deploy worker** to Cloudflare Workers
2. **Get worker URL** (e.g., `https://your-worker.workers.dev`)
3. **Update web app** to use production worker URL:
   ```bash
   # In production environment
   VITE_WORKER_URL=https://your-worker.workers.dev
   ```
4. **Remove CORS restrictions** in worker or update to production domain:
   ```typescript
   origin: ['https://your-web-app.com'],
   ```
5. **Build and deploy web app**

## Additional Resources

- [Vite Server Options](https://vitejs.dev/config/server-options.html)
- [Vite Proxy Configuration](https://vitejs.dev/config/server-options.html#server-proxy)
- [Cloudflare Workers Configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [Hono CORS Middleware](https://hono.dev/middleware/builtin/cors)

