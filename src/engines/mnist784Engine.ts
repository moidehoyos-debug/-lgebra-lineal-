import {
  Didactic232Config,
  Didactic232StepResult,
  Mnist784InferenceResult,
  Mnist784NeuronInspection,
  Mnist784PerturbationConfig,
  Mnist784PerturbationResult,
} from '../types/vectoria';
import {
  MNIST_784_META,
  MNIST_784_REPORT,
  MNIST_784_WEIGHTS_BASE64,
} from './mnist784Data';

export const MNIST_784_PARAM_COUNT = 101770;
const W1_OFFSET = 0; // 784 * 128 = 100352
const B1_OFFSET = 100352; // 128
const W2_OFFSET = 100480; // 128 * 10 = 1280
const B2_OFFSET = 101760; // 10

let cachedWeights: Float32Array | null = null;

function decodeBase64ToBytes(b64: string): Uint8Array {
  if (typeof atob === 'function') {
    const raw = atob(b64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
      bytes[i] = raw.charCodeAt(i);
    }
    return bytes;
  }
  const buf = Buffer.from(b64, 'base64');
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

/**
 * Returns immutable pre-trained synthetic 784-128-10 weights (101,770 Float32 values).
 * Original weights are never mutated by any lab or simulation.
 */
export function getMnist784Weights(): Float32Array {
  if (cachedWeights) return cachedWeights;
  const bytes = decodeBase64ToBytes(MNIST_784_WEIGHTS_BASE64);
  if (bytes.byteLength !== MNIST_784_PARAM_COUNT * 4) {
    throw new Error(
      `Longitud de pesos 784-128-10 inválida: ${bytes.byteLength} bytes (esperado ${
        MNIST_784_PARAM_COUNT * 4
      })`
    );
  }
  // Ensure aligned ArrayBuffer copy for Float32Array
  const aligned = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(aligned).set(bytes);
  cachedWeights = new Float32Array(aligned);
  return cachedWeights;
}

export function getMnist784Meta() {
  return MNIST_784_META;
}

export function getMnist784HistoricalReport() {
  return MNIST_784_REPORT;
}

export function getMnist784ExamplePixels(digit: number): number[] {
  const found =
    MNIST_784_REPORT.examples.find((e) => e.digit === digit) ??
    MNIST_784_REPORT.examples[0];
  return found.pixels.map((v) => Number((v / 255).toFixed(6)));
}

export function infer784(pixels: number[]): Mnist784InferenceResult {
  if (pixels.length !== 784) {
    throw new Error(`Se necesitan 784 píxeles (recibidos ${pixels.length}).`);
  }
  for (let i = 0; i < 784; i++) {
    const v = pixels[i];
    if (!Number.isFinite(v) || v < 0 || v > 1) {
      throw new Error(`Píxel fuera del intervalo [0, 1] en índice ${i}: ${v}`);
    }
  }

  const w = getMnist784Weights();
  const z1 = new Array<number>(128);
  const a1 = new Array<number>(128);
  const z2 = new Array<number>(10);

  for (let j = 0; j < 128; j++) {
    let acc = w[B1_OFFSET + j];
    for (let i = 0; i < 784; i++) {
      const xi = pixels[i];
      if (xi !== 0) acc += xi * w[i * 128 + j];
    }
    z1[j] = acc;
    a1[j] = acc > 0 ? acc : 0;
  }

  for (let k = 0; k < 10; k++) {
    let acc = w[B2_OFFSET + k];
    for (let j = 0; j < 128; j++) {
      acc += a1[j] * w[W2_OFFSET + j * 10 + k];
    }
    z2[k] = acc;
  }

  const shift = Math.max(...z2);
  const exp = z2.map((v) => Math.exp(v - shift));
  const den = exp.reduce((s, v) => s + v, 0);
  const probs = exp.map((v) => v / den);

  let best = 0;
  for (let k = 1; k < 10; k++) {
    if (probs[k] > probs[best]) best = k;
  }

  let activeNeurons = 0;
  for (let j = 0; j < 128; j++) if (a1[j] > 0) activeNeurons++;

  let activePixels = 0;
  for (let i = 0; i < 784; i++) if (pixels[i] > 0.1) activePixels++;

  let entropy = 0;
  for (let k = 0; k < 10; k++) {
    if (probs[k] > 1e-12) entropy -= probs[k] * Math.log2(probs[k]);
  }

  const topAlternatives = probs
    .map((probability, digit) => ({ digit, probability, logit: z2[digit] }))
    .sort((a, b) => b.probability - a.probability);

  return {
    digit: best,
    confidence: probs[best],
    probs,
    z1,
    a1,
    z2,
    activeNeurons,
    activePixels,
    entropy,
    topAlternatives,
    timestamp: new Date().toISOString(),
  };
}

export function inspectMnist784Neuron(
  pixels: number[],
  inference: Mnist784InferenceResult,
  rawPixelIndex: number,
  rawNeuronIndex: number
): Mnist784NeuronInspection {
  const i = Math.max(0, Math.min(783, Math.round(rawPixelIndex)));
  const j = Math.max(0, Math.min(127, Math.round(rawNeuronIndex)));
  const w = getMnist784Weights();

  const pixelValue = pixels[i] ?? 0;
  const weight = w[W1_OFFSET + i * 128 + j];
  const bias = w[B1_OFFSET + j];
  const z1Val = inference.z1[j] ?? 0;
  const a1Val = inference.a1[j] ?? 0;

  const contributions: Mnist784NeuronInspection['topContributingPixels'] = [];
  for (let p = 0; p < 784; p++) {
    const pv = pixels[p] ?? 0;
    if (pv <= 0.01) continue;
    const wp = w[W1_OFFSET + p * 128 + j];
    contributions.push({
      pixelIndex: p,
      row: Math.floor(p / 28),
      col: p % 28,
      pixelValue: pv,
      weight: wp,
      contribution: pv * wp,
    });
  }
  contributions.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  const outputProjections = Array.from({ length: 10 }, (_, digit) => {
    const weightW2 = w[W2_OFFSET + j * 10 + digit];
    return {
      digit,
      weightW2,
      contributionToLogit: a1Val * weightW2,
    };
  });

  return {
    pixelIndex: i,
    row: Math.floor(i / 28),
    col: i % 28,
    neuronIndex: j,
    pixelValue,
    weight,
    contribution: pixelValue * weight,
    bias,
    z1: z1Val,
    a1: a1Val,
    topContributingPixels: contributions.slice(0, 8),
    outputProjections,
  };
}

export function getMnist784WeightSlices() {
  const w = getMnist784Weights();
  return {
    w1At: (pixelIdx: number, neuronIdx: number) => w[W1_OFFSET + pixelIdx * 128 + neuronIdx],
    b1At: (neuronIdx: number) => w[B1_OFFSET + neuronIdx],
    w2At: (neuronIdx: number, digit: number) => w[W2_OFFSET + neuronIdx * 10 + digit],
    b2At: (digit: number) => w[B2_OFFSET + digit],
  };
}

/**
 * Normalizes a 280x280 canvas drawing into a 784-element [0,1] vector
 * using MNIST-style bounding box crop -> 20x20 fit -> 28x28 centered canvas.
 */
export function normalizeCanvasTo28x28(canvas: HTMLCanvasElement): number[] {
  const off = document.createElement('canvas');
  off.width = 28;
  off.height = 28;
  const c = off.getContext('2d', { willReadFrequently: true });
  if (!c) return new Array<number>(784).fill(0);

  c.fillStyle = '#000';
  c.fillRect(0, 0, 28, 28);
  c.drawImage(canvas, 0, 0, 28, 28);
  const px = c.getImageData(0, 0, 28, 28).data;
  const input = Array.from({ length: 784 }, (_, i) => px[i * 4] / 255);

  let left = 28;
  let right = -1;
  let top = 28;
  let bottom = -1;
  let total = 0;

  for (let y = 0; y < 28; y++) {
    for (let x = 0; x < 28; x++) {
      const v = input[y * 28 + x];
      if (v > 0.08) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        total += v;
      }
    }
  }

  if (right < left || total < 0.1) return input;

  const w = right - left + 1;
  const h = bottom - top + 1;
  const scale = 20 / Math.max(w, h);
  const dest = document.createElement('canvas');
  dest.width = 28;
  dest.height = 28;
  const d = dest.getContext('2d', { willReadFrequently: true });
  if (!d) return input;

  d.fillStyle = '#000';
  d.fillRect(0, 0, 28, 28);
  const rw = Math.max(1, w * scale);
  const rh = Math.max(1, h * scale);
  d.imageSmoothingEnabled = true;
  d.drawImage(off, left, top, w, h, (28 - rw) / 2, (28 - rh) / 2, rw, rh);
  const finalData = d.getImageData(0, 0, 28, 28).data;
  return Array.from({ length: 784 }, (_, i) => finalData[i * 4] / 255);
}

