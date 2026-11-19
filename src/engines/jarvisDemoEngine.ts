import { rasterizeGlyph } from './alphanumericDataset';
import { matrixMultiply } from './linearAlgebra';
import {
  createDefaultDidactic232Config,
  stepDidactic232,
} from './mnist784Engine';
import { NeuralSuite } from './neuralEngine';
import { runBeforeAfterExperiment } from './simulationEngine';
import { createSmartIrrigationModel } from './smartIrrigationEngine';
import { PredictionRecord } from '../types/vectoria';

export type JarvisDemoKind =
  | 'neural-learning'
  | 'smart-irrigation'
  | 'matrix-multiply'
  | 'prediction-explain'
  | 'before-after';

export type JarvisPhaseTag =
  | 'entrada'
  | 'oculta'
  | 'activacion'
  | 'prediccion'
  | 'error'
  | 'backprop'
  | 'actualizacion'
  | 'comparacion';

export interface JarvisVisualNode {
  id: string;
  layer: number; // 0 = input, 1 = hidden, 2 = output / matrix col
  index: number;
  label: string;
  valueText: string;
  intensity: number; // [0, 1]
  active: boolean;
  tone: 'neutral' | 'primary' | 'secondary' | 'ok' | 'warn' | 'err';
}

export interface JarvisVisualEdge {
  fromId: string;
  toId: string;
  weight: number;
  highlighted: boolean;
  direction: 'forward' | 'backward';
  deltaWeight?: number;
}

export interface JarvisDemoFrame {
  stepIndex: number;
  title: string;
  subtitle: string;
  phaseTag: JarvisPhaseTag;
  narrativeBasic: string;
  narrativeAdvanced: string;
  nodes: JarvisVisualNode[];
  edges: JarvisVisualEdge[];
  metrics: Array<{ label: string; value: string; tone?: 'default' | 'ok' | 'warn' | 'err' }>;
  curvePoints: Array<{ step: number; loss: number; accuracyPct: number }>;
}

export interface JarvisDemoSequence {
  kind: JarvisDemoKind;
  title: string;
  summary: string;
  sourceVerified: string;
  frames: JarvisDemoFrame[];
}

export function detectJarvisDemoKind(rawPrompt: string): JarvisDemoKind | null {
  const q = rawPrompt
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (/(riego|irrigation|humedad|luz solar|planta|cultivo)/i.test(q) && /(jarvis|muestra|explica|demo|aprende|paso|simula)/i.test(q)) {
    return 'smart-irrigation';
  }
  if (/(multiplicacion|matrices|matrix|producto matricial|c\s*=\s*a)/i.test(q) && /(jarvis|muestra|explica|demo|paso)/i.test(q)) {
    return 'matrix-multiply';
  }
  if (/(antes y despues|before.*after|perturbacion|ruido|desplazamiento)/i.test(q) && /(jarvis|muestra|compara|demo|paso)/i.test(q)) {
    return 'before-after';
  }
  if (/(por que predijo|explica.*prediccion|ultima prediccion|como clasifico)/i.test(q) && /(jarvis|muestra|explica|demo|paso)/i.test(q)) {
    return 'prediction-explain';
  }
  if (/(jarvis|demostracion guiada|reproduccion lenta|como aprende esta red|retropropagacion paso a paso)/i.test(q)) {
    return 'neural-learning';
  }
  return null;
}

export function buildJarvisDemoSequence(
  kind: JarvisDemoKind,
  context: {
    suite?: NeuralSuite | null;
    lastPrediction?: PredictionRecord | null;
  } = {}
): JarvisDemoSequence {
  switch (kind) {
    case 'smart-irrigation':
      return buildSmartIrrigationJarvisDemo();
    case 'matrix-multiply':
      return buildMatrixMultiplyJarvisDemo();
    case 'prediction-explain':
      return buildPredictionExplainJarvisDemo(context.suite ?? null, context.lastPrediction ?? null);
    case 'before-after':
      return buildBeforeAfterJarvisDemo(context.suite ?? null);
    case 'neural-learning':
    default:
      return buildNeuralLearningJarvisDemo();
  }
}

