import { WorkspaceInspectionSnapshot } from '../engines/omniLocalEngine';
import {
  ClassifierMode,
  ModelEvaluationSummary,
  TechnicalReportRecord,
} from '../types/vectoria';

export type OmniQuickCommandId =
  | 'calibrate-model'
  | 'generate-report'
  | 'inspect-state'
  | 'clear-history'
  | 'open-reports'
  | 'open-topology';

export interface OmniQuickCommandContext {
  classifierMode: ClassifierMode;
  digitsSummary: ModelEvaluationSummary;
  lettersSummary: ModelEvaluationSummary;
  alphanumericSummary: ModelEvaluationSummary;
  hasPrediction: boolean;
  predictionCount: number;
  simulationCount: number;
  reportCount: number;
  commandHistoryCount: number;
  messageCount: number;
  isTraining: boolean;
  isProcessing: boolean;
}

export interface OmniQuickCommandDescriptor {
  id: OmniQuickCommandId;
  label: string;
  contextHint: string;
  tone: 'primary' | 'secondary' | 'neutral' | 'danger';
  disabled: boolean;
  targetMode?: ClassifierMode;
  epochs?: number;
}

const MODE_LABEL: Record<ClassifierMode, string> = {
  digits: 'Dígitos 0–9',
  letters: 'Letras A–Z',
  alphanumeric: 'Alfanumérico 36',
};

/**
 * Resuelve la lista contextual de Comandos Rápidos para Omni Bot a partir del estado real del estudio.
 */
export function resolveOmniQuickCommands(
  ctx: OmniQuickCommandContext
): OmniQuickCommandDescriptor[] {
  const needsAlphaTraining =
    ctx.classifierMode === 'alphanumeric' && !ctx.alphanumericSummary.isTrained;
  const calibrationMode: ClassifierMode = ctx.classifierMode;
  const calibrationEpochs = needsAlphaTraining ? 12 : 6;
  const targetSummary =
    calibrationMode === 'digits'
      ? ctx.digitsSummary
      : calibrationMode === 'letters'
        ? ctx.lettersSummary
        : ctx.alphanumericSummary;

  const calibrateLabel = needsAlphaTraining ? 'Entrenar y calibrar' : 'Calibrar modelo';
  const calibrateHint = ctx.isTraining
    ? 'Entrenamiento SGD en curso…'
    : needsAlphaTraining
      ? `${MODE_LABEL[calibrationMode]} · ${calibrationEpochs} épocas iniciales`
      : `${MODE_LABEL[calibrationMode]} (${(targetSummary.valAccuracy * 100).toFixed(1)}%) · +${calibrationEpochs} épocas`;

  const historyItemsTotal = ctx.commandHistoryCount + Math.max(0, ctx.messageCount - 1);

  const commands: OmniQuickCommandDescriptor[] = [
    {
      id: 'calibrate-model',
      label: calibrateLabel,
      contextHint: calibrateHint,
      tone: 'primary',
      disabled: ctx.isTraining || ctx.isProcessing,
      targetMode: calibrationMode,
      epochs: calibrationEpochs,
    },
    {
      id: 'generate-report',
      label: 'Generar reporte',
      contextHint: `${ctx.predictionCount} inferencias · ${ctx.simulationCount} sim.`,
      tone: 'secondary',
      disabled: ctx.isProcessing,
    },
    {
      id: 'inspect-state',
      label: 'Inspeccionar estado',
      contextHint: `Modo activo: ${MODE_LABEL[ctx.classifierMode]}`,
      tone: 'neutral',
      disabled: ctx.isProcessing,
    },
    {
      id: 'clear-history',
      label: 'Limpiar historial',
      contextHint:
        historyItemsTotal > 0
          ? `${ctx.commandHistoryCount} cmd · ${ctx.messageCount} turnos`
          : 'Sesión lista',
      tone: 'danger',
      disabled: ctx.isProcessing || ctx.isTraining,
    },
  ];

  if (ctx.reportCount > 0) {
    commands.push({
      id: 'open-reports',
      label: 'Abrir Informes',
      contextHint: `${ctx.reportCount} guardado${ctx.reportCount === 1 ? '' : 's'}`,
      tone: 'neutral',
      disabled: false,
    });
  } else if (ctx.hasPrediction) {
    commands.push({
      id: 'open-topology',
      label: 'Ver en Topología',
      contextHint: 'Inspeccionar propagación',
      tone: 'neutral',
      disabled: false,
    });
  }

  return commands;
}

/**
 * Construye un registro real de informe técnico a partir del estado medido en sesión,
 * sin fabricar métricas para modelos no entrenados.
 */
