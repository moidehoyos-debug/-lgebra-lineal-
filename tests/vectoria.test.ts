import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  analyzeLinearIndependence,
  analyzeVectors,
  applyLinearTransformation2D,
  computeEigen,
  matrixAdd,
  matrixDeterminant,
  matrixInverse,
  matrixMultiply,
  solveLinearSystem,
} from '../src/engines/linearAlgebra';
import {
  ALPHANUMERIC_LABELS,
  buildGlyphDataset,
  DIGIT_LABELS,
  rasterizeGlyph,
} from '../src/engines/alphanumericDataset';
import {
  createInitialNeuralSuite,
  MLPNetwork,
  softmax,
} from '../src/engines/neuralEngine';
import { tryRunLocalOmniEngine } from '../src/engines/omniLocalEngine';
import { applyThemeToDocument } from '../src/context/ThemeContext';
import { createInitialBuilderDocument } from '../src/utils/builderDefaults';
import {
  sanitizeBuilderText,
  sanitizeBuilderUrl,
  validateAndSanitizeBuilderDocument,
  validateModuleDependencies,
} from '../src/utils/builderSecurity';
import { resolveRealChartDataset } from '../src/utils/builderChartData';
import JSZip from 'jszip';
import {
  builderModificationReducer,
  createInitialModificationState,
  sanitizeComponentPatch,
} from '../src/components/builder/builderContext';
import { ProjectExporter } from '../server/projectExporter';
import { BackupScheduler } from '../server/backupScheduler';
import { createApp } from '../server';
import {
  appendLocalBackupHistory,
  computeNextBackupRunIso,
  createDefaultLocalBackupSchedule,
  formatTimeUntilIso,
  isBackupDue,
  loadLocalBackupSchedule,
  LOCAL_BACKUP_SCHEDULE_STORAGE_KEY,
  saveLocalBackupSchedule,
} from '../src/utils/scheduledBackup';
import {
  compressDirectoryMapWithJSZip,
  compressProjectDirectoryOnNode,
  isSensitiveExportPath,
} from '../src/services/zipExportService';
import {
  buildClassifierTrainingProgressSeries,
  buildSimulationPerformanceSeries,
  buildSingleClassifierEpochSeries,
  computeClassifierTrainingProgressStats,
  computeLaboratorySummaries,
  computeSimulationPerformanceStats,
  measureRuntimeMemorySnapshot,
} from '../src/utils/dashboardMetrics';
import type { SimulationRunRecord } from '../src/types/vectoria';
import {
  clearOmniCommandHistoryStorage,
  loadOmniCommandHistory,
  MAX_OMNI_COMMAND_HISTORY,
  recordOmniCommand,
  saveOmniCommandHistory,
} from '../src/utils/omniCommandHistory';
import {
  exportMainAreaToPdf,
  extractPrintableMainSummary,
  LAB_ANALYSIS_MODULE_IDS,
} from '../src/services/pdfExportService';
import {
  resolveVectorIALogoPalette,
  THEME_LOGO_PALETTES,
} from '../src/components/VectorIALogo';
import { shouldRenderNeuralHeaderBackdrop } from '../src/components/NeuralHeaderBackdrop';
import {
  buildThemeFaviconDataUri,
  buildThemeFaviconSvg,
  isLightFaviconTheme,
  updateDocumentFavicon,
} from '../src/utils/dynamicFavicon';
import {
  DEVELOPMENT_TEAM_METADATA,
  DEVELOPMENT_TEAM_STORAGE_KEY,
  loadDevelopmentTeam,
  OFFICIAL_DEVELOPMENT_TEAM,
  resetDevelopmentTeam,
  saveDevelopmentTeam,
} from '../src/config/developmentTeam';
import { OFFICIAL_TEAM_MEMBERS, OFFICIAL_TEAM_NAMES } from '../src/config/team';
import {
  buildGlobalSearchEntries,
  filterGlobalSearchEntries,
  normalizeSearchQuery,
} from '../src/utils/globalSearch';
import {
  buildOmniTechnicalReport,
  formatCalibrationAssistantMessage,
  formatReportAssistantMessage,
  resolveOmniQuickCommands,
} from '../src/utils/omniQuickCommands';

describe('VectorIA Linear Algebra Engine', () => {
  it('computes matrix addition and subtraction with dimension checks', () => {
    const res = matrixAdd(
      [
        [2, 1],
        [0, 3],
      ],
      [
        [1, 4],
        [2, -1],
      ]
    );
    expect(res.result).toEqual([
      [3, 5],
      [2, 2],
    ]);
    expect(res.verification.passed).toBe(true);
    expect(() => matrixAdd([[1, 2]], [[1], [2]])).toThrow();
  });

  it('computes matrix multiplication and validates inner dimensions', () => {
    const res = matrixMultiply(
      [
        [1, 2, 3],
        [4, 5, 6],
      ],
      [
        [7, 8],
        [9, 10],
        [11, 12],
      ]
    );
    expect(res.result).toEqual([
      [58, 64],
      [139, 154],
    ]);
    expect(res.verification.passed).toBe(true);
    expect(() => matrixMultiply([[1, 2]], [[1, 2]])).toThrow();
  });

  it('computes exact determinant and Gauss-Jordan inverse with residual < 1e-7', () => {
    const det = matrixDeterminant([
      [3, 1, 2],
      [0, 4, -1],
      [2, 1, 5],
    ]);
    expect(det.result).toBeCloseTo(45, 6);
    expect(det.verification.passed).toBe(true);

    const inv = matrixInverse([
      [4, 7],
      [2, 6],
    ]);
    expect(inv.verification.passed).toBe(true);
    expect(inv.verification.residual).toBeLessThan(1e-7);
    expect(() =>
      matrixInverse([
        [1, 2],
        [2, 4],
      ])
    ).toThrow();
  });

  it('solves linear systems via Gauss and Gauss-Jordan and detects inconsistency', () => {
    const A = [
      [2, 1, -1],
      [-3, -1, 2],
      [-2, 1, 2],
    ];
    const b = [8, -11, -3];
    const gauss = solveLinearSystem(A, b, 'gauss');
    const jordan = solveLinearSystem(A, b, 'gauss-jordan');
    expect(gauss.result.status).toBe('unique');
    expect(jordan.result.status).toBe('unique');
    expect(jordan.result.solution?.[0]).toBeCloseTo(2, 5);
    expect(jordan.result.solution?.[1]).toBeCloseTo(3, 5);
    expect(jordan.result.solution?.[2]).toBeCloseTo(-1, 5);
    expect(gauss.verification.residual).toBeLessThan(1e-7);

    const inconsistent = solveLinearSystem(
      [
        [1, 1],
        [1, 1],
      ],
      [2, 5],
      'gauss-jordan'
    );
    expect(inconsistent.result.status).toBe('inconsistent');
  });

  it('computes vector dot product, angle, cross product, independence, 2D transforms and eigenvalues', () => {
    const vec = analyzeVectors([1, 0, 0], [0, 1, 0]);
    expect(vec.result.dotProduct).toBe(0);
    expect(vec.result.angleDeg).toBeCloseTo(90, 5);
    expect(vec.result.crossProduct).toEqual([0, 0, 1]);

    const basis = analyzeLinearIndependence([
      [1, 0, 2],
      [0, 1, -1],
      [1, 1, 1],
    ]);
    expect(basis.result.isLinearlyIndependent).toBe(false);
    expect(basis.result.rank).toBe(2);
    expect(basis.result.nullity).toBe(1);

    const trans = applyLinearTransformation2D(
      [
        [2, 0],
        [0, 3],
      ],
      [1, 2]
    );
    expect(trans.result.transformedVector).toEqual([2, 6]);
    expect(trans.result.areaScaleFactor).toBeCloseTo(6, 5);

    const eig = computeEigen([
      [4, 1],
      [2, 3],
    ]);
    expect(eig.result.hasComplexEigenvalues).toBe(false);
    const vals = eig.result.pairs.map((p) => p.eigenvalue).sort((a, b) => a - b);
    expect(vals[0]).toBeCloseTo(2, 4);
    expect(vals[1]).toBeCloseTo(5, 4);
    expect(eig.verification.passed).toBe(true);
  });
});

describe('VectorIA Neural Engine & 36-Class Integrity', () => {
  it('conserves Softmax probability sum = 1 and passes finite-difference gradient check', () => {
    const mlp = new MLPNetwork('digits', DIGIT_LABELS, [16, 12], 123);
    const sample = { input: rasterizeGlyph('4'), label: '4', labelIndex: 4 };
    const fwd = mlp.forward(sample.input);
    const sum = fwd.probs.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 8);

    const soft = softmax([1000, 1001, 1002]);
    expect(soft.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 8);

    const gradCheck = mlp.checkNumericalGradient(sample);
    expect(gradCheck.passed).toBe(true);
    expect(gradCheck.maxRelError).toBeLessThan(1e-4);
  });

  it('keeps 36-class alphanumeric model untrained by default and improves loss after real training', () => {
    const alpha = new MLPNetwork('alphanumeric', ALPHANUMERIC_LABELS, [24, 16], 99);
    expect(alpha.isTrained).toBe(false);

    const train = buildGlyphDataset(ALPHANUMERIC_LABELS, 3, 1);
    const val = buildGlyphDataset(ALPHANUMERIC_LABELS, 2, 2);
    alpha.trainEpochs(train, val, 4, 0.05, 0.85);
    expect(alpha.isTrained).toBe(true);
    expect(alpha.history.length).toBe(4);
    expect(alpha.history[3].loss).toBeLessThan(alpha.history[0].loss);
  });
});

