import type { ZipExportModality } from '../services/zipExportService';

export type BackupDestination = 'cloud' | 'local';
export type BackupFrequency = '15m' | '1h' | '6h' | '24h' | '7d';
export type LocalBackupFormat = 'zip-backend' | 'json-secure';

export interface BackupFrequencyOption {
  id: BackupFrequency;
  label: string;
  shortLabel: string;
  intervalMs: number;
  description: string;
}

export const BACKUP_FREQUENCY_OPTIONS: BackupFrequencyOption[] = [
  {
    id: '15m',
    label: 'Cada 15 minutos',
    shortLabel: '15 min',
    intervalMs: 15 * 60 * 1000,
    description: 'Ideal durante sesiones intensivas de entrenamiento o edición.',
  },
  {
    id: '1h',
    label: 'Cada 1 hora',
    shortLabel: '1 hora',
    intervalMs: 60 * 60 * 1000,
    description: 'Balance recomendado entre continuidad y almacenamiento.',
  },
  {
    id: '6h',
    label: 'Cada 6 horas',
    shortLabel: '6 horas',
    intervalMs: 6 * 60 * 60 * 1000,
    description: 'Múltiples puntos de restauración diarios.',
  },
  {
    id: '24h',
    label: 'Diario (cada 24 horas)',
    shortLabel: '24 horas',
    intervalMs: 24 * 60 * 60 * 1000,
    description: 'Respaldo diario automático sin saturar la bóveda.',
  },
  {
    id: '7d',
    label: 'Semanal (cada 7 días)',
    shortLabel: '7 días',
    intervalMs: 7 * 24 * 60 * 60 * 1000,
    description: 'Instantánea semanal consolidada del proyecto.',
  },
];

export const LOCAL_BACKUP_SCHEDULE_STORAGE_KEY = 'vectoria-local-backup-schedule-v1';

export interface LocalBackupRunEntry {
  id: string;
  timestamp: string;
  trigger: 'scheduled' | 'manual';
  format: LocalBackupFormat;
  mode: ZipExportModality;
  filename: string;
  sizeBytes: number;
  status: 'ok' | 'error';
  detail: string;
}

export interface LocalBackupScheduleConfig {
  enabled: boolean;
  frequency: BackupFrequency;
  mode: ZipExportModality;
  localFormat: LocalBackupFormat;
  autoDownload: boolean;
  retentionCount: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastStatus: 'idle' | 'ok' | 'error';
  lastError: string | null;
  history: LocalBackupRunEntry[];
}

export interface CloudBackupScheduleState {
  enabled: boolean;
  destination: 'cloud';
  frequency: BackupFrequency;
  mode: ZipExportModeCompat;
  retentionCount: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastStatus: 'idle' | 'ok' | 'error';
  lastError: string | null;
  updatedAt: string;
}

type ZipExportModeCompat = ZipExportModality;

export interface CloudBackupSnapshotItem {
  id: string;
  filename: string;
  mode: ZipExportModality;
  trigger: 'scheduled' | 'manual';
  createdAt: string;
  sizeBytes: number;
  entryCount: number;
  sha256: string;
  status: 'verified';
}

export interface CloudBackupStateResponse {
  schedule: CloudBackupScheduleState;
  snapshots: CloudBackupSnapshotItem[];
  isRunning: boolean;
}

export function getFrequencyIntervalMs(frequency: BackupFrequency): number {
  return (
    BACKUP_FREQUENCY_OPTIONS.find((opt) => opt.id === frequency)?.intervalMs ??
    24 * 60 * 60 * 1000
  );
}

export function computeNextBackupRunIso(
  frequency: BackupFrequency,
  fromMs = Date.now()
): string {
  return new Date(fromMs + getFrequencyIntervalMs(frequency)).toISOString();
}

export function isBackupDue(
  schedule: Pick<LocalBackupScheduleConfig, 'enabled' | 'nextRunAt'>,
  nowMs = Date.now()
): boolean {
  if (!schedule.enabled || !schedule.nextRunAt) return false;
  const dueAt = Date.parse(schedule.nextRunAt);
  return Number.isFinite(dueAt) && nowMs >= dueAt;
}

export function createDefaultLocalBackupSchedule(): LocalBackupScheduleConfig {
  return {
    enabled: false,
    frequency: '1h',
    mode: 'backup',
    localFormat: 'json-secure',
    autoDownload: true,
    retentionCount: 5,
    lastRunAt: null,
    nextRunAt: null,
    lastStatus: 'idle',
    lastError: null,
    history: [],
  };
}

