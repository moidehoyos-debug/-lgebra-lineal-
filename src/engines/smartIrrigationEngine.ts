export interface IrrigationSample {
  id: string;
  moisturePct: number; // 0..100
  sunlightWm2: number; // 0..1000
  target: 0 | 1; // 1 = activar riego, 0 = mantener en reposo
  label: string;
}

export interface IrrigationForwardSnapshot {
  moisturePct: number;
  sunlightWm2: number;
  x: [number, number];
  z1: [number, number, number, number];
  a1: [number, number, number, number];
  z2: number;
  yHat: number;
  decision: 'REGAR' | 'NO REGAR';
  confidencePct: number;
}

export interface IrrigationWeightSnapshot {
  W1: number[][]; // 4 x 2
  b1: number[]; // 4
  W2: number[]; // 4
  b2: number;
}

export interface IrrigationBackpropStep {
  sample: {
    moisturePct: number;
    sunlightWm2: number;
    target: 0 | 1;
  };
  before: IrrigationForwardSnapshot;
  after: IrrigationForwardSnapshot;
  lossBefore: number;
  lossAfter: number;
  errorSigned: number; // yHat - y
  deltaOutput: number;
  deltaHidden: [number, number, number, number];
  gradW1: number[][];
  gradB1: number[];
  gradW2: number[];
  gradB2: number;
  weightsBefore: IrrigationWeightSnapshot;
  weightsAfter: IrrigationWeightSnapshot;
  learningRate: number;
}

export interface IrrigationEpochMetric {
  epoch: number;
  loss: number;
  accuracy: number;
  valAccuracy: number;
}

export interface SmartIrrigationSummary {
  architecture: string;
  parameterCount: number;
  epochsTrained: number;
  finalLoss: number;
  trainAccuracy: number;
  valAccuracy: number;
  isTrained: boolean;
  datasetNotice: string;
  history: IrrigationEpochMetric[];
}

export const SMART_IRRIGATION_NOTICE =
  'Conjunto sintético educativo (2 entradas → 4 ocultas ReLU → 1 salida Sigmoide). Modelo estrictamente aislado para enseñanza; no sustituye sensores ni criterios agronómicos reales.';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sigmoid(z: number): number {
  const clamped = Math.max(-30, Math.min(30, z));
  return 1 / (1 + Math.exp(-clamped));
}

function binaryCrossEntropy(yHat: number, target: 0 | 1): number {
  const eps = 1e-7;
  const p = Math.max(eps, Math.min(1 - eps, yHat));
  return -(target * Math.log(p) + (1 - target) * Math.log(1 - p));
}

/**
 * Regla sintética educativa reproducible:
 * La probabilidad de necesitar riego aumenta cuando baja la humedad del suelo y sube la radiación solar.
 */
export function evaluateSyntheticIrrigationRule(
  moisturePct: number,
  sunlightWm2: number
): 0 | 1 {
  const m = Math.max(0, Math.min(100, moisturePct)) / 100;
  const s = Math.max(0, Math.min(1000, sunlightWm2)) / 1000;
  const demandIndex = (1 - m) * 0.72 + s * 0.38;
  return demandIndex >= 0.56 ? 1 : 0;
}

