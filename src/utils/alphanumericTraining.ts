import {
  ALPHANUMERIC_LABELS,
  buildGlyphDataset,
  DatasetSample,
  DIGIT_LABELS,
  GRID_SIZE,
  INPUT_DIM,
  LETTER_LABELS,
} from '../engines/alphanumericDataset';
import { ClassifierMode } from '../types/vectoria';

export interface TensorSpec {
  name: string;
  rank: number;
  shape: readonly number[];
  spatialShape?: readonly [number, number];
  dtype: 'float32';
  valueRange: readonly [number, number];
  normalization: string;
}

export interface TargetTensorSpec {
  encoding: 'one-hot';
  classCount: number;
  shape: readonly [number];
  lossFunction: 'cross-entropy-softmax';
  digitRangeIndices: readonly [number, number];
  letterRangeIndices: readonly [number, number];
  classIndexMap: Record<string, number>;
}

export interface CombinedTrainingDataRequirements {
  minSamplesPerClassTrain: number;
  minSamplesPerClassVal: number;
  recommendedSamplesPerClassTrain: number;
  recommendedSamplesPerClassVal: number;
  totalMinTrainSamples: number;
  totalMinValSamples: number;
  stratifiedSplit: boolean;
  balancedClassesRequired: boolean;
  augmentation: {
    shiftRangePx: number;
    scaleRange: readonly [number, number];
    noiseSigma: number;
    rotationDegRange: readonly [number, number];
  };
  criticalDisambiguationPairs: ReadonlyArray<readonly [string, string]>;
  documentationNotes: readonly string[];
}

export interface AlphanumericCombinedTrainingConfig {
  mode: ClassifierMode;
  displayName: string;
  classCount: number;
  digitLabels: readonly string[];
  letterLabels: readonly string[];
  labels: readonly string[];
  inputTensor: TensorSpec;
  targetTensor: TargetTensorSpec;
  architecture: {
    inputDim: number;
    hiddenDims: [number, number];
    outputDim: number;
    layerSizes: readonly [number, number, number, number];
    activations: readonly ['ReLU', 'ReLU', 'Softmax'];
    optimizer: 'SGD + Momentum';
    learningRate: number;
    momentum: number;
    defaultEpochs: number;
    seed: number;
    trainSamplesPerClassInit: number;
    valSamplesPerClassInit: number;
  };
  dataRequirements: CombinedTrainingDataRequirements;
}

const classIndexMap: Record<string, number> = {};
ALPHANUMERIC_LABELS.forEach((lbl, idx) => {
  classIndexMap[lbl] = idx;
});

/**
 * Especificación unificada y configuración maestra del modelo
 * Alfanumérico Combinado (36 clases: 0–9 + A–Z).
 */
