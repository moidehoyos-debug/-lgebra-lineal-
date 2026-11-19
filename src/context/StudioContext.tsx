import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { rasterizeGlyph } from '../engines/alphanumericDataset';
import {
  BackpropStepReport,
  createInitialNeuralSuite,
  NeuralSuite,
} from '../engines/neuralEngine';
import {
  DEFAULT_MNIST_PERTURB_CONFIG,
  downsample28x28To16x16,
  getMnist784ExamplePixels,
  infer784,
  runMnist784PerturbationComparison,
} from '../engines/mnist784Engine';
import {
  ApiLatencyRecord,
  ClassifierMode,
  Didactic232StepResult,
  MathOperationOutput,
  Mnist784InferenceResult,
  Mnist784PerturbationConfig,
  Mnist784PerturbationResult,
  ModelEvaluationSummary,
  ModuleId,
  OmniMessage,
  PredictionRecord,
  SimulationExperimentConfig,
  SimulationRunRecord,
  SystemEventRecord,
  TechnicalReportRecord,
} from '../types/vectoria';
import {
  persistQuickStartDismissed,
  shouldShowQuickStartGuide,
} from '../components/QuickStartGuide';
import {
  BACKUP_SCHEMA_VERSION,
  ExperimentsAndModelsExport,
  loadBackupSnapshots,
  saveBackupSnapshot,
  VECTORIA_VERSION,
  WorkspaceBackupPayload,
  WorkspaceBackupSnapshot,
  WorkspaceUserProfile,
} from '../utils/backupVersioning';
import { useTheme } from './ThemeContext';
import { geminiService } from '../services/geminiService';
import { measureRuntimeMemorySnapshot } from '../utils/dashboardMetrics';
import {
  appendLocalBackupHistory,
  computeNextBackupRunIso,
  loadLocalBackupSchedule,
  LocalBackupRunEntry,
  LocalBackupScheduleConfig,
  saveLocalBackupSchedule,
} from '../utils/scheduledBackup';

const API_LATENCY_STORAGE_KEY = 'vectoria-api-latency-history-v1';
const SIMULATION_HISTORY_STORAGE_KEY = 'vectoria-simulation-history-v1';

function loadSimulationHistory(): SimulationRunRecord[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = window.localStorage.getItem(SIMULATION_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is SimulationRunRecord =>
          Boolean(item) &&
          typeof item.id === 'string' &&
          typeof item.timestamp === 'string' &&
          typeof item.title === 'string' &&
          typeof item.durationMs === 'number' &&
          Number.isFinite(item.durationMs)
      )
      .slice(0, 30);
  } catch {
    return [];
  }
}

function saveSimulationHistory(items: SimulationRunRecord[]): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SIMULATION_HISTORY_STORAGE_KEY, JSON.stringify(items.slice(0, 30)));
  } catch {
    // Ignore storage errors
  }
}

function loadApiLatencyHistory(): ApiLatencyRecord[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = window.localStorage.getItem(API_LATENCY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is ApiLatencyRecord =>
          Boolean(item) &&
          typeof item.id === 'string' &&
          typeof item.endpoint === 'string' &&
          typeof item.latencyMs === 'number' &&
          Number.isFinite(item.latencyMs)
      )
      .slice(0, 40);
  } catch {
    return [];
  }
}

function saveApiLatencyHistory(items: ApiLatencyRecord[]): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(API_LATENCY_STORAGE_KEY, JSON.stringify(items.slice(0, 40)));
  } catch {
    // Ignore storage errors
  }
}

interface TrainingProgress {
  isTraining: boolean;
  targetMode: ClassifierMode | null;
  currentEpoch: number;
  totalEpochs: number;
}

