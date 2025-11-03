import { AgentOperation, OperationOptions } from './common';

export interface ExtractionInputs {
  modulePath: string;
}

export interface ExtractedBusinessLogic {
  module: string;
  entities: string[];
  services: string[];
  controllers: string[];
  workflows: string[];
  summary?: string;
}

export class BusinessLogicExtractionOperation extends AgentOperation<ExtractionInputs, ExtractedBusinessLogic> {
  async execute(inputs: ExtractionInputs, options: OperationOptions): Promise<ExtractedBusinessLogic> {
    const sandbox = options.sandbox as any | undefined;
    const rootPath = String(options.context?.rootPath || '');
    const progress = typeof options.progress === 'function' ? options.progress : undefined;

    if (!sandbox) {
      return { module: inputs.modulePath, entities: [], services: [], controllers: [], workflows: [] };
    }

    // Health checks (same approach as complexity)
    try {
      progress?.(`Claude: health check for logic extraction in ${inputs.modulePath}...`);
      const cliCheck = await sandbox.exec(`bash -lc 'command -v claude >/dev/null 2>&1 && echo ok || echo missing'`);
      const keyCheck = await sandbox.exec(
        `bash -lc 'cd "${rootPath}" 2>/dev/null || true; if env | grep -q "^ANTHROPIC_API_KEY="; then echo key_ok; else echo key_missing; fi'`
      );
      const cliOk = !!(cliCheck?.stdout || '').includes('ok');
      const keyOk = !!(keyCheck?.stdout || '').includes('key_ok');
      if (!cliOk || !keyOk) {
        progress?.(`Claude: unhealthy for extraction (cli: ${cliOk ? 'ok' : 'missing'}, key: ${keyOk ? 'ok' : 'missing'})`);
        return { module: inputs.modulePath, entities: [], services: [], controllers: [], workflows: [] };
      }
    } catch {
      progress?.('Claude: healthcheck error (extraction)');
      return { module: inputs.modulePath, entities: [], services: [], controllers: [], workflows: [] };
    }

    // Prompt for structured business logic
    const task = [
      `Analyze PHP code under: ${inputs.modulePath}.`,
      'Return ONLY compact JSON with exact keys: ',
      '{ "module", "entities", "services", "controllers", "workflows", "summary" }.',
      'Each of entities/services/controllers/workflows must be an array of strings.',
      'The "summary" must be a single plain-English sentence describing what the module does for the business/user.',
      'No prose outside JSON, no backticks.'
    ].join(' ');
    const safeTask = task.replace(/"/g, '\\"');
    const cd = rootPath ? `cd "${rootPath}" && ` : '';
    const cmd = `${cd}claude -p "${safeTask}"`;

    try {
      progress?.('Claude: extracting business logic...');
      const res = await sandbox.exec(cmd);
      const out = res?.success ? res.stdout : res?.stderr;
      const preview = (out || '').slice(0, 200).replace(/\s+/g, ' ').trim();
      if (preview) progress?.(`Claude: extraction output preview: ${preview}`);
      try {
        const parsed = JSON.parse(out);
        const toArray = (v: any) => Array.isArray(v) ? v.map(String) : [];
        return {
          module: String(parsed.module || inputs.modulePath),
          entities: toArray(parsed.entities),
          services: toArray(parsed.services),
          controllers: toArray(parsed.controllers),
          workflows: toArray(parsed.workflows),
          summary: typeof parsed.summary === 'string' ? parsed.summary : undefined
        };
      } catch {
        progress?.('Claude: non-JSON extraction output; falling back to empty lists');
        return { module: inputs.modulePath, entities: [], services: [], controllers: [], workflows: [], summary: undefined };
      }
    } catch {
      progress?.('Claude: extraction command error');
      return { module: inputs.modulePath, entities: [], services: [], controllers: [], workflows: [], summary: undefined };
    }
  }
}

