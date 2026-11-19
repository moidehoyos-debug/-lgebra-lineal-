export type ThemeId =
  | 'dark-purple'
  | 'light-yellow'
  | 'classic-mono'
  | 'holographic'
  | 'black-gold'
  | 'neural-cyberpunk';

export interface ThemeMeta {
  id: ThemeId;
  name: string;
  subtitle: string;
  isDark: boolean;
  swatches: [string, string, string];
}

export type ModuleId =
  | 'dashboard'
  | 'simulation-lab'
  | 'classifier'
  | 'xai'
  | 'topology'
  | 'neural-lab'
  | 'linear-algebra'
  | 'geometry'
  | 'smart-irrigation'
  | 'omni-bot'
  | 'evaluation'
  | 'analytics'
  | 'robustness'
  | 'verification'
  | 'sources'
  | 'reports'
  | 'api-console'
  | 'account'
  | 'visual-builder';

export type ClassifierMode = 'digits' | 'letters' | 'alphanumeric';

export interface PredictionClassScore {
  label: string;
  probability: number;
  logit: number;
  category: 'digit' | 'letter';
}

export interface LayerActivationSnapshot {
  layerName: string;
  size: number;
  zValues: number[];
  aValues: number[];
}

export interface PredictionRecord {
  id: string;
  timestamp: string;
  mode: ClassifierMode;
  topLabel: string;
  confidence: number;
  entropy: number;
  topScores: PredictionClassScore[];
  allScores: PredictionClassScore[];
  inputGrid: number[]; // 16x16 = 256 values in [0,1]
  layerSnapshots: LayerActivationSnapshot[];
  comparison?: {
    digitsTop?: { label: string; confidence: number };
    lettersTop?: { label: string; confidence: number };
    alphanumericTop?: { label: string; confidence: number };
  };
}

export interface TrainingEpochMetric {
  epoch: number;
  loss: number;
  accuracy: number;
  valAccuracy: number;
}

export interface ModelEvaluationSummary {
  mode: ClassifierMode;
  classCount: number;
  labels: string[];
  isTrained: boolean;
  epochsTrained: number;
  finalLoss: number;
  trainAccuracy: number;
  valAccuracy: number;
  confusionMatrix: number[][];
  history: TrainingEpochMetric[];
  parameterCount: number;
  architecture: string;
  lastTrainedAt: string | null;
}

export interface MathStep {
  title: string;
  expression: string;
  matrixSnapshot?: number[][];
  vectorSnapshot?: number[];
  note?: string;
}

export interface MathOperationOutput<T = unknown> {
  operation: string;
  category: string;
  inputSummary: string;
  formula?: string;
  procedure: string;
  steps: MathStep[];
  result: T;
  resultLabel: string;
  verification: {
    passed: boolean;
    residual: number;
    statement: string;
  };
  aiInterpretation: string;
}

export interface OmniMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  source: 'local-math' | 'hybrid-gemini' | 'local-knowledge' | 'error-fallback';
  toolTrace?: string[];
  modelUsed?: string;
  providerLabel?: string;
}

export interface VerificationSuiteResult {
  id: string;
  name: string;
  category: 'linear-algebra' | 'neural-engine' | 'classifier' | 'system' | 'security';
  passed: boolean;
  details: string;
  metric: string;
  durationMs: number;
}

export interface SimulationExperimentConfig {
  mode: ClassifierMode;
  targetGlyph: string;
  shiftX: number; // px [-6, +6]
  shiftY: number; // px [-6, +6]
  noiseLevel: number; // sigma [0, 0.6]
  perturbationIntensity: number; // dropout / attenuation [0, 1]
  learningRate: number; // eta [0.001, 0.2]
  epochs: number; // isolated clone fine-tuning epochs [0, 20]
  seed: number;
  selectedClasses: string[];
}

export interface LayerActivationDiff {
  layerName: string;
  meanBefore: number;
  meanAfter: number;
  l1Delta: number;
}

export interface BeforeAfterExperimentResult {
  config: SimulationExperimentConfig;
  originalGrid: number[];
  modifiedGrid: number[];
  originalTopLabel: string;
  originalConfidence: number;
  modifiedTopLabel: string;
  modifiedConfidence: number;
  lossBefore: number;
  lossAfter: number;
  softmaxComparison: Array<{
    label: string;
    beforePct: number;
    afterPct: number;
  }>;
  layerDiffs: LayerActivationDiff[];
  modifiedSnapshots: LayerActivationSnapshot[];
  durationMs: number;
}

export interface ABScenarioConfig {
  label: string;
  shiftX: number;
  shiftY: number;
  noiseLevel: number;
  perturbationIntensity: number;
  learningRate: number;
  epochs: number;
  seed: number;
}

export interface ABExperimentResult {
  targetGlyph: string;
  mode: ClassifierMode;
  changedParams: Array<{ param: string; valueA: string; valueB: string }>;
  scenarioA: {
    config: ABScenarioConfig;
    topLabel: string;
    targetConfidence: number;
    loss: number;
    valAccuracy: number;
    softmaxTop: Array<{ label: string; probPct: number }>;
  };
  scenarioB: {
    config: ABScenarioConfig;
    topLabel: string;
    targetConfidence: number;
    loss: number;
    valAccuracy: number;
    softmaxTop: Array<{ label: string; probPct: number }>;
  };
  durationMs: number;
}

export interface BatchPerturbationResult {
  totalSamples: number;
  cleanAccuracy: number;
  perturbedAccuracy: number;
  accuracyDropPct: number;
  perClass: Array<{
    label: string;
    count: number;
    cleanAcc: number;
    perturbedAcc: number;
    deltaAcc: number;
  }>;
  sensitivityCurve: Array<{
    noiseSigma: string;
    accuracyPct: number;
  }>;
  durationMs: number;
}

