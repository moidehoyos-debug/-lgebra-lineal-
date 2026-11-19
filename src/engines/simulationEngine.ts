import {
  createSeededRng,
  DatasetSample,
  GRID_SIZE,
  rasterizeGlyph,
} from './alphanumericDataset';
import {
  crossEntropyLoss,
  MLPNetwork,
  relu,
  softmax,
} from './neuralEngine';
import {
  ABExperimentResult,
  ABScenarioConfig,
  BatchPerturbationResult,
  BeforeAfterExperimentResult,
  Didactic322Config,
  Didactic322StepResult,
  LayerActivationDiff,
  SimulationExperimentConfig,
} from '../types/vectoria';

export function applyExperimentalPerturbation(
  baseGrid: number[],
  params: {
    shiftX: number;
    shiftY: number;
    noiseLevel: number;
    perturbationIntensity: number;
    seed: number;
  }
): number[] {
  const rng = createSeededRng(params.seed);
  const out = new Array<number>(baseGrid.length).fill(0);

  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const srcR = r - Math.round(params.shiftY);
      const srcC = c - Math.round(params.shiftX);
      let val =
        srcR >= 0 && srcR < GRID_SIZE && srcC >= 0 && srcC < GRID_SIZE
          ? baseGrid[srcR * GRID_SIZE + srcC]
          : 0;

      // Apply structured perturbation intensity (random attenuation / pixel dropout)
      if (params.perturbationIntensity > 0) {
        if (rng() < params.perturbationIntensity * 0.45) {
          val *= 1 - params.perturbationIntensity;
        }
      }

      // Apply reproducible zero-mean noise bounded by noiseLevel
      if (params.noiseLevel > 0) {
        const u1 = Math.max(1e-9, rng());
        const u2 = rng();
        const gauss = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        val = val + gauss * params.noiseLevel * 0.65;
      }

      out[r * GRID_SIZE + c] = Number(Math.max(0, Math.min(1, val)).toFixed(4));
    }
  }
  return out;
}

export function runBeforeAfterExperiment(
  baseModel: MLPNetwork,
  trainSet: DatasetSample[],
  valSet: DatasetSample[],
  config: SimulationExperimentConfig,
  customInputGrid?: number[]
): BeforeAfterExperimentResult {
  const t0 = performance.now();
  // STRICT ISOLATION: never mutate baseModel; always clone!
  const baselineClone = baseModel.clone();
  const experimentalClone = baseModel.clone();

  const originalGrid = customInputGrid
    ? [...customInputGrid]
    : rasterizeGlyph(config.targetGlyph);

  const modifiedGrid = applyExperimentalPerturbation(originalGrid, {
    shiftX: config.shiftX,
    shiftY: config.shiftY,
    noiseLevel: config.noiseLevel,
    perturbationIntensity: config.perturbationIntensity,
    seed: config.seed,
  });

  if (config.epochs > 0) {
    experimentalClone.trainEpochs(trainSet, valSet, config.epochs, config.learningRate, 0.85);
  }

  const targetIdx = Math.max(0, baselineClone.labels.indexOf(config.targetGlyph));
  const beforePred = baselineClone.predictScores(originalGrid);
  const afterPred = experimentalClone.predictScores(modifiedGrid);

  const lossBefore = crossEntropyLoss(
    beforePred.allScores.map((s) => s.probability),
    targetIdx
  );
  const lossAfter = crossEntropyLoss(
    afterPred.allScores.map((s) => s.probability),
    targetIdx
  );

  // Merge top union labels for Softmax comparison
  const topLabelsSet = new Set<string>([
    ...beforePred.topScores.slice(0, 5).map((s) => s.label),
    ...afterPred.topScores.slice(0, 5).map((s) => s.label),
  ]);
  const softmaxComparison = Array.from(topLabelsSet).map((lbl) => {
    const b = beforePred.allScores.find((s) => s.label === lbl)?.probability ?? 0;
    const a = afterPred.allScores.find((s) => s.label === lbl)?.probability ?? 0;
    return {
      label: lbl,
      beforePct: Number((b * 100).toFixed(2)),
      afterPct: Number((a * 100).toFixed(2)),
    };
  });

  const layerDiffs: LayerActivationDiff[] = beforePred.snapshots.map((snap, idx) => {
    const afterSnap = afterPred.snapshots[idx];
    const len = snap.aValues.length;
    let sumB = 0;
    let sumA = 0;
    let sumDiff = 0;
    for (let i = 0; i < len; i++) {
      const vb = snap.aValues[i] ?? 0;
      const va = afterSnap?.aValues[i] ?? 0;
      sumB += vb;
      sumA += va;
      sumDiff += Math.abs(va - vb);
    }
    return {
      layerName: snap.layerName,
      meanBefore: Number((sumB / len).toFixed(4)),
      meanAfter: Number((sumA / len).toFixed(4)),
      l1Delta: Number((sumDiff / len).toFixed(4)),
    };
  });

  return {
    config: { ...config },
    originalGrid,
    modifiedGrid,
    originalTopLabel: beforePred.topLabel,
    originalConfidence: beforePred.confidence,
    modifiedTopLabel: afterPred.topLabel,
    modifiedConfidence: afterPred.confidence,
    lossBefore,
    lossAfter,
    softmaxComparison,
    layerDiffs,
    modifiedSnapshots: afterPred.snapshots,
    durationMs: Number((performance.now() - t0).toFixed(2)),
  };
}

