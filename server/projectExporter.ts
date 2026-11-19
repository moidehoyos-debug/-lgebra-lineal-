import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import JSZip from 'jszip';

export type ZipExportMode = 'full' | 'distribution' | 'backup';
export type ZipJobStatus =
  | 'preparing'
  | 'compressing'
  | 'validating'
  | 'ready'
  | 'error';

export interface ZipValidationReport {
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

export interface ZipExportJob {
  jobId: string;
  mode: ZipExportMode;
  status: ZipJobStatus;
  stageLabel: string;
  progressPct: number;
  filename: string;
  tempFilePath: string | null;
  createdAt: string;
  completedAt: string | null;
  expiresAt: number;
  fileCount: number;
  sizeBytes: number;
  validation: ZipValidationReport | null;
  error: string | null;
}

const MAX_ZIP_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB hard cap
const MAX_SINGLE_FILE_BYTES = 10 * 1024 * 1024; // 10 MB per file cap
const JOB_TTL_MS = 10 * 60 * 1000; // 10 minutes
const EXPORT_TIMEOUT_MS = 45_000;

const ALWAYS_EXCLUDED_DIRS = new Set([
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
]);

const ALWAYS_EXCLUDED_FILES = new Set([
  '.env',
  '.env.local',
  '.env.development',
  '.env.development.local',
  '.env.production',
  '.env.production.local',
  '.env.test',
  '.env.test.local',
  '.DS_Store',
  'Thumbs.db',
]);

const EXCLUDED_EXTENSIONS = new Set([
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
]);

const ESSENTIAL_FILES_BY_MODE: Record<ZipExportMode, string[]> = {
  full: [
    'VectorIA-Studio/package.json',
    'VectorIA-Studio/.env.example',
    'VectorIA-Studio/README.md',
    'VectorIA-Studio/tsconfig.json',
    'VectorIA-Studio/vite.config.ts',
    'VectorIA-Studio/index.html',
    'VectorIA-Studio/server.ts',
    'VectorIA-Studio/src/App.tsx',
    'VectorIA-Studio/AGENTS.md',
    'VectorIA-Studio/PRD.md',
    'VectorIA-Studio/DESIGN.md',
    'VectorIA-Studio/BITACORA.md',
    'VectorIA-Studio/ARCHITECTURE.md',
    'VectorIA-Studio/ROADMAP.md',
  ],
  distribution: [
    'VectorIA-Studio/package.json',
    'VectorIA-Studio/.env.example',
    'VectorIA-Studio/README.md',
    'VectorIA-Studio/tsconfig.json',
    'VectorIA-Studio/server.ts',
    'VectorIA-Studio/server/builderStore.ts',
    'VectorIA-Studio/server/projectExporter.ts',
    'VectorIA-Studio/ARCHITECTURE.md',
  ],
  backup: [
    'VectorIA-Studio/package.json',
    'VectorIA-Studio/.env.example',
    'VectorIA-Studio/README.md',
    'VectorIA-Studio/server.ts',
    'VectorIA-Studio/src/App.tsx',
    'VectorIA-Studio/AGENTS.md',
    'VectorIA-Studio/PRD.md',
    'VectorIA-Studio/DESIGN.md',
    'VectorIA-Studio/BITACORA.md',
    'VectorIA-Studio/ARCHITECTURE.md',
    'VectorIA-Studio/ROADMAP.md',
    'VectorIA-Studio/RESTORE_GUIDE.md',
  ],
};

const TEXT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.css',
  '.html',
  '.svg',
  '.txt',
  '.yml',
  '.yaml',
  '.example',
  '.gitignore',
]);

function isTextFile(relPath: string): boolean {
  const base = path.basename(relPath);
  if (base === '.env.example' || base === '.gitignore') return true;
  return TEXT_EXTENSIONS.has(path.extname(relPath).toLowerCase());
}

/**
 * Detecta credenciales reales o claves privadas evitando falsos positivos sobre expresiones
 * regulares de detección o fixtures de prueba sintéticos.
 */
