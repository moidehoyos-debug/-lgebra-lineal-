import {
  buildGlyphDataset,
  createSeededRng,
  DatasetSample,
  DIGIT_LABELS,
  INPUT_DIM,
  LETTER_LABELS,
} from './alphanumericDataset';
import {
  ALPHANUMERIC_COMBINED_CONFIG,
  buildCombinedAlphanumericDatasets,
} from '../utils/alphanumericTraining';
import {
  ClassifierMode,
  DetailedModelEvaluation,
  LayerActivationSnapshot,
  ModelEvaluationSummary,
  PerClassMetrics,
  PredictionClassScore,
  TrainingEpochMetric,
  XaiExplanationResult,
} from '../types/vectoria';

export interface DenseLayerWeights {
  inDim: number;
  outDim: number;
  W: number[][]; // outDim x inDim
  b: number[]; // outDim
  vW: number[][]; // momentum velocity
  vb: number[];
}

export interface SerializedMLPState {
  mode: ClassifierMode;
  labels: string[];
  isTrained: boolean;
  epochsTrained: number;
  lastTrainedAt: string | null;
  architecture: string;
  parameterCount: number;
  finalLoss: number;
  trainAccuracy: number;
  valAccuracy: number;
  history: TrainingEpochMetric[];
  confusionMatrix: number[][];
  layers?: Array<{
    inDim: number;
    outDim: number;
    W: number[][];
    b: number[];
  }>;
}

export interface ForwardPassResult {
  logits: number[];
  probs: number[];
  snapshots: LayerActivationSnapshot[];
}

export interface BackpropStepReport {
  targetLabel: string;
  targetIndex: number;
  lossBefore: number;
  lossAfter: number;
  learningRate: number;
  zOutputSample: number[];
  probsBefore: number[];
  probsAfter: number[];
  deltaOutput: number[];
  gradWNormByLayer: number[];
  gradBNormByLayer: number[];
  weightPreviewBefore: number[][];
  weightPreviewAfter: number[][];
}

export function relu(x: number): number {
  return x > 0 ? x : 0;
}

export function softmax(logits: number[]): number[] {
  const n = logits.length;
  let maxLogit = -Infinity;
  for (let i = 0; i < n; i++) {
    if (logits[i] > maxLogit) maxLogit = logits[i];
  }
  const probs = new Array<number>(n);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const e = Math.exp(logits[i] - maxLogit);
    probs[i] = e;
    sum += e;
  }
  const invSum = 1 / (sum || 1);
  for (let i = 0; i < n; i++) {
    probs[i] *= invSum;
  }
  return probs;
}

export function crossEntropyLoss(probs: number[], targetIndex: number): number {
  const p = Math.max(1e-12, probs[targetIndex] ?? 1e-12);
  return -Math.log(p);
}

export function computeEntropy(probs: number[]): number {
  let h = 0;
  for (const p of probs) {
    if (p > 1e-12) h -= p * Math.log2(p);
  }
  return h;
}

function initLayer(inDim: number, outDim: number, rng: () => number): DenseLayerWeights {
  // He initialization for ReLU layers: std = sqrt(2 / inDim)
  const std = Math.sqrt(2 / inDim);
  const W = Array.from({ length: outDim }, () =>
    Array.from({ length: inDim }, () => {
      // Box-Muller normal approximation
      const u1 = Math.max(1e-9, rng());
      const u2 = rng();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      return z * std;
    })
  );
  const b = Array(outDim).fill(0);
  const vW = Array.from({ length: outDim }, () => Array(inDim).fill(0));
  const vb = Array(outDim).fill(0);
  return { inDim, outDim, W, b, vW, vb };
}

export class MLPNetwork {
  public readonly mode: ClassifierMode;
  public readonly labels: readonly string[];
  public readonly layers: DenseLayerWeights[];
  public isTrained = false;
  public epochsTrained = 0;
  public lastTrainedAt: string | null = null;
  public history: TrainingEpochMetric[] = [];
  public lastConfusionMatrix: number[][] = [];
  public lastValAccuracy = 0;
  public lastTrainAccuracy = 0;
  public lastLoss = 0;

