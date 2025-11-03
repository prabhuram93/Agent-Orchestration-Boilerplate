import { AgentOperation, OperationOptions } from './common';

export interface ComplexityInputs {
  modulePath: string;
}

export interface ModuleComplexity {
  moduleName: string;
  cyclomaticComplexity?: number;
  linesOfCode?: number;
  classes?: number;
  functions?: number;
  raw?: unknown;
}

export class ComplexityAnalysisOperation extends AgentOperation<ComplexityInputs, ModuleComplexity> {
  async execute(inputs: ComplexityInputs, options: OperationOptions): Promise<ModuleComplexity> {
    const sandbox = options.sandbox as any | undefined;
    const rootPath = String(options.context?.rootPath || '');
    const progress = typeof options.progress === 'function' ? options.progress : undefined;
    if (!sandbox) {
      // Fallback (no sandbox/Claude available)
      return { moduleName: inputs.modulePath };
    }

    // Health checks: CLI availability and presence of either Anthropic API key or Bedrock config
    try {
      progress?.(`Claude: health check for ${inputs.modulePath}...`);
      const cliCheck = await sandbox.exec(`bash -lc 'command -v claude >/dev/null 2>&1 && echo ok || echo missing'`);
      const credCheck = await sandbox.exec(
        `bash -lc 'cd "${rootPath}" 2>/dev/null || true; if env | grep -qE "^(ANTHROPIC_API_KEY|AWS_BEARER_TOKEN_BEDROCK|CLAUDE_CODE_USE_BEDROCK)="; then echo creds_ok; else echo creds_missing; fi'`
      );
      const cliOk = !!(cliCheck?.stdout || '').includes('ok');
      const credsOk = !!(credCheck?.stdout || '').includes('creds_ok');
      if (!cliOk || !credsOk) {
        progress?.(`Claude: unhealthy (cli: ${cliOk ? 'ok' : 'missing'}, creds: ${credsOk ? 'ok' : 'missing'})`);
        return {
          moduleName: inputs.modulePath,
          raw: `claude_unhealthy: { cli: ${cliOk ? 'ok' : 'missing'}, creds: ${credsOk ? 'ok' : 'missing'} }`
        };
      }
      progress?.('Claude: healthy, starting complexity analysis...');
    } catch {
      progress?.('Claude: healthcheck error');
      return { moduleName: inputs.modulePath, raw: 'claude_healthcheck_error' };
    }

    // Ask Claude CLI to analyze complexity and return a small JSON
    const task = [
      `Analyze the PHP code under: ${inputs.modulePath}.`,
      'Respond ONLY with compact JSON using keys: ',
      '{ "moduleName", "classes", "functions", "linesOfCode", "cyclomaticComplexity" }.',
      'No prose, no backticks.'
    ].join(' ');

    // Escape quotes for shell-safe embedding
    const safeTask = task.replace(/"/g, '\\"');
    const cd = rootPath ? `cd "${rootPath}" && ` : '';
    const cmd = `${cd}claude -p "${safeTask}"`;

    try {
      const t0 = Date.now();
      const res = await sandbox.exec(cmd);
      const ms = Date.now() - t0;
      const out = res?.success ? res.stdout : res?.stderr;
      const preview = (out || '').slice(0, 200).replace(/\s+/g, ' ').trim();
      if (preview) progress?.(`Claude: done in ${ms}ms; preview: ${preview}`);
      try {
        const parsed = JSON.parse(out);
        progress?.(`Claude: parsed JSON (classes=${parsed.classes ?? '?'}, functions=${parsed.functions ?? '?'}, loc=${parsed.linesOfCode ?? '?'})`);
        return {
          moduleName: parsed.moduleName || inputs.modulePath,
          classes: Number(parsed.classes) || undefined,
          functions: Number(parsed.functions) || undefined,
          linesOfCode: Number(parsed.linesOfCode) || undefined,
          cyclomaticComplexity: Number(parsed.cyclomaticComplexity) || undefined,
          raw: parsed
        };
      } catch {
        progress?.('Claude: non-JSON output returned');
        return { moduleName: inputs.modulePath, raw: out };
      }
    } catch (e) {
      progress?.('Claude: execution error');
      return { moduleName: inputs.modulePath };
    }
  }
}