export function scanContentForRealSecrets(content: string, archivePath: string): string[] {
  const findings: string[] = [];
  const normalized = archivePath.replace(/\\/g, '/');

  const privateKeyPattern = new RegExp(
    '-----BEGIN (?:RSA |EC |DSA |OPENSSH )?' + 'PRIVATE KEY-----'
  );
  if (privateKeyPattern.test(content)) {
    findings.push(`Clave privada detectada en ${normalized}`);
  }

  // Real OpenAI / GitHub / AWS / Stripe / Slack token prefixes
  if (/\bsk-(?:proj-|live-)?[A-Za-z0-9_-]{32,}\b/.test(content)) {
    findings.push(`Posible token tipo sk-* en ${normalized}`);
  }
  if (/\bgh[pousr]_[A-Za-z0-9]{28,}\b/.test(content)) {
    findings.push(`Token de GitHub detectado en ${normalized}`);
  }
  if (/\bAKIA[0-9A-Z]{16}\b/.test(content)) {
    findings.push(`Clave AWS AKIA detectada en ${normalized}`);
  }

  // Google AIza keys (skip intentional unit-test dummy/fake markers)
  const aizaMatches = content.match(/AIza[0-9A-Za-z\-_]{25,}/g) ?? [];
  for (const match of aizaMatches) {
    if (!/DummyKey|UnitTest|TestFakeKey|Example/i.test(match)) {
      findings.push(`Posible clave Google API en ${normalized}`);
      break;
    }
  }

  // Non-placeholder GEMINI_API_KEY or VECTORIA_ADMIN_PASSCODE assignments
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

  // Raw builderStore hashes or HMAC secrets must never appear inside exported JSON
  if (normalized.endsWith('vectoria-builder.json')) {
    if (/"signingSecret"\s*:\s*"[0-9a-f]{16,}"/i.test(content)) {
      findings.push(`signingSecret sin redactar en ${normalized}`);
    }
    if (/"adminHash"\s*:\s*"[0-9a-f]+:[0-9a-f]+"/i.test(content)) {
      findings.push(`adminHash sin redactar en ${normalized}`);
    }
    if (/"editorHash"\s*:\s*"[0-9a-f]+:[0-9a-f]+"/i.test(content)) {
      findings.push(`editorHash sin redactar en ${normalized}`);
    }
    if (/"viewerHash"\s*:\s*"[0-9a-f]+:[0-9a-f]+"/i.test(content)) {
      findings.push(`viewerHash sin redactar en ${normalized}`);
    }
  }

  return findings;
}

function buildSafeEnvExample(rootDir: string): string {
  const existingPath = path.join(rootDir, '.env.example');
  const fallback = [
    '# GEMINI_API_KEY: Clave de Gemini API (solo servidor).',
    'GEMINI_API_KEY="MY_GEMINI_API_KEY"',
    '',
    '# APP_URL: URL pública de despliegue.',
    'APP_URL="MY_APP_URL"',
    '',
    '# VECTORIA_ADMIN_PASSCODE: Contraseña inicial opcional para Visual Builder (>= 8 caracteres).',
    'VECTORIA_ADMIN_PASSCODE=""',
    '',
  ].join('\n');

  try {
    if (!fs.existsSync(existingPath)) return fallback;
    const raw = fs.readFileSync(existingPath, 'utf-8');
    // Double-check that .env.example itself contains no accidental real secrets
    if (scanContentForRealSecrets(raw, '.env.example').length > 0) {
      return fallback;
    }
    return raw;
  } catch {
    return fallback;
  }
}

function buildRestoreGuide(mode: ZipExportMode, exportedAt: string): string {
  return [
    '# Guía de Restauración — VectorIA Studio',
    '',
    `- **Modalidad exportada**: \`${mode}\``,
    `- **Fecha de generación**: ${exportedAt}`,
    '',
    '## Pasos de restauración en entorno limpio',
    '1. Descomprime este archivo en una **carpeta nueva** (no sobrescribas un proyecto activo sin respaldo previo).',
    '2. Copia `.env.example` a `.env` y define tus variables en entorno seguro (`GEMINI_API_KEY` y opcionalmente `VECTORIA_ADMIN_PASSCODE`).',
    '3. Instala dependencias con `npm install` (o `bun install` si utilizas `bun.lock`).',
    '4. Verifica tipos, pruebas y compilación:',
    '   - `npm run lint`',
    '   - `npm test`',
    '   - `npm run build`',
    '5. Ejecuta en desarrollo (`npm run dev`) o producción (`NODE_ENV=production npm start`).',
    '',
    '> Nota de seguridad: Este ZIP excluye `.env`, `node_modules/`, `.git/` y credenciales/hashes administrativos.',
    '',
  ].join('\n');
}

