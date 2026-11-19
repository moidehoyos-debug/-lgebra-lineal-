import React, { useEffect, useMemo } from 'react';
import { Bot, Network, RotateCcw } from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import {
  DEFAULT_MNIST_PERTURB_CONFIG,
  runMnist784PerturbationComparison,
} from '../engines/mnist784Engine';
import { SoftmaxBarChart } from './charts/SoftmaxBarChart';

const render28Grid = (pixels: number[], rgba: string) => (
  <div
    className="grid p-1.5 rounded-lg bg-[#09090d] border border-[var(--border-hairline)] w-32 h-32 mx-auto"
    style={{ gridTemplateColumns: 'repeat(28, minmax(0, 1fr))' }}
  >
    {pixels.map((v, i) => (
      <div
        key={i}
        style={{ backgroundColor: `rgba(${rgba}, ${Math.max(0.03, v)})` }}
      />
    ))}
  </div>
);

export const Perturbation28x28Panel: React.FC = () => {
  const {
    mnist784Pixels,
    mnist784SourceLabel,
    loadMnist784Example,
    mnist784PerturbConfig,
    setMnist784PerturbConfig,
    sendMnist784ToTopology,
    askOmniAboutExperiment,
  } = useStudio();

  // Compute live perturbation comparison deterministically without mutating original weights/pixels
  const result = useMemo(
    () => runMnist784PerturbationComparison(mnist784Pixels, mnist784PerturbConfig),
    [mnist784Pixels, mnist784PerturbConfig]
  );

  useEffect(() => {
    // Keep config bounded safely
    if (mnist784PerturbConfig.scale < 0.65 || mnist784PerturbConfig.scale > 1.35) {
      setMnist784PerturbConfig((p) => ({
        ...p,
        scale: Math.max(0.65, Math.min(1.35, p.scale)),
      }));
    }
  }, [mnist784PerturbConfig.scale, setMnist784PerturbConfig]);

  const handleReset = () => {
    setMnist784PerturbConfig({ ...DEFAULT_MNIST_PERTURB_CONFIG });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left: Extended Perturbation Sliders */}
      <div className="lg:col-span-5 surface-card rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Perturbaciones Ampliadas 28×28 (ℝ⁷⁸⁴)
            </h2>
            <p className="text-[11px] text-[var(--text-muted)]">
              Origen activo: {mnist784SourceLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restablecer
          </button>
        </div>

        {/* Quick Digit Switcher */}
        <div className="space-y-1">
          <div className="text-[11px] text-[var(--text-muted)]">
            Cargar ejemplo sintético 0–9 (o usa tu trazo del Clasificador):
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 10 }, (_, d) => (
              <button
                key={d}
                type="button"
                onClick={() => loadMnist784Example(d)}
                className="w-7 h-7 rounded-md font-mono text-xs font-semibold border border-[var(--border-hairline)] surface-elevated hover:border-[var(--accent-primary)] text-[var(--text-primary)] cursor-pointer"
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 text-xs pt-1">
          <label className="block space-y-1">
            <div className="flex justify-between">
              <span className="text-[var(--text-secondary)]">Desplazamiento X [-6, +6 px]</span>
              <span className="font-mono tabular-nums">
                {mnist784PerturbConfig.shiftX > 0 ? `+${mnist784PerturbConfig.shiftX}` : mnist784PerturbConfig.shiftX} px
              </span>
            </div>
            <input
              type="range"
              min={-6}
              max={6}
              step={1}
              value={mnist784PerturbConfig.shiftX}
              onChange={(e) =>
                setMnist784PerturbConfig((p) => ({ ...p, shiftX: Number(e.target.value) }))
              }
              className="w-full accent-[var(--accent-primary)]"
            />
          </label>

          <label className="block space-y-1">
            <div className="flex justify-between">
              <span className="text-[var(--text-secondary)]">Desplazamiento Y [-6, +6 px]</span>
              <span className="font-mono tabular-nums">
                {mnist784PerturbConfig.shiftY > 0 ? `+${mnist784PerturbConfig.shiftY}` : mnist784PerturbConfig.shiftY} px
              </span>
            </div>
            <input
              type="range"
              min={-6}
              max={6}
              step={1}
              value={mnist784PerturbConfig.shiftY}
              onChange={(e) =>
                setMnist784PerturbConfig((p) => ({ ...p, shiftY: Number(e.target.value) }))
              }
              className="w-full accent-[var(--accent-primary)]"
            />
          </label>

          <label className="block space-y-1">
            <div className="flex justify-between">
              <span className="text-[var(--text-secondary)]">Rotación [-30°, +30°]</span>
              <span className="font-mono tabular-nums">{mnist784PerturbConfig.rotationDeg}°</span>
            </div>
            <input
              type="range"
              min={-30}
              max={30}
              step={2}
              value={mnist784PerturbConfig.rotationDeg}
              onChange={(e) =>
                setMnist784PerturbConfig((p) => ({ ...p, rotationDeg: Number(e.target.value) }))
              }
              className="w-full accent-[var(--accent-primary)]"
            />
          </label>

          <label className="block space-y-1">
            <div className="flex justify-between">
              <span className="text-[var(--text-secondary)]">Escalamiento [0.65×, 1.35×]</span>
              <span className="font-mono tabular-nums">{mnist784PerturbConfig.scale.toFixed(2)}×</span>
            </div>
            <input
              type="range"
              min={0.65}
              max={1.35}
              step={0.05}
              value={mnist784PerturbConfig.scale}
              onChange={(e) =>
                setMnist784PerturbConfig((p) => ({ ...p, scale: Number(e.target.value) }))
              }
              className="w-full accent-[var(--accent-primary)]"
            />
          </label>

          <label className="block space-y-1">
            <div className="flex justify-between">
              <span className="text-[var(--text-secondary)]">
                Variación de grosor (Erosión / Dilatación)
              </span>
              <span className="font-mono tabular-nums">
                {mnist784PerturbConfig.thickness > 0
                  ? `+${mnist784PerturbConfig.thickness.toFixed(2)}`
                  : mnist784PerturbConfig.thickness.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min={-1}
              max={1}
              step={0.1}
              value={mnist784PerturbConfig.thickness}
              onChange={(e) =>
                setMnist784PerturbConfig((p) => ({ ...p, thickness: Number(e.target.value) }))
              }
              className="w-full accent-[var(--accent-primary)]"
            />
          </label>

          <label className="block space-y-1">
            <div className="flex justify-between">
              <span className="text-[var(--text-secondary)]">Intensidad / Contraste [0.4×, 1.5×]</span>
              <span className="font-mono tabular-nums">
                {mnist784PerturbConfig.intensity.toFixed(2)}×
              </span>
            </div>
            <input
              type="range"
              min={0.4}
              max={1.5}
              step={0.05}
              value={mnist784PerturbConfig.intensity}
              onChange={(e) =>
                setMnist784PerturbConfig((p) => ({ ...p, intensity: Number(e.target.value) }))
              }
              className="w-full accent-[var(--accent-primary)]"
            />
          </label>

          <label className="block space-y-1">
            <div className="flex justify-between">
              <span className="text-[var(--text-secondary)]">Distorsión geométrica [0%, 100%]</span>
              <span className="font-mono tabular-nums">
                {Math.round(mnist784PerturbConfig.distortion * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={mnist784PerturbConfig.distortion}
              onChange={(e) =>
                setMnist784PerturbConfig((p) => ({ ...p, distortion: Number(e.target.value) }))
              }
              className="w-full accent-[var(--accent-primary)]"
            />
          </label>

          <label className="block space-y-1">
            <div className="flex justify-between">
              <span className="text-[var(--text-secondary)]">Nivel de ruido [0%, 60%]</span>
              <span className="font-mono tabular-nums">
                {Math.round(mnist784PerturbConfig.noiseLevel * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={0.6}
              step={0.02}
              value={mnist784PerturbConfig.noiseLevel}
              onChange={(e) =>
                setMnist784PerturbConfig((p) => ({ ...p, noiseLevel: Number(e.target.value) }))
              }
              className="w-full accent-[var(--accent-primary)]"
            />
          </label>
        </div>
      </div>

      {/* Right: Original vs Perturbed Comparison & Softmax Delta */}
      <div className="lg:col-span-7 space-y-5">
        <div className="surface-card rounded-2xl p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="surface-elevated rounded-xl p-4 space-y-2 text-center">
              <div className="text-xs text-[var(--text-muted)]">Imagen Original 28×28</div>
              {render28Grid(result.originalPixels, '56, 189, 248')}
              <div className="font-mono font-bold text-lg text-[var(--text-primary)]">
                Clase {result.before.digit} · {(result.before.confidence * 100).toFixed(2)}%
              </div>
              <div className="text-[11px] font-mono text-[var(--text-muted)]">
                Entropía: {result.before.entropy.toFixed(3)} bits · ReLU: {result.before.activeNeurons}/128
              </div>
            </div>

            <div className="surface-elevated rounded-xl p-4 space-y-2 text-center">
              <div className="text-xs text-[var(--text-muted)]">Imagen Modificada 28×28</div>
              {render28Grid(result.perturbedPixels, '139, 92, 246')}
              <div
                className={`font-mono font-bold text-lg ${
                  result.changedClass ? 'text-[var(--status-err)]' : 'text-[var(--status-ok)]'
                }`}
              >
                Clase {result.after.digit} · {(result.after.confidence * 100).toFixed(2)}%
              </div>
              <div className="text-[11px] font-mono text-[var(--text-muted)]">
                Δ confianza: {result.confidenceDeltaPct >= 0 ? '+' : ''}
                {result.confidenceDeltaPct.toFixed(2)} pts ·{' '}
                {result.changedClass ? 'CAMBIO DE CLASE' : 'Clase estable'}
              </div>
            </div>
          </div>

          <SoftmaxBarChart
            title="Distribución Softmax: Original vs Modificada (784–128–10)"
            subtitle="Comparación directa de probabilidades y deltas por dígito"
            data={result.softmaxComparison.map((r) => ({
              label: r.digit,
              prob: r.afterPct,
              beforePct: r.beforePct,
              afterPct: r.afterPct,
            }))}
            mode="compare"
            exportFilename="vectoria_perturbacion_28x28_softmax"
            heightClass="h-52"
          />

          {/* Difference Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono tabular-nums">
              <thead>
                <tr className="border-b border-[var(--border-hairline)] text-[var(--text-muted)]">
                  <th className="py-1.5 text-left font-sans">Dígito</th>
                  <th className="py-1.5 text-right font-sans">Original (%)</th>
                  <th className="py-1.5 text-right font-sans">Modificada (%)</th>
                  <th className="py-1.5 text-right font-sans">Diferencia (Δ pts)</th>
                </tr>
              </thead>
              <tbody>
                {result.softmaxComparison.map((row) => (
                  <tr
                    key={row.digit}
                    className="border-b border-[var(--border-hairline)] last:border-none"
                  >
                    <td className="py-1 font-bold text-[var(--accent-primary)]">{row.digit}</td>
                    <td className="py-1 text-right">{row.beforePct.toFixed(2)}%</td>
                    <td className="py-1 text-right">{row.afterPct.toFixed(2)}%</td>
                    <td
                      className={`py-1 text-right ${
                        Math.abs(row.deltaPct) < 0.05
                          ? 'text-[var(--text-muted)]'
                          : row.deltaPct > 0
                            ? 'text-[var(--status-ok)]'
                            : 'text-[var(--status-warn)]'
                      }`}
                    >
                      {row.deltaPct >= 0 ? '+' : ''}
                      {row.deltaPct.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cross-module bridge actions */}
          <div className="pt-2 border-t border-[var(--border-hairline)] flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => sendMnist784ToTopology(result.perturbedPixels)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[var(--accent-primary)] text-[var(--accent-contrast)] cursor-pointer whitespace-nowrap"
            >
              <Network className="w-3.5 h-3.5" />
              Enviar 28×28 perturbado a Topología
            </button>
            <button
              type="button"
              onClick={() =>
                askOmniAboutExperiment(
                  `Perturbación 28×28 sobre "${mnist784SourceLabel}" (Δx=${mnist784PerturbConfig.shiftX}px, Δy=${mnist784PerturbConfig.shiftY}px, rot=${mnist784PerturbConfig.rotationDeg}°, escala=${mnist784PerturbConfig.scale}×, grosor=${mnist784PerturbConfig.thickness}, ruido=${Math.round(mnist784PerturbConfig.noiseLevel * 100)}%):\n- Original: dígito ${result.before.digit} (${(result.before.confidence * 100).toFixed(2)}%)\n- Modificada: dígito ${result.after.digit} (${(result.after.confidence * 100).toFixed(2)}%)\n- Diferencia de confianza: ${result.confidenceDeltaPct} pts`
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-[var(--border-strong)] surface-elevated text-[var(--text-primary)] cursor-pointer whitespace-nowrap"
            >
              <Bot className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              Analizar sensibilidad con Omni Bot
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
