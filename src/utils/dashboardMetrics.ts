import type {
  ClassifierMode,
  Didactic232StepResult,
  MathOperationOutput,
  Mnist784InferenceResult,
  Mnist784PerturbationResult,
  ModelEvaluationSummary,
  PredictionRecord,
  SimulationRunRecord,
  SystemEventRecord,
} from '../types/vectoria';

export interface NeuralLabSummaryWidgetData {
  trainedModelsCount: number;
  totalArchitectures: number;
  totalActiveParameters: number;
  meanValAccuracyPct: number;
  meanTrainAccuracyPct: number;
  meanLoss: number;
  inferenceCount: number;
  meanConfidencePct: number | null;
  minConfidencePct: number | null;
  maxConfidencePct: number | null;
  meanEntropyBits: number | null;
  modeCounts: Record<ClassifierMode, number>;
  bestModelLabel: string;
  bestModelAccuracyPct: number;
  mnist784AccuracyPct: number;
  mnist784LastDigit: number | null;
  mnist784LastConfidencePct: number | null;
}

export interface SimulationLabSummaryWidgetData {
  totalRuns: number;
  byKind: Record<SimulationRunRecord['kind'], number>;
  meanDurationMs: number | null;
  lastRunTitle: string | null;
  lastRunTimestamp: string | null;
  meanPerturbedConfidenceDropPp: number | null;
  mnist784PerturbDeltaPct: number | null;
  mnist784PerturbChangedClass: boolean | null;
}

export interface AlgebraAndSystemSummaryWidgetData {
  lastOperation: string | null;
  lastCategory: string | null;
  lastVerificationPassed: boolean | null;
  lastResidual: number | null;
  didactic232LossBefore: number | null;
  didactic232LossAfter: number | null;
  didactic232LossDelta: number | null;
  didactic232MaxFiniteDiffError: number | null;
  totalEvents: number;
  okEvents: number;
  warnEvents: number;
  errorEvents: number;
  reportCount: number;
  omniMessageCount: number;
}

export interface LaboratoryDashboardSummaries {
  neural: NeuralLabSummaryWidgetData;
  simulation: SimulationLabSummaryWidgetData;
  algebraSystem: AlgebraAndSystemSummaryWidgetData;
}

export interface ComputeLaboratorySummariesInput {
  digitsSummary: ModelEvaluationSummary;
  lettersSummary: ModelEvaluationSummary;
  alphanumericSummary: ModelEvaluationSummary;
  mnist784Exactitud: number;
  mnist784Params: number;
  mnist784Result: Mnist784InferenceResult | null;
  mnist784PerturbResult: Mnist784PerturbationResult | null;
  predictionHistory: PredictionRecord[];
  simulationHistory: SimulationRunRecord[];
  lastMathOutput: MathOperationOutput | null;
  last232Step: Didactic232StepResult | null;
  systemEvents: SystemEventRecord[];
  reportCount: number;
  omniMessageCount: number;
}