export const IRRIGATION_TRAIN_DATASET: readonly IrrigationSample[] = [
  { id: 'tr-01', moisturePct: 14, sunlightWm2: 880, target: 1, label: 'Suelo muy seco + sol intenso' },
  { id: 'tr-02', moisturePct: 22, sunlightWm2: 760, target: 1, label: 'Suelo seco + alta radiación' },
  { id: 'tr-03', moisturePct: 28, sunlightWm2: 640, target: 1, label: 'Humedad baja + sol medio-alto' },
  { id: 'tr-04', moisturePct: 18, sunlightWm2: 310, target: 1, label: 'Déficit hídrico incluso nublado' },
  { id: 'tr-05', moisturePct: 38, sunlightWm2: 910, target: 1, label: 'Humedad moderada-baja + sol extremo' },
  { id: 'tr-06', moisturePct: 44, sunlightWm2: 820, target: 1, label: 'Evapotranspiración elevada' },
  { id: 'tr-07', moisturePct: 34, sunlightWm2: 420, target: 1, label: 'Límite seco templado' },
  { id: 'tr-08', moisturePct: 52, sunlightWm2: 940, target: 1, label: 'Sol pico sobre humedad media' },
  { id: 'tr-09', moisturePct: 78, sunlightWm2: 240, target: 0, label: 'Suelo húmedo + baja radiación' },
  { id: 'tr-10', moisturePct: 86, sunlightWm2: 480, target: 0, label: 'Reserva hídrica alta' },
  { id: 'tr-11', moisturePct: 68, sunlightWm2: 350, target: 0, label: 'Humedad suficiente' },
  { id: 'tr-12', moisturePct: 92, sunlightWm2: 780, target: 0, label: 'Suelo saturado pese a sol' },
  { id: 'tr-13', moisturePct: 62, sunlightWm2: 220, target: 0, label: 'Ambiente húmedo fresco' },
  { id: 'tr-14', moisturePct: 74, sunlightWm2: 620, target: 0, label: 'Humedad óptima estable' },
  { id: 'tr-15', moisturePct: 55, sunlightWm2: 180, target: 0, label: 'Sin déficit evaporativo' },
  { id: 'tr-16', moisturePct: 82, sunlightWm2: 890, target: 0, label: 'Humedad alta resiste sol fuerte' },
];

export const IRRIGATION_VAL_DATASET: readonly IrrigationSample[] = [
  { id: 'va-01', moisturePct: 16, sunlightWm2: 710, target: 1, label: 'Validación seco-soleado' },
  { id: 'va-02', moisturePct: 32, sunlightWm2: 830, target: 1, label: 'Validación demanda alta' },
  { id: 'va-03', moisturePct: 24, sunlightWm2: 250, target: 1, label: 'Validación suelo seco fresco' },
  { id: 'va-04', moisturePct: 46, sunlightWm2: 690, target: 1, label: 'Validación frontera positiva' },
  { id: 'va-05', moisturePct: 76, sunlightWm2: 410, target: 0, label: 'Validación húmedo moderado' },
  { id: 'va-06', moisturePct: 88, sunlightWm2: 650, target: 0, label: 'Validación reserva alta' },
  { id: 'va-07', moisturePct: 64, sunlightWm2: 310, target: 0, label: 'Validación equilibrio húmedo' },
  { id: 'va-08', moisturePct: 58, sunlightWm2: 290, target: 0, label: 'Validación frontera reposo' },
];

/**
 * Red neuronal independiente 2 → 4 (ReLU) → 1 (Sigmoide) para el laboratorio educativo de Riego Inteligente.
 * No comparte pesos ni estado mutable con los clasificadores MNIST/Alfanumérico ni con el simulador 2-3-2.
 */
export class SmartIrrigationModel {
  public W1: number[][] = []; // 4 x 2
  public b1: number[] = []; // 4
  public W2: number[] = []; // 4
  public b2 = 0;
  public epochsTrained = 0;
  public history: IrrigationEpochMetric[] = [];
  private seed: number;

  constructor(seed = 202604) {
    this.seed = seed;
    this.reset(seed);
  }

  public reset(newSeed = this.seed): void {
    this.seed = newSeed;
    const rand = mulberry32(newSeed);
    this.W1 = Array.from({ length: 4 }, () => [
      Number(((rand() - 0.5) * 0.9).toFixed(4)),
      Number(((rand() - 0.5) * 0.9).toFixed(4)),
    ]);
    // Positive hidden biases avoid dead-ReLU collapse at step 0
    this.b1 = [0.22, 0.18, 0.25, 0.16];
    this.W2 = Array.from({ length: 4 }, () => Number(((rand() - 0.5) * 0.8).toFixed(4)));
    this.b2 = 0.0;
    this.epochsTrained = 0;
    this.history = [];
  }