  constructor(mode: ClassifierMode, labels: readonly string[], hiddenDims: [number, number] = [32, 24], seed = 42) {
    this.mode = mode;
    this.labels = labels;
    const rng = createSeededRng(seed);
    this.layers = [
      initLayer(INPUT_DIM, hiddenDims[0], rng),
      initLayer(hiddenDims[0], hiddenDims[1], rng),
      initLayer(hiddenDims[1], labels.length, rng),
    ];
    this.lastConfusionMatrix = Array.from({ length: labels.length }, () =>
      Array(labels.length).fill(0)
    );
  }

  public getParameterCount(): number {
    return this.layers.reduce((sum, l) => sum + l.inDim * l.outDim + l.outDim, 0);
  }

  public getArchitectureString(): string {
    return `${INPUT_DIM} → ${this.layers.map((l) => l.outDim).join(' → ')}`;
  }

  public clone(): MLPNetwork {
    const copy = new MLPNetwork(this.mode, this.labels, [32, 24], 1);
    (copy as { layers: DenseLayerWeights[] }).layers = this.layers.map((l) => ({
      inDim: l.inDim,
      outDim: l.outDim,
      W: l.W.map((row) => [...row]),
      b: [...l.b],
      vW: l.vW.map((row) => [...row]),
      vb: [...l.vb],
    }));
    copy.isTrained = this.isTrained;
    copy.epochsTrained = this.epochsTrained;
    copy.lastTrainedAt = this.lastTrainedAt;
    copy.history = this.history.map((h) => ({ ...h }));
    copy.lastConfusionMatrix = this.lastConfusionMatrix.map((row) => [...row]);
    copy.lastValAccuracy = this.lastValAccuracy;
    copy.lastTrainAccuracy = this.lastTrainAccuracy;
    copy.lastLoss = this.lastLoss;
    return copy;
  }

  public exportSerializedState(includeWeights = true): SerializedMLPState {
    return {
      mode: this.mode,
      labels: [...this.labels],
      isTrained: this.isTrained,
      epochsTrained: this.epochsTrained,
      lastTrainedAt: this.lastTrainedAt,
      architecture: this.getArchitectureString(),
      parameterCount: this.getParameterCount(),
      finalLoss: this.lastLoss,
      trainAccuracy: this.lastTrainAccuracy,
      valAccuracy: this.lastValAccuracy,
      history: this.history.map((h) => ({ ...h })),
      confusionMatrix: this.lastConfusionMatrix.map((row) => [...row]),
      layers: includeWeights
        ? this.layers.map((l) => ({
            inDim: l.inDim,
            outDim: l.outDim,
            W: l.W.map((row) => row.map((v) => Number(v.toFixed(6)))),
            b: l.b.map((v) => Number(v.toFixed(6))),
          }))
        : undefined,
    };
  }

  public importSerializedState(snapshot: SerializedMLPState): void {
    if (snapshot.mode !== this.mode) {
      throw new Error(`Modo de modelo incompatible: esperado "${this.mode}", recibido "${snapshot.mode}".`);
    }
    if (
      !Array.isArray(snapshot.labels) ||
      snapshot.labels.length !== this.labels.length ||
      snapshot.labels.some((lbl, idx) => lbl !== this.labels[idx])
    ) {
      throw new Error(`Etiquetas de clase incompatibles para el modelo "${this.mode}".`);
    }
    if (snapshot.layers) {
      if (!Array.isArray(snapshot.layers) || snapshot.layers.length !== this.layers.length) {
        throw new Error(`Número de capas incompatible para el modelo "${this.mode}".`);
      }
      const nextLayers: DenseLayerWeights[] = snapshot.layers.map((src, lIdx) => {
        const expected = this.layers[lIdx];
        if (
          src.inDim !== expected.inDim ||
          src.outDim !== expected.outDim ||
          !Array.isArray(src.W) ||
          src.W.length !== expected.outDim ||
          !Array.isArray(src.b) ||
          src.b.length !== expected.outDim
        ) {
          throw new Error(`Dimensiones de capa ${lIdx + 1} corruptas en modelo "${this.mode}".`);
        }
        const W = src.W.map((row) => {
          if (!Array.isArray(row) || row.length !== expected.inDim) {
            throw new Error(`Fila de pesos corrupta en capa ${lIdx + 1} de "${this.mode}".`);
          }
          return row.map((v) => {
            if (typeof v !== 'number' || !Number.isFinite(v)) {
              throw new Error(`Peso no finito detectado en capa ${lIdx + 1} de "${this.mode}".`);
            }
            return v;
          });
        });
        const b = src.b.map((v) => {
          if (typeof v !== 'number' || !Number.isFinite(v)) {
            throw new Error(`Sesgo no finito detectado en capa ${lIdx + 1} de "${this.mode}".`);
          }
          return v;
        });
        return {
          inDim: expected.inDim,
          outDim: expected.outDim,
          W,
          b,
          vW: Array.from({ length: expected.outDim }, () => Array(expected.inDim).fill(0)),
          vb: Array(expected.outDim).fill(0),
        };
      });
      (this as { layers: DenseLayerWeights[] }).layers = nextLayers;
    }

    this.isTrained = Boolean(snapshot.isTrained);
    this.epochsTrained = Number.isFinite(snapshot.epochsTrained) ? snapshot.epochsTrained : 0;
    this.lastTrainedAt = snapshot.lastTrainedAt ?? null;
    this.history = Array.isArray(snapshot.history) ? snapshot.history.map((h) => ({ ...h })) : [];
    this.lastConfusionMatrix = Array.isArray(snapshot.confusionMatrix)
      ? snapshot.confusionMatrix.map((row) => [...row])
      : this.lastConfusionMatrix;
    this.lastValAccuracy = Number.isFinite(snapshot.valAccuracy) ? snapshot.valAccuracy : 0;
    this.lastTrainAccuracy = Number.isFinite(snapshot.trainAccuracy) ? snapshot.trainAccuracy : 0;
    this.lastLoss = Number.isFinite(snapshot.finalLoss) ? snapshot.finalLoss : 0;
  }