interface StudioContextValue {
  activeModule: ModuleId;
  setActiveModule: (module: ModuleId) => void;
  classifierMode: ClassifierMode;
  setClassifierMode: (mode: ClassifierMode) => void;
  currentInputGrid: number[];
  setCurrentInputGrid: (grid: number[]) => void;
  lastPrediction: PredictionRecord | null;
  predictionHistory: PredictionRecord[];
  classifyGrid: (grid: number[], modeOverride?: ClassifierMode) => PredictionRecord | null;
  loadSampleGlyph: (label: string, modeOverride?: ClassifierMode) => void;
  trainAlphanumericModel: (epochs?: number) => Promise<void>;
  retrainMode: (mode: ClassifierMode, epochs?: number, lr?: number) => Promise<void>;
  runSingleBackpropStep: (targetLabel: string, lr: number, momentum: number) => BackpropStepReport;
  trainingProgress: TrainingProgress;
  digitsSummary: ModelEvaluationSummary;
  lettersSummary: ModelEvaluationSummary;
  alphanumericSummary: ModelEvaluationSummary;
  suiteRef: React.MutableRefObject<NeuralSuite>;
  lastMathOutput: MathOperationOutput | null;
  setLastMathOutput: (out: MathOperationOutput) => void;
  omniMessages: OmniMessage[];
  addOmniMessage: (msg: OmniMessage) => void;
  clearOmniMessages: () => void;
  simulationConfig: SimulationExperimentConfig;
  setSimulationConfig: React.Dispatch<React.SetStateAction<SimulationExperimentConfig>>;
  simulationHistory: SimulationRunRecord[];
  addSimulationRun: (run: SimulationRunRecord) => void;
  clearSimulationHistory: () => void;
  sendExperimentToTopology: (grid: number[], mode: ClassifierMode) => void;
  askOmniAboutExperiment: (summaryPrompt: string) => void;
  systemEvents: SystemEventRecord[];
  logEvent: (
    category: SystemEventRecord['category'],
    title: string,
    detail: string,
    status?: SystemEventRecord['status']
  ) => void;
  reportHistory: TechnicalReportRecord[];
  addReportRecord: (report: TechnicalReportRecord) => void;
  sharedMatrix2D: number[][];
  setSharedMatrix2D: (m: number[][]) => void;
  mnist784Pixels: number[];
  setMnist784Pixels: (pixels: number[]) => void;
  mnist784Result: Mnist784InferenceResult | null;
  mnist784SourceLabel: string;
  runMnist784Inference: (pixels: number[], sourceLabel?: string) => Mnist784InferenceResult | null;
  loadMnist784Example: (digit: number) => void;
  mnist784PerturbConfig: Mnist784PerturbationConfig;
  setMnist784PerturbConfig: React.Dispatch<React.SetStateAction<Mnist784PerturbationConfig>>;
  mnist784PerturbResult: Mnist784PerturbationResult | null;
  runMnist784Perturbation: (override?: Mnist784PerturbationConfig) => Mnist784PerturbationResult | null;
  last232Step: Didactic232StepResult | null;
  setLast232Step: (step: Didactic232StepResult | null) => void;
  sendMnist784ToTopology: (pixels: number[]) => void;
  userProfile: WorkspaceUserProfile;
  setUserProfile: React.Dispatch<React.SetStateAction<WorkspaceUserProfile>>;
  backupSnapshots: WorkspaceBackupSnapshot[];
  createManualBackupSnapshot: (reason?: string) => WorkspaceBackupSnapshot;
  restoreFromBackupPayload: (payload: WorkspaceBackupPayload) => void;
  restoreFromExperimentsAndModelsArchive: (archive: ExperimentsAndModelsExport) => void;
  clearAllExperimentalData: () => WorkspaceBackupSnapshot;
  apiLatencyHistory: ApiLatencyRecord[];
  recordApiLatency: (
    entry: Omit<ApiLatencyRecord, 'id' | 'timestamp'> & { id?: string; timestamp?: string }
  ) => ApiLatencyRecord;
  clearApiLatencyHistory: () => void;
  isTutorialOpen: boolean;
  openTutorial: () => void;
  closeTutorial: () => void;
  localBackupSchedule: LocalBackupScheduleConfig;
  updateLocalBackupSchedule: (
    patch: Partial<
      Pick<
        LocalBackupScheduleConfig,
        'enabled' | 'frequency' | 'mode' | 'localFormat' | 'autoDownload' | 'retentionCount'
      >
    >
  ) => LocalBackupScheduleConfig;
  recordLocalBackupExecution: (entry: LocalBackupRunEntry) => LocalBackupScheduleConfig;
  clearLocalBackupHistory: () => void;
}

const StudioContext = createContext<StudioContextValue | null>(null);

