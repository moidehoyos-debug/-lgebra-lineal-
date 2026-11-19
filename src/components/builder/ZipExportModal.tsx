import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Download,
  FileArchive,
  Loader2,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { BuilderRole } from '../../types/builder.ts';

export type ZipExportMode = 'full' | 'distribution' | 'backup';

interface ZipValidationSummary {
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

interface ZipJobState {
  jobId: string;
  mode: ZipExportMode;
  status: 'preparing' | 'compressing' | 'validating' | 'ready' | 'error';
  stageLabel: string;
  progressPct: number;
  filename: string;
  createdAt: string;
  completedAt: string | null;
  fileCount: number;
  sizeBytes: number;
  validation: ZipValidationSummary | null;
  error: string | null;
}

interface ZipExportModalProps {
  open: boolean;
  token: string;
  role: BuilderRole;
  onClose: () => void;
  onExportCompleted?: (filename: string, mode: ZipExportMode, sizeBytes: number) => void;
}

const MODE_OPTIONS: Array<{
  id: ZipExportMode;
  badge: string;
  title: string;
  subtitle: string;
  includes: string[];
  excludes: string[];
}> = [
  {
    id: 'full',
    badge: 'Modalidad A',
    title: 'ZIP Completo del Proyecto',
    subtitle:
      'Código fuente íntegro para reconstruir, instalar, configurar y ejecutar VectorIA Studio en cualquier entorno.',
    includes: [
      'src/, server/, server.ts, public/, tests/, docs/',
      'Documentación: AGENTS.md, PRD.md, DESIGN.md, BITACORA.md, ARCHITECTURE.md, ROADMAP.md',
      'package.json, tsconfig.json, vite.config.ts, README.md y .env.example',
    ],
    excludes: [
      'node_modules/, .git/, dist/, cachés (.vite, coverage)',
      'Archivos .env reales, contraseñas, tokens y claves API',
    ],
  },
  {
    id: 'distribution',
    badge: 'Modalidad B',
    title: 'ZIP de Distribución',
    subtitle:
      'Artefactos preparados para desplegar la aplicación en Node.js 22 ESM con el mínimo footprint operativo.',
    includes: [
      'dist/ compilado (si está generado), server.ts y server/',
      'Motores y tipos esenciales (src/engines/, src/types/, src/utils/)',
      'public/, package.json, tsconfig.json, ARCHITECTURE.md, .env.example y RESTORE_GUIDE.md',
    ],
    excludes: [
      'Pruebas (tests/), código UI sin compilar, node_modules/ y .git/',
      'Credenciales, .env reales y datos locales privados',
    ],
  },
  {
    id: 'backup',
    badge: 'Modalidad C',
    title: 'ZIP de Respaldo',
    subtitle:
      'Instantánea completa de proyecto, documentación y configuración visual publicada del Builder saneada para restauración.',
    includes: [
      'Proyecto completo + toda la documentación técnica',
      'data/vectoria-builder.sanitized.json (páginas, módulos y presets sin hashes ni secretos)',
      'RESTORE_GUIDE.md con pasos verificados de recuperación',
    ],
    excludes: [
      'adminHash, editorHash y signingSecret del servidor',
      'node_modules/, .git/, .env reales, logs y archivos temporales',
    ],
  },
];

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const ZipExportModal: React.FC<ZipExportModalProps> = ({
  open,
  token,
  role,
  onClose,
  onExportCompleted,
}) => {
  const [selectedMode, setSelectedMode] = useState<ZipExportMode>('full');
  const [job, setJob] = useState<ZipJobState | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const pollTimerRef = useRef<number | null>(null);

  const stopPolling = () => {
    if (pollTimerRef.current !== null) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  useEffect(() => {
    if (!open) {
      stopPolling();
    }
    return () => stopPolling();
  }, [open]);

  if (!open) return null;

  const isAdmin = role === 'admin';
  const isGenerating =
    job !== null &&
    (job.status === 'preparing' ||
      job.status === 'compressing' ||
      job.status === 'validating');

  const pollJobStatus = async (jobId: string) => {
    try {
      const res = await fetch(`/api/builder/export-zip/${encodeURIComponent(jobId)}/status`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = (await res.json()) as ZipJobState & { message?: string };
      if (!res.ok) {
        setRequestError(data.message || 'No se pudo consultar el progreso de exportación.');
        return;
      }
      setJob(data);
      if (data.status === 'ready' || data.status === 'error') {
        stopPolling();
        return;
      }
      pollTimerRef.current = window.setTimeout(() => {
        void pollJobStatus(jobId);
      }, 250);
    } catch {
      setRequestError('Error de red al consultar el estado del archivo ZIP.');
      stopPolling();
    }
  };

  const cleanupServerJob = async (jobId: string | undefined) => {
    if (!jobId || !token) return;
    try {
      await fetch(`/api/builder/export-zip/${encodeURIComponent(jobId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // Ignore network errors during best-effort temp cleanup
    }
  };

  const handleCloseModal = () => {
    stopPolling();
    if (job?.jobId) {
      void cleanupServerJob(job.jobId);
    }
    onClose();
  };

  const handleStartExport = async () => {
    if (!isAdmin || isGenerating) return;
    stopPolling();
    if (job?.jobId) {
      void cleanupServerJob(job.jobId);
    }
    setRequestError(null);
    setJob(null);

    try {
      const res = await fetch('/api/builder/export-zip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ mode: selectedMode }),
      });
      const data = (await res.json()) as ZipJobState & { message?: string };
      if (!res.ok) {
        setRequestError(data.message || 'No se pudo iniciar la generación del ZIP.');
        return;
      }
      setJob({
        ...data,
        completedAt: null,
        fileCount: 0,
        sizeBytes: 0,
        validation: null,
        error: null,
      });
      pollTimerRef.current = window.setTimeout(() => {
        void pollJobStatus(data.jobId);
      }, 200);
    } catch {
      setRequestError('No fue posible conectar con el backend para generar el ZIP.');
    }
  };

  const handleDownloadZip = async () => {
    if (!job || job.status !== 'ready' || !job.validation?.passed || downloading) return;
    setDownloading(true);
    setRequestError(null);
    try {
      const res = await fetch(
        `/api/builder/export-zip/${encodeURIComponent(job.jobId)}/download`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as { message?: string };
        setRequestError(
          errData.message || 'No se pudo descargar el archivo ZIP validado.'
        );
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = job.filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      onExportCompleted?.(job.filename, job.mode, job.sizeBytes);
    } catch {
      setRequestError('Ocurrió un error al descargar el archivo ZIP.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="zip-export-modal-title"
      className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="surface-card rounded-2xl max-w-4xl w-full p-5 sm:p-6 space-y-5 border border-[var(--border-hairline)] my-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-3 border-b border-[var(--border-hairline)]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)] shrink-0">
              <FileArchive className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="zip-export-modal-title"
                className="text-base sm:text-lg font-bold text-[var(--text-primary)] truncate"
              >
                Exportar Proyecto VectorIA Studio (.ZIP)
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Generación protegida en servidor, verificación de integridad y exclusión automática de secretos.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCloseModal}
            aria-label="Cerrar ventana de exportación ZIP"
            className="p-2 rounded-lg surface-elevated border border-[var(--border-hairline)] hover:border-[var(--accent-primary)] text-[var(--text-muted)] cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!isAdmin && (
          <div
            role="alert"
            className="rounded-xl p-3.5 bg-[var(--status-warn)]/10 border border-[var(--status-warn)]/30 text-xs text-[var(--status-warn)] flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              Solo los usuarios con rol <strong>Administrador</strong> pueden generar y descargar paquetes completos del proyecto.
            </span>
          </div>
        )}

        {/* Three Export Modes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {MODE_OPTIONS.map((opt) => {
            const active = selectedMode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                disabled={isGenerating}
                onClick={() => setSelectedMode(opt.id)}
                className={`text-left rounded-xl p-4 border transition-colors flex flex-col justify-between gap-3 cursor-pointer disabled:opacity-60 ${
                  active
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)]/50 ring-1 ring-[var(--accent-primary)]'
                    : 'surface-elevated border-[var(--border-hairline)] hover:border-[var(--border-strong)]'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--bg-card)] border border-[var(--border-hairline)] text-[var(--accent-primary)] whitespace-nowrap">
                      {opt.badge}
                    </span>
                    {active && <CheckCircle2 className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />}
                  </div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">{opt.title}</h3>
                  <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                    {opt.subtitle}
                  </p>
                </div>

                <div className="space-y-2 pt-2 border-t border-[var(--border-hairline)] text-[11px]">
                  <div>
                    <div className="font-semibold text-[var(--status-ok)] mb-1">Incluye:</div>
                    <ul className="space-y-0.5 text-[var(--text-muted)] list-disc list-inside">
                      {opt.includes.map((item) => (
                        <li key={item} className="leading-snug">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="font-semibold text-[var(--status-warn)] mb-1">Excluye:</div>
                    <ul className="space-y-0.5 text-[var(--text-muted)] list-disc list-inside">
                      {opt.excludes.map((item) => (
                        <li key={item} className="leading-snug">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Error Banner */}
        {(requestError || job?.status === 'error') && (
          <div
            role="alert"
            className="rounded-xl p-3.5 bg-[var(--status-err)]/10 border border-[var(--status-err)]/30 text-xs text-[var(--status-err)] flex items-start gap-2.5"
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Error de exportación</div>
              <div className="mt-0.5">{requestError || job?.error}</div>
            </div>
          </div>
        )}

        {/* Progress & Validation Card */}
        {job && (
          <div className="surface-elevated rounded-xl p-4 border border-[var(--border-hairline)] space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-primary)]" />
                ) : job.status === 'ready' ? (
                  <CheckCircle2 className="w-4 h-4 text-[var(--status-ok)]" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-[var(--status-err)]" />
                )}
                <span>{job.stageLabel}</span>
              </div>
              <span className="font-mono text-[var(--text-muted)] tabular-nums">
                {job.progressPct}%
              </span>
            </div>

            <div className="w-full h-2 rounded-full bg-[var(--bg-card)] overflow-hidden border border-[var(--border-hairline)]">
              <div
                className={`h-full transition-all duration-300 ${
                  job.status === 'error'
                    ? 'bg-[var(--status-err)]'
                    : job.status === 'ready'
                      ? 'bg-[var(--status-ok)]'
                      : 'bg-[var(--accent-primary)]'
                }`}
                style={{ width: `${job.progressPct}%` }}
              />
            </div>

            {job.status === 'ready' && job.validation && (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="rounded-lg p-2.5 bg-[var(--bg-card)] border border-[var(--border-hairline)]">
                    <div className="text-[10px] text-[var(--text-muted)] uppercase">Tamaño ZIP</div>
                    <div className="font-mono font-bold text-[var(--text-primary)] tabular-nums mt-0.5">
                      {formatBytes(job.sizeBytes)}
                    </div>
                  </div>
                  <div className="rounded-lg p-2.5 bg-[var(--bg-card)] border border-[var(--border-hairline)]">
                    <div className="text-[10px] text-[var(--text-muted)] uppercase">Archivos</div>
                    <div className="font-mono font-bold text-[var(--text-primary)] tabular-nums mt-0.5">
                      {job.validation.entryCount}
                    </div>
                  </div>
                  <div className="rounded-lg p-2.5 bg-[var(--bg-card)] border border-[var(--border-hairline)]">
                    <div className="text-[10px] text-[var(--text-muted)] uppercase">Validación</div>
                    <div
                      className={`font-semibold mt-0.5 ${
                        job.validation.passed
                          ? 'text-[var(--status-ok)]'
                          : 'text-[var(--status-err)]'
                      }`}
                    >
                      {job.validation.passed ? 'Íntegro y seguro' : 'Fallida'}
                    </div>
                  </div>
                  <div className="rounded-lg p-2.5 bg-[var(--bg-card)] border border-[var(--border-hairline)]">
                    <div className="text-[10px] text-[var(--text-muted)] uppercase">Generado</div>
                    <div className="font-mono text-[11px] text-[var(--text-primary)] tabular-nums mt-0.5 truncate">
                      {new Date(job.completedAt ?? job.createdAt).toLocaleString('es-MX')}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  {[
                    { ok: job.validation.canOpen, label: 'Archivo ZIP legible y descomprimible' },
                    { ok: job.validation.structureValid, label: 'Estructura interna VectorIA-Studio/ válida' },
                    { ok: job.validation.essentialFilesPresent, label: 'Archivos esenciales verificados' },
                    { ok: job.validation.noCredentialsIncluded, label: 'Cero credenciales ni secretos incluidos' },
                  ].map((check) => (
                    <div
                      key={check.label}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-hairline)]"
                    >
                      <ShieldCheck
                        className={`w-3.5 h-3.5 shrink-0 ${
                          check.ok ? 'text-[var(--status-ok)]' : 'text-[var(--status-err)]'
                        }`}
                      />
                      <span className="text-[var(--text-secondary)]">{check.label}</span>
                    </div>
                  ))}
                </div>

                {job.validation.sha256 && (
                  <div className="text-[11px] font-mono text-[var(--text-muted)] bg-[var(--bg-card)] border border-[var(--border-hairline)] rounded-lg px-2.5 py-1.5 truncate">
                    SHA-256: <span className="text-[var(--text-primary)]">{job.validation.sha256}</span>
                  </div>
                )}

                {job.validation.warnings.length > 0 && (
                  <div className="rounded-lg p-2.5 bg-[var(--status-warn)]/10 border border-[var(--status-warn)]/30 text-[11px] text-[var(--status-warn)] space-y-1">
                    {job.validation.warnings.map((w) => (
                      <div key={w}>• {w}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[var(--border-hairline)]">
          <div className="text-[11px] text-[var(--text-muted)]">
            Archivo temporal aislado con limpieza automática tras descarga o expiración.
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCloseModal}
              className="px-3.5 py-2 rounded-lg surface-elevated border border-[var(--border-hairline)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer whitespace-nowrap"
            >
              Cerrar
            </button>

            <button
              type="button"
              disabled={!isAdmin || isGenerating}
              onClick={() => void handleStartExport()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg surface-elevated border border-[var(--border-strong)] hover:border-[var(--accent-primary)] text-xs font-semibold text-[var(--text-primary)] disabled:opacity-45 cursor-pointer whitespace-nowrap"
            >
              <Archive className="w-3.5 h-3.5" />
              {isGenerating ? 'Generando ZIP...' : job ? 'Regenerar ZIP' : 'Generar ZIP'}
            </button>

            {job?.status === 'ready' && job.validation?.passed && (
              <button
                type="button"
                disabled={downloading}
                onClick={() => void handleDownloadZip()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-contrast)] text-xs font-semibold disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                {downloading ? 'Descargando...' : 'Descargar ZIP'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
