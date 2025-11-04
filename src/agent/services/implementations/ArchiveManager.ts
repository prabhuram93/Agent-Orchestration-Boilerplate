export async function prepareRemoteZip(
  sandbox: Sandbox,
  url: string,
  onProgress?: (m: string) => void
): Promise<PrepareUploadResult> {
  const baseDir = '/workspace';
  const dir = `${baseDir}/remote-${Date.now()}`;
  const zipPath = `${dir}/repo.zip`;
  if (typeof sandbox.mkdir === 'function') {
    await sandbox.mkdir(dir, { recursive: true });
  } else {
    await sandbox.exec(`bash -lc 'mkdir -p "${dir}"'`);
  }
  onProgress?.('Downloading archive from remote...');
  const dl = await sandbox.exec(
    `bash -lc 'set -e; ` +
    `if command -v curl >/dev/null 2>&1; then curl -fsSL ${JSON.stringify(url)} -o ${JSON.stringify(zipPath)} || exit 11; ` +
    `elif command -v wget >/dev/null 2>&1; then wget -qO ${JSON.stringify(zipPath)} ${JSON.stringify(url)} || exit 12; ` +
    `else exit 13; fi; ` +
    `test -s ${JSON.stringify(zipPath)} && echo ok || { echo empty; exit 14; }'`
  );
  const ok = dl && dl.success !== false && ((dl.stdout || '').toString().includes('ok'));
  if (!ok) {
    const out = (dl?.stdout || dl?.stderr || '').toString();
    onProgress?.('Remote download failed: ' + (out ? out.trim() : 'unknown error'));
    throw new Error('remote_download_failed');
  }
  await extractArchive(sandbox, dir, zipPath, onProgress);
  const rootPath = await detectProjectRoot(sandbox, dir, onProgress);
  onProgress?.('Upload ready at: ' + rootPath);
  return { baseDir: dir, rootPath };
}
type Sandbox = any;

export interface PrepareUploadResult {
  baseDir: string;
  rootPath: string;
}

function slugifyName(name: string): string {
  const noExt = name.replace(/\.(zip|tar|tgz|tar\.gz)$/i, '');
  const slug = noExt.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || 'upload';
}

async function uploadArchiveAsZip(
  sandbox: Sandbox,
  file: any,
  baseDir: string,
  onProgress?: (m: string) => void
): Promise<{ dir: string; zipPath: string }> {
  const rawName = (file && file.name ? String(file.name) : 'upload');
  const safeName = slugifyName(rawName);
  const fullDir = `${baseDir}/${safeName}`;
  onProgress?.('Preparing upload directory: ' + fullDir);
  if (typeof sandbox.mkdir === 'function') {
    await sandbox.mkdir(fullDir, { recursive: true });
  } else {
    await sandbox.exec(`bash -lc 'mkdir -p "${fullDir}"'`);
  }

  const zipPath = `${fullDir}/repo.zip`;
  const b64Path = `${zipPath}.b64`;

  const ab = await file.arrayBuffer();
  const u8 = new Uint8Array(ab);
  onProgress?.('Uploading ZIP (' + u8.length + ' bytes)...');
  await sandbox.exec(`bash -lc 'rm -f "${zipPath}" "${b64Path}" || true'`);
  if (typeof sandbox.writeFile === 'function') {
    let bin = '';
    for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
    // @ts-ignore
    const b64 = btoa(bin);
    await sandbox.writeFile(b64Path, b64);
  } else {
    const chunk = 256 * 1024;
    for (let o = 0; o < u8.length; o += chunk) {
      const slice = u8.subarray(o, Math.min(o + chunk, u8.length));
      let bin = '';
      for (let i = 0; i < slice.length; i++) bin += String.fromCharCode(slice[i]);
      // @ts-ignore
      const enc = btoa(bin);
      await sandbox.exec(`bash -lc 'printf %s ${JSON.stringify(enc)} >> "${b64Path}"'`);
      if ((o / chunk) % 16 === 0) onProgress?.('Uploaded ' + Math.min(o + chunk, u8.length) + ' / ' + u8.length + ' bytes...');
    }
  }
  await sandbox.exec(`bash -lc 'base64 -d "${b64Path}" > "${zipPath}" && rm -f "${b64Path}"'`);
  return { dir: fullDir, zipPath };
}

