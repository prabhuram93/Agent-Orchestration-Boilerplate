import { IFileManager } from '../interfaces/IFileManager';

type Sandbox = any; // from '@cloudflare/sandbox', typed as any here to avoid SDK type dependency

export class FileManager implements IFileManager {
  constructor(private readonly sandbox?: Sandbox) {}

  async listPhpModules(rootPath: string): Promise<string[]> {
    if (!this.sandbox) {
      return ['app/code/Vendor/ModuleA', 'app/code/Vendor/ModuleB'];
    }
    // Discover Magento modules under app/code by looking for registration.php or etc/module.xml
    // Covers vendors like Aheadworks, AppStore, Magento, etc. and preserves quoting.
    const cmd = `bash -lc '\nROOT=${JSON.stringify(rootPath).slice(1,-1)}; \
OUT=""; \
if [ -d "$ROOT/app/code" ]; then \
  OUT=$( { \
      find "$ROOT/app/code" -maxdepth 6 -type f -name registration.php 2>/dev/null; \
      find "$ROOT/app/code" -maxdepth 6 -type f -path "*/etc/module.xml" 2>/dev/null; \
    } | while IFS= read -r f; do \
        d=$(dirname "$f"); \
        if echo "$f" | grep -q "/etc/module.xml$"; then \
          moddir=$(dirname "$d"); \
        else \
          moddir="$d"; \
        fi; \
        echo "$moddir"; \
      done | sort -u ); \
fi; \
if [ -z "$OUT" ]; then \
  OUT=$( { \
      find "$ROOT" -maxdepth 8 -type f -name registration.php 2>/dev/null; \
      find "$ROOT" -maxdepth 8 -type f -path "*/etc/module.xml" 2>/dev/null; \
    } | grep "/app/code/" \
      | while IFS= read -r f; do \
          d=$(dirname "$f"); \
          if echo "$f" | grep -q "/etc/module.xml$"; then \
            moddir=$(dirname "$d"); \
          else \
            moddir="$d"; \
          fi; \
          echo "$moddir"; \
        done | sort -u ); \
fi; \
echo "$OUT" || true'`;
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

