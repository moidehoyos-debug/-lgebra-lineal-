import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowDownUp,
  Droplets,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import {
  createSmartIrrigationModel,
  evaluateSyntheticIrrigationRule,
  IRRIGATION_TRAIN_DATASET,
  IrrigationBackpropStep,
  SMART_IRRIGATION_NOTICE,
  SmartIrrigationModel,
} from '../engines/smartIrrigationEngine';
import { LossAccuracyChart } from './charts/LossAccuracyChart';

export const SmartIrrigationLabView: React.FC = () => {
  const modelRef = useRef<SmartIrrigationModel>(createSmartIrrigationModel(202604));
  const [version, setVersion] = useState(0);

  const [moisturePct, setMoisturePct] = useState(24);
  const [sunlightWm2, setSunlightWm2] = useState(780);
  const [learningRate, setLearningRate] = useState(0.25);
  const [epochsBatch, setEpochsBatch] = useState(15);
  const [lastStep, setLastStep] = useState<IrrigationBackpropStep | null>(null);

  const model = modelRef.current;

  const summary = useMemo(() => {
    void version;
    return model.getSummary();
  }, [model, version]);

  const forward = useMemo(() => {
    void version;
    return model.forward(moisturePct, sunlightWm2);
  }, [model, moisturePct, sunlightWm2, version]);

  const decisionGrid = useMemo(() => {
    void version;
    return model.getDecisionGrid(7);
  }, [model, version]);

  const expectedTarget = evaluateSyntheticIrrigationRule(moisturePct, sunlightWm2);

  const handleBackpropStep = () => {
    const step = model.stepSample(moisturePct, sunlightWm2, expectedTarget, learningRate);
    setLastStep(step);
    setVersion((v) => v + 1);
  };

  const handleTrainBatch = () => {
    model.trainEpochs(epochsBatch, learningRate);
    setVersion((v) => v + 1);
  };

  const handleResetModel = () => {
    model.reset(202604);
    setLastStep(null);
    setVersion((v) => v + 1);
  };

  const presets = [
    { label: 'Sequía + Sol Fuerte', m: 18, s: 860 },
    { label: 'Suelo Húmedo + Sombra', m: 78, s: 220 },
    { label: 'Zona Frontera', m: 46, s: 690 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            Laboratorio Neuronal de Riego Inteligente
          </h1>
          <p className="text-xs text-[var(--text-muted)]">
            Experimento educativo independiente: Humedad (%) + Luz Solar (W/m²) → Capa Oculta ReLU (4) → Predicción Sigmoide de Riego.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--status-ok)]/10 border border-[var(--status-ok)]/30 text-xs text-[var(--status-ok)] self-start">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span className="font-medium">
            Modelo aislado (17 parámetros · no modifica MNIST/Alfanumérico)
          </span>
        </div>
      </div>

      <div className="surface-elevated rounded-xl px-4 py-3 border border-[var(--border-hairline)] text-xs text-[var(--text-secondary)]">
        <strong className="text-[var(--text-primary)]">Nota metodológica:</strong>{' '}
        {SMART_IRRIGATION_NOTICE}
      </div>

      {/* Controls + Live Forward Pass */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 surface-card rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            Entradas Ambientales Sintéticas y Hiperparámetros
          </h2>

          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  setMoisturePct(p.m);
                  setSunlightWm2(p.s);
                }}
                className="px-2.5 py-1 rounded-lg text-[11px] font-medium surface-elevated border border-[var(--border-hairline)] hover:border-[var(--accent-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="space-y-3 text-xs">
            <label className="block space-y-1">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-[var(--text-secondary)]">
                  <Droplets className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
                  Humedad del suelo
                </span>
                <span className="font-mono tabular-nums text-[var(--text-primary)]">
                  {moisturePct}% (x₁={forward.x[0].toFixed(2)})
                </span>
              </div>
              <input
                type="range"
                aria-label="Humedad del suelo"
                min={0}
                max={100}
                step={1}
                value={moisturePct}
                onChange={(e) => setMoisturePct(Number(e.target.value))}
                className="w-full accent-[var(--accent-secondary)]"
              />
            </label>

            <label className="block space-y-1">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-[var(--text-secondary)]">
                  <Sun className="w-3.5 h-3.5 text-[var(--status-warn)]" />
                  Radiación solar
                </span>
                <span className="font-mono tabular-nums text-[var(--text-primary)]">
                  {sunlightWm2} W/m² (x₂={forward.x[1].toFixed(2)})
                </span>
              </div>
              <input
                type="range"
                aria-label="Radiación solar"
                min={0}
                max={1000}
                step={10}
                value={sunlightWm2}
                onChange={(e) => setSunlightWm2(Number(e.target.value))}
                className="w-full accent-[var(--status-warn)]"
              />
            </label>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <label className="block space-y-1">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">η (Learning rate)</span>
                  <span className="font-mono tabular-nums text-[var(--text-primary)]">
                    {learningRate.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0.05}
                  max={0.6}
                  step={0.05}
                  value={learningRate}
                  onChange={(e) => setLearningRate(Number(e.target.value))}
                  className="w-full accent-[var(--accent-primary)]"
                />
              </label>

              <label className="block space-y-1">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Épocas lote</span>
                  <span className="font-mono tabular-nums text-[var(--text-primary)]">
                    {epochsBatch}
                  </span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={40}
                  step={5}
                  value={epochsBatch}
                  onChange={(e) => setEpochsBatch(Number(e.target.value))}
                  className="w-full accent-[var(--accent-primary)]"
                />
              </label>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              onClick={handleBackpropStep}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold surface-elevated border border-[var(--border-strong)] hover:border-[var(--accent-primary)] text-[var(--text-primary)] cursor-pointer whitespace-nowrap"
            >
              <ArrowDownUp className="w-3.5 h-3.5" />
              1 Paso Backprop
            </button>
            <button
              type="button"
              onClick={handleTrainBatch}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-contrast)] cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Entrenar +{epochsBatch} Épocas
            </button>
            <button
              type="button"
              onClick={handleResetModel}
              title="Reiniciar pesos"
              className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs surface-elevated border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="pt-3 border-t border-[var(--border-hairline)] grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div>
              <div className="text-[var(--text-muted)]">Épocas</div>
              <div className="font-mono font-bold text-[var(--text-primary)] tabular-nums">
                {summary.epochsTrained}
              </div>
            </div>
            <div>
              <div className="text-[var(--text-muted)]">Loss BCE</div>
              <div className="font-mono font-bold text-[var(--text-primary)] tabular-nums">
                {summary.finalLoss.toFixed(4)}
              </div>
            </div>
            <div>
              <div className="text-[var(--text-muted)]">Train Acc.</div>
              <div className="font-mono font-bold text-[var(--text-primary)] tabular-nums">
                {(summary.trainAccuracy * 100).toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-[var(--text-muted)]">Val Acc.</div>
              <div className="font-mono font-bold text-[var(--accent-primary)] tabular-nums">
                {(summary.valAccuracy * 100).toFixed(1)}%
              </div>
            </div>
          </div>
        </div>

        {/* Live Forward + Hidden Activations + Prediction vs Target */}
        <div className="lg:col-span-7 surface-card rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Propagación en Tiempo Real: Entrada → Oculta (ReLU) → Salida
            </h2>
            <span className="font-mono text-xs px-2.5 py-1 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-hairline)] text-[var(--text-secondary)]">
              Objetivo regla sintética: <strong>{expectedTarget === 1 ? 'REGAR (1)' : 'NO REGAR (0)'}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="surface-elevated rounded-xl p-4 space-y-2 text-xs">
              <div className="font-semibold text-[var(--text-muted)]">1. Capa Oculta (ReLU)</div>
              {forward.a1.map((aVal, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between font-mono text-[11px]">
                    <span>h{idx + 1} (z={forward.z1[idx].toFixed(2)})</span>
                    <span className="text-[var(--accent-primary)]">a={aVal.toFixed(3)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--bg-surface)] overflow-hidden">
                    <div
                      className="h-full bg-[var(--accent-primary)]"
                      style={{ width: `${Math.min(100, aVal * 80)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="surface-elevated rounded-xl p-4 space-y-2 text-xs">
              <div className="font-semibold text-[var(--text-muted)]">2. Pesos de Salida W⁽²⁾</div>
              <div className="font-mono space-y-1.5 text-[11px]">
                {model.W2.map((w, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>w₂,{idx + 1}:</span>
                    <span className={w >= 0 ? 'text-[var(--status-ok)]' : 'text-[var(--status-err)]'}>
                      {w >= 0 ? '+' : ''}
                      {w.toFixed(4)}
                    </span>
                  </div>
                ))}
                <div className="pt-1 border-t border-[var(--border-hairline)] flex justify-between text-[var(--text-muted)]">
                  <span>Sesgo b₂:</span>
                  <span>{model.b2.toFixed(4)}</span>
                </div>
              </div>
            </div>

            <div className="surface-elevated rounded-xl p-4 flex flex-col justify-between gap-2 text-xs">
              <div className="font-semibold text-[var(--text-muted)]">3. Predicción ŷ = σ(z₂)</div>
              <div className="space-y-1">
                <div
                  className={`text-2xl font-bold font-mono ${
                    forward.decision === 'REGAR' ? 'text-[var(--accent-secondary)]' : 'text-[var(--status-ok)]'
                  }`}
                >
                  {forward.decision}
                </div>
                <div className="font-mono tabular-nums text-[var(--text-primary)]">
                  P(Regar=1) = {(forward.yHat * 100).toFixed(2)}%
                </div>
                <div className="text-[11px] text-[var(--text-muted)]">
                  Coincide con regla esperada:{' '}
                  <strong
                    className={
                      (forward.yHat >= 0.5 ? 1 : 0) === expectedTarget
                        ? 'text-[var(--status-ok)]'
                        : 'text-[var(--status-warn)]'
                    }
                  >
                    {(forward.yHat >= 0.5 ? 1 : 0) === expectedTarget ? 'Sí' : 'Aún ajustando'}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* Step-by-step Backprop details */}
          {lastStep ? (
            <div className="surface-elevated rounded-xl p-4 border border-[var(--border-hairline)] grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="space-y-1 font-mono">
                <div className="font-sans font-semibold text-[var(--text-primary)]">
                  Error y Pérdida BCE
                </div>
                <div>Loss antes: {lastStep.lossBefore.toFixed(5)}</div>
                <div>Loss después: {lastStep.lossAfter.toFixed(5)}</div>
                <div className="text-[var(--status-ok)]">
                  ΔLoss: {(lastStep.lossAfter - lastStep.lossBefore).toFixed(5)}
                </div>
                <div>δ salida (ŷ - y): {lastStep.deltaOutput.toFixed(4)}</div>
              </div>
              <div className="space-y-1 font-mono">
                <div className="font-sans font-semibold text-[var(--text-primary)]">
                  Gradientes ∇W⁽²⁾
                </div>
                {lastStep.gradW2.map((g, i) => (
                  <div key={i}>
                    ∂L/∂w₂,{i + 1} = {g.toFixed(4)}
                  </div>
                ))}
              </div>
              <div className="space-y-1 font-mono">
                <div className="font-sans font-semibold text-[var(--text-primary)]">
                  Pesos W⁽²⁾ Antes → Después
                </div>
                {lastStep.weightsBefore.W2.map((wb, i) => (
                  <div key={i}>
                    w₂,{i + 1}: {wb.toFixed(3)} → {lastStep.weightsAfter.W2[i].toFixed(3)}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="surface-elevated rounded-xl p-3.5 text-xs text-[var(--text-muted)] flex items-center gap-2">
              <Play className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0" />
              <span>
                Pulsa &ldquo;1 Paso Backprop&rdquo; para inspeccionar el gradiente exacto y la actualización de pesos sobre la muestra actual.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Training Curves + Decision Surface */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <LossAccuracyChart
            title="Curva de Aprendizaje Real — Riego Inteligente (2→4→1)"
            subtitle={`Evaluación sobre ${IRRIGATION_TRAIN_DATASET.length} muestras de entrenamiento y 8 de validación sintética`}
            data={summary.history.map((h) => ({
              step: h.epoch,
              loss: h.loss,
              accuracyPct: Number((h.accuracy * 100).toFixed(1)),
              valAccuracyPct: Number((h.valAccuracy * 100).toFixed(1)),
            }))}
            exportFilename="vectoria_riego_inteligente_curva"
            heightClass="h-64"
          />
        </div>

        <div className="lg:col-span-5 surface-card rounded-2xl p-5 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Superficie de Decisión Aprendida P(REGAR)
            </h2>
            <p className="text-[11px] text-[var(--text-muted)]">
              Filas: Humedad (0% → 100%) · Columnas: Luz Solar (0 → 1000 W/m²)
            </p>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {decisionGrid.map((cell, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setMoisturePct(cell.moisturePct);
                  setSunlightWm2(cell.sunlightWm2);
                }}
                title={`Humedad ${cell.moisturePct}%, Sol ${cell.sunlightWm2} W/m² → ${(cell.probability * 100).toFixed(0)}%`}
                className="h-8 rounded text-[10px] font-mono tabular-nums flex items-center justify-center border border-[var(--border-hairline)] cursor-pointer"
                style={{
                  backgroundColor:
                    cell.probability >= 0.5
                      ? `rgba(34, 211, 238, ${(0.2 + cell.probability * 0.65).toFixed(2)})`
                      : `rgba(16, 185, 129, ${(0.2 + (1 - cell.probability) * 0.45).toFixed(2)})`,
                  color: 'var(--text-primary)',
                }}
              >
                {(cell.probability * 100).toFixed(0)}%
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] pt-1">
            <span>Cian = REGAR (&ge;50%)</span>
            <span>Verde = NO REGAR (&lt;50%)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
