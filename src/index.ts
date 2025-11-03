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
    .actions { margin: 12px 0; display: flex; gap: 8px; align-items: center; }
    #report { margin-top: 16px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px; }
    .card { border: 1px solid #222; border-radius: 8px; padding: 12px; background: #0b0b0b; color: #eaeaea; }
    .card h4 { margin: 0 0 8px 0; font-size: 16px; }
    .muted { color: #aaa; font-size: 12px; }
    .badges { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0 0 0; }
    .badge { background: #1e1e1e; border: 1px solid #333; color: #cbd5e1; border-radius: 999px; padding: 2px 8px; font-size: 12px; }
    .kv { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 6px; }
    .kv div { background: #141414; padding: 6px 8px; border-radius: 6px; border: 1px solid #222; }
    @media print {
      body { margin: 0; }
      .row, h3, pre, textarea, .actions { display: none !important; }
      #report { margin: 0; }
      .card { break-inside: avoid; }
    }
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
  <div class="actions">
    <button id="downloadPdf" type="button">Download PDF</button>
  </div>
  <div id="report"></div>
  <script src="/app.js"></script>
</body>
</html>`;

// Serve client JS separately to avoid nested template literal issues
const clientJs = `
(function(){
  console.log('app.js loaded');
  var runBtn = document.getElementById('run');
  var logEl = document.getElementById('log');
  var resultEl = document.getElementById('result');
  var spinner = document.getElementById('spinner');
  var modulePicker = document.getElementById('modulePicker');
  var reportEl = document.getElementById('report');
  var downloadBtn = document.getElementById('downloadPdf');
  var currentSessionId = '';
  var currentRepo = '';
  var currentRootPath = '';

  function log(msg){ logEl.textContent += msg + '\\n'; }
  function showSpinner(show){ if (spinner) spinner.style.display = show ? 'inline-block' : 'none'; }

  function renderReport(data){
    if (!reportEl) return;
    try {
      // Clear report
      reportEl.innerHTML = '';
      var results = Array.isArray(data && data.results) ? data.results : [];

      // Grid container
      var grid = document.createElement('div');
      grid.className = 'grid';

      for (var i=0;i<results.length;i++){
        var r = results[i] || {};
        var mod = r.modulePath || (r.logic && r.logic.module) || 'Unknown';
        var logic = r.logic || {};
        var cx = r.complexity || {};

        var card = document.createElement('div');
        card.className = 'card';

        var h4 = document.createElement('h4');
        h4.textContent = String(mod);
        card.appendChild(h4);

        if (logic.summary){
          var summary = document.createElement('div');
          summary.className = 'muted';
          summary.textContent = String(logic.summary);
          card.appendChild(summary);
        }

        var kv = document.createElement('div');
        kv.className = 'kv';
        var addKv = function(label, value){
          if (value != null){
            var box = document.createElement('div');
            box.innerHTML = label + ': <strong>' + String(value) + '</strong>';
            kv.appendChild(box);
          }
        };
        addKv('LOC', cx.linesOfCode);
        addKv('Classes', cx.classes);
        addKv('Functions', cx.functions);
        addKv('CC', cx.cyclomaticComplexity);
        card.appendChild(kv);

        var sections = [
          ['Entities', logic.entities],
          ['Services', logic.services],
          ['Controllers', logic.controllers],
          ['Workflows', logic.workflows]
        ];
        for (var s=0; s<sections.length; s++){
          var label = sections[s][0]; var arr = sections[s][1];
          if (Array.isArray(arr) && arr.length){
            var muted = document.createElement('div');
            muted.className = 'muted';
            muted.style.marginTop = '6px';
            muted.textContent = String(label);
            card.appendChild(muted);

            var badges = document.createElement('div');
            badges.className = 'badges';
            for (var j=0; j<arr.length; j++){
              var badge = document.createElement('span');
              badge.className = 'badge';
              badge.textContent = String(arr[j]);
              badges.appendChild(badge);
            }
            card.appendChild(badges);
          }
        }

        grid.appendChild(card);
      }

      reportEl.appendChild(grid);
    } catch (e) {
      console.error('renderReport error', e);
    }
  }

  if (downloadBtn) downloadBtn.addEventListener('click', function(){ window.print(); });

  function renderModulePicker(modules, sessionId, rootPath){
    if (!modulePicker) return;
    currentSessionId = sessionId;
    if (rootPath) currentRootPath = rootPath;
    modulePicker.innerHTML = '';
    var title = document.createElement('div');
    title.innerHTML = 'Select modules to analyze:';
    modulePicker.appendChild(title);
    var box = document.createElement('div');
    box.style.margin = '8px 0';
    box.style.maxHeight = '200px';
    box.style.overflow = 'auto';
    box.style.border = '1px solid #333';
    box.style.padding = '8px';
    modulePicker.appendChild(box);
    for (var i=0;i<modules.length;i++){
      var m = modules[i];
      var wrap = document.createElement('div');
      var label = document.createElement('label');
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = m;
      cb.id = 'mod_'+i;
      label.appendChild(cb);
      label.appendChild(document.createTextNode(' ' + m));
      wrap.appendChild(label);
      box.appendChild(wrap);
    }
    var btn = document.createElement('button');
    btn.id = 'submitModules';
    btn.textContent = 'Analyze Selected';
    modulePicker.appendChild(btn);
    modulePicker.style.display = 'block';
    var submitBtn = document.getElementById('submitModules');
    if (submitBtn) submitBtn.onclick = function(){
      var inputs = modulePicker.querySelectorAll('input[type=checkbox]:checked');
      var selected = [];
      for (var j=0;j<inputs.length;j++){ selected.push(inputs[j].value); }
      if (selected.length === 0){ log('No modules selected.'); return; }
      modulePicker.style.display = 'none';
      startStream({ repo: currentRepo, sessionId: currentSessionId, selectedModules: selected, rootPath: currentRootPath });
    };
  }

  function startStream(body){
    showSpinner(true);
    fetch('/api/analyze', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function(res){
      if (!res.ok) {
        return res.text().then(function(text){
          log('Request failed: ' + res.status + ' ' + res.statusText);
          if (text) log(text);
          throw new Error('HTTP ' + res.status);
        });
      }
      if (!res.body) { log('No response body (stream not available).'); return; }
      var reader = res.body.getReader();
      var decoder = new TextDecoder();
      var buffer = '';
      function pump(){
        return reader.read().then(function(chunk){
          if (chunk.done) return;
          buffer += decoder.decode(chunk.value, { stream: true });
          var lines = buffer.split('\\n');
          buffer = lines.pop() || '';
          for (var i=0; i<lines.length; i++){
            var line = lines[i];
            if (!line.trim()) continue;
            try {
              var obj = JSON.parse(line);
              if (obj.type === 'progress') log(obj.message);
              else if (obj.type === 'result') {
                resultEl.value = JSON.stringify(obj.data, null, 2);
                renderReport(obj.data);
              } else if (obj.type === 'error') log('Error: ' + obj.message);
              else if (obj.type === 'select-modules'){
                if (obj.sessionId) currentSessionId = obj.sessionId;
                if (obj.rootPath) currentRootPath = obj.rootPath;
                renderModulePicker(obj.modules || [], obj.sessionId || currentSessionId, obj.rootPath || currentRootPath);
              }
            } catch (e) { console.error('Failed to parse line', line, e); }
          }
          return pump();
        });
      }
      return pump();
    }).catch(function(e){
      console.error(e);
      log('Request error: ' + (e && e.message ? e.message : String(e)));
    }).finally(function(){
      showSpinner(false);
    });
  }

  if (!runBtn) { console.error('Analyze button not found'); return; }
  runBtn.addEventListener('click', function(e){
    e.preventDefault();
    logEl.textContent = '';
    resultEl.value = '';
    if (reportEl) reportEl.innerHTML = '';
    modulePicker.style.display = 'none';
    currentRepo = (document.getElementById('repoUrl') && document.getElementById('repoUrl').value) || '';
    startStream({ repo: currentRepo });
  });
})();
`;
// Inject script inline to avoid routing/caching edge cases
const htmlWithScript = html.replace('<script src="/app.js"></script>', `<script>${clientJs}</script>`);

// --- Minimal boilerplate agent (trimmed imports kept local) ---
import { SimpleAnalysisAgent } from './agent/core/simpleAnalysisAgent';

const app = new Hono();

app.get('/', (c) => c.html(htmlWithScript));

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
          console.log('[analyze] ANTHROPIC_API_KEY present in Worker env:', !!cfAnthropicKey);
          if (cfAnthropicKey && typeof cfAnthropicKey === 'string') {
            await sandbox.setEnvVars({ ANTHROPIC_API_KEY: cfAnthropicKey });
            try {
              const check = await sandbox.exec(`bash -lc 'if [ -n "$ANTHROPIC_API_KEY" ]; then echo key_ok; else echo key_missing; fi'`);
              const status = (check?.stdout || check?.stderr || '').toString().trim();
              console.log('[analyze] Sandbox ANTHROPIC_API_KEY status:', status);
            } catch (e) {
              console.log('[analyze] Sandbox env var check error:', (e as Error)?.message || String(e));
            }
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

