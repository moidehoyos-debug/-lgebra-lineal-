import React, { useMemo, useState } from 'react';
import { AlertTriangle, Eye, Grid3X3, Info, Network } from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { GRID_SIZE } from '../engines/alphanumericDataset';
import { SoftmaxBarChart } from './charts/SoftmaxBarChart';
import { useChartPalette } from './charts/chartTheme';

export const XaiView: React.FC = () => {
  const {
    suiteRef,
    classifierMode,
    setClassifierMode,
    currentInputGrid,
    loadSampleGlyph,
    alphanumericSummary,
    setActiveModule,
  } = useStudio();

  const palette = useChartPalette();
  const [hoveredPixel, setHoveredPixel] = useState<number | null>(null);
  const suite = suiteRef.current;
  const effectiveMode =
    classifierMode === 'alphanumeric' && !alphanumericSummary.isTrained
      ? 'digits'
      : classifierMode;

  const model =
    effectiveMode === 'digits'
      ? suite.digitsModel
      : effectiveMode === 'letters'
        ? suite.lettersModel
        : suite.alphanumericModel;

  const xai = useMemo(
    () => model.explainInputGradientXai(currentInputGrid),
    [model, currentInputGrid]
  );

  const pred = useMemo(
    () => model.predictScores(currentInputGrid),
    [model, currentInputGrid]
  );

  const softmaxData = pred.topScores.map((s, idx) => ({
    label: s.label,
    prob: Number((s.probability * 100).toFixed(2)),
    logit: Number(s.logit.toFixed(3)),
    isTop: idx === 0,
  }));

  const quickGlyphs = [
    { ch: '0', mode: 'digits' as const },
    { ch: '1', mode: 'digits' as const },
    { ch: '3', mode: 'digits' as const },
    { ch: '8', mode: 'digits' as const },
    { ch: 'O', mode: 'letters' as const },
    { ch: 'I', mode: 'letters' as const },
    { ch: 'B', mode: 'letters' as const },
    { ch: 'Q', mode: 'letters' as const },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            IA Explicable (XAI) y Mapas de Saliencia
          </h1>
          <p className="text-xs text-[var(--text-muted)]">
            Atribución analítica real por gradiente × entrada (|∂z_top/∂x · x|), neuronas ocultas más activas y análisis de márgenes Softmax.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveModule('classifier')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium surface-elevated border border-[var(--border-hairline)] text-[var(--text-primary)] cursor-pointer"
          >
            <Grid3X3 className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            Dibujar en Clasificador
          </button>
          <button
            type="button"
            onClick={() => setActiveModule('topology')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium surface-elevated border border-[var(--border-hairline)] text-[var(--text-primary)] cursor-pointer"
          >
            <Network className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
            Ver Topología
          </button>
        </div>
      </div>

      {/* Epistemic Notice */}
      <div className="surface-card rounded-2xl p-4 flex items-start gap-3 text-xs border border-[var(--border-strong)]">
        <Info className="w-4 h-4 text-[var(--accent-primary)] shrink-0 mt-0.5" />
        <div className="text-[var(--text-secondary)] leading-relaxed">
          <strong className="text-[var(--text-primary)]">Nota metodológica XAI:</strong> El mapa de saliencia muestra la sensibilidad lineal local exacta <span className="font-mono">|∂z_top/∂x_ij · x_ij|</span> mediante retropropagación hasta la entrada. Indica qué píxeles influyeron más en el logit actual, pero no constituye una prueba causal ni razonamiento semántico humano.
        </div>
      </div>

      {/* Quick sample switcher + mode indicator */}
      <div className="surface-card rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[var(--text-muted)]">Probar caracteres críticos:</span>
          {quickGlyphs.map((item) => (
            <button
              key={item.ch}
              type="button"
              onClick={() => {
                setClassifierMode(item.mode);
                loadSampleGlyph(item.ch, item.mode);
              }}
              className="px-2.5 py-1 rounded-lg font-mono font-semibold surface-elevated border border-[var(--border-hairline)] hover:border-[var(--accent-primary)] text-[var(--text-primary)] cursor-pointer"
            >
              {item.ch} ({item.mode === 'digits' ? '0–9' : 'A–Z'})
            </button>
          ))}
        </div>
        <span className="font-mono text-[var(--text-muted)]">
          Modelo activo: {effectiveMode === 'digits' ? 'Dígitos (0–9)' : effectiveMode === 'letters' ? 'Letras (A–Z)' : 'Alfanumérico (36)'}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Input vs Saliency Heatmap */}
        <div className="lg:col-span-5 surface-card rounded-2xl p-5 space-y-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
            <Eye className="w-4 h-4 text-[var(--accent-primary)]" />
            <span>Entrada ℝ²⁵⁶ vs Mapa de Saliencia (Gradiente × Entrada)</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-xs text-[var(--text-muted)]">Entrada 16×16</div>
              <div
                className="grid gap-px p-2 rounded-xl bg-[#09090d] border border-[var(--border-hairline)] aspect-square"
                style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))` }}
              >
                {currentInputGrid.map((val, idx) => (
                  <div
                    key={idx}
                    onMouseEnter={() => setHoveredPixel(idx)}
                    onMouseLeave={() => setHoveredPixel(null)}
                    style={{
                      backgroundColor: palette.accentSecondary,
                      opacity: Math.max(0.08, val),
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs text-[var(--text-muted)]">Saliencia |∂z/∂x · x|</div>
              <div
                className="grid gap-px p-2 rounded-xl bg-[#09090d] border border-[var(--border-hairline)] aspect-square"
                style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))` }}
              >
                {xai.saliencyGrid.map((val, idx) => (
                  <div
                    key={idx}
                    onMouseEnter={() => setHoveredPixel(idx)}
                    onMouseLeave={() => setHoveredPixel(null)}
                    title={`Pixel (${Math.floor(idx / GRID_SIZE)}, ${idx % GRID_SIZE}): saliencia ${(val * 100).toFixed(1)}%`}
                    style={{
                      backgroundColor: val > 0.55 ? palette.chart4 : palette.accentPrimary,
                      opacity: Math.max(0.08, val),
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-[var(--text-muted)]">
            <div className="flex items-center gap-2">
              <span>0%</span>
              <div
                className="h-2 w-24 rounded-full border border-[var(--border-hairline)]"
                style={{
                  background: `linear-gradient(90deg, ${palette.bgElevated}, ${palette.accentPrimary}, ${palette.chart4})`,
                }}
              />
              <span>100%</span>
            </div>
            <span>
              {hoveredPixel !== null
                ? `(${Math.floor(hoveredPixel / GRID_SIZE)},${hoveredPixel % GRID_SIZE}) x=${currentInputGrid[hoveredPixel].toFixed(2)} · sal=${(xai.saliencyGrid[hoveredPixel] * 100).toFixed(1)}%`
                : 'Pasa el cursor sobre un píxel'}
            </span>
          </div>

          <div className="surface-elevated rounded-xl p-4 space-y-2 text-xs">
            <div className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
              <AlertTriangle className="w-4 h-4 text-[var(--status-warn)] shrink-0" />
              <span>Diagnóstico de Decisión y Ambigüedad</span>
            </div>
            <p className="text-[var(--text-secondary)] leading-relaxed">{xai.ambiguityNote}</p>
            <div className="grid grid-cols-3 gap-2 pt-2 font-mono tabular-nums">
              <div>
                <div className="text-[11px] text-[var(--text-muted)]">Top-1</div>
                <div className="font-bold text-[var(--accent-primary)]">{xai.topLabel}</div>
              </div>
              <div>
                <div className="text-[11px] text-[var(--text-muted)]">Top-2</div>
                <div className="font-bold text-[var(--accent-secondary)]">{xai.secondLabel}</div>
              </div>
              <div>
                <div className="text-[11px] text-[var(--text-muted)]">Margen p₁−p₂</div>
                <div className="font-bold text-[var(--text-primary)]">
                  {(xai.confidenceMargin * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Softmax & Active Neurons */}
        <div className="lg:col-span-7 space-y-5">
          <SoftmaxBarChart
            title={`Distribución Softmax de Candidatos (Entropía: ${xai.entropy.toFixed(3)} bits)`}
            subtitle="Probabilidades reales y logits analíticos de las 6 clases principales"
            data={softmaxData}
            layout="horizontal"
            mode="single"
            classCount={model.labels.length}
            exportFilename={`vectoria_xai_softmax_${xai.topLabel}`}
            heightClass="h-56"
            onSelectLabel={(lbl) => loadSampleGlyph(lbl, effectiveMode)}
          />

          <div className="surface-card rounded-2xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Neuronas Ocultas ReLU con Mayor Activación
            </h2>
            <div className="space-y-2.5 text-xs">
              {xai.topHiddenNeurons.map((n, idx) => {
                const maxAct = Math.max(0.1, xai.topHiddenNeurons[0]?.activation ?? 1);
                const pct = Math.min(100, Math.round((n.activation / maxAct) * 100));
                return (
                  <div key={`${n.layer}-${n.neuronIndex}-${idx}`} className="space-y-1">
                    <div className="flex justify-between font-mono tabular-nums">
                      <span className="text-[var(--text-secondary)]">
                        {n.layer} · Neurona #{n.neuronIndex}
                      </span>
                      <span className="text-[var(--accent-secondary)]">
                        a = {n.activation.toFixed(4)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[var(--accent-secondary)]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