export const ALPHANUMERIC_COMBINED_CONFIG: AlphanumericCombinedTrainingConfig = {
  mode: 'alphanumeric',
  displayName: 'Alfanumérico Combinado (0–9, A–Z · 36 clases)',
  classCount: ALPHANUMERIC_LABELS.length,
  digitLabels: DIGIT_LABELS,
  letterLabels: LETTER_LABELS,
  labels: ALPHANUMERIC_LABELS,
  inputTensor: {
    name: 'x_glyph_16x16',
    rank: 1,
    shape: [INPUT_DIM],
    spatialShape: [GRID_SIZE, GRID_SIZE],
    dtype: 'float32',
    valueRange: [0, 1],
    normalization: 'Intensidad normalizada en [0.0, 1.0] mediante suavizado espacial de segmentos 16×16 (ℝ²⁵⁶)',
  },
  targetTensor: {
    encoding: 'one-hot',
    classCount: ALPHANUMERIC_LABELS.length,
    shape: [36],
    lossFunction: 'cross-entropy-softmax',
    digitRangeIndices: [0, 9],
    letterRangeIndices: [10, 35],
    classIndexMap,
  },
  architecture: {
    inputDim: INPUT_DIM,
    hiddenDims: [40, 32],
    outputDim: ALPHANUMERIC_LABELS.length,
    layerSizes: [INPUT_DIM, 40, 32, ALPHANUMERIC_LABELS.length],
    activations: ['ReLU', 'ReLU', 'Softmax'],
    optimizer: 'SGD + Momentum',
    learningRate: 0.005,
    momentum: 0.85,
    defaultEpochs: 18,
    seed: 33,
    trainSamplesPerClassInit: 12,
    valSamplesPerClassInit: 4,
  },
  dataRequirements: {
    minSamplesPerClassTrain: 10,
    minSamplesPerClassVal: 3,
    recommendedSamplesPerClassTrain: 18,
    recommendedSamplesPerClassVal: 6,
    totalMinTrainSamples: 36 * 10,
    totalMinValSamples: 36 * 3,
    stratifiedSplit: true,
    balancedClassesRequired: true,
    augmentation: {
      shiftRangePx: 1.5,
      scaleRange: [0.9, 1.1],
      noiseSigma: 0.04,
      rotationDegRange: [-6, 6],
    },
    criticalDisambiguationPairs: [
      ['0', 'O'],
      ['1', 'I'],
      ['5', 'S'],
      ['8', 'B'],
      ['2', 'Z'],
    ],
    documentationNotes: [
      'Cada muestra debe ser un tensor plano de 256 valores float32 en rango [0, 1] correspondiente a una matriz 16×16 en orden fila-mayor.',
      'El conjunto combinado debe mantener balance estratificado entre dígitos (clases 0–9, índices 0..9) y letras mayúsculas (A–Z, índices 10..35).',
      'Para evitar colapsos entre pares geométricamente cercanos (0/O, 1/I, 5/S, 8/B), los prototipos conservan rasgos discriminativos (barra interior en 0, serifa en 1).',
      'Se recomienda tasa de aprendizaje η = 0.005 con momento μ = 0.85 en SGD muestra a muestra para garantizar convergencia estable sin explosión de gradiente.',
    ],
  },
};

export interface EncodedAlphanumericTarget {
  label: string;
  classIndex: number;
  category: 'digit' | 'letter';
  oneHot: number[];
}

/**
 * Codifica una etiqueta ('0'..'9' o 'A'..'Z') al vector objetivo one-hot de 36 dimensiones.
 */
export function encodeAlphanumericTarget(label: string): EncodedAlphanumericTarget {
  const normalized = label.trim().toUpperCase();
  const idx = ALPHANUMERIC_COMBINED_CONFIG.targetTensor.classIndexMap[normalized];
  if (idx === undefined) {
    throw new Error(`Etiqueta alfanumérica inválida "${label}". Valores válidos: 0–9 y A–Z.`);
  }
  const oneHot = new Array<number>(ALPHANUMERIC_COMBINED_CONFIG.classCount).fill(0);
  oneHot[idx] = 1;
  return {
    label: normalized,
    classIndex: idx,
    category: idx < 10 ? 'digit' : 'letter',
    oneHot,
  };
}

export interface CombinedBatchValidationReport {
  valid: boolean;
  trainSampleCount: number;
  valSampleCount: number;
  coveredClasses: number;
  missingClasses: string[];
  errors: string[];
}

/**
 * Valida la integridad dimensional, finitud [0,1] y cobertura estratificada 36-clases
 * antes de entrenar el modelo combinado.
 */