  public cloneWeights(): IrrigationWeightSnapshot {
    return {
      W1: this.W1.map((row) => [...row]),
      b1: [...this.b1],
      W2: [...this.W2],
      b2: this.b2,
    };
  }

  public getParameterCount(): number {
    // 4*2 + 4 + 4 + 1 = 17 parámetros
    return 17;
  }

  public forward(moisturePct: number, sunlightWm2: number): IrrigationForwardSnapshot {
    const cleanMoisture = Math.max(0, Math.min(100, moisturePct));
    const cleanSunlight = Math.max(0, Math.min(1000, sunlightWm2));
    const x: [number, number] = [cleanMoisture / 100, cleanSunlight / 1000];

    const z1: [number, number, number, number] = [0, 0, 0, 0];
    const a1: [number, number, number, number] = [0, 0, 0, 0];
    for (let h = 0; h < 4; h += 1) {
      const z = this.W1[h][0] * x[0] + this.W1[h][1] * x[1] + this.b1[h];
      z1[h] = z;
      a1[h] = z > 0 ? z : 0;
    }

    let z2 = this.b2;
    for (let h = 0; h < 4; h += 1) {
      z2 += this.W2[h] * a1[h];
    }
    const yHat = sigmoid(z2);
    const decision = yHat >= 0.5 ? 'REGAR' : 'NO REGAR';
    const confidencePct = Number(((yHat >= 0.5 ? yHat : 1 - yHat) * 100).toFixed(2));

    return {
      moisturePct: cleanMoisture,
      sunlightWm2: cleanSunlight,
      x,
      z1,
      a1,
      z2,
      yHat,
      decision,
      confidencePct,
    };
  }

  public stepSample(
    moisturePct: number,
    sunlightWm2: number,
    target: 0 | 1,
    learningRate = 0.25
  ): IrrigationBackpropStep {
    const eta = Math.max(0.005, Math.min(1.5, learningRate));
    const weightsBefore = this.cloneWeights();
    const before = this.forward(moisturePct, sunlightWm2);
    const lossBefore = binaryCrossEntropy(before.yHat, target);

    // Binary cross-entropy with sigmoid output => dL/dz2 = yHat - target
    const deltaOutput = before.yHat - target;
    const gradW2 = before.a1.map((a) => deltaOutput * a);
    const gradB2 = deltaOutput;

    const deltaHidden: [number, number, number, number] = [0, 0, 0, 0];
    const gradW1: number[][] = Array.from({ length: 4 }, () => [0, 0]);
    const gradB1: number[] = [0, 0, 0, 0];

    for (let h = 0; h < 4; h += 1) {
      const reluPrime = before.z1[h] > 0 ? 1 : 0;
      const dH = deltaOutput * this.W2[h] * reluPrime;
      deltaHidden[h] = dH;
      gradW1[h][0] = dH * before.x[0];
      gradW1[h][1] = dH * before.x[1];
      gradB1[h] = dH;
    }

    // SGD update
    for (let h = 0; h < 4; h += 1) {
      this.W2[h] -= eta * gradW2[h];
      this.b1[h] -= eta * gradB1[h];
      this.W1[h][0] -= eta * gradW1[h][0];
      this.W1[h][1] -= eta * gradW1[h][1];
    }
    this.b2 -= eta * gradB2;

    const weightsAfter = this.cloneWeights();
    const after = this.forward(moisturePct, sunlightWm2);
    const lossAfter = binaryCrossEntropy(after.yHat, target);

    return {
      sample: {
        moisturePct: before.moisturePct,
        sunlightWm2: before.sunlightWm2,
        target,
      },
      before,
      after,
      lossBefore,
      lossAfter,
      errorSigned: deltaOutput,
      deltaOutput,
      deltaHidden,
      gradW1,
      gradB1,
      gradW2,
      gradB2,
      weightsBefore,
      weightsAfter,
      learningRate: eta,
    };
  }