async function extractArchive(
  sandbox: Sandbox,
  dir: string,
  zipPath: string,
  onProgress?: (m: string) => void
): Promise<void> {
  onProgress?.('Unzipping...');
  const mimeRes = await sandbox.exec(`bash -lc 'file -b --mime-type "${zipPath}" || echo unknown'`);
  const mime = ((mimeRes?.stdout || mimeRes?.stderr || '').toString().trim()) || 'unknown';
  let extracted = false;

  if (!extracted && mime === 'application/zip') {
    const r = await sandbox.exec(`bash -lc 'cd "${dir}" && (unzip -q ${JSON.stringify(zipPath).slice(1,-1)} || echo unzip_failed)'`);
    extracted = !!(r && r.success !== false && !((r.stdout || r.stderr || '').toString().includes('unzip_failed')));
  }
  if (!extracted && (mime === 'application/gzip' || mime === 'application/x-gzip')) {
    const r = await sandbox.exec(`bash -lc 'cd "${dir}" && (tar -xzf ${JSON.stringify(zipPath).slice(1,-1)} || echo tar_failed)'`);
    extracted = !!(r && r.success !== false && !((r.stdout || r.stderr || '').toString().includes('tar_failed')));
  }
  if (!extracted && mime === 'application/x-tar') {
    const r = await sandbox.exec(`bash -lc 'cd "${dir}" && (tar -xf ${JSON.stringify(zipPath).slice(1,-1)} || echo tar_failed)'`);
    extracted = !!(r && r.success !== false && !((r.stdout || r.stderr || '').toString().includes('tar_failed')));
  }
  if (!extracted) {
    const b = await sandbox.exec(`bash -lc 'cd "${dir}" && (bsdtar -xf ${JSON.stringify(zipPath).slice(1,-1)} || echo bsdtar_failed)'`);
    extracted = !!(b && b.success !== false && !((b.stdout || b.stderr || '').toString().includes('bsdtar_failed')));
  }
  if (!extracted) {
    const u = await sandbox.exec(`bash -lc 'cd "${dir}" && (unzip -q ${JSON.stringify(zipPath).slice(1,-1)} || echo unzip_failed2)'`);
    extracted = !!(u && u.success !== false && !((u.stdout || u.stderr || '').toString().includes('unzip_failed2')));
  }
  if (!extracted) onProgress?.('Warning: unzip failed inside sandbox (mime=' + mime + ').');
  await sandbox.exec(`bash -lc 'rm -f "${zipPath}"'`);
}

async function detectProjectRoot(
  sandbox: Sandbox,
  baseDir: string,
  onProgress?: (m: string) => void
): Promise<string> {
  onProgress?.('Detecting module root...');
  const res = await sandbox.exec(`bash -lc '\nROOT=${JSON.stringify(baseDir).slice(1,-1)}; \
for i in 1 2 3; do \
  if [ -d "$ROOT/app/code" ] || [ -d "$ROOT/vendor/magento" ]; then break; fi; \
  SUBDIRS=$(find "$ROOT" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d " "); \
  if [ "$SUBDIRS" = "1" ]; then \
    ROOT=$(find "$ROOT" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | head -n1); \
  else \
    break; \
  fi; \
done; \
if [ -d "$ROOT/app/code" ] || [ -d "$ROOT/vendor/magento" ]; then echo "$ROOT"; else echo ${JSON.stringify(baseDir).slice(1,-1)}; fi'`);
  const pick = (res?.stdout || res?.stderr || '').toString().trim();
  if (pick && pick !== baseDir && pick.startsWith('/')) onProgress?.('Detected nested root: ' + pick);
  return pick && pick.startsWith('/') ? pick : baseDir;
}

export async function prepareUpload(
  sandbox: Sandbox,
  file: any,
  onProgress?: (m: string) => void
): Promise<PrepareUploadResult> {
  const baseDir = '/workspace';
  const { dir, zipPath } = await uploadArchiveAsZip(sandbox, file, baseDir, onProgress);
  await extractArchive(sandbox, dir, zipPath, onProgress);
  const rootPath = await detectProjectRoot(sandbox, dir, onProgress);
  onProgress?.('Upload ready at: ' + rootPath);
  return { baseDir: dir, rootPath };
}