export const StudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const suiteRef = useRef<NeuralSuite>(null as unknown as NeuralSuite);
  if (!suiteRef.current) {
    suiteRef.current = createInitialNeuralSuite();
  }

  const [activeModule, setActiveModule] = useState<ModuleId>('dashboard');
  const [classifierMode, setClassifierMode] = useState<ClassifierMode>('digits');
  const [currentInputGrid, setCurrentInputGrid] = useState<number[]>(() => rasterizeGlyph('3'));
  const [lastPrediction, setLastPrediction] = useState<PredictionRecord | null>(() => {
    const suite = suiteRef.current;
    const grid = rasterizeGlyph('3');
    const pred = suite.digitsModel.predictScores(grid);
    const lRes = suite.lettersModel.isTrained ? suite.lettersModel.predictScores(grid) : null;
    const aRes = suite.alphanumericModel.isTrained
      ? suite.alphanumericModel.predictScores(grid)
      : null;
    return {
      id: 'init-3',
      timestamp: new Date().toISOString(),
      mode: 'digits',
      topLabel: pred.topLabel,
      confidence: pred.confidence,
      entropy: pred.entropy,
      topScores: pred.topScores,
      allScores: pred.allScores,
      inputGrid: grid,
      layerSnapshots: pred.snapshots,
      comparison: {
        digitsTop: { label: pred.topLabel, confidence: pred.confidence },
        lettersTop: lRes ? { label: lRes.topLabel, confidence: lRes.confidence } : undefined,
        alphanumericTop: aRes ? { label: aRes.topLabel, confidence: aRes.confidence } : undefined,
      },
    };
  });
  const [predictionHistory, setPredictionHistory] = useState<PredictionRecord[]>(() =>
    lastPrediction ? [lastPrediction] : []
  );

  const [digitsSummary, setDigitsSummary] = useState<ModelEvaluationSummary>(() =>
    suiteRef.current.digitsModel.getSummary()
  );
  const [lettersSummary, setLettersSummary] = useState<ModelEvaluationSummary>(() =>
    suiteRef.current.lettersModel.getSummary()
  );
  const [alphanumericSummary, setAlphanumericSummary] = useState<ModelEvaluationSummary>(() =>
    suiteRef.current.alphanumericModel.getSummary()
  );

  const [trainingProgress, setTrainingProgress] = useState<TrainingProgress>({
    isTraining: false,
    targetMode: null,
    currentEpoch: 0,
    totalEpochs: 0,
  });

  const [lastMathOutput, setLastMathOutput] = useState<MathOperationOutput | null>(null);

  const [omniMessages, setOmniMessages] = useState<OmniMessage[]>([
    {
      id: 'omni-welcome',
      role: 'assistant',
      timestamp: new Date().toISOString(),
      source: 'local-knowledge',
      toolTrace: ['motor_local_inicializado'],
      content:
        'Bienvenido a Omni Bot Intelligence. Combino un motor determinístico local de Álgebra Lineal (prueba det([[2,1],[1,3]]), inv([[4,7],[2,6]]), dot([1,2],[3,4]) o solve([[2,1],[1,-1]],[5,1])) con inspección directa de las redes neuronales y razonamiento conectado al servidor.',
    },
  ]);

  const [simulationConfig, setSimulationConfig] = useState<SimulationExperimentConfig>({
    mode: 'digits',
    targetGlyph: '3',
    shiftX: 1,
    shiftY: 0,
    noiseLevel: 0.15,
    perturbationIntensity: 0.15,
    learningRate: 0.04,
    epochs: 0,
    seed: 2026,
    selectedClasses: ['0', '1', '3', '7', '8'],
  });

  const [simulationHistory, setSimulationHistory] = useState<SimulationRunRecord[]>(() =>
    loadSimulationHistory()
  );
  const [sharedMatrix2D, setSharedMatrix2D] = useState<number[][]>([
    [1.2, -0.4],
    [0.5, 1.1],
  ]);
  const [mnist784Pixels, setMnist784Pixels] = useState<number[]>(() => getMnist784ExamplePixels(3));
  const [mnist784Result, setMnist784Result] = useState<Mnist784InferenceResult | null>(() => {
    try {
      return infer784(getMnist784ExamplePixels(3));
    } catch {
      return null;
    }
  });
  const [mnist784SourceLabel, setMnist784SourceLabel] = useState<string>(
    'Ejemplo sintético #3 (Avance 2)'
  );
  const [mnist784PerturbConfig, setMnist784PerturbConfig] = useState<Mnist784PerturbationConfig>(
    () => ({ ...DEFAULT_MNIST_PERTURB_CONFIG })
  );
  const [mnist784PerturbResult, setMnist784PerturbResult] =
    useState<Mnist784PerturbationResult | null>(null);
  const [last232Step, setLast232Step] = useState<Didactic232StepResult | null>(null);
  const [reportHistory, setReportHistory] = useState<TechnicalReportRecord[]>([]);
  const [systemEvents, setSystemEvents] = useState<SystemEventRecord[]>(() => [
    {
      id: 'evt-init',
      timestamp: new Date().toISOString(),
      category: 'system',
      title: 'Inicialización de motores matemáticos y neuronales',
      detail: 'Dígitos (0–9), Letras (A–Z), Combinado (36 clases) y Red 784–128–10 (101,770 params) entrenados y listos.',
      status: 'ok',
    },
  ]);

  const { theme, setTheme } = useTheme();
  const [userProfile, setUserProfileState] = useState<WorkspaceUserProfile>({
    name: 'Moisés De Hoyos',
    role: 'Estudiante / Investigador',
    institution: 'Facultad de Ingeniería',
    program: 'Ingeniería de Datos e Inteligencia Artificial',
    planTier: 'academico',
  });
  const [backupSnapshots, setBackupSnapshots] = useState<WorkspaceBackupSnapshot[]>(() =>
    loadBackupSnapshots()
  );
  const [apiLatencyHistory, setApiLatencyHistory] = useState<ApiLatencyRecord[]>(() =>
    loadApiLatencyHistory()
  );
  const [isTutorialOpen, setIsTutorialOpen] = useState<boolean>(() =>
    shouldShowQuickStartGuide()
  );
  const [localBackupSchedule, setLocalBackupSchedule] = useState<LocalBackupScheduleConfig>(() =>
    loadLocalBackupSchedule()
  );

  const setUserProfile: React.Dispatch<React.SetStateAction<WorkspaceUserProfile>> = useCallback(
    (updater) => {
      setUserProfileState((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        const clean = (s: string, max: number) =>
          s.replace(/[\u0000-\u001F\u007F]/g, '').replace(/[<>]/g, '').slice(0, max);
        return {
          name: clean(next.name, 80),
          role: clean(next.role, 80),
          institution: clean(next.institution, 120),
          program: clean(next.program, 120),
          planTier: next.planTier,
        };
      });
    },
    []
  );

  const refreshSummaries = useCallback(() => {
    setDigitsSummary(suiteRef.current.digitsModel.getSummary());
    setLettersSummary(suiteRef.current.lettersModel.getSummary());
    setAlphanumericSummary(suiteRef.current.alphanumericModel.getSummary());
  }, []);

  const classifyGrid = useCallback(
    (grid: number[], modeOverride?: ClassifierMode): PredictionRecord | null => {
      const mode = modeOverride ?? classifierMode;
      setCurrentInputGrid(grid);
      const suite = suiteRef.current;

      if (mode === 'alphanumeric' && !suite.alphanumericModel.isTrained) {
        // Strictly block simulated combined predictions until the 36-class model is genuinely trained.
        return null;
      }

      const targetModel =
        mode === 'digits'
          ? suite.digitsModel
          : mode === 'letters'
            ? suite.lettersModel
            : suite.alphanumericModel;

      const res = targetModel.predictScores(grid);

      // Build side-by-side comparison using only genuinely trained models
      const dRes = suite.digitsModel.isTrained ? suite.digitsModel.predictScores(grid) : null;
      const lRes = suite.lettersModel.isTrained ? suite.lettersModel.predictScores(grid) : null;
      const aRes = suite.alphanumericModel.isTrained
        ? suite.alphanumericModel.predictScores(grid)
        : null;

      const record: PredictionRecord = {
        id: `pred-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
        mode,
        topLabel: res.topLabel,
        confidence: res.confidence,
        entropy: res.entropy,
        topScores: res.topScores,
        allScores: res.allScores,
        inputGrid: grid,
        layerSnapshots: res.snapshots,
        comparison: {
          digitsTop: dRes ? { label: dRes.topLabel, confidence: dRes.confidence } : undefined,
          lettersTop: lRes ? { label: lRes.topLabel, confidence: lRes.confidence } : undefined,
          alphanumericTop: aRes ? { label: aRes.topLabel, confidence: aRes.confidence } : undefined,
        },
      };

      setLastPrediction(record);
      setPredictionHistory((prev) => [record, ...prev].slice(0, 25));
      return record;
    },
    [classifierMode]
  );

  const loadSampleGlyph = useCallback(
    (label: string, modeOverride?: ClassifierMode) => {
      const grid = rasterizeGlyph(label);
      const targetMode = modeOverride ?? classifierMode;
      if (modeOverride) setClassifierMode(modeOverride);
      setCurrentInputGrid(grid);
      classifyGrid(grid, targetMode);
    },
    [classifierMode, classifyGrid]
  );

  const retrainMode = useCallback(
    async (mode: ClassifierMode, epochs = 18, lr = 0.005) => {
      if (trainingProgress.isTraining) return;
      const suite = suiteRef.current;
      const model =
        mode === 'digits'
          ? suite.digitsModel
          : mode === 'letters'
            ? suite.lettersModel
            : suite.alphanumericModel;
      const trainSet =
        mode === 'digits'
          ? suite.digitsTrain
          : mode === 'letters'
            ? suite.lettersTrain
            : suite.alphanumericTrain;
      const valSet =
        mode === 'digits'
          ? suite.digitsVal
          : mode === 'letters'
            ? suite.lettersVal
            : suite.alphanumericVal;

      setTrainingProgress({
        isTraining: true,
        targetMode: mode,
        currentEpoch: 0,
        totalEpochs: epochs,
      });

      const chunkSize = 2;
      for (let done = 0; done < epochs; done += chunkSize) {
        const stepEpochs = Math.min(chunkSize, epochs - done);
        model.trainEpochs(trainSet, valSet, stepEpochs, lr, 0.85);
        setTrainingProgress({
          isTraining: true,
          targetMode: mode,
          currentEpoch: done + stepEpochs,
          totalEpochs: epochs,
        });
        refreshSummaries();
        await new Promise<void>((resolve) => setTimeout(resolve, 12));
      }

      setTrainingProgress({
        isTraining: false,
        targetMode: null,
        currentEpoch: epochs,
        totalEpochs: epochs,
      });
      refreshSummaries();
      classifyGrid(currentInputGrid, mode === 'alphanumeric' ? 'alphanumeric' : classifierMode);
    },
    [classifierMode, classifyGrid, currentInputGrid, refreshSummaries, trainingProgress.isTraining]
  );

  const trainAlphanumericModel = useCallback(
    async (epochs = 18) => {
      await retrainMode('alphanumeric', epochs, 0.005);
    },
    [retrainMode]
  );

  const runSingleBackpropStep = useCallback(
    (targetLabel: string, lr: number, momentum: number): BackpropStepReport => {
      const suite = suiteRef.current;
      const activeModel =
        classifierMode === 'digits'
          ? suite.digitsModel
          : classifierMode === 'letters'
            ? suite.lettersModel
            : suite.alphanumericModel;

      let targetIndex = activeModel.labels.indexOf(targetLabel);
      if (targetIndex === -1) targetIndex = 0;

      const report = activeModel.stepSGD(
        {
          input: currentInputGrid,
          label: activeModel.labels[targetIndex],
          labelIndex: targetIndex,
        },
        lr,
        momentum
      );
      refreshSummaries();
      return report;
    },
    [classifierMode, currentInputGrid, refreshSummaries]
  );

  const addOmniMessage = useCallback((msg: OmniMessage) => {
    setOmniMessages((prev) => [...prev, msg]);
  }, []);

  const clearOmniMessages = useCallback(() => {
    setOmniMessages([
      {
        id: `omni-reset-${Date.now()}`,
        role: 'assistant',
        timestamp: new Date().toISOString(),
        source: 'local-knowledge',
        toolTrace: ['sesion_reiniciada'],
        content: 'Memoria de sesión reiniciada. Consulta operaciones matriciales, redes neuronales o estado del estudio.',
      },
    ]);
  }, []);

  const logEvent = useCallback(
    (
      category: SystemEventRecord['category'],
      title: string,
      detail: string,
      status: SystemEventRecord['status'] = 'ok'
    ) => {
      setSystemEvents((prev) =>
        [
          {
            id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            timestamp: new Date().toISOString(),
            category,
            title,
            detail,
            status,
          },
          ...prev,
        ].slice(0, 50)
      );
    },
    []
  );

  useEffect(() => {
    return geminiService.setEventLogger(logEvent);
  }, [logEvent]);

  const addReportRecord = useCallback((report: TechnicalReportRecord) => {
    setReportHistory((prev) => [report, ...prev].slice(0, 20));
  }, []);

  const addSimulationRun = useCallback((run: SimulationRunRecord) => {
    const hasMemory =
      typeof run.memoryMb === 'number' && Number.isFinite(run.memoryMb) && run.memoryMb >= 0;
    const memSnap = hasMemory ? null : measureRuntimeMemorySnapshot(run);
    const enrichedRun: SimulationRunRecord = {
      ...run,
      memoryMb: hasMemory ? run.memoryMb : memSnap?.memoryMb,
      memorySource: hasMemory ? run.memorySource : memSnap?.source,
    };
    setSimulationHistory((prev) => {
      const next = [enrichedRun, ...prev].slice(0, 30);
      saveSimulationHistory(next);
      return next;
    });
    logEvent('simulation', enrichedRun.title, enrichedRun.summary, 'ok');
  }, [logEvent]);

  const clearSimulationHistory = useCallback(() => {
    setSimulationHistory([]);
    saveSimulationHistory([]);
  }, []);

  const sendExperimentToTopology = useCallback(
    (grid: number[], mode: ClassifierMode) => {
      setClassifierMode(mode);
      setCurrentInputGrid(grid);
      classifyGrid(grid, mode);
      setActiveModule('topology');
    },
    [classifyGrid]
  );

  const askOmniAboutExperiment = useCallback(
    (summaryPrompt: string) => {
      addOmniMessage({
        id: `exp-ctx-${Date.now()}`,
        role: 'assistant',
        timestamp: new Date().toISOString(),
        source: 'local-knowledge',
        toolTrace: ['simulation_lab_bridge'],
        content: `Contexto recibido desde el Laboratorio:\n${summaryPrompt}\n\nPuedes preguntarme qué parámetros causaron estos cambios o cómo mejorar la robustez y la pérdida.`,
      });
      setActiveModule('omni-bot');
    },
    [addOmniMessage]
  );

  const runMnist784Inference = useCallback(
    (pixels: number[], sourceLabel = 'Lienzo manual 280×280'): Mnist784InferenceResult | null => {
      try {
        const res = infer784(pixels);
        setMnist784Pixels(pixels);
        setMnist784Result(res);
        setMnist784SourceLabel(sourceLabel);
        logEvent(
          'neural',
          `Inferencia 784–128–10 → Dígito ${res.digit}`,
          `${sourceLabel} · Confianza ${(res.confidence * 100).toFixed(2)}% · ${res.activeNeurons}/128 ReLU activas`,
          'ok'
        );
        return res;
      } catch (err) {
        logEvent(
          'neural',
          'Error en inferencia 784–128–10',
          err instanceof Error ? err.message : 'Entrada inválida',
          'error'
        );
        return null;
      }
    },
    [logEvent]
  );

  const loadMnist784Example = useCallback(
    (digit: number) => {
      const px = getMnist784ExamplePixels(digit);
      runMnist784Inference(px, `Ejemplo sintético #${digit} (Avance 2)`);
    },
    [runMnist784Inference]
  );

  const runMnist784Perturbation = useCallback(
    (override?: Mnist784PerturbationConfig): Mnist784PerturbationResult | null => {
      const cfg = override ?? mnist784PerturbConfig;
      try {
        const res = runMnist784PerturbationComparison(mnist784Pixels, cfg);
        setMnist784PerturbResult(res);
        return res;
      } catch {
        return null;
      }
    },
    [mnist784PerturbConfig, mnist784Pixels]
  );

  const sendMnist784ToTopology = useCallback(
    (pixels: number[]) => {
      const grid16 = downsample28x28To16x16(pixels);
      setClassifierMode('digits');
      setCurrentInputGrid(grid16);
      classifyGrid(grid16, 'digits');
      setActiveModule('topology');
    },
    [classifyGrid]
  );

  const createManualBackupSnapshot = useCallback(
    (reason = 'Respaldo manual del usuario'): WorkspaceBackupSnapshot => {
      const payload: WorkspaceBackupPayload = {
        schemaVersion: BACKUP_SCHEMA_VERSION,
        appVersion: VECTORIA_VERSION,
        theme,
        classifierMode,
        userProfile,
        simulationHistory,
        reportHistory,
      };
      const next = saveBackupSnapshot(reason, payload);
      setBackupSnapshots(next);
      logEvent(
        'system',
        'Respaldo del espacio de trabajo creado',
        `Ranura conservada (${next.length} disponibles): ${next[0]?.reason ?? reason}`,
        'ok'
      );
      return next[0];
    },
    [classifierMode, logEvent, reportHistory, simulationHistory, theme, userProfile]
  );

  const restoreFromBackupPayload = useCallback(
    (payload: WorkspaceBackupPayload) => {
      const currentPayload: WorkspaceBackupPayload = {
        schemaVersion: BACKUP_SCHEMA_VERSION,
        appVersion: VECTORIA_VERSION,
        theme,
        classifierMode,
        userProfile,
        simulationHistory,
        reportHistory,
      };
      saveBackupSnapshot('Respaldo automático previo a restauración', currentPayload);
      setTheme(payload.theme);
      setClassifierMode(payload.classifierMode);
      setUserProfileState(payload.userProfile);
      setSimulationHistory(payload.simulationHistory ?? []);
      setReportHistory(payload.reportHistory ?? []);
      setBackupSnapshots(loadBackupSnapshots());
      logEvent(
        'system',
        'Espacio de trabajo restaurado desde respaldo',
        `Versión respaldo ${payload.appVersion} · Tema ${payload.theme} · ${payload.simulationHistory?.length ?? 0} simulaciones`,
        'ok'
      );
    },
    [classifierMode, logEvent, reportHistory, setTheme, simulationHistory, theme, userProfile]
  );

  const restoreFromExperimentsAndModelsArchive = useCallback(
    (archive: ExperimentsAndModelsExport) => {
      createManualBackupSnapshot('Respaldo automático previo a restauración de experimentos y modelos');
      const { activeState, experiments, profileSummary, trainedModels } = archive.data;
      setTheme(activeState.theme);
      setClassifierMode(activeState.classifierMode);
      setSharedMatrix2D(activeState.sharedMatrix2D);
      setSimulationConfig(experiments.simulationConfig);
      setSimulationHistory(experiments.simulationHistory ?? []);
      setMnist784PerturbConfig(experiments.mnist784PerturbConfig);
      setMnist784PerturbResult(experiments.mnist784PerturbResult ?? null);
      setLast232Step(experiments.last232Step ?? null);
      setReportHistory(experiments.reportHistory ?? []);
      setUserProfile((prev) => ({
        ...prev,
        role: profileSummary.role || prev.role,
        program: profileSummary.program || prev.program,
        planTier: profileSummary.planTier,
      }));

      const suite = suiteRef.current;
      suite.digitsModel.importSerializedState(trainedModels.digits);
      suite.lettersModel.importSerializedState(trainedModels.letters);
      suite.alphanumericModel.importSerializedState(trainedModels.alphanumeric);
      refreshSummaries();
      setBackupSnapshots(loadBackupSnapshots());
      logEvent(
        'system',
        'Experimentos y modelos restaurados desde archivo verificado',
        `Esquema ${archive.schema} · SHA-256 ${archive.integrity.digest.slice(0, 12)}… · ${experiments.simulationHistory.length} simulaciones`,
        'ok'
      );
    },
    [createManualBackupSnapshot, logEvent, refreshSummaries, setTheme, setUserProfile]
  );

  const recordApiLatency = useCallback(
    (
      entry: Omit<ApiLatencyRecord, 'id' | 'timestamp'> & { id?: string; timestamp?: string }
    ): ApiLatencyRecord => {
      const record: ApiLatencyRecord = {
        id: entry.id ?? `lat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: entry.timestamp ?? new Date().toISOString(),
        endpoint: entry.endpoint,
        method: entry.method,
        status: entry.status,
        latencyMs: Number(entry.latencyMs.toFixed(2)),
        ok: entry.ok,
        source: entry.source,
      };
      setApiLatencyHistory((prev) => {
        const next = [record, ...prev].slice(0, 40);
        saveApiLatencyHistory(next);
        return next;
      });
      return record;
    },
    []
  );

  const clearApiLatencyHistory = useCallback(() => {
    setApiLatencyHistory([]);
    saveApiLatencyHistory([]);
  }, []);

  const openTutorial = useCallback(() => {
    persistQuickStartDismissed(false);
    setIsTutorialOpen(true);
  }, []);

  const closeTutorial = useCallback(() => {
    persistQuickStartDismissed(true);
    setIsTutorialOpen(false);
  }, []);

  const updateLocalBackupSchedule = useCallback(
    (
      patch: Partial<
        Pick<
          LocalBackupScheduleConfig,
          'enabled' | 'frequency' | 'mode' | 'localFormat' | 'autoDownload' | 'retentionCount'
        >
      >
    ): LocalBackupScheduleConfig => {
      let updatedSnapshot: LocalBackupScheduleConfig = loadLocalBackupSchedule();
      setLocalBackupSchedule((prev) => {
        const enabled = patch.enabled !== undefined ? patch.enabled : prev.enabled;
        const frequency = patch.frequency ?? prev.frequency;
        const retentionCount =
          typeof patch.retentionCount === 'number' && Number.isFinite(patch.retentionCount)
            ? Math.min(10, Math.max(2, Math.round(patch.retentionCount)))
            : prev.retentionCount;
        const needsNextRecalc =
          !enabled
            ? false
            : !prev.enabled || prev.frequency !== frequency || !prev.nextRunAt;
        const nextRunAt = !enabled
          ? null
          : needsNextRecalc
            ? computeNextBackupRunIso(frequency)
            : prev.nextRunAt;

        const next: LocalBackupScheduleConfig = {
          ...prev,
          enabled,
          frequency,
          mode: patch.mode ?? prev.mode,
          localFormat: patch.localFormat ?? prev.localFormat,
          autoDownload: patch.autoDownload !== undefined ? patch.autoDownload : prev.autoDownload,
          retentionCount,
          nextRunAt,
          history: prev.history.slice(0, retentionCount),
        };
        saveLocalBackupSchedule(next);
        updatedSnapshot = next;
        return next;
      });
      return updatedSnapshot;
    },
    []
  );

  const recordLocalBackupExecution = useCallback(
    (entry: LocalBackupRunEntry): LocalBackupScheduleConfig => {
      let updatedSnapshot: LocalBackupScheduleConfig = loadLocalBackupSchedule();
      setLocalBackupSchedule((prev) => {
        const next = appendLocalBackupHistory(prev, entry);
        saveLocalBackupSchedule(next);
        updatedSnapshot = next;
        return next;
      });
      return updatedSnapshot;
    },
    []
  );

  const clearLocalBackupHistory = useCallback(() => {
    setLocalBackupSchedule((prev) => {
      const next: LocalBackupScheduleConfig = {
        ...prev,
        lastError: null,
        lastStatus: 'idle',
        history: [],
      };
      saveLocalBackupSchedule(next);
      return next;
    });
  }, []);

  const clearAllExperimentalData = useCallback((): WorkspaceBackupSnapshot => {
    const snap = createManualBackupSnapshot('Respaldo previo a limpieza experimental');
    setPredictionHistory([]);
    clearSimulationHistory();
    setReportHistory([]);
    setMnist784PerturbResult(null);
    setLast232Step(null);
    setLastMathOutput(null);
    clearApiLatencyHistory();
    clearOmniMessages();
    logEvent(
      'system',
      'Datos experimentales y de sesión eliminados',
      'Se conservó una instantánea de seguridad previa en almacenamiento local.',
      'warn'
    );
    return snap;
  }, [
    clearApiLatencyHistory,
    clearOmniMessages,
    clearSimulationHistory,
    createManualBackupSnapshot,
    logEvent,
  ]);

  const value = useMemo<StudioContextValue>(
    () => ({
      activeModule,
      setActiveModule,
      classifierMode,
      setClassifierMode,
      currentInputGrid,
      setCurrentInputGrid,
      lastPrediction,
      predictionHistory,
      classifyGrid,
      loadSampleGlyph,
      trainAlphanumericModel,
      retrainMode,
      runSingleBackpropStep,
      trainingProgress,
      digitsSummary,
      lettersSummary,
      alphanumericSummary,
      suiteRef,
      lastMathOutput,
      setLastMathOutput,
      omniMessages,
      addOmniMessage,
      clearOmniMessages,
      simulationConfig,
      setSimulationConfig,
      simulationHistory,
      addSimulationRun,
      clearSimulationHistory,
      sendExperimentToTopology,
      askOmniAboutExperiment,
      systemEvents,
      logEvent,
      reportHistory,
      addReportRecord,
      sharedMatrix2D,
      setSharedMatrix2D,
      mnist784Pixels,
      setMnist784Pixels,
      mnist784Result,
      mnist784SourceLabel,
      runMnist784Inference,
      loadMnist784Example,
      mnist784PerturbConfig,
      setMnist784PerturbConfig,
      mnist784PerturbResult,
      runMnist784Perturbation,
      last232Step,
      setLast232Step,
      sendMnist784ToTopology,
      userProfile,
      setUserProfile,
      backupSnapshots,
      createManualBackupSnapshot,
      restoreFromBackupPayload,
      restoreFromExperimentsAndModelsArchive,
      clearAllExperimentalData,
      apiLatencyHistory,
      recordApiLatency,
      clearApiLatencyHistory,
      isTutorialOpen,
      openTutorial,
      closeTutorial,
      localBackupSchedule,
      updateLocalBackupSchedule,
      recordLocalBackupExecution,
      clearLocalBackupHistory,
    }),
    [
      activeModule,
      classifierMode,
      currentInputGrid,
      lastPrediction,
      predictionHistory,
      classifyGrid,
      loadSampleGlyph,
      trainAlphanumericModel,
      retrainMode,
      runSingleBackpropStep,
      trainingProgress,
      digitsSummary,
      lettersSummary,
      alphanumericSummary,
      lastMathOutput,
      omniMessages,
      addOmniMessage,
      clearOmniMessages,
      simulationConfig,
      simulationHistory,
      addSimulationRun,
      clearSimulationHistory,
      sendExperimentToTopology,
      askOmniAboutExperiment,
      systemEvents,
      logEvent,
      reportHistory,
      addReportRecord,
      sharedMatrix2D,
      mnist784Pixels,
      mnist784Result,
      mnist784SourceLabel,
      runMnist784Inference,
      loadMnist784Example,
      mnist784PerturbConfig,
      mnist784PerturbResult,
      runMnist784Perturbation,
      last232Step,
      sendMnist784ToTopology,
      userProfile,
      setUserProfile,
      backupSnapshots,
      createManualBackupSnapshot,
      restoreFromBackupPayload,
      restoreFromExperimentsAndModelsArchive,
      clearAllExperimentalData,
      apiLatencyHistory,
      recordApiLatency,
      clearApiLatencyHistory,
      isTutorialOpen,
      openTutorial,
      closeTutorial,
      localBackupSchedule,
      updateLocalBackupSchedule,
      recordLocalBackupExecution,
      clearLocalBackupHistory,
    ]
  );

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
};

export function useStudio(): StudioContextValue {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error('useStudio debe usarse dentro de StudioProvider');
  return ctx;
}