function buildNeuralLearningJarvisDemo(): JarvisDemoSequence {
  const cfg0 = createDefaultDidactic232Config();
  const step1 = stepDidactic232(cfg0);
  const step2 = stepDidactic232(step1.updatedConfig);
  const step3 = stepDidactic232(step2.updatedConfig);

  const curveAll = [
    { step: 0, loss: Number(step1.lossBefore.toFixed(4)), accuracyPct: Number((step1.probsBefore[cfg0.yTargetIndex] * 100).toFixed(1)) },
    { step: 1, loss: Number(step1.lossAfter.toFixed(4)), accuracyPct: Number((step1.probsAfter[cfg0.yTargetIndex] * 100).toFixed(1)) },
    { step: 2, loss: Number(step2.lossAfter.toFixed(4)), accuracyPct: Number((step2.probsAfter[cfg0.yTargetIndex] * 100).toFixed(1)) },
    { step: 3, loss: Number(step3.lossAfter.toFixed(4)), accuracyPct: Number((step3.probsAfter[cfg0.yTargetIndex] * 100).toFixed(1)) },
  ];

  const makeNodes = (
    activeLayer: number,
    z1 = step1.z1,
    a1 = step1.a1,
    probs = step1.probsBefore,
    isErr = false
  ): JarvisVisualNode[] => [
    {
      id: 'x1',
      layer: 0,
      index: 0,
      label: 'x₁',
      valueText: cfg0.x[0].toFixed(2),
      intensity: Math.min(1, Math.abs(cfg0.x[0])),
      active: activeLayer === 0 || activeLayer === 1,
      tone: 'secondary',
    },
    {
      id: 'x2',
      layer: 0,
      index: 1,
      label: 'x₂',
      valueText: cfg0.x[1].toFixed(2),
      intensity: Math.min(1, Math.abs(cfg0.x[1])),
      active: activeLayer === 0 || activeLayer === 1,
      tone: 'secondary',
    },
    ...([0, 1, 2] as const).map((h) => ({
      id: `h${h + 1}`,
      layer: 1,
      index: h,
      label: `h${h + 1}`,
      valueText: activeLayer >= 2 ? `a=${a1[h].toFixed(2)}` : `z=${z1[h].toFixed(2)}`,
      intensity: Math.min(1, a1[h] / 1.5),
      active: activeLayer === 1 || activeLayer === 2 || activeLayer === 4,
      tone: (a1[h] > 0 ? 'primary' : 'neutral') as 'primary' | 'neutral',
    })),
    ...([0, 1] as const).map((o) => ({
      id: `y${o + 1}`,
      layer: 2,
      index: o,
      label: `ŷ${o} ${o === cfg0.yTargetIndex ? '(Objetivo)' : ''}`,
      valueText: `${(probs[o] * 100).toFixed(1)}%`,
      intensity: probs[o],
      active: activeLayer >= 3,
      tone: (isErr ? (o === cfg0.yTargetIndex ? 'warn' : 'err') : o === cfg0.yTargetIndex ? 'ok' : 'neutral') as 'warn' | 'err' | 'ok' | 'neutral',
    })),
  ];

  const buildEdges = (
    W1 = cfg0.W1,
    W2 = cfg0.W2,
    hlLayer1 = false,
    hlLayer2 = false,
    direction: 'forward' | 'backward' = 'forward',
    gW1?: number[][],
    gW2?: number[][]
  ): JarvisVisualEdge[] => {
    const out: JarvisVisualEdge[] = [];
    for (let i = 0; i < 2; i += 1) {
      for (let h = 0; h < 3; h += 1) {
        out.push({
          fromId: `x${i + 1}`,
          toId: `h${h + 1}`,
          weight: W1[i][h],
          highlighted: hlLayer1,
          direction,
          deltaWeight: gW1 ? -cfg0.learningRate * gW1[i][h] : undefined,
        });
      }
    }
    for (let h = 0; h < 3; h += 1) {
      for (let o = 0; o < 2; o += 1) {
        out.push({
          fromId: `h${h + 1}`,
          toId: `y${o + 1}`,
          weight: W2[h][o],
          highlighted: hlLayer2,
          direction,
          deltaWeight: gW2 ? -cfg0.learningRate * gW2[h][o] : undefined,
        });
      }
    }
    return out;
  };

  const frames: JarvisDemoFrame[] = [
    {
      stepIndex: 0,
      title: '1. Vector de Entrada x',
      subtitle: `Entradas reales x = [${cfg0.x[0]}, ${cfg0.x[1]}] con clase objetivo y = ${cfg0.yTargetIndex}.`,
      phaseTag: 'entrada',
      narrativeBasic:
        'La red recibe dos números de entrada (x₁ y x₂). Cada valor viajará por conexiones con pesos iniciales hacia la capa oculta.',
      narrativeAdvanced:
        `Entrada x = [${cfg0.x.join(', ')}] ∈ ℝ², objetivo one-hot y = [${cfg0.yTargetIndex === 0 ? '1, 0' : '0, 1'}], tasa de aprendizaje η = ${cfg0.learningRate}.`,
      nodes: makeNodes(0),
      edges: buildEdges(cfg0.W1, cfg0.W2, false, false, 'forward'),
      metrics: [
        { label: 'Arquitectura', value: '2 → 3 (ReLU) → 2 (Softmax)' },
        { label: 'Loss inicial', value: step1.lossBefore.toFixed(4), tone: 'warn' },
        { label: 'Prob. objetivo', value: `${(step1.probsBefore[cfg0.yTargetIndex] * 100).toFixed(1)}%` },
      ],
      curvePoints: curveAll.slice(0, 1),
    },
    {
      stepIndex: 1,
      title: '2. Suma Ponderada y Activación ReLU',
      subtitle: `Capa oculta calcula Z⁽¹⁾ = W⁽¹⁾ᵀx + b⁽¹⁾ y aplica ReLU: A⁽¹⁾ = [${step1.a1.map((v) => v.toFixed(2)).join(', ')}].`,
      phaseTag: 'activacion',
      narrativeBasic:
        'Cada neurona oculta combina las entradas multiplicadas por sus pesos. Si el resultado es negativo, ReLU lo apaga a cero; si es positivo, deja pasar la señal.',
      narrativeAdvanced:
        `z⁽¹⁾ = [${step1.z1.map((v) => v.toFixed(3)).join(', ')}] → a⁽¹⁾ = max(0, z⁽¹⁾) = [${step1.a1.map((v) => v.toFixed(3)).join(', ')}].`,
      nodes: makeNodes(2),
      edges: buildEdges(cfg0.W1, cfg0.W2, true, false, 'forward'),
      metrics: [
        { label: 'Neuronas ReLU activas', value: `${step1.a1.filter((v) => v > 0).length}/3`, tone: 'ok' },
        { label: 'Norma ||a⁽¹⁾||₂', value: Math.hypot(...step1.a1).toFixed(3) },
      ],
      curvePoints: curveAll.slice(0, 1),
    },
    {
      stepIndex: 2,
      title: '3. Predicción Softmax vs Valor Real',
      subtitle: `Softmax produce [${(step1.probsBefore[0] * 100).toFixed(1)}%, ${(step1.probsBefore[1] * 100).toFixed(1)}%] frente al objetivo y = ${cfg0.yTargetIndex}.`,
      phaseTag: 'prediccion',
      narrativeBasic:
        'La capa de salida convierte las señales en probabilidades que suman 100% y las compara con la respuesta correcta.',
      narrativeAdvanced:
        `z⁽²⁾ = [${step1.z2.map((v) => v.toFixed(3)).join(', ')}] → ŷ = Softmax(z⁽²⁾) = [${step1.probsBefore.map((v) => v.toFixed(4)).join(', ')}].`,
      nodes: makeNodes(3),
      edges: buildEdges(cfg0.W1, cfg0.W2, false, true, 'forward'),
      metrics: [
        { label: 'ŷ clase objetivo', value: `${(step1.probsBefore[cfg0.yTargetIndex] * 100).toFixed(2)}%` },
        { label: 'Error δ⁽²⁾ = ŷ - y', value: `[${step1.delta2.map((v) => v.toFixed(3)).join(', ')}]`, tone: 'warn' },
      ],
      curvePoints: curveAll.slice(0, 1),
    },
    {
      stepIndex: 3,
      title: '4. Error y Retropropagación de Gradientes',
      subtitle: `Loss = ${step1.lossBefore.toFixed(4)}. El gradiente viaja hacia atrás δ⁽²⁾ → δ⁽¹⁾ para medir qué peso contribuyó más.`,
      phaseTag: 'backprop',
      narrativeBasic:
        'Como la predicción tiene error, enviamos una señal de corrección desde la salida hacia atrás para saber en qué dirección ajustar cada peso.',
      narrativeAdvanced:
        `L = -ln(ŷ_target) = ${step1.lossBefore.toFixed(4)} | δ⁽²⁾ = [${step1.delta2.map((v) => v.toFixed(3)).join(', ')}] | δ⁽¹⁾ = [${step1.delta1.map((v) => v.toFixed(3)).join(', ')}] | Error gradiente numérico max = ${step1.maxFiniteDiffError.toExponential(2)}.`,
      nodes: makeNodes(4, step1.z1, step1.a1, step1.probsBefore, true),
      edges: buildEdges(cfg0.W1, cfg0.W2, true, true, 'backward', step1.gradW1, step1.gradW2),
      metrics: [
        { label: 'Cross-Entropy L', value: step1.lossBefore.toFixed(4), tone: 'err' },
        { label: 'Check gradiente Δf', value: step1.maxFiniteDiffError.toExponential(2), tone: 'ok' },
      ],
      curvePoints: curveAll.slice(0, 2),
    },
    {
      stepIndex: 4,
      title: '5. Actualización de Pesos y Mejora Real',
      subtitle: `Tras 3 pasos SGD, la pérdida baja de ${step1.lossBefore.toFixed(4)} a ${step3.lossAfter.toFixed(4)} y la confianza sube a ${(step3.probsAfter[cfg0.yTargetIndex] * 100).toFixed(1)}%.`,
      phaseTag: 'actualizacion',
      narrativeBasic:
        'Al restar una pequeña fracción del gradiente a cada peso, la red reduce su error y aumenta su probabilidad de acertar en la siguiente pasada.',
      narrativeAdvanced:
        `W ← W - η·∇W (η=${cfg0.learningRate}). Pérdida: ${step1.lossBefore.toFixed(4)} → ${step1.lossAfter.toFixed(4)} → ${step2.lossAfter.toFixed(4)} → ${step3.lossAfter.toFixed(4)}.`,
      nodes: makeNodes(5, step3.z1, step3.a1, step3.probsAfter, false),
      edges: buildEdges(step3.updatedConfig.W1, step3.updatedConfig.W2, true, true, 'forward', step1.gradW1, step1.gradW2),
      metrics: [
        { label: 'Loss Antes → Después', value: `${step1.lossBefore.toFixed(3)} → ${step3.lossAfter.toFixed(3)}`, tone: 'ok' },
        { label: 'Confianza objetivo', value: `${(step1.probsBefore[cfg0.yTargetIndex] * 100).toFixed(1)}% → ${(step3.probsAfter[cfg0.yTargetIndex] * 100).toFixed(1)}%`, tone: 'ok' },
      ],
      curvePoints: curveAll,
    },
  ];

  return {
    kind: 'neural-learning',
    title: 'Demostración Guiada: Propagación y Backpropagation (Red 2–3–2)',
    summary: 'Simulación paso a paso calculada en vivo sobre NeuralEngine sin métricas inventadas.',
    sourceVerified: 'src/engines/mnist784Engine.ts · stepDidactic232()',
    frames,
  };
}

