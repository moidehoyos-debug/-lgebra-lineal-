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
import { LossAccuracyChart } from './charts/LossAccuracyChart';
import { ScientificChartCard } from './charts/ScientificChartCard';
import { ScientificTooltip } from './charts/ScientificTooltip';
import { SoftmaxBarChart } from './charts/SoftmaxBarChart';
import { useChartPalette } from './charts/chartTheme';
import {
  AlertTriangle,
  Bot,
  Download,
  FlaskConical,
  GitCompare,
  History,
  Lock,
  Network,
  Play,
  RotateCcw,
} from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { DIGIT_LABELS, GRID_SIZE, LETTER_LABELS } from '../engines/alphanumericDataset';
import {
  createDefaultDidactic322Config,
  runABExperiment,
  runBatchPerturbationExperiment,
  runBeforeAfterExperiment,
  stepDidactic322,
} from '../engines/simulationEngine';
import {
  ABExperimentResult,
  ABScenarioConfig,
  BatchPerturbationResult,
  BeforeAfterExperimentResult,
  ClassifierMode,
  Didactic322Config,
  Didactic322StepResult,
  SimulationExperimentConfig,
  SimulationRunRecord,
} from '../types/vectoria';
import { Didactic232BackpropPanel } from './Didactic232BackpropPanel';
import { Perturbation28x28Panel } from './Perturbation28x28Panel';

type SimTab = 'before-after' | 'didactic-322' | 'didactic-232' | 'ab-mode' | 'batch-history' | 'perturb-784';

const DEFAULT_CONFIG: SimulationExperimentConfig = {
  mode: 'digits',
  targetGlyph: '3',
  shiftX: 1,
  shiftY: 0,
  noiseLevel: 0.15,
  perturbationIntensity: 0.15,
  learningRate: 0.04,
  epochs: 0,
  seed: 2026,
  selectedClasses: ['0', '1', '3', '7', '8'],
};

