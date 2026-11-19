import JSZip from 'jszip';

export type ZipExportModality = 'full' | 'distribution' | 'backup';

export type ZipExportStage =
  | 'idle'
  | 'preparing'
  | 'compressing'
  | 'validating'
  | 'ready'
  | 'error';

export interface ZipModalityDescriptor {
  id: ZipExportModality;
  badge: string;
  title: string;
  shortLabel: string;
  subtitle: string;
  includes: string[];
  excludes: string[];
}

export const ZIP_MODALITY_DETAILS: ZipModalityDescriptor[] = [
  {
    id: 'full',
    badge: 'Modalidad A',
    title: 'Proyecto Completo',
    shortLabel: 'Proyecto Completo',
    subtitle:
      'Código fuente íntegro, motores matemáticos, servidor, pruebas y documentación para reconstruir y ejecutar VectorIA Studio.',
    includes: [
      'src/, server/, server.ts, public/, tests/, docs/',
      'Documentación: AGENTS.md, PRD.md, DESIGN.md, BITACORA.md, ARCHITECTURE.md, ROADMAP.md',
      'package.json, tsconfig.json, vite.config.ts, README.md y .env.example',
    ],
    excludes: [
      'node_modules/, .git/, dist/, cachés (.vite, coverage)',
      'Archivos .env reales, contraseñas, tokens, claves privadas y hashes',
    ],
  },
  {
    id: 'distribution',
    badge: 'Modalidad B',
    title: 'Distribución',
    shortLabel: 'Distribución',
    subtitle:
      'Paquete optimizado con artefactos compilados, servidor Node.js 22 ESM, motores esenciales y guía de despliegue.',
    includes: [
      'dist/ compilado (si existe), server.ts y server/',
      'Motores y utilidades esenciales (src/engines/, src/types/, src/utils/, src/services/)',
      'public/, package.json, tsconfig.json, ARCHITECTURE.md, .env.example y RESTORE_GUIDE.md',
    ],
    excludes: [
      'Pruebas (tests/), archivos fuente UI no requeridos en runtime, node_modules/ y .git/',
      'Credenciales, .env reales y datos locales privados',
    ],
  },
  {
    id: 'backup',
    badge: 'Modalidad C',
    title: 'Respaldo',
    shortLabel: 'Respaldo',
    subtitle:
      'Instantánea integral de código, documentación y configuración publicada saneada para restauración segura sin secretos.',
    includes: [
      'Proyecto completo + documentación técnica completa',
      'data/vectoria-builder.sanitized.json (estado visual publicado sin hashes ni secretos)',
      'RESTORE_GUIDE.md con procedimiento paso a paso de recuperación',
    ],
    excludes: [
      'adminHash, editorHash y signingSecret del servidor',
      'node_modules/, .git/, .env reales, bitácoras .log y archivos temporales',
    ],
  },
];

export const SENSITIVE_EXCLUSIONS = {
  directories: [
    'node_modules',
    '.git',
    '.next',
    '.nuxt',
    '.vite',
    '.turbo',
    '.cache',
    '.aistudio',
    'coverage',
    'tmp',
    'temp',
    'data',
  ] as const,
  files: [
    '.env',
    '.env.local',
    '.env.development',
    '.env.development.local',
    '.env.production',
    '.env.production.local',
    '.env.test',
    '.env.test.local',
    '.ds_store',
    'thumbs.db',
    'vectoria-builder.json',
  ] as const,
  extensions: [
    '.log',
    '.tmp',
    '.bak',
    '.swp',
    '.pem',
    '.key',
    '.p12',
    '.pfx',
    '.crt',
    '.sqlite',
    '.sqlite3',
    '.db',
  ] as const,
};

const ALWAYS_EXCLUDED_DIR_SET = new Set<string>(SENSITIVE_EXCLUSIONS.directories);
const ALWAYS_EXCLUDED_FILE_SET = new Set<string>(SENSITIVE_EXCLUSIONS.files);
const ALWAYS_EXCLUDED_EXT_SET = new Set<string>(SENSITIVE_EXCLUSIONS.extensions);

const ESSENTIAL_PATHS_BY_MODE: Record<ZipExportModality, string[]> = {
  full: ['VectorIA-Studio/package.json', 'VectorIA-Studio/.env.example', 'VectorIA-Studio/README.md'],
  distribution: ['VectorIA-Studio/package.json', 'VectorIA-Studio/.env.example'],
  backup: ['VectorIA-Studio/package.json', 'VectorIA-Studio/.env.example', 'VectorIA-Studio/README.md'],
};