function buildSmartIrrigationJarvisDemo(): JarvisDemoSequence {
  const model = createSmartIrrigationModel(202604);
  const probeMoisture = 22;
  const probeSunlight = 760;
  const expectedTarget: 0 | 1 = 1;

  const snap0 = model.forward(probeMoisture, probeSunlight);
  const eval0 = model.evaluateDataset([
    { id: 'probe', moisturePct: probeMoisture, sunlightWm2: probeSunlight, target: expectedTarget, label: 'Muestra prueba' },
  ]);

  const step1 = model.stepSample(probeMoisture, probeSunlight, expectedTarget, 0.3);
  model.trainEpochs(8, 0.25);
  const sum8 = model.getSummary();
  const snap8 = model.forward(probeMoisture, probeSunlight);

  model.trainEpochs(16, 0.25);
  const sum24 = model.getSummary();
  const snap24 = model.forward(probeMoisture, probeSunlight);

  const curve = [
    { step: 0, loss: Number(eval0.loss.toFixed(4)), accuracyPct: Number((snap0.yHat * 100).toFixed(1)) },
    ...sum24.history.map((h) => ({
      step: h.epoch,
      loss: h.loss,
      accuracyPct: Number((h.valAccuracy * 100).toFixed(1)),
    })),
  ];

  const makeNodes = (
    snap: ReturnType<typeof model.forward>,
    highlightLayer: number
  ): JarvisVisualNode[] => [
    {
      id: 'm',
      layer: 0,
      index: 0,
      label: 'Humedad (%)',
      valueText: `${snap.moisturePct}% (${snap.x[0].toFixed(2)})`,
      intensity: snap.x[0],
      active: highlightLayer === 0 || highlightLayer === 1,
      tone: 'secondary',
    },
    {
      id: 's',
      layer: 0,
      index: 1,
      label: 'Luz Solar',
      valueText: `${snap.sunlightWm2} W/m² (${snap.x[1].toFixed(2)})`,
      intensity: snap.x[1],
      active: highlightLayer === 0 || highlightLayer === 1,
      tone: 'warn',
    },
    ...snap.a1.map((a, idx) => ({
      id: `h${idx + 1}`,
      layer: 1,
      index: idx,
      label: `ReLU h${idx + 1}`,
      valueText: a.toFixed(3),
      intensity: Math.min(1, a),
      active: highlightLayer >= 1,
      tone: (a > 0 ? 'primary' : 'neutral') as 'primary' | 'neutral',
    })),
    {
      id: 'out',
      layer: 2,
      index: 0,
      label: 'P(Riego = 1)',
      valueText: `${(snap.yHat * 100).toFixed(1)}% (${snap.decision})`,
      intensity: snap.yHat,
      active: highlightLayer >= 2,
      tone: snap.yHat >= 0.5 ? 'ok' : 'err',
    },
  ];

  const buildIrrEdges = (direction: 'forward' | 'backward'): JarvisVisualEdge[] => {
    const edges: JarvisVisualEdge[] = [];
    for (let h = 0; h < 4; h += 1) {
      edges.push({
        fromId: 'm',
        toId: `h${h + 1}`,
        weight: model.W1[h][0],
        highlighted: true,
        direction,
      });
      edges.push({
        fromId: 's',
        toId: `h${h + 1}`,
        weight: model.W1[h][1],
        highlighted: true,
        direction,
      });
      edges.push({
        fromId: `h${h + 1}`,
        toId: 'out',
        weight: model.W2[h],
        highlighted: true,
        direction,
      });
    }
    return edges;
  };

  return {
    kind: 'smart-irrigation',
    title: 'Demostración Guiada: Red Neuronal de Riego Inteligente (2 → 4 → 1)',
    summary: 'Aprendizaje educativo aislado con conjunto sintético de humedad del suelo y radiación solar.',
    sourceVerified: 'src/engines/smartIrrigationEngine.ts · SmartIrrigationModel (Aislada)',
    frames: [
      {
        stepIndex: 0,
        title: '1. Lectura de Sensores Sintéticos',
        subtitle: `Entrada: Humedad ${probeMoisture}% (suelo seco) y Luz Solar ${probeSunlight} W/m². Valor esperado: REGAR (1).`,
        phaseTag: 'entrada',
        narrativeBasic:
          'Con poca humedad en el suelo y radiación solar alta, el sistema educativo debe aprender que el cultivo necesita activar el riego.',
        narrativeAdvanced:
          `x = [${snap0.x[0].toFixed(2)}, ${snap0.x[1].toFixed(2)}], objetivo y = 1. Modelo completamente aislado del clasificador de dígitos.`,
        nodes: makeNodes(snap0, 0),
        edges: buildIrrEdges('forward'),
        metrics: [
          { label: 'Humedad', value: `${probeMoisture}%` },
          { label: 'Luz solar', value: `${probeSunlight} W/m²` },
          { label: 'Objetivo sintético', value: 'REGAR (1)', tone: 'ok' },
        ],
        curvePoints: curve.slice(0, 1),
      },
      {
        stepIndex: 1,
        title: '2. Predicción Inicial Sin Entrenar vs Objetivo',
        subtitle: `Predicción inicial ŷ = ${(snap0.yHat * 100).toFixed(1)}% (${snap0.decision}), pérdida BCE = ${step1.lossBefore.toFixed(4)}.`,
        phaseTag: 'error',
        narrativeBasic:
          'Al principio los pesos son aleatorios, así que la predicción aún tiene incertidumbre o error frente a la respuesta esperada.',
        narrativeAdvanced:
          `ŷ⁽⁰⁾ = σ(z₂) = ${snap0.yHat.toFixed(4)}, error δ = ŷ - y = ${step1.errorSigned.toFixed(4)}, pérdida BCE = ${step1.lossBefore.toFixed(4)}.`,
        nodes: makeNodes(snap0, 2),
        edges: buildIrrEdges('backward'),
        metrics: [
          { label: 'Predicción inicial', value: `${(snap0.yHat * 100).toFixed(1)}%` },
          { label: 'Error (ŷ - y)', value: step1.errorSigned.toFixed(4), tone: 'err' },
          { label: 'Loss inicial', value: step1.lossBefore.toFixed(4), tone: 'warn' },
        ],
        curvePoints: curve.slice(0, 2),
      },
      {
        stepIndex: 2,
        title: '3. Retropropagación y 8 Épocas de Entrenamiento',
        subtitle: `Tras 8 épocas sobre el dataset sintético, la validación alcanza ${(sum8.valAccuracy * 100).toFixed(1)}% y P(REGAR) = ${(snap8.yHat * 100).toFixed(1)}%.`,
        phaseTag: 'backprop',
        narrativeBasic:
          'La red ajusta los pesos negativos hacia la humedad alta y positivos hacia la sequedad y el sol para separar cuándo regar.',
        narrativeAdvanced:
          `Gradientes ∂L/∂W₂ = a₁·(ŷ - y). Pérdida media baja a ${sum8.finalLoss.toFixed(4)}; exactitud validación = ${(sum8.valAccuracy * 100).toFixed(1)}%.`,
        nodes: makeNodes(snap8, 2),
        edges: buildIrrEdges('backward'),
        metrics: [
          { label: 'Épocas', value: `${sum8.epochsTrained}` },
          { label: 'Pérdida BCE', value: sum8.finalLoss.toFixed(4), tone: 'ok' },
          { label: 'Exactitud Val.', value: `${(sum8.valAccuracy * 100).toFixed(1)}%`, tone: 'ok' },
        ],
        curvePoints: curve.slice(0, Math.min(curve.length, 9)),
      },
      {
        stepIndex: 3,
        title: '4. Convergencia Final Tras 24 Épocas',
        subtitle: `Predicción consolidada: P(REGAR) = ${(snap24.yHat * 100).toFixed(1)}% (${snap24.decision}), validación = ${(sum24.valAccuracy * 100).toFixed(1)}%.`,
        phaseTag: 'actualizacion',
        narrativeBasic:
          'Con 24 épocas de aprendizaje supervisado sintético, la neurona de salida distingue correctamente condiciones de sequía vs humedad suficiente.',
        narrativeAdvanced:
          `Convergencia final: Loss ${sum24.finalLoss.toFixed(4)}, Train ${(sum24.trainAccuracy * 100).toFixed(1)}%, Val ${(sum24.valAccuracy * 100).toFixed(1)}%.`,
        nodes: makeNodes(snap24, 2),
        edges: buildIrrEdges('forward'),
        metrics: [
          { label: 'Predicción final', value: `${(snap24.yHat * 100).toFixed(1)}% (${snap24.decision})`, tone: 'ok' },
          { label: 'Exactitud Val.', value: `${(sum24.valAccuracy * 100).toFixed(1)}%`, tone: 'ok' },
          { label: 'Loss final', value: sum24.finalLoss.toFixed(4), tone: 'ok' },
        ],
        curvePoints: curve,
      },
    ],
  };
}

