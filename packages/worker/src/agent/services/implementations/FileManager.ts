import { IFileManager } from '../interfaces/IFileManager';

type Sandbox = any; // from '@cloudflare/sandbox', typed as any here to avoid SDK type dependency

export class FileManager implements IFileManager {
  constructor(private readonly sandbox?: Sandbox) {}

  async listPhpModules(rootPath: string): Promise<string[]> {
    if (!this.sandbox) {
      return ['app/code/Vendor/ModuleA', 'app/code/Vendor/ModuleB'];
    }
    const cmd = `bash -lc "set -e; if [ -d '${rootPath}/app/code' ]; then ls -d ${rootPath}/app/code/*/* 2>/dev/null || true; fi"`;
    const res = await this.sandbox.exec(cmd);
    if (res.success !== false && res.stdout) {
      return res.stdout.split('\n').map((s: string) => s.trim()).filter(Boolean);
    }
    return [];
  }

  async readModuleFiles(modulePath: string): Promise<{ path: string; content: string }[]> {
    if (!this.sandbox) return [];
    const findCmd = `bash -lc "set -e; if [ -d '${modulePath}' ]; then find '${modulePath}' -type f -name '*.php' -maxdepth 6; fi"`;
    const res = await this.sandbox.exec(findCmd);
    const files = res.stdout ? res.stdout.split('\n').map((s: string) => s.trim()).filter(Boolean) : [];
    const out: { path: string; content: string }[] = [];
    for (const p of files) {
      try {
        const buf = await this.sandbox.readFile(p);
        const content = typeof buf === 'string' ? buf : new TextDecoder().decode(buf);
        out.push({ path: p, content });
      } catch {}
    }
    return out;
  }
}

