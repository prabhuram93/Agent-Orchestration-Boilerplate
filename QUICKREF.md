# Quick Reference Card

## 🚀 Start Development

```bash
# Terminal 1
npm run dev:worker

# Terminal 2
npm run dev:web

# Browser
http://localhost:3000
```

## 🔌 Ports

| Service | Port | URL |
|---------|------|-----|
| Web App | 3000 | http://localhost:3000 |
| Worker API | 8787 | http://localhost:8787 |

## 📁 Key Files

| File | Purpose |
|------|---------|
| `packages/web/vite.config.ts` | Vite proxy config |
| `packages/worker/wrangler.jsonc` | Worker port config |
| `packages/worker/src/index.ts` | CORS + API routes |
| `packages/web/.env` | Worker URL config |

## 🔄 Request Flow

```
Browser → Vite (3000) → Proxy → Worker (8787) → Sandbox
```

## ⚙️ Configuration

### Web Proxy
```typescript
// packages/web/vite.config.ts
proxy: {
  '/api': {
    target: 'http://localhost:8787',
    changeOrigin: true,
    secure: false,
  },
}
```

### Worker Port
```json
// packages/worker/wrangler.jsonc
"dev": {
  "port": 8787,
  "ip": "0.0.0.0"
}
```

### Worker CORS
```typescript
// packages/worker/src/index.ts
app.use('/*', cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
  credentials: true,
}));
```

## 🐛 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| Port in use | `lsof -ti:3000 \| xargs kill -9` |
| Proxy not working | Restart Vite after `.env` changes |
| CORS error | Check worker CORS origins match web URL |
| Worker not responding | Verify worker is running on port 8787 |

## 📝 API Endpoints

### POST /api/analyze
```bash
curl -X POST http://localhost:8787/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"repo":"https://github.com/magento/magento2"}'
```

### Response Format
NDJSON stream:
```json
{"type":"progress","message":"Starting..."}
{"type":"result","data":{...}}
```

## 📚 Documentation

- `README.md` - Project overview and quick start
- `DEVELOPMENT.md` - Comprehensive dev guide
- `CONFIGURATION.md` - Detailed configuration
- `CHANGES.md` - Summary of changes made

## 🔧 Common Tasks

### Change Ports
1. Edit `packages/web/.env`: `VITE_WORKER_URL=http://localhost:NEW_PORT`
2. Edit `packages/worker/wrangler.jsonc`: `"port": NEW_PORT`
3. Update CORS origins in `packages/worker/src/index.ts`
4. Restart both services

### Add API Endpoint
1. Add route in `packages/worker/src/index.ts`
2. Call from web app: `fetch('/api/your-endpoint')`

### Deploy
```bash
# Worker
cd packages/worker && npm run deploy

# Web
cd packages/web && npm run build
# Deploy dist/ folder
```

## 🎯 How It Works

1. **Web app makes request:** `fetch('/api/analyze', ...)`
2. **Vite proxy intercepts:** Checks if request matches `/api/*`
3. **Proxy forwards:** Sends to `http://localhost:8787/api/analyze`
4. **Worker processes:** Hono router handles request
5. **CORS validates:** Checks origin is allowed
6. **Response streams back:** Through proxy to browser

## ✅ Verify Setup

```bash
# Check worker is running
curl http://localhost:8787/api/analyze

# Check web app proxy
# In browser DevTools Network tab:
# - Request URL should show /api/analyze (not full URL)
# - Should see response from worker
```

## 🔐 Environment Variables

### Web (.env)
```bash
VITE_WORKER_URL=http://localhost:8787
```

### Worker (wrangler.jsonc)
```json
"vars": {
  "ENV": "local"
}
```

## 📦 Package Scripts

### Root
- `npm run dev:worker` - Start worker
- `npm run dev:web` - Start web app
- `npm run install:all` - Install all dependencies

### Worker
- `npm run dev` - Start dev server on 8787
- `npm run deploy` - Deploy to Cloudflare

### Web
- `npm run dev` - Start dev server on 3000
- `npm run build` - Build for production
- `npm run lint` - Run linter

## 🌐 URLs

| Environment | Web | Worker |
|-------------|-----|--------|
| Local | http://localhost:3000 | http://localhost:8787 |
| Production | Your domain | https://your-worker.workers.dev |