describe('Omni Bot Local Engine & Express API Security/Validation', () => {
  it('executes deterministic math commands locally', () => {
    const dummySummary = {
      mode: 'digits' as const,
      classCount: 10,
      labels: [...DIGIT_LABELS],
      isTrained: true,
      epochsTrained: 10,
      finalLoss: 0.2,
      trainAccuracy: 0.95,
      valAccuracy: 0.9,
      confusionMatrix: [],
      history: [],
      parameterCount: 9000,
      architecture: '256 -> 32 -> 24 -> 10',
      lastTrainedAt: null,
    };

    const hit = tryRunLocalOmniEngine('det([[3,1,2],[0,4,-1],[2,1,5]])', {
      activeModule: 'omni-bot',
      digitsSummary: dummySummary,
      lettersSummary: { ...dummySummary, mode: 'letters', classCount: 26 },
      alphanumericSummary: { ...dummySummary, mode: 'alphanumeric', classCount: 36, isTrained: false },
      lastPrediction: null,
    });
    expect(hit).not.toBeNull();
    expect(hit?.source).toBe('local-math');
    expect(hit?.answer).toContain('45');
  });

  it('validates Express API endpoints without exposing secrets', async () => {
    const app = createApp();
    const server = app.listen(0);
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 3001;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      const healthRes = await fetch(`${baseUrl}/api/health`);
      expect(healthRes.status).toBe(200);
      const healthJson = await healthRes.json();
      expect(healthJson.status).toBe('ok');
      expect(JSON.stringify(healthJson)).not.toContain('GEMINI_API_KEY');

      const mathRes = await fetch(`${baseUrl}/api/verify-math`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'determinant',
          matrixA: [
            [1, 2],
            [3, 4],
          ],
        }),
      });
      expect(mathRes.status).toBe(200);
      const mathJson = await mathRes.json();
      expect(mathJson.result).toBe(-2);

      const badChatRes = await fetch(`${baseUrl}/api/omni/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [] }),
      });
      expect(badChatRes.status).toBe(400);
    } finally {
      server.close();
    }
  });
});

import {
  persistQuickStartDismissed,
  QUICKSTART_STORAGE_KEY,
  shouldShowQuickStartGuide,
} from '../src/components/QuickStartGuide';

describe('QuickStartGuide First-Visit Persistence', () => {
  it('shows guide on first visit and persists dismissal state', () => {
    const map = new Map<string, string>();
    const mockStorage = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => {
        map.set(k, v);
      },
      removeItem: (k: string) => {
        map.delete(k);
      },
    };

    expect(shouldShowQuickStartGuide(mockStorage)).toBe(true);
    persistQuickStartDismissed(true, mockStorage);
    expect(map.get(QUICKSTART_STORAGE_KEY)).toBe('true');
    expect(shouldShowQuickStartGuide(mockStorage)).toBe(false);
    persistQuickStartDismissed(false, mockStorage);
    expect(shouldShowQuickStartGuide(mockStorage)).toBe(true);
  });
});

import {
  applyExperimentalPerturbation,
  createDefaultDidactic322Config,
  runABExperiment,
  runBatchPerturbationExperiment,
  runBeforeAfterExperiment,
  stepDidactic322,
} from '../src/engines/simulationEngine';

describe('Simulation Lab Engine & Experimental Isolation', () => {
  it('reproduces identical perturbations for the same seed and isolates baseline model weights', () => {
    const baseGrid = rasterizeGlyph('3');
    const p1 = applyExperimentalPerturbation(baseGrid, {
      shiftX: 2,
      shiftY: -1,
      noiseLevel: 0.2,
      perturbationIntensity: 0.2,
      seed: 2026,
    });
    const p2 = applyExperimentalPerturbation(baseGrid, {
      shiftX: 2,
      shiftY: -1,
      noiseLevel: 0.2,
      perturbationIntensity: 0.2,
      seed: 2026,
    });
    expect(p1).toEqual(p2);

    const mlp = new MLPNetwork('digits', DIGIT_LABELS, [16, 12], 55);
    const train = buildGlyphDataset(DIGIT_LABELS, 3, 10);
    const val = buildGlyphDataset(DIGIT_LABELS, 2, 11);
    mlp.trainEpochs(train, val, 3, 0.05, 0.85);

    const weightBefore = mlp.layers[0].W[0][0];
    const epochsBefore = mlp.epochsTrained;

    const expRes = runBeforeAfterExperiment(mlp, train, val, {
      mode: 'digits',
      targetGlyph: '3',
      shiftX: 1,
      shiftY: 1,
      noiseLevel: 0.2,
      perturbationIntensity: 0.1,
      learningRate: 0.08,
      epochs: 5,
      seed: 42,
      selectedClasses: ['3'],
    });

    // Baseline model must remain untouched!
    expect(mlp.layers[0].W[0][0]).toBe(weightBefore);
    expect(mlp.epochsTrained).toBe(epochsBefore);
    expect(expRes.layerDiffs.length).toBe(4);
  });

  it('reduces loss on Didactic 3-2-2 network and detects A/B parameter differences', () => {
    let cfg = createDefaultDidactic322Config();
    const first = stepDidactic322(cfg);
    expect(first.lossAfter).toBeLessThan(first.lossBefore);

    const mlp = new MLPNetwork('digits', DIGIT_LABELS, [16, 12], 77);
    const train = buildGlyphDataset(DIGIT_LABELS, 2, 21);
    const val = buildGlyphDataset(DIGIT_LABELS, 2, 22);

    const ab = runABExperiment(
      mlp,
      train,
      val,
      '3',
      {
        label: 'A',
        shiftX: 0,
        shiftY: 0,
        noiseLevel: 0.05,
        perturbationIntensity: 0,
        learningRate: 0.03,
        epochs: 0,
        seed: 100,
      },
      {
        label: 'B',
        shiftX: 2,
        shiftY: 0,
        noiseLevel: 0.3,
        perturbationIntensity: 0.2,
        learningRate: 0.06,
        epochs: 2,
        seed: 100,
      }
    );
    expect(ab.changedParams.length).toBeGreaterThanOrEqual(4);

    const batch = runBatchPerturbationExperiment(mlp, val, {
      mode: 'digits',
      targetGlyph: '3',
      shiftX: 1,
      shiftY: 0,
      noiseLevel: 0.15,
      perturbationIntensity: 0.1,
      learningRate: 0.04,
      epochs: 0,
      seed: 100,
      selectedClasses: ['0', '3', '7'],
    });
    expect(batch.perClass.length).toBe(3);
    expect(batch.sensitivityCurve.length).toBe(6);
  });
});

import {
  matrixLU,
  matrixQR,
  matrixRank,
  matrixTranspose,
} from '../src/engines/linearAlgebra';
import { isValidThemeId, THEME_OPTIONS } from '../src/context/ThemeContext';

describe('VectorIA Studio v2.0 Expansions (LU/QR, XAI, Evaluation, Themes, Exercises)', () => {
  it('computes Transpose, Rank/Nullity, PA=LU, and A=QR with passing residuals', () => {
    const tr = matrixTranspose([
      [1, 2, 3],
      [4, 5, 6],
    ]);
    expect(tr.result).toEqual([
      [1, 4],
      [2, 5],
      [3, 6],
    ]);
    expect(tr.verification.passed).toBe(true);

    const rk = matrixRank([
      [1, 2, 3],
      [2, 4, 6],
      [1, 1, 2],
    ]);
    expect(rk.result.rank).toBe(2);
    expect(rk.result.nullity).toBe(1);
    expect(rk.verification.passed).toBe(true);

    const A = [
      [2, 1, 1],
      [4, -6, 0],
      [-2, 7, 2],
    ];
    const lu = matrixLU(A);
    expect(lu.verification.passed).toBe(true);
    expect(lu.verification.residual).toBeLessThan(1e-7);

    const qr = matrixQR(A);
    expect(qr.verification.passed).toBe(true);
    expect(qr.verification.residual).toBeLessThan(1e-6);
  });

  it('produces XAI saliency explanation and detailed Precision/Recall/F1 evaluation', () => {
    const mlp = new MLPNetwork('digits', DIGIT_LABELS, [16, 12], 88);
    const train = buildGlyphDataset(DIGIT_LABELS, 4, 30);
    const val = buildGlyphDataset(DIGIT_LABELS, 3, 31);
    mlp.trainEpochs(train, val, 8, 0.05, 0.85);

    const xai = mlp.explainInputGradientXai(rasterizeGlyph('0'));
    expect(xai.saliencyGrid.length).toBe(256);
    expect(xai.topHiddenNeurons.length).toBeGreaterThan(0);
    expect(xai.saliencyGrid.every((v) => v >= 0 && v <= 1)).toBe(true);

    const detailed = mlp.evaluateDetailed(val);
    expect(detailed.isTrained).toBe(true);
    expect(detailed.perClass.length).toBe(10);
    expect(detailed.macroF1).toBeGreaterThanOrEqual(0);
    expect(detailed.avgInferenceMs).toBeGreaterThanOrEqual(0);
  });

  it('registers all 6 themes including black-gold and neural-cyberpunk and generates solved exercises locally', () => {
    expect(THEME_OPTIONS.length).toBe(6);
    expect(isValidThemeId('black-gold')).toBe(true);
    expect(isValidThemeId('neural-cyberpunk')).toBe(true);
    expect(isValidThemeId('unknown-theme')).toBe(false);

    const dummySummary = {
      mode: 'digits' as const,
      classCount: 10,
      labels: [...DIGIT_LABELS],
      isTrained: true,
      epochsTrained: 10,
      finalLoss: 0.2,
      trainAccuracy: 0.95,
      valAccuracy: 0.9,
      confusionMatrix: [],
      history: [],
      parameterCount: 9000,
      architecture: '256 -> 32 -> 24 -> 10',
      lastTrainedAt: null,
    };

    const ex = tryRunLocalOmniEngine('Genera un ejercicio de álgebra lineal para practicar', {
      activeModule: 'omni-bot',
      digitsSummary: dummySummary,
      lettersSummary: { ...dummySummary, mode: 'letters', classCount: 26 },
      alphanumericSummary: { ...dummySummary, mode: 'alphanumeric', classCount: 36, isTrained: false },
      lastPrediction: null,
    });
    expect(ex).not.toBeNull();
    expect(ex?.answer).toContain('det(A)');
  });
});

import {
  createDefaultDidactic232Config,
  DEFAULT_MNIST_PERTURB_CONFIG,
  downsample28x28To16x16,
  getMnist784ExamplePixels,
  getMnist784HistoricalReport,
  getMnist784Meta,
  getMnist784Weights,
  infer784,
  inspectMnist784Neuron,
  MNIST_784_PARAM_COUNT,
  perturbPixels28x28,
  runMnist784PerturbationComparison,
  stepDidactic232,
} from '../src/engines/mnist784Engine';

describe('Original HTML Recovery: 784-128-10, Perturbations 28x28 & Didactic 2-3-2', () => {
  it('decodes exact 101,770 immutable weights and matches synthetic N=300 historical metadata', () => {
    const weights = getMnist784Weights();
    expect(weights.length).toBe(MNIST_784_PARAM_COUNT);
    expect(Array.from(weights.slice(0, 50)).every(Number.isFinite)).toBe(true);

    const meta = getMnist784Meta();
    expect(meta.parametros).toBe(101770);
    expect(meta.evaluacion.total).toBe(300);
    expect(meta.evaluacion.correctos).toBe(249);
    expect(meta.evaluacion.exactitud).toBeCloseTo(0.83, 4);

    const report = getMnist784HistoricalReport();
    expect(report.history.length).toBe(10);
    expect(report.examples.length).toBe(10);
    const totalConfusion = report.confusion.flat().reduce((a, b) => a + b, 0);
    const diagConfusion = report.confusion.reduce((s, row, i) => s + row[i], 0);
    expect(totalConfusion).toBe(300);
    expect(diagConfusion).toBe(249);
  });

  it('runs deterministic 784-128-10 inference, neuron/pixel inspection, and 28->16 downsampling', () => {
    const px3 = getMnist784ExamplePixels(3);
    expect(px3.length).toBe(784);

    const res = infer784(px3);
    expect(res.digit).toBe(3);
    expect(res.probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 7);
    expect(res.activeNeurons).toBeGreaterThan(0);
    expect(res.activeNeurons).toBeLessThanOrEqual(128);

    const insp = inspectMnist784Neuron(px3, res, 400, 5);
    expect(insp.contribution).toBeCloseTo(insp.pixelValue * insp.weight, 10);
    expect(insp.a1).toBeCloseTo(Math.max(0, insp.z1), 10);
    expect(insp.outputProjections.length).toBe(10);

    const grid16 = downsample28x28To16x16(px3);
    expect(grid16.length).toBe(256);
    expect(grid16.every((v) => v >= 0 && v <= 1)).toBe(true);
  });

  it('applies pure 28x28 perturbations (shift, rotation, scale, thickness, intensity, distortion, noise)', () => {
    const base = getMnist784ExamplePixels(7);
    const w0Before = getMnist784Weights()[0];

    const idOut = perturbPixels28x28(base, DEFAULT_MNIST_PERTURB_CONFIG);
    expect(idOut.every((v, i) => Math.abs(v - base[i]) < 1e-6)).toBe(true);

    const cmp = runMnist784PerturbationComparison(base, {
      shiftX: 2,
      shiftY: -1,
      noiseLevel: 0.15,
      rotationDeg: 14,
      scale: 0.9,
      thickness: 0.5,
      intensity: 1.1,
      distortion: 0.3,
      seed: 2375,
    });
    expect(cmp.perturbedPixels.length).toBe(784);
    expect(cmp.perturbedPixels.every((v) => v >= 0 && v <= 1)).toBe(true);
    expect(cmp.softmaxComparison.length).toBe(10);
    // Read-only weights preserved
    expect(getMnist784Weights()[0]).toBe(w0Before);
  });

  it('executes independent 2-3-2 backpropagation matching finite-difference gradients', () => {
    const cfg = createDefaultDidactic232Config();
    const step = stepDidactic232(cfg);
    expect(step.lossAfter).toBeLessThan(step.lossBefore);
    expect(step.numericErrorW200).toBeLessThan(1e-6);
    expect(step.maxFiniteDiffError).toBeLessThan(1e-5);
    expect(step.probsBefore[0] + step.probsBefore[1]).toBeCloseTo(1, 8);
    expect(step.probsAfter[0] + step.probsAfter[1]).toBeCloseTo(1, 8);
  });

  it('answers 784-128-10 and synthetic MNIST provenance questions accurately in Omni Bot', () => {
    const px = getMnist784ExamplePixels(5);
    const res784 = infer784(px);
    const dummySummary = {
      mode: 'digits' as const,
      classCount: 10,
      labels: [...DIGIT_LABELS],
      isTrained: true,
      epochsTrained: 10,
      finalLoss: 0.2,
      trainAccuracy: 0.95,
      valAccuracy: 0.9,
      confusionMatrix: [],
      history: [],
      parameterCount: 9000,
      architecture: '256 -> 32 -> 24 -> 10',
      lastTrainedAt: null,
    };

    const prov = tryRunLocalOmniEngine('¿El 83% del modelo 784-128-10 es MNIST oficial o sintético?', {
      activeModule: 'omni-bot',
      digitsSummary: dummySummary,
      lettersSummary: { ...dummySummary, mode: 'letters', classCount: 26 },
      alphanumericSummary: { ...dummySummary, mode: 'alphanumeric', classCount: 36, isTrained: false },
      lastPrediction: null,
      mnist784Result: res784,
    });
    expect(prov).not.toBeNull();
    expect(prov?.answer).toContain('NO corresponden al conjunto oficial MNIST');
    expect(prov?.answer).toContain('83.0%');
  });
});

describe('Neural Cyberpunk Theme Instant Switch & Combined 36-Class Training', () => {
  it('applies data-theme="neural-cyberpunk", dark class, and CSS background/border rules cleanly', () => {
    const attrs = new Map<string, string>();
    const classes = new Set<string>();
    const mockRoot = {
      style: { colorScheme: '' },
      offsetHeight: 0,
      setAttribute: (k: string, v: string) => attrs.set(k, v),
      getAttribute: (k: string) => attrs.get(k) ?? null,
      classList: {
        add: (c: string) => classes.add(c),
        remove: (c: string) => classes.delete(c),
        contains: (c: string) => classes.has(c),
      },
    };
    const prevDoc = (globalThis as { document?: unknown }).document;
    (globalThis as { document: unknown }).document = { documentElement: mockRoot };

    try {
      applyThemeToDocument('neural-cyberpunk', true);
      expect(mockRoot.getAttribute('data-theme')).toBe('neural-cyberpunk');
      expect(mockRoot.classList.contains('dark')).toBe(true);
      expect(mockRoot.style.colorScheme).toBe('dark');
    } finally {
      if (prevDoc === undefined) {
        delete (globalThis as { document?: unknown }).document;
      } else {
        (globalThis as { document: unknown }).document = prevDoc;
      }
    }

    const css = fs.readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf8');
    expect(css).toContain('html[data-theme="neural-cyberpunk"]');
    expect(css).toContain('--bg-canvas: #0b0d12;');
    expect(css).toContain('--border-hairline: rgba(34, 211, 238, 0.22);');
    expect(css).toContain('html.theme-instant *');

    const html = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
    expect(html).toContain('/theme-init.js');
    const themeInitScript = fs.readFileSync(path.resolve(process.cwd(), 'public/theme-init.js'), 'utf8');
    expect(themeInitScript).toContain('neural-cyberpunk');
  });

  it('trains the combined 36-class alphanumeric model (0-9, A-Z) in createInitialNeuralSuite with high validation accuracy', () => {
    const suite = createInitialNeuralSuite();
    expect(suite.digitsModel.isTrained).toBe(true);
    expect(suite.lettersModel.isTrained).toBe(true);
    expect(suite.alphanumericModel.isTrained).toBe(true);

    expect(suite.digitsModel.lastValAccuracy).toBeGreaterThanOrEqual(0.9);
    expect(suite.lettersModel.lastValAccuracy).toBeGreaterThanOrEqual(0.9);
    expect(suite.alphanumericModel.lastValAccuracy).toBeGreaterThanOrEqual(0.9);

    const pred3 = suite.alphanumericModel.predictScores(rasterizeGlyph('3'));
    const predA = suite.alphanumericModel.predictScores(rasterizeGlyph('A'));
    expect(pred3.allScores.length).toBe(36);
    expect(pred3.topLabel).toBe('3');
    expect(predA.topLabel).toBe('A');
    expect(pred3.allScores.reduce((s, x) => s + x.probability, 0)).toBeCloseTo(1, 7);
  }, 15000);
});

import { readChartPalette } from '../src/components/charts/chartTheme';

describe('Scientific Visualization System & Multi-Theme Chart Tokens', () => {
  it('defines --chart-1 through --chart-5 across all 6 themes and resolves readChartPalette cleanly', () => {
    const css = fs.readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf8');
    const themes = [
      'dark-purple',
      'light-yellow',
      'classic-mono',
      'holographic',
      'black-gold',
      'neural-cyberpunk',
    ];
    for (const t of themes) {
      expect(css).toContain(`html[data-theme="${t}"]`);
    }
    for (const token of ['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5']) {
      const matches = css.match(new RegExp(token, 'g')) ?? [];
      expect(matches.length).toBeGreaterThanOrEqual(6);
    }

    const darkPalette = readChartPalette(true);
    expect(darkPalette.isDark).toBe(true);
    expect(darkPalette.chart1).toBeTruthy();
    expect(darkPalette.chart5).toBeTruthy();
    expect(darkPalette.accentSecondary).toBeTruthy();

    const lightPalette = readChartPalette(false);
    expect(lightPalette.isDark).toBe(false);
    expect(lightPalette.textPrimary).toBeTruthy();
  });
});

import {
  ALPHANUMERIC_COMBINED_CONFIG,
  buildCombinedAlphanumericDatasets,
  encodeAlphanumericTarget,
  getCombinedAlphanumericSpecSummary,
  validateCombinedTrainingBatch,
} from '../src/utils/alphanumericTraining';
import {
  BACKUP_SCHEMA_VERSION,
  loadBackupSnapshots,
  MAX_BACKUP_FILE_BYTES,
  MAX_BACKUP_SLOTS,
  sanitizeUserText,
  saveBackupSnapshot,
  validateBackupUpload,
  VECTORIA_VERSION,
} from '../src/utils/backupVersioning';
import { redactSecrets } from '../server';

describe('Combined Alphanumeric Training Spec (src/utils/alphanumericTraining.ts)', () => {
  it('defines unified 36-class tensor specs, one-hot target encoding, and balanced datasets', () => {
    expect(ALPHANUMERIC_COMBINED_CONFIG.classCount).toBe(36);
    expect(ALPHANUMERIC_COMBINED_CONFIG.inputTensor.shape).toEqual([256]);
    expect(ALPHANUMERIC_COMBINED_CONFIG.inputTensor.spatialShape).toEqual([16, 16]);
    expect(ALPHANUMERIC_COMBINED_CONFIG.targetTensor.shape).toEqual([36]);
    expect(ALPHANUMERIC_COMBINED_CONFIG.targetTensor.digitRangeIndices).toEqual([0, 9]);
    expect(ALPHANUMERIC_COMBINED_CONFIG.targetTensor.letterRangeIndices).toEqual([10, 35]);

    const t0 = encodeAlphanumericTarget('0');
    expect(t0.classIndex).toBe(0);
    expect(t0.category).toBe('digit');
    expect(t0.oneHot.reduce((a, b) => a + b, 0)).toBe(1);

    const tZ = encodeAlphanumericTarget('z');
    expect(tZ.classIndex).toBe(35);
    expect(tZ.category).toBe('letter');
    expect(tZ.oneHot[35]).toBe(1);

    expect(() => encodeAlphanumericTarget('@')).toThrow();

    const { trainSet, valSet, validation } = buildCombinedAlphanumericDatasets();
    expect(trainSet.length).toBe(36 * ALPHANUMERIC_COMBINED_CONFIG.architecture.trainSamplesPerClassInit);
    expect(valSet.length).toBe(36 * ALPHANUMERIC_COMBINED_CONFIG.architecture.valSamplesPerClassInit);
    expect(validation.valid).toBe(true);
    expect(validation.coveredClasses).toBe(36);

    const summary = getCombinedAlphanumericSpecSummary();
    expect(summary.totalParametersEstimate).toBeGreaterThan(12000);
  });

  it('rejects malformed tensor dimensions or out-of-range pixel values in batch validation', () => {
    const badReport = validateCombinedTrainingBatch(
      [{ input: [0.5, 1.5], label: '0', labelIndex: 0 }],
      []
    );
    expect(badReport.valid).toBe(false);
    expect(badReport.errors.length).toBeGreaterThan(0);
  });
});

describe('Backup Versioning Ring Buffer & Upload Security', () => {
  it('sanitizes text, preserves multi-slot ring buffer snapshots, and validates backup uploads', () => {
    expect(sanitizeUserText('<script>xss()</script>  Ada  ')).toBe('scriptxss()/script  Ada');

    const store = new Map<string, string>();
    const mockStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
    };

    const basePayload = {
      schemaVersion: BACKUP_SCHEMA_VERSION,
      appVersion: VECTORIA_VERSION,
      theme: 'neural-cyberpunk' as const,
      classifierMode: 'alphanumeric' as const,
      userProfile: {
        name: 'Investigador',
        role: 'Ingeniero de IA',
        institution: 'Lab',
        program: 'IA',
        planTier: 'academico' as const,
      },
      simulationHistory: [],
      reportHistory: [],
    };

    for (let i = 1; i <= MAX_BACKUP_SLOTS + 2; i++) {
      saveBackupSnapshot(`Snap ${i}`, basePayload, mockStorage);
    }

    const loaded = loadBackupSnapshots(mockStorage);
    expect(loaded.length).toBe(MAX_BACKUP_SLOTS);
    expect(loaded[0].reason).toBe(`Snap ${MAX_BACKUP_SLOTS + 2}`);
    expect(loaded[1].reason).toBe(`Snap ${MAX_BACKUP_SLOTS + 1}`);

    const badExt = validateBackupUpload('backup.txt', 100, JSON.stringify(basePayload));
    expect(badExt.valid).toBe(false);

    const badSize = validateBackupUpload('backup.json', MAX_BACKUP_FILE_BYTES + 1, '{}');
    expect(badSize.valid).toBe(false);

    const secretLeak = validateBackupUpload(
      'backup.json',
      200,
      JSON.stringify({ ...basePayload, leak: 'AIzaSyTestFakeKeyValue123456789012345' })
    );
    expect(secretLeak.valid).toBe(false);

    const ok = validateBackupUpload('backup.json', 400, JSON.stringify(basePayload));
    expect(ok.valid).toBe(true);
  });
});

describe('Server Layered Security, Diagnostics Telemetry, Caching & Math Optimization', () => {
  it('redacts secret strings and enforces CORS, bounds, cache, diagnostics, and rate limits', async () => {
    expect(redactSecrets('key=AIzaSyTestFakeKeyValue123456789012345 Bearer abc12345')).toBe(
      'key=[REDACTED_KEY] Bearer [REDACTED]'
    );

    const app = createApp();
    const server = app.listen(0);
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 3002;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      // Unauthorized CORS origin rejected
      const corsRes = await fetch(`${baseUrl}/api/verify-math`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://unauthorized.example.com',
        },
        body: JSON.stringify({ operation: 'determinant', matrixA: [[1]] }),
      });
      expect(corsRes.status).toBe(403);

      // Matrix larger than 12x12 rejected
      const bigMatrix = Array.from({ length: 13 }, () => Array(13).fill(1));
      const bigRes = await fetch(`${baseUrl}/api/verify-math`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: 'determinant', matrixA: bigMatrix }),
      });
      expect(bigRes.status).toBe(400);

      // Deterministic math cache HIT/MISS
      const payload = JSON.stringify({
        operation: 'determinant',
        matrixA: [
          [2, 1],
          [5, 3],
        ],
      });
      const first = await fetch(`${baseUrl}/api/verify-math`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });
      expect(first.status).toBe(200);
      expect(first.headers.get('x-cache')).toBe('MISS');

      const second = await fetch(`${baseUrl}/api/verify-math`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });
      expect(second.status).toBe(200);
      expect(second.headers.get('x-cache')).toBe('HIT');

      // Rate limiter triggers 429 on omni/chat after 25 requests
      let got429 = false;
      for (let i = 0; i < 27; i++) {
        const r = await fetch(`${baseUrl}/api/omni/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: [] }),
        });
        if (r.status === 429) {
          got429 = true;
          expect(r.headers.get('retry-after')).toBeTruthy();
          break;
        }
      }
      expect(got429).toBe(true);

      // Diagnostics endpoint exposes real metrics & security headers
      const diagRes = await fetch(`${baseUrl}/api/diagnostics`);
      expect(diagRes.status).toBe(200);
      expect(diagRes.headers.get('x-content-type-options')).toBe('nosniff');
      expect(diagRes.headers.get('content-security-policy')).toContain("default-src 'self'");
      const diag = await diagRes.json();
      expect(diag.security.cspEnabled).toBe(true);
      expect(diag.mathCache.hits).toBeGreaterThanOrEqual(1);
      expect(diag.traffic.rateLimitedCount).toBeGreaterThanOrEqual(1);
    } finally {
      server.close();
    }
  });

  it('matches naive reference matrix multiplication within 1e-12 precision', () => {
    const A = Array.from({ length: 10 }, (_, i) =>
      Array.from({ length: 10 }, (__, j) => ((i + j) % 3 === 0 ? 0 : (i * 0.7 - j * 0.4)))
    );
    const B = Array.from({ length: 10 }, (_, i) =>
      Array.from({ length: 10 }, (__, j) => ((i * j) % 4 === 0 ? 0 : (j * 0.5 + i * 0.2)))
    );
    const out = matrixMultiply(A, B).result;
    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 10; j++) {
        let ref = 0;
        for (let k = 0; k < 10; k++) ref += A[i][k] * B[k][j];
        expect(Math.abs(out[i][j] - ref)).toBeLessThan(1e-12);
      }
    }
  });
});