/**
 * Downsamples a 28x28 [0,1] vector to VectorIA's 16x16 (256-dim) space via bilinear sampling
 * so cross-module inspection works seamlessly with Topology / XAI / 16x16 classifiers.
 */
export function downsample28x28To16x16(pixels784: number[]): number[] {
  const out = new Array<number>(256).fill(0);
  for (let r = 0; r < 16; r++) {
    for (let c = 0; c < 16; c++) {
      const sy = (r / 15) * 27;
      const sx = (c / 15) * 27;
      const y0 = Math.floor(sy);
      const x0 = Math.floor(sx);
      const y1 = Math.min(27, y0 + 1);
      const x1 = Math.min(27, x0 + 1);
      const wy = sy - y0;
      const wx = sx - x0;
      const v00 = pixels784[y0 * 28 + x0] ?? 0;
      const v10 = pixels784[y0 * 28 + x1] ?? 0;
      const v01 = pixels784[y1 * 28 + x0] ?? 0;
      const v11 = pixels784[y1 * 28 + x1] ?? 0;
      const interp =
        v00 * (1 - wx) * (1 - wy) +
        v10 * wx * (1 - wy) +
        v01 * (1 - wx) * wy +
        v11 * wx * wy;
      out[r * 16 + c] = Number(Math.max(0, Math.min(1, interp)).toFixed(4));
    }
  }
  return out;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function sampleBilinear28(grid: number[], sx: number, sy: number): number {
  if (sx < 0 || sx > 27 || sy < 0 || sy > 27) return 0;
  const x0 = Math.floor(sx);
  const y0 = Math.floor(sy);
  const x1 = Math.min(27, x0 + 1);
  const y1 = Math.min(27, y0 + 1);
  const wx = sx - x0;
  const wy = sy - y0;
  const v00 = grid[y0 * 28 + x0] ?? 0;
  const v10 = grid[y0 * 28 + x1] ?? 0;
  const v01 = grid[y1 * 28 + x0] ?? 0;
  const v11 = grid[y1 * 28 + x1] ?? 0;
  return (
    v00 * (1 - wx) * (1 - wy) +
    v10 * wx * (1 - wy) +
    v01 * (1 - wx) * wy +
    v11 * wx * wy
  );
}

export const DEFAULT_MNIST_PERTURB_CONFIG: Mnist784PerturbationConfig = {
  shiftX: 0,
  shiftY: 0,
  noiseLevel: 0,
  rotationDeg: 0,
  scale: 1,
  thickness: 0,
  intensity: 1,
  distortion: 0,
  seed: 2375,
};

/**
 * Pure, deterministic 28x28 perturbation operator preserving original buffer & weights.
 * Supports shifts X/Y, rotation, scaling, stroke thickness (erosion/dilation),
 * sinusoidal geometric distortion, contrast/intensity gain, and seeded noise.
 */
export function perturbPixels28x28(
  basePixels: number[],
  cfg: Mnist784PerturbationConfig
): number[] {
  if (basePixels.length !== 784) {
    throw new Error('Se requieren 784 píxeles para perturbación 28×28.');
  }

  // 1. Morphological stroke thickness adjustment (erosion < 0, dilation > 0)
  let thicknessAdjusted = basePixels.slice();
  if (Math.abs(cfg.thickness) > 1e-4) {
    const t = Math.max(-1, Math.min(1, cfg.thickness));
    const next = new Array<number>(784).fill(0);
    for (let y = 0; y < 28; y++) {
      for (let x = 0; x < 28; x++) {
        const center = basePixels[y * 28 + x];
        let ext = center;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const ny = y + dy;
            const nx = x + dx;
            const val =
              ny >= 0 && ny < 28 && nx >= 0 && nx < 28 ? basePixels[ny * 28 + nx] : 0;
            if (t > 0) {
              if (val > ext) ext = val;
            } else {
              if (val < ext) ext = val;
            }
          }
        }
        const alpha = Math.abs(t);
        next[y * 28 + x] = center * (1 - alpha) + ext * alpha;
      }
    }
    thicknessAdjusted = next;
  }

  // 2. Geometric inverse transform: shift + scale + rotation + sinusoidal warp
  const rad = (-cfg.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const invScale = 1 / Math.max(0.25, cfg.scale);
  const cx = 13.5;
  const cy = 13.5;
  const isIdentityGeom =
    cfg.shiftX === 0 &&
    cfg.shiftY === 0 &&
    cfg.rotationDeg === 0 &&
    Math.abs(cfg.scale - 1) < 1e-6 &&
    cfg.distortion === 0;

  const geom = isIdentityGeom
    ? thicknessAdjusted
    : new Array<number>(784).fill(0);

  if (!isIdentityGeom) {
    const phase = (cfg.seed % 360) * 0.05;
    for (let y = 0; y < 28; y++) {
      for (let x = 0; x < 28; x++) {
        // Translate back from user shift
        let px = x - cfg.shiftX - cx;
        let py = y - cfg.shiftY - cy;

        // Distortion wave
        if (cfg.distortion > 0) {
          px += Math.sin(y * 0.45 + phase) * cfg.distortion * 1.8;
          py += Math.cos(x * 0.45 + phase) * cfg.distortion * 1.8;
        }

        // Rotate + scale around center
        const rx = (px * cos - py * sin) * invScale + cx;
        const ry = (px * sin + py * cos) * invScale + cy;

        // If exact integer shift only, use crisp grid lookup for bit-exact parity with original HTML
        if (
          cfg.rotationDeg === 0 &&
          Math.abs(cfg.scale - 1) < 1e-6 &&
          cfg.distortion === 0 &&
          Number.isInteger(cfg.shiftX) &&
          Number.isInteger(cfg.shiftY)
        ) {
          const sx = x - cfg.shiftX;
          const sy = y - cfg.shiftY;
          geom[y * 28 + x] =
            sx >= 0 && sx < 28 && sy >= 0 && sy < 28
              ? thicknessAdjusted[sy * 28 + sx]
              : 0;
        } else {
          geom[y * 28 + x] = sampleBilinear28(thicknessAdjusted, rx, ry);
        }
      }
    }
  }

  // 3. Intensity scaling + deterministic noise (preserving LCG structure)
  let seed = (cfg.seed >>> 0) || 2375;
  const out = new Array<number>(784);
  for (let idx = 0; idx < 784; idx++) {
    seed = (1664525 * seed + 1013904223) >>> 0;
    const rand = seed / 4294967296;
    const baseVal = geom[idx] * cfg.intensity;
    const noisy = cfg.noiseLevel > 0 ? baseVal + (rand * 2 - 1) * cfg.noiseLevel : baseVal;
    out[idx] = clamp01(noisy);
  }
  return out;
}

