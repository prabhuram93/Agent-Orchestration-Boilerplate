# Magento 2 Analysis Boilerplate

A minimal Cloudflare Worker + Sandbox app that:
- Clones or accepts a Magento 2 codebase
- Extracts business-logic signals and basic complexity
- Streams progress to a simple UI with module selection and a printable report
- Supports ZIP uploads directly (local) or via Cloudflare R2 (remote)
- Works with Anthropic Claude via Bedrock (recommended) or Anthropic API key

## Prerequisites
- Node.js 18+
- Wrangler CLI (`npm i -g wrangler`)
- Cloudflare account
- (Recommended for cloud) Cloudflare R2 bucket

## Local Development
1) Install deps
```bash
npm install
```

2) Create `.dev.vars` with your secrets (see Environment below). Example (Bedrock):
```bash
AWS_BEARER_TOKEN_BEDROCK=YOUR_TOKEN
```

3) Run dev server
```bash
npm run dev
```

4) Open
```
http://localhost:8787
```

5) In the UI, either:
- Paste a repo URL (e.g., https://github.com/magento/magento2), or
- Choose a ZIP file (mutually exclusive)

Notes (local):
- Local dev uses direct ZIP upload to the sandbox (no R2 required).
- The UI disables the ZIP chooser when a repo URL is provided and vice‑versa.

## Remote Dev / Production (recommended with R2)
When running in Cloudflare (remote dev or deployed), the app can upload ZIPs to R2 and have the sandbox curl the file from a public URL.

### Wrangler config
Add these to `wrangler.jsonc` (or your env section):
```jsonc
{
  // ... your existing config ...
  "r2_buckets": [
    { "binding": "Uploads", "bucket_name": "your-r2-bucket-name" }
  ],
  "vars": {
    // Optional public base for your R2 static domain (preferred for sandbox downloads)
    "PUBLIC_R2_BASE": "https://your-r2-public-domain.r2.dev"
  },
  "unsafe": {
    "bindings": [
      { "name": "Sandbox", "type": "sandbox" }
    ]
  }
}
```

Run remote dev:
```bash
wrangler dev --remote
```

Or deploy:
```bash
npm run deploy
```

Behavior (cloud):
- If `Uploads` is configured and you upload a ZIP, the Worker stores it in R2.
- If `PUBLIC_R2_BASE` is set and reachable, the sandbox downloads from that public URL; otherwise it falls back to an internal `/download/:id` route.
- In local dev (localhost), the app intentionally uses direct upload (no R2) so the sandbox doesn’t curl a non‑routable localhost URL.

## Environment (Claude via Bedrock)
You can run with Bedrock credentials or an Anthropic API key. Put secrets in `.dev.vars` for local; set as Worker env vars for cloud.

Example `.dev.vars` (Bedrock):
```bash
AWS_REGION=us-east-1
ANTHROPIC_SMALL_FAST_MODEL_AWS_REGION=us-east-1
ANTHROPIC_MODEL=us.anthropic.claude-sonnet-4-5-20250929-v1:0
ANTHROPIC_SMALL_FAST_MODEL=us.anthropic.claude-3-5-haiku-20241022-v1:0
ANTHROPIC_BEDROCK_USE_CROSS_REGION_INFERENCE=true
CLAUDE_CODE_USE_BEDROCK=1
CLAUDE_CODE_MAX_OUTPUT_TOKENS=64000
CLAUDE_CODE_SUBAGENT_MODEL=us.anthropic.claude-sonnet-4-5-20250929-v1:0
AWS_BEARER_TOKEN_BEDROCK=YOUR_TOKEN
# Optional fallback
# ANTHROPIC_API_KEY=sk-ant-...
```

Either Bedrock or Anthropic API key will pass the sandbox health check.

## Using the UI
- Repo URL and ZIP upload are mutually exclusive; Analyze enables only when exactly one is provided.
- If the Worker prompts for module selection, choose modules found under `app/code/<Vendor>/<Module>`.
- The final report shows summary + basic metrics; use the Print button to save a PDF.

## Troubleshooting
- ZIP fails to download (404) in cloud
  - Ensure `PUBLIC_R2_BASE` points to your R2 public static domain and the object key path is correct (the Worker uses `uploads/<timestamp>-<filename>`).
  - The Worker HEAD‑checks the public URL and falls back to `/download/:id` if not reachable.
- Sandbox curl to localhost refused
  - Use `wrangler dev --remote` or set `PUBLIC_R2_BASE` so the sandbox fetches from a public URL.
- “Found 0 modules” after unzip
  - Ensure the archive contains a Magento root with `app/code/<Vendor>/<Module>` and `registration.php` or `etc/module.xml`.
  - If the ZIP wraps the project in an extra folder, the app attempts to detect nested roots automatically.

## Scripts
- `npm run dev`  — local dev (`wrangler dev`)
- `npm run deploy` — deploy to Cloudflare

## Security
- Never commit secrets. Keep `.dev.vars` local.
- Use Worker environment variables for deployed environments.

## License
This boilerplate is provided as‑is. Refer to Magento 2 licensing for the analyzed codebase: https://github.com/magento/magento2
