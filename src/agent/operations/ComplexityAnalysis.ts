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
    if (!sandbox) {
      // Fallback (no sandbox/Claude available)
      return { moduleName: inputs.modulePath };
    }

    // Health checks: CLI availability and API key presence
    try {
      const cliCheck = await sandbox.exec(`bash -lc 'command -v claude >/dev/null 2>&1 && echo ok || echo missing'`);
      const keyCheck = await sandbox.exec(
        `bash -lc 'cd "${rootPath}" 2>/dev/null || true; if env | grep -q "^ANTHROPIC_API_KEY="; then echo key_ok; else echo key_missing; fi'`
      );
      const cliOk = !!(cliCheck?.stdout || '').includes('ok');
      const keyOk = !!(keyCheck?.stdout || '').includes('key_ok');
      if (!cliOk || !keyOk) {
        return {
          moduleName: inputs.modulePath,
          raw: `claude_unhealthy: { cli: ${cliOk ? 'ok' : 'missing'}, key: ${keyOk ? 'ok' : 'missing'} }`
        };
      }
    } catch {
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
      const res = await sandbox.exec(cmd);
      const out = res?.success ? res.stdout : res?.stderr;
      try {
        const parsed = JSON.parse(out);
        return {
          moduleName: parsed.moduleName || inputs.modulePath,
          classes: Number(parsed.classes) || undefined,
          functions: Number(parsed.functions) || undefined,
          linesOfCode: Number(parsed.linesOfCode) || undefined,
          cyclomaticComplexity: Number(parsed.cyclomaticComplexity) || undefined,
          raw: parsed
        };
      } catch {
        return { moduleName: inputs.modulePath, raw: out };
      }
    } catch (e) {
      return { moduleName: inputs.modulePath };
    }
  }
}

