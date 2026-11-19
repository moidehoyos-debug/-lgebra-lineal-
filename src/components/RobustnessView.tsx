import React, { useId, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useStudio } from '../context/StudioContext';
import { createSeededRng, GRID_SIZE, rasterizeGlyph } from '../engines/alphanumericDataset';
import { Perturbation28x28Panel } from './Perturbation28x28Panel';
import { ScientificChartCard } from './charts/ScientificChartCard';
import { ScientificTooltip } from './charts/ScientificTooltip';
import { useChartPalette } from './charts/chartTheme';

function perturbGrid(
  base: number[],
  noiseStd: number,
  dropoutRate: number,
  shiftCols: number
): number[] {
  const rng = createSeededRng(909);
  const out = new Array<number>(base.length).fill(0);
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const srcC = c - shiftCols;
      let val = srcC >= 0 && srcC < GRID_SIZE ? base[r * GRID_SIZE + srcC] : 0;
      if (dropoutRate > 0 && rng() < dropoutRate) val = 0;
      if (noiseStd > 0) {
        val = Math.max(0, Math.min(1, val + (rng() - 0.5) * 2 * noiseStd));
      }
      out[r * GRID_SIZE + c] = Number(val.toFixed(4));
    }
  }
  return out;
}

export const RobustnessView: React.FC = () => {
  const { suiteRef } = useStudio();
  const palette = useChartPalette();
  const uid = useId().replace(/:/g, '');
  const [labMode, setLabMode] = useState<'28x28' | '16x16'>('28x28');
  const [testGlyph, setTestGlyph] = useState('3');
  const [noiseLevel, setNoiseLevel] = useState(0.18);
  const [dropoutRate, setDropoutRate] = useState(0.12);
  const [shiftCols, setShiftCols] = useState(1);

  const isDigit = /^[0-9]$/.test(testGlyph);
  const model = isDigit ? suiteRef.current.digitsModel : suiteRef.current.lettersModel;

  const baseGrid = useMemo(() => rasterizeGlyph(testGlyph), [testGlyph]);
  const perturbedGrid = useMemo(
    () => perturbGrid(baseGrid, noiseLevel, dropoutRate, shiftCols),
    [baseGrid, noiseLevel, dropoutRate, shiftCols]
  );

  const cleanPred = useMemo(() => model.predictScores(baseGrid), [model, baseGrid]);
  const noisyPred = useMemo(() => model.predictScores(perturbedGrid), [model, perturbedGrid]);

  // Real sensitivity sweep across noise sigma from 0 to 0.5
  const sensitivityCurve = useMemo(() => {
    const levels = [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5];
    return levels.map((sigma) => {
      const g = perturbGrid(baseGrid, sigma, dropoutRate, shiftCols);
      const p = model.predictScores(g);
      const targetScore = p.allScores.find((s) => s.label === testGlyph)?.probability ?? 0;
      return {
        sigma: sigma.toFixed(2),
        targetConf: Number((targetScore * 100).toFixed(2)),
        predicted: p.topLabel,
      };
    });
  }, [baseGrid, dropoutRate, shiftCols, model, testGlyph]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            Laboratorio de Robustez y Perturbaciones
          </h1>
          <p className="text-xs text-[var(--text-muted)]">
            Evalúa la estabilidad ante desplazamientos X/Y, rotación, escala, grosor, intensidad, distorsión y ruido sobre ℝ⁷⁸⁴ (28×28) o ℝ²⁵⁶ (16×16).
          </p>
        </div>

        <div className="inline-flex items-center gap-1 p-1 rounded-xl surface-elevated self-start text-xs">
          <button
            type="button"
            onClick={() => setLabMode('28x28')}
            className={`px-3 py-1.5 rounded-lg font-medium cursor-pointer whitespace-nowrap ${
              labMode === '28x28'
                ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                : 'text-[var(--text-secondary)]'
            }`}
          >
            28×28 (784–128–10)
          </button>
          <button
            type="button"
            onClick={() => setLabMode('16x16')}
            className={`px-3 py-1.5 rounded-lg font-medium cursor-pointer whitespace-nowrap ${
              labMode === '16x16'
                ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                : 'text-[var(--text-secondary)]'
            }`}
          >
            16×16 (Curva σ VectorIA)
          </button>
        </div>
      </div>

      {labMode === '28x28' ? (
        <Perturbation28x28Panel />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 surface-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Parámetros de Perturbación
            </h2>
            <select
              value={testGlyph}
              onChange={(e) => setTestGlyph(e.target.value)}
              className="px-2.5 py-1 rounded-lg font-mono text-xs surface-elevated text-[var(--text-primary)]"
            >
              {['0', '1', '3', '7', '8', 'A', 'B', 'I', 'O', 'Q'].map((g) => (
                <option key={g} value={g}>
                  Muestra: {g}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3 text-xs">
            <label className="block space-y-1">
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Amplitud de ruido (σ)</span>
                <span className="font-mono tabular-nums">{noiseLevel.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={0.5}
                step={0.05}
                value={noiseLevel}
                onChange={(e) => setNoiseLevel(Number(e.target.value))}
                className="w-full accent-[var(--accent-primary)]"
              />
            </label>

            <label className="block space-y-1">
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Dropout de píxeles</span>
                <span className="font-mono tabular-nums">{Math.round(dropoutRate * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={0.5}
                step={0.05}
                value={dropoutRate}
                onChange={(e) => setDropoutRate(Number(e.target.value))}
                className="w-full accent-[var(--accent-primary)]"
              />
            </label>

            <label className="block space-y-1">
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Desplazamiento horizontal</span>
                <span className="font-mono tabular-nums">{shiftCols} px</span>
              </div>
              <input
                type="range"
                min={-3}
                max={3}
                step={1}
                value={shiftCols}
                onChange={(e) => setShiftCols(Number(e.target.value))}
                className="w-full accent-[var(--accent-primary)]"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="surface-elevated rounded-xl p-3 space-y-2">
              <div className="text-xs text-[var(--text-muted)]">Original</div>
              <div
                className="grid gap-px p-1.5 rounded bg-[#09090d] w-28 h-28 mx-auto"
                style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))` }}
              >
                {baseGrid.map((v, i) => (
                  <div key={i} style={{ backgroundColor: `rgba(56, 189, 248, ${Math.max(0.05, v)})` }} />
                ))}
              </div>
              <div className="text-center font-mono text-xs text-[var(--text-primary)]">
                Pred: {cleanPred.topLabel} ({(cleanPred.confidence * 100).toFixed(1)}%)
              </div>
            </div>

            <div className="surface-elevated rounded-xl p-3 space-y-2">
              <div className="text-xs text-[var(--text-muted)]">Perturbado</div>
              <div
                className="grid gap-px p-1.5 rounded bg-[#09090d] w-28 h-28 mx-auto"
                style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))` }}
              >
                {perturbedGrid.map((v, i) => (
                  <div key={i} style={{ backgroundColor: `rgba(139, 92, 246, ${Math.max(0.05, v)})` }} />
                ))}
              </div>
              <div
                className={`text-center font-mono text-xs ${
                  noisyPred.topLabel === testGlyph ? 'text-[var(--status-ok)]' : 'text-[var(--status-err)]'
                }`}
              >
                Pred: {noisyPred.topLabel} ({(noisyPred.confidence * 100).toFixed(1)}%)
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7">
          <ScientificChartCard
            title="Curva Real de Degradación de Confianza ante Ruido (σ)"
            subtitle={`Probabilidad Softmax asignada a "${testGlyph}" frente a la amplitud de ruido σ · Línea punteada = umbral 50%`}
            exportFilename={`vectoria_robustez_sigma_${testGlyph}`}
            dataTable={{
              columns: ['Ruido σ', `Confianza "${testGlyph}" (%)`, 'Predicción Top-1'],
              rows: sensitivityCurve.map((pt) => [pt.sigma, `${pt.targetConf.toFixed(2)}%`, pt.predicted]),
            }}
          >
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sensitivityCurve} margin={{ top: 12, right: 16, left: 0, bottom: 4 }}>
                  <defs>
                    <linearGradient id={`robGrad-${uid}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={palette.accentPrimary} stopOpacity={0.38} />
                      <stop offset="95%" stopColor={palette.accentPrimary} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={palette.borderHairline} vertical={false} />
                  <XAxis
                    dataKey="sigma"
                    tick={{ fill: palette.textMuted, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                    stroke={palette.borderHairline}
                  />
                  <YAxis
                    domain={[0, 100]}
                    unit="%"
                    tick={{ fill: palette.textMuted, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                    stroke={palette.borderHairline}
                    width={42}
                  />
                  <ReferenceLine
                    y={50}
                    stroke={palette.statusWarn}
                    strokeDasharray="4 4"
                  />
                  <Tooltip
                    content={
                      <ScientificTooltip
                        labelPrefix="Ruido σ = "
                        unitByKey={{ targetConf: '%' }}
                        extraMeta={(p) => `Clase predicha: "${p.predicted}"`}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="targetConf"
                    name={`Confianza "${testGlyph}"`}
                    stroke={palette.accentPrimary}
                    strokeWidth={2.5}
                    fill={`url(#robGrad-${uid})`}
                    dot={{ r: 3.5, fill: palette.accentSecondary, stroke: palette.bgCanvas, strokeWidth: 1.5 }}
                    activeDot={{ r: 5.5, fill: palette.accentSecondary }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ScientificChartCard>
        </div>
      </div>
      )}
    </div>
  );
};