import {
  buildSecureExperimentsAndModelsExport,
  decryptEncryptedGlobalStateJson,
  ENCRYPTED_GLOBAL_ARCHIVE_SCHEMA,
  encryptGlobalStateToJson,
  EXPERIMENTS_MODELS_ARCHIVE_SCHEMA,
  validateUploadedStateJson,
  verifyExperimentsAndModelsExport,
} from '../src/utils/backupVersioning';

describe('Secure Experiments & Trained Models JSON Export and Pre-Restore Verification', () => {
  it('exports current experiments and trained model states safely with SHA-256 integrity verification', async () => {
    const suite = createInitialNeuralSuite();
    const digitsState = suite.digitsModel.exportSerializedState(true);
    expect(digitsState.isTrained).toBe(true);
    expect(digitsState.layers?.length).toBe(3);

    const noWeightsState = suite.alphanumericModel.exportSerializedState(false);
    expect(noWeightsState.layers).toBeUndefined();
    expect(noWeightsState.labels.length).toBe(36);

    const { archive, jsonText, byteSize } = await buildSecureExperimentsAndModelsExport({
      theme: 'neural-cyberpunk',
      classifierMode: 'alphanumeric',
      userProfile: {
        name: 'Nombre Privado Omitido',
        role: 'Investigador <script>alert(1)</script>',
        institution: 'Facultad',
        program: 'IA y GEMINI_API_KEY=secreto123',
        planTier: 'academico',
      },
      sharedMatrix2D: [
        [1, 0],
        [0, 1],
      ],
      simulationConfig: {
        mode: 'digits',
        targetGlyph: '3',
        shiftX: 1,
        shiftY: 0,
        noiseLevel: 0.15,
        perturbationIntensity: 0.1,
        learningRate: 0.04,
        epochs: 0,
        seed: 2026,
        selectedClasses: ['0', '3'],
      },
      simulationHistory: [],
      predictionHistory: [],
      mnist784PerturbConfig: DEFAULT_MNIST_PERTURB_CONFIG,
      mnist784PerturbResult: null,
      last232Step: null,
      reportHistory: [],
      includeWeights: true,
      digitsModelState: digitsState,
      lettersModelState: suite.lettersModel.exportSerializedState(true),
      alphanumericModelState: suite.alphanumericModel.exportSerializedState(true),
      mnist784ReadOnlySummary: {
        architecture: '784 → 128 (ReLU) → 10 (Softmax)',
        parameters: 101770,
        syntheticEvalTotal: 300,
        syntheticEvalCorrect: 249,
        syntheticEvalAccuracy: 0.83,
      },
    });

    expect(byteSize).toBeGreaterThan(1000);
    expect(archive.schema).toBe(EXPERIMENTS_MODELS_ARCHIVE_SCHEMA);
    expect(archive.security.containsSecrets).toBe(false);
    expect(jsonText).not.toContain('secreto123');
    expect(jsonText).not.toContain('<script>');
    expect(archive.data.trainedModels.alphanumeric.layers?.length).toBe(3);

    const verified = await verifyExperimentsAndModelsExport(jsonText);
    expect(verified.valid).toBe(true);

    const tampered = jsonText.replace('"digits"', '"tampered"');
    const badCheck = await verifyExperimentsAndModelsExport(tampered);
    expect(badCheck.valid).toBe(false);

    // Unified upload validator accepts valid archive and restores MLP weights identically
    const uploadedOk = await validateUploadedStateJson('archive.json', byteSize, jsonText);
    expect(uploadedOk.valid).toBe(true);
    if (uploadedOk.valid && uploadedOk.kind === 'experiments-models') {
      const freshModel = new MLPNetwork('digits', DIGIT_LABELS, [32, 24], 999);
      freshModel.importSerializedState(uploadedOk.archive.data.trainedModels.digits);
      expect(freshModel.isTrained).toBe(true);
      expect(freshModel.predictScores(rasterizeGlyph('3')).topLabel).toBe('3');
    }
  }, 15000);

  it('rejects corrupt JSON, missing mandatory fields, and incompatible versions with clear errors', async () => {
    const corrupt = await validateUploadedStateJson('bad.json', 20, '{ invalid json');
    expect(corrupt.valid).toBe(false);
    if (!corrupt.valid) {
      expect(corrupt.errorCode).toBe('CORRUPT_JSON');
      expect(corrupt.error).toContain('corrupto');
    }

    const incompatibleBackup = await validateUploadedStateJson(
      'old.json',
      120,
      JSON.stringify({ schemaVersion: 99, appVersion: '9.0.0' })
    );
    expect(incompatibleBackup.valid).toBe(false);
    if (!incompatibleBackup.valid) {
      expect(incompatibleBackup.errorCode).toBe('INCOMPATIBLE_VERSION');
      expect(incompatibleBackup.error).toContain('incompatible');
    }

    const incompatibleArchive = await validateUploadedStateJson(
      'v9.json',
      200,
      JSON.stringify({
        schema: EXPERIMENTS_MODELS_ARCHIVE_SCHEMA,
        appVersion: '9.0.0',
        integrity: { algorithm: 'SHA-256', digest: 'abc' },
        data: {},
      })
    );
    expect(incompatibleArchive.valid).toBe(false);
    if (!incompatibleArchive.valid) {
      expect(incompatibleArchive.errorCode).toBe('INCOMPATIBLE_VERSION');
      expect(incompatibleArchive.error).toContain('incompatible');
    }

    const missingFields = await validateUploadedStateJson(
      'incomplete.json',
      80,
      JSON.stringify({ schemaVersion: 1, appVersion: '2.1.0', theme: 'neural-cyberpunk' })
    );
    expect(missingFields.valid).toBe(false);
    if (!missingFields.valid) {
      expect(missingFields.errorCode).toBe('MISSING_FIELDS');
      expect(missingFields.error).toContain('obligatorios');
    }

    const noVersionFields = await validateUploadedStateJson(
      'unknown.json',
      40,
      JSON.stringify({ foo: 'bar' })
    );
    expect(noVersionFields.valid).toBe(false);
    if (!noVersionFields.valid) {
      expect(noVersionFields.errorCode).toBe('MISSING_FIELDS');
    }
  });

  it('encrypts global state with AES-256-GCM + PBKDF2-SHA256, hides plaintext, rejects wrong passphrases or tampering, and decrypts cleanly', async () => {
    const suite = createInitialNeuralSuite();
    const baseInput = {
      theme: 'neural-cyberpunk' as const,
      classifierMode: 'alphanumeric' as const,
      userProfile: {
        name: 'Investigador',
        role: 'Científico de Datos',
        institution: 'VectorIA Lab',
        program: 'Deep Learning',
        planTier: 'academico' as const,
      },
      sharedMatrix2D: [
        [2, 1],
        [0, 3],
      ],
      simulationConfig: {
        mode: 'digits' as const,
        targetGlyph: '7',
        shiftX: 0,
        shiftY: 0,
        noiseLevel: 0.1,
        perturbationIntensity: 0.05,
        learningRate: 0.005,
        epochs: 12,
        seed: 2026,
        selectedClasses: ['0', '7'],
      },
      simulationHistory: [],
      predictionHistory: [],
      mnist784PerturbConfig: DEFAULT_MNIST_PERTURB_CONFIG,
      mnist784PerturbResult: null,
      last232Step: null,
      reportHistory: [],
      includeWeights: true,
      digitsModelState: suite.digitsModel.exportSerializedState(true),
      lettersModelState: suite.lettersModel.exportSerializedState(true),
      alphanumericModelState: suite.alphanumericModel.exportSerializedState(true),
      mnist784ReadOnlySummary: {
        architecture: '784 → 128 (ReLU) → 10 (Softmax)',
        parameters: 101770,
        syntheticEvalTotal: 300,
        syntheticEvalCorrect: 249,
        syntheticEvalAccuracy: 0.83,
      },
    };

    await expect(encryptGlobalStateToJson(baseInput, 'corta')).rejects.toThrow();

    const passphrase = 'VectorIA-Secret-Key-2026!';
    const encrypted = await encryptGlobalStateToJson(baseInput, passphrase);
    expect(encrypted.envelope.schema).toBe(ENCRYPTED_GLOBAL_ARCHIVE_SCHEMA);
    expect(encrypted.envelope.encryption.algorithm).toBe('AES-256-GCM');
    expect(encrypted.envelope.encryption.kdf).toBe('PBKDF2-SHA256');
    expect(encrypted.envelope.security.plaintextExposed).toBe(false);
    expect(encrypted.byteSize).toBeGreaterThan(1000);

    // Confirm sensitive data and model architecture details are NOT exposed in plaintext JSON
    expect(encrypted.jsonText).not.toContain('neural-cyberpunk');
    expect(encrypted.jsonText).not.toContain('VectorIA Lab');
    expect(encrypted.jsonText).not.toContain('trainedModels');

    // Unified upload validator detects encrypted archive and asks for passphrase
    const preCheck = await validateUploadedStateJson(
      'estado_cifrado.json',
      encrypted.byteSize,
      encrypted.jsonText
    );
    expect(preCheck.valid).toBe(false);
    if (!preCheck.valid) {
      expect(preCheck.errorCode).toBe('PASSPHRASE_REQUIRED');
    }

    // Wrong passphrase must fail cleanly
    const wrongPass = await decryptEncryptedGlobalStateJson(
      'estado_cifrado.json',
      encrypted.byteSize,
      encrypted.jsonText,
      'ClaveIncorrecta-999'
    );
    expect(wrongPass.valid).toBe(false);
    if (!wrongPass.valid) {
      expect(wrongPass.errorCode).toBe('DECRYPTION_FAILED');
    }

    // Tampered ciphertext must fail AES-GCM authentication tag check
    const parsedEnvelope = JSON.parse(encrypted.jsonText);
    const originalCipher = parsedEnvelope.ciphertext as string;
    const flippedChar = originalCipher[0] === 'A' ? 'B' : 'A';
    parsedEnvelope.ciphertext = flippedChar + originalCipher.slice(1);
    const tamperedText = JSON.stringify(parsedEnvelope);
    const tamperedRes = await decryptEncryptedGlobalStateJson(
      'estado_cifrado.json',
      tamperedText.length,
      tamperedText,
      passphrase
    );
    expect(tamperedRes.valid).toBe(false);
    if (!tamperedRes.valid) {
      expect(tamperedRes.errorCode).toBe('DECRYPTION_FAILED');
    }

    // Correct passphrase decrypts, validates SHA-256 & restores trained model weights
    const okRes = await decryptEncryptedGlobalStateJson(
      'estado_cifrado.json',
      encrypted.byteSize,
      encrypted.jsonText,
      passphrase
    );
    expect(okRes.valid).toBe(true);
    if (okRes.valid && okRes.kind === 'experiments-models') {
      expect(okRes.archive.data.activeState.theme).toBe('neural-cyberpunk');
      expect(okRes.archive.data.activeState.sharedMatrix2D).toEqual([
        [2, 1],
        [0, 3],
      ]);
      const alphaHidden: [number, number] = [
        suite.alphanumericModel.layers[0].outDim,
        suite.alphanumericModel.layers[1].outDim,
      ];
      const restoredAlpha = new MLPNetwork('alphanumeric', ALPHANUMERIC_LABELS, alphaHidden, 100);
      restoredAlpha.importSerializedState(okRes.archive.data.trainedModels.alphanumeric);
      expect(restoredAlpha.isTrained).toBe(true);
      expect(restoredAlpha.predictScores(rasterizeGlyph('A')).topLabel).toBe('A');
    }
  }, 15000);
});