export const SimulationLabView: React.FC = () => {
  const palette = useChartPalette();
  const simUid = useId().replace(/:/g, '');
  const {
    suiteRef,
    currentInputGrid,
    alphanumericSummary,
    simulationConfig,
    setSimulationConfig,
    simulationHistory,
    addSimulationRun,
    clearSimulationHistory,
    sendExperimentToTopology,
    askOmniAboutExperiment,
    setActiveModule,
  } = useStudio();

  const [tab, setTab] = useState<SimTab>('before-after');
  const [useCanvasInput, setUseCanvasInput] = useState(false);

  // Sub-view 1: Before / After result
  const [beforeAfterRes, setBeforeAfterRes] =
    useState<BeforeAfterExperimentResult | null>(null);

  // Sub-view 2: Didactic 3-2-2 state
  const [didacticCfg, setDidacticCfg] = useState<Didactic322Config>(() =>
    createDefaultDidactic322Config()
  );
  const [didacticLastStep, setDidacticLastStep] =
    useState<Didactic322StepResult | null>(null);
  const [didacticLossHistory, setDidacticLossHistory] = useState<
    Array<{ step: number; loss: number; targetProb: number }>
  >([]);
  const [didacticEpochsBatch, setDidacticEpochsBatch] = useState(10);

  // Sub-view 3: A/B Experimental Mode
  const [scenarioA, setScenarioA] = useState<ABScenarioConfig>({
    label: 'Escenario A (Base)',
    shiftX: 0,
    shiftY: 0,
    noiseLevel: 0.05,
    perturbationIntensity: 0.05,
    learningRate: 0.03,
    epochs: 0,
    seed: 2026,
  });
  const [scenarioB, setScenarioB] = useState<ABScenarioConfig>({
    label: 'Escenario B (Intervenido)',
    shiftX: 2,
    shiftY: -1,
    noiseLevel: 0.25,
    perturbationIntensity: 0.25,
    learningRate: 0.06,
    epochs: 4,
    seed: 2026,
  });
  const [abResult, setAbResult] = useState<ABExperimentResult | null>(null);

  // Sub-view 4: Batch + History comparison
  const [batchResult, setBatchResult] = useState<BatchPerturbationResult | null>(
    null
  );
  const [compareIds, setCompareIds] = useState<[string, string]>(['', '']);

  const suite = suiteRef.current;
  const activeModel =
    simulationConfig.mode === 'digits'
      ? suite.digitsModel
      : simulationConfig.mode === 'letters'
        ? suite.lettersModel
        : suite.alphanumericModel;

  const activeTrainSet =
    simulationConfig.mode === 'digits'
      ? suite.digitsTrain
      : simulationConfig.mode === 'letters'
        ? suite.lettersTrain
        : suite.alphanumericTrain;

  const activeValSet =
    simulationConfig.mode === 'digits'
      ? suite.digitsVal
      : simulationConfig.mode === 'letters'
        ? suite.lettersVal
        : suite.alphanumericVal;

  const isAlphaBlocked =
    simulationConfig.mode === 'alphanumeric' && !alphanumericSummary.isTrained;

  const availableGlyphs = useMemo(() => {
    if (simulationConfig.mode === 'digits') return [...DIGIT_LABELS];
    if (simulationConfig.mode === 'letters') return [...LETTER_LABELS];
    return [...DIGIT_LABELS, ...LETTER_LABELS];
  }, [simulationConfig.mode]);

  const handleModeChange = (mode: ClassifierMode) => {
    const firstGlyph = mode === 'letters' ? 'A' : '3';
    const defaultClasses =
      mode === 'letters'
        ? ['A', 'B', 'I', 'O', 'Q']
        : ['0', '1', '3', '7', '8'];
    setSimulationConfig((prev) => ({
      ...prev,
      mode,
      targetGlyph: firstGlyph,
      selectedClasses: defaultClasses,
    }));
  };

  const handleResetParams = () => {
    setSimulationConfig(DEFAULT_CONFIG);
    setUseCanvasInput(false);
    setBeforeAfterRes(null);
  };

  const handleRunBeforeAfter = () => {
    if (isAlphaBlocked) return;
    const res = runBeforeAfterExperiment(
      activeModel,
      activeTrainSet,
      activeValSet,
      simulationConfig,
      useCanvasInput ? currentInputGrid : undefined
    );
    setBeforeAfterRes(res);

    addSimulationRun({
      id: `sim-ba-${Date.now()}`,
      timestamp: new Date().toISOString(),
      kind: 'before-after',
      title: `Antes/Después · "${simulationConfig.targetGlyph}" (${simulationConfig.mode})`,
      summary: `Pred: ${res.originalTopLabel} (${(res.originalConfidence * 100).toFixed(1)}%) → ${res.modifiedTopLabel} (${(res.modifiedConfidence * 100).toFixed(1)}%) | Loss: ${res.lossBefore.toFixed(3)} → ${res.lossAfter.toFixed(3)}`,
      durationMs: res.durationMs,
      config: { ...simulationConfig },
      metrics: {
        predOriginal: res.originalTopLabel,
        confOriginalPct: Number((res.originalConfidence * 100).toFixed(2)),
        predModificada: res.modifiedTopLabel,
        confModificadaPct: Number((res.modifiedConfidence * 100).toFixed(2)),
        lossAntes: Number(res.lossBefore.toFixed(4)),
        lossDespues: Number(res.lossAfter.toFixed(4)),
      },
    });
  };

  const handleRunDidacticSteps = (stepsCount: number) => {
    const t0 = performance.now();
    let current = didacticCfg;
    let last: Didactic322StepResult | null = null;
    const newPts: Array<{ step: number; loss: number; targetProb: number }> = [];
    const baseStep = didacticLossHistory.length;

    for (let i = 0; i < stepsCount; i++) {
      last = stepDidactic322(current);
      current = last.updatedConfig;
      newPts.push({
        step: baseStep + i + 1,
        loss: Number(last.lossAfter.toFixed(5)),
        targetProb: Number(
          (last.probsAfter[current.yTargetIndex] * 100).toFixed(2)
        ),
      });
    }

    setDidacticCfg(current);
    setDidacticLastStep(last);
    setDidacticLossHistory((prev) => [...prev, ...newPts].slice(-80));

    if (last) {
      addSimulationRun({
        id: `sim-322-${Date.now()}`,
        timestamp: new Date().toISOString(),
        kind: 'didactic-322',
        title: `Red Didáctica 3–2–2 (${stepsCount} paso${stepsCount > 1 ? 's' : ''})`,
        summary: `Loss ${last.lossBefore.toFixed(4)} → ${last.lossAfter.toFixed(4)} | P(y=${current.yTargetIndex}): ${(last.probsAfter[current.yTargetIndex] * 100).toFixed(1)}%`,
        durationMs: Number((performance.now() - t0).toFixed(2)),
        config: { ...simulationConfig },
        metrics: {
          lossAntes: Number(last.lossBefore.toFixed(5)),
          lossDespues: Number(last.lossAfter.toFixed(5)),
          probObjetivoPct: Number(
            (last.probsAfter[current.yTargetIndex] * 100).toFixed(2)
          ),
        },
      });
    }
  };

  const handleRunAB = () => {
    if (isAlphaBlocked) return;
    const res = runABExperiment(
      activeModel,
      activeTrainSet,
      activeValSet,
      simulationConfig.targetGlyph,
      scenarioA,
      scenarioB
    );
    setAbResult(res);

    addSimulationRun({
      id: `sim-ab-${Date.now()}`,
      timestamp: new Date().toISOString(),
      kind: 'ab-test',
      title: `Experimento A/B · "${simulationConfig.targetGlyph}"`,
      summary: `A: ${res.scenarioA.topLabel} (val ${(res.scenarioA.valAccuracy * 100).toFixed(1)}%) vs B: ${res.scenarioB.topLabel} (val ${(res.scenarioB.valAccuracy * 100).toFixed(1)}%)`,
      durationMs: res.durationMs,
      config: { ...simulationConfig },
      metrics: {
        lossA: Number(res.scenarioA.loss.toFixed(4)),
        lossB: Number(res.scenarioB.loss.toFixed(4)),
        valAccAPct: Number((res.scenarioA.valAccuracy * 100).toFixed(2)),
        valAccBPct: Number((res.scenarioB.valAccuracy * 100).toFixed(2)),
      },
    });
  };

  const handleRunBatch = () => {
    if (isAlphaBlocked) return;
    const res = runBatchPerturbationExperiment(
      activeModel,
      activeValSet,
      simulationConfig
    );
    setBatchResult(res);

    addSimulationRun({
      id: `sim-batch-${Date.now()}`,
      timestamp: new Date().toISOString(),
      kind: 'batch-robustness',
      title: `Lote (${res.totalSamples} muestras, ${simulationConfig.mode})`,
      summary: `Exactitud limpia: ${(res.cleanAccuracy * 100).toFixed(1)}% → Perturbada: ${(res.perturbedAccuracy * 100).toFixed(1)}% (Δ ${res.accuracyDropPct}%)`,
      durationMs: res.durationMs,
      config: { ...simulationConfig },
      metrics: {
        muestras: res.totalSamples,
        exactitudLimpiaPct: Number((res.cleanAccuracy * 100).toFixed(2)),
        exactitudPerturbadaPct: Number((res.perturbedAccuracy * 100).toFixed(2)),
        cambioPct: res.accuracyDropPct,
      },
    });
  };

  const handleRestoreConfig = (run: SimulationRunRecord) => {
    setSimulationConfig({ ...run.config });
    setTab('before-after');
  };

  const handleExportHistory = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      provenance:
        'Resultados experimentales ejecutados sobre copias aisladas en Simulation Lab (no representan métricas de producción).',
      currentConfig: simulationConfig,
      history: simulationHistory,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vectoria-simulation-history-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleClassSelection = (lbl: string) => {
    setSimulationConfig((prev) => {
      const exists = prev.selectedClasses.includes(lbl);
      const next = exists
        ? prev.selectedClasses.filter((c) => c !== lbl)
        : [...prev.selectedClasses, lbl];
      return { ...prev, selectedClasses: next };
    });
  };

  const renderGridPreview = (grid: number[], accentRgba: string) => (
    <div
      className="grid gap-px p-1.5 rounded-lg bg-[#09090d] border border-[var(--border-hairline)] w-32 h-32"
      style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))` }}
    >
      {grid.map((val, idx) => (
        <div
          key={idx}
          style={{ backgroundColor: `rgba(${accentRgba}, ${Math.max(0.04, val)})` }}
        />
      ))}
    </div>
  );

  const comparedRun1 = simulationHistory.find((r) => r.id === compareIds[0]);
  const comparedRun2 = simulationHistory.find((r) => r.id === compareIds[1]);

  return (
    <div className="space-y-6">
      {/* Header & Experimental Isolation Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            Simulation Lab — Laboratorio de Simulación Experimental
          </h1>
          <p className="text-xs text-[var(--text-muted)]">
            Intervención directa sobre parámetros, entradas, pesos didácticos, experimentos A/B y sensibilidad reproducible.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl surface-elevated text-xs text-[var(--text-secondary)] self-start">
          <Lock className="w-3.5 h-3.5 text-[var(--status-ok)] shrink-0" />
          <span>Aislamiento activo: copias experimentales · Pesos originales protegidos</span>
        </div>
      </div>

      {/* Sub-navigation tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl surface-elevated"
          role="tablist"
        >
          {(
            [
              { id: 'before-after', label: '1. Antes/Después 16×16' },
              { id: 'perturb-784', label: '2. Perturbaciones 28×28' },
              { id: 'didactic-322', label: '3. Red Didáctica 3–2–2' },
              { id: 'didactic-232', label: '4. Simulador 2–3–2' },
              { id: 'ab-mode', label: '5. Modo A/B' },
              { id: 'batch-history', label: `6. Lotes e Historial (${simulationHistory.length})` },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap transition-colors ${
                tab === item.id
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setActiveModule('classifier')}
            className="px-2.5 py-1.5 rounded-lg surface-elevated hover:border-[var(--accent-primary)] border border-[var(--border-hairline)] text-[var(--text-secondary)] cursor-pointer whitespace-nowrap"
          >
            Clasificador
          </button>
          <button
            type="button"
            onClick={() => setActiveModule('analytics')}
            className="px-2.5 py-1.5 rounded-lg surface-elevated hover:border-[var(--accent-primary)] border border-[var(--border-hairline)] text-[var(--text-secondary)] cursor-pointer whitespace-nowrap"
          >
            Analítica
          </button>
          <button
            type="button"
            onClick={() => setActiveModule('robustness')}
            className="px-2.5 py-1.5 rounded-lg surface-elevated hover:border-[var(--accent-primary)] border border-[var(--border-hairline)] text-[var(--text-secondary)] cursor-pointer whitespace-nowrap"
          >
            Robustez
          </button>
          <button
            type="button"
            onClick={() => setActiveModule('xai')}
            className="px-2.5 py-1.5 rounded-lg surface-elevated hover:border-[var(--accent-primary)] border border-[var(--border-hairline)] text-[var(--accent-primary)] cursor-pointer whitespace-nowrap"
          >
            Explicabilidad XAI
          </button>
        </div>
      </div>

      {/* 36-class Gate if selected */}
      {isAlphaBlocked && tab !== 'didactic-322' && tab !== 'didactic-232' && tab !== 'perturb-784' && (
        <div className="surface-card rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 text-xs text-[var(--status-warn)]">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              El modelo Alfanumérico (36 clases) aún no ha sido entrenado. Entrénalo en el Clasificador antes de ejecutar simulaciones combinadas, o selecciona Dígitos (0–9) / Letras (A–Z).
            </span>
          </div>
          <button
            type="button"
            onClick={() => setActiveModule('classifier')}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent-primary)] text-[var(--accent-contrast)] cursor-pointer whitespace-nowrap"
          >
            Ir a entrenar 36 clases
          </button>
        </div>
      )}

      {/* TAB 1: BEFORE / AFTER + INTERACTIVE CONTROLS */}
      {tab === 'before-after' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Parameter Controls with units & bounds */}
          <div className="lg:col-span-5 surface-card rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                Parámetros de Intervención Controlada
              </h2>
              <button
                type="button"
                onClick={handleResetParams}
                className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reiniciar
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <label className="space-y-1">
                <span className="text-[var(--text-secondary)]">Modelo base (copia aislada)</span>
                <select
                  value={simulationConfig.mode}
                  onChange={(e) => handleModeChange(e.target.value as ClassifierMode)}
                  className="w-full px-2.5 py-2 rounded-lg surface-elevated text-[var(--text-primary)]"
                >
                  <option value="digits">Dígitos (0–9)</option>
                  <option value="letters">Letras (A–Z)</option>
                  <option value="alphanumeric">Alfanumérico (36)</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-[var(--text-secondary)]">Clase objetivo</span>
                <select
                  value={simulationConfig.targetGlyph}
                  onChange={(e) =>
                    setSimulationConfig((p) => ({ ...p, targetGlyph: e.target.value }))
                  }
                  className="w-full px-2.5 py-2 rounded-lg font-mono surface-elevated text-[var(--text-primary)]"
                >
                  {availableGlyphs.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
              <input
                type="checkbox"
                checked={useCanvasInput}
                onChange={(e) => setUseCanvasInput(e.target.checked)}
                className="accent-[var(--accent-primary)]"
              />
              <span>Usar trazo actual del Lienzo del Clasificador como entrada original</span>
            </label>

            <div className="space-y-3 text-xs pt-1">
              <label className="block space-y-1">
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">
                    Desplazamiento horizontal Δx [-6, +6 px]
                  </span>
                  <span className="font-mono tabular-nums text-[var(--text-primary)]">
                    {simulationConfig.shiftX > 0 ? `+${simulationConfig.shiftX}` : simulationConfig.shiftX} px
                  </span>
                </div>
                <input
                  type="range"
                  min={-6}
                  max={6}
                  step={1}
                  value={simulationConfig.shiftX}
                  onChange={(e) =>
                    setSimulationConfig((p) => ({ ...p, shiftX: Number(e.target.value) }))
                  }
                  className="w-full accent-[var(--accent-primary)]"
                />
              </label>

              <label className="block space-y-1">
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">
                    Desplazamiento vertical Δy [-6, +6 px]
                  </span>
                  <span className="font-mono tabular-nums text-[var(--text-primary)]">
                    {simulationConfig.shiftY > 0 ? `+${simulationConfig.shiftY}` : simulationConfig.shiftY} px
                  </span>
                </div>
                <input
                  type="range"
                  min={-6}
                  max={6}
                  step={1}
                  value={simulationConfig.shiftY}
                  onChange={(e) =>
                    setSimulationConfig((p) => ({ ...p, shiftY: Number(e.target.value) }))
                  }
                  className="w-full accent-[var(--accent-primary)]"
                />
              </label>

              <label className="block space-y-1">
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">
                    Nivel de ruido Gaussiano σ [0.00, 0.60]
                  </span>
                  <span className="font-mono tabular-nums text-[var(--text-primary)]">
                    {simulationConfig.noiseLevel.toFixed(2)} σ
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={0.6}
                  step={0.05}
                  value={simulationConfig.noiseLevel}
                  onChange={(e) =>
                    setSimulationConfig((p) => ({ ...p, noiseLevel: Number(e.target.value) }))
                  }
                  className="w-full accent-[var(--accent-primary)]"
                />
              </label>

              <label className="block space-y-1">
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">
                    Intensidad de perturbación [0%, 100%]
                  </span>
                  <span className="font-mono tabular-nums text-[var(--text-primary)]">
                    {Math.round(simulationConfig.perturbationIntensity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={simulationConfig.perturbationIntensity}
                  onChange={(e) =>
                    setSimulationConfig((p) => ({
                      ...p,
                      perturbationIntensity: Number(e.target.value),
                    }))
                  }
                  className="w-full accent-[var(--accent-primary)]"
                />
              </label>

              <div className="grid grid-cols-3 gap-2 pt-1">
                <label className="space-y-1">
                  <span className="text-[11px] text-[var(--text-muted)]">η [0.001–0.2]</span>
                  <input
                    type="number"
                    min={0.001}
                    max={0.2}
                    step={0.005}
                    value={simulationConfig.learningRate}
                    onChange={(e) =>
                      setSimulationConfig((p) => ({
                        ...p,
                        learningRate: Math.max(0.001, Math.min(0.2, Number(e.target.value) || 0.01)),
                      }))
                    }
                    className="w-full px-2 py-1.5 rounded-lg font-mono surface-elevated text-[var(--text-primary)]"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-[11px] text-[var(--text-muted)]">Épocas [0–15]</span>
                  <input
                    type="number"
                    min={0}
                    max={15}
                    step={1}
                    value={simulationConfig.epochs}
                    onChange={(e) =>
                      setSimulationConfig((p) => ({
                        ...p,
                        epochs: Math.max(0, Math.min(15, Math.round(Number(e.target.value) || 0))),
                      }))
                    }
                    className="w-full px-2 py-1.5 rounded-lg font-mono surface-elevated text-[var(--text-primary)]"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-[11px] text-[var(--text-muted)]">Semilla</span>
                  <input
                    type="number"
                    min={1}
                    max={999999}
                    value={simulationConfig.seed}
                    onChange={(e) =>
                      setSimulationConfig((p) => ({
                        ...p,
                        seed: Math.max(1, Math.round(Number(e.target.value) || 2026)),
                      }))
                    }
                    className="w-full px-2 py-1.5 rounded-lg font-mono surface-elevated text-[var(--text-primary)]"
                  />
                </label>
              </div>
            </div>

            <button
              type="button"
              disabled={isAlphaBlocked}
              onClick={handleRunBeforeAfter}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-contrast)] disabled:opacity-50 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              Ejecutar Experimento Antes / Después
            </button>
          </div>

          {/* Right: Before vs After Comparisons */}
          <div className="lg:col-span-7 space-y-5">
            {beforeAfterRes ? (
              <div className="surface-card rounded-2xl p-5 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-hairline)] pb-3 text-xs">
                  <span className="font-semibold text-[var(--text-primary)]">
                    Comparación Experimental [Evaluación sobre Copia Aislada]
                  </span>
                  <span className="font-mono tabular-nums text-[var(--text-muted)]">
                    Semilla {beforeAfterRes.config.seed} · {beforeAfterRes.durationMs} ms
                  </span>
                </div>

                {/* Grids + Predictions + Loss */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="surface-elevated rounded-xl p-4 flex items-center gap-4">
                    {renderGridPreview(beforeAfterRes.originalGrid, '56, 189, 248')}
                    <div className="space-y-1 text-xs">
                      <div className="text-[var(--text-muted)]">Estado Original (Antes)</div>
                      <div className="text-xl font-mono font-bold text-[var(--text-primary)]">
                        {beforeAfterRes.originalTopLabel} · {(beforeAfterRes.originalConfidence * 100).toFixed(1)}%
                      </div>
                      <div className="font-mono tabular-nums text-[var(--text-secondary)]">
                        Loss CE: {beforeAfterRes.lossBefore.toFixed(4)}
                      </div>
                    </div>
                  </div>

                  <div className="surface-elevated rounded-xl p-4 flex items-center gap-4">
                    {renderGridPreview(beforeAfterRes.modifiedGrid, '139, 92, 246')}
                    <div className="space-y-1 text-xs">
                      <div className="text-[var(--text-muted)]">Estado Intervenido (Después)</div>
                      <div
                        className={`text-xl font-mono font-bold ${
                          beforeAfterRes.modifiedTopLabel === beforeAfterRes.originalTopLabel
                            ? 'text-[var(--status-ok)]'
                            : 'text-[var(--status-err)]'
                        }`}
                      >
                        {beforeAfterRes.modifiedTopLabel} · {(beforeAfterRes.modifiedConfidence * 100).toFixed(1)}%
                      </div>
                      <div className="font-mono tabular-nums text-[var(--text-secondary)]">
                        Loss CE: {beforeAfterRes.lossAfter.toFixed(4)} (Δ{' '}
                        {(beforeAfterRes.lossAfter - beforeAfterRes.lossBefore >= 0 ? '+' : '')}
                        {(beforeAfterRes.lossAfter - beforeAfterRes.lossBefore).toFixed(4)})
                      </div>
                    </div>
                  </div>
                </div>

                {/* Softmax Before vs After BarChart */}
                <SoftmaxBarChart
                  title="Distribución Softmax: Antes vs Después"
                  subtitle="Comparación porcentual de probabilidades antes y después de la perturbación"
                  mode="compare"
                  data={beforeAfterRes.softmaxComparison.map((row) => ({
                    label: row.label,
                    prob: row.afterPct,
                    beforePct: row.beforePct,
                    afterPct: row.afterPct,
                  }))}
                  exportFilename="vectoria_sim_softmax_antes_despues"
                  heightClass="h-56"
                />

                {/* Layer Activation Diffs */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-[var(--text-secondary)]">
                    Cambio en Activaciones por Capa
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-[var(--border-hairline)] text-[var(--text-muted)]">
                          <th className="py-1.5 text-left">Capa</th>
                          <th className="py-1.5 text-right">Media Antes</th>
                          <th className="py-1.5 text-right">Media Después</th>
                          <th className="py-1.5 text-right">Δ L1 Medio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {beforeAfterRes.layerDiffs.map((d) => (
                          <tr key={d.layerName} className="border-b border-[var(--border-hairline)] last:border-none font-mono tabular-nums">
                            <td className="py-1.5 font-sans text-[var(--text-primary)]">{d.layerName}</td>
                            <td className="py-1.5 text-right">{d.meanBefore.toFixed(4)}</td>
                            <td className="py-1.5 text-right">{d.meanAfter.toFixed(4)}</td>
                            <td className="py-1.5 text-right text-[var(--accent-primary)]">{d.l1Delta.toFixed(4)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Cross-module Integration Actions */}
                <div className="pt-2 border-t border-[var(--border-hairline)] flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      sendExperimentToTopology(
                        beforeAfterRes.modifiedGrid,
                        beforeAfterRes.config.mode
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[var(--accent-primary)] text-[var(--accent-contrast)] cursor-pointer whitespace-nowrap"
                  >
                    <Network className="w-3.5 h-3.5" />
                    Ver entrada modificada en Topología
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      askOmniAboutExperiment(
                        `Experimento Antes/Después sobre "${beforeAfterRes.config.targetGlyph}" (modo ${beforeAfterRes.config.mode}, Δx=${beforeAfterRes.config.shiftX}px, Δy=${beforeAfterRes.config.shiftY}px, ruido σ=${beforeAfterRes.config.noiseLevel}, perturbación=${Math.round(beforeAfterRes.config.perturbationIntensity * 100)}%, épocas aisladas=${beforeAfterRes.config.epochs}):\n- Predicción original: ${beforeAfterRes.originalTopLabel} (${(beforeAfterRes.originalConfidence * 100).toFixed(2)}%), Loss=${beforeAfterRes.lossBefore.toFixed(4)}\n- Predicción modificada: ${beforeAfterRes.modifiedTopLabel} (${(beforeAfterRes.modifiedConfidence * 100).toFixed(2)}%), Loss=${beforeAfterRes.lossAfter.toFixed(4)}`
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-[var(--border-strong)] surface-elevated text-[var(--text-primary)] cursor-pointer whitespace-nowrap"
                  >
                    <Bot className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    Explicar resultados con Omni Bot
                  </button>
                </div>
              </div>
            ) : (
              <div className="surface-card rounded-2xl p-10 text-center space-y-2">
                <FlaskConical className="w-8 h-8 text-[var(--accent-primary)] mx-auto" />
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  Configura los parámetros y ejecuta el experimento Antes / Después
                </p>
                <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">
                  Podrás comparar la entrada original vs modificada, la distribución Softmax, las activaciones por capa, la función de pérdida y enviar el resultado directo a Topología Neuronal u Omni Bot.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: DIDACTIC 3-2-2 MODEL VS 784-128-10 / 256-32-24-K */}
      {tab === 'didactic-322' && (
        <div className="space-y-6">
          <div className="surface-card rounded-2xl p-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="surface-elevated rounded-xl p-4 space-y-1.5">
              <div className="font-semibold text-[var(--accent-primary)]">
                Modelo Didáctico 3–2–2 (Editable aquí · Simulación Controlada)
              </div>
              <p className="text-[var(--text-secondary)] leading-relaxed">
                Red compacta de 3 entradas, 2 neuronas ocultas ReLU y 2 salidas Softmax (14 parámetros totales). Diseñada para editar cada peso y sesgo manualmente y observar el descenso del gradiente exacto.
              </p>
            </div>
            <div className="surface-elevated rounded-xl p-4 space-y-1.5">
              <div className="font-semibold text-[var(--accent-secondary)]">
                Arquitectura Clasificadora VectorIA (256→32→24→K) vs Referencia MNIST (784–128–10)
              </div>
              <p className="text-[var(--text-secondary)] leading-relaxed">
                El modelo estándar MNIST procesa imágenes 28×28 (784 entradas, 128 ocultas, 10 salidas = 101,770 parámetros). En VectorIA usamos 16×16 (256→32→24→K) para entrenamiento instantáneo en navegador; sus pesos originales nunca se modifican desde este laboratorio.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Direct weight, bias, input, LR editor */}
            <div className="lg:col-span-6 surface-card rounded-2xl p-5 space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                  Editor Manual de Pesos, Sesgos y Entrada (3–2–2)
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setDidacticCfg(createDefaultDidactic322Config());
                    setDidacticLastStep(null);
                    setDidacticLossHistory([]);
                  }}
                  className="inline-flex items-center gap-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reiniciar 3–2–2
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {didacticCfg.x.map((val, idx) => (
                  <label key={idx} className="space-y-1">
                    <span className="text-[var(--text-muted)] font-mono">x{idx + 1}</span>
                    <input
                      type="number"
                      step={0.05}
                      value={val}
                      onChange={(e) => {
                        const nextX = [...didacticCfg.x] as [number, number, number];
                        nextX[idx] = Number(e.target.value) || 0;
                        setDidacticCfg((c) => ({ ...c, x: nextX }));
                      }}
                      className="w-full px-2 py-1.5 rounded-lg font-mono surface-elevated text-[var(--text-primary)]"
                    />
                  </label>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <label className="space-y-1">
                  <span className="text-[var(--text-muted)]">Clase objetivo y</span>
                  <select
                    value={didacticCfg.yTargetIndex}
                    onChange={(e) =>
                      setDidacticCfg((c) => ({
                        ...c,
                        yTargetIndex: Number(e.target.value) as 0 | 1,
                      }))
                    }
                    className="w-full px-2 py-1.5 rounded-lg font-mono surface-elevated text-[var(--text-primary)]"
                  >
                    <option value={0}>Clase 0 [1, 0]</option>
                    <option value={1}>Clase 1 [0, 1]</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-[var(--text-muted)]">Tasa η [0.01–0.8]</span>
                  <input
                    type="number"
                    min={0.01}
                    max={0.8}
                    step={0.05}
                    value={didacticCfg.learningRate}
                    onChange={(e) =>
                      setDidacticCfg((c) => ({
                        ...c,
                        learningRate: Math.max(0.01, Math.min(0.8, Number(e.target.value) || 0.1)),
                      }))
                    }
                    className="w-full px-2 py-1.5 rounded-lg font-mono surface-elevated text-[var(--text-primary)]"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-[var(--text-muted)]">Épocas lote</span>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={didacticEpochsBatch}
                    onChange={(e) =>
                      setDidacticEpochsBatch(Math.max(1, Math.min(50, Number(e.target.value) || 5)))
                    }
                    className="w-full px-2 py-1.5 rounded-lg font-mono surface-elevated text-[var(--text-primary)]"
                  />
                </label>
              </div>

              {/* W1 + b1 */}
              <div className="space-y-2">
                <div className="font-semibold text-[var(--text-secondary)]">
                  Capa Oculta W⁽¹⁾ (2×3) y sesgos b⁽¹⁾
                </div>
                {didacticCfg.W1.map((row, r) => (
                  <div key={r} className="grid grid-cols-4 gap-2 items-center">
                    {row.map((w, c) => (
                      <input
                        key={c}
                        type="number"
                        step={0.05}
                        value={w}
                        onChange={(e) => {
                          const W1 = didacticCfg.W1.map((rw) => [...rw]) as Didactic322Config['W1'];
                          W1[r][c] = Number(e.target.value) || 0;
                          setDidacticCfg((cfg) => ({ ...cfg, W1 }));
                        }}
                        aria-label={`W1[${r + 1},${c + 1}]`}
                        className="px-2 py-1.5 rounded-lg font-mono surface-elevated text-[var(--text-primary)]"
                      />
                    ))}
                    <input
                      type="number"
                      step={0.05}
                      value={didacticCfg.b1[r]}
                      onChange={(e) => {
                        const b1 = [...didacticCfg.b1] as [number, number];
                        b1[r] = Number(e.target.value) || 0;
                        setDidacticCfg((cfg) => ({ ...cfg, b1 }));
                      }}
                      aria-label={`b1[${r + 1}]`}
                      className="px-2 py-1.5 rounded-lg font-mono surface-elevated text-[var(--accent-primary)]"
                    />
                  </div>
                ))}
              </div>

              {/* W2 + b2 */}
              <div className="space-y-2">
                <div className="font-semibold text-[var(--text-secondary)]">
                  Capa Salida W⁽²⁾ (2×2) y sesgos b⁽²⁾
                </div>
                {didacticCfg.W2.map((row, r) => (
                  <div key={r} className="grid grid-cols-3 gap-2 items-center">
                    {row.map((w, c) => (
                      <input
                        key={c}
                        type="number"
                        step={0.05}
                        value={w}
                        onChange={(e) => {
                          const W2 = didacticCfg.W2.map((rw) => [...rw]) as Didactic322Config['W2'];
                          W2[r][c] = Number(e.target.value) || 0;
                          setDidacticCfg((cfg) => ({ ...cfg, W2 }));
                        }}
                        aria-label={`W2[${r + 1},${c + 1}]`}
                        className="px-2 py-1.5 rounded-lg font-mono surface-elevated text-[var(--text-primary)]"
                      />
                    ))}
                    <input
                      type="number"
                      step={0.05}
                      value={didacticCfg.b2[r]}
                      onChange={(e) => {
                        const b2 = [...didacticCfg.b2] as [number, number];
                        b2[r] = Number(e.target.value) || 0;
                        setDidacticCfg((cfg) => ({ ...cfg, b2 }));
                      }}
                      aria-label={`b2[${r + 1}]`}
                      className="px-2 py-1.5 rounded-lg font-mono surface-elevated text-[var(--accent-secondary)]"
                    />
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleRunDidacticSteps(1)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg font-semibold bg-[var(--accent-primary)] text-[var(--accent-contrast)] cursor-pointer whitespace-nowrap"
                >
                  <Play className="w-3.5 h-3.5" />
                  1 Paso (Forward + Backprop)
                </button>
                <button
                  type="button"
                  onClick={() => handleRunDidacticSteps(didacticEpochsBatch)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg font-semibold border border-[var(--border-strong)] surface-elevated text-[var(--text-primary)] cursor-pointer whitespace-nowrap"
                >
                  Ejecutar {didacticEpochsBatch} Épocas
                </button>
              </div>
            </div>

            {/* Right: Computed Forward, Gradients & Loss Evolution */}
            <div className="lg:col-span-6 space-y-4">
              {didacticLastStep ? (
                <div className="surface-card rounded-2xl p-5 space-y-4 text-xs">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    Resultado Matemático del Último Paso [Simulación Didáctica 3–2–2]
                  </h3>

                  <div className="grid grid-cols-2 gap-3 font-mono tabular-nums">
                    <div className="surface-elevated rounded-xl p-3 space-y-1">
                      <div className="text-[var(--text-muted)] font-sans">Activaciones Ocultas</div>
                      <div>Z⁽¹⁾ = [{didacticLastStep.z1.map((n) => n.toFixed(4)).join(', ')}]</div>
                      <div className="text-[var(--accent-secondary)]">
                        A⁽¹⁾ = ReLU(Z⁽¹⁾) = [{didacticLastStep.a1.map((n) => n.toFixed(4)).join(', ')}]
                      </div>
                    </div>
                    <div className="surface-elevated rounded-xl p-3 space-y-1">
                      <div className="text-[var(--text-muted)] font-sans">Salida Softmax y Pérdida</div>
                      <div>
                        ŷ antes: [{didacticLastStep.probsBefore.map((p) => (p * 100).toFixed(1) + '%').join(', ')}]
                      </div>
                      <div className="text-[var(--accent-primary)]">
                        ŷ después: [{didacticLastStep.probsAfter.map((p) => (p * 100).toFixed(1) + '%').join(', ')}]
                      </div>
                      <div>
                        Loss: {didacticLastStep.lossBefore.toFixed(4)} →{' '}
                        <span className="text-[var(--status-ok)]">
                          {didacticLastStep.lossAfter.toFixed(4)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="surface-elevated rounded-xl p-3 font-mono tabular-nums space-y-1">
                    <div className="text-[var(--text-muted)] font-sans font-semibold">
                      Gradientes calculados (∇W⁽²⁾ y ∇W⁽¹⁾)
                    </div>
                    <div>
                      ∇W⁽²⁾ = [[{didacticLastStep.gradW2[0].map((v) => v.toFixed(4)).join(', ')}], [
                      {didacticLastStep.gradW2[1].map((v) => v.toFixed(4)).join(', ')}]]
                    </div>
                    <div>
                      ∇W⁽¹⁾ = [[{didacticLastStep.gradW1[0].map((v) => v.toFixed(4)).join(', ')}], [
                      {didacticLastStep.gradW1[1].map((v) => v.toFixed(4)).join(', ')}]]
                    </div>
                  </div>

                  {didacticLossHistory.length > 0 && (
                    <LossAccuracyChart
                      title="Curva de Pérdida Cross-Entropy · Red Didáctica 3–2–2"
                      subtitle="Evolución paso a paso en copia experimental aislada"
                      xLabel="Paso"
                      hasAccuracy={false}
                      data={didacticLossHistory.map((p) => ({ step: p.step, loss: p.loss }))}
                      exportFilename="vectoria_sim_didactic_322_loss"
                      heightClass="h-52"
                    />
                  )}
                </div>
              ) : (
                <div className="surface-card rounded-2xl p-8 text-center text-xs text-[var(--text-muted)]">
                  Edita los pesos, sesgos o entrada y ejecuta un paso o varias épocas para observar la evolución real de la función de pérdida en la red 3–2–2.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: A/B EXPERIMENTAL MODE */}
      {tab === 'ab-mode' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(
              [
                { key: 'A', state: scenarioA, setter: setScenarioA },
                { key: 'B', state: scenarioB, setter: setScenarioB },
              ] as const
            ).map((sc) => (
              <div key={sc.key} className="surface-card rounded-2xl p-5 space-y-3 text-xs">
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                  {sc.state.label}
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1">
                    <span className="text-[var(--text-muted)]">Δx [-6, +6 px]</span>
                    <input
                      type="number"
                      min={-6}
                      max={6}
                      value={sc.state.shiftX}
                      onChange={(e) =>
                        sc.setter((p) => ({ ...p, shiftX: Number(e.target.value) || 0 }))
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg font-mono surface-elevated"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[var(--text-muted)]">Δy [-6, +6 px]</span>
                    <input
                      type="number"
                      min={-6}
                      max={6}
                      value={sc.state.shiftY}
                      onChange={(e) =>
                        sc.setter((p) => ({ ...p, shiftY: Number(e.target.value) || 0 }))
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg font-mono surface-elevated"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[var(--text-muted)]">Ruido σ [0–0.6]</span>
                    <input
                      type="number"
                      min={0}
                      max={0.6}
                      step={0.05}
                      value={sc.state.noiseLevel}
                      onChange={(e) =>
                        sc.setter((p) => ({ ...p, noiseLevel: Number(e.target.value) || 0 }))
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg font-mono surface-elevated"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[var(--text-muted)]">Perturbación [0–1]</span>
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step={0.05}
                      value={sc.state.perturbationIntensity}
                      onChange={(e) =>
                        sc.setter((p) => ({
                          ...p,
                          perturbationIntensity: Number(e.target.value) || 0,
                        }))
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg font-mono surface-elevated"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[var(--text-muted)]">Tasa η [0.001–0.2]</span>
                    <input
                      type="number"
                      min={0.001}
                      max={0.2}
                      step={0.01}
                      value={sc.state.learningRate}
                      onChange={(e) =>
                        sc.setter((p) => ({ ...p, learningRate: Number(e.target.value) || 0.03 }))
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg font-mono surface-elevated"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[var(--text-muted)]">Épocas aisladas [0–15]</span>
                    <input
                      type="number"
                      min={0}
                      max={15}
                      value={sc.state.epochs}
                      onChange={(e) =>
                        sc.setter((p) => ({
                          ...p,
                          epochs: Math.max(0, Math.min(15, Math.round(Number(e.target.value) || 0))),
                        }))
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg font-mono surface-elevated"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-[var(--text-muted)]">
              Ambos escenarios parten de copias aisladas idénticas del modelo ({simulationConfig.mode}) y carácter objetivo "{simulationConfig.targetGlyph}".
            </div>
            <button
              type="button"
              disabled={isAlphaBlocked}
              onClick={handleRunAB}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold bg-[var(--accent-primary)] text-[var(--accent-contrast)] disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              <GitCompare className="w-4 h-4" />
              Ejecutar Comparativa A/B
            </button>
          </div>

          {abResult && (
            <div className="surface-card rounded-2xl p-5 space-y-5 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="surface-elevated rounded-xl p-4 space-y-1 font-mono tabular-nums">
                  <div className="font-sans font-semibold text-[var(--chart-2)]">
                    Escenario A — Resultado
                  </div>
                  <div>Predicción: {abResult.scenarioA.topLabel}</div>
                  <div>
                    Confianza objetivo "{abResult.targetGlyph}":{' '}
                    {(abResult.scenarioA.targetConfidence * 100).toFixed(2)}%
                  </div>
                  <div>Loss CE: {abResult.scenarioA.loss.toFixed(4)}</div>
                  <div>Exactitud validación: {(abResult.scenarioA.valAccuracy * 100).toFixed(2)}%</div>
                </div>

                <div className="surface-elevated rounded-xl p-4 space-y-1 font-mono tabular-nums">
                  <div className="font-sans font-semibold text-[var(--chart-1)]">
                    Escenario B — Resultado
                  </div>
                  <div>Predicción: {abResult.scenarioB.topLabel}</div>
                  <div>
                    Confianza objetivo "{abResult.targetGlyph}":{' '}
                    {(abResult.scenarioB.targetConfidence * 100).toFixed(2)}%
                  </div>
                  <div>Loss CE: {abResult.scenarioB.loss.toFixed(4)}</div>
                  <div>Exactitud validación: {(abResult.scenarioB.valAccuracy * 100).toFixed(2)}%</div>
                </div>
              </div>

              {abResult.changedParams.length > 0 && (
                <div>
                  <div className="font-semibold text-[var(--text-secondary)] mb-2">
                    Parámetros modificados entre A y B
                  </div>
                  <table className="w-full font-mono text-xs">
                    <thead>
                      <tr className="border-b border-[var(--border-hairline)] text-[var(--text-muted)]">
                        <th className="py-1.5 text-left font-sans">Parámetro</th>
                        <th className="py-1.5 text-right">Escenario A</th>
                        <th className="py-1.5 text-right">Escenario B</th>
                      </tr>
                    </thead>
                    <tbody>
                      {abResult.changedParams.map((ch) => (
                        <tr key={ch.param} className="border-b border-[var(--border-hairline)] last:border-none">
                          <td className="py-1.5 font-sans text-[var(--text-primary)]">{ch.param}</td>
                          <td className="py-1.5 text-right text-[var(--text-secondary)]">{ch.valueA}</td>
                          <td className="py-1.5 text-right text-[var(--accent-primary)]">{ch.valueB}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: BATCH ROBUSTNESS + REPRODUCIBLE HISTORY */}
      {tab === 'batch-history' && (
        <div className="space-y-6">
          {/* Batch evaluation over selected classes */}
          <div className="surface-card rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                  Pruebas por Lotes y Análisis de Sensibilidad (Semilla {simulationConfig.seed})
                </h2>
                <p className="text-xs text-[var(--text-muted)]">
                  Evalúa exactitud por clase bajo Δx={simulationConfig.shiftX}px, Δy={simulationConfig.shiftY}px, ruido σ={simulationConfig.noiseLevel} y perturbación {Math.round(simulationConfig.perturbationIntensity * 100)}%.
                </p>
              </div>
              <button
                type="button"
                disabled={isAlphaBlocked}
                onClick={handleRunBatch}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-[var(--accent-primary)] text-[var(--accent-contrast)] disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                <Play className="w-3.5 h-3.5" />
                Ejecutar Lote Completo
              </button>
            </div>

            <div className="space-y-1.5">
              <div className="text-xs text-[var(--text-muted)]">
                Filtrar clases (vacío = todas las clases del modo):
              </div>
              <div className="flex flex-wrap gap-1.5">
                {availableGlyphs.slice(0, 16).map((lbl) => {
                  const selected = simulationConfig.selectedClasses.includes(lbl);
                  return (
                    <button
                      key={lbl}
                      type="button"
                      onClick={() => toggleClassSelection(lbl)}
                      className={`w-7 h-7 rounded font-mono text-xs cursor-pointer border ${
                        selected
                          ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-primary)] font-semibold'
                          : 'border-[var(--border-hairline)] surface-elevated text-[var(--text-muted)]'
                      }`}
                    >
                      {lbl}
                    </button>
                  );
                })}
              </div>
            </div>

            {batchResult && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-2">
                <div className="lg:col-span-6 overflow-x-auto">
                  <table className="w-full text-xs font-mono tabular-nums">
                    <thead>
                      <tr className="border-b border-[var(--border-hairline)] text-[var(--text-muted)]">
                        <th className="py-1.5 text-left font-sans">Clase</th>
                        <th className="py-1.5 text-right">Muestras</th>
                        <th className="py-1.5 text-right">Limpia</th>
                        <th className="py-1.5 text-right">Perturbada</th>
                        <th className="py-1.5 text-right">Δ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchResult.perClass.map((row) => (
                        <tr key={row.label} className="border-b border-[var(--border-hairline)] last:border-none">
                          <td className="py-1.5 font-bold text-[var(--text-primary)]">{row.label}</td>
                          <td className="py-1.5 text-right text-[var(--text-muted)]">{row.count}</td>
                          <td className="py-1.5 text-right">{row.cleanAcc}%</td>
                          <td className="py-1.5 text-right">{row.perturbedAcc}%</td>
                          <td
                            className={`py-1.5 text-right ${
                              row.deltaAcc < 0 ? 'text-[var(--status-err)]' : 'text-[var(--status-ok)]'
                            }`}
                          >
                            {row.deltaAcc > 0 ? `+${row.deltaAcc}%` : `${row.deltaAcc}%`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="lg:col-span-6">
                  <ScientificChartCard
                    title="Curva de Sensibilidad del Lote ante Ruido Gaussiano"
                    subtitle="Exactitud medida sobre el conjunto evaluado al variar σ de ruido"
                    exportFilename="vectoria_sim_sensibilidad_ruido"
                    dataTable={{
                      columns: ['Ruido σ', 'Exactitud (%)'],
                      rows: batchResult.sensitivityCurve.map((p) => [
                        p.noiseSigma,
                        `${p.accuracyPct.toFixed(1)}%`,
                      ]),
                    }}
                  >
                    <div className="h-56 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={batchResult.sensitivityCurve}
                          margin={{ top: 10, right: 16, left: 0, bottom: 4 }}
                        >
                          <defs>
                            <linearGradient id={`simSensGrad-${simUid}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={palette.accentPrimary} stopOpacity={0.38} />
                              <stop offset="95%" stopColor={palette.accentPrimary} stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke={palette.borderHairline} vertical={false} />
                          <XAxis
                            dataKey="noiseSigma"
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
                                decimals={1}
                                unitByKey={{ accuracyPct: '%' }}
                              />
                            }
                          />
                          <Area
                            type="monotone"
                            dataKey="accuracyPct"
                            name="Exactitud lote"
                            stroke={palette.accentPrimary}
                            strokeWidth={2.5}
                            fill={`url(#simSensGrad-${simUid})`}
                            dot={{ r: 3.5, fill: palette.accentSecondary, stroke: palette.bgCanvas, strokeWidth: 1.5 }}
                            activeDot={{ r: 5, fill: palette.accentSecondary }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </ScientificChartCard>
                </div>
              </div>
            )}
          </div>

          {/* Experiment History & Reproducibility */}
          <div className="surface-card rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                <History className="w-4 h-4 text-[var(--accent-primary)]" />
                <span>Historial y Reproducibilidad ({simulationHistory.length})</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={simulationHistory.length === 0}
                  onClick={handleExportHistory}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border-hairline)] surface-elevated text-[var(--text-primary)] disabled:opacity-50 cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  Exportar JSON
                </button>
                <button
                  type="button"
                  disabled={simulationHistory.length === 0}
                  onClick={clearSimulationHistory}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border-hairline)] text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-50 cursor-pointer"
                >
                  Limpiar historial
                </button>
              </div>
            </div>

            {simulationHistory.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] py-4">
                Aún no has ejecutado experimentos en esta sesión. Cada simulación registrada aquí guarda su semilla, parámetros exactos, duración y métricas.
              </p>
            ) : (
              <>
                {simulationHistory.length >= 2 && (
                  <div className="surface-elevated rounded-xl p-4 space-y-2 text-xs">
                    <div className="font-semibold text-[var(--text-secondary)]">
                      Comparar dos ejecuciones del historial
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <select
                        value={compareIds[0]}
                        onChange={(e) => setCompareIds([e.target.value, compareIds[1]])}
                        className="px-2.5 py-1.5 rounded-lg surface-card text-[var(--text-primary)]"
                      >
                        <option value="">Selecciona ejecución 1...</option>
                        {simulationHistory.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.title} ({new Date(r.timestamp).toLocaleTimeString()})
                          </option>
                        ))}
                      </select>
                      <select
                        value={compareIds[1]}
                        onChange={(e) => setCompareIds([compareIds[0], e.target.value])}
                        className="px-2.5 py-1.5 rounded-lg surface-card text-[var(--text-primary)]"
                      >
                        <option value="">Selecciona ejecución 2...</option>
                        {simulationHistory.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.title} ({new Date(r.timestamp).toLocaleTimeString()})
                          </option>
                        ))}
                      </select>
                    </div>
                    {comparedRun1 && comparedRun2 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 font-mono text-[11px]">
                        <div className="p-2.5 rounded bg-[var(--bg-canvas)]">
                          <div className="font-sans font-semibold text-[var(--text-primary)]">
                            {comparedRun1.title}
                          </div>
                          <div className="text-[var(--text-secondary)] mt-1">{comparedRun1.summary}</div>
                        </div>
                        <div className="p-2.5 rounded bg-[var(--bg-canvas)]">
                          <div className="font-sans font-semibold text-[var(--text-primary)]">
                            {comparedRun2.title}
                          </div>
                          <div className="text-[var(--text-secondary)] mt-1">{comparedRun2.summary}</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[var(--border-hairline)] text-[var(--text-muted)]">
                        <th className="py-2 text-left">Experimento</th>
                        <th className="py-2 text-left">Resumen</th>
                        <th className="py-2 text-right">Duración</th>
                        <th className="py-2 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {simulationHistory.map((run) => (
                        <tr key={run.id} className="border-b border-[var(--border-hairline)] last:border-none">
                          <td className="py-2.5 pr-3">
                            <div className="font-medium text-[var(--text-primary)]">{run.title}</div>
                            <div className="text-[11px] font-mono text-[var(--text-muted)]">
                              {new Date(run.timestamp).toLocaleTimeString()} · semilla {run.config.seed}
                            </div>
                          </td>
                          <td className="py-2.5 pr-3 text-[var(--text-secondary)]">{run.summary}</td>
                          <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-[var(--text-muted)]">
                            {run.durationMs} ms
                          </td>
                          <td className="py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => handleRestoreConfig(run)}
                              className="text-xs font-semibold text-[var(--accent-primary)] hover:underline cursor-pointer whitespace-nowrap"
                            >
                              Recuperar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'perturb-784' && <Perturbation28x28Panel />}
      {tab === 'didactic-232' && <Didactic232BackpropPanel />}
    </div>
  );
};