  public forward(input: number[]): ForwardPassResult {
    if (input.length !== INPUT_DIM) {
      throw new Error(`Dimensión de entrada inválida: esperada ${INPUT_DIM}, recibida ${input.length}.`);
    }

    const inputCopy = input.slice();
    const snapshots: LayerActivationSnapshot[] = [
      {
        layerName: 'Entrada (16×16)',
        size: INPUT_DIM,
        zValues: inputCopy,
        aValues: inputCopy,
      },
    ];

    let current = inputCopy;
    const lastLayerIdx = this.layers.length - 1;
    for (let lIdx = 0; lIdx < this.layers.length; lIdx++) {
      const layer = this.layers[lIdx];
      const outDim = layer.outDim;
      const inDim = layer.inDim;
      const z = new Array<number>(outDim);
      const isOutput = lIdx === lastLayerIdx;

      for (let i = 0; i < outDim; i++) {
        let sum = layer.b[i];
        const wi = layer.W[i];
        for (let j = 0; j < inDim; j++) {
          sum += wi[j] * current[j];
        }
        z[i] = sum;
      }

      let a: number[];
      if (isOutput) {
        a = softmax(z);
      } else {
        a = new Array<number>(outDim);
        for (let i = 0; i < outDim; i++) {
          const zi = z[i];
          a[i] = zi > 0 ? zi : 0;
        }
      }

      snapshots.push({
        layerName: isOutput ? `Salida Softmax (${outDim})` : `Oculta ${lIdx + 1} ReLU (${outDim})`,
        size: outDim,
        zValues: z,
        aValues: a,
      });
      current = a;
    }

    const last = snapshots[snapshots.length - 1];
    return {
      logits: last.zValues,
      probs: last.aValues,
      snapshots,
    };
  }

  /** Allocation-light forward inference used during batch dataset evaluation. */
  private forwardProbsOnly(input: number[]): number[] {
    if (input.length !== INPUT_DIM) {
      throw new Error(`Dimensión de entrada inválida: esperada ${INPUT_DIM}, recibida ${input.length}.`);
    }
    let current = input;
    const lastLayerIdx = this.layers.length - 1;
    for (let lIdx = 0; lIdx < this.layers.length; lIdx++) {
      const layer = this.layers[lIdx];
      const outDim = layer.outDim;
      const inDim = layer.inDim;
      const z = new Array<number>(outDim);
      for (let i = 0; i < outDim; i++) {
        let sum = layer.b[i];
        const wi = layer.W[i];
        for (let j = 0; j < inDim; j++) {
          sum += wi[j] * current[j];
        }
        z[i] = lIdx === lastLayerIdx ? sum : sum > 0 ? sum : 0;
      }
      current = lIdx === lastLayerIdx ? softmax(z) : z;
    }
    return current;
  }

