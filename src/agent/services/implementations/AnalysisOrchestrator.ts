import { prepareUpload } from './ArchiveManager';
import { SimpleAnalysisAgent } from '../../core/simpleAnalysisAgent';

type Sandbox = any;

export interface AnalysisRequest {
  repo?: string;
  rootPath?: string;
  selectedModules?: string[];
  envVars?: Record<string, string>;
  uploadFile?: File | undefined;
}

export interface AnalysisContext {
  sandbox: Sandbox;
  workerEnv?: Record<string, any>;
  onProgress?: (msg: string) => void;
  onEvent?: (evt: { type: string; [key: string]: unknown }) => void;
}

function buildBedrockEnv(workerEnv?: Record<string, any>): Record<string, string> {
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
  const keys = [
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
  const env: Record<string, string> = { ...defaultBedrockEnv };
  for (const k of keys) {
    const v = workerEnv && typeof workerEnv[k] === 'string' ? String(workerEnv[k]) : undefined;
    if (v) env[k] = v;
  }
  if (!workerEnv || !workerEnv['AWS_BEARER_TOKEN_BEDROCK']) delete env['AWS_BEARER_TOKEN_BEDROCK'];
  return env;
}

async function applyClaudeEnv(sandbox: Sandbox, workerEnv?: Record<string, any>, onProgress?: (msg: string) => void): Promise<void> {
  const anthropicKey = workerEnv && typeof workerEnv['ANTHROPIC_API_KEY'] === 'string' ? String(workerEnv['ANTHROPIC_API_KEY']) : undefined;
  const bedrockEnv = buildBedrockEnv(workerEnv);
  if (anthropicKey) {
    await sandbox.setEnvVars({ ANTHROPIC_API_KEY: anthropicKey });
  }
  if (Object.keys(bedrockEnv).length > 0) {
    await sandbox.setEnvVars(bedrockEnv);
  }
  try {
    const check = await sandbox.exec(`bash -lc 'if env | grep -qE "^(ANTHROPIC_API_KEY|AWS_BEARER_TOKEN_BEDROCK|CLAUDE_CODE_USE_BEDROCK)="; then echo creds_ok; else echo creds_missing; fi'`);
    const status = (check?.stdout || check?.stderr || '').toString().trim();
    onProgress?.('[analyze] Sandbox Claude creds status: ' + status);
  } catch {}
}

async function ensureRepository(sandbox: Sandbox, repoUrl: string, onProgress?: (msg: string) => void): Promise<string> {
  const name = (repoUrl.split('/')?.pop() || 'repo').replace(/\.git$/,'');
  const baseDir = '/workspace';
  const fullPath = `${baseDir}/${name}`;
  if (typeof sandbox.mkdir === 'function') {
    await sandbox.mkdir(baseDir, { recursive: true });
  } else {
    await sandbox.exec(`bash -lc 'mkdir -p "${baseDir}"'`);
  }
  const check = await sandbox.exec(`bash -lc 'if [ -d "${fullPath}" ]; then echo exists; else echo missing; fi'`);
  const exists = (check && check.stdout && check.stdout.includes('exists'));
  if (!exists) {
    onProgress?.('Fetching repository tarball: ' + repoUrl);
    try {
      const u = new URL(repoUrl);
      const parts = u.pathname.replace(/\.git$/,'').split('/').filter(Boolean);
      const owner = parts[0];
      const repoName = parts[1];
      const tarUrl = `https://api.github.com/repos/${owner}/${repoName}/tarball`;
      await sandbox.exec(`bash -lc 'set -e; mkdir -p "${fullPath}" && cd "${fullPath}" && curl -L "${tarUrl}" -o repo.tar.gz && tar -xzf repo.tar.gz --strip-components=1 && rm repo.tar.gz'`);
      onProgress?.('Fetch complete: ' + name);
    } catch (e) {
      onProgress?.('Fallback to git clone due to tarball fetch error.');
      await sandbox.exec(`bash -lc 'git clone --depth 1 --no-tags --filter=blob:none "${repoUrl}" "${fullPath}"'`);
      onProgress?.('Clone complete: ' + name);
    }
  } else {
    onProgress?.('Repository already present. Skipping clone.');
  }
  return fullPath;
}

export async function startAnalysis(
  req: AnalysisRequest,
  ctx: AnalysisContext
): Promise<{ result?: unknown; rootPath: string; selectionRequested: boolean }>{
  const { sandbox, workerEnv, onProgress, onEvent } = ctx;
  let rootPath = req.rootPath || '';

  await applyClaudeEnv(sandbox, workerEnv, onProgress);
  if (sandbox && req.envVars && typeof req.envVars === 'object') {
    await sandbox.setEnvVars(req.envVars);
  }

  if (sandbox && req.uploadFile && !rootPath) {
    const prep = await prepareUpload(sandbox, req.uploadFile, onProgress);
    rootPath = prep.rootPath || prep.baseDir;
  }
  if (sandbox && req.repo && !rootPath) {
    rootPath = await ensureRepository(sandbox, req.repo, onProgress);
  }

  let selectionRequested = false;
  const agent = new SimpleAnalysisAgent();
  await agent.initialize({ rootPath, onProgress, sandbox, onEvent: (evt) => {
    selectionRequested = true;
    onEvent?.(evt);
  }, selectedModules: Array.isArray(req.selectedModules) ? req.selectedModules : undefined });
  if (!selectionRequested) {
    await agent.runEndToEnd();
  }
  return { result: agent.state.results || {}, rootPath, selectionRequested };
}


