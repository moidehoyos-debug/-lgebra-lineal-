import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowDownUp, Play, RefreshCw } from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { BackpropStepReport } from '../engines/neuralEngine';
import { ClassifierMode } from '../types/vectoria';
import { Didactic232BackpropPanel } from './Didactic232BackpropPanel';
import { LossAccuracyChart } from './charts/LossAccuracyChart';
import { ScientificChartCard } from './charts/ScientificChartCard';
import { ScientificTooltip } from './charts/ScientificTooltip';
import { useChartPalette } from './charts/chartTheme';

export const NeuralEngineeringLabView: React.FC = () => {
  const {
    classifierMode,
    setClassifierMode,
    currentInputGrid,
    suiteRef,
    digitsSummary,
    lettersSummary,
    alphanumericSummary,
    retrainMode,
    trainingProgress,
    runSingleBackpropStep,
  } = useStudio();

  const activeSummary =
    classifierMode === 'digits'
      ? digitsSummary
      : classifierMode === 'letters'
        ? lettersSummary
        : alphanumericSummary;

  const activeModel =
    classifierMode === 'digits'
      ? suiteRef.current.digitsModel
      : classifierMode === 'letters'
        ? suiteRef.current.lettersModel
        : suiteRef.current.alphanumericModel;

  const palette = useChartPalette();
  const [labView, setLabView] = useState<'mlp' | 'didactic-232'>('mlp');
  const [learningRate, setLearningRate] = useState(0.005);
  const [momentum, setMomentum] = useState(0.85);
  const [epochsToTrain, setEpochsToTrain] = useState(12);
  const [targetLabel, setTargetLabel] = useState<string>(activeModel.labels[0]);
  const [backpropReport, setBackpropReport] = useState<BackpropStepReport | null>(null);

  const forwardSnapshot = useMemo(() => {
    return activeModel.forward(currentInputGrid);
  }, [activeModel, currentInputGrid, activeSummary.epochsTrained, backpropReport]);

  const weightHistogram = useMemo(() => {
    const bins = [
      { label: '<-0.4', min: -Infinity, max: -0.4, count: 0 },
      { label: '-0.4..-0.2', min: -0.4, max: -0.2, count: 0 },
      { label: '-0.2..0', min: -0.2, max: 0, count: 0 },
      { label: '0..0.2', min: 0, max: 0.2, count: 0 },
      { label: '0.2..0.4', min: 0.2, max: 0.4, count: 0 },
      { label: '>0.4', min: 0.4, max: Infinity, count: 0 },
    ];
    for (const layer of activeModel.layers) {
      for (const row of layer.W) {
        for (const w of row) {
          for (const b of bins) {
            if (w >= b.min && w < b.max) {
              b.count += 1;
              break;
            }
          }
        }
      }
    }
    return bins.map((b) => ({ bin: b.label, count: b.count }));
  }, [activeModel, activeSummary.epochsTrained, backpropReport]);

  const effectiveTarget = activeModel.labels.includes(targetLabel)
    ? targetLabel
    : activeModel.labels[0];

  const handleStep = () => {
    const rep = runSingleBackpropStep(effectiveTarget, learningRate, momentum);
    setBackpropReport(rep);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            Laboratorio de Ingeniería Neuronal
          </h1>
          <p className="text-xs text-[var(--text-muted)]">
            Cálculo real del motor MLP: propagación hacia adelante, activaciones, gradientes y actualización de pesos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start">
          <div className="inline-flex items-center gap-1 p-1 rounded-xl surface-elevated text-xs">
            <button
              type="button"
              onClick={() => setLabView('mlp')}
              className={`px-3 py-1.5 rounded-lg font-medium cursor-pointer whitespace-nowrap ${
                labView === 'mlp'
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              Motor MLP 16×16
            </button>
            <button
              type="button"
              onClick={() => setLabView('didactic-232')}
              className={`px-3 py-1.5 rounded-lg font-medium cursor-pointer whitespace-nowrap ${
                labView === 'didactic-232'
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              Simulador 2–3–2 (HTML Original)
            </button>
          </div>

          {labView === 'mlp' && (
            <div className="inline-flex items-center gap-1 p-1 rounded-xl surface-elevated">
              {(['digits', 'letters', 'alphanumeric'] as ClassifierMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setClassifierMode(m)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap ${
                    classifierMode === m
                      ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                      : 'text-[var(--text-secondary)]'
                  }`}
                >
                  {m === 'digits' ? 'Dígitos (0–9)' : m === 'letters' ? 'Letras (A–Z)' : 'Alfanumérico (36)'}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {labView === 'didactic-232' ? (
        <Didactic232BackpropPanel />
      ) : (
        <>
      {/* Formulación Matemática Formal */}
      <section className="surface-card rounded-2xl p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="surface-elevated rounded-xl p-4 space-y-1.5">
          <div className="text-xs font-semibold text-[var(--accent-primary)]">
            Transformación Afín por Capa
          </div>
          <div className="font-mono text-sm font-semibold text-[var(--text-primary)]">
            Z⁽ˡ⁾ = W⁽ˡ⁾ · A⁽ˡ⁻¹⁾ + b⁽ˡ⁾
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Arquitectura actual: {activeSummary.architecture} ({activeSummary.parameterCount.toLocaleString()} parámetros).
          </p>
        </div>

        <div className="surface-elevated rounded-xl p-4 space-y-1.5">
          <div className="text-xs font-semibold text-[var(--accent-secondary)]">
            Activación No Lineal Oculta
          </div>
          <div className="font-mono text-sm font-semibold text-[var(--text-primary)]">
            A⁽ˡ⁾ = ReLU(Z⁽ˡ⁾) = max(0, Z⁽ˡ⁾)
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Neuronas activas (A &gt; 0) en Oculta 1:{' '}
            <span className="font-mono tabular-nums text-[var(--text-primary)]">
              {forwardSnapshot.snapshots[1].aValues.filter((v) => v > 0).length}/
              {forwardSnapshot.snapshots[1].size}
            </span>
          </p>
        </div>

        <div className="surface-elevated rounded-xl p-4 space-y-1.5">
          <div className="text-xs font-semibold text-[var(--status-ok)]">
            Normalización Probabilística de Salida
          </div>
          <div className="font-mono text-sm font-semibold text-[var(--text-primary)]">
            Softmax(zᵢ) = eᶻⁱ / Σⱼ eᶻʲ
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Suma verificada Σ Softmax ={' '}
            <span className="font-mono tabular-nums text-[var(--text-primary)]">
              {forwardSnapshot.probs.reduce((a, b) => a + b, 0).toFixed(6)}
            </span>
          </p>
        </div>
      </section>

      {/* Training Controls + Real Curves */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 surface-card rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            Parámetros de Entrenamiento (SGD + Momento)
          </h2>

          <div className="space-y-3 text-xs">
            <label className="block space-y-1">
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Tasa de aprendizaje (η)</span>
                <span className="font-mono tabular-nums text-[var(--text-primary)]">
                  {learningRate.toFixed(3)}
                </span>
              </div>
              <input
                type="range"
                min={0.002}
                max={0.05}
                step={0.001}
                value={learningRate}
                onChange={(e) => setLearningRate(Number(e.target.value))}
                className="w-full accent-[var(--accent-primary)]"
              />
            </label>

            <label className="block space-y-1">
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Momento (μ)</span>
                <span className="font-mono tabular-nums text-[var(--text-primary)]">
                  {momentum.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={0.95}
                step={0.05}
                value={momentum}
                onChange={(e) => setMomentum(Number(e.target.value))}
                className="w-full accent-[var(--accent-primary)]"
              />
            </label>

            <label className="block space-y-1">
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Épocas por lote</span>
                <span className="font-mono tabular-nums text-[var(--text-primary)]">
                  {epochsToTrain}
                </span>
              </div>
              <input
                type="range"
                min={2}
                max={30}
                step={2}
                value={epochsToTrain}
                onChange={(e) => setEpochsToTrain(Number(e.target.value))}
                className="w-full accent-[var(--accent-primary)]"
              />
            </label>
          </div>

          <button
            type="button"
            disabled={trainingProgress.isTraining}
            onClick={() => retrainMode(classifierMode, epochsToTrain, learningRate)}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-contrast)] disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${trainingProgress.isTraining ? 'animate-spin' : ''}`} />
            {trainingProgress.isTraining
              ? `Entrenando ${trainingProgress.currentEpoch}/${trainingProgress.totalEpochs}...`
              : `Ejecutar +${epochsToTrain} Épocas Reales`}
          </button>

          <div className="pt-3 border-t border-[var(--border-hairline)] grid grid-cols-2 gap-2 text-xs">
            <div>
              <div className="text-[var(--text-muted)]">Épocas totales</div>
              <div className="font-mono font-semibold text-[var(--text-primary)] tabular-nums">
                {activeSummary.epochsTrained}
              </div>
            </div>
            <div>
              <div className="text-[var(--text-muted)]">Pérdida Cross-Entropy</div>
              <div className="font-mono font-semibold text-[var(--text-primary)] tabular-nums">
                {activeSummary.epochsTrained > 0 ? activeSummary.finalLoss.toFixed(4) : '—'}
              </div>
            </div>
            <div>
              <div className="text-[var(--text-muted)]">Precisión Entrenamiento</div>
              <div className="font-mono font-semibold text-[var(--text-primary)] tabular-nums">
                {activeSummary.epochsTrained > 0
                  ? `${(activeSummary.trainAccuracy * 100).toFixed(1)}%`
                  : '—'}
              </div>
            </div>
            <div>
              <div className="text-[var(--text-muted)]">Precisión Validación</div>
              <div className="font-mono font-semibold text-[var(--accent-primary)] tabular-nums">
                {activeSummary.epochsTrained > 0
                  ? `${(activeSummary.valAccuracy * 100).toFixed(1)}%`
                  : '—'}
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 space-y-5">
          <LossAccuracyChart
            title="Curvas Reales de Pérdida y Precisión por Época"
            subtitle={`Evaluación sobre validación independiente · ${activeSummary.architecture}`}
            data={activeSummary.history.map((h) => ({
              step: h.epoch,
              loss: h.loss,
              accuracyPct: Number((h.accuracy * 100).toFixed(1)),
              valAccuracyPct: Number((h.valAccuracy * 100).toFixed(1)),
            }))}
            exportFilename={`vectoria_mlp_curvas_${classifierMode}`}
            heightClass="h-64"
          />

          <ScientificChartCard
            title="Histograma de Distribución de Pesos Sinápticos W"
            subtitle={`${activeSummary.parameterCount.toLocaleString()} parámetros reales del modelo activo`}
            exportFilename={`vectoria_histograma_pesos_${classifierMode}`}
            dataTable={{
              columns: ['Intervalo de Peso', 'Frecuencia'],
              rows: weightHistogram.map((b) => [b.bin, b.count]),
            }}
          >
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weightHistogram} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={palette.borderHairline} vertical={false} />
                  <XAxis
                    dataKey="bin"
                    tick={{ fill: palette.textSecondary, fontSize: 10, fontFamily: 'JetBrains Mono' }}
                    stroke={palette.borderHairline}
                  />
                  <YAxis
                    tick={{ fill: palette.textMuted, fontSize: 10, fontFamily: 'JetBrains Mono' }}
                    stroke={palette.borderHairline}
                    width={46}
                  />
                  <Tooltip
                    cursor={{ fill: palette.bgElevated, opacity: 0.45 }}
                    content={<ScientificTooltip labelPrefix="Rango " decimals={0} />}
                  />
                  <Bar dataKey="count" name="Pesos" fill={palette.chart2} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ScientificChartCard>
        </div>
      </div>

      {/* Interactive Single-Sample Forward + Backpropagation Stepper */}
      <section className="surface-card rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Inspección Paso a Paso de Retropropagación (Backpropagation)
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Ejecuta un paso real de gradiente sobre la entrada actual del lienzo hacia la etiqueta objetivo seleccionada.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-[var(--text-secondary)]">Etiqueta real y:</label>
            <select
              value={effectiveTarget}
              onChange={(e) => setTargetLabel(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-mono surface-elevated text-[var(--text-primary)]"
            >
              {activeModel.labels.map((lbl) => (
                <option key={lbl} value={lbl}>
                  {lbl}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleStep}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent-primary)] text-[var(--accent-contrast)] cursor-pointer whitespace-nowrap"
            >
              <ArrowDownUp className="w-3.5 h-3.5" />
              Ejecutar 1 Paso Backprop
            </button>
          </div>
        </div>

        {backpropReport ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
            <div className="surface-elevated rounded-xl p-4 space-y-2">
              <div className="font-semibold text-[var(--text-primary)]">
                1. Error y Gradiente de Salida δ⁽ᴸ⁾ = ŷ - y
              </div>
              <div className="font-mono tabular-nums space-y-1 text-[var(--text-secondary)]">
                <div>Pérdida antes: {backpropReport.lossBefore.toFixed(5)}</div>
                <div>Pérdida después: {backpropReport.lossAfter.toFixed(5)}</div>
                <div>
                  Δ Pérdida:{' '}
                  <span className="text-[var(--status-ok)]">
                    {(backpropReport.lossAfter - backpropReport.lossBefore).toFixed(5)}
                  </span>
                </div>
                <div className="pt-1 text-[var(--text-muted)]">
                  δ salida (primeras 6): [
                  {backpropReport.deltaOutput
                    .slice(0, 6)
                    .map((d) => d.toFixed(3))
                    .join(', ')}
                  ]
                </div>
              </div>
            </div>

            <div className="surface-elevated rounded-xl p-4 space-y-2">
              <div className="font-semibold text-[var(--text-primary)]">
                2. Norma Frobenius de Gradientes ||∇W⁽ˡ⁾||_F
              </div>
              <div className="font-mono tabular-nums space-y-1 text-[var(--text-secondary)]">
                {backpropReport.gradWNormByLayer.map((gn, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>Capa {idx + 1}:</span>
                    <span>
                      ||∇W||={gn.toFixed(4)} · ||∇b||={backpropReport.gradBNormByLayer[idx].toFixed(4)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="surface-elevated rounded-xl p-4 space-y-2">
              <div className="font-semibold text-[var(--text-primary)]">
                3. Muestra de Pesos W⁽ᴸ⁾ (Antes → Después)
              </div>
              <div className="font-mono text-[11px] tabular-nums space-y-1 text-[var(--text-secondary)] overflow-x-auto">
                {backpropReport.weightPreviewBefore.slice(0, 3).map((row, rIdx) => (
                  <div key={rIdx} className="whitespace-nowrap">
                    N{rIdx + 1}:{' '}
                    {row
                      .slice(0, 3)
                      .map(
                        (w, cIdx) =>
                          `${w.toFixed(3)}→${backpropReport.weightPreviewAfter[rIdx][cIdx].toFixed(3)}`
                      )
                      .join(' | ')}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="surface-elevated rounded-xl p-4 text-xs text-[var(--text-muted)] flex items-center gap-2">
            <Play className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span>
              Pulsa "Ejecutar 1 Paso Backprop" para observar el cálculo exacto de gradientes y la actualización de pesos sobre la muestra activa.
            </span>
          </div>
        )}
      </section>
        </>
      )}
    </div>
  );
};