function isExcludedPath(relPosix: string, mode: ZipExportMode): boolean {
  const segments = relPosix.split('/');
  const baseName = segments[segments.length - 1];
  const ext = path.extname(baseName).toLowerCase();

  for (const seg of segments.slice(0, -1)) {
    if (ALWAYS_EXCLUDED_DIRS.has(seg)) return true;
    if (seg === 'dist' && mode !== 'distribution') return true;
  }

  if (ALWAYS_EXCLUDED_DIRS.has(baseName)) return true;
  if (baseName === 'dist' && mode !== 'distribution') return true;
  if (ALWAYS_EXCLUDED_FILES.has(baseName)) return true;
  if (baseName.startsWith('.env') && baseName !== '.env.example') return true;
  if (EXCLUDED_EXTENSIONS.has(ext)) return true;

  return false;
}

function isIncludedForMode(relPosix: string, mode: ZipExportMode): boolean {
  if (isExcludedPath(relPosix, mode)) return false;

  if (mode === 'full' || mode === 'backup') {
    return true;
  }

  // mode === 'distribution': deployment runtime + compiled dist + configs + docs
  const allowedPrefixes = [
    'dist/',
    'public/',
    'server/',
    'src/engines/',
    'src/types/',
    'src/utils/',
  ];
  const allowedRootFiles = new Set([
    'package.json',
    'package-lock.json',
    'bun.lock',
    'tsconfig.json',
    'server.ts',
    'README.md',
    'ARCHITECTURE.md',
    'CHANGELOG.md',
    'metadata.json',
    '.env.example',
  ]);
  if (allowedRootFiles.has(relPosix)) return true;
  return allowedPrefixes.some((prefix) => relPosix.startsWith(prefix));
}

export class ProjectExporter {
  private rootDir: string;
  private tempDir: string;
  private builderDataFilePath: string;
  private jobs = new Map<string, ZipExportJob>();

  constructor(options?: {
    rootDir?: string;
    tempDir?: string;
    builderDataFilePath?: string;
  }) {
    this.rootDir = fs.realpathSync(options?.rootDir ?? process.cwd());
    this.tempDir = options?.tempDir ?? os.tmpdir();
    this.builderDataFilePath =
      options?.builderDataFilePath ??
      path.resolve(this.rootDir, 'data', 'vectoria-builder.json');
  }

  private sweepExpiredJobs(): void {
    const now = Date.now();
    for (const [id, job] of this.jobs.entries()) {
      if (now > job.expiresAt) {
        this.cleanupTempFile(job.tempFilePath);
        this.jobs.delete(id);
      }
    }
  }

  private cleanupTempFile(filePath: string | null): void {
    if (!filePath) return;
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {
      // Ignore cleanup errors on already-removed files
    }
  }

  public disposeAll(): void {
    for (const job of this.jobs.values()) {
      this.cleanupTempFile(job.tempFilePath);
      job.tempFilePath = null;
    }
    this.jobs.clear();
  }

