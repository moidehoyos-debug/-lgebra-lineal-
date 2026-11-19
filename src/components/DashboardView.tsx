import React, { useEffect, useId, useMemo, useState } from 'react';
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Award,
  Bell,
  Bot,
  Box,
  Calculator,
  Compass,
  Cpu,
  Eye,
  EyeOff,
  FlaskConical,
  Grid3X3,
  Network,
  RotateCcw,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  Zap,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useStudio } from '../context/StudioContext';
import { getMnist784Meta } from '../engines/mnist784Engine';
import { runBeforeAfterExperiment } from '../engines/simulationEngine';
import { ModuleId, SimulationRunRecord } from '../types/vectoria';
import {
  buildSimulationPerformanceSeries,
  computeLaboratorySummaries,
  computeSimulationPerformanceStats,
} from '../utils/dashboardMetrics';
import { ThemeSwitcher } from './ThemeSwitcher';
import { HeroNeuralShowcase } from './HeroNeuralShowcase';
import { DEVELOPMENT_TEAM_SCROLL_KEY } from './DevelopmentTeamSection';
import { loadDevelopmentTeam } from '../config/developmentTeam';
import { ScientificChartCard } from './charts/ScientificChartCard';
import { ScientificTooltip } from './charts/ScientificTooltip';
import { ClassifierTrainingProgressCard } from './charts/ClassifierTrainingProgressCard';
import { useChartPalette } from './charts/chartTheme';

type DashboardPanelId = 'hero' | 'lab-widgets' | 'telemetry' | 'themes' | 'labs';
type LabWidgetFilter = 'all' | 'neural' | 'simulation' | 'algebra';

interface PanelConfigItem {
  id: DashboardPanelId;
  label: string;
  visible: boolean;
}

const DEFAULT_PANELS: PanelConfigItem[] = [
  { id: 'hero', label: 'Centro de Operaciones y Estado de Modelos', visible: true },
  {
    id: 'lab-widgets',
    label: 'Resúmenes Estadísticos Dinámicos por Laboratorio',
    visible: true,
  },
  { id: 'telemetry', label: 'Actividad en Vivo, Gráficas e Indicadores', visible: true },
  { id: 'themes', label: 'Sistema Visual Dinámico (6 Temas)', visible: true },
  { id: 'labs', label: 'Laboratorios y Módulos Técnicos', visible: true },
];

const DASHBOARD_LAYOUT_KEY = 'vectoria-dashboard-layout-v2';

function loadDashboardLayout(): PanelConfigItem[] {
  try {
    const raw = window.localStorage.getItem(DASHBOARD_LAYOUT_KEY);
    if (!raw) return DEFAULT_PANELS;
    const parsed = JSON.parse(raw) as PanelConfigItem[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return DEFAULT_PANELS;
    }
    const validIds = new Set(DEFAULT_PANELS.map((p) => p.id));
    if (!parsed.every((p) => validIds.has(p.id) && typeof p.visible === 'boolean')) {
      return DEFAULT_PANELS;
    }
    const presentIds = new Set(parsed.map((p) => p.id));
    const missing = DEFAULT_PANELS.filter((p) => !presentIds.has(p.id));
    if (missing.length === 0) {
      return parsed;
    }
    // Preserve previous user layout while inserting newly added lab-widgets panel cleanly
    const migrated = [...parsed];
    for (const item of missing) {
      const heroIdx = migrated.findIndex((p) => p.id === 'hero');
      if (item.id === 'lab-widgets' && heroIdx !== -1) {
        migrated.splice(heroIdx + 1, 0, item);
      } else {
        migrated.push(item);
      }
    }
    return migrated;
  } catch {
    return DEFAULT_PANELS;
  }
}