export function validateCombinedTrainingBatch(
  trainSet: DatasetSample[],
  valSet: DatasetSample[],
  minPerClass = 1
): CombinedBatchValidationReport {
  const errors: string[] = [];
  const trainCounts = new Array<number>(ALPHANUMERIC_COMBINED_CONFIG.classCount).fill(0);
  const valCounts = new Array<number>(ALPHANUMERIC_COMBINED_CONFIG.classCount).fill(0);

  const inspectSample = (sample: DatasetSample, splitName: string, counts: number[]) => {
    if (!Array.isArray(sample.input) || sample.input.length !== INPUT_DIM) {
      errors.push(`${splitName}: tensor de entrada inválido (esperado ${INPUT_DIM}).`);
      return;
    }
    for (let i = 0; i < sample.input.length; i++) {
      const v = sample.input[i];
      if (!Number.isFinite(v) || v < -1e-6 || v > 1 + 1e-6) {
        errors.push(`${splitName}: valor fuera de [0, 1] o no finito en entrada.`);
        break;
      }
    }
    if (sample.labelIndex < 0 || sample.labelIndex >= ALPHANUMERIC_COMBINED_CONFIG.classCount) {
      errors.push(`${splitName}: índice de clase fuera de rango (${sample.labelIndex}).`);
      return;
    }
    counts[sample.labelIndex] += 1;
  };

  for (const s of trainSet) inspectSample(s, 'train', trainCounts);
  for (const s of valSet) inspectSample(s, 'val', valCounts);

  const missingClasses: string[] = [];
  let coveredClasses = 0;
  for (let c = 0; c < ALPHANUMERIC_COMBINED_CONFIG.classCount; c++) {
    if (trainCounts[c] >= minPerClass && valCounts[c] >= 1) {
      coveredClasses += 1;
    } else {
      missingClasses.push(ALPHANUMERIC_COMBINED_CONFIG.labels[c]);
    }
  }

  if (missingClasses.length > 0) {
    errors.push(
      `Faltan muestras suficientes en ${missingClasses.length} clases: ${missingClasses.slice(0, 6).join(', ')}.`
    );
  }

  return {
    valid: errors.length === 0,
    trainSampleCount: trainSet.length,
    valSampleCount: valSet.length,
    coveredClasses,
    missingClasses,
    errors,
  };
}

/**
 * Construye los tensores de entrenamiento y validación combinados (0–9 + A–Z)
 * verificando los requisitos estructurales definidos en ALPHANUMERIC_COMBINED_CONFIG.
 */
export function buildCombinedAlphanumericDatasets(
  trainPerClass = ALPHANUMERIC_COMBINED_CONFIG.architecture.trainSamplesPerClassInit,
  valPerClass = ALPHANUMERIC_COMBINED_CONFIG.architecture.valSamplesPerClassInit
): {
  trainSet: DatasetSample[];
  valSet: DatasetSample[];
  validation: CombinedBatchValidationReport;
} {
  const trainSet = buildGlyphDataset(ALPHANUMERIC_COMBINED_CONFIG.labels, trainPerClass, 505);
  const valSet = buildGlyphDataset(ALPHANUMERIC_COMBINED_CONFIG.labels, valPerClass, 606);
  const validation = validateCombinedTrainingBatch(trainSet, valSet, Math.min(1, trainPerClass));
  return { trainSet, valSet, validation };
}

export function getCombinedAlphanumericSpecSummary() {
  return {
    ...ALPHANUMERIC_COMBINED_CONFIG,
    totalParametersEstimate:
      INPUT_DIM * ALPHANUMERIC_COMBINED_CONFIG.architecture.hiddenDims[0] +
      ALPHANUMERIC_COMBINED_CONFIG.architecture.hiddenDims[0] +
      ALPHANUMERIC_COMBINED_CONFIG.architecture.hiddenDims[0] *
        ALPHANUMERIC_COMBINED_CONFIG.architecture.hiddenDims[1] +
      ALPHANUMERIC_COMBINED_CONFIG.architecture.hiddenDims[1] +
      ALPHANUMERIC_COMBINED_CONFIG.architecture.hiddenDims[1] *
        ALPHANUMERIC_COMBINED_CONFIG.classCount +
      ALPHANUMERIC_COMBINED_CONFIG.classCount,
  };
}