  public computeGradients(
    input: number[],
    targetIndex: number
  ): {
    loss: number;
    probs: number[];
    snapshots: LayerActivationSnapshot[];
    dW: number[][][];
    db: number[][];
    deltas: number[][];
  } {
    const { probs, snapshots } = this.forward(input);
    const loss = crossEntropyLoss(probs, targetIndex);

    const numLayers = this.layers.length;
    const dW: number[][][] = new Array(numLayers);
    const db: number[][] = new Array(numLayers);
    const deltas: number[][] = new Array(numLayers);

    // Output layer delta: dL/dz = probs - y_onehot
    const outDelta = probs.map((p, idx) => (idx === targetIndex ? p - 1 : p));
    deltas[numLayers - 1] = outDelta;

    for (let l = numLayers - 1; l >= 0; l--) {
      const layer = this.layers[l];
      const prevA = snapshots[l].aValues;
      const delta = deltas[l];

      const gradW = Array.from({ length: layer.outDim }, (_, i) => {
        const di = delta[i];
        const row = new Array<number>(layer.inDim);
        for (let j = 0; j < layer.inDim; j++) {
          row[j] = di * prevA[j];
        }
        return row;
      });
      dW[l] = gradW;
      db[l] = [...delta];

      if (l > 0) {
        const prevZ = snapshots[l].zValues;
        const prevDelta = new Array<number>(layer.inDim).fill(0);
        for (let j = 0; j < layer.inDim; j++) {
          if (prevZ[j] <= 0) {
            prevDelta[j] = 0;
            continue;
          }
          let sum = 0;
          for (let i = 0; i < layer.outDim; i++) {
            sum += layer.W[i][j] * delta[i];
          }
          prevDelta[j] = sum;
        }
        deltas[l - 1] = prevDelta;
      }
    }

    return { loss, probs, snapshots, dW, db, deltas };
  }

  public stepSGD(
    sample: DatasetSample,
    learningRate = 0.04,
    momentum = 0.85,
    l2Reg = 1e-4
  ): BackpropStepReport {
    const { loss, probs, snapshots, dW, db, deltas } = this.computeGradients(
      sample.input,
      sample.labelIndex
    );

    const weightPreviewBefore = this.layers[this.layers.length - 1].W
      .slice(0, 4)
      .map((r) => r.slice(0, 6));

    const gradWNormByLayer: number[] = [];
    const gradBNormByLayer: number[] = [];

    for (let l = 0; l < this.layers.length; l++) {
      const layer = this.layers[l];
      let wNormSq = 0;
      let bNormSq = 0;
      for (let i = 0; i < layer.outDim; i++) {
        const gb = db[l][i];
        bNormSq += gb * gb;
        layer.vb[i] = momentum * layer.vb[i] - learningRate * gb;
        layer.b[i] += layer.vb[i];

        for (let j = 0; j < layer.inDim; j++) {
          const gw = dW[l][i][j] + l2Reg * layer.W[i][j];
          wNormSq += gw * gw;
          layer.vW[i][j] = momentum * layer.vW[i][j] - learningRate * gw;
          layer.W[i][j] += layer.vW[i][j];
        }
      }
      gradWNormByLayer.push(Math.sqrt(wNormSq));
      gradBNormByLayer.push(Math.sqrt(bNormSq));
    }

    const after = this.forward(sample.input);
    const lossAfter = crossEntropyLoss(after.probs, sample.labelIndex);
    const weightPreviewAfter = this.layers[this.layers.length - 1].W
      .slice(0, 4)
      .map((r) => r.slice(0, 6));

    return {
      targetLabel: sample.label,
      targetIndex: sample.labelIndex,
      lossBefore: loss,
      lossAfter,
      learningRate,
      zOutputSample: snapshots[snapshots.length - 1].zValues.slice(0, 10),
      probsBefore: probs,
      probsAfter: after.probs,
      deltaOutput: deltas[deltas.length - 1],
      gradWNormByLayer,
      gradBNormByLayer,
      weightPreviewBefore,
      weightPreviewAfter,
    };
  }