export interface ZipProgressUpdate {
  stage: ZipExportStage;
  stageLabel: string;
  progressPct: number;
}

export interface ZipIntegrityCheck {
  passed: boolean;
  canOpen: boolean;
  structureValid: boolean;
  essentialFilesPresent: boolean;
  noCredentialsIncluded: boolean;
  missingEssentialFiles: string[];
  credentialFindings: string[];
  entryCount: number;
  sizeBytes: number;
  sha256: string | null;
  warnings: string[];
}

export interface LocalZipArchiveResult {
  filename: string;
  mode: ZipExportModality;
  bytes: Uint8Array;
  blob: Blob | null;
  sizeBytes: number;
  entryCount: number;
  excludedPaths: string[];
  validation: ZipIntegrityCheck;
  generatedAt: string;
}

export interface BackendZipExportResult {
  jobId: string;
  filename: string;
  mode: ZipExportModality;
  blob: Blob;
  sizeBytes: number;
  entryCount: number;
  sha256: string | null;
  validation: ZipIntegrityCheck;
  generatedAt: string;
}

function normalizeRelPath(inputPath: string): string {
  return inputPath
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/^\.\//, '');
}

function getExtensionLower(filePath: string): string {
  const base = filePath.split('/').pop() ?? '';
  const idx = base.lastIndexOf('.');
  if (idx <= 0) return '';
  return base.slice(idx).toLowerCase();
}

export function isSensitiveExportPath(
  relativePath: string,
  mode: ZipExportModality = 'full'
): boolean {
  const normalized = normalizeRelPath(relativePath);
  if (!normalized || normalized.includes('..')) return true;

  const segments = normalized.split('/').filter(Boolean);
  if (segments.length === 0) return true;

  for (let i = 0; i < segments.length - 1; i += 1) {
    if (ALWAYS_EXCLUDED_DIR_SET.has(segments[i].toLowerCase())) {
      return true;
    }
  }

  const filename = segments[segments.length - 1];
  const lowerName = filename.toLowerCase();

  if (ALWAYS_EXCLUDED_DIR_SET.has(lowerName)) return true;
  if (ALWAYS_EXCLUDED_FILE_SET.has(lowerName)) return true;
  if (lowerName.startsWith('.env') && lowerName !== '.env.example') return true;
  if (ALWAYS_EXCLUDED_EXT_SET.has(getExtensionLower(lowerName))) return true;

  // Exclude compiled dist/ for source & backup archives; allow it in distribution
  if (segments[0] === 'dist' && mode !== 'distribution') {
    return true;
  }

  if (mode === 'distribution') {
    const allowedTopLevelFiles = new Set([
      'package.json',
      'package-lock.json',
      'tsconfig.json',
      'vite.config.ts',
      'index.html',
      'server.ts',
      'README.md',
      'ARCHITECTURE.md',
      'AGENTS.md',
      '.env.example',
    ]);
    if (segments.length === 1) {
      return !allowedTopLevelFiles.has(filename);
    }
    const topDir = segments[0];
    if (topDir === 'dist' || topDir === 'server' || topDir === 'public') {
      return false;
    }
    if (topDir === 'src') {
      return !['engines', 'types', 'utils', 'services'].includes(segments[1] ?? '');
    }
    return true;
  }

  return false;
}