export function runBatchPerturbationExperiment(
  baseModel: MLPNetwork,
  dataset: DatasetSample[],
  config: SimulationExperimentConfig
): BatchPerturbationResult {
  const t0 = performance.now();
  const model = baseModel.clone();
  const activeLabels =
    config.selectedClasses.length > 0 ? new Set(config.selectedClasses) : null;
  const filtered = activeLabels
    ? dataset.filter((s) => activeLabels.has(s.label))
    : dataset;

  const perClassMap = new Map<
    string,
    { count: number; cleanHits: number; pertHits: number }
  >();

  let cleanHits = 0;
  let pertHits = 0;

  filtered.forEach((sample, idx) => {
    const entry = perClassMap.get(sample.label) ?? {
      count: 0,
      cleanHits: 0,
      pertHits: 0,
    };
    entry.count += 1;

    const cleanPred = model.predictScores(sample.input);
    if (cleanPred.topLabel === sample.label) {
      cleanHits += 1;
      entry.cleanHits += 1;
    }

    const perturbed = applyExperimentalPerturbation(sample.input, {
      shiftX: config.shiftX,
      shiftY: config.shiftY,
      noiseLevel: config.noiseLevel,
      perturbationIntensity: config.perturbationIntensity,
      seed: config.seed + idx * 17,
    });
    const pertPred = model.predictScores(perturbed);
    if (pertPred.topLabel === sample.label) {
      pertHits += 1;
      entry.pertHits += 1;
    }

    perClassMap.set(sample.label, entry);
  });

  const total = Math.max(1, filtered.length);
  const cleanAccuracy = cleanHits / total;
  const perturbedAccuracy = pertHits / total;

  const perClass = Array.from(perClassMap.entries()).map(([label, st]) => {
    const cAcc = st.cleanHits / st.count;
    const pAcc = st.pertHits / st.count;
    return {
      label,
      count: st.count,
      cleanAcc: Number((cAcc * 100).toFixed(1)),
      perturbedAcc: Number((pAcc * 100).toFixed(1)),
      deltaAcc: Number(((pAcc - cAcc) * 100).toFixed(1)),
    };
  });

  // Sensitivity curve across noise levels [0 .. 0.5]
  const noiseSweep = [0, 0.1, 0.2, 0.3, 0.4, 0.5];
  const sensitivityCurve = noiseSweep.map((sigma) => {
    let hits = 0;
    filtered.forEach((sample, idx) => {
      const g = applyExperimentalPerturbation(sample.input, {
        shiftX: config.shiftX,
        shiftY: config.shiftY,
        noiseLevel: sigma,
        perturbationIntensity: config.perturbationIntensity,
        seed: config.seed + idx * 17,
      });
      if (model.predictScores(g).topLabel === sample.label) hits += 1;
    });
    return {
      noiseSigma: sigma.toFixed(1),
      accuracyPct: Number(((hits / total) * 100).toFixed(1)),
    };
  });

  return {
    totalSamples: filtered.length,
    cleanAccuracy,
    perturbedAccuracy,
    accuracyDropPct: Number(((perturbedAccuracy - cleanAccuracy) * 100).toFixed(2)),
    perClass,
    sensitivityCurve,
    durationMs: Number((performance.now() - t0).toFixed(2)),
  };
}