export function runMnist784PerturbationComparison(
  basePixels: number[],
  config: Mnist784PerturbationConfig
): Mnist784PerturbationResult {
  const before = infer784(basePixels);
  const perturbedPixels = perturbPixels28x28(basePixels, config);
  const after = infer784(perturbedPixels);

  const softmaxComparison = Array.from({ length: 10 }, (_, digit) => {
    const beforePct = Number((before.probs[digit] * 100).toFixed(2));
    const afterPct = Number((after.probs[digit] * 100).toFixed(2));
    return {
      digit: String(digit),
      beforePct,
      afterPct,
      deltaPct: Number((afterPct - beforePct).toFixed(2)),
    };
  });

  return {
    config: { ...config },
    originalPixels: basePixels.slice(),
    perturbedPixels,
    before,
    after,
    confidenceDeltaPct: Number(((after.confidence - before.confidence) * 100).toFixed(2)),
    changedClass: before.digit !== after.digit,
    softmaxComparison,
  };
}

/**
 * Independent Didactic 2-3-2 Backpropagation Simulator recovered from the original HTML.
 * Strictly isolated from 784-128-10 and 16x16 model weights.
 */
export function createDefaultDidactic232Config(): Didactic232Config {
  return {
    x: [1.0, 0.5],
    yTargetIndex: 0,
    learningRate: 0.1,
    W1: [
      [0.5, -0.2, 0.1],
      [0.3, 0.7, -0.4],
    ],
    b1: [0.1, -0.1, 0.05],
    W2: [
      [0.6, -0.3],
      [-0.1, 0.9],
      [0.2, -0.2],
    ],
    b2: [0, 0.1],
  };
}