export function computeLaboratorySummaries(
  input: ComputeLaboratorySummariesInput
): LaboratoryDashboardSummaries {
  const {
    digitsSummary,
    lettersSummary,
    alphanumericSummary,
    mnist784Exactitud,
    mnist784Params,
    mnist784Result,
    mnist784PerturbResult,
    predictionHistory,
    simulationHistory,
    lastMathOutput,
    last232Step,
    systemEvents,
    reportCount,
    omniMessageCount,
  } = input;

  // 1. Neural networks & classifier summary (100% real metrics)
  const activeModels = [
    { name: 'Dígitos 0–9', summary: digitsSummary },
    { name: 'Letras A–Z', summary: lettersSummary },
    { name: 'Alfanumérico 36', summary: alphanumericSummary },
  ].filter((m) => m.summary.isTrained);

  const totalArchitectures = 4; // 3 MLP 16x16 + MNIST 784-128-10
  const trainedModelsCount = activeModels.length + 1;

  const totalActiveParameters =
    activeModels.reduce((acc, m) => acc + m.summary.parameterCount, 0) + mnist784Params;

  const valAccs = [
    ...activeModels.map((m) => m.summary.valAccuracy * 100),
    mnist784Exactitud * 100,
  ];
  const meanValAccuracyPct =
    valAccs.length > 0 ? valAccs.reduce((a, b) => a + b, 0) / valAccs.length : 0;

  const meanTrainAccuracyPct =
    activeModels.length > 0
      ? (activeModels.reduce((acc, m) => acc + m.summary.trainAccuracy * 100, 0) /
          activeModels.length)
      : 0;

  const meanLoss =
    activeModels.length > 0
      ? activeModels.reduce((acc, m) => acc + m.summary.finalLoss, 0) / activeModels.length
      : 0;

  const candidates = [
    ...activeModels.map((m) => ({ name: m.name, acc: m.summary.valAccuracy * 100 })),
    { name: 'MNIST 784–128–10', acc: mnist784Exactitud * 100 },
  ].sort((a, b) => b.acc - a.acc);

  const modeCounts: Record<ClassifierMode, number> = {
    digits: 0,
    letters: 0,
    alphanumeric: 0,
  };
  let confSum = 0;
  let entropySum = 0;
  let minConf: number | null = null;
  let maxConf: number | null = null;

  for (const pred of predictionHistory) {
    modeCounts[pred.mode] = (modeCounts[pred.mode] ?? 0) + 1;
    const confPct = pred.confidence * 100;
    confSum += confPct;
    entropySum += pred.entropy;
    minConf = minConf === null ? confPct : Math.min(minConf, confPct);
    maxConf = maxConf === null ? confPct : Math.max(maxConf, confPct);
  }

  const inferenceCount = predictionHistory.length;

  // 2. Simulation Lab & Robustness summary
  const byKind: Record<SimulationRunRecord['kind'], number> = {
    'before-after': 0,
    'ab-test': 0,
    'batch-robustness': 0,
    'didactic-322': 0,
  };
  let durationSum = 0;
  const dropSamples: number[] = [];

  for (const run of simulationHistory) {
    byKind[run.kind] = (byKind[run.kind] ?? 0) + 1;
    durationSum += run.durationMs;

    const rawDrop =
      typeof run.metrics['Caída exactitud'] === 'string'
        ? parseFloat(run.metrics['Caída exactitud'])
        : typeof run.metrics['Caída (pp)'] === 'number'
          ? run.metrics['Caída (pp)']
          : typeof run.metrics['Delta confianza'] === 'string'
            ? parseFloat(run.metrics['Delta confianza'])
            : NaN;
    if (Number.isFinite(rawDrop)) {
      dropSamples.push(rawDrop);
    }
  }

  const totalRuns = simulationHistory.length;
  const lastRun = simulationHistory[0] ?? null;

  // 3. Linear Algebra, Didactic 2-3-2 & System Audit summary
  let okEvents = 0;
  let warnEvents = 0;
  let errorEvents = 0;
  for (const evt of systemEvents) {
    if (evt.status === 'ok') okEvents += 1;
    else if (evt.status === 'warn') warnEvents += 1;
    else errorEvents += 1;
  }

  return {
    neural: {
      trainedModelsCount,
      totalArchitectures,
      totalActiveParameters,
      meanValAccuracyPct,
      meanTrainAccuracyPct,
      meanLoss,
      inferenceCount,
      meanConfidencePct: inferenceCount > 0 ? confSum / inferenceCount : null,
      minConfidencePct: minConf,
      maxConfidencePct: maxConf,
      meanEntropyBits: inferenceCount > 0 ? entropySum / inferenceCount : null,
      modeCounts,
      bestModelLabel: candidates[0]?.name ?? 'N/D',
      bestModelAccuracyPct: candidates[0]?.acc ?? 0,
      mnist784AccuracyPct: mnist784Exactitud * 100,
      mnist784LastDigit: mnist784Result ? mnist784Result.digit : null,
      mnist784LastConfidencePct: mnist784Result ? mnist784Result.confidence * 100 : null,
    },
    simulation: {
      totalRuns,
      byKind,
      meanDurationMs: totalRuns > 0 ? durationSum / totalRuns : null,
      lastRunTitle: lastRun?.title ?? null,
      lastRunTimestamp: lastRun?.timestamp ?? null,
      meanPerturbedConfidenceDropPp:
        dropSamples.length > 0
          ? dropSamples.reduce((a, b) => a + b, 0) / dropSamples.length
          : null,
      mnist784PerturbDeltaPct: mnist784PerturbResult
        ? mnist784PerturbResult.confidenceDeltaPct
        : null,
      mnist784PerturbChangedClass: mnist784PerturbResult
        ? mnist784PerturbResult.changedClass
        : null,
    },
    algebraSystem: {
      lastOperation: lastMathOutput?.operation ?? null,
      lastCategory: lastMathOutput?.category ?? null,
      lastVerificationPassed: lastMathOutput?.verification.passed ?? null,
      lastResidual: lastMathOutput?.verification.residual ?? null,
      didactic232LossBefore: last232Step?.lossBefore ?? null,
      didactic232LossAfter: last232Step?.lossAfter ?? null,
      didactic232LossDelta: last232Step
        ? last232Step.lossAfter - last232Step.lossBefore
        : null,
      didactic232MaxFiniteDiffError: last232Step?.maxFiniteDiffError ?? null,
      totalEvents: systemEvents.length,
      okEvents,
      warnEvents,
      errorEvents,
      reportCount,
      omniMessageCount,
    },
  };
}