describe('VectorIA Visual Builder (Level 1 + Level 2 + RBAC + Persistence)', () => {
  it('sanitizes XSS payloads, blocks dangerous URLs, and validates Level 2 module dependencies', () => {
    expect(sanitizeBuilderText('<script>alert(1)</script>Hola <b>mundo</b>')).not.toContain('<script>');
    expect(sanitizeBuilderText('onclick=steal()')).not.toContain('onclick=');
    expect(sanitizeBuilderUrl('javascript:alert(1)')).toBe('');
    expect(sanitizeBuilderUrl('data:image/svg+xml;base64,PHN2Zz4=', true)).toBe('');
    expect(sanitizeBuilderUrl('https://vectoria.edu/img.png')).toBe('https://vectoria.edu/img.png');
    expect(sanitizeBuilderUrl('/favicon.svg')).toBe('/favicon.svg');

    const doc = createInitialBuilderDocument();
    const validCheck = validateAndSanitizeBuilderDocument(doc);
    expect(validCheck.valid).toBe(true);

    // Disabling linear-algebra-engine while neural-mlp-engine is enabled must fail dependency validation
    const brokenModules = doc.modules.map((m) =>
      m.id === 'linear-algebra-engine' ? { ...m, enabled: false } : m
    );
    const depCheck = validateModuleDependencies(brokenModules);
    expect(depCheck.valid).toBe(false);
    expect(depCheck.errors.length).toBeGreaterThan(0);

    // Circular dependency detection
    const cyclic = [
      { ...doc.modules[0], id: 'mod-a', dependencies: ['mod-b'], enabled: true },
      { ...doc.modules[1], id: 'mod-b', dependencies: ['mod-a'], enabled: true },
    ];
    const cycleCheck = validateModuleDependencies(cyclic);
    expect(cycleCheck.valid).toBe(false);
  });

  it('resolves real chart datasets without fabricating numbers', () => {
    const suite = createInitialNeuralSuite();
    const ds = resolveRealChartDataset('models-comparison', {
      digitsSummary: suite.digitsModel.getSummary(),
      lettersSummary: suite.lettersModel.getSummary(),
      alphanumericSummary: suite.alphanumericModel.getSummary(),
      lastPrediction: null,
      predictionHistory: [],
      simulationHistory: [],
      lastMathOutput: null,
    });
    expect(ds.rows.length).toBe(4);
    expect(Number(ds.rows[2].valPct)).toBeCloseTo(
      Number((suite.alphanumericModel.getSummary().valAccuracy * 100).toFixed(1)),
      1
    );
  }, 15000);

  it('enforces scrypt + HMAC-SHA256 auth, RBAC, draft/published separation, disk persistence, version restore, and logout', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vectoria-builder-'));
    const storeFile = path.join(tmpDir, 'builder.json');
    const setupToken = 'TestSetupToken#VectorIA2026';
    const app = createApp({ builderStoragePath: storeFile, setupToken });
    const server = app.listen(0);
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    const base = `http://127.0.0.1:${port}`;

    try {
      // Unauthenticated private state must return 401
      const unauthState = await fetch(`${base}/api/builder/state`);
      expect(unauthState.status).toBe(401);

      // Setup without valid setupToken must fail with 403
      const badSetupRes = await fetch(`${base}/api/builder/auth/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPasscode: 'Admin-VectorIA-2026' }),
      });
      expect(badSetupRes.status).toBe(403);

      // Setup initial admin + viewer credentials using bootstrap token
      const setupRes = await fetch(`${base}/api/builder/auth/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminPasscode: 'Admin-VectorIA-2026',
          viewerPasscode: 'Viewer-VectorIA-2026',
          setupToken,
        }),
      });
      expect(setupRes.status).toBe(201);
      const setupJson = (await setupRes.json()) as { token: string; role: string };
      expect(setupJson.role).toBe('admin');
      expect(setupJson.token.length).toBeGreaterThan(20);

      // Wrong passcode must return 401
      const badLogin = await fetch(`${base}/api/builder/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: 'ClaveEquivocada', role: 'admin' }),
      });
      expect(badLogin.status).toBe(401);

      // Passwordless viewer bypass must be strictly rejected (401)
      const emptyViewerRes = await fetch(`${base}/api/builder/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: '', role: 'viewer' }),
      });
      expect(emptyViewerRes.status).toBe(401);

      // Viewer role with valid passcode authenticates cleanly, cannot mutate draft (403)
      const viewerRes = await fetch(`${base}/api/builder/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: 'Viewer-VectorIA-2026', role: 'viewer' }),
      });
      expect(viewerRes.status).toBe(200);
      const viewerJson = (await viewerRes.json()) as { token: string };
      const forbiddenPut = await fetch(`${base}/api/builder/draft`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${viewerJson.token}`,
        },
        body: JSON.stringify({ document: createInitialBuilderDocument() }),
      });
      expect(forbiddenPut.status).toBe(403);

      // Admin saves draft with new custom page -> published endpoint must NOT change yet
      const modifiedDoc = createInitialBuilderDocument();
      modifiedDoc.pages[0].title = 'Observatorio Borrador Secreto';
      const saveDraftRes = await fetch(`${base}/api/builder/draft`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${setupJson.token}`,
        },
        body: JSON.stringify({
          document: modifiedDoc,
          description: 'Cambio en borrador',
          changedItems: ['Título'],
        }),
      });
      expect(saveDraftRes.status).toBe(200);
      const savedBundle = (await saveDraftRes.json()) as {
        hasUnpublishedChanges: boolean;
        versions: Array<{ id: string }>;
      };
      expect(savedBundle.hasUnpublishedChanges).toBe(true);

      const pubBefore = (await (await fetch(`${base}/api/builder/published`)).json()) as {
        published: { pages: Array<{ title: string }> };
      };
      expect(pubBefore.published.pages[0].title).toBe('Observatorio del Estudio');

      // Publish draft -> public state updates cleanly
      const pubRes = await fetch(`${base}/api/builder/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${setupJson.token}`,
        },
        body: JSON.stringify({ description: 'Publicación verificada' }),
      });
      expect(pubRes.status).toBe(200);

      const pubAfter = (await (await fetch(`${base}/api/builder/published`)).json()) as {
        published: { pages: Array<{ title: string }> };
      };
      expect(pubAfter.published.pages[0].title).toBe('Observatorio Borrador Secreto');

      // Verify persistence to disk across fresh server instance
      const app2 = createApp({ builderStoragePath: storeFile });
      const server2 = app2.listen(0);
      const port2 = (server2.address() as { port: number }).port;
      try {
        const persistedPub = (await (
          await fetch(`http://127.0.0.1:${port2}/api/builder/published`)
        ).json()) as { published: { pages: Array<{ title: string }> } };
        expect(persistedPub.published.pages[0].title).toBe('Observatorio Borrador Secreto');
      } finally {
        server2.close();
      }

      // Restore initial version and verify token revocation on logout
      const initialVersionId = savedBundle.versions[savedBundle.versions.length - 1].id;
      const restoreRes = await fetch(
        `${base}/api/builder/versions/${encodeURIComponent(initialVersionId)}/restore`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${setupJson.token}` },
        }
      );
      expect(restoreRes.status).toBe(200);

      await fetch(`${base}/api/builder/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${setupJson.token}` },
      });
      const afterLogout = await fetch(`${base}/api/builder/state`, {
        headers: { Authorization: `Bearer ${setupJson.token}` },
      });
      expect(afterLogout.status).toBe(401);
    } finally {
      server.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('manages non-destructive component overrides with sanitization and undo/redo in builderContext', () => {
    const sanitized = sanitizeComponentPatch('dashboard-kpi', {
      customTitle: '<script>alert(1)</script>Panel Métrico',
      accentColor: 'javascript:alert(1)',
      paddingPx: 120,
      colSpan: 6,
    });
    expect(sanitized.customTitle).toBe('Panel Métrico');
    expect(sanitized.accentColor).toBeUndefined();
    expect(sanitized.paddingPx).toBe(64);
    expect(sanitized.colSpan).toBe(6);

    let state = createInitialModificationState();
    state = builderModificationReducer(state, {
      type: 'REGISTER_TARGET',
      target: { targetId: 'linear-algebra-panel', defaultTitle: 'Álgebra Lineal', defaultColSpan: 12 },
    });
    state = builderModificationReducer(state, { type: 'SET_EDIT_MODE', enabled: true });
    state = builderModificationReducer(state, { type: 'SELECT_TARGET', targetId: 'linear-algebra-panel' });
    state = builderModificationReducer(state, {
      type: 'APPLY_OVERRIDE',
      targetId: 'linear-algebra-panel',
      patch: { customTitle: 'Laboratorio Matricial Personalizado', colSpan: 8, visible: false },
    });

    expect(state.overrides['linear-algebra-panel']?.customTitle).toBe(
      'Laboratorio Matricial Personalizado'
    );
    expect(state.overrides['linear-algebra-panel']?.visible).toBe(false);
    expect(state.past.length).toBe(1);

    state = builderModificationReducer(state, { type: 'UNDO' });
    expect(state.overrides['linear-algebra-panel']).toBeUndefined();
    expect(state.future.length).toBe(1);

    state = builderModificationReducer(state, { type: 'REDO' });
    expect(state.overrides['linear-algebra-panel']?.colSpan).toBe(8);

    state = builderModificationReducer(state, {
      type: 'RESET_OVERRIDE',
      targetId: 'linear-algebra-panel',
    });
    expect(state.overrides['linear-algebra-panel']).toBeUndefined();
  });
});

describe('VectorIA Project ZIP Export System (3 Modes, Validation, Security & Clean Restore)', () => {
  it('generates and validates full, distribution, and sanitized backup ZIP archives excluding node_modules, .git, and secrets', async () => {
    const tmpOut = fs.mkdtempSync(path.join(os.tmpdir(), 'vectoria-zip-unit-'));
    const storeFile = path.join(tmpOut, 'vectoria-builder.json');
    fs.writeFileSync(
      storeFile,
      JSON.stringify({
        authInitialized: true,
        adminHash: 'deadbeef00112233:cafebabe44556677',
        editorHash: '11223344:55667788',
        signingSecret: '0123456789abcdef0123456789abcdef',
        draft: { version: 1, pages: [], modules: [], connections: [], themePresets: [], templates: [], hiddenSystemModules: [] },
        published: { version: 1, pages: [], modules: [], connections: [], themePresets: [], templates: [], hiddenSystemModules: [] },
        versions: [],
        auditLog: [],
      }),
      'utf-8'
    );

    const exporter = new ProjectExporter({
      rootDir: process.cwd(),
      tempDir: tmpOut,
      builderDataFilePath: storeFile,
    });

    try {
      // 1. Full project ZIP
      const fullJob = await exporter.runExportSync('full');
      expect(fullJob.status).toBe('ready');
      expect(fullJob.validation?.passed).toBe(true);
      expect(fullJob.validation?.canOpen).toBe(true);
      expect(fullJob.validation?.noCredentialsIncluded).toBe(true);
      expect(fullJob.sizeBytes).toBeGreaterThan(10_000);
      expect(fullJob.tempFilePath).toBeTruthy();

      const fullZip = await JSZip.loadAsync(fs.readFileSync(fullJob.tempFilePath!));
      const fullEntries = Object.keys(fullZip.files);
      expect(fullEntries).toContain('VectorIA-Studio/package.json');
      expect(fullEntries).toContain('VectorIA-Studio/.env.example');
      expect(fullEntries).toContain('VectorIA-Studio/README.md');
      expect(fullEntries).toContain('VectorIA-Studio/AGENTS.md');
      expect(fullEntries).toContain('VectorIA-Studio/ARCHITECTURE.md');
      expect(fullEntries).toContain('VectorIA-Studio/server.ts');
      expect(fullEntries).toContain('VectorIA-Studio/src/App.tsx');
      expect(fullEntries.some((e) => e.includes('node_modules/'))).toBe(false);
      expect(fullEntries.some((e) => e.includes('/.git/'))).toBe(false);
      expect(fullEntries.some((e) => path.posix.basename(e) === '.env')).toBe(false);

      // 2. Distribution ZIP
      const distJob = await exporter.runExportSync('distribution');
      expect(distJob.status).toBe('ready');
      expect(distJob.validation?.passed).toBe(true);
      const distZip = await JSZip.loadAsync(fs.readFileSync(distJob.tempFilePath!));
      const distEntries = Object.keys(distZip.files);
      expect(distEntries).toContain('VectorIA-Studio/server.ts');
      expect(distEntries).toContain('VectorIA-Studio/package.json');
      expect(distEntries).toContain('VectorIA-Studio/RESTORE_GUIDE.md');
      expect(distEntries.some((e) => e.startsWith('VectorIA-Studio/tests/'))).toBe(false);

      // 3. Backup ZIP (must sanitize builder hashes & signingSecret)
      const backupJob = await exporter.runExportSync('backup');
      expect(backupJob.status).toBe('ready');
      expect(backupJob.validation?.passed).toBe(true);
      const backupZip = await JSZip.loadAsync(fs.readFileSync(backupJob.tempFilePath!));
      const sanitizedBuilderRaw = await backupZip
        .file('VectorIA-Studio/data/vectoria-builder.sanitized.json')
        ?.async('string');
      expect(sanitizedBuilderRaw).toBeTruthy();
      expect(sanitizedBuilderRaw).not.toContain('deadbeef00112233');
      expect(sanitizedBuilderRaw).not.toContain('0123456789abcdef0123456789abcdef');

      // 4. Verify extraction into a clean directory does not overwrite current workspace
      const restoreDir = path.join(tmpOut, 'clean-restore');
      fs.mkdirSync(restoreDir, { recursive: true });
      for (const rel of [
        'VectorIA-Studio/package.json',
        'VectorIA-Studio/.env.example',
        'VectorIA-Studio/server.ts',
      ]) {
        const content = await fullZip.file(rel)!.async('nodebuffer');
        const outPath = path.join(restoreDir, rel);
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, content);
      }
      expect(fs.existsSync(path.join(restoreDir, 'VectorIA-Studio', 'package.json'))).toBe(true);
      expect(fs.existsSync(path.join(restoreDir, 'VectorIA-Studio', '.env.example'))).toBe(true);
    } finally {
      exporter.disposeAll();
      fs.rmSync(tmpOut, { recursive: true, force: true });
    }
  }, 20000);

  it('blocks export when a real secret is present in a synthetic project directory', async () => {
    const fakeProj = fs.mkdtempSync(path.join(os.tmpdir(), 'vectoria-zip-leak-'));
    const tempOut = path.join(fakeProj, '_out');
    fs.mkdirSync(tempOut, { recursive: true });
    try {
      fs.mkdirSync(path.join(fakeProj, 'src'), { recursive: true });
      fs.writeFileSync(path.join(fakeProj, 'package.json'), '{"name":"test"}');
      fs.writeFileSync(path.join(fakeProj, '.env.example'), 'GEMINI_API_KEY="MY_GEMINI_API_KEY"\n');
      fs.writeFileSync(path.join(fakeProj, 'README.md'), '# Test');
      fs.writeFileSync(path.join(fakeProj, 'tsconfig.json'), '{}');
      fs.writeFileSync(path.join(fakeProj, 'vite.config.ts'), 'export default {};');
      fs.writeFileSync(path.join(fakeProj, 'index.html'), '<html></html>');
      fs.writeFileSync(path.join(fakeProj, 'server.ts'), 'console.log(1);');
      fs.writeFileSync(path.join(fakeProj, 'AGENTS.md'), '# A');
      fs.writeFileSync(path.join(fakeProj, 'PRD.md'), '# P');
      fs.writeFileSync(path.join(fakeProj, 'DESIGN.md'), '# D');
      fs.writeFileSync(path.join(fakeProj, 'BITACORA.md'), '# B');
      fs.writeFileSync(path.join(fakeProj, 'ARCHITECTURE.md'), '# AR');
      fs.writeFileSync(path.join(fakeProj, 'ROADMAP.md'), '# R');
      // Real-looking leaked credential in temporary synthetic project
      const fakeLeak = 'AIzaSyAbCdEfGhIjKl' + 'MnOpQrStUvWxYz123456789';
      fs.writeFileSync(
        path.join(fakeProj, 'src', 'App.tsx'),
        `export const LEAK = "${fakeLeak}";`
      );

      const exporter = new ProjectExporter({ rootDir: fakeProj, tempDir: tempOut });
      const failedJob = await exporter.runExportSync('full');
      expect(failedJob.status).toBe('error');
      expect(failedJob.error).toContain('Exportación bloqueada por seguridad');
      expect(failedJob.tempFilePath).toBeNull();
    } finally {
      fs.rmSync(fakeProj, { recursive: true, force: true });
    }
  });

  it('enforces admin RBAC and streams a valid downloadable ZIP over HTTP endpoints', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vectoria-zip-http-'));
    const storeFile = path.join(tmpDir, 'builder.json');
    const setupToken = 'TestZipSetupToken#2026';
    const app = createApp({ builderStoragePath: storeFile, exportTempDir: tmpDir, setupToken });
    const server = app.listen(0);
    const port = (server.address() as { port: number }).port;
    const base = `http://127.0.0.1:${port}`;

    try {
      // Unauthenticated request rejected
      const unauth = await fetch(`${base}/api/builder/export-zip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'full' }),
      });
      expect(unauth.status).toBe(401);

      // Setup admin + editor credentials
      const setupRes = await fetch(`${base}/api/builder/auth/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminPasscode: 'AdminZipPass#2026',
          editorPasscode: 'EditorZipPass#2026',
          setupToken,
        }),
      });
      expect(setupRes.status).toBe(201);
      const adminAuth = (await setupRes.json()) as { token: string };

      const editorRes = await fetch(`${base}/api/builder/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: 'EditorZipPass#2026', role: 'editor' }),
      });
      const editorAuth = (await editorRes.json()) as { token: string };

      // Editor role forbidden from full project ZIP export
      const forbidden = await fetch(`${base}/api/builder/export-zip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${editorAuth.token}`,
        },
        body: JSON.stringify({ mode: 'full' }),
      });
      expect(forbidden.status).toBe(403);

      // Admin starts async ZIP export
      const startRes = await fetch(`${base}/api/builder/export-zip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAuth.token}`,
        },
        body: JSON.stringify({ mode: 'distribution' }),
      });
      expect(startRes.status).toBe(202);
      const started = (await startRes.json()) as { jobId: string };

      let statusData: { status: string; validation?: { passed: boolean; sha256?: string | null } } | null = null;
      for (let i = 0; i < 40; i += 1) {
        const stRes = await fetch(
          `${base}/api/builder/export-zip/${encodeURIComponent(started.jobId)}/status`,
          { headers: { Authorization: `Bearer ${adminAuth.token}` } }
        );
        statusData = (await stRes.json()) as {
          status: string;
          validation?: { passed: boolean; sha256?: string | null };
        };
        if (statusData.status === 'ready' || statusData.status === 'error') break;
        await new Promise((r) => setTimeout(r, 100));
      }
      expect(statusData?.status).toBe('ready');
      expect(statusData?.validation?.passed).toBe(true);
      expect(statusData?.validation?.sha256).toMatch(/^[a-f0-9]{64}$/);

      // Download ZIP stream and verify SHA-256 + readability
      const dlRes = await fetch(
        `${base}/api/builder/export-zip/${encodeURIComponent(started.jobId)}/download`,
        { headers: { Authorization: `Bearer ${adminAuth.token}` } }
      );
      expect(dlRes.status).toBe(200);
      expect(dlRes.headers.get('content-type')).toContain('application/zip');
      const dlBuf = Buffer.from(await dlRes.arrayBuffer());
      const actualSha = crypto.createHash('sha256').update(dlBuf).digest('hex');
      expect(dlRes.headers.get('x-export-sha256')).toBe(actualSha);
      expect(statusData?.validation?.sha256).toBe(actualSha);

      const zip = await JSZip.loadAsync(dlBuf);
      expect(Object.keys(zip.files)).toContain('VectorIA-Studio/package.json');

      // Verify explicit protected DELETE cleanup removes temporary ZIP file immediately
      const delRes = await fetch(
        `${base}/api/builder/export-zip/${encodeURIComponent(started.jobId)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${adminAuth.token}` },
        }
      );
      expect(delRes.status).toBe(200);
      expect(fs.readdirSync(tmpDir).filter((f) => f.endsWith('.zip'))).toEqual([]);

      const afterCleanup = await fetch(
        `${base}/api/builder/export-zip/${encodeURIComponent(started.jobId)}/download`,
        { headers: { Authorization: `Bearer ${adminAuth.token}` } }
      );
      expect(afterCleanup.status).toBe(404);
    } finally {
      server.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }, 20000);
});

describe('VectorIA Client ZIP Export Service & Dashboard Metrics', () => {
  it('filters sensitive directories/files and produces verified JSZip archives across modalities', async () => {
    expect(isSensitiveExportPath('node_modules/lodash/index.js', 'full')).toBe(true);
    expect(isSensitiveExportPath('.git/config', 'full')).toBe(true);
    expect(isSensitiveExportPath('.env', 'full')).toBe(true);
    expect(isSensitiveExportPath('.env.local', 'full')).toBe(true);
    expect(isSensitiveExportPath('certs/server.pem', 'full')).toBe(true);
    expect(isSensitiveExportPath('.env.example', 'full')).toBe(false);
    expect(isSensitiveExportPath('src/App.tsx', 'full')).toBe(false);
    expect(isSensitiveExportPath('src/engines/neuralEngine.ts', 'distribution')).toBe(false);

    const progressStages: string[] = [];
    const archive = await compressDirectoryMapWithJSZip(
      {
        'package.json': '{"name":"vectoria-studio"}',
        '.env.example': 'GEMINI_API_KEY="MY_GEMINI_API_KEY"\n',
        'README.md': '# VectorIA Studio',
        'src/App.tsx': 'export const App = () => null;',
        'node_modules/fake/index.js': 'module.exports = 1;',
        '.git/HEAD': 'ref: refs/heads/main',
        '.env': 'GEMINI_API_KEY=real_leak_should_be_ignored',
        'src/secret.ts': `const leak = "${'AIzaSyAbCdEfGhIjKl' + 'MnOpQrStUvWxYz123456789'}";`,
      },
      {
        mode: 'full',
        onProgress: (p) => progressStages.push(p.stage),
      }
    );

    expect(archive.validation.passed).toBe(false);
    expect(archive.validation.credentialFindings.length).toBeGreaterThan(0);
    expect(archive.excludedPaths).toContain('node_modules/fake/index.js');
    expect(archive.excludedPaths).toContain('.git/HEAD');
    expect(archive.excludedPaths).toContain('.env');

    // Clean map without secret inside src passes end-to-end validation
    const cleanArchive = await compressDirectoryMapWithJSZip(
      {
        'package.json': '{"name":"vectoria-studio"}',
        '.env.example': 'GEMINI_API_KEY="MY_GEMINI_API_KEY"\n',
        'README.md': '# VectorIA Studio',
        'src/App.tsx': 'export const App = () => null;',
        'node_modules/fake/index.js': 'module.exports = 1;',
        '.git/HEAD': 'ref: refs/heads/main',
        '.env': 'SECRET=123',
      },
      {
        mode: 'backup',
        onProgress: (p) => progressStages.push(p.stage),
      }
    );

    expect(cleanArchive.validation.passed).toBe(true);
    expect(cleanArchive.validation.canOpen).toBe(true);
    expect(cleanArchive.validation.structureValid).toBe(true);
    expect(cleanArchive.validation.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(progressStages).toContain('preparing');
    expect(progressStages).toContain('compressing');
    expect(progressStages).toContain('validating');
    expect(progressStages).toContain('ready');

    const loaded = await JSZip.loadAsync(cleanArchive.bytes);
    const paths = Object.keys(loaded.files);
    expect(paths).toContain('VectorIA-Studio/package.json');
    expect(paths).toContain('VectorIA-Studio/.env.example');
    expect(paths).not.toContain('VectorIA-Studio/.env');
    expect(paths.some((p) => p.includes('node_modules'))).toBe(false);
    expect(paths.some((p) => p.includes('.git'))).toBe(false);
  });

  it('compressProjectDirectoryOnNode walks a temp workspace excluding secrets and node_modules', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vectoria-zip-svc-'));
    try {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"temp-app"}');
      fs.writeFileSync(path.join(tmpDir, '.env.example'), 'GEMINI_API_KEY="MY_GEMINI_API_KEY"\n');
      fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Temp');
      fs.writeFileSync(path.join(tmpDir, '.env'), 'GEMINI_API_KEY=real_value_ignored');
      fs.mkdirSync(path.join(tmpDir, 'node_modules/pkg'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'node_modules/pkg/a.js'), 'x');
      fs.mkdirSync(path.join(tmpDir, 'src/engines'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'src/engines/linear.ts'), 'export const det = 1;');

      const res = await compressProjectDirectoryOnNode(tmpDir, 'full');
      expect(res.validation.passed).toBe(true);
      const zip = await JSZip.loadAsync(res.bytes);
      const names = Object.keys(zip.files);
      expect(names).toContain('VectorIA-Studio/src/engines/linear.ts');
      expect(names).not.toContain('VectorIA-Studio/.env');
      expect(names.some((n) => n.includes('node_modules'))).toBe(false);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('computes honest real-time laboratory summaries with zero fabricated values', () => {
    const suite = createInitialNeuralSuite();
    const digitsSummary = suite.digitsModel.getSummary();
    const lettersSummary = suite.lettersModel.getSummary();
    const alphanumericSummary = suite.alphanumericModel.getSummary();

    // Empty session baseline
    const emptyStats = computeLaboratorySummaries({
      digitsSummary,
      lettersSummary,
      alphanumericSummary,
      mnist784Exactitud: 0.92,
      mnist784Params: 101770,
      mnist784Result: null,
      mnist784PerturbResult: null,
      predictionHistory: [],
      simulationHistory: [],
      lastMathOutput: null,
      last232Step: null,
      systemEvents: [
        {
          id: 'e1',
          timestamp: '2026-01-01T00:00:00Z',
          category: 'system',
          title: 'Init',
          detail: 'Ready',
          status: 'ok',
        },
      ],
      reportCount: 0,
      omniMessageCount: 2,
    });

    expect(emptyStats.neural.inferenceCount).toBe(0);
    expect(emptyStats.neural.meanConfidencePct).toBeNull();
    expect(emptyStats.neural.trainedModelsCount).toBe(4); // digits + letters + alphanumeric + mnist784
    expect(emptyStats.simulation.totalRuns).toBe(0);
    expect(emptyStats.simulation.meanDurationMs).toBeNull();
    expect(emptyStats.algebraSystem.lastOperation).toBeNull();
    expect(emptyStats.algebraSystem.okEvents).toBe(1);

    // Populated session stats check exact arithmetic
    const pred1 = suite.digitsModel.predictScores(rasterizeGlyph('4'));
    const pred2 = suite.digitsModel.predictScores(rasterizeGlyph('7'));
    const mathOut = matrixMultiply(
      [
        [1, 2],
        [3, 4],
      ],
      [
        [2, 0],
        [1, 2],
      ]
    );

    const liveStats = computeLaboratorySummaries({
      digitsSummary,
      lettersSummary,
      alphanumericSummary,
      mnist784Exactitud: 0.92,
      mnist784Params: 101770,
      mnist784Result: null,
      mnist784PerturbResult: null,
      predictionHistory: [
        {
          id: 'p1',
          timestamp: '2026-01-01T00:00:01Z',
          mode: 'digits',
          topLabel: pred1.topLabel,
          confidence: pred1.confidence,
          entropy: pred1.entropy,
          topScores: pred1.topScores,
          allScores: pred1.allScores,
          inputGrid: rasterizeGlyph('4'),
          layerSnapshots: pred1.snapshots,
        },
        {
          id: 'p2',
          timestamp: '2026-01-01T00:00:02Z',
          mode: 'digits',
          topLabel: pred2.topLabel,
          confidence: pred2.confidence,
          entropy: pred2.entropy,
          topScores: pred2.topScores,
          allScores: pred2.allScores,
          inputGrid: rasterizeGlyph('7'),
          layerSnapshots: pred2.snapshots,
        },
      ],
      simulationHistory: [
        {
          id: 's1',
          timestamp: '2026-01-01T00:00:03Z',
          kind: 'batch-robustness',
          title: 'Lote ruido 0.25',
          summary: 'Evaluación',
          durationMs: 24,
          config: {
            mode: 'digits',
            targetGlyph: '4',
            shiftX: 0,
            shiftY: 0,
            noiseLevel: 0.25,
            perturbationIntensity: 0,
            learningRate: 0.05,
            epochs: 0,
            seed: 42,
            selectedClasses: ['4'],
          },
          metrics: { 'Caída (pp)': 8.4 },
        },
      ],
      lastMathOutput: mathOut,
      last232Step: null,
      systemEvents: [
        {
          id: 'e1',
          timestamp: '2026-01-01T00:00:00Z',
          category: 'system',
          title: 'Init',
          detail: 'Ready',
          status: 'ok',
        },
        {
          id: 'e2',
          timestamp: '2026-01-01T00:00:01Z',
          category: 'math',
          title: 'Warn',
          detail: 'Check',
          status: 'warn',
        },
      ],
      reportCount: 3,
      omniMessageCount: 5,
    });

    const expectedMeanConf = ((pred1.confidence + pred2.confidence) / 2) * 100;
    expect(liveStats.neural.inferenceCount).toBe(2);
    expect(liveStats.neural.modeCounts.digits).toBe(2);
    expect(liveStats.neural.meanConfidencePct).toBeCloseTo(expectedMeanConf, 6);
    expect(liveStats.simulation.totalRuns).toBe(1);
    expect(liveStats.simulation.byKind['batch-robustness']).toBe(1);
    expect(liveStats.simulation.meanPerturbedConfidenceDropPp).toBeCloseTo(8.4, 6);
    expect(liveStats.algebraSystem.lastOperation).toBe(mathOut.operation);
    expect(liveStats.algebraSystem.lastVerificationPassed).toBe(true);
    expect(liveStats.algebraSystem.warnEvents).toBe(1);
    expect(liveStats.algebraSystem.reportCount).toBe(3);
  }, 15000);
});

describe('Batch 2 Features: Omni Bot Command History & PDF Lab Report Export', () => {
  it('caps Omni Bot command history at 10 unique MRU entries and persists cleanly', () => {
    expect(MAX_OMNI_COMMAND_HISTORY).toBe(10);

    let history = recordOmniCommand([], '   \n\t  ');
    expect(history.length).toBe(0);

    for (let i = 1; i <= 12; i += 1) {
      history = recordOmniCommand(history, `det([[${i},0],[0,1]])`, MAX_OMNI_COMMAND_HISTORY, `2026-01-01T00:00:${String(i).padStart(2, '0')}Z`);
    }

    expect(history.length).toBe(10);
    expect(history[0].query).toBe('det([[12,0],[0,1]])');
    expect(history[9].query).toBe('det([[3,0],[0,1]])');

    // Re-running an older command moves it to index 0 without creating duplicates
    history = recordOmniCommand(history, 'det([[5,0],[0,1]])');
    expect(history.length).toBe(10);
    expect(history[0].query).toBe('det([[5,0],[0,1]])');
    expect(history.filter((e) => e.query === 'det([[5,0],[0,1]])').length).toBe(1);

    const store = new Map<string, string>();
    const mockStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    };

    saveOmniCommandHistory(history, mockStorage);
    const reloaded = loadOmniCommandHistory(mockStorage);
    expect(reloaded.length).toBe(10);
    expect(reloaded[0].query).toBe('det([[5,0],[0,1]])');

    clearOmniCommandHistoryStorage(mockStorage);
    expect(loadOmniCommandHistory(mockStorage)).toEqual([]);
  });

  it('extracts rendered DOM content summary and generates a valid PDF Blob via jsPDF', async () => {
    expect(LAB_ANALYSIS_MODULE_IDS.has('simulation-lab')).toBe(true);
    expect(LAB_ANALYSIS_MODULE_IDS.has('evaluation')).toBe(true);
    expect(LAB_ANALYSIS_MODULE_IDS.has('xai')).toBe(true);

    const fakeTable = {
      querySelectorAll: (selector: string) => {
        if (selector === 'thead th') {
          return [{ textContent: 'Clase' }, { textContent: 'F1-Score' }];
        }
        if (selector === 'tbody tr') {
          return [
            {
              querySelectorAll: () => [{ textContent: '3' }, { textContent: '0.942' }],
            },
          ];
        }
        return [];
      },
    };

    const mockMainElement = {
      querySelectorAll: (selector: string) => {
        if (selector === 'h1, h2, h3') {
          return [
            { textContent: 'Evaluación del Modelo Alfanumérico' },
            { textContent: 'Matriz de Confusión' },
          ];
        }
        if (selector === 'p') {
          return [{ textContent: 'Resultados medidos sobre conjunto de validación sin alterar pesos.' }];
        }
        if (selector === 'table') {
          return [fakeTable];
        }
        return [];
      },
    } as unknown as HTMLElement;

    const extracted = extractPrintableMainSummary(mockMainElement);
    expect(extracted.headings).toEqual([
      'Evaluación del Modelo Alfanumérico',
      'Matriz de Confusión',
    ]);
    expect(extracted.paragraphs[0]).toContain('Resultados medidos');
    expect(extracted.tables[0].headers).toEqual(['Clase', 'F1-Score']);
    expect(extracted.tables[0].rows[0]).toEqual(['3', '0.942']);

    const pdfResult = await exportMainAreaToPdf({
      element: mockMainElement,
      moduleId: 'evaluation',
      moduleTitle: 'Evaluación del Modelo',
      authorName: 'Investigador',
      program: 'VectorIA Studio',
      autoDownload: false,
    });

    expect(pdfResult.filename).toMatch(/^vectoria_analisis_evaluation_.*\.pdf$/);
    expect(pdfResult.pageCount).toBeGreaterThanOrEqual(1);
    expect(pdfResult.sizeBytes).toBeGreaterThan(500);
    const bytes = new Uint8Array(await pdfResult.blob.arrayBuffer());
    const header = new TextDecoder().decode(bytes.slice(0, 5));
    expect(header).toBe('%PDF-');
  });

  it('builds chronological simulation performance series and measures memory telemetry honestly', () => {
    const baseCfg = {
      mode: 'digits' as const,
      targetGlyph: '3',
      shiftX: 1,
      shiftY: 0,
      noiseLevel: 0.15,
      perturbationIntensity: 0.1,
      learningRate: 0.04,
      epochs: 2,
      seed: 2026,
      selectedClasses: ['0', '3'],
    };

    const memSnap = measureRuntimeMemorySnapshot({
      kind: 'before-after',
      config: baseCfg,
      metrics: {},
    });
    expect(memSnap.memoryMb).toBeGreaterThan(0);
    expect(['js-heap', 'node-heap', 'tensor-footprint']).toContain(memSnap.source);

    // StudioContext stores newest run at index 0
    const historyDesc: SimulationRunRecord[] = [
      {
        id: 'sim-2',
        timestamp: '2026-11-17T20:02:00Z',
        kind: 'batch-robustness' as const,
        title: 'Lote robusto',
        summary: 'Eval lote',
        durationMs: 28.5,
        memoryMb: 44.2,
        memorySource: 'js-heap' as const,
        config: baseCfg,
        metrics: { muestras: 60 },
      },
      {
        id: 'sim-1',
        timestamp: '2026-11-17T20:01:00Z',
        kind: 'before-after' as const,
        title: 'Antes/Después · 3',
        summary: 'Eval individual',
        durationMs: 11.5,
        config: baseCfg,
        metrics: {},
      },
    ];

    const allSeries = buildSimulationPerformanceSeries(historyDesc, 'all', 30);
    expect(allSeries.length).toBe(2);
    // Chronological ascending order
    expect(allSeries[0].id).toBe('sim-1');
    expect(allSeries[1].id).toBe('sim-2');
    expect(allSeries[0].memoryMb).toBeGreaterThan(0);
    expect(allSeries[1].memoryMb).toBe(44.2);

    const stats = computeSimulationPerformanceStats(allSeries);
    expect(stats.runCount).toBe(2);
    expect(stats.avgDurationMs).toBeCloseTo(20, 4);
    expect(stats.maxDurationMs).toBeCloseTo(28.5, 4);
    expect(stats.latestMemoryMb).toBeCloseTo(44.2, 2);

    const filteredBatch = buildSimulationPerformanceSeries(historyDesc, 'batch-robustness', 30);
    expect(filteredBatch.length).toBe(1);
    expect(filteredBatch[0].kindLabel).toBe('Lote Robustez');

    const emptyStats = computeSimulationPerformanceStats([]);
    expect(emptyStats.runCount).toBe(0);
    expect(emptyStats.dominantSourceLabel).toBe('Sin mediciones');
  });
});

describe('Automatic Scheduled Backups (Cloud Vault Scheduler + Local Schedule Persistence)', () => {
  it('runs BackupScheduler ticks when due, enforces retention limits, and blocks invalid snapshot IDs', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vectoria-sched-unit-'));
    const vaultDir = path.join(tmpDir, 'vault');
    const schedFile = path.join(tmpDir, 'backup-schedule.json');
    const exporter = new ProjectExporter({ rootDir: process.cwd(), tempDir: tmpDir });
    const scheduler = new BackupScheduler({
      exporter,
      vaultDir,
      scheduleFilePath: schedFile,
      startTimer: false,
    });

    try {
      const updated = scheduler.updateSchedule({
        enabled: true,
        frequency: '15m',
        mode: 'backup',
        retentionCount: 2,
      });
      expect(updated.enabled).toBe(true);
      expect(updated.frequency).toBe('15m');
      expect(updated.nextRunAt).toBeTruthy();
      expect(fs.existsSync(schedFile)).toBe(true);

      // Not due yet right now
      const notDue = await scheduler.tickIfDue(Date.now());
      expect(notDue).toBeNull();

      // Advance clock past 15m -> generates real verified ZIP in vaultDir
      const futureMs = Date.now() + 16 * 60 * 1000;
      const snap1 = await scheduler.tickIfDue(futureMs);
      expect(snap1).toBeTruthy();
      expect(snap1?.trigger).toBe('scheduled');
      expect(snap1?.status).toBe('verified');

      // Run 2 more times -> retentionCount = 2 must prune oldest zip
      await scheduler.runNow('manual');
      await scheduler.runNow('manual');
      const state = scheduler.getState();
      expect(state.snapshots.length).toBe(2);
      const diskZips = fs.readdirSync(vaultDir).filter((f) => f.endsWith('.zip'));
      expect(diskZips.length).toBe(2);

      // Traversal / invalid IDs rejected
      expect(scheduler.getSnapshotForDownload('../secret.zip')).toBeNull();
      expect(scheduler.getSnapshotForDownload('bad-id')).toBeNull();

      const validDl = scheduler.getSnapshotForDownload(state.snapshots[0].id);
      expect(validDl).toBeTruthy();
      const loadedZip = await JSZip.loadAsync(fs.readFileSync(validDl!.filePath));
      expect(Object.keys(loadedZip.files)).toContain('VectorIA-Studio/package.json');
    } finally {
      scheduler.stop();
      exporter.disposeAll();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }, 20000);

  it('enforces admin RBAC on /api/backup/* routes and allows scheduling, running, downloading, and deleting cloud snapshots', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vectoria-sched-http-'));
    const storeFile = path.join(tmpDir, 'builder.json');
    const vaultDir = path.join(tmpDir, 'vault');
    const schedFile = path.join(tmpDir, 'backup-schedule.json');
    const setupToken = 'TestSchedSetupToken#2026';
    const app = createApp({
      builderStoragePath: storeFile,
      exportTempDir: tmpDir,
      backupVaultDir: vaultDir,
      backupScheduleFilePath: schedFile,
      startBackupTimer: false,
      setupToken,
    });
    const server = app.listen(0);
    const port = (server.address() as { port: number }).port;
    const base = `http://127.0.0.1:${port}`;

    try {
      // Unauthenticated -> 401
      const unauth = await fetch(`${base}/api/backup/schedule`);
      expect(unauth.status).toBe(401);

      // Setup Admin & Editor
      const setupRes = await fetch(`${base}/api/builder/auth/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminPasscode: 'AdminBackup#2026',
          editorPasscode: 'EditorBackup#2026',
          setupToken,
        }),
      });
      expect(setupRes.status).toBe(201);
      const adminAuth = (await setupRes.json()) as { token: string };

      const editorLogin = await fetch(`${base}/api/builder/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: 'EditorBackup#2026', role: 'editor' }),
      });
      const editorAuth = (await editorLogin.json()) as { token: string };

      // Editor forbidden -> 403
      const forbidden = await fetch(`${base}/api/backup/schedule`, {
        headers: { Authorization: `Bearer ${editorAuth.token}` },
      });
      expect(forbidden.status).toBe(403);

      // Invalid frequency -> 400
      const badFreq = await fetch(`${base}/api/backup/schedule`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAuth.token}`,
        },
        body: JSON.stringify({ enabled: true, frequency: '99y', mode: 'backup' }),
      });
      expect(badFreq.status).toBe(400);

      // Admin updates schedule
      const putRes = await fetch(`${base}/api/backup/schedule`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAuth.token}`,
        },
        body: JSON.stringify({
          enabled: true,
          frequency: '6h',
          mode: 'distribution',
          retentionCount: 4,
        }),
      });
      expect(putRes.status).toBe(200);
      const putData = (await putRes.json()) as {
        schedule: { enabled: boolean; frequency: string; mode: string; retentionCount: number };
      };
      expect(putData.schedule.enabled).toBe(true);
      expect(putData.schedule.frequency).toBe('6h');
      expect(putData.schedule.mode).toBe('distribution');
      expect(putData.schedule.retentionCount).toBe(4);

      // Admin runs manual cloud backup
      const runRes = await fetch(`${base}/api/backup/run`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminAuth.token}` },
      });
      expect(runRes.status).toBe(201);
      const runData = (await runRes.json()) as {
        snapshot: { id: string; filename: string; sha256: string };
      };
      expect(runData.snapshot.id).toMatch(/^cloud-bkp-\d+-[a-f0-9]{8}$/);

      // Admin downloads snapshot ZIP and checks SHA-256
      const dlRes = await fetch(
        `${base}/api/backup/snapshots/${encodeURIComponent(runData.snapshot.id)}/download`,
        { headers: { Authorization: `Bearer ${adminAuth.token}` } }
      );
      expect(dlRes.status).toBe(200);
      const dlBuf = Buffer.from(await dlRes.arrayBuffer());
      const actualSha = crypto.createHash('sha256').update(dlBuf).digest('hex');
      expect(actualSha).toBe(runData.snapshot.sha256);

      // Admin deletes snapshot
      const delRes = await fetch(
        `${base}/api/backup/snapshots/${encodeURIComponent(runData.snapshot.id)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${adminAuth.token}` },
        }
      );
      expect(delRes.status).toBe(200);

      const missingAfterDel = await fetch(
        `${base}/api/backup/snapshots/${encodeURIComponent(runData.snapshot.id)}/download`,
        { headers: { Authorization: `Bearer ${adminAuth.token}` } }
      );
      expect(missingAfterDel.status).toBe(404);
    } finally {
      server.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }, 20000);

  it('persists client local backup schedule, checks due windows, and bounds rotating execution history', () => {
    const store = new Map<string, string>();
    const mockStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
    };

    const baseNow = Date.parse('2026-11-17T20:00:00Z');
    const nextIso = computeNextBackupRunIso('1h', baseNow);
    expect(nextIso).toBe('2026-11-17T21:00:00.000Z');

    let cfg = createDefaultLocalBackupSchedule();
    cfg = { ...cfg, enabled: true, frequency: '1h', retentionCount: 3, nextRunAt: nextIso };
    expect(isBackupDue(cfg, baseNow + 30 * 60 * 1000)).toBe(false);
    expect(isBackupDue(cfg, baseNow + 60 * 60 * 1000)).toBe(true);
    expect(formatTimeUntilIso(nextIso, baseNow + 15 * 60 * 1000)).toBe('en 45 min');

    for (let i = 1; i <= 5; i++) {
      cfg = appendLocalBackupHistory(cfg, {
        id: `loc-${i}`,
        timestamp: `2026-11-17T20:0${i}:00Z`,
        trigger: 'scheduled',
        format: 'json-secure',
        mode: 'backup',
        filename: `snap_${i}.json`,
        sizeBytes: 1024 * i,
        status: 'ok',
        detail: `Registro ${i}`,
      });
    }
    expect(cfg.history.length).toBe(3);
    expect(cfg.history[0].filename).toBe('snap_5.json');

    saveLocalBackupSchedule(cfg, mockStorage);
    expect(store.has(LOCAL_BACKUP_SCHEDULE_STORAGE_KEY)).toBe(true);
    const reloaded = loadLocalBackupSchedule(mockStorage);
    expect(reloaded.enabled).toBe(true);
    expect(reloaded.history.length).toBe(3);
    expect(reloaded.history[0].filename).toBe('snap_5.json');
  });

  it('defines coherent VectorIA Studio brand palettes across all 6 visual themes and public SVG icons', () => {
    const themeIds = [
      'dark-purple',
      'light-yellow',
      'classic-mono',
      'holographic',
      'black-gold',
      'neural-cyberpunk',
    ] as const;

    for (const id of themeIds) {
      const pal = THEME_LOGO_PALETTES[id];
      expect(pal).toBeDefined();
      expect(pal.primary).toBeTruthy();
      expect(pal.secondary).toBeTruthy();
      expect(pal.text).toBeTruthy();
      expect(resolveVectorIALogoPalette('auto', id)).toEqual(pal);
    }

    expect(resolveVectorIALogoPalette('light').bg).toBe('#ffffff');
    expect(resolveVectorIALogoPalette('dark').bg).toBe('#09090f');
    expect(resolveVectorIALogoPalette('mono').isMono).toBe(true);

    const favSvg = fs.readFileSync(path.join(process.cwd(), 'public', 'favicon.svg'), 'utf-8');
    expect(favSvg).toContain('M15 17L32 49L49 17');
    const appIconSvg = fs.readFileSync(path.join(process.cwd(), 'public', 'app-icon.svg'), 'utf-8');
    expect(appIconSvg).toContain('M30 34L64 98L98 34');

    // NeuralHeaderBackdrop renders exclusively for neural-cyberpunk theme
    expect(shouldRenderNeuralHeaderBackdrop('neural-cyberpunk')).toBe(true);
    expect(shouldRenderNeuralHeaderBackdrop('dark-purple')).toBe(false);
    expect(shouldRenderNeuralHeaderBackdrop('light-yellow')).toBe(false);
    expect(shouldRenderNeuralHeaderBackdrop('classic-mono')).toBe(false);
    expect(shouldRenderNeuralHeaderBackdrop('holographic')).toBe(false);
    expect(shouldRenderNeuralHeaderBackdrop('black-gold')).toBe(false);

    const css = fs.readFileSync(path.join(process.cwd(), 'src', 'index.css'), 'utf-8');
    expect(css).toContain('html[data-theme="neural-cyberpunk"] .neural-backdrop-edge-a');
    expect(css).toContain('@keyframes neuralBackdropDrift');
  });

  it('generates light and dark VectorIA favicon variants and updates document link/meta tags per active theme', () => {
    expect(isLightFaviconTheme('light-yellow')).toBe(true);
    expect(isLightFaviconTheme('classic-mono')).toBe(true);
    expect(isLightFaviconTheme('dark-purple')).toBe(false);
    expect(isLightFaviconTheme('holographic')).toBe(false);
    expect(isLightFaviconTheme('black-gold')).toBe(false);
    expect(isLightFaviconTheme('neural-cyberpunk')).toBe(false);

    const uris = new Set<string>();
    const allThemes = [
      'dark-purple',
      'light-yellow',
      'classic-mono',
      'holographic',
      'black-gold',
      'neural-cyberpunk',
    ] as const;

    for (const id of allThemes) {
      const svg = buildThemeFaviconSvg(id);
      const pal = THEME_LOGO_PALETTES[id];
      expect(svg).toContain('M15 17L32 49L49 17');
      expect(svg).toContain('M22 21L32 37L42 21');
      expect(svg).toContain(pal.primary);
      expect(svg).toContain(pal.bg);
      const uri = buildThemeFaviconDataUri(id);
      expect(uri.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
      uris.add(uri);
    }
    expect(uris.size).toBe(6);

    // Mock DOM document with existing <link rel="icon">
    const iconAttrs = new Map<string, string>();
    const iconEl = {
      rel: 'icon',
      type: 'image/svg+xml',
      href: '/favicon.svg',
      setAttribute: (k: string, v: string) => iconAttrs.set(k, v),
      getAttribute: (k: string) => iconAttrs.get(k) ?? null,
    };
    const metaEl = { name: 'theme-color', content: '' };
    const appended: unknown[] = [];
    const mockDoc = {
      head: {
        appendChild: (node: unknown) => appended.push(node),
      },
      querySelector: (selector: string) => {
        if (selector === 'link[rel="icon"]') return iconEl;
        if (selector === 'meta[name="theme-color"]') return metaEl;
        return null;
      },
      createElement: () => ({}),
    } as unknown as Document;

    const lightDesc = updateDocumentFavicon('light-yellow', mockDoc);
    expect(lightDesc?.variant).toBe('light');
    expect(iconEl.href).toBe(buildThemeFaviconDataUri('light-yellow'));
    expect(iconEl.getAttribute('data-theme')).toBe('light-yellow');
    expect(iconEl.getAttribute('data-variant')).toBe('light');
    expect(metaEl.content).toBe(THEME_LOGO_PALETTES['light-yellow'].bg);
    expect(appended.length).toBe(0);

    const cyberDesc = updateDocumentFavicon('neural-cyberpunk', mockDoc);
    expect(cyberDesc?.variant).toBe('dark');
    expect(iconEl.href).toBe(buildThemeFaviconDataUri('neural-cyberpunk'));
    expect(iconEl.getAttribute('data-theme')).toBe('neural-cyberpunk');
    expect(iconEl.getAttribute('data-variant')).toBe('dark');
    expect(metaEl.content).toBe(THEME_LOGO_PALETTES['neural-cyberpunk'].bg);

    const appSource = fs.readFileSync(path.join(process.cwd(), 'src', 'App.tsx'), 'utf-8');
    expect(appSource).toContain('DynamicFaviconSync');
    expect(appSource).toContain('updateDocumentFavicon(theme)');
  });

  it('maintains official development team members in strict 01-03 order and supports safe editable configuration', () => {
    expect(OFFICIAL_TEAM_NAMES).toEqual([
      'Moisés de Hoyos',
      'Isaías Alvarado',
      'Rivaldo Calvo',
    ]);
    expect(OFFICIAL_TEAM_MEMBERS).toBe(OFFICIAL_DEVELOPMENT_TEAM);
    expect(DEVELOPMENT_TEAM_METADATA.sectionTitle).toBe('Equipo de desarrollo');
    expect(OFFICIAL_DEVELOPMENT_TEAM.length).toBe(3);
    expect(OFFICIAL_DEVELOPMENT_TEAM[0]).toEqual({
      id: 'member-01',
      orderNumber: '01',
      name: 'Moisés de Hoyos',
    });
    expect(OFFICIAL_DEVELOPMENT_TEAM[1]).toEqual({
      id: 'member-02',
      orderNumber: '02',
      name: 'Isaías Alvarado',
    });
    expect(OFFICIAL_DEVELOPMENT_TEAM[2]).toEqual({
      id: 'member-03',
      orderNumber: '03',
      name: 'Rivaldo Calvo',
    });
    expect(OFFICIAL_DEVELOPMENT_TEAM.every((m) => m.role === undefined)).toBe(true);

    const store = new Map<string, string>();
    const mockStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    };

    const initial = loadDevelopmentTeam(mockStorage);
    expect(initial.map((m) => `${m.orderNumber}:${m.name}`)).toEqual([
      '01:Moisés de Hoyos',
      '02:Isaías Alvarado',
      '03:Rivaldo Calvo',
    ]);

    const updated = saveDevelopmentTeam(
      [
        { name: 'Moisés de Hoyos', role: 'Arquitectura' },
        { name: '<script>Isaías Alvarado</script>' },
        { name: 'Rivaldo Calvo' },
      ],
      mockStorage
    );
    expect(store.has(DEVELOPMENT_TEAM_STORAGE_KEY)).toBe(true);
    expect(updated[0].role).toBe('Arquitectura');
    expect(updated[1].name).not.toContain('<script>');

    const reloaded = loadDevelopmentTeam(mockStorage);
    expect(reloaded[0].name).toBe('Moisés de Hoyos');
    expect(reloaded[0].role).toBe('Arquitectura');

    const restored = resetDevelopmentTeam(mockStorage);
    expect(store.has(DEVELOPMENT_TEAM_STORAGE_KEY)).toBe(false);
    expect(restored.map((m) => m.name)).toEqual([
      'Moisés de Hoyos',
      'Isaías Alvarado',
      'Rivaldo Calvo',
    ]);
    expect(restored.every((m) => m.role === undefined)).toBe(true);

    const creditsSource = fs.readFileSync(
      path.join(process.cwd(), 'src', 'components', 'TeamCredits.tsx'),
      'utf-8'
    );
    expect(creditsSource).toContain("from '../config/team'");
    expect(creditsSource).toContain('OFFICIAL_TEAM_MEMBERS');
    expect(creditsSource).toContain('var(--accent-primary)');
    expect(creditsSource).toContain('var(--text-primary)');

    const sectionSource = fs.readFileSync(
      path.join(process.cwd(), 'src', 'components', 'DevelopmentTeamSection.tsx'),
      'utf-8'
    );
    expect(sectionSource).toContain("from './TeamCredits'");
    expect(sectionSource).toContain('<TeamCredits');
  });

  it('indexes and ranks global search entries across laboratories, modules, and published custom pages', () => {
    expect(normalizeSearchQuery('  ÁLGEBRA   Lineal  ')).toBe('algebra lineal');

    const navMeta = [
      { id: 'dashboard' as const, label: 'Panel Principal', group: 'principal' as const },
      { id: 'linear-algebra' as const, label: 'Álgebra Lineal', group: 'laboratorios' as const },
      { id: 'xai' as const, label: 'IA Explicable (XAI)', group: 'laboratorios' as const },
      { id: 'classifier' as const, label: 'Clasificador Alfanumérico', group: 'laboratorios' as const },
      { id: 'account' as const, label: 'Configuración y Usuario', group: 'principal' as const },
      { id: 'sources' as const, label: 'Fuentes Académicas', group: 'analisis' as const },
    ];

    const customPages = [
      {
        id: 'custom-eigen',
        slug: 'observatorio-espectral',
        title: 'Observatorio Espectral',
        description: 'Página personalizada de análisis espectral y métricas reales',
        visible: true,
        showInSidebar: true,
        order: 1,
        isSystemPage: false,
        updatedAt: '2026-11-18T00:00:00Z',
        sections: [
          {
            id: 'sec-1',
            title: 'Descomposición Eigen',
            description: '',
            visible: true,
            columns: 1 as const,
            gapPx: 16,
            blocks: [],
          },
        ],
      },
      {
        id: 'custom-hidden',
        slug: 'borrador-oculto',
        title: 'Borrador Oculto',
        description: 'No debe indexarse si visible=false',
        visible: false,
        showInSidebar: false,
        order: 2,
        isSystemPage: false,
        updatedAt: '2026-11-18T00:00:00Z',
        sections: [],
      },
    ];

    const entries = buildGlobalSearchEntries(navMeta, ['sources'], customPages);
    expect(entries.some((e) => e.moduleId === 'sources')).toBe(false);
    expect(entries.some((e) => e.customPageId === 'custom-hidden')).toBe(false);
    expect(entries.some((e) => e.customPageId === 'custom-eigen')).toBe(true);

    // Accent-insensitive title search
    const algebraHits = filterGlobalSearchEntries(entries, 'algebra');
    expect(algebraHits[0]?.moduleId).toBe('linear-algebra');

    // Keyword search across labs
    const xaiHits = filterGlobalSearchEntries(entries, 'saliencia');
    expect(xaiHits[0]?.moduleId).toBe('xai');

    // Keyword search for custom page section/title
    const customHits = filterGlobalSearchEntries(entries, 'espectral');
    expect(customHits[0]?.kind).toBe('custom-page');
    expect(customHits[0]?.customPageId).toBe('custom-eigen');

    // Keyword search for team/backups in Account
    const teamHits = filterGlobalSearchEntries(entries, 'equipo');
    expect(teamHits[0]?.moduleId).toBe('account');

    // Unmatched query
    expect(filterGlobalSearchEntries(entries, 'zzzz-inexistente')).toEqual([]);

    const appSource = fs.readFileSync(path.join(process.cwd(), 'src', 'App.tsx'), 'utf-8');
    expect(appSource).toContain('<GlobalSearchBar');
  });

  it('builds real historical training progress series for Alphanumeric Classifier models without fabricating points', () => {
    const suite = createInitialNeuralSuite();
    const digitsSummary = suite.digitsModel.getSummary();
    const lettersSummary = suite.lettersModel.getSummary();
    const alphanumericSummary = suite.alphanumericModel.getSummary();
    const mnistHistory = getMnist784HistoricalReport().history;

    const input = {
      digitsSummary,
      lettersSummary,
      alphanumericSummary,
      mnistHistory,
    };

    const comparative = buildClassifierTrainingProgressSeries(input);
    expect(comparative.length).toBeGreaterThanOrEqual(mnistHistory.length);
    for (let i = 1; i < comparative.length; i++) {
      expect(comparative[i].epoch).toBeGreaterThan(comparative[i - 1].epoch);
    }

    // Check un-trained / empty history model is NOT fabricated
    const emptyAlphaSeries = buildClassifierTrainingProgressSeries({
      ...input,
      alphanumericSummary: { ...alphanumericSummary, history: [], isTrained: false },
    });
    expect(emptyAlphaSeries.every((pt) => pt.alphanumericValPct === undefined)).toBe(true);
    expect(emptyAlphaSeries.every((pt) => pt.alphanumericLoss === undefined)).toBe(true);

    // Check single-model series faithfully maps epoch data
    const digitsSingle = buildSingleClassifierEpochSeries('digits', input);
    expect(digitsSingle.length).toBe(digitsSummary.history.length);
    if (digitsSingle.length > 0) {
      expect(digitsSingle[0].valPct).toBeCloseTo(digitsSummary.history[0].valAccuracy * 100, 1);
      expect(digitsSingle[0].loss).toBeCloseTo(digitsSummary.history[0].loss, 4);
    }

    const mnistSingle = buildSingleClassifierEpochSeries('mnist784', input);
    expect(mnistSingle.length).toBe(mnistHistory.length);
    expect(mnistSingle[0].valPct).toBeUndefined();

    const stats = computeClassifierTrainingProgressStats(input);
    expect(stats.digitsEpochs).toBe(digitsSummary.history.length);
    expect(stats.lettersEpochs).toBe(lettersSummary.history.length);
    expect(stats.alphanumericEpochs).toBe(alphanumericSummary.history.length);
    expect(stats.mnistEpochs).toBe(mnistHistory.length);
    expect(stats.totalEpochsRecorded).toBe(
      digitsSummary.history.length +
        lettersSummary.history.length +
        alphanumericSummary.history.length +
        mnistHistory.length
    );

    const dashboardSource = fs.readFileSync(
      path.join(process.cwd(), 'src', 'components', 'DashboardView.tsx'),
      'utf-8'
    );
    expect(dashboardSource).toContain('<ClassifierTrainingProgressCard');
  }, 15000);

  it('resolves contextual Quick Commands for Omni Bot and generates honest technical reports without fabricating metrics', () => {
    const suite = createInitialNeuralSuite();
    const digitsSummary = suite.digitsModel.getSummary();
    const lettersSummary = suite.lettersModel.getSummary();
    const untrainedAlphaSummary = {
      ...suite.alphanumericModel.getSummary(),
      isTrained: false,
      epochsTrained: 0,
      history: [],
    };

    const cmdsUntrainedAlpha = resolveOmniQuickCommands({
      classifierMode: 'alphanumeric',
      digitsSummary,
      lettersSummary,
      alphanumericSummary: untrainedAlphaSummary,
      hasPrediction: false,
      predictionCount: 0,
      simulationCount: 0,
      reportCount: 0,
      commandHistoryCount: 2,
      messageCount: 3,
      isTraining: false,
      isProcessing: false,
    });

    const calCmd = cmdsUntrainedAlpha.find((c) => c.id === 'calibrate-model');
    expect(calCmd).toBeDefined();
    expect(calCmd?.label).toBe('Entrenar y calibrar');
    expect(calCmd?.epochs).toBe(12);
    expect(cmdsUntrainedAlpha.some((c) => c.id === 'generate-report')).toBe(true);
    expect(cmdsUntrainedAlpha.some((c) => c.id === 'clear-history')).toBe(true);
    expect(cmdsUntrainedAlpha.some((c) => c.id === 'open-reports')).toBe(false);

    const cmdsDigitsWithReports = resolveOmniQuickCommands({
      classifierMode: 'digits',
      digitsSummary,
      lettersSummary,
      alphanumericSummary: suite.alphanumericModel.getSummary(),
      hasPrediction: true,
      predictionCount: 4,
      simulationCount: 2,
      reportCount: 1,
      commandHistoryCount: 0,
      messageCount: 1,
      isTraining: false,
      isProcessing: false,
    });

    const digitsCal = cmdsDigitsWithReports.find((c) => c.id === 'calibrate-model');
    expect(digitsCal?.label).toBe('Calibrar modelo');
    expect(digitsCal?.epochs).toBe(6);
    expect(cmdsDigitsWithReports.some((c) => c.id === 'open-reports')).toBe(true);

    const report = buildOmniTechnicalReport(
      {
        activeModule: 'omni-bot',
        digitsSummary,
        lettersSummary,
        alphanumericSummary: untrainedAlphaSummary,
        lastPrediction: null,
        mnist784Result: null,
        last232Step: null,
        lastMathOperation: null,
      },
      { predictionCount: 4, simulationCount: 2 },
      '2026-11-18T21:00:00.000Z'
    );

    expect(report.results).toContain('Sin entrenar');
    expect(report.results).toContain('4 inferencias');
    expect(report.results).toContain('2 simulaciones');

    const reportMsg = formatReportAssistantMessage(report);
    expect(reportMsg).toContain(report.title);

    const calMsg = formatCalibrationAssistantMessage({
      mode: 'digits',
      epochsAdded: 6,
      before: digitsSummary,
      after: suite.digitsModel.getSummary(),
    });
    expect(calMsg).toContain('Dígitos 0–9');
    expect(calMsg).toContain('+6 épocas SGD');

    const omniSource = fs.readFileSync(
      path.join(process.cwd(), 'src', 'components', 'OmniBotView.tsx'),
      'utf-8'
    );
    expect(omniSource).toContain('Comandos Rápidos');
    expect(omniSource).toContain('resolveOmniQuickCommands');
    expect(omniSource).toContain('data-quick-command');
  }, 15000);
});