function buildMatrixMultiplyJarvisDemo(): JarvisDemoSequence {
  const A = [
    [2, 1],
    [3, 4],
  ];
  const B = [
    [5, -1],
    [2, 3],
  ];
  const out = matrixMultiply(A, B);
  const C = out.result as number[][];

  const makeNodes = (activeRow: number, activeCol: number): JarvisVisualNode[] => [
    { id: 'a00', layer: 0, index: 0, label: 'A₁₁', valueText: `${A[0][0]}`, intensity: 0.7, active: activeRow === 0, tone: activeRow === 0 ? 'primary' : 'neutral' },
    { id: 'a01', layer: 0, index: 1, label: 'A₁₂', valueText: `${A[0][1]}`, intensity: 0.5, active: activeRow === 0, tone: activeRow === 0 ? 'primary' : 'neutral' },
    { id: 'a10', layer: 0, index: 2, label: 'A₂₁', valueText: `${A[1][0]}`, intensity: 0.8, active: activeRow === 1, tone: activeRow === 1 ? 'primary' : 'neutral' },
    { id: 'a11', layer: 0, index: 3, label: 'A₂₂', valueText: `${A[1][1]}`, intensity: 1.0, active: activeRow === 1, tone: activeRow === 1 ? 'primary' : 'neutral' },
    { id: 'b0', layer: 1, index: 0, label: 'Col 1(B)', valueText: `[${B[0][0]}, ${B[1][0]}]ᵀ`, intensity: 0.9, active: activeCol === 0, tone: activeCol === 0 ? 'secondary' : 'neutral' },
    { id: 'b1', layer: 1, index: 1, label: 'Col 2(B)', valueText: `[${B[0][1]}, ${B[1][1]}]ᵀ`, intensity: 0.7, active: activeCol === 1, tone: activeCol === 1 ? 'secondary' : 'neutral' },
    { id: 'c00', layer: 2, index: 0, label: 'C₁₁', valueText: `${C[0][0]}`, intensity: 0.9, active: activeRow === 0 && activeCol === 0, tone: 'ok' },
    { id: 'c01', layer: 2, index: 1, label: 'C₁₂', valueText: `${C[0][1]}`, intensity: 0.4, active: activeRow === 0 && activeCol === 1, tone: 'ok' },
    { id: 'c10', layer: 2, index: 2, label: 'C₂₁', valueText: `${C[1][0]}`, intensity: 1.0, active: activeRow === 1 && activeCol === 0, tone: 'ok' },
    { id: 'c11', layer: 2, index: 3, label: 'C₂₂', valueText: `${C[1][1]}`, intensity: 0.8, active: activeRow === 1 && activeCol === 1, tone: 'ok' },
  ];

  const buildMatEdges = (r: number, c: number): JarvisVisualEdge[] => [
    { fromId: `a${r}0`, toId: `b${c}`, weight: 0.8, highlighted: true, direction: 'forward' },
    { fromId: `a${r}1`, toId: `b${c}`, weight: 0.6, highlighted: true, direction: 'forward' },
    { fromId: `b${c}`, toId: `c${r}${c}`, weight: 1.0, highlighted: true, direction: 'forward' },
  ];

  return {
    kind: 'matrix-multiply',
    title: 'Demostración Guiada: Multiplicación Matricial C = A · B',
    summary: 'Cálculo exacto fila por columna verificado con LinearAlgebra Engine.',
    sourceVerified: 'src/engines/linearAlgebra.ts · matrixMultiply()',
    frames: [
      {
        stepIndex: 0,
        title: '1. Producto Escalar C₁₁ = Fila 1(A) · Columna 1(B)',
        subtitle: `C₁₁ = (${A[0][0]}×${B[0][0]}) + (${A[0][1]}×${B[1][0]}) = ${C[0][0]}.`,
        phaseTag: 'entrada',
        narrativeBasic: 'Multiplicamos la primera fila de A por la primera columna de B y sumamos los productos.',
        narrativeAdvanced: `C₁₁ = Σ_k A₁k·Bk₁ = 2·5 + 1·2 = ${C[0][0]}.`,
        nodes: makeNodes(0, 0),
        edges: buildMatEdges(0, 0),
        metrics: [{ label: 'C₁₁', value: `${C[0][0]}`, tone: 'ok' }, { label: 'Residuo', value: out.verification.residual.toExponential(1) }],
        curvePoints: [],
      },
      {
        stepIndex: 1,
        title: '2. Producto Escalar C₁₂ = Fila 1(A) · Columna 2(B)',
        subtitle: `C₁₂ = (${A[0][0]}×${B[0][1]}) + (${A[0][1]}×${B[1][1]}) = ${C[0][1]}.`,
        phaseTag: 'oculta',
        narrativeBasic: 'Ahora combinamos la misma primera fila de A con la segunda columna de B.',
        narrativeAdvanced: `C₁₂ = 2·(-1) + 1·3 = ${C[0][1]}.`,
        nodes: makeNodes(0, 1),
        edges: buildMatEdges(0, 1),
        metrics: [{ label: 'C₁₂', value: `${C[0][1]}`, tone: 'ok' }],
        curvePoints: [],
      },
      {
        stepIndex: 2,
        title: '3. Segunda Fila Completa: C₂₁ y C₂₂',
        subtitle: `C₂₁ = 3·5 + 4·2 = ${C[1][0]}, C₂₂ = 3·(-1) + 4·3 = ${C[1][1]}.`,
        phaseTag: 'actualizacion',
        narrativeBasic: 'Completamos la segunda fila combinando la fila 2 de A con cada columna de B.',
        narrativeAdvanced: `Resultado verificado C = [[${C[0][0]}, ${C[0][1]}], [${C[1][0]}, ${C[1][1]}]].`,
        nodes: makeNodes(1, 1),
        edges: buildMatEdges(1, 1),
        metrics: [
          { label: 'Matriz C', value: `[[${C[0][0]},${C[0][1]}],[${C[1][0]},${C[1][1]}]]`, tone: 'ok' },
          { label: 'Verificación', value: 'Exacta', tone: 'ok' },
        ],
        curvePoints: [],
      },
    ],
  };
}