export type SimulationMemorySource = 'js-heap' | 'node-heap' | 'tensor-footprint';

export interface RuntimeMemorySnapshot {
  memoryMb: number;
  source: SimulationMemorySource;
}

export interface SimulationPerformancePoint {
  idx: number;
  id: string;
  timeLabel: string;
  title: string;
  kind: SimulationRunRecord['kind'];
  kindLabel: string;
  durationMs: number;
  memoryMb: number;
  memorySource: SimulationMemorySource;
}

export interface SimulationPerformanceStats {
  runCount: number;
  avgDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  latestMemoryMb: number;
  avgMemoryMb: number;
  minMemoryMb: number;
  maxMemoryMb: number;
  dominantSourceLabel: string;
}

const KIND_LABELS: Record<SimulationRunRecord['kind'], string> = {
  'before-after': 'Antes/Después',
  'ab-test': 'A/B Test',
  'batch-robustness': 'Lote Robustez',
  'didactic-322': 'Red 3–2–2',
};

export function computeSimulationPayloadFootprintMb(
  run?: Partial<SimulationRunRecord> | null
): number {
  let payloadBytes = 0;
  try {
    const serialized = run ? JSON.stringify(run) : '{}';
    payloadBytes =
      typeof TextEncoder !== 'undefined'
        ? new TextEncoder().encode(serialized).length
        : serialized.length;
  } catch {
    payloadBytes = 512;
  }

  // Account for actual Float64 tensor clone & workspace buffers allocated during each simulation mode
  const mode = run?.config?.mode ?? 'digits';
  const classCount = mode === 'digits' ? 10 : mode === 'letters' ? 26 : 36;
  const mlpWeightsCount = 256 * 32 + 32 + 32 * 24 + 24 + 24 * classCount + classCount;
  const kind = run?.kind ?? 'before-after';

  let tensorElements = mlpWeightsCount;
  if (kind === 'ab-test') {
    tensorElements = mlpWeightsCount * 2 + 256 * 20;
  } else if (kind === 'batch-robustness') {
    const samples = Number(run?.metrics?.muestras ?? 40);
    tensorElements = mlpWeightsCount + Math.max(10, samples) * 256 * 2;
  } else if (kind === 'didactic-322') {
    tensorElements = 3 * 2 + 2 + 2 * 2 + 2 + 64;
  } else {
    const epochs = Math.max(0, run?.config?.epochs ?? 0);
    tensorElements = mlpWeightsCount * 2 + epochs * 256 * 8;
  }

  const totalBytes = payloadBytes + tensorElements * 8;
  return Number((totalBytes / (1024 * 1024)).toFixed(3));
}

export function measureRuntimeMemorySnapshot(
  run?: Partial<SimulationRunRecord> | null
): RuntimeMemorySnapshot {
  if (typeof performance !== 'undefined') {
    const perfWithMem = performance as Performance & {
      memory?: { usedJSHeapSize?: number };
    };
    const heapBytes = perfWithMem.memory?.usedJSHeapSize;
    if (typeof heapBytes === 'number' && Number.isFinite(heapBytes) && heapBytes > 0) {
      return {
        memoryMb: Number((heapBytes / (1024 * 1024)).toFixed(2)),
        source: 'js-heap',
      };
    }
  }

  if (typeof process !== 'undefined' && typeof process.memoryUsage === 'function') {
    try {
      const heapUsed = process.memoryUsage().heapUsed;
      if (Number.isFinite(heapUsed) && heapUsed > 0) {
        return {
          memoryMb: Number((heapUsed / (1024 * 1024)).toFixed(2)),
          source: 'node-heap',
        };
      }
    } catch {
      // Fallback to payload/tensor footprint
    }
  }

  return {
    memoryMb: computeSimulationPayloadFootprintMb(run),
    source: 'tensor-footprint',
  };
}