export const DashboardView: React.FC = () => {
  const {
    setActiveModule,
    digitsSummary,
    lettersSummary,
    alphanumericSummary,
    lastPrediction,
    predictionHistory,
    lastMathOutput,
    simulationHistory,
    mnist784Result,
    mnist784PerturbResult,
    last232Step,
    omniMessages,
    systemEvents,
    reportHistory,
    userProfile,
    apiLatencyHistory,
    recordApiLatency,
    clearApiLatencyHistory,
    suiteRef,
    simulationConfig,
    addSimulationRun,
    clearSimulationHistory,
    isTutorialOpen,
    openTutorial,
  } = useStudio();

  const palette = useChartPalette();
  const dashUid = useId().replace(/:/g, '');
  const [panels, setPanels] = useState<PanelConfigItem[]>(loadDashboardLayout);
  const [customizeMode, setCustomizeMode] = useState(false);
  const [widgetFilter, setWidgetFilter] = useState<LabWidgetFilter>('all');
  const [pingingApi, setPingingApi] = useState(false);
  const [simPerfFilter, setSimPerfFilter] = useState<'all' | SimulationRunRecord['kind']>('all');
  const [runningDiagSim, setRunningDiagSim] = useState(false);

  const labSummaries = useMemo(() => {
    const meta784 = getMnist784Meta();
    return computeLaboratorySummaries({
      digitsSummary,
      lettersSummary,
      alphanumericSummary,
      mnist784Exactitud: meta784.evaluacion.exactitud,
      mnist784Params: meta784.parametros,
      mnist784Result,
      mnist784PerturbResult,
      predictionHistory,
      simulationHistory,
      lastMathOutput,
      last232Step,
      systemEvents,
      reportCount: reportHistory.length,
      omniMessageCount: omniMessages.length,
    });
  }, [
    digitsSummary,
    lettersSummary,
    alphanumericSummary,
    mnist784Result,
    mnist784PerturbResult,
    predictionHistory,
    simulationHistory,
    lastMathOutput,
    last232Step,
    systemEvents,
    reportHistory.length,
    omniMessages.length,
  ]);

  const modelOverviewData = useMemo(() => {
    const meta784 = getMnist784Meta();
    return [
      {
        name: 'Dígitos 0–9',
        valPct: Number((digitsSummary.valAccuracy * 100).toFixed(1)),
        baselinePct: 10.0,
        loss: Number(digitsSummary.finalLoss.toFixed(4)),
        epochs: digitsSummary.epochsTrained,
        color: palette.chart1,
      },
      {
        name: 'Letras A–Z',
        valPct: Number((lettersSummary.valAccuracy * 100).toFixed(1)),
        baselinePct: Number((100 / 26).toFixed(1)),
        loss: Number(lettersSummary.finalLoss.toFixed(4)),
        epochs: lettersSummary.epochsTrained,
        color: palette.chart2,
      },
      {
        name: 'Combinado 36',
        valPct: alphanumericSummary.isTrained
          ? Number((alphanumericSummary.valAccuracy * 100).toFixed(1))
          : 0,
        baselinePct: Number((100 / 36).toFixed(1)),
        loss: alphanumericSummary.isTrained ? Number(alphanumericSummary.finalLoss.toFixed(4)) : 0,
        epochs: alphanumericSummary.epochsTrained,
        color: palette.chart3,
      },
      {
        name: '784–128–10',
        valPct: Number((meta784.evaluacion.exactitud * 100).toFixed(1)),
        baselinePct: 10.0,
        loss: 0,
        epochs: meta784.epocas,
        color: palette.chart4,
      },
    ];
  }, [digitsSummary, lettersSummary, alphanumericSummary, palette]);

  const sessionInferenceSeries = useMemo(() => {
    return [...predictionHistory]
      .slice(0, 20)
      .reverse()
      .map((item, idx) => ({
        idx: idx + 1,
        label: item.topLabel,
        confidencePct: Number((item.confidence * 100).toFixed(1)),
        entropyBits: Number(item.entropy.toFixed(3)),
      }));
  }, [predictionHistory]);

  const apiLatencySeries = useMemo(() => {
    return [...apiLatencyHistory]
      .slice(0, 25)
      .reverse()
      .map((item, idx) => ({
        idx: idx + 1,
        timeLabel: new Date(item.timestamp).toLocaleTimeString(),
        endpoint: `${item.method} ${item.endpoint}`,
        latencyMs: Number(item.latencyMs.toFixed(2)),
        status: item.status,
      }));
  }, [apiLatencyHistory]);

  const apiLatencyStats = useMemo(() => {
    if (apiLatencyHistory.length === 0) {
      return { avgMs: 0, minMs: 0, maxMs: 0, okRatePct: 0 };
    }
    const vals = apiLatencyHistory.map((r) => r.latencyMs);
    const sum = vals.reduce((a, b) => a + b, 0);
    const okCount = apiLatencyHistory.filter((r) => r.ok).length;
    return {
      avgMs: Number((sum / vals.length).toFixed(2)),
      minMs: Number(Math.min(...vals).toFixed(2)),
      maxMs: Number(Math.max(...vals).toFixed(2)),
      okRatePct: Number(((okCount / apiLatencyHistory.length) * 100).toFixed(1)),
    };
  }, [apiLatencyHistory]);

  const handleMeasureApiPing = async () => {
    if (pingingApi) return;
    setPingingApi(true);
    const t0 = performance.now();
    try {
      const res = await fetch('/api/health');
      const latencyMs = Number((performance.now() - t0).toFixed(2));
      recordApiLatency({
        endpoint: '/api/health',
        method: 'GET',
        status: res.status,
        latencyMs,
        ok: res.ok,
        source: 'dashboard-ping',
      });
    } catch {
      const latencyMs = Number((performance.now() - t0).toFixed(2));
      recordApiLatency({
        endpoint: '/api/health',
        method: 'GET',
        status: 500,
        latencyMs,
        ok: false,
        source: 'dashboard-ping',
      });
    } finally {
      setPingingApi(false);
    }
  };

  const simPerfSeries = useMemo(
    () => buildSimulationPerformanceSeries(simulationHistory, simPerfFilter, 30),
    [simulationHistory, simPerfFilter]
  );

  const simPerfStats = useMemo(
    () => computeSimulationPerformanceStats(simPerfSeries),
    [simPerfSeries]
  );

  const handleRunDiagnosticSimulation = () => {
    if (runningDiagSim) return;
    setRunningDiagSim(true);
    try {
      const suite = suiteRef.current;
      const diagConfig = { ...simulationConfig, mode: 'digits' as const };
      const res = runBeforeAfterExperiment(
        suite.digitsModel,
        suite.digitsTrain,
        suite.digitsVal,
        diagConfig
      );
      addSimulationRun({
        id: `sim-diag-${Date.now()}`,
        timestamp: new Date().toISOString(),
        kind: 'before-after',
        title: `Antes/Después · "${diagConfig.targetGlyph}" (digits)`,
        summary: `Pred: ${res.originalTopLabel} (${(res.originalConfidence * 100).toFixed(1)}%) → ${res.modifiedTopLabel} (${(res.modifiedConfidence * 100).toFixed(1)}%) | Duración ${res.durationMs.toFixed(2)} ms`,
        durationMs: res.durationMs,
        config: diagConfig,
        metrics: {
          predOriginal: res.originalTopLabel,
          confOriginalPct: Number((res.originalConfidence * 100).toFixed(2)),
          predModificada: res.modifiedTopLabel,
          confModificadaPct: Number((res.modifiedConfidence * 100).toFixed(2)),
          lossAntes: Number(res.lossBefore.toFixed(4)),
          lossDespues: Number(res.lossAfter.toFixed(4)),
        },
      });
    } finally {
      setRunningDiagSim(false);
    }
  };

  useEffect(() => {
    try {
      window.localStorage.setItem(DASHBOARD_LAYOUT_KEY, JSON.stringify(panels));
    } catch {
      // Ignore storage errors
    }
  }, [panels]);

  const movePanel = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= panels.length) return;
    setPanels((prev) => {
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  };

  const togglePanelVisibility = (id: DashboardPanelId) => {
    setPanels((prev) =>
      prev.map((p) => (p.id === id ? { ...p, visible: !p.visible } : p))
    );
  };

  const resetPanels = () => {
    setPanels(DEFAULT_PANELS);
  };

  const labs: Array<{
    id: ModuleId;
    title: string;
    subtitle: string;
    description: string;
    icon: React.FC<{ className?: string }>;
    metricText: string;
  }> = [
    {
      id: 'simulation-lab',
      title: 'Simulation Lab',
      subtitle: 'Intervención · Modelo 3–2–2 · A/B · Aislado',
      description:
        'Modifica desplazamiento X/Y, ruido, pesos didácticos y ejecuta experimentos A/B antes/después sobre copias aisladas sin alterar modelos originales.',
      icon: FlaskConical,
      metricText: `${simulationHistory.length} experimentos registrados`,
    },
    {
      id: 'classifier',
      title: 'Clasificador Alfanumérico',
      subtitle: '16×16 (0–9, A–Z, 36) · MNIST 784 (Original)',
      description:
        'Lienzo 16×16 con Softmax real y entrenamiento de 36 clases, más lienzo manual 280×280 para el modelo 784–128–10 con inspector de pesos.',
      icon: Grid3X3,
      metricText: alphanumericSummary.isTrained
        ? `36 clases activas · ${(alphanumericSummary.valAccuracy * 100).toFixed(1)}% val`
        : '36 clases pendientes · 784–128–10 listo',
    },
    {
      id: 'xai',
      title: 'IA Explicable (XAI)',
      subtitle: 'Saliency ∂z/∂x · Neuronas activas · Ambigüedades',
      description:
        'Mapas de sensibilidad gradiente × entrada sobre 16×16, neuronas ReLU dominantes, márgenes Softmax y análisis 0/O, 1/I.',
      icon: Eye,
      metricText: lastPrediction
        ? `Explicando "${lastPrediction.topLabel}" (${(lastPrediction.confidence * 100).toFixed(1)}%)`
        : 'Listo para explicar inferencias',
    },
    {
      id: 'geometry',
      title: 'Geometría Matemática 2D / 3D',
      subtitle: 'Transformaciones ℝ² · Vectores, rectas y planos ℝ³',
      description:
        'Visualizador interactivo 2D de matrices y espacio 3D con órbita libre para producto cruz, proyecciones, rectas y planos.',
      icon: Box,
      metricText: 'Conectado al motor matricial',
    },
    {
      id: 'linear-algebra',
      title: 'Laboratorio de Álgebra Lineal',
      subtitle: 'Matrices · LU · QR · Gauss-Jordan · Eigenanálisis',
      description:
        'Motor simbólico-numérico independiente con fórmulas, procedimiento paso a paso, verificación por residuo e interpretación en IA.',
      icon: Calculator,
      metricText: lastMathOutput
        ? `Última: ${lastMathOutput.operation}`
        : '14 operaciones verificadas',
    },
    {
      id: 'topology',
      title: 'Topología Neuronal',
      subtitle: 'Canvas dinámico · Capas, pesos y activaciones',
      description:
        'Visualización en tiempo real de la propagación hacia adelante, densidad sináptica y respuesta ReLU por neurona.',
      icon: Network,
      metricText: lastPrediction
        ? `Entrada activa: "${lastPrediction.topLabel}"`
        : 'Sin entrada evaluada',
    },
    {
      id: 'neural-lab',
      title: 'Laboratorio de Ingeniería Neuronal',
      subtitle: 'Z = WX + b · ReLU · Retropropagación SGD',
      description:
        'Inspección paso a paso de forward pass, gradientes δ, actualización de pesos y curvas reales de entrenamiento.',
      icon: Cpu,
      metricText: `${digitsSummary.parameterCount.toLocaleString()} parámetros (0–9)`,
    },
    {
      id: 'evaluation',
      title: 'Centro de Evaluación de Modelos',
      subtitle: 'Precision · Recall · F1 · Latencia · Comparativa',
      description:
        'Métricas experimentales reales por clase y macro-promediadas, matriz de confusión y tiempo medio de inferencia.',
      icon: Award,
      metricText: `0–9: ${(digitsSummary.valAccuracy * 100).toFixed(1)}% · A–Z: ${(lettersSummary.valAccuracy * 100).toFixed(1)}%`,
    },
    {
      id: 'omni-bot',
      title: 'Omni Bot Intelligence',
      subtitle: 'Motor local · Servidor Gemini · Generador de ejercicios',
      description:
        'Resuelve comandos matriciales determinísticos, inspecciona modelos, genera ejercicios paso a paso y guía entre módulos.',
      icon: Bot,
      metricText: `${omniMessages.length} mensajes en sesión`,
    },
    {
      id: 'verification',
      title: 'Calidad, Seguridad y Verificación',
      subtitle: 'Invariantes · Benchmark ms · Diagnóstico API · Eventos',
      description:
        'Auditoría de gradientes numéricos, residuos algebraicos, rendimiento, seguridad de claves y registro de actividad.',
      icon: ShieldCheck,
      metricText: `${systemEvents.length} eventos registrados`,
    },
  ];

  const renderPanel = (panelId: DashboardPanelId) => {
    switch (panelId) {
      case 'hero':
        return (
          <section key="hero" className="surface-card rounded-2xl p-6 lg:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-8 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                  <div className="flex-1 min-w-0 space-y-4">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
                      <span>{userProfile.program}</span>
                      <span aria-hidden="true">·</span>
                      <span>{userProfile.institution}</span>
                      <span aria-hidden="true">·</span>
                      <span>Sesión activa: {userProfile.name}</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[var(--text-primary)] text-balance">
                      VectorIA Studio: Álgebra Lineal e Ingeniería de Redes Neuronales
                    </h1>
                    <p className="text-sm sm:text-base text-[var(--text-secondary)] max-w-2xl leading-relaxed">
                      Ecosistema académico y técnico para investigar transformaciones matriciales,
                      geometría 2D/3D, descenso del gradiente, explicabilidad XAI y clasificación
                      alfanumérica con cálculo verificable y trazabilidad experimental.
                    </p>
                  </div>

                  <div className="hidden md:flex items-center justify-center shrink-0 self-center">
                    <HeroNeuralShowcase className="w-48 lg:w-52 xl:w-56" />
                  </div>
                </div>

                <div className="md:hidden flex justify-center pt-1">
                  <HeroNeuralShowcase compact className="w-52 sm:w-60" />
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveModule('classifier')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-contrast)] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Abrir Clasificador
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveModule('simulation-lab')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-[var(--border-strong)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Simulation Lab
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveModule('geometry')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-[var(--border-strong)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Geometría 2D/3D
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveModule('xai')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Explicabilidad XAI
                  </button>
                  {!isTutorialOpen && (
                    <button
                      type="button"
                      onClick={openTutorial}
                      className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-medium text-[var(--accent-primary)] hover:underline transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <Compass className="w-3.5 h-3.5" />
                      Repetir guía interactiva
                    </button>
                  )}
                </div>
              </div>

              <div className="lg:col-span-4 surface-elevated rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--text-secondary)]">
                    Estado de los Modelos Reales
                  </span>
                  <Activity className="w-4 h-4 text-[var(--accent-primary)]" />
                </div>
                <div className="space-y-3 text-xs">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-[var(--text-secondary)]">Dígitos (0–9)</span>
                      <span className="font-mono tabular-nums text-[var(--text-primary)]">
                        {(digitsSummary.valAccuracy * 100).toFixed(1)}% val ({digitsSummary.epochsTrained} ép.)
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[var(--bg-canvas)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[var(--accent-primary)] transition-all"
                        style={{ width: `${Math.round(digitsSummary.valAccuracy * 100)}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-[var(--text-secondary)]">Letras (A–Z)</span>
                      <span className="font-mono tabular-nums text-[var(--text-primary)]">
                        {(lettersSummary.valAccuracy * 100).toFixed(1)}% val ({lettersSummary.epochsTrained} ép.)
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[var(--bg-canvas)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[var(--accent-secondary)] transition-all"
                        style={{ width: `${Math.round(lettersSummary.valAccuracy * 100)}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-[var(--text-secondary)]">Alfanumérico (36 clases)</span>
                      <span className="font-mono tabular-nums text-[var(--text-primary)]">
                        {alphanumericSummary.isTrained
                          ? `${(alphanumericSummary.valAccuracy * 100).toFixed(1)}% val (${alphanumericSummary.epochsTrained} ép.)`
                          : 'Sin entrenar'}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[var(--bg-canvas)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[var(--status-ok)] transition-all"
                        style={{
                          width: alphanumericSummary.isTrained
                            ? `${Math.round(alphanumericSummary.valAccuracy * 100)}%`
                            : '0%',
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        );

      case 'lab-widgets': {
        const { neural, simulation, algebraSystem } = labSummaries;
        const showNeural = widgetFilter === 'all' || widgetFilter === 'neural';
        const showSimulation = widgetFilter === 'all' || widgetFilter === 'simulation';
        const showAlgebra = widgetFilter === 'all' || widgetFilter === 'algebra';

        const filterButtons: Array<{ id: LabWidgetFilter; label: string }> = [
          { id: 'all', label: 'Todos los laboratorios' },
          { id: 'neural', label: 'Redes Neuronales' },
          { id: 'simulation', label: 'Simulación y Robustez' },
          { id: 'algebra', label: 'Álgebra y Auditoría' },
        ];

        return (
          <section key="lab-widgets" className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                  Resúmenes Estadísticos Dinámicos por Laboratorio
                </h2>
                <p className="text-xs text-[var(--text-muted)]">
                  Métricas calculadas en tiempo real a partir del estado vivo de los motores, inferencias y experimentos de la sesión.
                </p>
              </div>
              <div
                role="tablist"
                aria-label="Filtrar widgets de laboratorios"
                className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl surface-elevated border border-[var(--border-hairline)] self-start"
              >
                {filterButtons.map((btn) => {
                  const active = widgetFilter === btn.id;
                  return (
                    <button
                      key={btn.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setWidgetFilter(btn.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        active
                          ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {btn.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              className={`grid grid-cols-1 gap-5 ${
                widgetFilter === 'all' ? 'xl:grid-cols-3' : 'xl:grid-cols-1'
              }`}
            >
              {/* Widget 1: Redes Neuronales y Clasificador */}
              {showNeural && (
                <article className="surface-card rounded-2xl p-5 flex flex-col justify-between gap-4 border border-[var(--border-hairline)]">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs text-[var(--text-muted)]">
                          Clasificador · MLP 16×16 y MNIST 784
                        </div>
                        <h3 className="text-base font-semibold text-[var(--text-primary)] mt-0.5">
                          Redes Neuronales e Inferencia
                        </h3>
                      </div>
                      <Cpu className="w-4 h-4 text-[var(--accent-primary)] shrink-0 mt-1" />
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-3 border-t border-[var(--border-hairline)] text-xs">
                      <div>
                        <div className="text-[var(--text-muted)]">Exactitud media activa</div>
                        <div className="text-xl font-bold font-mono tabular-nums text-[var(--text-primary)] mt-0.5">
                          {neural.meanValAccuracyPct.toFixed(1)}%
                        </div>
                        <div className="text-[11px] font-mono tabular-nums text-[var(--text-muted)]">
                          {neural.trainedModelsCount}/{neural.totalArchitectures} modelos listos
                        </div>
                      </div>
                      <div>
                        <div className="text-[var(--text-muted)]">Parámetros activos</div>
                        <div className="text-xl font-bold font-mono tabular-nums text-[var(--accent-primary)] mt-0.5">
                          {neural.totalActiveParameters.toLocaleString()}
                        </div>
                        <div className="text-[11px] font-mono tabular-nums text-[var(--text-muted)]">
                          Mejor: {neural.bestModelLabel} ({neural.bestModelAccuracyPct.toFixed(1)}%)
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 pt-3 border-t border-[var(--border-hairline)] text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[var(--text-secondary)]">Confianza media en sesión</span>
                        <span className="font-mono tabular-nums font-semibold text-[var(--text-primary)]">
                          {neural.meanConfidencePct !== null
                            ? `${neural.meanConfidencePct.toFixed(1)}%`
                            : 'Sin inferencias'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[var(--text-secondary)]">Rango confianza (mín / máx)</span>
                        <span className="font-mono tabular-nums text-[var(--text-muted)]">
                          {neural.minConfidencePct !== null && neural.maxConfidencePct !== null
                            ? `${neural.minConfidencePct.toFixed(1)}% – ${neural.maxConfidencePct.toFixed(1)}%`
                            : 'N/D'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[var(--text-secondary)]">Entropía media Softmax</span>
                        <span className="font-mono tabular-nums text-[var(--text-primary)]">
                          {neural.meanEntropyBits !== null
                            ? `${neural.meanEntropyBits.toFixed(3)} bits`
                            : 'N/D'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[var(--text-secondary)]">Distribución por modo</span>
                        <span className="font-mono tabular-nums text-[var(--text-muted)]">
                          0–9: {neural.modeCounts.digits} · A–Z: {neural.modeCounts.letters} · 36:{' '}
                          {neural.modeCounts.alphanumeric}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[var(--text-secondary)]">Último trazo 784–128–10</span>
                        <span className="font-mono tabular-nums text-[var(--text-primary)]">
                          {neural.mnist784LastDigit !== null &&
                          neural.mnist784LastConfidencePct !== null
                            ? `Dígito ${neural.mnist784LastDigit} (${neural.mnist784LastConfidencePct.toFixed(1)}%)`
                            : `Eval: ${neural.mnist784AccuracyPct.toFixed(1)}%`}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[var(--border-hairline)] flex items-center justify-between gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setActiveModule('evaluation')}
                      className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer whitespace-nowrap"
                    >
                      Matriz y F1 →
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveModule('classifier')}
                      className="text-[var(--accent-primary)] font-semibold hover:underline cursor-pointer whitespace-nowrap"
                    >
                      Abrir Clasificador →
                    </button>
                  </div>
                </article>
              )}

              {/* Widget 2: Simulation Lab & Robustez */}
              {showSimulation && (
                <article className="surface-card rounded-2xl p-5 flex flex-col justify-between gap-4 border border-[var(--border-hairline)]">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs text-[var(--text-muted)]">
                          Clones aislados · A/B · Perturbación 28×28
                        </div>
                        <h3 className="text-base font-semibold text-[var(--text-primary)] mt-0.5">
                          Simulation Lab y Robustez
                        </h3>
                      </div>
                      <FlaskConical className="w-4 h-4 text-[var(--accent-secondary)] shrink-0 mt-1" />
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-3 border-t border-[var(--border-hairline)] text-xs">
                      <div>
                        <div className="text-[var(--text-muted)]">Corridas registradas</div>
                        <div className="text-xl font-bold font-mono tabular-nums text-[var(--text-primary)] mt-0.5">
                          {simulation.totalRuns}
                        </div>
                        <div className="text-[11px] font-mono tabular-nums text-[var(--text-muted)]">
                          {simulation.meanDurationMs !== null
                            ? `Media ${simulation.meanDurationMs.toFixed(1)} ms`
                            : 'Sin ejecuciones aún'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[var(--text-muted)]">Impacto por ruido/cambio</div>
                        <div className="text-xl font-bold font-mono tabular-nums text-[var(--accent-secondary)] mt-0.5">
                          {simulation.meanPerturbedConfidenceDropPp !== null
                            ? `${simulation.meanPerturbedConfidenceDropPp.toFixed(1)} pp`
                            : simulation.mnist784PerturbDeltaPct !== null
                              ? `${simulation.mnist784PerturbDeltaPct.toFixed(1)}%`
                              : '0.0 pp'}
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)]">
                          {simulation.meanPerturbedConfidenceDropPp !== null
                            ? 'Media Δ registrada'
                            : simulation.mnist784PerturbDeltaPct !== null
                              ? simulation.mnist784PerturbChangedClass
                                ? 'Perturbación cambió clase'
                                : 'Clase 784 estable'
                              : 'Ejecuta un lote o A/B'}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 pt-3 border-t border-[var(--border-hairline)] text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[var(--text-secondary)]">Antes / Después</span>
                        <span className="font-mono tabular-nums text-[var(--text-primary)]">
                          {simulation.byKind['before-after']}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[var(--text-secondary)]">Comparativas A/B</span>
                        <span className="font-mono tabular-nums text-[var(--text-primary)]">
                          {simulation.byKind['ab-test']}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[var(--text-secondary)]">Lotes de robustez</span>
                        <span className="font-mono tabular-nums text-[var(--text-primary)]">
                          {simulation.byKind['batch-robustness']}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[var(--text-secondary)]">Prácticas 3–2–2</span>
                        <span className="font-mono tabular-nums text-[var(--text-primary)]">
                          {simulation.byKind['didactic-322']}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[var(--text-secondary)]">Último experimento</span>
                        <span className="font-mono text-[var(--text-muted)] truncate max-w-[180px]">
                          {simulation.lastRunTitle ?? 'Sin experimentos aún'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[var(--border-hairline)] flex items-center justify-between gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setActiveModule('robustness')}
                      className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer whitespace-nowrap"
                    >
                      Análisis de Robustez →
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveModule('simulation-lab')}
                      className="text-[var(--accent-primary)] font-semibold hover:underline cursor-pointer whitespace-nowrap"
                    >
                      Abrir Simulation Lab →
                    </button>
                  </div>
                </article>
              )}

              {/* Widget 3: Álgebra Lineal, Backprop 2-3-2 y Auditoría */}
              {showAlgebra && (
                <article className="surface-card rounded-2xl p-5 flex flex-col justify-between gap-4 border border-[var(--border-hairline)]">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs text-[var(--text-muted)]">
                          Residuo simbólico · 2–3–2 · Eventos del sistema
                        </div>
                        <h3 className="text-base font-semibold text-[var(--text-primary)] mt-0.5">
                          Álgebra Lineal y Auditoría
                        </h3>
                      </div>
                      <Calculator className="w-4 h-4 text-[var(--status-ok)] shrink-0 mt-1" />
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-3 border-t border-[var(--border-hairline)] text-xs">
                      <div>
                        <div className="text-[var(--text-muted)]">Residuo último cálculo</div>
                        <div className="text-xl font-bold font-mono tabular-nums text-[var(--text-primary)] mt-0.5">
                          {algebraSystem.lastResidual !== null
                            ? algebraSystem.lastResidual.toExponential(1)
                            : 'N/D'}
                        </div>
                        <div
                          className={`text-[11px] font-medium ${
                            algebraSystem.lastVerificationPassed === null
                              ? 'text-[var(--text-muted)]'
                              : algebraSystem.lastVerificationPassed
                                ? 'text-[var(--status-ok)]'
                                : 'text-[var(--status-err)]'
                          }`}
                        >
                          {algebraSystem.lastVerificationPassed === null
                            ? 'Sin cálculo matricial aún'
                            : algebraSystem.lastVerificationPassed
                              ? 'Verificación exacta'
                              : 'Residuo fuera de umbral'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[var(--text-muted)]">Eventos auditados</div>
                        <div className="text-xl font-bold font-mono tabular-nums text-[var(--status-ok)] mt-0.5">
                          {algebraSystem.totalEvents}
                        </div>
                        <div className="text-[11px] font-mono tabular-nums text-[var(--text-muted)]">
                          {algebraSystem.okEvents} ok · {algebraSystem.warnEvents} avisos ·{' '}
                          {algebraSystem.errorEvents} err
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 pt-3 border-t border-[var(--border-hairline)] text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[var(--text-secondary)]">Última operación</span>
                        <span className="font-mono text-[var(--text-primary)] truncate max-w-[180px]">
                          {algebraSystem.lastOperation ?? 'Sin ejecutar'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[var(--text-secondary)]">Red didáctica 2–3–2</span>
                        <span className="font-mono tabular-nums text-[var(--text-primary)]">
                          {algebraSystem.didactic232LossBefore !== null &&
                          algebraSystem.didactic232LossAfter !== null
                            ? `L: ${algebraSystem.didactic232LossBefore.toFixed(4)} → ${algebraSystem.didactic232LossAfter.toFixed(4)}`
                            : 'Sin paso ejecutado'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[var(--text-secondary)]">Error dif. finitas 2–3–2</span>
                        <span className="font-mono tabular-nums text-[var(--text-muted)]">
                          {algebraSystem.didactic232MaxFiniteDiffError !== null
                            ? algebraSystem.didactic232MaxFiniteDiffError.toExponential(2)
                            : 'N/D'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[var(--text-secondary)]">Informes técnicos</span>
                        <span className="font-mono tabular-nums text-[var(--text-primary)]">
                          {algebraSystem.reportCount}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[var(--text-secondary)]">Interacciones Omni Bot</span>
                        <span className="font-mono tabular-nums text-[var(--text-primary)]">
                          {algebraSystem.omniMessageCount}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[var(--border-hairline)] flex items-center justify-between gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setActiveModule('neural-lab')}
                      className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer whitespace-nowrap"
                    >
                      Ingeniería Neuronal →
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveModule('linear-algebra')}
                      className="text-[var(--accent-primary)] font-semibold hover:underline cursor-pointer whitespace-nowrap"
                    >
                      Abrir Álgebra Lineal →
                    </button>
                  </div>
                </article>
              )}
            </div>
          </section>
        );
      }

      case 'telemetry':
        return (
          <section key="telemetry" className="space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-5 surface-card rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                    Indicadores de Sesión y Rendimiento
                  </h2>
                  <span className="text-[11px] font-mono text-[var(--text-muted)]">En vivo</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="surface-elevated rounded-xl p-3.5">
                    <div className="text-[var(--text-muted)]">Inferencias reales</div>
                    <div className="text-xl font-bold font-mono tabular-nums text-[var(--text-primary)] mt-1">
                      {predictionHistory.length}
                    </div>
                  </div>
                  <div className="surface-elevated rounded-xl p-3.5">
                    <div className="text-[var(--text-muted)]">Simulaciones</div>
                    <div className="text-xl font-bold font-mono tabular-nums text-[var(--accent-primary)] mt-1">
                      {simulationHistory.length}
                    </div>
                  </div>
                  <div className="surface-elevated rounded-xl p-3.5">
                    <div className="text-[var(--text-muted)]">Consultas Omni Bot</div>
                    <div className="text-xl font-bold font-mono tabular-nums text-[var(--accent-secondary)] mt-1">
                      {omniMessages.length}
                    </div>
                  </div>
                  <div className="surface-elevated rounded-xl p-3.5">
                    <div className="text-[var(--text-muted)]">Informes técnicos</div>
                    <div className="text-xl font-bold font-mono tabular-nums text-[var(--text-primary)] mt-1">
                      {reportHistory.length}
                    </div>
                  </div>
                </div>
                {lastMathOutput && (
                  <div className="surface-elevated rounded-xl p-3 text-xs flex items-center justify-between gap-2">
                    <div className="truncate">
                      <span className="text-[var(--text-muted)]">Último cálculo: </span>
                      <span className="font-semibold text-[var(--text-primary)]">
                        {lastMathOutput.operation}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveModule('linear-algebra')}
                      className="text-[var(--accent-primary)] font-medium hover:underline cursor-pointer shrink-0"
                    >
                      Abrir →
                    </button>
                  </div>
                )}
              </div>

              <div className="lg:col-span-7 surface-card rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                    <Bell className="w-4 h-4 text-[var(--accent-primary)]" />
                    <span>Notificaciones y Actividad Reciente</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveModule('verification')}
                    className="text-xs text-[var(--accent-primary)] hover:underline cursor-pointer"
                  >
                    Ver auditoría completa →
                  </button>
                </div>
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {systemEvents.slice(0, 6).map((evt) => (
                    <div
                      key={evt.id}
                      className="surface-elevated rounded-xl px-3.5 py-2.5 flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="font-medium text-[var(--text-primary)] truncate">
                          {evt.title}
                        </div>
                        <div className="text-[11px] text-[var(--text-secondary)] truncate">
                          {evt.detail}
                        </div>
                      </div>
                      <span className="font-mono text-[11px] text-[var(--text-muted)] shrink-0 tabular-nums">
                        {new Date(evt.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-6">
                <ScientificChartCard
                  title="Exactitud Real Medida por Modelo (%)"
                  subtitle="Comparativa en validación independiente frente a línea base aleatoria 1/K"
                  exportFilename="vectoria_dashboard_modelos"
                  dataTable={{
                    columns: ['Modelo', 'Exactitud (%)', 'Azar 1/K (%)', 'Épocas'],
                    rows: modelOverviewData.map((m) => [
                      m.name,
                      `${m.valPct.toFixed(1)}%`,
                      `${m.baselinePct.toFixed(1)}%`,
                      m.epochs,
                    ]),
                  }}
                >
                  <div className="h-52 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={modelOverviewData} margin={{ top: 18, right: 12, left: 0, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={palette.borderHairline} vertical={false} />
                        <XAxis
                          dataKey="name"
                          tick={{ fill: palette.textSecondary, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                          stroke={palette.borderHairline}
                        />
                        <YAxis
                          domain={[0, 100]}
                          unit="%"
                          tick={{ fill: palette.textMuted, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                          stroke={palette.borderHairline}
                          width={42}
                        />
                        <Tooltip
                          cursor={{ fill: palette.bgElevated, opacity: 0.45 }}
                          content={
                            <ScientificTooltip
                              unitByKey={{ valPct: '%', baselinePct: '%' }}
                              extraMeta={(p) => `Épocas entrenadas: ${p.epochs}`}
                            />
                          }
                        />
                        <Bar dataKey="valPct" name="Validación (%)" radius={[6, 6, 0, 0]}>
                          {modelOverviewData.map((m) => (
                            <Cell key={m.name} fill={m.color} />
                          ))}
                          <LabelList
                            dataKey="valPct"
                            position="top"
                            formatter={(v: unknown) => `${Number(v).toFixed(1)}%`}
                            style={{ fill: palette.textSecondary, fontSize: 10, fontFamily: 'JetBrains Mono' }}
                          />
                        </Bar>
                        <Bar
                          dataKey="baselinePct"
                          name="Azar 1/K (%)"
                          fill={palette.textMuted}
                          fillOpacity={0.35}
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </ScientificChartCard>
              </div>

              <div className="lg:col-span-6">
                <ScientificChartCard
                  title="Confianza y Entropía de Inferencias en Sesión"
                  subtitle="Evolución cronológica de las últimas inferencias reales del usuario"
                  exportFilename="vectoria_dashboard_sesion"
                  dataTable={{
                    columns: ['Inferencia #', 'Clase', 'Confianza (%)', 'Entropía (bits)'],
                    rows: sessionInferenceSeries.map((s) => [
                      s.idx,
                      s.label,
                      `${s.confidencePct.toFixed(1)}%`,
                      s.entropyBits.toFixed(3),
                    ]),
                  }}
                >
                  {sessionInferenceSeries.length === 0 ? (
                    <div className="h-52 flex flex-col items-center justify-center gap-2 text-xs text-[var(--text-muted)] text-center px-4">
                      <span>Sin inferencias registradas en esta sesión todavía.</span>
                      <button
                        type="button"
                        onClick={() => setActiveModule('classifier')}
                        className="text-[var(--accent-primary)] font-medium hover:underline cursor-pointer"
                      >
                        Evaluar carácter en el Clasificador →
                      </button>
                    </div>
                  ) : (
                    <div className="h-52 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                          data={sessionInferenceSeries}
                          margin={{ top: 10, right: 12, left: 0, bottom: 4 }}
                        >
                          <defs>
                            <linearGradient id={`dashConf-${dashUid}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={palette.accentSecondary} stopOpacity={0.38} />
                              <stop offset="95%" stopColor={palette.accentSecondary} stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke={palette.borderHairline} vertical={false} />
                          <XAxis
                            dataKey="idx"
                            tick={{ fill: palette.textMuted, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                            stroke={palette.borderHairline}
                          />
                          <YAxis
                            yAxisId="left"
                            domain={[0, 100]}
                            unit="%"
                            tick={{ fill: palette.textMuted, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                            stroke={palette.borderHairline}
                            width={42}
                          />
                          <YAxis
                            yAxisId="right"
                            orientation="right"
                            tick={{ fill: palette.textMuted, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                            stroke={palette.borderHairline}
                            width={40}
                          />
                          <Tooltip
                            content={
                              <ScientificTooltip
                                labelPrefix="Inferencia #"
                                unitByKey={{ confidencePct: '%', entropyBits: ' bits' }}
                                extraMeta={(p) => `Clase predicha: "${p.label}"`}
                              />
                            }
                          />
                          <Area
                            yAxisId="left"
                            type="monotone"
                            dataKey="confidencePct"
                            name="Confianza"
                            stroke={palette.accentSecondary}
                            strokeWidth={2.2}
                            fill={`url(#dashConf-${dashUid})`}
                            dot={{ r: 3, fill: palette.accentSecondary }}
                          />
                          <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="entropyBits"
                            name="Entropía"
                            stroke={palette.chart4}
                            strokeWidth={2}
                            dot={{ r: 2.5, fill: palette.chart4 }}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </ScientificChartCard>
              </div>
            </div>

            {/* Recharts Historical Training Progress for Alphanumeric Classifier Models */}
            <ClassifierTrainingProgressCard
              digitsSummary={digitsSummary}
              lettersSummary={lettersSummary}
              alphanumericSummary={alphanumericSummary}
              onOpenClassifier={() => setActiveModule('classifier')}
              onOpenAnalytics={() => setActiveModule('analytics')}
            />

            {/* Recharts API Latency Timeline Widget (Consola de Experimentos) */}
            <ScientificChartCard
              title="Línea de Tiempo de Latencia API (Consola de Experimentos)"
              subtitle="Evolución cronológica en milisegundos de las peticiones reales ejecutadas desde la Consola API y el panel"
              exportFilename="vectoria_api_latencia"
              controls={
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={pingingApi}
                    onClick={() => void handleMeasureApiPing()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-contrast)] disabled:opacity-60 cursor-pointer whitespace-nowrap"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    {pingingApi ? 'Midiendo...' : 'Medir ping (/api/health)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveModule('api-console')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border-hairline)] surface-elevated text-[var(--text-primary)] hover:border-[var(--accent-primary)] cursor-pointer whitespace-nowrap"
                  >
                    <Server className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    Consola API →
                  </button>
                  {apiLatencyHistory.length > 0 && (
                    <button
                      type="button"
                      onClick={clearApiLatencyHistory}
                      className="px-2.5 py-1.5 rounded-lg text-xs text-[var(--text-muted)] hover:text-[var(--status-err)] cursor-pointer whitespace-nowrap"
                    >
                      Limpiar
                    </button>
                  )}
                </div>
              }
              dataTable={{
                columns: ['#', 'Hora', 'Endpoint', 'HTTP', 'Latencia (ms)'],
                rows: apiLatencySeries.map((r) => [
                  r.idx,
                  r.timeLabel,
                  r.endpoint,
                  r.status,
                  `${r.latencyMs.toFixed(2)} ms`,
                ]),
              }}
            >
              {apiLatencySeries.length === 0 ? (
                <div className="h-52 flex flex-col items-center justify-center gap-2.5 text-xs text-[var(--text-muted)] text-center px-4">
                  <span>
                    Sin peticiones registradas desde la Consola API todavía. Ejecuta una consulta real o mide un ping para trazar la línea de tiempo de latencia.
                  </span>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      disabled={pingingApi}
                      onClick={() => void handleMeasureApiPing()}
                      className="text-[var(--accent-primary)] font-semibold hover:underline cursor-pointer"
                    >
                      Medir /api/health ahora
                    </button>
                    <span aria-hidden="true">·</span>
                    <button
                      type="button"
                      onClick={() => setActiveModule('api-console')}
                      className="text-[var(--accent-secondary)] font-semibold hover:underline cursor-pointer"
                    >
                      Abrir Consola API →
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="surface-elevated rounded-xl p-3">
                      <div className="text-[var(--text-muted)]">Peticiones</div>
                      <div className="text-lg font-bold font-mono tabular-nums text-[var(--text-primary)] mt-0.5">
                        {apiLatencyHistory.length}
                      </div>
                    </div>
                    <div className="surface-elevated rounded-xl p-3">
                      <div className="text-[var(--text-muted)]">Latencia media</div>
                      <div className="text-lg font-bold font-mono tabular-nums text-[var(--accent-primary)] mt-0.5">
                        {apiLatencyStats.avgMs.toFixed(2)} ms
                      </div>
                    </div>
                    <div className="surface-elevated rounded-xl p-3">
                      <div className="text-[var(--text-muted)]">Rango mín / máx</div>
                      <div className="text-sm font-bold font-mono tabular-nums text-[var(--text-primary)] mt-1">
                        {apiLatencyStats.minMs.toFixed(1)} – {apiLatencyStats.maxMs.toFixed(1)} ms
                      </div>
                    </div>
                    <div className="surface-elevated rounded-xl p-3">
                      <div className="text-[var(--text-muted)]">Tasa HTTP 2xx</div>
                      <div className="text-lg font-bold font-mono tabular-nums text-[var(--status-ok)] mt-0.5">
                        {apiLatencyStats.okRatePct.toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  <div className="h-52 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={apiLatencySeries}
                        margin={{ top: 10, right: 16, left: 0, bottom: 4 }}
                      >
                        <defs>
                          <linearGradient id={`apiLat-${dashUid}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={palette.chart1} stopOpacity={0.38} />
                            <stop offset="95%" stopColor={palette.chart1} stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke={palette.borderHairline}
                          vertical={false}
                        />
                        <XAxis
                          dataKey="timeLabel"
                          tick={{ fill: palette.textMuted, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                          stroke={palette.borderHairline}
                        />
                        <YAxis
                          unit=" ms"
                          tick={{ fill: palette.textMuted, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                          stroke={palette.borderHairline}
                          width={54}
                        />
                        <Tooltip
                          content={
                            <ScientificTooltip
                              labelPrefix="Hora: "
                              unitByKey={{ latencyMs: ' ms' }}
                              extraMeta={(p) => `${p.endpoint} · HTTP ${p.status}`}
                            />
                          }
                        />
                        <ReferenceLine
                          y={apiLatencyStats.avgMs}
                          stroke={palette.chart4}
                          strokeDasharray="4 4"
                          label={{
                            value: `Media ${apiLatencyStats.avgMs.toFixed(1)} ms`,
                            fill: palette.chart4,
                            fontSize: 10,
                            position: 'insideTopRight',
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="latencyMs"
                          name="Latencia"
                          stroke={palette.chart1}
                          strokeWidth={2.2}
                          fill={`url(#apiLat-${dashUid})`}
                          dot={{ r: 3.5, fill: palette.chart1 }}
                          activeDot={{ r: 5 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </ScientificChartCard>

            {/* Recharts AreaChart Widget: Simulation Memory & Execution Time */}
            <ScientificChartCard
              title="Uso de Memoria y Tiempo de Ejecución de Simulaciones"
              subtitle="Evolución histórica del rendimiento computacional en los laboratorios (duración real en ms y uso de memoria en MB)"
              exportFilename="vectoria_simulaciones_rendimiento"
              controls={
                <div className="flex flex-wrap items-center justify-between gap-2 w-full">
                  <div
                    role="tablist"
                    aria-label="Filtrar simulaciones por modalidad"
                    className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl surface-elevated border border-[var(--border-hairline)]"
                  >
                    {(
                      [
                        { id: 'all', label: 'Todas' },
                        { id: 'before-after', label: 'Antes/Después' },
                        { id: 'ab-test', label: 'A/B Test' },
                        { id: 'batch-robustness', label: 'Lote' },
                        { id: 'didactic-322', label: 'Red 3–2–2' },
                      ] as const
                    ).map((tab) => {
                      const active = simPerfFilter === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          onClick={() => setSimPerfFilter(tab.id)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                            active
                              ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={runningDiagSim}
                      onClick={handleRunDiagnosticSimulation}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-contrast)] disabled:opacity-60 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Activity className="w-3.5 h-3.5" />
                      {runningDiagSim ? 'Ejecutando...' : 'Ejecutar simulación'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveModule('simulation-lab')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border-hairline)] surface-elevated text-[var(--text-primary)] hover:border-[var(--accent-primary)] cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <FlaskConical className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                      Simulation Lab →
                    </button>
                    {simulationHistory.length > 0 && (
                      <button
                        type="button"
                        onClick={clearSimulationHistory}
                        className="px-2.5 py-1.5 rounded-lg text-xs text-[var(--text-muted)] hover:text-[var(--status-err)] cursor-pointer whitespace-nowrap shrink-0"
                      >
                        Limpiar
                      </button>
                    )}
                  </div>
                </div>
              }
              dataTable={{
                columns: ['#', 'Hora', 'Simulación', 'Tipo', 'Tiempo (ms)', 'Memoria (MB)'],
                rows: simPerfSeries.map((pt) => [
                  pt.idx,
                  pt.timeLabel,
                  pt.title,
                  pt.kindLabel,
                  `${pt.durationMs.toFixed(2)} ms`,
                  `${pt.memoryMb.toFixed(2)} MB`,
                ]),
              }}
            >
              {simPerfSeries.length === 0 ? (
                <div className="h-56 flex flex-col items-center justify-center gap-2.5 text-xs text-[var(--text-muted)] text-center px-4">
                  <span>
                    {simulationHistory.length === 0
                      ? 'Sin simulaciones registradas todavía. Ejecuta un experimento en Simulation Lab o lanza una simulación de diagnóstico para trazar la evolución de memoria y tiempo.'
                      : 'No hay ejecuciones registradas para este filtro de modalidad.'}
                  </span>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      disabled={runningDiagSim}
                      onClick={handleRunDiagnosticSimulation}
                      className="text-[var(--accent-primary)] font-semibold hover:underline cursor-pointer"
                    >
                      Ejecutar simulación ahora
                    </button>
                    <span aria-hidden="true">·</span>
                    <button
                      type="button"
                      onClick={() => setActiveModule('simulation-lab')}
                      className="text-[var(--accent-secondary)] font-semibold hover:underline cursor-pointer"
                    >
                      Abrir Simulation Lab →
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="surface-elevated rounded-xl p-3">
                      <div className="text-[var(--text-muted)]">Ejecuciones</div>
                      <div className="text-lg font-bold font-mono tabular-nums text-[var(--text-primary)] mt-0.5">
                        {simPerfStats.runCount}
                      </div>
                    </div>
                    <div className="surface-elevated rounded-xl p-3">
                      <div className="text-[var(--text-muted)]">Tiempo medio / máx</div>
                      <div className="text-sm font-bold font-mono tabular-nums text-[var(--accent-primary)] mt-1">
                        {simPerfStats.avgDurationMs.toFixed(2)} / {simPerfStats.maxDurationMs.toFixed(2)} ms
                      </div>
                    </div>
                    <div className="surface-elevated rounded-xl p-3">
                      <div className="text-[var(--text-muted)]">Memoria actual / media</div>
                      <div className="text-sm font-bold font-mono tabular-nums text-[var(--accent-secondary)] mt-1">
                        {simPerfStats.latestMemoryMb.toFixed(2)} / {simPerfStats.avgMemoryMb.toFixed(2)} MB
                      </div>
                    </div>
                    <div className="surface-elevated rounded-xl p-3">
                      <div className="text-[var(--text-muted)]">Origen de memoria</div>
                      <div className="text-xs font-semibold text-[var(--text-primary)] mt-1.5 truncate">
                        {simPerfStats.dominantSourceLabel}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-[11px] text-[var(--text-muted)]">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="inline-block w-3 h-0.5 rounded-full"
                        style={{ backgroundColor: palette.chart1 }}
                      />
                      Tiempo de ejecución (ms · eje izq.)
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="inline-block w-3 h-0.5 rounded-full"
                        style={{ backgroundColor: palette.chart2 }}
                      />
                      Uso de memoria (MB · eje der.)
                    </span>
                  </div>

                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={simPerfSeries}
                        margin={{ top: 10, right: 12, left: 0, bottom: 4 }}
                      >
                        <defs>
                          <linearGradient id={`simDur-${dashUid}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={palette.chart1} stopOpacity={0.38} />
                            <stop offset="95%" stopColor={palette.chart1} stopOpacity={0.02} />
                          </linearGradient>
                          <linearGradient id={`simMem-${dashUid}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={palette.chart2} stopOpacity={0.34} />
                            <stop offset="95%" stopColor={palette.chart2} stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke={palette.borderHairline}
                          vertical={false}
                        />
                        <XAxis
                          dataKey="timeLabel"
                          tick={{ fill: palette.textMuted, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                          stroke={palette.borderHairline}
                        />
                        <YAxis
                          yAxisId="time"
                          unit=" ms"
                          tick={{ fill: palette.textMuted, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                          stroke={palette.borderHairline}
                          width={56}
                        />
                        <YAxis
                          yAxisId="memory"
                          orientation="right"
                          unit=" MB"
                          tick={{ fill: palette.textMuted, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                          stroke={palette.borderHairline}
                          width={60}
                        />
                        <Tooltip
                          content={
                            <ScientificTooltip
                              labelPrefix="Hora: "
                              unitByKey={{ durationMs: ' ms', memoryMb: ' MB' }}
                              extraMeta={(p) => `${p.title} · ${p.kindLabel}`}
                            />
                          }
                        />
                        <ReferenceLine
                          yAxisId="time"
                          y={simPerfStats.avgDurationMs}
                          stroke={palette.chart4}
                          strokeDasharray="4 4"
                          label={{
                            value: `Media ${simPerfStats.avgDurationMs.toFixed(1)} ms`,
                            fill: palette.chart4,
                            fontSize: 10,
                            position: 'insideTopRight',
                          }}
                        />
                        <Area
                          yAxisId="time"
                          type="monotone"
                          dataKey="durationMs"
                          name="Tiempo de ejecución"
                          stroke={palette.chart1}
                          strokeWidth={2.2}
                          fill={`url(#simDur-${dashUid})`}
                          dot={{ r: 3.5, fill: palette.chart1 }}
                          activeDot={{ r: 5 }}
                        />
                        <Area
                          yAxisId="memory"
                          type="monotone"
                          dataKey="memoryMb"
                          name="Uso de memoria"
                          stroke={palette.chart2}
                          strokeWidth={2.2}
                          fill={`url(#simMem-${dashUid})`}
                          dot={{ r: 3.5, fill: palette.chart2 }}
                          activeDot={{ r: 5 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </ScientificChartCard>
          </section>
        );

      case 'themes':
        return (
          <section key="themes" className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                Sistema Visual Dinámico (6 Temas Globales)
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Selecciona cualquiera de los seis temas globales (incluyendo Neural Cyberpunk y Black &amp; Gold); la preferencia se conserva automáticamente en tu navegador.
              </p>
            </div>
            <ThemeSwitcher />
          </section>
        );

      case 'labs':
        return (
          <section key="labs" className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                Laboratorios y Módulos Técnicos
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Navegación directa entre motores matemáticos, geometría 2D/3D, explicabilidad XAI, evaluación y verificación.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {labs.map((lab) => {
                const Icon = lab.icon;
                return (
                  <button
                    key={lab.id}
                    type="button"
                    onClick={() => setActiveModule(lab.id)}
                    className="surface-card rounded-xl p-5 text-left hover:border-[var(--accent-primary)] hover:-translate-y-0.5 transition-all cursor-pointer flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-[var(--text-muted)]">{lab.subtitle}</span>
                        <Icon className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
                      </div>
                      <h3 className="text-base font-semibold text-[var(--text-primary)]">
                        {lab.title}
                      </h3>
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        {lab.description}
                      </p>
                    </div>
                    <div className="pt-3 border-t border-[var(--border-hairline)] flex items-center justify-between gap-2 text-xs">
                      <span className="font-mono tabular-nums text-[var(--text-muted)] truncate">
                        {lab.metricText}
                      </span>
                      <span className="text-[var(--accent-primary)] font-medium whitespace-nowrap shrink-0">
                        Abrir →
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Toolbar: Personalización del Dashboard */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-[var(--text-muted)]">
          Centro de Operaciones · Panel personalizable
        </div>
        <div className="flex items-center gap-2">
          {!isTutorialOpen && (
            <button
              type="button"
              onClick={openTutorial}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border-hairline)] surface-elevated text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <Compass className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              Guía interactiva
            </button>
          )}
          <button
            type="button"
            onClick={() => setCustomizeMode((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-colors ${
              customizeMode
                ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] border-[var(--accent-primary)]'
                : 'border-[var(--border-hairline)] surface-elevated text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            {customizeMode ? 'Cerrar personalización' : 'Personalizar paneles'}
          </button>
        </div>
      </div>

      {customizeMode && (
        <div className="surface-card rounded-2xl p-5 space-y-3 border border-[var(--border-strong)]">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-semibold text-[var(--text-primary)]">
              Reordenar o mostrar/ocultar secciones del Panel Principal
            </div>
            <button
              type="button"
              onClick={resetPanels}
              className="inline-flex items-center gap-1 text-xs text-[var(--accent-primary)] hover:underline cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restaurar orden por defecto
            </button>
          </div>
          <div className="space-y-2">
            {panels.map((p, idx) => (
              <div
                key={p.id}
                className="surface-elevated rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 text-xs"
              >
                <span className={p.visible ? 'text-[var(--text-primary)] font-medium' : 'text-[var(--text-muted)] line-through'}>
                  {idx + 1}. {p.label}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => movePanel(idx, -1)}
                    aria-label={`Subir ${p.label}`}
                    className="p-1.5 rounded border border-[var(--border-hairline)] disabled:opacity-35 hover:bg-[var(--bg-hover)] cursor-pointer"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === panels.length - 1}
                    onClick={() => movePanel(idx, 1)}
                    aria-label={`Bajar ${p.label}`}
                    className="p-1.5 rounded border border-[var(--border-hairline)] disabled:opacity-35 hover:bg-[var(--bg-hover)] cursor-pointer"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => togglePanelVisibility(p.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-[var(--border-hairline)] hover:bg-[var(--bg-hover)] cursor-pointer"
                  >
                    {p.visible ? (
                      <>
                        <Eye className="w-3.5 h-3.5 text-[var(--status-ok)]" />
                        Visible
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                        Oculto
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dynamic Customizable Panels */}
      {panels.filter((p) => p.visible).map((p) => renderPanel(p.id))}

      {/* Discrete Institutional Credits Access */}
      <footer className="pt-4 border-t border-[var(--border-hairline)] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
        <span>
          VectorIA Studio · Equipo de desarrollo:{' '}
          {loadDevelopmentTeam()
            .map((m) => m.name)
            .join(' · ')}
        </span>
        <button
          type="button"
          onClick={() => {
            try {
              window.sessionStorage.setItem(DEVELOPMENT_TEAM_SCROLL_KEY, 'equipo-desarrollo');
            } catch {
              // Ignore storage access errors
            }
            setActiveModule('account');
          }}
          className="inline-flex items-center gap-1 font-medium text-[var(--accent-primary)] hover:underline cursor-pointer self-start sm:self-auto whitespace-nowrap shrink-0"
        >
          Equipo de desarrollo
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </footer>
    </div>
  );
};