export interface Didactic322Config {
  x: [number, number, number];
  yTargetIndex: 0 | 1;
  learningRate: number;
  W1: [[number, number, number], [number, number, number]];
  b1: [number, number];
  W2: [[number, number], [number, number]];
  b2: [number, number];
}

export interface Didactic322StepResult {
  z1: [number, number];
  a1: [number, number];
  z2: [number, number];
  probsBefore: [number, number];
  probsAfter: [number, number];
  lossBefore: number;
  lossAfter: number;
  gradW1: [[number, number, number], [number, number, number]];
  gradB1: [number, number];
  gradW2: [[number, number], [number, number]];
  gradB2: [number, number];
  updatedConfig: Didactic322Config;
}

export interface SimulationRunRecord {
  id: string;
  timestamp: string;
  kind: 'before-after' | 'ab-test' | 'batch-robustness' | 'didactic-322';
  title: string;
  summary: string;
  durationMs: number;
  memoryMb?: number;
  memorySource?: 'js-heap' | 'node-heap' | 'tensor-footprint';
  config: SimulationExperimentConfig;
  metrics: Record<string, string | number>;
}

export interface PerClassMetrics {
  label: string;
  support: number;
  precision: number;
  recall: number;
  f1: number;
}

export interface DetailedModelEvaluation {
  mode: ClassifierMode;
  isTrained: boolean;
  accuracy: number;
  macroPrecision: number;
  macroRecall: number;
  macroF1: number;
  avgInferenceMs: number;
  sampleCount: number;
  perClass: PerClassMetrics[];
  confusionMatrix: number[][];
}

export interface XaiExplanationResult {
  topLabel: string;
  secondLabel: string;
  confidenceMargin: number;
  entropy: number;
  saliencyGrid: number[]; // 256 normalized gradient*input magnitudes in [0,1]
  topHiddenNeurons: Array<{
    layer: string;
    neuronIndex: number;
    activation: number;
  }>;
  ambiguityNote: string;
}

export interface TechnicalReportRecord {
  id: string;
  createdAt: string;
  title: string;
  objectives: string;
  parameters: string;
  procedure: string;
  formulas: string;
  results: string;
  analysis: string;
  conclusions: string;
  modelInfo: string;
}

export interface SystemEventRecord {
  id: string;
  timestamp: string;
  category: 'math' | 'neural' | 'simulation' | 'omni' | 'system';
  title: string;
  detail: string;
  status: 'ok' | 'warn' | 'error';
}

export interface Mnist784InferenceResult {
  digit: number;
  confidence: number;
  probs: number[];
  z1: number[];
  a1: number[];
  z2: number[];
  activeNeurons: number;
  activePixels: number;
  entropy: number;
  topAlternatives: Array<{ digit: number; probability: number; logit: number }>;
  timestamp: string;
}

export interface Mnist784NeuronInspection {
  pixelIndex: number;
  row: number;
  col: number;
  neuronIndex: number;
  pixelValue: number;
  weight: number;
  contribution: number;
  bias: number;
  z1: number;
  a1: number;
  topContributingPixels: Array<{
    pixelIndex: number;
    row: number;
    col: number;
    pixelValue: number;
    weight: number;
    contribution: number;
  }>;
  outputProjections: Array<{
    digit: number;
    weightW2: number;
    contributionToLogit: number;
  }>;
}

export interface Mnist784PerturbationConfig {
  shiftX: number; // [-6, +6] px
  shiftY: number; // [-6, +6] px
  noiseLevel: number; // [0, 0.65]
  rotationDeg: number; // [-30, +30] deg
  scale: number; // [0.65, 1.35]
  thickness: number; // [-1, +1] erosion/dilation
  intensity: number; // [0.4, 1.5] contrast/gain
  distortion: number; // [0, 1] geometric warp
  seed: number;
}

export interface Mnist784PerturbationResult {
  config: Mnist784PerturbationConfig;
  originalPixels: number[];
  perturbedPixels: number[];
  before: Mnist784InferenceResult;
  after: Mnist784InferenceResult;
  confidenceDeltaPct: number;
  changedClass: boolean;
  softmaxComparison: Array<{
    digit: string;
    beforePct: number;
    afterPct: number;
    deltaPct: number;
  }>;
}

export interface Didactic232Config {
  x: [number, number];
  yTargetIndex: 0 | 1;
  learningRate: number; // (0, 0.5]
  W1: [[number, number, number], [number, number, number]]; // 2x3
  b1: [number, number, number]; // 3
  W2: [[number, number], [number, number], [number, number]]; // 3x2
  b2: [number, number]; // 2
}

export interface Didactic232StepResult {
  z1: [number, number, number];
  a1: [number, number, number];
  z2: [number, number];
  probsBefore: [number, number];
  probsAfter: [number, number];
  lossBefore: number;
  lossAfter: number;
  delta2: [number, number];
  delta1: [number, number, number];
  gradW1: [[number, number, number], [number, number, number]];
  gradB1: [number, number, number];
  gradW2: [[number, number], [number, number], [number, number]];
  gradB2: [number, number];
  numericW200: number;
  numericErrorW200: number;
  maxFiniteDiffError: number;
  updatedConfig: Didactic232Config;
}

export interface ApiLatencyRecord {
  id: string;
  timestamp: string;
  endpoint: string;
  method: 'GET' | 'POST';
  status: number;
  latencyMs: number;
  ok: boolean;
  source: 'api-console' | 'dashboard-ping' | 'verification';
}




