# Agent Orchestration Boilerplate

A monorepo boilerplate for building agent-powered applications with a React web frontend and Cloudflare Worker backend.

## Project Structure

```
├── packages/
│   ├── web/          # React frontend (Vite + React Spectrum)
│   └── worker/       # Cloudflare Worker backend (Hono + Sandbox)
```

## Prerequisites

- Node.js 18+ and npm/yarn
- Cloudflare account (for deployment)

## Quick Start

```bash
# 1. Clone the repository
git clone <repo-url>
cd Agent-Orchestration-Boilerplate

# 2. Setup environment (optional - defaults work out of the box)
cp .env.example .env
cd packages/web && cp .env.example .env && cd ../..

# 3. Install dependencies
cd packages/worker && npm install
cd ../web && npm install
cd ../..

# 4. Start the worker (Terminal 1)
npm run dev:worker

# 5. Start the web app (Terminal 2)
npm run dev:web

# 6. Open http://localhost:3000 in your browser
```

## Local Development

### Configuration

The project uses configurable ports for local development:

Default ports:
- **Web app**: `3000` (Vite dev server)
- **Worker API**: `8787` (Wrangler dev server)

You can customize these ports:
1. Copy `.env.example` to `.env` in the root directory
2. Copy `packages/web/.env.example` to `packages/web/.env`
3. Edit the port values as needed

### Running the Applications

**Option 1: Using root package scripts (recommended)**
```bash
# Terminal 1: Start the Worker
npm run dev:worker

# Terminal 2: Start the Web App
npm run dev:web
```

**Option 2: Running from package directories**
```bash
# Terminal 1: Start the Worker
cd packages/worker
npm run dev

# Terminal 2: Start the Web App
cd packages/web
npm run dev
```

Once both are running, open `http://localhost:3000` in your browser.

### How It Works

The web application proxies API requests (e.g., `/api/analyze`) to the worker backend. This is configured in:
- `packages/web/vite.config.ts` - Vite proxy configuration
- `packages/web/.env` - Worker URL configuration
- `packages/worker/wrangler.jsonc` - Worker dev server port

## Features

- **Web Frontend**: React with Adobe React Spectrum UI components
- **Worker Backend**: Cloudflare Worker with Hono framework
- **Sandbox Execution**: Cloudflare Sandbox for isolated code execution
- **Streaming API**: Real-time progress updates via NDJSON streaming
- **Theme Support**: Light/Dark/System theme modes

## API Endpoints

### `POST /api/analyze`

Analyzes a repository and returns structured results.

**Request Body:**
```json
{
  "repo": "https://github.com/owner/repo",
  "sessionId": "optional-session-id",
  "selectedModules": ["Module1", "Module2"],
  "rootPath": "/workspace/repo",
  "envVars": {
    "KEY": "value"
  }
}
```

**Response:** NDJSON stream with progress updates and final results.

## Deployment

### Worker Deployment

```bash
cd packages/worker
npm run deploy
```

### Web Deployment

Build the web app and deploy to your preferred hosting service:

```bash
cd packages/web
npm run build
# Deploy the dist/ folder
```

## Development Tips

- **Proxy Configuration**: The web app automatically proxies `/api/*` requests to the worker
- **Environment Variables**: Use `.env` files for local configuration, never commit sensitive values
- **Hot Reload**: Both packages support hot module replacement during development
- **CORS**: The proxy handles CORS issues during local development

## License

MIT