export function buildSimulationPerformanceSeries(
  simulationHistory: SimulationRunRecord[],
  kindFilter: 'all' | SimulationRunRecord['kind'] = 'all',
  limit = 30
): SimulationPerformancePoint[] {
  const filtered =
    kindFilter === 'all'
      ? simulationHistory
      : simulationHistory.filter((item) => item.kind === kindFilter);

  return [...filtered]
    .slice(0, Math.max(1, limit))
    .reverse()
    .map((item, idx) => {
      const hasRecordedMem =
        typeof item.memoryMb === 'number' && Number.isFinite(item.memoryMb) && item.memoryMb >= 0;
      const memoryMb = hasRecordedMem
        ? Number(item.memoryMb!.toFixed(3))
        : computeSimulationPayloadFootprintMb(item);
      const memorySource: SimulationMemorySource =
        hasRecordedMem && item.memorySource ? item.memorySource : 'tensor-footprint';

      return {
        idx: idx + 1,
        id: item.id,
        timeLabel: new Date(item.timestamp).toLocaleTimeString(),
        title: item.title,
        kind: item.kind,
        kindLabel: KIND_LABELS[item.kind] ?? item.kind,
        durationMs: Number(Math.max(0, item.durationMs).toFixed(2)),
        memoryMb,
        memorySource,
      };
    });
}

export function computeSimulationPerformanceStats(
  series: SimulationPerformancePoint[]
): SimulationPerformanceStats {
  if (series.length === 0) {
    return {
      runCount: 0,
      avgDurationMs: 0,
      minDurationMs: 0,
      maxDurationMs: 0,
      latestMemoryMb: 0,
      avgMemoryMb: 0,
      minMemoryMb: 0,
      maxMemoryMb: 0,
      dominantSourceLabel: 'Sin mediciones',
    };
  }

  const durations = series.map((p) => p.durationMs);
  const memories = series.map((p) => p.memoryMb);
  const durSum = durations.reduce((a, b) => a + b, 0);
  const memSum = memories.reduce((a, b) => a + b, 0);

  const latestSource = series[series.length - 1].memorySource;
  const dominantSourceLabel =
    latestSource === 'js-heap'
      ? 'Heap JS (performance.memory)'
      : latestSource === 'node-heap'
        ? 'Heap Node.js'
        : 'Huella de tensores y estado';

  return {
    runCount: series.length,
    avgDurationMs: Number((durSum / series.length).toFixed(2)),
    minDurationMs: Number(Math.min(...durations).toFixed(2)),
    maxDurationMs: Number(Math.max(...durations).toFixed(2)),
    latestMemoryMb: Number(memories[memories.length - 1].toFixed(2)),
    avgMemoryMb: Number((memSum / series.length).toFixed(2)),
    minMemoryMb: Number(Math.min(...memories).toFixed(2)),
    maxMemoryMb: Number(Math.max(...memories).toFixed(2)),
    dominantSourceLabel,
  };
}

export type ClassifierTrainingViewMode =
  | 'all'
  | 'digits'
  | 'letters'
  | 'alphanumeric'
  | 'mnist784';

export type ClassifierTrainingMetric = 'valAccuracy' | 'accuracy' | 'loss';

export interface ClassifierTrainingEpochPoint {
  epoch: number;
  epochLabel: string;
  digitsValPct?: number;
  digitsTrainPct?: number;
  digitsLoss?: number;
  lettersValPct?: number;
  lettersTrainPct?: number;
  lettersLoss?: number;
  alphanumericValPct?: number;
  alphanumericTrainPct?: number;
  alphanumericLoss?: number;
  mnistTrainPct?: number;
  mnistLoss?: number;
}

export interface ClassifierSingleModelEpochPoint {
  epoch: number;
  epochLabel: string;
  loss: number;
  trainPct: number;
  valPct?: number;
}

export interface ClassifierTrainingProgressStats {
  digitsEpochs: number;
  lettersEpochs: number;
  alphanumericEpochs: number;
  mnistEpochs: number;
  digitsValPct: number | null;
  lettersValPct: number | null;
  alphanumericValPct: number | null;
  mnistTrainPct: number | null;
  totalEpochsRecorded: number;
}

export interface ClassifierTrainingProgressInput {
  digitsSummary: ModelEvaluationSummary;
  lettersSummary: ModelEvaluationSummary;
  alphanumericSummary: ModelEvaluationSummary;
  mnistHistory: ReadonlyArray<readonly [number, number, number]>;
}

