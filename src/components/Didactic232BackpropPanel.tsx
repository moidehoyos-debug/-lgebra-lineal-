import React, { useState } from 'react';
import { ArrowDownUp, CheckCircle2, Lock, Play, RotateCcw } from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import {
  createDefaultDidactic232Config,
  forwardDidactic232,
  stepDidactic232,
} from '../engines/mnist784Engine';
import { Didactic232Config, Didactic232StepResult } from '../types/vectoria';
import { LossAccuracyChart } from './charts/LossAccuracyChart';

export const Didactic232BackpropPanel: React.FC = () => {
  const { setLast232Step } = useStudio();
  const [cfg, setCfg] = useState<Didactic232Config>(() => createDefaultDidactic232Config());
  const [lastStep, setLastStep] = useState<Didactic232StepResult | null>(null);
  const [lossHistory, setLossHistory] = useState<
    Array<{ step: number; loss: number; probTarget: number }>
  >([]);

  const liveForward = forwardDidactic232(
    cfg.x,
    cfg.W1,
    cfg.b1,
    cfg.W2,
    cfg.b2,
    cfg.yTargetIndex
  );

  const runSteps = (count: number) => {
    let cur = cfg;
    let latest: Didactic232StepResult | null = null;
    const baseIdx = lossHistory.length;
    const pts: Array<{ step: number; loss: number; probTarget: number }> = [];

    for (let i = 0; i < count; i++) {
      latest = stepDidactic232(cur);
      cur = latest.updatedConfig;
      pts.push({
        step: baseIdx + i + 1,
        loss: Number(latest.lossAfter.toFixed(6)),
        probTarget: Number((latest.probsAfter[cur.yTargetIndex] * 100).toFixed(2)),
      });
    }

    setCfg(cur);
    if (latest) {
      setLastStep(latest);
      setLast232Step(latest);
      setLossHistory((prev) => [...prev, ...pts].slice(-60));
    }
  };

  const handleReset = () => {
    setCfg(createDefaultDidactic232Config());
    setLastStep(null);
    setLast232Step(null);
    setLossHistory([]);
  };

  return (
    <div className="space-y-5">
      {/* Architecture & Isolation Banner */}
      <div className="surface-card rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1 text-xs">
          <div className="font-semibold text-[var(--text-primary)]">
            Simulador Independiente de Retropropagación 2–3–2 (Red Didáctica del HTML Original)
          </div>
          <p className="text-[var(--text-secondary)]">
            2 entradas (x₁, x₂) → 3 neuronas ocultas ReLU → 2 salidas Softmax. Edita libremente pesos, sesgos y entrada sin alterar el modelo 784–128–10 ni los clasificadores 16×16.
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg surface-elevated text-xs text-[var(--status-ok)] shrink-0">
          <Lock className="w-3.5 h-3.5" />
          <span>Red 2–3–2 Aislada</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Editable Inputs, Weights, Biases */}
        <div className="lg:col-span-5 surface-card rounded-2xl p-5 space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Parámetros Editables (2–3–2)
            </h3>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reiniciar pesos
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {cfg.x.map((val, idx) => (
              <label key={idx} className="space-y-1">
                <span className="text-[var(--text-muted)] font-mono">x{idx + 1}</span>
                <input
                  type="number"
                  step={0.1}
                  value={val}
                  onChange={(e) => {
                    const nextX = [...cfg.x] as [number, number];
                    nextX[idx] = Number(e.target.value) || 0;
                    setCfg((c) => ({ ...c, x: nextX }));
                  }}
                  className="w-full px-2 py-1.5 rounded-lg font-mono surface-elevated text-[var(--text-primary)]"
                />
              </label>
            ))}

            <label className="space-y-1">
              <span className="text-[var(--text-muted)]">Objetivo y</span>
              <select
                value={cfg.yTargetIndex}
                onChange={(e) =>
                  setCfg((c) => ({ ...c, yTargetIndex: Number(e.target.value) as 0 | 1 }))
                }
                className="w-full px-2 py-1.5 rounded-lg font-mono surface-elevated text-[var(--text-primary)]"
              >
                <option value={0}>Clase 0 [1,0]</option>
                <option value={1}>Clase 1 [0,1]</option>
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-[var(--text-muted)]">η (0–0.5]</span>
              <input
                type="number"
                min={0.005}
                max={0.5}
                step={0.05}
                value={cfg.learningRate}
                onChange={(e) =>
                  setCfg((c) => ({
                    ...c,
                    learningRate: Math.max(0.005, Math.min(0.5, Number(e.target.value) || 0.1)),
                  }))
                }
                className="w-full px-2 py-1.5 rounded-lg font-mono surface-elevated text-[var(--text-primary)]"
              />
            </label>
          </div>

          {/* W1 (2x3) + b1 (3) */}
          <div className="space-y-1.5">
            <div className="font-semibold text-[var(--text-secondary)]">
              Pesos Entrada → Oculta W₁ (2×3)
            </div>
            {cfg.W1.map((row, i) => (
              <div key={i} className="grid grid-cols-3 gap-2">
                {row.map((w, j) => (
                  <input
                    key={j}
                    type="number"
                    step={0.05}
                    value={Number(w.toFixed(4))}
                    onChange={(e) => {
                      const W1 = cfg.W1.map((r) => [...r]) as Didactic232Config['W1'];
                      W1[i][j] = Number(e.target.value) || 0;
                      setCfg((c) => ({ ...c, W1 }));
                    }}
                    aria-label={`W1[${i},${j}]`}
                    className="px-2 py-1.5 rounded-lg font-mono surface-elevated text-[var(--text-primary)]"
                  />
                ))}
              </div>
            ))}
            <div className="text-[11px] text-[var(--text-muted)] pt-1">Sesgos b₁ (3 neuronas)</div>
            <div className="grid grid-cols-3 gap-2">
              {cfg.b1.map((b, j) => (
                <input
                  key={j}
                  type="number"
                  step={0.05}
                  value={Number(b.toFixed(4))}
                  onChange={(e) => {
                    const b1 = [...cfg.b1] as [number, number, number];
                    b1[j] = Number(e.target.value) || 0;
                    setCfg((c) => ({ ...c, b1 }));
                  }}
                  aria-label={`b1[${j}]`}
                  className="px-2 py-1.5 rounded-lg font-mono surface-elevated text-[var(--accent-primary)]"
                />
              ))}
            </div>
          </div>

          {/* W2 (3x2) + b2 (2) */}
          <div className="space-y-1.5">
            <div className="font-semibold text-[var(--text-secondary)]">
              Pesos Oculta → Salida W₂ (3×2) y sesgos b₂
            </div>
            {cfg.W2.map((row, j) => (
              <div key={j} className="grid grid-cols-2 gap-2">
                {row.map((w, k) => (
                  <input
                    key={k}
                    type="number"
                    step={0.05}
                    value={Number(w.toFixed(4))}
                    onChange={(e) => {
                      const W2 = cfg.W2.map((r) => [...r]) as Didactic232Config['W2'];
                      W2[j][k] = Number(e.target.value) || 0;
                      setCfg((c) => ({ ...c, W2 }));
                    }}
                    aria-label={`W2[${j},${k}]`}
                    className="px-2 py-1.5 rounded-lg font-mono surface-elevated text-[var(--text-primary)]"
                  />
                ))}
              </div>
            ))}
            <div className="grid grid-cols-2 gap-2 pt-1">
              {cfg.b2.map((b, k) => (
                <input
                  key={k}
                  type="number"
                  step={0.05}
                  value={Number(b.toFixed(4))}
                  onChange={(e) => {
                    const b2 = [...cfg.b2] as [number, number];
                    b2[k] = Number(e.target.value) || 0;
                    setCfg((c) => ({ ...c, b2 }));
                  }}
                  aria-label={`b2[${k}]`}
                  className="px-2 py-1.5 rounded-lg font-mono surface-elevated text-[var(--accent-secondary)]"
                />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              onClick={() => runSteps(1)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg font-semibold bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-contrast)] cursor-pointer whitespace-nowrap"
            >
              <ArrowDownUp className="w-3.5 h-3.5" />
              1 Paso Backprop
            </button>
            <button
              type="button"
              onClick={() => runSteps(10)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg font-semibold surface-elevated border border-[var(--border-strong)] text-[var(--text-primary)] hover:border-[var(--accent-primary)] cursor-pointer whitespace-nowrap"
            >
              <Play className="w-3.5 h-3.5" />
              +10 Pasos
            </button>
          </div>
        </div>

        {/* Right: Step-by-step Activations, Analytical vs Finite-Diff Gradients, Loss Comparison */}
        <div className="lg:col-span-7 space-y-5">
          {/* Live Forward State */}
          <div className="surface-card rounded-2xl p-5 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Estado Forward Actual (Sin necesidad de paso previo)
              </h3>
              <span className="font-mono tabular-nums text-[var(--accent-primary)]">
                L = −log(p[{cfg.yTargetIndex}]) = {liveForward.loss.toFixed(6)}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono tabular-nums">
              <div className="surface-elevated rounded-xl p-3">
                <div className="font-sans text-[var(--text-muted)] mb-1">z₁ = W₁ᵀx + b₁</div>
                <div>[{liveForward.z1.map((v) => v.toFixed(4)).join(', ')}]</div>
              </div>
              <div className="surface-elevated rounded-xl p-3">
                <div className="font-sans text-[var(--text-muted)] mb-1">a₁ = ReLU(z₁)</div>
                <div className="text-[var(--accent-secondary)]">
                  [{liveForward.a1.map((v) => v.toFixed(4)).join(', ')}]
                </div>
              </div>
              <div className="surface-elevated rounded-xl p-3">
                <div className="font-sans text-[var(--text-muted)] mb-1">p = Softmax(z₂)</div>
                <div className="text-[var(--accent-primary)] font-semibold">
                  [{(liveForward.probs[0] * 100).toFixed(2)}%, {(liveForward.probs[1] * 100).toFixed(2)}%]
                </div>
              </div>
            </div>
          </div>

          {lastStep ? (
            <div className="surface-card rounded-2xl p-5 space-y-4 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-hairline)] pb-3">
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                  Traza Completa del Último Paso Backprop + Verificación Numérica
                </span>
                <span className="inline-flex items-center gap-1 font-mono text-[var(--status-ok)]">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Error máx dif. finitas: {lastStep.maxFiniteDiffError.toExponential(2)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono tabular-nums">
                <div className="surface-elevated rounded-xl p-4 space-y-1.5">
                  <div className="font-sans font-semibold text-[var(--text-primary)]">
                    Errores Retropropagados (δ₂ y δ₁)
                  </div>
                  <div>δ₂ = p − y = [{lastStep.delta2.map((v) => v.toFixed(6)).join(', ')}]</div>
                  <div>δ₁ = [{lastStep.delta1.map((v) => v.toFixed(6)).join(', ')}]</div>
                  <div className="pt-1 border-t border-[var(--border-hairline)]">
                    L₀ (antes) = {lastStep.lossBefore.toFixed(7)}
                  </div>
                  <div>L₁ (después) = {lastStep.lossAfter.toFixed(7)}</div>
                  <div className="text-[var(--status-ok)]">
                    Cambio L₀ − L₁ = {(lastStep.lossBefore - lastStep.lossAfter).toFixed(7)}
                  </div>
                </div>

                <div className="surface-elevated rounded-xl p-4 space-y-1.5">
                  <div className="font-sans font-semibold text-[var(--text-primary)]">
                    Gradiente Analítico vs Diferencias Finitas
                  </div>
                  <div>∂L/∂W₂[0,0] analítico = {lastStep.gradW2[0][0].toFixed(8)}</div>
                  <div>Derivada numérica (h=1e-5) = {lastStep.numericW200.toFixed(8)}</div>
                  <div className="text-[var(--accent-primary)]">
                    |Error W₂[0,0]| = {lastStep.numericErrorW200.toExponential(3)}
                  </div>
                  <div className="pt-1 border-t border-[var(--border-hairline)] text-[11px] text-[var(--text-secondary)]">
                    ∇W₁[0] = [{lastStep.gradW1[0].map((v) => v.toFixed(4)).join(', ')}]
                  </div>
                  <div className="text-[11px] text-[var(--text-secondary)]">
                    ∇W₁[1] = [{lastStep.gradW1[1].map((v) => v.toFixed(4)).join(', ')}]
                  </div>
                </div>
              </div>

              {lossHistory.length > 0 && (
                <LossAccuracyChart
                  title="Evolución de Pérdida Cross-Entropy (Red 2–3–2)"
                  subtitle="Descenso del gradiente aislado por paso de entrenamiento"
                  data={lossHistory.map((h) => ({ step: h.step, loss: h.loss }))}
                  xLabel="Paso"
                  hasAccuracy={false}
                  exportFilename="vectoria_232_loss"
                  heightClass="h-44"
                />
              )}
            </div>
          ) : (
            <div className="surface-card rounded-2xl p-8 text-center text-xs text-[var(--text-muted)]">
              Pulsa «1 Paso Backprop» o «+10 Pasos» para calcular δ₂, δ₁, gradientes analíticos, verificación por diferencias finitas y comparar la pérdida L₀ vs L₁.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