export function forwardDidactic232(
  x: [number, number],
  W1: Didactic232Config['W1'],
  b1: Didactic232Config['b1'],
  W2: Didactic232Config['W2'],
  b2: Didactic232Config['b2'],
  yTargetIndex: 0 | 1
) {
  const z1 = b1.map((b, j) => b + x[0] * W1[0][j] + x[1] * W1[1][j]) as [
    number,
    number,
    number,
  ];
  const a1 = z1.map((v) => (v > 0 ? v : 0)) as [number, number, number];
  const z2 = b2.map(
    (b, k) => b + a1[0] * W2[0][k] + a1[1] * W2[1][k] + a1[2] * W2[2][k]
  ) as [number, number];
  const shift = Math.max(z2[0], z2[1]);
  const e0 = Math.exp(z2[0] - shift);
  const e1 = Math.exp(z2[1] - shift);
  const sum = e0 + e1;
  const probs: [number, number] = [e0 / sum, e1 / sum];
  const loss = -Math.log(Math.max(probs[yTargetIndex], 1e-15));
  return { z1, a1, z2, probs, loss };
}

export function stepDidactic232(cfg: Didactic232Config): Didactic232StepResult {
  const lr = Math.max(1e-4, Math.min(0.5, cfg.learningRate));
  const f = forwardDidactic232(cfg.x, cfg.W1, cfg.b1, cfg.W2, cfg.b2, cfg.yTargetIndex);

  const delta2: [number, number] = [
    f.probs[0] - (cfg.yTargetIndex === 0 ? 1 : 0),
    f.probs[1] - (cfg.yTargetIndex === 1 ? 1 : 0),
  ];

  const gradW2 = cfg.W2.map((row, j) =>
    row.map((_, k) => f.a1[j] * delta2[k])
  ) as Didactic232Config['W2'];
  const gradB2: [number, number] = [delta2[0], delta2[1]];

  const delta1 = f.z1.map((z, j) =>
    z > 0 ? cfg.W2[j][0] * delta2[0] + cfg.W2[j][1] * delta2[1] : 0
  ) as [number, number, number];

  const gradW1 = cfg.W1.map((row, i) =>
    row.map((_, j) => cfg.x[i] * delta1[j])
  ) as Didactic232Config['W1'];
  const gradB1: [number, number, number] = [delta1[0], delta1[1], delta1[2]];

  const W1n = cfg.W1.map((row, i) =>
    row.map((v, j) => v - lr * gradW1[i][j])
  ) as Didactic232Config['W1'];
  const b1n = cfg.b1.map((v, j) => v - lr * gradB1[j]) as [number, number, number];
  const W2n = cfg.W2.map((row, j) =>
    row.map((v, k) => v - lr * gradW2[j][k])
  ) as Didactic232Config['W2'];
  const b2n = cfg.b2.map((v, k) => v - lr * gradB2[k]) as [number, number];

  const next = forwardDidactic232(cfg.x, W1n, b1n, W2n, b2n, cfg.yTargetIndex);

  // Finite-difference verification across W2[0][0] and all W1/W2/b1/b2 parameters
  const h = 1e-5;
  let maxErr = 0;

  const plusW200 = cfg.W2.map((r) => r.slice()) as Didactic232Config['W2'];
  const minusW200 = cfg.W2.map((r) => r.slice()) as Didactic232Config['W2'];
  plusW200[0][0] += h;
  minusW200[0][0] -= h;
  const numericW200 =
    (forwardDidactic232(cfg.x, cfg.W1, cfg.b1, plusW200, cfg.b2, cfg.yTargetIndex).loss -
      forwardDidactic232(cfg.x, cfg.W1, cfg.b1, minusW200, cfg.b2, cfg.yTargetIndex).loss) /
    (2 * h);
  const numericErrorW200 = Math.abs(numericW200 - gradW2[0][0]);
  maxErr = Math.max(maxErr, numericErrorW200);

  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 3; j++) {
      if (Math.abs(f.z1[j]) < 1e-4) continue; // skip non-differentiable ReLU kink
      const pW = cfg.W1.map((r) => r.slice()) as Didactic232Config['W1'];
      const mW = cfg.W1.map((r) => r.slice()) as Didactic232Config['W1'];
      pW[i][j] += h;
      mW[i][j] -= h;
      const num =
        (forwardDidactic232(cfg.x, pW, cfg.b1, cfg.W2, cfg.b2, cfg.yTargetIndex).loss -
          forwardDidactic232(cfg.x, mW, cfg.b1, cfg.W2, cfg.b2, cfg.yTargetIndex).loss) /
        (2 * h);
      maxErr = Math.max(maxErr, Math.abs(num - gradW1[i][j]));
    }
  }

  for (let j = 0; j < 3; j++) {
    for (let k = 0; k < 2; k++) {
      const pW = cfg.W2.map((r) => r.slice()) as Didactic232Config['W2'];
      const mW = cfg.W2.map((r) => r.slice()) as Didactic232Config['W2'];
      pW[j][k] += h;
      mW[j][k] -= h;
      const num =
        (forwardDidactic232(cfg.x, cfg.W1, cfg.b1, pW, cfg.b2, cfg.yTargetIndex).loss -
          forwardDidactic232(cfg.x, cfg.W1, cfg.b1, mW, cfg.b2, cfg.yTargetIndex).loss) /
        (2 * h);
      maxErr = Math.max(maxErr, Math.abs(num - gradW2[j][k]));
    }
  }

  return {
    z1: f.z1,
    a1: f.a1,
    z2: f.z2,
    probsBefore: f.probs,
    probsAfter: next.probs,
    lossBefore: f.loss,
    lossAfter: next.loss,
    delta2,
    delta1,
    gradW1,
    gradB1,
    gradW2,
    gradB2,
    numericW200,
    numericErrorW200,
    maxFiniteDiffError: maxErr,
    updatedConfig: {
      x: [...cfg.x] as [number, number],
      yTargetIndex: cfg.yTargetIndex,
      learningRate: lr,
      W1: W1n,
      b1: b1n,
      W2: W2n,
      b2: b2n,
    },
  };
}