export function buildClassifierTrainingProgressSeries(
  input: ClassifierTrainingProgressInput
): ClassifierTrainingEpochPoint[] {
  const epochMap = new Map<number, ClassifierTrainingEpochPoint>();

  const getOrCreate = (epoch: number): ClassifierTrainingEpochPoint => {
    const existing = epochMap.get(epoch);
    if (existing) return existing;
    const created: ClassifierTrainingEpochPoint = {
      epoch,
      epochLabel: `Ép. ${epoch}`,
    };
    epochMap.set(epoch, created);
    return created;
  };

  for (const h of input.digitsSummary.history) {
    const pt = getOrCreate(h.epoch);
    pt.digitsValPct = Number((h.valAccuracy * 100).toFixed(1));
    pt.digitsTrainPct = Number((h.accuracy * 100).toFixed(1));
    pt.digitsLoss = Number(h.loss.toFixed(4));
  }

  for (const h of input.lettersSummary.history) {
    const pt = getOrCreate(h.epoch);
    pt.lettersValPct = Number((h.valAccuracy * 100).toFixed(1));
    pt.lettersTrainPct = Number((h.accuracy * 100).toFixed(1));
    pt.lettersLoss = Number(h.loss.toFixed(4));
  }

  for (const h of input.alphanumericSummary.history) {
    const pt = getOrCreate(h.epoch);
    pt.alphanumericValPct = Number((h.valAccuracy * 100).toFixed(1));
    pt.alphanumericTrainPct = Number((h.accuracy * 100).toFixed(1));
    pt.alphanumericLoss = Number(h.loss.toFixed(4));
  }

  for (const [epoch, loss, accuracy] of input.mnistHistory) {
    const pt = getOrCreate(epoch);
    pt.mnistTrainPct = Number((accuracy * 100).toFixed(1));
    pt.mnistLoss = Number(loss.toFixed(4));
  }

  return Array.from(epochMap.values()).sort((a, b) => a.epoch - b.epoch);
}

export function buildSingleClassifierEpochSeries(
  mode: Exclude<ClassifierTrainingViewMode, 'all'>,
  input: ClassifierTrainingProgressInput
): ClassifierSingleModelEpochPoint[] {
  if (mode === 'mnist784') {
    return input.mnistHistory.map(([epoch, loss, accuracy]) => ({
      epoch,
      epochLabel: `Ép. ${epoch}`,
      loss: Number(loss.toFixed(4)),
      trainPct: Number((accuracy * 100).toFixed(1)),
    }));
  }

  const target =
    mode === 'digits'
      ? input.digitsSummary
      : mode === 'letters'
        ? input.lettersSummary
        : input.alphanumericSummary;

  return target.history.map((h) => ({
    epoch: h.epoch,
    epochLabel: `Ép. ${h.epoch}`,
    loss: Number(h.loss.toFixed(4)),
    trainPct: Number((h.accuracy * 100).toFixed(1)),
    valPct: Number((h.valAccuracy * 100).toFixed(1)),
  }));
}

export function computeClassifierTrainingProgressStats(
  input: ClassifierTrainingProgressInput
): ClassifierTrainingProgressStats {
  const digitsHist = input.digitsSummary.history;
  const lettersHist = input.lettersSummary.history;
  const alphaHist = input.alphanumericSummary.history;
  const mnistHist = input.mnistHistory;

  return {
    digitsEpochs: digitsHist.length,
    lettersEpochs: lettersHist.length,
    alphanumericEpochs: alphaHist.length,
    mnistEpochs: mnistHist.length,
    digitsValPct:
      digitsHist.length > 0
        ? Number((digitsHist[digitsHist.length - 1].valAccuracy * 100).toFixed(1))
        : null,
    lettersValPct:
      lettersHist.length > 0
        ? Number((lettersHist[lettersHist.length - 1].valAccuracy * 100).toFixed(1))
        : null,
    alphanumericValPct:
      alphaHist.length > 0
        ? Number((alphaHist[alphaHist.length - 1].valAccuracy * 100).toFixed(1))
        : null,
    mnistTrainPct:
      mnistHist.length > 0
        ? Number((mnistHist[mnistHist.length - 1][2] * 100).toFixed(1))
        : null,
    totalEpochsRecorded:
      digitsHist.length + lettersHist.length + alphaHist.length + mnistHist.length,
  };
}