  public trainEpochs(
    trainSet: DatasetSample[],
    valSet: DatasetSample[],
    epochs: number,
    learningRate = 0.035,
    momentum = 0.85,
    onEpoch?: (metric: TrainingEpochMetric) => void
  ): TrainingEpochMetric[] {
    const rng = createSeededRng(777 + this.epochsTrained);
    const indices = Array.from({ length: trainSet.length }, (_, i) => i);

    for (let ep = 1; ep <= epochs; ep++) {
      // Fisher-Yates shuffle
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }

      let epochLoss = 0;
      let correctTrain = 0;

      for (const idx of indices) {
        const sample = trainSet[idx];
        const { loss, probs, dW, db } = this.computeGradients(sample.input, sample.labelIndex);
        epochLoss += loss;
        let predIdx = 0;
        for (let c = 1; c < probs.length; c++) {
          if (probs[c] > probs[predIdx]) predIdx = c;
        }
        if (predIdx === sample.labelIndex) correctTrain++;

        // Update with mild decay
        const lr = learningRate * (1 / (1 + 0.015 * this.epochsTrained));
        for (let l = 0; l < this.layers.length; l++) {
          const layer = this.layers[l];
          for (let i = 0; i < layer.outDim; i++) {
            layer.vb[i] = momentum * layer.vb[i] - lr * db[l][i];
            layer.b[i] += layer.vb[i];
            for (let j = 0; j < layer.inDim; j++) {
              const gw = dW[l][i][j] + 1e-4 * layer.W[i][j];
              layer.vW[i][j] = momentum * layer.vW[i][j] - lr * gw;
              layer.W[i][j] += layer.vW[i][j];
            }
          }
        }
      }

      this.epochsTrained += 1;
      const evalRes = this.evaluate(valSet);
      const metric: TrainingEpochMetric = {
        epoch: this.epochsTrained,
        loss: Number((epochLoss / trainSet.length).toFixed(4)),
        accuracy: Number((correctTrain / trainSet.length).toFixed(4)),
        valAccuracy: Number(evalRes.accuracy.toFixed(4)),
      };
      this.history.push(metric);
      this.lastLoss = metric.loss;
      this.lastTrainAccuracy = metric.accuracy;
      this.lastValAccuracy = metric.valAccuracy;
      this.lastConfusionMatrix = evalRes.confusionMatrix;
      if (onEpoch) onEpoch(metric);
    }