export function runABExperiment(
  baseModel: MLPNetwork,
  trainSet: DatasetSample[],
  valSet: DatasetSample[],
  targetGlyph: string,
  scenarioA: ABScenarioConfig,
  scenarioB: ABScenarioConfig
): ABExperimentResult {
  const t0 = performance.now();
  const baseGrid = rasterizeGlyph(targetGlyph);
  const targetIdx = Math.max(0, baseModel.labels.indexOf(targetGlyph));

  const runScenario = (cfg: ABScenarioConfig) => {
    const clone = baseModel.clone();
    if (cfg.epochs > 0) {
      clone.trainEpochs(trainSet, valSet, cfg.epochs, cfg.learningRate, 0.85);
    }
    const evalRes = clone.evaluate(valSet);
    const input = applyExperimentalPerturbation(baseGrid, {
      shiftX: cfg.shiftX,
      shiftY: cfg.shiftY,
      noiseLevel: cfg.noiseLevel,
      perturbationIntensity: cfg.perturbationIntensity,
      seed: cfg.seed,
    });
    const pred = clone.predictScores(input);
    const probs = pred.allScores.map((s) => s.probability);
    const loss = crossEntropyLoss(probs, targetIdx);
    const targetConf = pred.allScores[targetIdx]?.probability ?? 0;

    return {
      config: { ...cfg },
      topLabel: pred.topLabel,
      targetConfidence: targetConf,
      loss,
      valAccuracy: evalRes.accuracy,
      softmaxTop: pred.topScores.slice(0, 5).map((s) => ({
        label: s.label,
        probPct: Number((s.probability * 100).toFixed(2)),
      })),
    };
  };

  const resA = runScenario(scenarioA);
  const resB = runScenario(scenarioB);

  const changedParams: Array<{ param: string; valueA: string; valueB: string }> = [];
  const checkDiff = (param: string, a: number, b: number, unit = '') => {
    if (a !== b) {
      changedParams.push({
        param,
        valueA: `${a}${unit}`,
        valueB: `${b}${unit}`,
      });
    }
  };
  checkDiff('Desplazamiento X', scenarioA.shiftX, scenarioB.shiftX, ' px');
  checkDiff('Desplazamiento Y', scenarioA.shiftY, scenarioB.shiftY, ' px');
  checkDiff('Ruido (σ)', scenarioA.noiseLevel, scenarioB.noiseLevel);
  checkDiff('Perturbación', scenarioA.perturbationIntensity, scenarioB.perturbationIntensity);
  checkDiff('Tasa de aprendizaje (η)', scenarioA.learningRate, scenarioB.learningRate);
  checkDiff('Épocas aisladas', scenarioA.epochs, scenarioB.epochs);
  checkDiff('Semilla', scenarioA.seed, scenarioB.seed);

  return {
    targetGlyph,
    mode: baseModel.mode,
    changedParams,
    scenarioA: resA,
    scenarioB: resB,
    durationMs: Number((performance.now() - t0).toFixed(2)),
  };
}

export function createDefaultDidactic322Config(): Didactic322Config {
  return {
    x: [0.85, 0.25, 0.6],
    yTargetIndex: 0,
    learningRate: 0.15,
    W1: [
      [0.45, -0.3, 0.55],
      [-0.25, 0.6, 0.35],
    ],
    b1: [0.1, -0.05],
    W2: [
      [0.7, -0.4],
      [-0.35, 0.65],
    ],
    b2: [0.05, 0.0],
  };
}