export function scanArchiveContentForSecrets(content: string, archivePath: string): string[] {
  const findings: string[] = [];
  const normalized = normalizeRelPath(archivePath);

  const privateKeyPattern = new RegExp(
    '-----BEGIN (?:RSA |EC |DSA |OPENSSH )?' + 'PRIVATE KEY-----'
  );
  if (privateKeyPattern.test(content)) {
    findings.push(`Clave privada detectada en ${normalized}`);
  }
  if (/\bsk-(?:proj-|live-)?[A-Za-z0-9_-]{32,}\b/.test(content)) {
    findings.push(`Posible token sk-* detectado en ${normalized}`);
  }
  if (/\bgh[pousr]_[A-Za-z0-9]{28,}\b/.test(content)) {
    findings.push(`Token de GitHub detectado en ${normalized}`);
  }
  if (/\bAKIA[0-9A-Z]{16}\b/.test(content)) {
    findings.push(`Clave AWS AKIA detectada en ${normalized}`);
  }

  const aizaMatches = content.match(/AIza[0-9A-Za-z\-_]{25,}/g) ?? [];
  for (const match of aizaMatches) {
    if (!/DummyKey|UnitTest|TestFakeKey|Example/i.test(match)) {
      findings.push(`Posible clave Google API en ${normalized}`);
      break;
    }
  }

  const envVarAssign = content.match(/GEMINI_API_KEY\s*=\s*["']?([A-Za-z0-9\-_]{16,})["']?/);
  if (
    envVarAssign &&
    envVarAssign[1] &&
    envVarAssign[1] !== 'MY_GEMINI_API_KEY' &&
    !envVarAssign[1].includes('REDACTED') &&
    !/Dummy|Fake|Test/i.test(envVarAssign[1])
  ) {
    findings.push(`GEMINI_API_KEY real asignada en ${normalized}`);
  }

  if (normalized.endsWith('vectoria-builder.json')) {
    if (/"(?:signingSecret|adminHash|editorHash)"\s*:\s*"[0-9a-f:]+"/i.test(content)) {
      findings.push(`Credencial/hash sin redactar en ${normalized}`);
    }
  }

  return findings;
}

async function computeSha256Hex(bytes: Uint8Array): Promise<string | null> {
  try {
    if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', copy.buffer);
      return Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch {
    // Fallback below for Node environments without subtle
  }

  if (typeof process !== 'undefined' && process.versions?.node) {
    try {
      const cryptoModName = 'node:' + 'crypto';
      const nodeCrypto = (await import(/* @vite-ignore */ cryptoModName)) as {
        createHash: (alg: string) => {
          update: (d: Uint8Array) => { digest: (enc: 'hex') => string };
        };
      };
      return nodeCrypto.createHash('sha256').update(bytes).digest('hex');
    } catch {
      return null;
    }
  }

  return null;
}

export function formatZipByteSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function buildZipFilename(mode: ZipExportModality, now = new Date()): string {
  const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `VectorIA-Studio_${mode}_${stamp}.zip`;
}

/**
 * Comprime dinámicamente un mapa de rutas relativas del proyecto usando JSZip,
 * aplicando exclusiones de seguridad, escaneo de secretos y validación posterior.
 */
export async function compressDirectoryMapWithJSZip(
  entries: Record<string, string | Uint8Array>,
  options: {
    mode: ZipExportModality;
    onProgress?: (update: ZipProgressUpdate) => void;
    requiredPaths?: string[];
  }
): Promise<LocalZipArchiveResult> {
  const { mode, onProgress, requiredPaths } = options;
  onProgress?.({
    stage: 'preparing',
    stageLabel: 'Preparando archivos y aplicando exclusiones de seguridad...',
    progressPct: 15,
  });

  const zip = new JSZip();
  const rootPrefix = 'VectorIA-Studio';
  const excludedPaths: string[] = [];
  const credentialFindings: string[] = [];
  const warnings: string[] = [];

  const sortedKeys = Object.keys(entries).sort();
  const includedEntries: Array<{ relPath: string; content: string | Uint8Array }> = [];

  for (const rawKey of sortedKeys) {
    const relPath = normalizeRelPath(rawKey);
    if (isSensitiveExportPath(relPath, mode)) {
      excludedPaths.push(relPath);
      continue;
    }
    const content = entries[rawKey];
    if (typeof content === 'string') {
      const leaks = scanArchiveContentForSecrets(content, relPath);
      if (leaks.length > 0) {
        credentialFindings.push(...leaks);
        excludedPaths.push(relPath);
        continue;
      }
    }
    includedEntries.push({ relPath, content });
  }

  onProgress?.({
    stage: 'compressing',
    stageLabel: `Comprimiendo ${includedEntries.length} archivos con JSZip...`,
    progressPct: 48,
  });

  for (const item of includedEntries) {
    zip.file(`${rootPrefix}/${item.relPath}`, item.content);
  }

  if (includedEntries.length === 0) {
    warnings.push('No se encontraron archivos elegibles tras aplicar los filtros de seguridad.');
  }

  const bytes = await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  onProgress?.({
    stage: 'validating',
    stageLabel: 'Validando integridad estructural del paquete ZIP...',
    progressPct: 82,
  });

  let canOpen = false;
  let structureValid = false;
  let entryCount = 0;
  const archiveNames = new Set<string>();

  try {
    const reopened = await JSZip.loadAsync(bytes);
    canOpen = true;
    const names = Object.keys(reopened.files).filter((name) => !reopened.files[name].dir);
    entryCount = names.length;
    for (const name of names) {
      archiveNames.add(name);
    }
    structureValid =
      entryCount > 0 && names.every((name) => name.startsWith(`${rootPrefix}/`) && !name.includes('..'));
  } catch {
    canOpen = false;
  }

  const essentials = requiredPaths ?? ESSENTIAL_PATHS_BY_MODE[mode];
  const missingEssentialFiles = essentials.filter((req) => !archiveNames.has(req));
  const essentialFilesPresent = missingEssentialFiles.length === 0;
  const noCredentialsIncluded = credentialFindings.length === 0;
  const passed = canOpen && structureValid && essentialFilesPresent && noCredentialsIncluded;
  const sha256 = await computeSha256Hex(bytes);

  const generatedAt = new Date().toISOString();
  const filename = buildZipFilename(mode);
  const blobCopy = new Uint8Array(bytes.byteLength);
  blobCopy.set(bytes);
  const blob =
    typeof Blob !== 'undefined' ? new Blob([blobCopy.buffer], { type: 'application/zip' }) : null;

  if (!passed) {
    onProgress?.({
      stage: 'error',
      stageLabel: 'La validación de integridad del ZIP detectó incidencias.',
      progressPct: 100,
    });
  } else {
    onProgress?.({
      stage: 'ready',
      stageLabel: 'Archivo listo y verificado',
      progressPct: 100,
    });
  }

  return {
    filename,
    mode,
    bytes,
    blob,
    sizeBytes: bytes.byteLength,
    entryCount,
    excludedPaths,
    validation: {
      passed,
      canOpen,
      structureValid,
      essentialFilesPresent,
      noCredentialsIncluded,
      missingEssentialFiles,
      credentialFindings,
      entryCount,
      sizeBytes: bytes.byteLength,
      sha256,
      warnings,
    },
    generatedAt,
  };
}

/**
 * Recorre dinámicamente un directorio del proyecto en entorno Node.js (sin exponer fs al bundle cliente)
 * y genera un ZIP seguro mediante `compressDirectoryMapWithJSZip`.
 */
export async function compressProjectDirectoryOnNode(
  rootDir: string,
  mode: ZipExportModality,
  onProgress?: (update: ZipProgressUpdate) => void
): Promise<LocalZipArchiveResult> {
  if (typeof process === 'undefined' || !process.versions?.node) {
    throw new Error(
      'compressProjectDirectoryOnNode solo puede ejecutarse en Node.js; usa exportProjectZipViaBackend en el navegador.'
    );
  }

  const fsModName = 'node:' + 'fs';
  const pathModName = 'node:' + 'path';
  const fs = (await import(/* @vite-ignore */ fsModName)) as typeof import('node:fs');
  const path = (await import(/* @vite-ignore */ pathModName)) as typeof import('node:path');

  const resolvedRoot = fs.realpathSync(rootDir);
  const collected: Record<string, string | Uint8Array> = {};

  const walk = (currentDir: string) => {
    const dirents = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const dirent of dirents) {
      if (dirent.isSymbolicLink()) continue;
      const fullPath = path.join(currentDir, dirent.name);
      const realChild = fs.realpathSync(fullPath);
      if (
        realChild !== resolvedRoot &&
        !realChild.startsWith(`${resolvedRoot}${path.sep}`)
      ) {
        continue;
      }

      const relPath = path.relative(resolvedRoot, realChild).replace(/\\/g, '/');
      if (dirent.isDirectory()) {
        if (ALWAYS_EXCLUDED_DIR_SET.has(dirent.name.toLowerCase())) continue;
        if (relPath === 'dist' && mode !== 'distribution') continue;
        walk(realChild);
      } else if (dirent.isFile()) {
        if (isSensitiveExportPath(relPath, mode)) continue;
        const stat = fs.statSync(realChild);
        if (stat.size > 10 * 1024 * 1024) continue;
        const ext = path.extname(dirent.name).toLowerCase();
        const isText =
          dirent.name === '.env.example' ||
          dirent.name === '.gitignore' ||
          ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css', '.html', '.svg', '.txt'].includes(
            ext
          );
        collected[relPath] = isText
          ? fs.readFileSync(realChild, 'utf-8')
          : new Uint8Array(fs.readFileSync(realChild));
      }
    }
  };

  walk(resolvedRoot);
  return compressDirectoryMapWithJSZip(collected, { mode, onProgress });
}

/**
 * Verifica localmente en navegador un Blob ZIP descargado mediante JSZip.loadAsync
 * antes de entregarlo al usuario.
 */
export async function verifyZipBlobWithJSZip(
  blob: Blob,
  expectedRootPrefix = 'VectorIA-Studio/'
): Promise<{
  readable: boolean;
  entryCount: number;
  structureValid: boolean;
  sha256: string | null;
}> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const sha256 = await computeSha256Hex(bytes);

  try {
    const zip = await JSZip.loadAsync(bytes);
    const files = Object.keys(zip.files).filter((name) => !zip.files[name].dir);
    const structureValid =
      files.length > 0 &&
      files.every((name) => name.startsWith(expectedRootPrefix) && !name.includes('..'));
    return {
      readable: files.length > 0,
      entryCount: files.length,
      structureValid,
      sha256,
    };
  } catch {
    return {
      readable: false,
      entryCount: 0,
      structureValid: false,
      sha256,
    };
  }
}