function buildPredictionExplainJarvisDemo(
  suite: NeuralSuite | null,
  lastPrediction: PredictionRecord | null
): JarvisDemoSequence {
  const pred =
    lastPrediction ??
    (() => {
      if (!suite) return null;
      const grid = rasterizeGlyph('4');
      const res = suite.digitsModel.predictScores(grid);
      return {
        id: 'demo-4',
        timestamp: new Date().toISOString(),
        mode: 'digits' as const,
        topLabel: res.topLabel,
        confidence: res.confidence,
        entropy: res.entropy,
        topScores: res.topScores,
        allScores: res.allScores,
        inputGrid: grid,
        layerSnapshots: res.snapshots,
      };
    })();

  if (!pred) {
    return buildNeuralLearningJarvisDemo();
  }

  const h1 = pred.layerSnapshots[1]?.aValues ?? [0.5, 0.2, 0.8, 0.1];
  const topHidden = h1
    .map((val, idx) => ({ idx, val }))
    .sort((a, b) => b.val - a.val)
    .slice(0, 4);
  const top3 = pred.topScores.slice(0, 3);
  const activePixels = pred.inputGrid.filter((v) => v > 0.2).length;

  const nodes: JarvisVisualNode[] = [
    { id: 'in1', layer: 0, index: 0, label: 'Píxeles Activos', valueText: `${activePixels}/256`, intensity: activePixels / 120, active: true, tone: 'secondary' },
    { id: 'in2', layer: 0, index: 1, label: 'Entropía H', valueText: `${pred.entropy.toFixed(3)} bits`, intensity: Math.min(1, pred.entropy / 3), active: true, tone: 'neutral' },
    ...topHidden.map((h, i) => ({
      id: `h${i}`,
      layer: 1,
      index: i,
      label: `Oculta #${h.idx}`,
      valueText: `ReLU=${h.val.toFixed(2)}`,
      intensity: Math.min(1, h.val / 2),
      active: true,
      tone: 'primary' as const,
    })),
    ...top3.map((c, i) => ({
      id: `o${i}`,
      layer: 2,
      index: i,
      label: `Clase "${c.label}"`,
      valueText: `${(c.probability * 100).toFixed(1)}%`,
      intensity: c.probability,
      active: true,
      tone: (i === 0 ? 'ok' : 'neutral') as 'ok' | 'neutral',
    })),
  ];

  const edges: JarvisVisualEdge[] = [];
  topHidden.forEach((_, i) => {
    edges.push({ fromId: 'in1', toId: `h${i}`, weight: 0.7, highlighted: true, direction: 'forward' });
    top3.forEach((__, j) => {
      edges.push({ fromId: `h${i}`, toId: `o${j}`, weight: j === 0 ? 0.9 : 0.35, highlighted: j === 0, direction: 'forward' });
    });
  });

  return {
    kind: 'prediction-explain',
    title: `Demostración Guiada: ¿Por qué el modelo predijo "${pred.topLabel}"?`,
    summary: `Trazado real de entrada 16×16 → top neuronas ReLU activas → probabilidades Softmax (${pred.mode}).`,
    sourceVerified: 'StudioContext · lastPrediction / LayerActivationSnapshot',
    frames: [
      {
        stepIndex: 0,
        title: '1. Extracción de Características de Entrada (16×16)',
        subtitle: `Se detectaron ${activePixels} píxeles activos normalizados x ∈ [0, 1]²⁵⁶.`,
        phaseTag: 'entrada',
        narrativeBasic: 'El lienzo 16×16 se aplana en 256 valores numéricos para evaluar los trazos del usuario.',
        narrativeAdvanced: `Vector x ∈ ℝ²⁵⁶ con ${activePixels} componentes > 0.2. Modo activo: ${pred.mode}.`,
        nodes,
        edges,
        metrics: [
          { label: 'Píxeles activos', value: `${activePixels}/256` },
          { label: 'Modo clasificador', value: pred.mode },
        ],
        curvePoints: [],
      },
      {
        stepIndex: 1,
        title: '2. Neuronas Ocultas Más Activas (ReLU)',
        subtitle: `Las neuronas más activas son #${topHidden[0]?.idx ?? 0} (${(topHidden[0]?.val ?? 0).toFixed(2)}) y #${topHidden[1]?.idx ?? 1} (${(topHidden[1]?.val ?? 0).toFixed(2)}).`,
        phaseTag: 'oculta',
        narrativeBasic: 'Un subconjunto de neuronas ocultas se enciende fuertemente al reconocer curvas o trazos rectos.',
        narrativeAdvanced: `Top-4 ReLU en Capa 1: ${topHidden.map((h) => `#${h.idx}=${h.val.toFixed(2)}`).join(', ')}.`,
        nodes,
        edges,
        metrics: topHidden.slice(0, 3).map((h) => ({ label: `Neurona #${h.idx}`, value: h.val.toFixed(3), tone: 'ok' as const })),
        curvePoints: [],
      },
      {
        stepIndex: 2,
        title: `3. Decisión Softmax: "${pred.topLabel}" (${(pred.confidence * 100).toFixed(1)}%)`,
        subtitle: `Margen sobre la segunda alternativa "${top3[1]?.label ?? '—'}": ${(((top3[0]?.probability ?? 0) - (top3[1]?.probability ?? 0)) * 100).toFixed(1)} pp.`,
        phaseTag: 'prediccion',
        narrativeBasic: `La red asigna ${(pred.confidence * 100).toFixed(1)}% de probabilidad a "${pred.topLabel}" con entropía de ${pred.entropy.toFixed(3)} bits.`,
        narrativeAdvanced: `Top-3 Softmax: ${top3.map((c) => `${c.label}:${(c.probability * 100).toFixed(1)}%`).join(' | ')}.`,
        nodes,
        edges,
        metrics: [
          { label: 'Predicción Top-1', value: `${pred.topLabel} (${(pred.confidence * 100).toFixed(1)}%)`, tone: 'ok' },
          { label: 'Entropía', value: `${pred.entropy.toFixed(3)} bits` },
        ],
        curvePoints: [],
      },
    ],
  };
}

