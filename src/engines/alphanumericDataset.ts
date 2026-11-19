export const DIGIT_LABELS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;
export const LETTER_LABELS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
] as const;
export const ALPHANUMERIC_LABELS = [...DIGIT_LABELS, ...LETTER_LABELS] as const;

export const GRID_SIZE = 16;
export const INPUT_DIM = GRID_SIZE * GRID_SIZE; // 256

type Segment = [number, number, number, number]; // normalized [x1, y1, x2, y2] in [0, 1]

// Canonical vector stroke prototypes (distinct morphological geometry, including 0 vs O and 1 vs I)
const GLYPH_STROKES: Record<string, Segment[]> = {
  // Digits: 0 has diagonal slash or oval tall aspect; 1 has serif top flag without bottom bar or narrow stem
  '0': [
    [0.32, 0.16, 0.68, 0.16],
    [0.68, 0.16, 0.78, 0.34],
    [0.78, 0.34, 0.78, 0.66],
    [0.78, 0.66, 0.68, 0.84],
    [0.68, 0.84, 0.32, 0.84],
    [0.32, 0.84, 0.22, 0.66],
    [0.22, 0.66, 0.22, 0.34],
    [0.22, 0.34, 0.32, 0.16],
    [0.34, 0.70, 0.66, 0.30], // characteristic digit-0 inner slash
  ],
  '1': [
    [0.36, 0.28, 0.54, 0.14],
    [0.54, 0.14, 0.54, 0.86],
    [0.34, 0.86, 0.74, 0.86],
  ],
  '2': [
    [0.24, 0.28, 0.42, 0.14],
    [0.42, 0.14, 0.68, 0.14],
    [0.68, 0.14, 0.78, 0.30],
    [0.78, 0.30, 0.66, 0.50],
    [0.66, 0.50, 0.24, 0.86],
    [0.24, 0.86, 0.78, 0.86],
  ],
  '3': [
    [0.26, 0.18, 0.68, 0.18],
    [0.68, 0.18, 0.76, 0.34],
    [0.76, 0.34, 0.56, 0.48],
    [0.42, 0.48, 0.64, 0.48],
    [0.64, 0.48, 0.78, 0.66],
    [0.78, 0.66, 0.66, 0.84],
    [0.66, 0.84, 0.26, 0.84],
  ],
  '4': [
    [0.64, 0.14, 0.22, 0.60],
    [0.22, 0.60, 0.80, 0.60],
    [0.64, 0.14, 0.64, 0.86],
  ],
  '5': [
    [0.74, 0.16, 0.28, 0.16],
    [0.28, 0.16, 0.26, 0.48],
    [0.26, 0.48, 0.64, 0.48],
    [0.64, 0.48, 0.78, 0.64],
    [0.78, 0.64, 0.68, 0.84],
    [0.68, 0.84, 0.26, 0.84],
  ],
  '6': [
    [0.68, 0.16, 0.36, 0.16],
    [0.36, 0.16, 0.22, 0.44],
    [0.22, 0.44, 0.22, 0.74],
    [0.22, 0.74, 0.42, 0.86],
    [0.42, 0.86, 0.72, 0.78],
    [0.72, 0.78, 0.74, 0.56],
    [0.74, 0.56, 0.48, 0.48],
    [0.48, 0.48, 0.22, 0.58],
  ],
  '7': [
    [0.22, 0.16, 0.78, 0.16],
    [0.78, 0.16, 0.42, 0.86],
    [0.36, 0.52, 0.64, 0.52],
  ],
  '8': [
    [0.34, 0.16, 0.66, 0.16],
    [0.66, 0.16, 0.74, 0.32],
    [0.74, 0.32, 0.50, 0.48],
    [0.50, 0.48, 0.26, 0.32],
    [0.26, 0.32, 0.34, 0.16],
    [0.50, 0.48, 0.76, 0.66],
    [0.76, 0.66, 0.66, 0.86],
    [0.66, 0.86, 0.34, 0.86],
    [0.34, 0.86, 0.24, 0.66],
    [0.24, 0.66, 0.50, 0.48],
  ],
  '9': [
    [0.74, 0.34, 0.66, 0.16],
    [0.66, 0.16, 0.34, 0.16],
    [0.34, 0.16, 0.24, 0.36],
    [0.24, 0.36, 0.36, 0.52],
    [0.36, 0.52, 0.74, 0.48],
    [0.74, 0.34, 0.74, 0.68],
    [0.74, 0.68, 0.56, 0.86],
    [0.56, 0.86, 0.28, 0.86],
  ],

  // Letters A-Z
  A: [[0.50, 0.14, 0.18, 0.86], [0.50, 0.14, 0.82, 0.86], [0.28, 0.58, 0.72, 0.58]],
  B: [
    [0.24, 0.14, 0.24, 0.86],
    [0.24, 0.14, 0.66, 0.14],
    [0.66, 0.14, 0.76, 0.30],
    [0.76, 0.30, 0.64, 0.48],
    [0.24, 0.48, 0.66, 0.48],
    [0.66, 0.48, 0.78, 0.66],
    [0.78, 0.66, 0.66, 0.86],
    [0.66, 0.86, 0.24, 0.86],
  ],
  C: [
    [0.76, 0.24, 0.56, 0.14],
    [0.56, 0.14, 0.32, 0.18],
    [0.32, 0.18, 0.22, 0.38],
    [0.22, 0.38, 0.22, 0.64],
    [0.22, 0.64, 0.32, 0.82],
    [0.32, 0.82, 0.56, 0.86],
    [0.56, 0.86, 0.76, 0.76],
  ],
  D: [
    [0.24, 0.14, 0.24, 0.86],
    [0.24, 0.14, 0.58, 0.16],
    [0.58, 0.16, 0.78, 0.36],
    [0.78, 0.36, 0.78, 0.64],
    [0.78, 0.64, 0.58, 0.84],
    [0.58, 0.84, 0.24, 0.86],
  ],
  E: [
    [0.74, 0.16, 0.24, 0.16],
    [0.24, 0.16, 0.24, 0.84],
    [0.24, 0.50, 0.64, 0.50],
    [0.24, 0.84, 0.76, 0.84],
  ],
  F: [
    [0.74, 0.16, 0.24, 0.16],
    [0.24, 0.16, 0.24, 0.86],
    [0.24, 0.50, 0.64, 0.50],
  ],
  G: [
    [0.74, 0.24, 0.52, 0.14],
    [0.52, 0.14, 0.28, 0.20],
    [0.28, 0.20, 0.20, 0.50],
    [0.20, 0.50, 0.28, 0.80],
    [0.28, 0.80, 0.56, 0.86],
    [0.56, 0.86, 0.78, 0.76],
    [0.78, 0.76, 0.78, 0.52],
    [0.78, 0.52, 0.52, 0.52],
  ],
  H: [[0.24, 0.14, 0.24, 0.86], [0.76, 0.14, 0.76, 0.86], [0.24, 0.50, 0.76, 0.50]],
  I: [[0.28, 0.16, 0.72, 0.16], [0.50, 0.16, 0.50, 0.84], [0.28, 0.84, 0.72, 0.84]],
  J: [
    [0.32, 0.16, 0.76, 0.16],
    [0.64, 0.16, 0.64, 0.72],
    [0.64, 0.72, 0.50, 0.86],
    [0.50, 0.86, 0.28, 0.82],
    [0.28, 0.82, 0.22, 0.68],
  ],
  K: [[0.24, 0.14, 0.24, 0.86], [0.76, 0.14, 0.24, 0.52], [0.34, 0.46, 0.78, 0.86]],
  L: [[0.26, 0.14, 0.26, 0.84], [0.26, 0.84, 0.78, 0.84]],
  M: [[0.18, 0.86, 0.22, 0.14], [0.22, 0.14, 0.50, 0.56], [0.50, 0.56, 0.78, 0.14], [0.78, 0.14, 0.82, 0.86]],
  N: [[0.22, 0.86, 0.22, 0.14], [0.22, 0.14, 0.78, 0.86], [0.78, 0.86, 0.78, 0.14]],
  O: [
    [0.50, 0.14, 0.74, 0.24],
    [0.74, 0.24, 0.82, 0.50],
    [0.82, 0.50, 0.74, 0.76],
    [0.74, 0.76, 0.50, 0.86],
    [0.50, 0.86, 0.26, 0.76],
    [0.26, 0.76, 0.18, 0.50],
    [0.18, 0.50, 0.26, 0.24],
    [0.26, 0.24, 0.50, 0.14],
  ],
  P: [
    [0.24, 0.14, 0.24, 0.86],
    [0.24, 0.14, 0.66, 0.14],
    [0.66, 0.14, 0.78, 0.32],
    [0.78, 0.32, 0.66, 0.50],
    [0.66, 0.50, 0.24, 0.50],
  ],
  Q: [
    [0.50, 0.14, 0.74, 0.24],
    [0.74, 0.24, 0.80, 0.50],
    [0.80, 0.50, 0.72, 0.74],
    [0.72, 0.74, 0.50, 0.84],
    [0.50, 0.84, 0.26, 0.74],
    [0.26, 0.74, 0.18, 0.48],
    [0.18, 0.48, 0.26, 0.24],
    [0.26, 0.24, 0.50, 0.14],
    [0.56, 0.64, 0.84, 0.90],
  ],
  R: [
    [0.24, 0.14, 0.24, 0.86],
    [0.24, 0.14, 0.66, 0.14],
    [0.66, 0.14, 0.78, 0.30],
    [0.78, 0.30, 0.66, 0.48],
    [0.66, 0.48, 0.24, 0.48],
    [0.46, 0.48, 0.78, 0.86],
  ],
  S: [
    [0.74, 0.22, 0.56, 0.14],
    [0.56, 0.14, 0.32, 0.16],
    [0.32, 0.16, 0.24, 0.34],
    [0.24, 0.34, 0.48, 0.48],
    [0.48, 0.48, 0.74, 0.60],
    [0.74, 0.60, 0.76, 0.78],
    [0.76, 0.78, 0.54, 0.86],
    [0.54, 0.86, 0.24, 0.78],
  ],
  T: [[0.18, 0.16, 0.82, 0.16], [0.50, 0.16, 0.50, 0.86]],
  U: [
    [0.22, 0.14, 0.22, 0.68],
    [0.22, 0.68, 0.36, 0.84],
    [0.36, 0.84, 0.64, 0.84],
    [0.64, 0.84, 0.78, 0.68],
    [0.78, 0.68, 0.78, 0.14],
  ],
  V: [[0.18, 0.14, 0.50, 0.86], [0.50, 0.86, 0.82, 0.14]],
  W: [[0.14, 0.14, 0.32, 0.86], [0.32, 0.86, 0.50, 0.44], [0.50, 0.44, 0.68, 0.86], [0.68, 0.86, 0.86, 0.14]],
  X: [[0.20, 0.14, 0.80, 0.86], [0.80, 0.14, 0.20, 0.86]],
  Y: [[0.18, 0.14, 0.50, 0.52], [0.82, 0.14, 0.50, 0.52], [0.50, 0.52, 0.50, 0.86]],
  Z: [[0.20, 0.16, 0.80, 0.16], [0.80, 0.16, 0.20, 0.84], [0.20, 0.84, 0.80, 0.84]],
};

function distPointToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-8) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

export function createSeededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function rasterizeGlyph(
  label: string,
  options?: { shiftX?: number; shiftY?: number; scale?: number; tilt?: number; thickness?: number; noise?: number; rng?: () => number }
): number[] {
  const segments = GLYPH_STROKES[label];
  if (!segments) throw new Error(`Glifo desconocido: ${label}`);
  const shiftX = options?.shiftX ?? 0;
  const shiftY = options?.shiftY ?? 0;
  const scale = options?.scale ?? 1;
  const tilt = options?.tilt ?? 0;
  const thickness = options?.thickness ?? 0.088;
  const noise = options?.noise ?? 0;
  const rng = options?.rng ?? Math.random;

  const grid = new Array<number>(INPUT_DIM).fill(0);
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const gx = (col + 0.5) / GRID_SIZE;
      const gy = (row + 0.5) / GRID_SIZE;
      // Apply inverse affine augmentation to sample coordinates
      const cx = (gx - 0.5 - shiftX) / scale;
      const cy = (gy - 0.5 - shiftY) / scale;
      const px = cx - tilt * cy + 0.5;
      const py = cy + 0.5;

      let minDist = Infinity;
      for (const [x1, y1, x2, y2] of segments) {
        const d = distPointToSegment(px, py, x1, y1, x2, y2);
        if (d < minDist) minDist = d;
      }
      // Smooth Gaussian stroke kernel
      let intensity = Math.exp(-(minDist * minDist) / (2 * thickness * thickness));
      if (minDist > thickness * 2.2) intensity = 0;
      if (noise > 0) {
        intensity = Math.max(0, Math.min(1, intensity + (rng() - 0.5) * noise));
      }
      grid[row * GRID_SIZE + col] = Number(intensity.toFixed(4));
    }
  }
  return grid;
}

export interface DatasetSample {
  input: number[];
  labelIndex: number;
  label: string;
}

export function buildGlyphDataset(
  labels: readonly string[],
  variantsPerClass: number,
  seed = 2026
): DatasetSample[] {
  const rng = createSeededRng(seed);
  const samples: DatasetSample[] = [];
  for (let idx = 0; idx < labels.length; idx++) {
    const label = labels[idx];
    // Canonical center sample
    samples.push({
      input: rasterizeGlyph(label),
      labelIndex: idx,
      label,
    });
    for (let v = 1; v < variantsPerClass; v++) {
      samples.push({
        input: rasterizeGlyph(label, {
          shiftX: (rng() - 0.5) * 0.12,
          shiftY: (rng() - 0.5) * 0.12,
          scale: 0.88 + rng() * 0.24,
          tilt: (rng() - 0.5) * 0.16,
          thickness: 0.075 + rng() * 0.03,
          noise: 0.04,
          rng,
        }),
        labelIndex: idx,
        label,
      });
    }
  }
  return samples;
}