export function loadLocalBackupSchedule(
  storage?: Pick<Storage, 'getItem'> | null
): LocalBackupScheduleConfig {
  const def = createDefaultLocalBackupSchedule();
  try {
    const store = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    if (!store) return def;
    const raw = store.getItem(LOCAL_BACKUP_SCHEDULE_STORAGE_KEY);
    if (!raw) return def;
    const parsed = JSON.parse(raw) as Partial<LocalBackupScheduleConfig>;
    const validFreq = BACKUP_FREQUENCY_OPTIONS.some((o) => o.id === parsed.frequency)
      ? (parsed.frequency as BackupFrequency)
      : def.frequency;
    const validMode: ZipExportModality =
      parsed.mode === 'full' || parsed.mode === 'distribution' || parsed.mode === 'backup'
        ? parsed.mode
        : def.mode;
    const validFormat: LocalBackupFormat =
      parsed.localFormat === 'zip-backend' || parsed.localFormat === 'json-secure'
        ? parsed.localFormat
        : def.localFormat;
    const retentionCount =
      typeof parsed.retentionCount === 'number' && Number.isFinite(parsed.retentionCount)
        ? Math.min(10, Math.max(2, Math.round(parsed.retentionCount)))
        : def.retentionCount;

    const history = Array.isArray(parsed.history)
      ? parsed.history
          .filter(
            (h): h is LocalBackupRunEntry =>
              Boolean(h) &&
              typeof h.id === 'string' &&
              typeof h.timestamp === 'string' &&
              typeof h.filename === 'string'
          )
          .slice(0, retentionCount)
      : [];

    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : def.enabled,
      frequency: validFreq,
      mode: validMode,
      localFormat: validFormat,
      autoDownload: typeof parsed.autoDownload === 'boolean' ? parsed.autoDownload : def.autoDownload,
      retentionCount,
      lastRunAt: typeof parsed.lastRunAt === 'string' ? parsed.lastRunAt : null,
      nextRunAt: typeof parsed.nextRunAt === 'string' ? parsed.nextRunAt : null,
      lastStatus:
        parsed.lastStatus === 'ok' || parsed.lastStatus === 'error' || parsed.lastStatus === 'idle'
          ? parsed.lastStatus
          : 'idle',
      lastError: typeof parsed.lastError === 'string' ? parsed.lastError : null,
      history,
    };
  } catch {
    return def;
  }
}

export function saveLocalBackupSchedule(
  config: LocalBackupScheduleConfig,
  storage?: Pick<Storage, 'setItem'> | null
): void {
  try {
    const store = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    if (!store) return;
    const trimmed: LocalBackupScheduleConfig = {
      ...config,
      history: config.history.slice(0, Math.max(2, Math.min(10, config.retentionCount))),
    };
    store.setItem(LOCAL_BACKUP_SCHEDULE_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Ignore restricted storage environments
  }
}

export function appendLocalBackupHistory(
  config: LocalBackupScheduleConfig,
  entry: LocalBackupRunEntry
): LocalBackupScheduleConfig {
  const limit = Math.max(2, Math.min(10, config.retentionCount));
  return {
    ...config,
    lastRunAt: entry.timestamp,
    nextRunAt: config.enabled ? computeNextBackupRunIso(config.frequency) : null,
    lastStatus: entry.status,
    lastError: entry.status === 'error' ? entry.detail : null,
    history: [entry, ...config.history].slice(0, limit),
  };
}

export function formatTimeUntilIso(iso: string | null, nowMs = Date.now()): string {
  if (!iso) return 'Sin programar';
  const targetMs = Date.parse(iso);
  if (!Number.isFinite(targetMs)) return 'Sin programar';
  const diffSec = Math.max(0, Math.round((targetMs - nowMs) / 1000));
  if (diffSec < 60) return `en ${diffSec} s`;
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `en ${mins} min`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hrs < 24) return remMins > 0 ? `en ${hrs} h ${remMins} min` : `en ${hrs} h`;
  const days = Math.floor(hrs / 24);
  return `en ${days} d`;
}

// -----------------------------------------------------------------------------
// Protected Cloud Vault API Client (/api/backup/*)
// -----------------------------------------------------------------------------

export async function fetchCloudBackupState(token: string): Promise<CloudBackupStateResponse> {
  const res = await fetch('/api/backup/schedule', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || data.error || 'No se pudo consultar la programación en la nube.');
  }
  return data as CloudBackupStateResponse;
}

export async function updateCloudBackupSchedule(
  token: string,
  patch: {
    enabled: boolean;
    frequency: BackupFrequency;
    mode: ZipExportModality;
    retentionCount: number;
  }
): Promise<CloudBackupStateResponse> {
  const res = await fetch('/api/backup/schedule', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(patch),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || data.error || 'No se pudo guardar la programación en la nube.');
  }
  return data as CloudBackupStateResponse;
}

export async function triggerCloudBackupNow(token: string): Promise<{
  snapshot: CloudBackupSnapshotItem;
  state: CloudBackupStateResponse;
}> {
  const res = await fetch('/api/backup/run', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || data.error || 'No se pudo ejecutar el respaldo en la nube.');
  }
  return data as { snapshot: CloudBackupSnapshotItem; state: CloudBackupStateResponse };
}

export async function downloadCloudBackupSnapshot(
  token: string,
  snapshotId: string,
  fallbackFilename: string
): Promise<void> {
  const res = await fetch(`/api/backup/snapshots/${encodeURIComponent(snapshotId)}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'No se pudo descargar la copia almacenada en la nube.');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fallbackFilename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function deleteCloudBackupSnapshot(
  token: string,
  snapshotId: string
): Promise<CloudBackupStateResponse> {
  const res = await fetch(`/api/backup/snapshots/${encodeURIComponent(snapshotId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || 'No se pudo eliminar la copia seleccionada.');
  }
  return data as CloudBackupStateResponse;
}