  public cleanupJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;
    this.cleanupTempFile(job.tempFilePath);
    job.tempFilePath = null;
    this.jobs.delete(jobId);
    return true;
  }

  public verifyBeforeDownload(jobId: string): {
    ok: boolean;
    job?: ZipExportJob;
    error?: string;
  } {
    this.sweepExpiredJobs();
    const job = this.jobs.get(jobId);
    if (!job) {
      return { ok: false, error: 'El archivo ZIP solicitado no existe o expiró.' };
    }
    if (job.status !== 'ready' || !job.validation?.passed || !job.tempFilePath) {
      return {
        ok: false,
        error: job.error || 'El archivo ZIP aún no ha completado la validación de integridad.',
      };
    }
    const resolvedTempRoot = path.resolve(this.tempDir);
    const resolvedTarget = path.resolve(job.tempFilePath);
    if (!resolvedTarget.startsWith(resolvedTempRoot + path.sep)) {
      return { ok: false, error: 'Ruta de archivo temporal fuera de directorio permitido.' };
    }
    if (!fs.existsSync(resolvedTarget)) {
      return { ok: false, error: 'El archivo temporal ya fue limpiado; genera uno nuevo.' };
    }
    const lstat = fs.lstatSync(resolvedTarget);
    if (!lstat.isFile() || lstat.isSymbolicLink() || lstat.size !== job.sizeBytes) {
      this.cleanupTempFile(resolvedTarget);
      job.tempFilePath = null;
      return { ok: false, error: 'Verificación de tamaño del archivo ZIP fallida.' };
    }
    const actualSha256 = crypto
      .createHash('sha256')
      .update(fs.readFileSync(resolvedTarget))
      .digest('hex');
    if (!job.validation.sha256 || actualSha256 !== job.validation.sha256) {
      this.cleanupTempFile(resolvedTarget);
      job.tempFilePath = null;
      return { ok: false, error: 'Integridad SHA-256 del archivo ZIP comprometida.' };
    }
    return { ok: true, job };
  }

  public getJob(jobId: string): ZipExportJob | null {
    this.sweepExpiredJobs();
    return this.jobs.get(jobId) ?? null;
  }

  public startExportJob(mode: ZipExportMode): ZipExportJob {
    this.sweepExpiredJobs();
    const jobId = `zip-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    const timestampSlug = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const filename = `VectorIA-Studio-${mode}-${timestampSlug}.zip`;
    const job: ZipExportJob = {
      jobId,
      mode,
      status: 'preparing',
      stageLabel: 'Preparando archivos',
      progressPct: 10,
      filename,
      tempFilePath: null,
      createdAt: new Date().toISOString(),
      completedAt: null,
      expiresAt: Date.now() + JOB_TTL_MS,
      fileCount: 0,
      sizeBytes: 0,
      validation: null,
      error: null,
    };
    this.jobs.set(jobId, job);

    // Execute asynchronously without blocking the event loop / HTTP handler
    setImmediate(() => {
      void this.runExportJob(job);
    });

    return job;
  }

  /**
   * Ejecución directa útil para pruebas deterministas y verificación síncrona.
   */
  public async runExportSync(mode: ZipExportMode): Promise<ZipExportJob> {
    const job = this.startExportJob(mode);
    await this.runExportJob(job);
    return job;
  }

  private collectProjectFiles(mode: ZipExportMode): Array<{ absPath: string; relPosix: string }> {
    const collected: Array<{ absPath: string; relPosix: string }> = [];

    const walk = (currentDir: string, relBase: string) => {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      entries.sort((a, b) => a.name.localeCompare(b.name));

      for (const entry of entries) {
        const childAbs = path.join(currentDir, entry.name);
        // Reject symlinks to prevent directory traversal outside rootDir
        const lstat = fs.lstatSync(childAbs);
        if (lstat.isSymbolicLink()) continue;

        const resolvedReal = fs.realpathSync(childAbs);
        if (
          resolvedReal !== this.rootDir &&
          !resolvedReal.startsWith(this.rootDir + path.sep)
        ) {
          continue;
        }

        const relPosix = relBase ? `${relBase}/${entry.name}` : entry.name;
        if (isExcludedPath(relPosix, mode)) continue;

        if (lstat.isDirectory()) {
          walk(resolvedReal, relPosix);
        } else if (lstat.isFile()) {
          if (lstat.size > MAX_SINGLE_FILE_BYTES) continue;
          if (isIncludedForMode(relPosix, mode)) {
            collected.push({ absPath: resolvedReal, relPosix });
          }
        }
      }
    };

    walk(this.rootDir, '');
    return collected;
  }

  private buildSanitizedBuilderBackupJson(): string | null {
    try {
      if (!fs.existsSync(this.builderDataFilePath)) return null;
      const raw = fs.readFileSync(this.builderDataFilePath, 'utf-8');
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const sanitized = {
        authInitialized: false,
        adminHash: null,
        editorHash: null,
        viewerHash: null,
        signingSecret: '',
        tokenVersion: 1,
        revokedTokens: [],
        draft: parsed.draft ?? null,
        published: parsed.published ?? null,
        versions: Array.isArray(parsed.versions) ? parsed.versions : [],
        auditLog: [],
        updatedAt: parsed.updatedAt ?? new Date().toISOString(),
        publishedAt: parsed.publishedAt ?? null,
        sanitizedNotice:
          'Credenciales administrativas (adminHash, editorHash, signingSecret) eliminadas por seguridad durante el respaldo.',
      };
      return JSON.stringify(sanitized, null, 2);
    } catch {
      return null;
    }
  }

  private async runExportJob(job: ZipExportJob): Promise<void> {
    if (job.status === 'ready' || job.status === 'error') return;
    const deadline = Date.now() + EXPORT_TIMEOUT_MS;
    const tempPath = path.join(this.tempDir, `${job.jobId}.zip`);

    try {
      job.status = 'preparing';
      job.stageLabel = 'Preparando archivos';
      job.progressPct = 15;

      const files = this.collectProjectFiles(job.mode);
      const zip = new JSZip();
      const rootFolder = zip.folder('VectorIA-Studio');
      if (!rootFolder) {
        throw new Error('No se pudo inicializar el directorio raíz del archivo ZIP.');
      }

      const addedArchivePaths = new Set<string>();
      const warnings: string[] = [];

      for (const file of files) {
        if (Date.now() > deadline) {
          throw new Error('Tiempo límite excedido durante la preparación del proyecto.');
        }
        const archivePath = `VectorIA-Studio/${file.relPosix}`;
        if (addedArchivePaths.has(archivePath)) continue;

        // Always normalize .env.example through buildSafeEnvExample
        if (file.relPosix === '.env.example') {
          rootFolder.file('.env.example', buildSafeEnvExample(this.rootDir));
          addedArchivePaths.add(archivePath);
          continue;
        }

        const buf = fs.readFileSync(file.absPath);
        if (isTextFile(file.relPosix)) {
          const text = buf.toString('utf-8');
          const leaks = scanContentForRealSecrets(text, archivePath);
          if (leaks.length > 0) {
            throw new Error(`Exportación bloqueada por seguridad: ${leaks[0]}`);
          }
        }
        rootFolder.file(file.relPosix, buf);
        addedArchivePaths.add(archivePath);
      }

      // Ensure .env.example is always present
      if (!addedArchivePaths.has('VectorIA-Studio/.env.example')) {
        rootFolder.file('.env.example', buildSafeEnvExample(this.rootDir));
        addedArchivePaths.add('VectorIA-Studio/.env.example');
      }

      // Mode-specific safe additions
      if (job.mode === 'backup') {
        rootFolder.file('RESTORE_GUIDE.md', buildRestoreGuide(job.mode, job.createdAt));
        addedArchivePaths.add('VectorIA-Studio/RESTORE_GUIDE.md');

        const safeBuilderJson = this.buildSanitizedBuilderBackupJson();
        if (safeBuilderJson) {
          rootFolder.file('data/vectoria-builder.sanitized.json', safeBuilderJson);
          addedArchivePaths.add('VectorIA-Studio/data/vectoria-builder.sanitized.json');
        } else {
          warnings.push(
            'No existía data/vectoria-builder.json en disco; se incluyeron las configuraciones base del repositorio.'
          );
        }
      }

      if (job.mode === 'distribution') {
        const hasDist = Array.from(addedArchivePaths).some((p) =>
          p.startsWith('VectorIA-Studio/dist/')
        );
        if (!hasDist) {
          warnings.push(
            'La carpeta dist/ no estaba compilada en disco; ejecuta "npm run build" tras descomprimir antes de "npm start".'
          );
        }
        rootFolder.file('RESTORE_GUIDE.md', buildRestoreGuide(job.mode, job.createdAt));
        addedArchivePaths.add('VectorIA-Studio/RESTORE_GUIDE.md');
      }

      job.fileCount = addedArchivePaths.size;
      job.status = 'compressing';
      job.stageLabel = 'Comprimiendo proyecto';
      job.progressPct = 55;

      const compressedBuffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      if (compressedBuffer.byteLength === 0) {
        throw new Error('El archivo ZIP generado está vacío.');
      }
      if (compressedBuffer.byteLength > MAX_ZIP_SIZE_BYTES) {
        throw new Error(
          `El ZIP (${Math.round(compressedBuffer.byteLength / (1024 * 1024))} MB) supera el límite máximo permitido de 50 MB.`
        );
      }

      fs.writeFileSync(tempPath, compressedBuffer, { mode: 0o600 });
      job.tempFilePath = tempPath;
      job.sizeBytes = compressedBuffer.byteLength;

      job.status = 'validating';
      job.stageLabel = 'Validando ZIP';
      job.progressPct = 85;

      const validation = await this.validateGeneratedZip(tempPath, job.mode, warnings);
      job.validation = validation;

      if (!validation.passed) {
        this.cleanupTempFile(tempPath);
        job.tempFilePath = null;
        throw new Error(
          validation.credentialFindings[0] ||
            (validation.missingEssentialFiles.length > 0
              ? `Faltan archivos esenciales en el ZIP: ${validation.missingEssentialFiles.join(', ')}`
              : 'La validación de integridad del ZIP falló.')
        );
      }

      job.status = 'ready';
      job.stageLabel = 'Archivo listo';
      job.progressPct = 100;
      job.completedAt = new Date().toISOString();
    } catch (err) {
      this.cleanupTempFile(tempPath);
      job.tempFilePath = null;
      job.status = 'error';
      job.stageLabel = 'Error de exportación';
      job.progressPct = 100;
      job.error = err instanceof Error ? err.message : 'Error inesperado al generar el ZIP.';
    }
  }

  public async validateGeneratedZip(
    zipFilePath: string,
    mode: ZipExportMode,
    warnings: string[] = []
  ): Promise<ZipValidationReport> {
    if (!fs.existsSync(zipFilePath)) {
      return {
        passed: false,
        canOpen: false,
        structureValid: false,
        essentialFilesPresent: false,
        noCredentialsIncluded: false,
        missingEssentialFiles: ESSENTIAL_FILES_BY_MODE[mode],
        credentialFindings: [],
        entryCount: 0,
        sizeBytes: 0,
        sha256: null,
        warnings,
      };
    }

    const fileBuf = fs.readFileSync(zipFilePath);
    const sha256 = crypto.createHash('sha256').update(fileBuf).digest('hex');
    let loadedZip: JSZip;
    try {
      loadedZip = await JSZip.loadAsync(fileBuf);
    } catch {
      return {
        passed: false,
        canOpen: false,
        structureValid: false,
        essentialFilesPresent: false,
        noCredentialsIncluded: false,
        missingEssentialFiles: ESSENTIAL_FILES_BY_MODE[mode],
        credentialFindings: ['El archivo ZIP está dañado y no puede abrirse.'],
        entryCount: 0,
        sizeBytes: fileBuf.byteLength,
        sha256: null,
        warnings,
      };
    }

    const fileEntries: string[] = [];
    let structureValid = true;
    const credentialFindings: string[] = [];

    for (const [entryName, entry] of Object.entries(loadedZip.files)) {
      if (
        !entryName.startsWith('VectorIA-Studio/') ||
        entryName.includes('..') ||
        entryName.includes('\\')
      ) {
        structureValid = false;
      }
      if (entry.dir) continue;
      fileEntries.push(entryName);

      const base = path.posix.basename(entryName);
      if (
        ALWAYS_EXCLUDED_FILES.has(base) ||
        (base.startsWith('.env') && base !== '.env.example') ||
        entryName.includes('/node_modules/') ||
        entryName.includes('/.git/')
      ) {
        credentialFindings.push(`Archivo o ruta prohibida dentro del ZIP: ${entryName}`);
      }

      if (isTextFile(entryName)) {
        const text = await entry.async('string');
        credentialFindings.push(...scanContentForRealSecrets(text, entryName));
      }
    }

    const entrySet = new Set(fileEntries);
    const missingEssentialFiles = ESSENTIAL_FILES_BY_MODE[mode].filter(
      (reqPath) => !entrySet.has(reqPath)
    );
    const essentialFilesPresent = missingEssentialFiles.length === 0;
    const noCredentialsIncluded = credentialFindings.length === 0;
    const passed =
      fileEntries.length > 0 &&
      structureValid &&
      essentialFilesPresent &&
      noCredentialsIncluded;

    return {
      passed,
      canOpen: true,
      structureValid,
      essentialFilesPresent,
      noCredentialsIncluded,
      missingEssentialFiles,
      credentialFindings,
      entryCount: fileEntries.length,
      sizeBytes: fileBuf.byteLength,
      sha256: passed ? sha256 : null,
      warnings,
    };
  }
}
