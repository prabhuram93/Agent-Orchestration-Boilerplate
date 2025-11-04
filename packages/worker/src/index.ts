import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getSandbox } from '@cloudflare/sandbox';

// // --- Minimal boilerplate agent (trimmed imports kept local) ---
import { SimpleAnalysisAgent } from './agent/core/simpleAnalysisAgent';
import { startAnalysis } from './agent/services/implementations/AnalysisOrchestrator';
import { prepareUpload } from './agent/services/implementations/ArchiveManager';

const app = new Hono();

app.get('/favicon.ico', () => new Response(null, { status: 204 }));

function b64urlDecode(s: string): string {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4;
  if (pad) s += '='.repeat(4 - pad);
  // @ts-ignore
  return atob(s);
}

app.get('/download/:id', async (c) => {
  const id = c.req.param('id');
  const key = b64urlDecode(id);
  const bucket = (c as any).env?.Uploads as R2Bucket | undefined;
  if (!bucket) return c.text('R2 not configured', 500);
  const obj = await bucket.get(key);
  if (!obj) return new Response('Not Found', { status: 404 });
  return new Response(obj.body, {
    status: 200,
    headers: {
      'content-type': obj.httpMetadata?.contentType || 'application/octet-stream',
      'cache-control': 'no-cache'
    }
  });
});

app.post('/api/analyze', async (c) => {
  const contentType = c.req.header('content-type') || '';
  let body: any = {};
  let uploadFile: File | undefined = undefined;
  let downloadUrl: string | undefined = undefined;
  if (contentType.includes('multipart/form-data')) {
    const fd = await c.req.formData();
    const f = fd.get('zip');
    if (f && typeof (f as any).arrayBuffer === 'function') uploadFile = f as unknown as File;
    body.repo = String(fd.get('repo') || '') || undefined;
    body.sessionId = String(fd.get('sessionId') || '') || undefined;
    body.rootPath = String(fd.get('rootPath') || '') || undefined;
    const selectedModulesStr = fd.get('selectedModules');
    if (selectedModulesStr) {
      try {
        body.selectedModules = JSON.parse(String(selectedModulesStr));
      } catch {
        body.selectedModules = undefined;
      }
    }
    body.task = undefined;
    body.envVars = undefined;
  } else {
    body = await c.req.json().catch(() => ({} as any));
  }
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
          const bucket = (c as any).env?.Uploads as R2Bucket | undefined;
          const publicBase = (c as any).env?.PUBLIC_R2_BASE as string | undefined;
          const cur = new URL(c.req.url);
          const isLocalHost = cur.hostname === 'localhost' || cur.hostname === '127.0.0.1';
          if (bucket && uploadFile && !isLocalHost) {
            const key = `uploads/${Date.now()}-${(uploadFile as any).name || 'repo.zip'}`;
            const ct = (uploadFile as any).type || 'application/zip';
            await bucket.put(key, (uploadFile as any).stream(), { httpMetadata: { contentType: ct } });
            const u = new URL(c.req.url);
            const internalBase = `${u.protocol}//${u.host}`;
            // @ts-ignore
            const b64 = btoa(key).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
            const internalUrl = `${internalBase}/download/${b64}`;
            let chosenUrl: string | undefined = undefined;
            if (publicBase && typeof publicBase === 'string') {
              const base = publicBase.replace(/\/$/, '');
              const segments = key.split('/').map((s) => encodeURIComponent(s)).join('/');
              const candidate = `${base}/${segments}`;
              try {
                const head = await fetch(candidate, { method: 'HEAD' });
                if (head.ok) {
                  chosenUrl = candidate;
                } else {
                  onProgress(`Public R2 URL not accessible (status ${head.status}); falling back to internal route.`);
                }
              } catch (e) {
                onProgress('Public R2 URL check failed; falling back to internal route.');
              }
            }
            downloadUrl = chosenUrl || internalUrl;
            onProgress('Uploaded archive to R2; fetching from sandbox.');
            uploadFile = undefined;
          } else if (bucket && uploadFile && isLocalHost) {
            onProgress('Local dev detected; using direct upload instead of R2.');
          }

          const { result, selectionRequested } = await startAnalysis({
            repo,
            rootPath,
            selectedModules: Array.isArray(body.selectedModules) ? body.selectedModules : undefined,
            envVars,
            uploadFile,
            downloadUrl,
          }, {
            sandbox,
            workerEnv: (c as any).env as any,
            onProgress,
            onEvent: (evt) => {
              if (evt && (evt as any).type === 'select-modules') {
                send({ type: 'select-modules', modules: (evt as any).modules || [], sessionId: sid, rootPath });
                controller.close();
              }
            }
          });
          if (!selectionRequested) {
            onProgress('Finished');
            send({ type: 'result', data: result || {} });
          }
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

