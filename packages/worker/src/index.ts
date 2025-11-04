import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getSandbox } from '@cloudflare/sandbox';

// // --- Minimal boilerplate agent (trimmed imports kept local) ---
import { SimpleAnalysisAgent } from './agent/core/simpleAnalysisAgent';
import { startAnalysis } from './agent/services/implementations/AnalysisOrchestrator';
import { prepareUpload } from './agent/services/implementations/ArchiveManager';

const app = new Hono();

app.get('/favicon.ico', () => new Response(null, { status: 204 }));

app.post('/api/analyze', async (c) => {
  const contentType = c.req.header('content-type') || '';
  let body: any = {};
  let uploadFile: File | undefined = undefined;
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
          const { result, selectionRequested } = await startAnalysis({
            repo,
            rootPath,
            selectedModules: Array.isArray(body.selectedModules) ? body.selectedModules : undefined,
            envVars,
            uploadFile
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