  public evaluateDataset(dataset: readonly IrrigationSample[]): {
    loss: number;
    accuracy: number;
  } {
    let totalLoss = 0;
    let correct = 0;
    for (const s of dataset) {
      const snap = this.forward(s.moisturePct, s.sunlightWm2);
      totalLoss += binaryCrossEntropy(snap.yHat, s.target);
      const pred: 0 | 1 = snap.yHat >= 0.5 ? 1 : 0;
      if (pred === s.target) correct += 1;
    }
    return {
      loss: totalLoss / Math.max(1, dataset.length),
      accuracy: correct / Math.max(1, dataset.length),
    };
  }

  public trainEpochs(epochs = 10, learningRate = 0.25): IrrigationEpochMetric[] {
    const cleanEpochs = Math.max(1, Math.min(200, Math.round(epochs)));
    const eta = Math.max(0.01, Math.min(1.0, learningRate));
    const added: IrrigationEpochMetric[] = [];

    for (let e = 0; e < cleanEpochs; e += 1) {
      // Deterministic interleaved order per epoch
      const offset = (this.epochsTrained + e) % IRRIGATION_TRAIN_DATASET.length;
      for (let i = 0; i < IRRIGATION_TRAIN_DATASET.length; i += 1) {
        const sample = IRRIGATION_TRAIN_DATASET[(i + offset) % IRRIGATION_TRAIN_DATASET.length];
        this.stepSample(sample.moisturePct, sample.sunlightWm2, sample.target, eta);
      }

      this.epochsTrained += 1;
      const trainEval = this.evaluateDataset(IRRIGATION_TRAIN_DATASET);
      const valEval = this.evaluateDataset(IRRIGATION_VAL_DATASET);
      const point: IrrigationEpochMetric = {
        epoch: this.epochsTrained,
        loss: Number(trainEval.loss.toFixed(4)),
        accuracy: Number(trainEval.accuracy.toFixed(4)),
        valAccuracy: Number(valEval.accuracy.toFixed(4)),
      };
      this.history.push(point);
      added.push(point);
    }
    return added;
  }

  public getSummary(): SmartIrrigationSummary {
    const trainEval = this.evaluateDataset(IRRIGATION_TRAIN_DATASET);
    const valEval = this.evaluateDataset(IRRIGATION_VAL_DATASET);
    return {
      architecture: '2 → 4 (ReLU) → 1 (Sigmoide)',
      parameterCount: this.getParameterCount(),
      epochsTrained: this.epochsTrained,
      finalLoss: Number(trainEval.loss.toFixed(4)),
      trainAccuracy: Number(trainEval.accuracy.toFixed(4)),
      valAccuracy: Number(valEval.accuracy.toFixed(4)),
      isTrained: this.epochsTrained > 0,
      datasetNotice: SMART_IRRIGATION_NOTICE,
      history: [...this.history],
    };
  }

  public getDecisionGrid(steps = 7): Array<{
    moisturePct: number;
    sunlightWm2: number;
    probability: number;
    expectedTarget: 0 | 1;
  }> {
    const grid: Array<{
      moisturePct: number;
      sunlightWm2: number;
      probability: number;
      expectedTarget: 0 | 1;
    }> = [];
    const n = Math.max(3, Math.min(11, steps));
    for (let mi = 0; mi < n; mi += 1) {
      const moisturePct = Math.round((mi / (n - 1)) * 100);
      for (let si = 0; si < n; si += 1) {
        const sunlightWm2 = Math.round((si / (n - 1)) * 1000);
        const snap = this.forward(moisturePct, sunlightWm2);
        grid.push({
          moisturePct,
          sunlightWm2,
          probability: Number(snap.yHat.toFixed(4)),
          expectedTarget: evaluateSyntheticIrrigationRule(moisturePct, sunlightWm2),
        });
      }
    }
    return grid;
  }
}

export function createSmartIrrigationModel(seed = 202604): SmartIrrigationModel {
  return new SmartIrrigationModel(seed);
}
