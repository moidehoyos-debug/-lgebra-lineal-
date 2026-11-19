import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { ProjectExporter, ZipExportMode } from './projectExporter.ts';

export type BackupFrequency = '15m' | '1h' | '6h' | '24h' | '7d';

export const BACKUP_FREQUENCY_INTERVAL_MS: Record<BackupFrequency, number> = {
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
};

export interface CloudBackupScheduleConfig {
  enabled: boolean;
  destination: 'cloud';
  frequency: BackupFrequency;
  mode: ZipExportMode;
  retentionCount: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastStatus: 'idle' | 'ok' | 'error';
  lastError: string | null;
  updatedAt: string;
}

export interface CloudBackupSnapshotEntry {
  id: string;
  filename: string;
  storageFilename: string;
  mode: ZipExportMode;
  trigger: 'scheduled' | 'manual';
  createdAt: string;
  sizeBytes: number;
  entryCount: number;
  sha256: string;
  status: 'verified';
}

interface PersistedBackupVaultState {
  schedule: CloudBackupScheduleConfig;
  snapshots: CloudBackupSnapshotEntry[];
}

export interface BackupSchedulerOptions {
  exporter: ProjectExporter;
  vaultDir?: string;
  scheduleFilePath?: string;
  startTimer?: boolean;
  tickIntervalMs?: number;
}

function isValidFrequency(value: unknown): value is BackupFrequency {
  return value === '15m' || value === '1h' || value === '6h' || value === '24h' || value === '7d';
}

function isValidExportMode(value: unknown): value is ZipExportMode {
  return value === 'full' || value === 'distribution' || value === 'backup';
}

export class BackupScheduler {
  private readonly exporter: ProjectExporter;
  private readonly vaultDir: string;
  private readonly scheduleFilePath: string;
  private state: PersistedBackupVaultState;
  private timerHandle: NodeJS.Timeout | null = null;
  private runningPromise: Promise<CloudBackupSnapshotEntry> | null = null;

  constructor(options: BackupSchedulerOptions) {
    this.exporter = options.exporter;
    const defaultDataDir = path.resolve(process.cwd(), 'data');
    this.vaultDir = path.resolve(
      options.vaultDir ?? path.join(defaultDataDir, 'scheduled-backups')
    );
    this.scheduleFilePath = path.resolve(
      options.scheduleFilePath ?? path.join(defaultDataDir, 'backup-schedule.json')
    );

    fs.mkdirSync(this.vaultDir, { recursive: true, mode: 0o700 });
    fs.mkdirSync(path.dirname(this.scheduleFilePath), { recursive: true, mode: 0o700 });

    this.state = this.loadStateFromDisk();

    const shouldStart =
      options.startTimer !== undefined ? options.startTimer : process.env.VITEST !== 'true';
    if (shouldStart) {
      const intervalMs = Math.max(5_000, options.tickIntervalMs ?? 30_000);
      this.timerHandle = setInterval(() => {
        void this.tickIfDue();
      }, intervalMs);
      this.timerHandle.unref();
    }
  }

  private createDefaultState(): PersistedBackupVaultState {
    return {
      schedule: {
        enabled: false,
        destination: 'cloud',
        frequency: '24h',
        mode: 'backup',
        retentionCount: 5,
        lastRunAt: null,
        nextRunAt: null,
        lastStatus: 'idle',
        lastError: null,
        updatedAt: new Date().toISOString(),
      },
      snapshots: [],
    };
  }

