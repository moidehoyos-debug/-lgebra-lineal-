import { BuilderDataSourceKey } from '../types/builder';
import {
  MathOperationOutput,
  ModelEvaluationSummary,
  PredictionRecord,
  SimulationRunRecord,
} from '../types/vectoria';
import { getMnist784Meta } from '../engines/mnist784Engine';

export interface ResolvedChartDataset {
  rows: Array<Record<string, string | number>>;
  xKey: string;
  availableSeries: Array<{ key: string; label: string; defaultColor: string }>;
  confusionMatrix?: {
    labels: string[];
    matrix: number[][];
  };
  heatmapMatrix?: {
    rowLabels: string[];
    colLabels: string[];
    matrix: number[][];
  };
  emptyReason?: string;
}

export interface StudioChartSnapshotInput {
  digitsSummary: ModelEvaluationSummary;
  lettersSummary: ModelEvaluationSummary;
  alphanumericSummary: ModelEvaluationSummary;
  lastPrediction: PredictionRecord | null;
  predictionHistory: PredictionRecord[];
  simulationHistory: SimulationRunRecord[];
  lastMathOutput: MathOperationOutput | null;
}

export function resolveRealChartDataset(
  source: BuilderDataSourceKey,
  studio: StudioChartSnapshotInput
): ResolvedChartDataset {
  switch (source) {
    case 'models-comparison': {
      const meta784 = getMnist784Meta();
      return {
        xKey: 'model',
        availableSeries: [
          { key: 'valPct', label: 'Validación (%)', defaultColor: 'var(--chart-1)' },
          { key: 'trainPct', label: 'Entrenamiento (%)', defaultColor: 'var(--chart-2)' },
          { key: 'lossScaled', label: 'Loss × 100', defaultColor: 'var(--chart-4)' },
        ],
        rows: [
          {
            model: 'Dígitos 0–9',
            valPct: Number((studio.digitsSummary.valAccuracy * 100).toFixed(1)),
            trainPct: Number((studio.digitsSummary.trainAccuracy * 100).toFixed(1)),
            lossScaled: Number((studio.digitsSummary.finalLoss * 100).toFixed(1)),
          },
          {
            model: 'Letras A–Z',
            valPct: Number((studio.lettersSummary.valAccuracy * 100).toFixed(1)),
            trainPct: Number((studio.lettersSummary.trainAccuracy * 100).toFixed(1)),
            lossScaled: Number((studio.lettersSummary.finalLoss * 100).toFixed(1)),
          },
          {
            model: 'Combinado 36',
            valPct: Number((studio.alphanumericSummary.valAccuracy * 100).toFixed(1)),
            trainPct: Number((studio.alphanumericSummary.trainAccuracy * 100).toFixed(1)),
            lossScaled: Number((studio.alphanumericSummary.finalLoss * 100).toFixed(1)),
          },
          {
            model: 'MNIST 784',
            valPct: Number((meta784.evaluacion.exactitud * 100).toFixed(1)),
            trainPct: Number((meta784.evaluacion.exactitud * 100).toFixed(1)),
            lossScaled: 0,
          },
        ],
      };
    }

    case 'training-digits':
    case 'training-letters':
    case 'training-alphanumeric': {
      const summary =
        source === 'training-digits'
          ? studio.digitsSummary
          : source === 'training-letters'
            ? studio.lettersSummary
            : studio.alphanumericSummary;
      return {
        xKey: 'epoch',
        availableSeries: [
          { key: 'valAccuracyPct', label: 'Val (%)', defaultColor: 'var(--chart-3)' },
          { key: 'accuracyPct', label: 'Train (%)', defaultColor: 'var(--chart-2)' },
          { key: 'loss', label: 'Loss CE', defaultColor: 'var(--chart-1)' },
        ],
        rows: summary.history.map((h) => ({
          epoch: h.epoch,
          valAccuracyPct: Number((h.valAccuracy * 100).toFixed(2)),
          accuracyPct: Number((h.accuracy * 100).toFixed(2)),
          loss: Number(h.loss.toFixed(4)),
        })),
        emptyReason:
          summary.history.length === 0
            ? 'Entrena el modelo seleccionado para generar curvas por época.'
            : undefined,
      };
    }

    case 'softmax-last': {
      const scores = studio.lastPrediction?.topScores ?? [];
      return {
        xKey: 'label',
        availableSeries: [
          { key: 'probPct', label: 'Probabilidad (%)', defaultColor: 'var(--chart-2)' },
          { key: 'logit', label: 'Logit z', defaultColor: 'var(--chart-4)' },
        ],
        rows: scores.slice(0, 12).map((s) => ({
          label: s.label,
          probPct: Number((s.probability * 100).toFixed(2)),
          logit: Number(s.logit.toFixed(3)),
        })),
        emptyReason:
          scores.length === 0 ? 'Ejecuta una clasificación en el Clasificador para poblar Softmax.' : undefined,
      };
    }

    case 'prediction-timeline': {
      const recent = [...studio.predictionHistory].slice(0, 20).reverse();
      return {
        xKey: 'idx',
        availableSeries: [
          { key: 'confidencePct', label: 'Confianza (%)', defaultColor: 'var(--chart-1)' },
          { key: 'entropy', label: 'Entropía H(p)', defaultColor: 'var(--chart-3)' },
        ],
        rows: recent.map((p, i) => ({
          idx: `${i + 1} (${p.topLabel})`,
          confidencePct: Number((p.confidence * 100).toFixed(1)),
          entropy: Number(p.entropy.toFixed(3)),
        })),
        emptyReason:
          recent.length === 0 ? 'No hay inferencias registradas aún en esta sesión.' : undefined,
      };
    }

    case 'confusion-matrix': {
      const summary = studio.alphanumericSummary.isTrained
        ? studio.alphanumericSummary
        : studio.digitsSummary;
      const limit = Math.min(10, summary.labels.length);
      const labels = summary.labels.slice(0, limit);
      const matrix = summary.confusionMatrix.slice(0, limit).map((row) => row.slice(0, limit));
      const diagRows = labels.map((lbl, idx) => ({
        clase: lbl,
        aciertos: matrix[idx]?.[idx] ?? 0,
        total: (matrix[idx] ?? []).reduce((a, b) => a + b, 0),
      }));
      return {
        xKey: 'clase',
        availableSeries: [
          { key: 'aciertos', label: 'Aciertos', defaultColor: 'var(--chart-3)' },
          { key: 'total', label: 'Muestras', defaultColor: 'var(--chart-1)' },
        ],
        rows: diagRows,
        confusionMatrix: { labels, matrix },
      };
    }

    case 'simulation-history': {
      const runs = [...studio.simulationHistory].slice(0, 15).reverse();
      return {
        xKey: 'run',
        availableSeries: [
          { key: 'durationMs', label: 'Duración (ms)', defaultColor: 'var(--chart-2)' },
          { key: 'noisePct', label: 'Ruido (%)', defaultColor: 'var(--chart-4)' },
        ],
        rows: runs.map((r, i) => ({
          run: `#${i + 1}`,
          durationMs: Number(r.durationMs.toFixed(2)),
          noisePct: Number((r.config.noiseLevel * 100).toFixed(1)),
        })),
        emptyReason:
          runs.length === 0
            ? 'Ejecuta experimentos en Simulation Lab para visualizar su serie real.'
            : undefined,
      };
    }

    case 'eigen-spectrum': {
      const summary = studio.digitsSummary;
      const binCounts = [0, 0, 0, 0, 0];
      for (const h of summary.history) {
        const idx = Math.min(4, Math.floor(h.valAccuracy * 5));
        binCounts[idx] += 1;
      }
      return {
        xKey: 'rango',
        availableSeries: [
          { key: 'frecuencia', label: 'Épocas', defaultColor: 'var(--chart-1)' },
        ],
        rows: [
          { rango: '0–20%', frecuencia: binCounts[0] },
          { rango: '20–40%', frecuencia: binCounts[1] },
          { rango: '40–60%', frecuencia: binCounts[2] },
          { rango: '60–80%', frecuencia: binCounts[3] },
          { rango: '80–100%', frecuencia: binCounts[4] },
        ],
        heatmapMatrix: {
          rowLabels: ['Dígitos', 'Letras', 'Comb.36'],
          colLabels: ['Train%', 'Val%', 'Loss'],
          matrix: [
            [
              Math.round(studio.digitsSummary.trainAccuracy * 100),
              Math.round(studio.digitsSummary.valAccuracy * 100),
              Math.round(studio.digitsSummary.finalLoss * 100),
            ],
            [
              Math.round(studio.lettersSummary.trainAccuracy * 100),
              Math.round(studio.lettersSummary.valAccuracy * 100),
              Math.round(studio.lettersSummary.finalLoss * 100),
            ],
            [
              Math.round(studio.alphanumericSummary.trainAccuracy * 100),
              Math.round(studio.alphanumericSummary.valAccuracy * 100),
              Math.round(studio.alphanumericSummary.finalLoss * 100),
            ],
          ],
        },
      };
    }
  }
}
