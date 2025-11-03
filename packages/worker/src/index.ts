import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getSandbox } from '@cloudflare/sandbox';

// // --- Minimal boilerplate agent (trimmed imports kept local) ---
import { SimpleAnalysisAgent } from './agent/core/simpleAnalysisAgent';

const app = new Hono();

app.get('/favicon.ico', () => new Response(null, { status: 204 }));

app.post('/api/analyze', async (c) => {
  const body = await c.req.json().catch(() => ({} as any));
  let rootPath: string = body.rootPath || '';
  const repo: string | undefined = body.repo;
  const task: string | undefined = body.task; // optional; not used by analyzer but accepted
  const envVars: Record<string, string> | undefined = body.envVars;

  const encoder = new TextEncoder();
  // Create sandbox session if binding exists; fall back to local stubs otherwise
  let sandbox: any | undefined;
  let sessionId: string | undefined = undefined;
  try {
    const binding = (c as any).env?.Sandbox;
    if (binding) {
      const id: string = typeof body.sessionId === 'string' && body.sessionId.length > 0
        ? body.sessionId
        : ('m2-' + Date.now());
      sandbox = getSandbox(binding, id);
      sessionId = id;
    }
  } catch {}
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
      (async () => {
        const sid = sessionId || body.sessionId;
        const onProgress = (message: string) => send({ type: 'progress', message, sessionId: sid });
        onProgress('Starting analysis...');
        if (!sandbox) {
          send({ type: 'error', message: 'Sandbox binding not available. Run "npx wrangler dev --remote" and ensure wrangler.jsonc has unsafe.bindings with { name: "Sandbox", type: "sandbox" }.' });
          controller.close();
          return;
        }
        try {
          // Optional: set environment variables into the sandbox session
          const cfAnthropicKey = (c as any).env?.ANTHROPIC_API_KEY as string | undefined;
          // Static defaults for Bedrock/Claude Code configuration (non-secret). Token is NOT hard-coded.
          const defaultBedrockEnv: Record<string, string> = {
            AWS_REGION: 'us-east-1',
            ANTHROPIC_SMALL_FAST_MODEL_AWS_REGION: 'us-east-1',
            ANTHROPIC_MODEL: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
            ANTHROPIC_SMALL_FAST_MODEL: 'us.anthropic.claude-3-5-haiku-20241022-v1:0',
            ANTHROPIC_BEDROCK_USE_CROSS_REGION_INFERENCE: 'true',
            CLAUDE_CODE_USE_BEDROCK: '1',
            CLAUDE_CODE_MAX_OUTPUT_TOKENS: '64000',
            CLAUDE_CODE_SUBAGENT_MODEL: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0'
          };
          const bedrockKeys = [
            'AWS_REGION',
            'ANTHROPIC_SMALL_FAST_MODEL_AWS_REGION',
            'ANTHROPIC_MODEL',
            'ANTHROPIC_SMALL_FAST_MODEL',
            'ANTHROPIC_BEDROCK_USE_CROSS_REGION_INFERENCE',
            'CLAUDE_CODE_USE_BEDROCK',
            'CLAUDE_CODE_MAX_OUTPUT_TOKENS',
            'CLAUDE_CODE_SUBAGENT_MODEL',
            'AWS_BEARER_TOKEN_BEDROCK'
          ] as const;
          // Start with defaults, then override with Worker env values if provided
          const bedrockEnv: Record<string, string> = { ...defaultBedrockEnv };
          for (const k of bedrockKeys) {
            const v = (c as any).env?.[k] as string | undefined;
            if (v && typeof v === 'string') bedrockEnv[k] = v;
          }
          // Never set a default for AWS_BEARER_TOKEN_BEDROCK; only forward if provided above
          if (!((c as any).env?.AWS_BEARER_TOKEN_BEDROCK)) {
            delete bedrockEnv.AWS_BEARER_TOKEN_BEDROCK;
          }
          console.log('[analyze] ANTHROPIC_API_KEY present in Worker env:', !!cfAnthropicKey);
          console.log('[analyze] Bedrock env (non-secret) to apply:', Object.keys({ ...bedrockEnv, AWS_BEARER_TOKEN_BEDROCK: undefined }).filter(k => k !== 'AWS_BEARER_TOKEN_BEDROCK'));
          if (cfAnthropicKey) {
            await sandbox.setEnvVars({ ANTHROPIC_API_KEY: cfAnthropicKey });
          }
          if (Object.keys(bedrockEnv).length > 0) {
            await sandbox.setEnvVars(bedrockEnv);
          }
          try {
            const check = await sandbox.exec(
              `bash -lc 'if env | grep -qE "^(ANTHROPIC_API_KEY|AWS_BEARER_TOKEN_BEDROCK|CLAUDE_CODE_USE_BEDROCK)="; then echo creds_ok; else echo creds_missing; fi'`
            );
            const status = (check?.stdout || check?.stderr || '').toString().trim();
            console.log('[analyze] Sandbox Claude creds status:', status);
          } catch (e) {
            console.log('[analyze] Sandbox env var check error:', (e as Error)?.message || String(e));
          }
          if (sandbox && envVars && typeof envVars === 'object') {
            await sandbox.setEnvVars(envVars);
          }

          // If a repo is provided and no explicit rootPath, ensure repo exists in session; clone only if missing
          if (sandbox && repo && !rootPath) {
            const name = (repo.split('/')?.pop() || 'repo').replace(/\.git$/,'');
            const baseDir = '/workspace';
            const fullPath = `${baseDir}/${name}`;
            // Ensure baseDir exists and check if target directory already exists
            await sandbox.exec(`bash -lc 'mkdir -p "${baseDir}"'`);
            const check = await sandbox.exec(`bash -lc 'if [ -d "${fullPath}" ]; then echo exists; else echo missing; fi'`);
            const exists = (check && check.stdout && check.stdout.includes('exists'));
            if (!exists) {
              onProgress('Fetching repository tarball: ' + repo);
              try {
                const u = new URL(repo);
                const parts = u.pathname.replace(/\.git$/,'').split('/').filter(Boolean);
                const owner = parts[0];
                const repoName = parts[1];
                const tarUrl = `https://api.github.com/repos/${owner}/${repoName}/tarball`;
                await sandbox.exec(`bash -lc 'set -e; mkdir -p "${fullPath}" && cd "${fullPath}" && curl -L "${tarUrl}" -o repo.tar.gz && tar -xzf repo.tar.gz --strip-components=1 && rm repo.tar.gz'`);
                onProgress('Fetch complete: ' + name);
              } catch (e) {
                onProgress('Fallback to git clone due to tarball fetch error.');
                await sandbox.exec(`bash -lc 'git clone --depth 1 --no-tags --filter=blob:none "${repo}" "${fullPath}"'`);
                onProgress('Clone complete: ' + name);
              }
            } else {
              onProgress('Repository already present. Skipping clone.');
            }
            rootPath = fullPath;
          }

          const agent = new SimpleAnalysisAgent();
          await agent.initialize({ rootPath, onProgress, sandbox, onEvent: (evt) => {
            if (evt && (evt as any).type === 'select-modules') {
              send({ type: 'select-modules', modules: (evt as any).modules || [], sessionId: sid, rootPath });
              controller.close();
            }
          }, selectedModules: Array.isArray(body.selectedModules) ? body.selectedModules : undefined });
          await agent.runEndToEnd();
          onProgress('Finished');
          send({ type: 'result', data: agent.state.results || {} });
        } catch (error) {
          send({ type: 'error', message: String(error) });
        } finally {
          controller.close();
        }
      })();
    }
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-cache'
    }
  });
});

export default app;

// Export the Sandbox Durable Object class required by the binding
export { Sandbox } from '@cloudflare/sandbox';

