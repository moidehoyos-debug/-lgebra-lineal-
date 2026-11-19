import { getMnist784Meta } from '../engines/mnist784Engine';
import type { NeuralSuite } from '../engines/neuralEngine';
import {
  exportProjectZipViaBackend,
  formatZipByteSize,
  triggerZipBrowserDownload,
} from './zipExportService';
import type {
  ClassifierMode,
  Didactic232StepResult,
  Mnist784PerturbationConfig,
  Mnist784PerturbationResult,
  PredictionRecord,
  SimulationExperimentConfig,
  SimulationRunRecord,
  TechnicalReportRecord,
  ThemeId,
} from '../types/vectoria';
import {
  buildSecureExperimentsAndModelsExport,
  WorkspaceUserProfile,
} from '../utils/backupVersioning';
import type {
  LocalBackupRunEntry,
  LocalBackupScheduleConfig,
} from '../utils/scheduledBackup';

export interface LocalScheduledBackupParams {
  schedule: LocalBackupScheduleConfig;
  trigger: 'scheduled' | 'manual';
  theme: ThemeId;
  classifierMode: ClassifierMode;
  userProfile: WorkspaceUserProfile;
  sharedMatrix2D: number[][];
  simulationConfig: SimulationExperimentConfig;
  simulationHistory: SimulationRunRecord[];
  predictionHistory: PredictionRecord[];
  mnist784PerturbConfig: Mnist784PerturbationConfig;
  mnist784PerturbResult: Mnist784PerturbationResult | null;
  last232Step: Didactic232StepResult | null;
  reportHistory: TechnicalReportRecord[];
  suite: NeuralSuite;
  token?: string | null;
  role?: string | null;
  createManualBackupSnapshot: (reason?: string) => unknown;
}

export async function executeLocalBackupExport(
  params: LocalScheduledBackupParams
): Promise<LocalBackupRunEntry> {
  const { schedule, trigger } = params;
  const runId = `loc-bkp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const nowIso = new Date().toISOString();

  // Always preserve an internal rotating browser snapshot before exporting
  params.createManualBackupSnapshot(
    trigger === 'scheduled'
      ? `Respaldo local automático (${schedule.frequency})`
      : `Respaldo local manual (${schedule.mode})`
  );

  if (schedule.localFormat === 'zip-backend') {
    if (!params.token || params.role !== 'admin') {
      return {
        id: runId,
        timestamp: nowIso,
        trigger,
        format: 'zip-backend',
        mode: schedule.mode,
        filename: 'sin-exportar.zip',
        sizeBytes: 0,
        status: 'error',
        detail:
          'Requiere sesión Administrador activa para exportar el proyecto completo en formato .ZIP.',
      };
    }

    try {
      const exported = await exportProjectZipViaBackend({
        mode: schedule.mode,
        token: params.token,
      });

      if (schedule.autoDownload && typeof document !== 'undefined') {
        triggerZipBrowserDownload(exported.blob, exported.filename);
      }

      return {
        id: runId,
        timestamp: nowIso,
        trigger,
        format: 'zip-backend',
        mode: schedule.mode,
        filename: exported.filename,
        sizeBytes: exported.sizeBytes,
        status: 'ok',
        detail: `${formatZipByteSize(exported.sizeBytes)} · ${exported.entryCount} archivos${schedule.autoDownload ? ' · Descargado' : ' · Verificado sin descarga'}`,
      };
    } catch (err) {
      return {
        id: runId,
        timestamp: nowIso,
        trigger,
        format: 'zip-backend',
        mode: schedule.mode,
        filename: 'error-exportacion.zip',
        sizeBytes: 0,
        status: 'error',
        detail:
          err instanceof Error
            ? err.message
            : 'No fue posible generar el respaldo ZIP programado.',
      };
    }
  }

  // Format: 'json-secure' (client-side experiments, models & configuration with SHA-256)
  try {
    const meta784 = getMnist784Meta();
    const { archive, jsonText, byteSize } = await buildSecureExperimentsAndModelsExport({
      theme: params.theme,
      classifierMode: params.classifierMode,
      userProfile: params.userProfile,
      sharedMatrix2D: params.sharedMatrix2D,
      simulationConfig: params.simulationConfig,
      simulationHistory: params.simulationHistory,
      predictionHistory: params.predictionHistory,
      mnist784PerturbConfig: params.mnist784PerturbConfig,
      mnist784PerturbResult: params.mnist784PerturbResult,
      last232Step: params.last232Step,
      reportHistory: params.reportHistory,
      includeWeights: true,
      digitsModelState: params.suite.digitsModel.exportSerializedState(true),
      lettersModelState: params.suite.lettersModel.exportSerializedState(true),
      alphanumericModelState: params.suite.alphanumericModel.exportSerializedState(true),
      mnist784ReadOnlySummary: {
        architecture: '784 → 128 (ReLU) → 10 (Softmax)',
        parameters: meta784.parametros,
        syntheticEvalTotal: meta784.evaluacion.total,
        syntheticEvalCorrect: meta784.evaluacion.correctos,
        syntheticEvalAccuracy: meta784.evaluacion.exactitud,
      },
    });

    const slug = archive.exportedAt.slice(0, 19).replace(/[:T]/g, '-');
    const filename = `vectoria_respaldo_auto_${slug}.json`;

    if (schedule.autoDownload && typeof document !== 'undefined') {
      const blob = new Blob([jsonText], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }

    return {
      id: runId,
      timestamp: nowIso,
      trigger,
      format: 'json-secure',
      mode: schedule.mode,
      filename,
      sizeBytes: byteSize,
      status: 'ok',
      detail: `${(byteSize / 1024).toFixed(1)} KB · ${archive.integrity.algorithm} ${archive.integrity.digest.slice(0, 10)}…${schedule.autoDownload ? ' · Descargado' : ' · Ranura local'}`,
    };
  } catch (err) {
    return {
      id: runId,
      timestamp: nowIso,
      trigger,
      format: 'json-secure',
      mode: schedule.mode,
      filename: 'error-respaldo.json',
      sizeBytes: 0,
      status: 'error',
      detail:
        err instanceof Error
          ? err.message
          : 'No fue posible generar el respaldo local en JSON.',
    };
  }
}