export function stepDidactic322(cfg: Didactic322Config): Didactic322StepResult {
  // Forward layer 1: z1 = W1*x + b1, a1 = ReLU(z1)
  const z1: [number, number] = [
    cfg.W1[0][0] * cfg.x[0] + cfg.W1[0][1] * cfg.x[1] + cfg.W1[0][2] * cfg.x[2] + cfg.b1[0],
    cfg.W1[1][0] * cfg.x[0] + cfg.W1[1][1] * cfg.x[1] + cfg.W1[1][2] * cfg.x[2] + cfg.b1[1],
  ];
  const a1: [number, number] = [relu(z1[0]), relu(z1[1])];

  // Forward layer 2: z2 = W2*a1 + b2, probs = Softmax(z2)
  const z2: [number, number] = [
    cfg.W2[0][0] * a1[0] + cfg.W2[0][1] * a1[1] + cfg.b2[0],
    cfg.W2[1][0] * a1[0] + cfg.W2[1][1] * a1[1] + cfg.b2[1],
  ];
  const pArr = softmax(z2);
  const probsBefore: [number, number] = [pArr[0], pArr[1]];
  const lossBefore = crossEntropyLoss(probsBefore, cfg.yTargetIndex);

  // Backprop output delta2 = probs - one_hot(y)
  const d2: [number, number] = [
    probsBefore[0] - (cfg.yTargetIndex === 0 ? 1 : 0),
    probsBefore[1] - (cfg.yTargetIndex === 1 ? 1 : 0),
  ];

  const gradW2: [[number, number], [number, number]] = [
    [d2[0] * a1[0], d2[0] * a1[1]],
    [d2[1] * a1[0], d2[1] * a1[1]],
  ];
  const gradB2: [number, number] = [d2[0], d2[1]];

  // Backprop hidden delta1 = (W2^T * d2) * relu'(z1)
  const d1: [number, number] = [
    z1[0] > 0 ? cfg.W2[0][0] * d2[0] + cfg.W2[1][0] * d2[1] : 0,
    z1[1] > 0 ? cfg.W2[0][1] * d2[0] + cfg.W2[1][1] * d2[1] : 0,
  ];

  const gradW1: [[number, number, number], [number, number, number]] = [
    [d1[0] * cfg.x[0], d1[0] * cfg.x[1], d1[0] * cfg.x[2]],
    [d1[1] * cfg.x[0], d1[1] * cfg.x[1], d1[1] * cfg.x[2]],
  ];
  const gradB1: [number, number] = [d1[0], d1[1]];

  const lr = cfg.learningRate;
  const updatedConfig: Didactic322Config = {
    ...cfg,
    x: [...cfg.x] as [number, number, number],
    W1: [
      [
        Number((cfg.W1[0][0] - lr * gradW1[0][0]).toFixed(5)),
        Number((cfg.W1[0][1] - lr * gradW1[0][1]).toFixed(5)),
        Number((cfg.W1[0][2] - lr * gradW1[0][2]).toFixed(5)),
      ],
      [
        Number((cfg.W1[1][0] - lr * gradW1[1][0]).toFixed(5)),
        Number((cfg.W1[1][1] - lr * gradW1[1][1]).toFixed(5)),
        Number((cfg.W1[1][2] - lr * gradW1[1][2]).toFixed(5)),
      ],
    ],
    b1: [
      Number((cfg.b1[0] - lr * gradB1[0]).toFixed(5)),
      Number((cfg.b1[1] - lr * gradB1[1]).toFixed(5)),
    ],
    W2: [
      [
        Number((cfg.W2[0][0] - lr * gradW2[0][0]).toFixed(5)),
        Number((cfg.W2[0][1] - lr * gradW2[0][1]).toFixed(5)),
      ],
      [
        Number((cfg.W2[1][0] - lr * gradW2[1][0]).toFixed(5)),
        Number((cfg.W2[1][1] - lr * gradW2[1][1]).toFixed(5)),
      ],
    ],
    b2: [
      Number((cfg.b2[0] - lr * gradB2[0]).toFixed(5)),
      Number((cfg.b2[1] - lr * gradB2[1]).toFixed(5)),
    ],
  };

  // Evaluate lossAfter with updated weights
  const z1After: [number, number] = [
    updatedConfig.W1[0][0] * cfg.x[0] +
      updatedConfig.W1[0][1] * cfg.x[1] +
      updatedConfig.W1[0][2] * cfg.x[2] +
      updatedConfig.b1[0],
    updatedConfig.W1[1][0] * cfg.x[0] +
      updatedConfig.W1[1][1] * cfg.x[1] +
      updatedConfig.W1[1][2] * cfg.x[2] +
      updatedConfig.b1[1],
  ];
  const a1After: [number, number] = [relu(z1After[0]), relu(z1After[1])];
  const z2After: [number, number] = [
    updatedConfig.W2[0][0] * a1After[0] +
      updatedConfig.W2[0][1] * a1After[1] +
      updatedConfig.b2[0],
    updatedConfig.W2[1][0] * a1After[0] +
      updatedConfig.W2[1][1] * a1After[1] +
      updatedConfig.b2[1],
  ];
  const pAfterArr = softmax(z2After);
  const probsAfter: [number, number] = [pAfterArr[0], pAfterArr[1]];
  const lossAfter = crossEntropyLoss(probsAfter, cfg.yTargetIndex);

  return {
    z1,
    a1,
    z2,
    probsBefore,
    probsAfter,
    lossBefore,
    lossAfter,
    gradW1,
    gradB1,
    gradW2,
    gradB2,
    updatedConfig,
  };
}