    this.isTrained = true;
    this.lastTrainedAt = new Date().toISOString();
    return this.history;
  }

  public evaluate(dataset: DatasetSample[]): { accuracy: number; confusionMatrix: number[][] } {
    const k = this.labels.length;
    const cm = Array.from({ length: k }, () => Array(k).fill(0));
    let correct = 0;
    for (const sample of dataset) {
      const probs = this.forwardProbsOnly(sample.input);
      let pred = 0;
      for (let i = 1; i < probs.length; i++) {
        if (probs[i] > probs[pred]) pred = i;
      }
      cm[sample.labelIndex][pred] += 1;
      if (pred === sample.labelIndex) correct++;
    }
    return {
      accuracy: dataset.length > 0 ? correct / dataset.length : 0,
      confusionMatrix: cm,
    };
  }

  public predictScores(input: number[]): {
    topLabel: string;
    confidence: number;
    entropy: number;
    allScores: PredictionClassScore[];
    topScores: PredictionClassScore[];
    snapshots: LayerActivationSnapshot[];
  } {
    const { logits, probs, snapshots } = this.forward(input);
    const allScores: PredictionClassScore[] = this.labels.map((label, idx) => ({
      label,
      probability: probs[idx],
      logit: logits[idx],
      category: /^[0-9]$/.test(label) ? 'digit' : 'letter',
    }));
    const sorted = [...allScores].sort((a, b) => b.probability - a.probability);
    return {
      topLabel: sorted[0].label,
      confidence: sorted[0].probability,
      entropy: computeEntropy(probs),
      allScores,
      topScores: sorted.slice(0, 6),
      snapshots,
    };
  }

  public getSummary(): ModelEvaluationSummary {
    return {
      mode: this.mode,
      classCount: this.labels.length,
      labels: [...this.labels],
      isTrained: this.isTrained,
      epochsTrained: this.epochsTrained,
      finalLoss: this.lastLoss,
      trainAccuracy: this.lastTrainAccuracy,
      valAccuracy: this.lastValAccuracy,
      confusionMatrix: this.lastConfusionMatrix,
      history: [...this.history],
      parameterCount: this.getParameterCount(),
      architecture: this.getArchitectureString(),
      lastTrainedAt: this.lastTrainedAt,
    };
  }

  public checkNumericalGradient(sample: DatasetSample, epsilon = 1e-5): {
    maxRelError: number;
    passed: boolean;
    checkedWeights: number;
  } {
    const { dW } = this.computeGradients(sample.input, sample.labelIndex);
    let maxRelError = 0;
    let checkedWeights = 0;

    // Sample deterministic weights from each layer for finite-difference verification
    for (let l = 0; l < this.layers.length; l++) {
      const layer = this.layers[l];
      const rowsToCheck = Math.min(3, layer.outDim);
      const colsToCheck = Math.min(4, layer.inDim);
      for (let i = 0; i < rowsToCheck; i++) {
        for (let j = 0; j < colsToCheck; j++) {
          const orig = layer.W[i][j];
          layer.W[i][j] = orig + epsilon;
          const lossPlus = crossEntropyLoss(this.forward(sample.input).probs, sample.labelIndex);
          layer.W[i][j] = orig - epsilon;
          const lossMinus = crossEntropyLoss(this.forward(sample.input).probs, sample.labelIndex);
          layer.W[i][j] = orig;

          const numGrad = (lossPlus - lossMinus) / (2 * epsilon);
          const anaGrad = dW[l][i][j];
          const denom = Math.max(1e-8, Math.abs(numGrad) + Math.abs(anaGrad));
          const relErr = Math.abs(numGrad - anaGrad) / denom;
          if (relErr > maxRelError) maxRelError = relErr;
          checkedWeights++;
        }
      }
    }

    return {
      maxRelError,
      passed: maxRelError < 1e-4,
      checkedWeights,
    };
  }

  public explainInputGradientXai(input: number[]): XaiExplanationResult {
    const pred = this.predictScores(input);
    const topScore = pred.topScores[0];
    const secondScore = pred.topScores[1] ?? topScore;
    const topIdx = Math.max(0, this.labels.indexOf(topScore.label));

    // Analytical gradient of top-class logit z_top w.r.t input x: d(z_top)/dx
    const outLayer = this.layers[this.layers.length - 1];
    let gradUpstream = new Array<number>(outLayer.inDim).fill(0);
    for (let j = 0; j < outLayer.inDim; j++) {
      gradUpstream[j] = outLayer.W[topIdx][j];
    }

    for (let l = this.layers.length - 2; l >= 0; l--) {
      const layer = this.layers[l];
      const zVals = pred.snapshots[l + 1].zValues;
      const delta = gradUpstream.map((g, i) => (zVals[i] > 0 ? g : 0));
      const nextGrad = new Array<number>(layer.inDim).fill(0);
      for (let j = 0; j < layer.inDim; j++) {
        let sum = 0;
        for (let i = 0; i < layer.outDim; i++) {
          sum += layer.W[i][j] * delta[i];
        }
        nextGrad[j] = sum;
      }
      gradUpstream = nextGrad;
    }

    // Saliency = |d(z_top)/dx_i * x_i| normalized to [0, 1]
    const rawAttr = gradUpstream.map((g, i) => Math.abs(g * input[i]));
    const maxAttr = Math.max(1e-8, ...rawAttr);
    const saliencyGrid = rawAttr.map((v) => Number((v / maxAttr).toFixed(4)));

    const topHiddenNeurons: XaiExplanationResult['topHiddenNeurons'] = [];
    for (let l = 1; l < pred.snapshots.length - 1; l++) {
      const snap = pred.snapshots[l];
      const sorted = snap.aValues
        .map((val, idx) => ({ layer: snap.layerName, neuronIndex: idx + 1, activation: val }))
        .sort((a, b) => b.activation - a.activation)
        .slice(0, 3);
      topHiddenNeurons.push(...sorted);
    }

    const margin = topScore.probability - secondScore.probability;
    const pairKey = `${topScore.label}-${secondScore.label}`;
    let ambiguityNote =
      margin < 0.2
        ? `Margen reducido (${(margin * 100).toFixed(1)}%) entre "${topScore.label}" y "${secondScore.label}": pequeñas traslaciones o grosor de trazo pueden invertir la decisión.`
        : `Separación clara (${(margin * 100).toFixed(1)}% de margen) entre la primera y segunda clase más probable.`;

    if (
      pairKey.includes('0') && pairKey.includes('O') ||
      pairKey.includes('1') && pairKey.includes('I')
    ) {
      ambiguityNote = `Par crítico alfanumérico detectado (${topScore.label} vs ${secondScore.label}): comparten contorno cerrado o eje vertical en ℝ²⁵⁶; solo características sutiles (barra interior en '0' o serifas en 'I') separan ambas clases.`;
    }

    return {
      topLabel: topScore.label,
      secondLabel: secondScore.label,
      confidenceMargin: margin,
      entropy: pred.entropy,
      saliencyGrid,
      topHiddenNeurons,
      ambiguityNote,
    };
  }

  public evaluateDetailed(dataset: DatasetSample[]): DetailedModelEvaluation {
    if (!this.isTrained || dataset.length === 0) {
      return {
        mode: this.mode,
        isTrained: this.isTrained,
        accuracy: 0,
        macroPrecision: 0,
        macroRecall: 0,
        macroF1: 0,
        avgInferenceMs: 0,
        sampleCount: 0,
        perClass: [],
        confusionMatrix: this.lastConfusionMatrix,
      };
    }

    const k = this.labels.length;
    const cm = Array.from({ length: k }, () => Array(k).fill(0));
    let correct = 0;
    const t0 = performance.now();

    for (const sample of dataset) {
      const probs = this.forwardProbsOnly(sample.input);
      let pred = 0;
      for (let i = 1; i < probs.length; i++) {
        if (probs[i] > probs[pred]) pred = i;
      }
      cm[sample.labelIndex][pred] += 1;
      if (pred === sample.labelIndex) correct += 1;
    }

    const totalMs = performance.now() - t0;
    const perClass: PerClassMetrics[] = this.labels.map((label, c) => {
      const tp = cm[c][c];
      let fp = 0;
      let fn = 0;
      let support = 0;
      for (let i = 0; i < k; i++) {
        support += cm[c][i];
        if (i !== c) {
          fn += cm[c][i];
          fp += cm[i][c];
        }
      }
      const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
      const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
      const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
      return {
        label,
        support,
        precision,
        recall,
        f1,
      };
    });

    const macroPrecision = perClass.reduce((s, p) => s + p.precision, 0) / k;
    const macroRecall = perClass.reduce((s, p) => s + p.recall, 0) / k;
    const macroF1 = perClass.reduce((s, p) => s + p.f1, 0) / k;

    return {
      mode: this.mode,
      isTrained: this.isTrained,
      accuracy: correct / dataset.length,
      macroPrecision,
      macroRecall,
      macroF1,
      avgInferenceMs: Number((totalMs / dataset.length).toFixed(4)),
      sampleCount: dataset.length,
      perClass,
      confusionMatrix: cm,
    };
  }
}