export function buildOmniTechnicalReport(
  snapshot: WorkspaceInspectionSnapshot,
  counts: {
    predictionCount: number;
    simulationCount: number;
  },
  nowIso = new Date().toISOString()
): TechnicalReportRecord {
  const { digitsSummary, lettersSummary, alphanumericSummary, lastPrediction, mnist784Result, last232Step, lastMathOperation } =
    snapshot;

  const alphaLine = alphanumericSummary.isTrained
    ? `Alfanumérico (36 clases): Entrenado (${alphanumericSummary.epochsTrained} épocas) · Val ${(alphanumericSummary.valAccuracy * 100).toFixed(2)}% · Loss ${alphanumericSummary.finalLoss.toFixed(4)}`
    : 'Alfanumérico (36 clases): Sin entrenar (métricas bloqueadas hasta ejecutar entrenamiento conjunto real).';

  const predLine = lastPrediction
    ? `Última inferencia 16×16: "${lastPrediction.topLabel}" (${(lastPrediction.confidence * 100).toFixed(2)}%, modo ${lastPrediction.mode}, entropía ${lastPrediction.entropy.toFixed(3)} bits)`
    : 'Sin inferencia 16×16 registrada en la sesión actual.';

  const mnistLine = mnist784Result
    ? `Modelo 784–128–10 (Referencia Sintética): Dígito ${mnist784Result.digit} (${(mnist784Result.confidence * 100).toFixed(2)}%), ${mnist784Result.activeNeurons}/128 ReLU activas.`
    : 'Modelo 784–128–10: Sin inferencia reciente.';

  const didacticLine = last232Step
    ? `Simulador 2–3–2: L₀=${last232Step.lossBefore.toFixed(5)} → L₁=${last232Step.lossAfter.toFixed(5)} (error DF=${last232Step.maxFiniteDiffError.toExponential(2)}).`
    : 'Simulador 2–3–2: Sin paso ejecutado todavía.';

  const mathLine = lastMathOperation
    ? `Última operación lineal: ${lastMathOperation.operation} (${lastMathOperation.resultLabel}) · ${lastMathOperation.verification}`
    : 'Sin operación de Álgebra Lineal registrada en sesión.';

  const results = [
    `Dígitos (0–9): ${digitsSummary.epochsTrained} épocas · Val ${(digitsSummary.valAccuracy * 100).toFixed(2)}% · Loss ${digitsSummary.finalLoss.toFixed(4)}`,
    `Letras (A–Z): ${lettersSummary.epochsTrained} épocas · Val ${(lettersSummary.valAccuracy * 100).toFixed(2)}% · Loss ${lettersSummary.finalLoss.toFixed(4)}`,
    alphaLine,
    predLine,
    mnistLine,
    didacticLine,
    mathLine,
    `Conteo de sesión: ${counts.predictionCount} inferencias · ${counts.simulationCount} simulaciones.`,
  ].join('\n');

  const modelInfo = `0–9 (${digitsSummary.parameterCount} params) | A–Z (${lettersSummary.parameterCount} params) | 36-clases (${alphanumericSummary.isTrained ? `${(alphanumericSummary.valAccuracy * 100).toFixed(1)}%` : 'pendiente'})`;

  const dateTag = nowIso.slice(0, 16).replace('T', ' ');
  return {
    id: `rep-omni-${Date.now()}`,
    createdAt: nowIso,
    title: `Reporte Omni Bot · Estado del Estudio (${dateTag})`,
    objectives:
      'Consolidar métricas reales verificadas de los clasificadores MLP, inferencias recientes y operaciones de álgebra lineal desde Omni Bot.',
    parameters: `Módulo activo: ${snapshot.activeModule} | Tasa base SGD: η=0.005, μ=0.85 | Inferencias=${counts.predictionCount} | Simulaciones=${counts.simulationCount}`,
    procedure:
      '1. Lectura directa de resúmenes en StudioContext.\n2. Inspección de historiales reales de entrenamiento y validación.\n3. Registro verificable en Centro de Investigación e Informes Técnicos.',
    formulas:
      'Z⁽ˡ⁾ = W⁽ˡ⁾A⁽ˡ⁻¹⁾ + b⁽ˡ⁾, A⁽ˡ⁾ = ReLU(Z⁽ˡ⁾), ŷ = Softmax(Z⁽ᴸ⁾), L = -Σ yᵢ log(ŷᵢ)',
    results,
    analysis: alphanumericSummary.isTrained
      ? `Los tres clasificadores 16×16 disponen de métricas reales medidas en validación. Dígitos=${(digitsSummary.valAccuracy * 100).toFixed(1)}%, Letras=${(lettersSummary.valAccuracy * 100).toFixed(1)}%, Combinado=${(alphanumericSummary.valAccuracy * 100).toFixed(1)}%.`
      : `Dígitos (${(digitsSummary.valAccuracy * 100).toFixed(1)}%) y Letras (${(lettersSummary.valAccuracy * 100).toFixed(1)}%) se encuentran calibrados; el modelo combinado de 36 clases permanece sin entrenar hasta ejecutar entrenamiento conjunto.`,
    conclusions:
      'Reporte generado automáticamente con integridad matemática estricta desde los motores activos de VectorIA Studio.',
    modelInfo,
  };
}

export function formatCalibrationAssistantMessage(params: {
  mode: ClassifierMode;
  epochsAdded: number;
  before: ModelEvaluationSummary;
  after: ModelEvaluationSummary;
}): string {
  const { mode, epochsAdded, before, after } = params;
  const beforeAcc = before.isTrained ? `${(before.valAccuracy * 100).toFixed(2)}%` : 'Sin entrenar';
  const afterAcc = `${(after.valAccuracy * 100).toFixed(2)}%`;
  const beforeLoss = before.isTrained ? before.finalLoss.toFixed(4) : 'N/A';
  const afterLoss = after.finalLoss.toFixed(4);

  return [
    `Calibración completada — Modelo ${MODE_LABEL[mode]} (+${epochsAdded} épocas SGD, η=0.005, μ=0.85):`,
    `- Épocas acumuladas: ${before.epochsTrained} → ${after.epochsTrained}`,
    `- Exactitud de validación: ${beforeAcc} → ${afterAcc}`,
    `- Pérdida final (Cross-Entropy): ${beforeLoss} → ${afterLoss}`,
    `- Parámetros activos: ${after.parameterCount.toLocaleString('es-MX')} (${after.architecture})`,
  ].join('\n');
}

export function formatReportAssistantMessage(report: TechnicalReportRecord): string {
  return [
    `Reporte técnico generado y guardado: "${report.title}"`,
    ``,
    report.results,
    ``,
    `Puedes editarlo o exportarlo a Markdown, JSON o PDF desde el módulo Informes Técnicos.`,
  ].join('\n');
}
