import { Hono } from 'hono';
import { getSandbox } from '@cloudflare/sandbox';

// Minimal inlined HTML page for local testing
const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Magento Analysis Boilerplate</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 2rem; }
    textarea { width: 100%; height: 200px; }
    pre { background: #111; color: #0f0; padding: 1rem; white-space: pre-wrap; }
    .row { display: flex; gap: 1rem; align-items: center; }
    input[type=text] { width: 360px; }
    .spinner { display: none; width: 14px; height: 14px; border: 2px solid #888; border-top-color: transparent; border-radius: 50%; animation: spin 0.9s linear infinite; vertical-align: middle; margin-left: 8px; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  </style>
  </head>
<body>
  <h1>Magento Analysis Boilerplate</h1>
  <div class="row">
    <label>Repo URL: <input id="repoUrl" type="text" placeholder="https://github.com/owner/repo.git" /></label>
    <button id="run" type="button">Analyze</button>
  </div>
  <h3>Progress <span id="spinner" class="spinner" aria-live="polite" aria-busy="false"></span></h3>
  <pre id="log"></pre>
  <h3>Final Result</h3>
  <textarea id="result" readonly></textarea>
  <div id="modulePicker" style="display:none; margin-top: 12px;"></div>
  <script src="/app.js"></script>
</body>
</html>`;

// Serve client JS separately to avoid nested template literal issues
const clientJs = [
  "(function(){",
  "  console.log('app.js loaded');",
  "  var runBtn = document.getElementById('run');",
  "  var logEl = document.getElementById('log');",
  "  var resultEl = document.getElementById('result');",
  "  var spinner = document.getElementById('spinner');",
  "  var modulePicker = document.getElementById('modulePicker');",
  "  var currentSessionId = '';",
  "  var currentRepo = '';",
  "  var currentRootPath = '';",
  "  function log(msg){ logEl.textContent += msg + '\\n'; }",
  "  function showSpinner(show){ if (spinner) spinner.style.display = show ? 'inline-block' : 'none'; }",
  "  function renderModulePicker(modules, sessionId, rootPath){",
  "    if (!modulePicker) return;",
  "    currentSessionId = sessionId;",
  "    if (rootPath) currentRootPath = rootPath;",
  "    modulePicker.innerHTML = '';",
  "    var title = document.createElement('div');",
  "    title.innerHTML = 'Select modules to analyze:';",
  "    modulePicker.appendChild(title);",
  "    var box = document.createElement('div');",
  "    box.style.margin = '8px 0';",
  "    box.style.maxHeight = '200px';",
  "    box.style.overflow = 'auto';",
  "    box.style.border = '1px solid #333';",
  "    box.style.padding = '8px';",
  "    modulePicker.appendChild(box);",
  "    for (var i=0;i<modules.length;i++){",
  "      var m = modules[i];",
  "      var wrap = document.createElement('div');",
  "      var label = document.createElement('label');",
  "      var cb = document.createElement('input');",
  "      cb.type = 'checkbox';",
  "      cb.value = m;",
  "      cb.id = 'mod_'+i;",
  "      label.appendChild(cb);",
  "      label.appendChild(document.createTextNode(' ' + m));",
  "      wrap.appendChild(label);",
  "      box.appendChild(wrap);",
  "    }",
  "    var btn = document.createElement('button');",
  "    btn.id = 'submitModules';",
  "    btn.textContent = 'Analyze Selected';",
  "    modulePicker.appendChild(btn);",
  "    modulePicker.style.display = 'block';",
  "    var btn = document.getElementById('submitModules');",
  "    if (btn) btn.onclick = function(){",
  "      var inputs = modulePicker.querySelectorAll('input[type=checkbox]:checked');",
  "      var selected = [];",
  "      for (var j=0;j<inputs.length;j++){ selected.push(inputs[j].value); }",
  "      if (selected.length === 0){ log('No modules selected.'); return; }",
  "      modulePicker.style.display = 'none';",
  "      startStream({ repo: currentRepo, sessionId: currentSessionId, selectedModules: selected, rootPath: currentRootPath });",
  "    };",
  "  }",
  "  function startStream(body){",
  "    showSpinner(true);",
  "    fetch('/api/analyze', {",
  "      method: 'POST',",
  "      headers: { 'content-type': 'application/json' },",
  "      body: JSON.stringify(body)",
  "    }).then(function(res){",
  "      if (!res.ok) {",
  "        return res.text().then(function(text){",
  "          log('Request failed: ' + res.status + ' ' + res.statusText);",
  "          if (text) log(text);",
  "          throw new Error('HTTP ' + res.status);",
  "        });",
  "      }",
  "      if (!res.body) { log('No response body (stream not available).'); return; }",
  "      var reader = res.body.getReader();",
  "      var decoder = new TextDecoder();",
  "      var buffer = '';",
  "      function pump(){",
  "        return reader.read().then(function(chunk){",
  "          if (chunk.done) return;",
  "          buffer += decoder.decode(chunk.value, { stream: true });",
  "          var lines = buffer.split('\\n');",
  "          buffer = lines.pop() || '';",
  "          for (var i=0; i<lines.length; i++){",
  "            var line = lines[i];",
  "            if (!line.trim()) continue;",
  "            try {",
  "              var obj = JSON.parse(line);",
  "              if (obj.type === 'progress') log(obj.message);",
  "              else if (obj.type === 'result') resultEl.value = JSON.stringify(obj.data, null, 2);",
  "              else if (obj.type === 'error') log('Error: ' + obj.message);",
  "              else if (obj.type === 'select-modules'){",
  "                if (obj.sessionId) currentSessionId = obj.sessionId;",
  "                if (obj.rootPath) currentRootPath = obj.rootPath;",
  "                renderModulePicker(obj.modules || [], obj.sessionId || currentSessionId, obj.rootPath || currentRootPath);",
  "              }",
  "            } catch (e) { console.error('Failed to parse line', line, e); }",
  "          }",
  "          return pump();",
  "        });",
  "      }",
  "      return pump();",
  "    }).catch(function(e){",
  "      console.error(e);",
  "      log('Request error: ' + (e && e.message ? e.message : String(e)));",
  "    }).finally(function(){",
  "      showSpinner(false);",
  "    });",
  "  }",
  "  if (!runBtn) { console.error('Analyze button not found'); return; }",
  "  runBtn.addEventListener('click', function(e){",
  "    e.preventDefault();",
  "    logEl.textContent = '';",
  "    resultEl.value = '';",
  "    modulePicker.style.display = 'none';",
  "    currentRepo = (document.getElementById('repoUrl') && document.getElementById('repoUrl').value) || '';",
  "    startStream({ repo: currentRepo });",
  "  });",
  "})();"
].join('\n');

// --- Minimal boilerplate agent (trimmed imports kept local) ---
import { SimpleAnalysisAgent } from './agent/core/simpleAnalysisAgent';

const app = new Hono();

app.get('/', (c) => c.html(html));

app.get('/app.js', (c) => new Response(clientJs, {
  headers: { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'no-cache' }
}));

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
  try {
    const binding = (c as any).env?.Sandbox;
    if (binding) {
      const id = body.sessionId && typeof body.sessionId === 'string' ? body.sessionId : ('m2-' + Date.now());
      sandbox = getSandbox(binding, id);
    }
  } catch {}
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
      (async () => {
        const sessionId = (sandbox && (sandbox.id || body.sessionId)) || body.sessionId;
        const onProgress = (message: string) => send({ type: 'progress', message, sessionId });
        onProgress('Starting analysis...');
        if (!sandbox) {
          send({ type: 'error', message: 'Sandbox binding not available. Run "npx wrangler dev --remote" and ensure wrangler.jsonc has unsafe.bindings with { name: "Sandbox", type: "sandbox" }.' });
          controller.close();
          return;
        }
        try {
          // Optional: set environment variables into the sandbox session
          if (sandbox && envVars && typeof envVars === 'object') {
            await sandbox.setEnvVars(envVars);
          }

          // If a repo is provided and no explicit rootPath, ensure repo exists in session; clone only if missing
          if (sandbox && repo && !rootPath) {
            const name = (repo.split('/')?.pop() || 'repo').replace(/\.git$/,'');
            // Check if directory already exists
            const check = await sandbox.exec(`bash -lc 'if [ -d "${name}" ]; then echo exists; else echo missing; fi'`);
            const exists = (check && check.stdout && check.stdout.includes('exists'));
            if (!exists) {
              onProgress('Cloning repository: ' + repo);
              await sandbox.gitCheckout(repo, { targetDir: name });
              onProgress('Clone complete: ' + name);
            } else {
              onProgress('Repository already present. Skipping clone.');
            }
            rootPath = name;
          }

          const agent = new SimpleAnalysisAgent();
          await agent.initialize({ rootPath, onProgress, sandbox, onEvent: (evt) => {
            if (evt && (evt as any).type === 'select-modules') {
              send({ type: 'select-modules', modules: (evt as any).modules || [], sessionId, rootPath });
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