export function triggerZipBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

interface BackendJobStatusPayload {
  jobId: string;
  mode: ZipExportModality;
  status: 'preparing' | 'compressing' | 'validating' | 'ready' | 'error';
  stageLabel: string;
  progressPct: number;
  filename: string;
  createdAt: string;
  completedAt: string | null;
  fileCount: number;
  sizeBytes: number;
  validation: ZipIntegrityCheck | null;
  error: string | null;
  message?: string;
}

/**
 * Ejecuta el flujo completo de exportación ZIP protegida en el backend,
 * monitorea progreso en tiempo real, descarga el Blob, lo valida localmente con JSZip
 * y limpia el archivo temporal en servidor.
 */
export async function exportProjectZipViaBackend(options: {
  mode: ZipExportModality;
  token: string;
  onProgress?: (update: ZipProgressUpdate) => void;
  cleanupAfterDownload?: boolean;
}): Promise<BackendZipExportResult> {
  const { mode, token, onProgress, cleanupAfterDownload = true } = options;
  if (!token) {
    throw new Error('Se requiere autenticación de Administrador para exportar el proyecto (.ZIP).');
  }

  onProgress?.({
    stage: 'preparing',
    stageLabel: 'Preparando archivos...',
    progressPct: 10,
  });

  const createRes = await fetch('/api/builder/export-zip', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ mode }),
  });

  const createData = (await createRes.json()) as BackendJobStatusPayload;
  if (!createRes.ok || !createData.jobId) {
    throw new Error(createData.message || 'No se pudo iniciar la exportación ZIP en el servidor.');
  }

  const jobId = createData.jobId;
  let finalState: BackendJobStatusPayload = createData;

  try {
    const deadline = Date.now() + 60_000;
    while (finalState.status !== 'ready' && finalState.status !== 'error') {
      if (Date.now() > deadline) {
        throw new Error('Tiempo de espera agotado al comprimir y validar el archivo ZIP.');
      }
      await new Promise((resolve) => setTimeout(resolve, 220));
      const statusRes = await fetch(`/api/builder/export-zip/${encodeURIComponent(jobId)}/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const statusData = (await statusRes.json()) as BackendJobStatusPayload;
      if (!statusRes.ok) {
        throw new Error(statusData.message || 'No se pudo consultar el progreso del archivo ZIP.');
      }
      finalState = statusData;
      onProgress?.({
        stage: finalState.status,
        stageLabel: finalState.stageLabel,
        progressPct: Math.min(92, Math.max(15, finalState.progressPct)),
      });
    }

    if (finalState.status === 'error' || !finalState.validation?.passed) {
      throw new Error(
        finalState.error || 'El archivo ZIP generado no superó la verificación de integridad.'
      );
    }

    onProgress?.({
      stage: 'validating',
      stageLabel: 'Verificando archivo ZIP descargado con JSZip...',
      progressPct: 95,
    });

    const dlRes = await fetch(`/api/builder/export-zip/${encodeURIComponent(jobId)}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!dlRes.ok) {
      const errData = (await dlRes.json().catch(() => ({}))) as { message?: string };
      throw new Error(errData.message || 'Error al descargar el archivo ZIP validado.');
    }

    const blob = await dlRes.blob();
    const clientCheck = await verifyZipBlobWithJSZip(blob);
    if (!clientCheck.readable || !clientCheck.structureValid) {
      throw new Error(
        'La verificación local con JSZip determinó que el archivo descargado está incompleto o dañado.'
      );
    }

    onProgress?.({
      stage: 'ready',
      stageLabel: 'Archivo listo',
      progressPct: 100,
    });

    return {
      jobId,
      filename: finalState.filename,
      mode,
      blob,
      sizeBytes: blob.size || finalState.sizeBytes,
      entryCount: clientCheck.entryCount,
      sha256: finalState.validation.sha256 ?? clientCheck.sha256,
      validation: finalState.validation,
      generatedAt: finalState.completedAt ?? finalState.createdAt,
    };
  } finally {
    if (cleanupAfterDownload) {
      try {
        await fetch(`/api/builder/export-zip/${encodeURIComponent(jobId)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // Best-effort cleanup of temp artifact
      }
    }
  }
}