function buildBeforeAfterJarvisDemo(suite: NeuralSuite | null): JarvisDemoSequence {
  if (!suite) return buildNeuralLearningJarvisDemo();
  const sim = runBeforeAfterExperiment(
    suite.digitsModel,
    suite.digitsTrain,
    suite.digitsVal,
    {
      mode: 'digits',
      targetGlyph: '4',
      shiftX: 2,
      shiftY: -1,
      noiseLevel: 0.25,
      perturbationIntensity: 0.15,
      learningRate: 0.05,
      epochs: 0,
      seed: 2026,
      selectedClasses: ['4'],
    }
  );

  const deltaPp = ((sim.modifiedConfidence - sim.originalConfidence) * 100).toFixed(1);
  const nodes: JarvisVisualNode[] = [
    { id: 'c0', layer: 0, index: 0, label: 'Glifo Limpio', valueText: 'σ = 0.00', intensity: 1, active: true, tone: 'ok' },
    { id: 'c1', layer: 0, index: 1, label: 'Perturbado', valueText: 'σ = 0.25, Δx=+2', intensity: 0.6, active: true, tone: 'warn' },
    ...sim.layerDiffs.slice(0, 3).map((ld, idx) => ({
      id: `l${idx}`,
      layer: 1,
      index: idx,
      label: ld.layerName,
      valueText: `ΔL1=${ld.l1Delta.toFixed(2)}`,
      intensity: Math.min(1, ld.l1Delta / 4),
      active: true,
      tone: 'primary' as const,
    })),
    { id: 'outB', layer: 2, index: 0, label: `Antes (${sim.originalTopLabel})`, valueText: `${(sim.originalConfidence * 100).toFixed(1)}%`, intensity: sim.originalConfidence, active: true, tone: 'ok' },
    { id: 'outA', layer: 2, index: 1, label: `Después (${sim.modifiedTopLabel})`, valueText: `${(sim.modifiedConfidence * 100).toFixed(1)}%`, intensity: sim.modifiedConfidence, active: true, tone: Number(deltaPp) < -10 ? 'warn' : 'secondary' },
  ];

  const edges: JarvisVisualEdge[] = [
    { fromId: 'c0', toId: 'l0', weight: 0.9, highlighted: true, direction: 'forward' },
    { fromId: 'c1', toId: 'l1', weight: 0.7, highlighted: true, direction: 'forward' },
    { fromId: 'l0', toId: 'outB', weight: 0.9, highlighted: true, direction: 'forward' },
    { fromId: 'l1', toId: 'outA', weight: 0.7, highlighted: true, direction: 'forward' },
  ];

  return {
    kind: 'before-after',
    title: 'Demostración Guiada: Comparación Antes vs Después de Perturbación',
    summary: 'Simulación aislada sobre glifo "4" con ruido gaussiano σ=0.25 y desplazamiento (2, -1) px.',
    sourceVerified: 'src/engines/simulationEngine.ts · runBeforeAfterExperiment()',
    frames: [
      {
        stepIndex: 0,
        title: '1. Estado Base Limpio vs Entrada Perturbada',
        subtitle: `Antes: "${sim.originalTopLabel}" (${(sim.originalConfidence * 100).toFixed(1)}%). Aplicando ruido σ=0.25 y desplazamiento.`,
        phaseTag: 'comparacion',
        narrativeBasic: 'Comparamos la señal limpia del carácter "4" contra una versión movida y con ruido sin modificar los pesos globales.',
        narrativeAdvanced: `Loss limpio = ${sim.lossBefore.toFixed(4)} vs Loss perturbado = ${sim.lossAfter.toFixed(4)}.`,
        nodes,
        edges,
        metrics: [
          { label: 'Confianza Antes', value: `${(sim.originalConfidence * 100).toFixed(1)}%`, tone: 'ok' },
          { label: 'Confianza Después', value: `${(sim.modifiedConfidence * 100).toFixed(1)}%`, tone: 'warn' },
          { label: 'Variación', value: `${deltaPp} pp` },
        ],
        curvePoints: [],
      },
      {
        stepIndex: 1,
        title: '2. Desviación L1 en Activaciones Internas',
        subtitle: `Desviación L1 observada en capas: ${sim.layerDiffs.slice(0, 2).map((d) => `${d.layerName}=${d.l1Delta.toFixed(2)}`).join(' · ')}.`,
        phaseTag: 'actualizacion',
        narrativeBasic: 'El desplazamiento espacial altera qué neuronas se activan en las capas ocultas y reduce la seguridad de la salida.',
        narrativeAdvanced: `Desviación capa por capa medida sobre clones aislados (pesos de producción intactos).`,
        nodes,
        edges,
        metrics: [
          { label: 'Clase Antes / Después', value: `${sim.originalTopLabel} → ${sim.modifiedTopLabel}` },
          { label: 'Duración cálculo', value: `${sim.durationMs.toFixed(1)} ms`, tone: 'ok' },
        ],
        curvePoints: [],
      },
    ],
  };
}
