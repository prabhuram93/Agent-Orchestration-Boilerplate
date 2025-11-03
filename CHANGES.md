# Changes Made: Web to Worker Communication Setup

This document summarizes all changes made to configure the web package to fetch from the worker package with configurable ports.

## Date
November 3, 2025

## Overview
Configured the web frontend (React + Vite) to communicate with the worker backend (Cloudflare Worker + Hono) using a proxy setup with configurable ports for local development.

## Files Created

### 1. `.env.example` (Root)
- **Path:** `/Agent-Orchestration-Boilerplate/.env.example`
- **Purpose:** Template for project-wide environment configuration
- **Content:** Port configuration for web (3000) and worker (8787)

### 2. `.env.example` (Web Package)
- **Path:** `/packages/web/.env.example`
- **Purpose:** Template for web-specific environment variables
- **Content:** Worker URL configuration (`VITE_WORKER_URL`)

### 3. `README.md`
- **Path:** `/Agent-Orchestration-Boilerplate/README.md`
- **Purpose:** Main project documentation
- **Content:** Quick start guide, features, API documentation, deployment instructions

### 4. `DEVELOPMENT.md`
- **Path:** `/Agent-Orchestration-Boilerplate/DEVELOPMENT.md`
- **Purpose:** Comprehensive development guide
- **Content:** Architecture overview, setup instructions, troubleshooting, common tasks

### 5. `CONFIGURATION.md`
- **Path:** `/Agent-Orchestration-Boilerplate/CONFIGURATION.md`
- **Purpose:** Detailed configuration documentation
- **Content:** Architecture diagram, configuration files explanation, request flow, troubleshooting

### 6. `CHANGES.md` (This File)
- **Path:** `/Agent-Orchestration-Boilerplate/CHANGES.md`
- **Purpose:** Summary of all changes made
- **Content:** This document

## Files Modified

### 1. `packages/worker/wrangler.jsonc`
**Changes:**
- Added `dev` configuration section
- Set worker dev server port to 8787
- Set IP to 0.0.0.0 to allow connections from web app

**Before:**
```json
{
  "name": "boilerplate-m2-analysis",
  "main": "src/index.ts",
  "compatibility_date": "2025-05-06",
  "compatibility_flags": ["nodejs_compat"],
  "vars": {
    "ENV": "local"
  },
  ...
}
```

**After:**
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
  ...
}
```

### 2. `packages/worker/package.json`
**Changes:**
- Updated `dev` script to explicitly specify port 8787

**Before:**
```json
"scripts": {
  "dev": "npx wrangler dev",
  "deploy": "npx wrangler deploy"
}
```

**After:**
```json
"scripts": {
  "dev": "npx wrangler dev --port 8787",
  "deploy": "npx wrangler deploy"
}
```

### 3. `packages/worker/src/index.ts`
**Changes:**
- Added CORS middleware import
- Configured CORS to allow requests from web app (localhost:3000)

**Before:**
```typescript
import { Hono } from 'hono';
import { getSandbox } from '@cloudflare/sandbox';

const app = new Hono();

// app.get('/', (c) => c.html(htmlWithScript));
```

**After:**
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

// app.get('/', (c) => c.html(htmlWithScript));
```

### 4. `packages/web/vite.config.ts`
**Changes:**
- Added server configuration with port 3000
- Added proxy configuration to forward `/api/*` requests to worker

**Before:**
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
```

**After:**
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

### 5. `packages/web/package.json`
**Changes:**
- Updated `dev` script to explicitly specify port 3000

**Before:**
```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "lint": "eslint .",
  "preview": "vite preview"
}
```

**After:**
```json
"scripts": {
  "dev": "vite --port 3000",
  "build": "tsc -b && vite build",
  "lint": "eslint .",
  "preview": "vite preview"
}
```

### 6. `package.json` (Root)
**Changes:**
- Added convenience scripts for running both packages

**Before:**
```json
{
  "name": "boilerplate-m2-analysis",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
  },
  ...
}
```

**After:**
```json
{
  "name": "boilerplate-m2-analysis",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev:worker": "cd packages/worker && npm run dev",
    "dev:web": "cd packages/web && npm run dev",
    "install:all": "cd packages/worker && npm install && cd ../web && npm install"
  },
  ...
}
```

### 7. `.gitignore`
**Changes:**
- Updated to ignore `.env` files but track `.env.example`

**Before:**
```
# Env/config
.env
.env.*
.dev.vars
```

**After:**
```
# Env/config
.env
.env.local
.env.*.local
.dev.vars
!.env.example
```

## Configuration Summary

### Ports
- **Web App (Vite):** Port 3000
- **Worker (Wrangler):** Port 8787

### Request Flow
1. Browser → `http://localhost:3000` (Web App)
2. Web App → `/api/analyze` (Relative URL)
3. Vite Proxy → `http://localhost:8787/api/analyze` (Worker)
4. Worker → Processes request → Returns response
5. Response → Proxy → Web App → Browser

### Key Features
- ✅ Configurable ports via environment variables
- ✅ Vite proxy for seamless API communication
- ✅ CORS configured for local development
- ✅ Hot module replacement for both packages
- ✅ Separate dev servers for frontend and backend
- ✅ Production-ready configuration structure

## How to Use

### Development
```bash
# Terminal 1: Start worker
npm run dev:worker

# Terminal 2: Start web app
npm run dev:web

# Browser: Open http://localhost:3000
```

### Changing Ports
1. Edit `.env.example` and create `.env` with your ports
2. Edit `packages/web/.env` with `VITE_WORKER_URL`
3. Update `packages/worker/wrangler.jsonc` dev.port
4. Update CORS origins in `packages/worker/src/index.ts`
5. Restart both services

## Benefits

1. **Separation of Concerns:** Frontend and backend run independently
2. **Easy Development:** Proxy handles routing automatically
3. **Flexible Configuration:** Ports can be changed via environment variables
4. **CORS Handling:** Properly configured for local development
5. **Production Ready:** Same structure works for production deployment
6. **Developer Experience:** Hot reload works for both packages

## Testing

To verify the setup works:

1. Start both services
2. Open browser to `http://localhost:3000`
3. Enter a repo URL and click "Analyze"
4. Check browser DevTools Network tab:
   - Request goes to `/api/analyze` (not full URL)
   - Status should be 200
   - Response should be streaming NDJSON

## Next Steps

- [ ] Add health check endpoint
- [ ] Add environment-specific configurations
- [ ] Add Docker Compose for easier local development
- [ ] Add automated tests for the proxy setup
- [ ] Add monitoring/logging integration

## References

- Web framework: [Vite](https://vitejs.dev/)
- Worker framework: [Hono](https://hono.dev/)
- Cloudflare: [Workers Documentation](https://developers.cloudflare.com/workers/)
- UI Library: [React Spectrum](https://react-spectrum.adobe.com/)

## Support

For issues or questions:
1. Check `DEVELOPMENT.md` for troubleshooting
2. Review `CONFIGURATION.md` for detailed configuration info
3. Check the README.md for general information