export interface NeuralSuite {
  digitsModel: MLPNetwork;
  lettersModel: MLPNetwork;
  alphanumericModel: MLPNetwork;
  digitsTrain: DatasetSample[];
  digitsVal: DatasetSample[];
  lettersTrain: DatasetSample[];
  lettersVal: DatasetSample[];
  alphanumericTrain: DatasetSample[];
  alphanumericVal: DatasetSample[];
}

export function createInitialNeuralSuite(): NeuralSuite {
  const digitsTrain = buildGlyphDataset(DIGIT_LABELS, 14, 101);
  const digitsVal = buildGlyphDataset(DIGIT_LABELS, 5, 202);

  const lettersTrain = buildGlyphDataset(LETTER_LABELS, 12, 303);
  const lettersVal = buildGlyphDataset(LETTER_LABELS, 4, 404);

  const { trainSet: alphanumericTrain, valSet: alphanumericVal } =
    buildCombinedAlphanumericDatasets();

  const digitsModel = new MLPNetwork('digits', DIGIT_LABELS, [32, 24], 11);
  digitsModel.trainEpochs(digitsTrain, digitsVal, 18, 0.006, 0.85);

  const lettersModel = new MLPNetwork('letters', LETTER_LABELS, [32, 24], 22);
  lettersModel.trainEpochs(lettersTrain, lettersVal, 18, 0.005, 0.85);

  const { arch } = { arch: ALPHANUMERIC_COMBINED_CONFIG.architecture };
  const alphanumericModel = new MLPNetwork(
    'alphanumeric',
    ALPHANUMERIC_COMBINED_CONFIG.labels,
    arch.hiddenDims,
    arch.seed
  );
  alphanumericModel.trainEpochs(
    alphanumericTrain,
    alphanumericVal,
    arch.defaultEpochs,
    arch.learningRate,
    arch.momentum
  );

  return {
    digitsModel,
    lettersModel,
    alphanumericModel,
    digitsTrain,
    digitsVal,
    lettersTrain,
    lettersVal,
    alphanumericTrain,
    alphanumericVal,
  };
}