  private loadStateFromDisk(): PersistedBackupVaultState {
    try {
      if (!fs.existsSync(this.scheduleFilePath)) {
        return this.createDefaultState();
      }
      const raw = fs.readFileSync(this.scheduleFilePath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<PersistedBackupVaultState>;
      const def = this.createDefaultState();
      const s = parsed.schedule;
      const schedule: CloudBackupScheduleConfig = {
        enabled: typeof s?.enabled === 'boolean' ? s.enabled : def.schedule.enabled,
        destination: 'cloud',
        frequency: isValidFrequency(s?.frequency) ? s.frequency : def.schedule.frequency,
        mode: isValidExportMode(s?.mode) ? s.mode : def.schedule.mode,
        retentionCount:
          typeof s?.retentionCount === 'number' && Number.isFinite(s.retentionCount)
            ? Math.min(10, Math.max(2, Math.round(s.retentionCount)))
            : def.schedule.retentionCount,
        lastRunAt: typeof s?.lastRunAt === 'string' ? s.lastRunAt : null,
        nextRunAt: typeof s?.nextRunAt === 'string' ? s.nextRunAt : null,
        lastStatus:
          s?.lastStatus === 'ok' || s?.lastStatus === 'error' || s?.lastStatus === 'idle'
            ? s.lastStatus
            : 'idle',
        lastError: typeof s?.lastError === 'string' ? s.lastError : null,
        updatedAt: typeof s?.updatedAt === 'string' ? s.updatedAt : def.schedule.updatedAt,
      };

      const rawSnapshots = Array.isArray(parsed.snapshots) ? parsed.snapshots : [];
      const snapshots = rawSnapshots.filter((snap): snap is CloudBackupSnapshotEntry => {
        if (!snap || typeof snap !== 'object') return false;
        if (typeof snap.id !== 'string' || !/^cloud-bkp-\d+-[a-f0-9]{8}$/.test(snap.id)) {
          return false;
        }
        if (typeof snap.storageFilename !== 'string' || typeof snap.filename !== 'string') {
          return false;
        }
        const safePath = this.resolveVaultFile(snap.storageFilename);
        return Boolean(safePath && fs.existsSync(safePath));
      });

      return { schedule, snapshots };
    } catch {
      return this.createDefaultState();
    }
  }

  private saveStateToDisk(): void {
    try {
      fs.writeFileSync(
        this.scheduleFilePath,
        JSON.stringify(this.state, null, 2),
        { mode: 0o600 }
      );
    } catch {
      // Ignore write failures in read-only test scenarios
    }
  }

  private resolveVaultFile(storageFilename: string): string | null {
    const cleanName = path.basename(storageFilename);
    if (!cleanName || cleanName !== storageFilename || !cleanName.endsWith('.zip')) {
      return null;
    }
    const candidate = path.resolve(this.vaultDir, cleanName);
    if (!candidate.startsWith(this.vaultDir + path.sep)) {
      return null;
    }
    return candidate;
  }

  public getState(): {
    schedule: CloudBackupScheduleConfig;
    snapshots: Array<Omit<CloudBackupSnapshotEntry, 'storageFilename'>>;
    isRunning: boolean;
  } {
    return {
      schedule: { ...this.state.schedule },
      snapshots: this.state.snapshots.map(({ storageFilename: _omit, ...pub }) => pub),
      isRunning: this.runningPromise !== null,
    };
  }

  public updateSchedule(patch: {
    enabled?: unknown;
    frequency?: unknown;
    mode?: unknown;
    retentionCount?: unknown;
  }): CloudBackupScheduleConfig {
    const prev = this.state.schedule;
    const enabled = typeof patch.enabled === 'boolean' ? patch.enabled : prev.enabled;
    const frequency = isValidFrequency(patch.frequency) ? patch.frequency : prev.frequency;
    const mode = isValidExportMode(patch.mode) ? patch.mode : prev.mode;
    const retentionCount =
      typeof patch.retentionCount === 'number' && Number.isFinite(patch.retentionCount)
        ? Math.min(10, Math.max(2, Math.round(patch.retentionCount)))
        : prev.retentionCount;

    const nowMs = Date.now();
    const intervalMs = BACKUP_FREQUENCY_INTERVAL_MS[frequency];
    let nextRunAt: string | null = null;
    if (enabled) {
      if (!prev.enabled || prev.frequency !== frequency || !prev.nextRunAt) {
        nextRunAt = new Date(nowMs + intervalMs).toISOString();
      } else {
        nextRunAt = prev.nextRunAt;
      }
    }

    this.state.schedule = {
      ...prev,
      enabled,
      frequency,
      mode,
      retentionCount,
      nextRunAt,
      updatedAt: new Date(nowMs).toISOString(),
    };

    // Enforce retention cap immediately if lowered
    this.pruneOverflowSnapshots();
    this.saveStateToDisk();
    return { ...this.state.schedule };
  }

  private pruneOverflowSnapshots(): void {
    const limit = this.state.schedule.retentionCount;
    if (this.state.snapshots.length <= limit) return;
    const dropped = this.state.snapshots.splice(limit);
    for (const old of dropped) {
      const target = this.resolveVaultFile(old.storageFilename);
      if (target && fs.existsSync(target)) {
        try {
          fs.unlinkSync(target);
        } catch {
          // Ignore unlink errors
        }
      }
    }
  }

  public async tickIfDue(nowMs = Date.now()): Promise<CloudBackupSnapshotEntry | null> {
    const { enabled, nextRunAt } = this.state.schedule;
    if (!enabled || !nextRunAt || this.runningPromise) return null;
    const dueMs = Date.parse(nextRunAt);
    if (!Number.isFinite(dueMs) || nowMs < dueMs) {
      return null;
    }
    return this.runNow('scheduled');
  }

  public async runNow(
    trigger: 'scheduled' | 'manual' = 'manual'
  ): Promise<CloudBackupSnapshotEntry> {
    if (this.runningPromise) {
      return this.runningPromise;
    }

    this.runningPromise = this.executeExportAndStore(trigger);
    try {
      return await this.runningPromise;
    } finally {
      this.runningPromise = null;
    }
  }

  private async executeExportAndStore(
    trigger: 'scheduled' | 'manual'
  ): Promise<CloudBackupSnapshotEntry> {
    const mode = this.state.schedule.mode;
    const job = this.exporter.startExportJob(mode);
    const deadline = Date.now() + 45_000;

    try {
      while (Date.now() < deadline) {
        const current = this.exporter.getJob(job.jobId);
        if (!current) {
          throw new Error('El trabajo de exportación fue interrumpido antes de finalizar.');
        }
        if (current.status === 'ready') break;
        if (current.status === 'error') {
          throw new Error(current.error || 'Error al generar el respaldo del proyecto.');
        }
        await new Promise((r) => setTimeout(r, 40));
      }

      const check = this.exporter.verifyBeforeDownload(job.jobId);
      if (!check.ok || !check.job || !check.job.tempFilePath) {
        throw new Error(check.error || 'El respaldo ZIP no superó la validación de integridad.');
      }

      const verifiedJob = check.job;
      const sourceZipPath = check.job.tempFilePath;
      const snapshotId = `cloud-bkp-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      const storageFilename = `${snapshotId}.zip`;
      const destPath = this.resolveVaultFile(storageFilename);
      if (!destPath) {
        throw new Error('Ruta de bóveda inválida para almacenar el respaldo.');
      }

      const bytes = fs.readFileSync(sourceZipPath);
      fs.writeFileSync(destPath, bytes, { mode: 0o600 });

      const nowIso = new Date().toISOString();
      const entry: CloudBackupSnapshotEntry = {
        id: snapshotId,
        filename: verifiedJob.filename,
        storageFilename,
        mode,
        trigger,
        createdAt: nowIso,
        sizeBytes: verifiedJob.sizeBytes,
        entryCount: verifiedJob.fileCount,
        sha256: verifiedJob.validation?.sha256 ?? crypto.createHash('sha256').update(bytes).digest('hex'),
        status: 'verified',
      };

      this.state.snapshots.unshift(entry);
      this.pruneOverflowSnapshots();

      const intervalMs = BACKUP_FREQUENCY_INTERVAL_MS[this.state.schedule.frequency];
      this.state.schedule = {
        ...this.state.schedule,
        lastRunAt: nowIso,
        nextRunAt: this.state.schedule.enabled
          ? new Date(Date.now() + intervalMs).toISOString()
          : null,
        lastStatus: 'ok',
        lastError: null,
        updatedAt: nowIso,
      };
      this.saveStateToDisk();

      return entry;
    } catch (err) {
      const nowIso = new Date().toISOString();
      const message =
        err instanceof Error ? err.message : 'Error inesperado al ejecutar el respaldo automático.';
      const intervalMs = BACKUP_FREQUENCY_INTERVAL_MS[this.state.schedule.frequency];
      this.state.schedule = {
        ...this.state.schedule,
        lastRunAt: nowIso,
        nextRunAt: this.state.schedule.enabled
          ? new Date(Date.now() + intervalMs).toISOString()
          : null,
        lastStatus: 'error',
        lastError: message.slice(0, 240),
        updatedAt: nowIso,
      };
      this.saveStateToDisk();
      throw err;
    } finally {
      this.exporter.cleanupJob(job.jobId);
    }
  }

  public getSnapshotForDownload(snapshotId: string): {
    entry: Omit<CloudBackupSnapshotEntry, 'storageFilename'>;
    filePath: string;
  } | null {
    if (!/^cloud-bkp-\d+-[a-f0-9]{8}$/.test(snapshotId)) {
      return null;
    }
    const found = this.state.snapshots.find((s) => s.id === snapshotId);
    if (!found) return null;
    const filePath = this.resolveVaultFile(found.storageFilename);
    if (!filePath || !fs.existsSync(filePath)) {
      return null;
    }
    const { storageFilename: _omit, ...pub } = found;
    return { entry: pub, filePath };
  }

  public deleteSnapshot(snapshotId: string): boolean {
    if (!/^cloud-bkp-\d+-[a-f0-9]{8}$/.test(snapshotId)) {
      return false;
    }
    const idx = this.state.snapshots.findIndex((s) => s.id === snapshotId);
    if (idx === -1) return false;
    const [removed] = this.state.snapshots.splice(idx, 1);
    const filePath = this.resolveVaultFile(removed.storageFilename);
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        // Ignore unlink errors
      }
    }
    this.saveStateToDisk();
    return true;
  }

  public stop(): void {
    if (this.timerHandle) {
      clearInterval(this.timerHandle);
      this.timerHandle = null;
    }
  }
}
