import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Box,
  Calculator,
  CheckCircle2,
  Cpu,
  Image as ImageIcon,
  Info,
  Layers,
  Play,
  Server,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useStudio } from '../../context/StudioContext';
import { rasterizeGlyph } from '../../engines/alphanumericDataset';
import {
  computeEigen,
  matrixDeterminant,
  matrixInverse,
  matrixLU,
  matrixQR,
} from '../../engines/linearAlgebra';
import { BuilderBlock, ModuleConnection, PreparedModuleSpec } from '../../types/builder';
import { ClassifierMode, ModuleId } from '../../types/vectoria';
import { resolveRealChartDataset } from '../../utils/builderChartData';
import { sanitizeBuilderUrl } from '../../utils/builderSecurity';
import { ConfusionMatrixHeatmap } from '../charts/ConfusionMatrixHeatmap';
import { ScientificChartCard } from '../charts/ScientificChartCard';
import { ScientificTooltip } from '../charts/ScientificTooltip';
import { useChartPalette } from '../charts/chartTheme';

interface BuilderBlockRendererProps {
  block: BuilderBlock;
  modules?: PreparedModuleSpec[];
  connections?: ModuleConnection[];
  onNavigateCustomPage?: (pageId: string) => void;
  isEditorCanvas?: boolean;
}

const DEFAULT_FALLBACK_SERIES = [
  { key: 'valPct', label: 'Validación (%)', color: 'var(--chart-1)', visible: true },
];

export const BuilderBlockRenderer: React.FC<BuilderBlockRendererProps> = ({
  block,
  modules = [],
  connections = [],
  onNavigateCustomPage,
  isEditorCanvas = false,
}) => {
  const {
    setActiveModule,
    digitsSummary,
    lettersSummary,
    alphanumericSummary,
    lastPrediction,
    predictionHistory,
    simulationHistory,
    lastMathOutput,
    reportHistory,
    sharedMatrix2D,
    suiteRef,
  } = useStudio();
  const palette = useChartPalette();

  const [imgError, setImgError] = useState(false);
  const [mathOp, setMathOp] = useState<'determinant' | 'inverse' | 'eigen' | 'lu' | 'qr'>(
    block.content.mathOperationPreset ?? 'eigen'
  );
  const [aiGlyph, setAiGlyph] = useState('A');
  const [aiMode, setAiMode] = useState<ClassifierMode>(
    block.content.classifierModePreset ?? 'alphanumeric'
  );
  const [diagSnapshot, setDiagSnapshot] = useState<{
    uptimeSec: number;
    apiRequests: number;
    avgLatencyMs: number;
    cacheHits: number;
  } | null>(null);

  useEffect(() => {
    setImgError(false);
  }, [block.content.imageUrl]);

  useEffect(() => {
    if (block.content.mathOperationPreset) {
      setMathOp(block.content.mathOperationPreset);
    }
  }, [block.content.mathOperationPreset]);

  useEffect(() => {
    if (block.content.classifierModePreset) {
      setAiMode(block.content.classifierModePreset);
    }
  }, [block.content.classifierModePreset]);

  useEffect(() => {
    if (block.type !== 'module-adapter' || block.content.linkedModuleId !== 'api-console') {
      return;
    }
    let cancelled = false;
    fetch('/api/diagnostics')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data && data.traffic) {
          setDiagSnapshot({
            uptimeSec: data.uptimeSec ?? 0,
            apiRequests: data.traffic.apiRequests ?? 0,
            avgLatencyMs: data.traffic.avgLatencyMs ?? 0,
            cacheHits: data.mathCache?.hits ?? 0,
          });
        }
      })
      .catch(() => {
        // Ignore offline errors cleanly
      });
    return () => {
      cancelled = true;
    };
  }, [block.type, block.content.linkedModuleId]);

  const activeConnection = useMemo(
    () => connections.find((c) => c.targetBlockId === block.id && c.enabled),
    [connections, block.id]
  );

  const sourceModuleId = activeConnection?.sourceModuleId ?? block.content.connectedSourceModuleId;
  const linkedSourceModule = useMemo(
    () => (sourceModuleId ? modules.find((m) => m.id === sourceModuleId) : undefined),
    [modules, sourceModuleId]
  );

  const isSourceModuleDisabled = Boolean(linkedSourceModule && !linkedSourceModule.enabled);

  const mathResult = useMemo(() => {
    if (block.type !== 'math-tool') return null;
    try {
      const m = sharedMatrix2D;
      switch (mathOp) {
        case 'determinant':
          return matrixDeterminant(m);
        case 'inverse':
          return matrixInverse(m);
        case 'lu':
          return matrixLU(m);
        case 'qr':
          return matrixQR(m);
        case 'eigen':
        default:
          return computeEigen(m);
      }
    } catch (err) {
      return err instanceof Error ? err.message : 'Operación no aplicable a esta matriz.';
    }
  }, [block.type, mathOp, sharedMatrix2D]);

  const liveAiPrediction = useMemo(() => {
    if (block.type !== 'ai-module') return null;
    const suite = suiteRef.current;
    const model =
      aiMode === 'digits'
        ? suite.digitsModel
        : aiMode === 'letters'
          ? suite.lettersModel
          : suite.alphanumericModel;
    const validLabel =
      aiMode === 'digits'
        ? /^[0-9]$/.test(aiGlyph)
          ? aiGlyph
          : '3'
        : aiMode === 'letters'
          ? /^[A-Z]$/.test(aiGlyph)
            ? aiGlyph
            : 'A'
          : /^[0-9A-Z]$/.test(aiGlyph)
            ? aiGlyph
            : 'A';
    const grid = rasterizeGlyph(validLabel);
    const pred = model.predictScores(grid);
    return { glyph: validLabel, pred };
  }, [block.type, aiMode, aiGlyph, suiteRef]);

  const chartData = useMemo(() => {
    if (block.type !== 'chart' || !block.content.chartConfig) return null;
    return resolveRealChartDataset(block.content.chartConfig.dataSource, {
      digitsSummary,
      lettersSummary,
      alphanumericSummary,
      lastPrediction,
      predictionHistory,
      simulationHistory,
      lastMathOutput,
    });
  }, [
    block.type,
    block.content.chartConfig,
    digitsSummary,
    lettersSummary,
    alphanumericSummary,
    lastPrediction,
    predictionHistory,
    simulationHistory,
    lastMathOutput,
  ]);

  const boxStyle: React.CSSProperties = {
    padding: `${block.styles.paddingPx}px`,
    marginBottom: `${block.styles.marginBottomPx}px`,
    borderRadius: `${block.styles.borderRadiusPx}px`,
    borderWidth: `${block.styles.borderWidthPx}px`,
    borderStyle: block.styles.borderWidthPx > 0 ? 'solid' : 'none',
    borderColor: block.styles.borderColor || 'var(--border-hairline)',
    backgroundColor: block.styles.backgroundColor || 'var(--bg-surface)',
    color: block.styles.textColor || 'var(--text-primary)',
    fontSize: `${block.styles.fontSizePx}px`,
    fontWeight: block.styles.fontWeight,
    fontFamily:
      block.styles.fontFamily === 'mono'
        ? '"JetBrains Mono", monospace'
        : '"Plus Jakarta Sans", sans-serif',
    textAlign: block.styles.textAlign,
    boxShadow:
      block.styles.shadow === 'elevated'
        ? '0 10px 28px -16px rgba(0,0,0,0.45)'
        : block.styles.shadow === 'subtle'
          ? '0 2px 10px -6px rgba(0,0,0,0.2)'
          : 'none',
  };

  const handleActionClick = () => {
    if (isEditorCanvas) return;
    const action = block.content.buttonAction ?? 'navigate-module';
    const target = block.content.buttonTarget ?? '';
    if (action === 'navigate-module' && target) {
      setActiveModule(target as ModuleId);
    } else if (action === 'navigate-page' && target && onNavigateCustomPage) {
      onNavigateCustomPage(target);
    } else if (action === 'open-url') {
      const safe = sanitizeBuilderUrl(target, false);
      if (safe) {
        window.location.assign(safe);
      }
    }
  };

  const resolveKpiDisplay = (): { value: string; caption: string } => {
    switch (block.content.kpiValueSource) {
      case 'digits-acc':
        return {
          value: `${(digitsSummary.valAccuracy * 100).toFixed(1)}`,
          caption: `${digitsSummary.epochsTrained} épocas · 10 clases`,
        };
      case 'letters-acc':
        return {
          value: `${(lettersSummary.valAccuracy * 100).toFixed(1)}`,
          caption: `${lettersSummary.epochsTrained} épocas · 26 clases`,
        };
      case 'predictions-count':
        return {
          value: String(predictionHistory.length),
          caption: 'Inferencias ejecutadas en sesión',
        };
      case 'simulations-count':
        return {
          value: String(simulationHistory.length),
          caption: 'Experimentos en Simulation Lab',
        };
      case 'reports-count':
        return {
          value: String(reportHistory.length),
          caption: 'Informes técnicos generados',
        };
      case 'manual':
        return {
          value: block.content.kpiManualValue || '0',
          caption: 'Valor configurado manualmente',
        };
      case 'alphanumeric-acc':
      default:
        return {
          value: alphanumericSummary.isTrained
            ? `${(alphanumericSummary.valAccuracy * 100).toFixed(1)}`
            : '0.0',
          caption: `${alphanumericSummary.epochsTrained} épocas · 36 clases (0–9, A–Z)`,
        };
    }
  };

  if (isSourceModuleDisabled) {
    return (
      <div style={boxStyle} className="space-y-2 border border-dashed">
        <div className="flex items-center gap-2 text-xs font-semibold text-[var(--status-warn)]">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Módulo desactivado en Nivel 2: {linkedSourceModule?.name}</span>
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          Reactiva este módulo desde la pestaña de Constructor Avanzado para reanudar su salida conectada.
        </p>
      </div>
    );
  }

  switch (block.type) {
    case 'divider':
      return (
        <div style={{ padding: `${block.styles.paddingPx}px 0` }} className="w-full">
          <div className="border-t border-[var(--border-hairline)]" />
        </div>
      );

    case 'text':
      return (
        <div style={boxStyle} className="space-y-2">
          {block.content.title && (
            <h3 className="text-base font-bold text-[var(--text-primary)]">{block.content.title}</h3>
          )}
          {block.content.subtitle && (
            <p className="text-xs font-medium text-[var(--accent-primary)]">{block.content.subtitle}</p>
          )}
          {block.content.body && (
            <p className="text-xs sm:text-sm leading-relaxed text-[var(--text-secondary)] whitespace-pre-line">
              {block.content.body}
            </p>
          )}
        </div>
      );

    case 'callout': {
      const tone = block.content.calloutTone ?? 'info';
      const Icon = tone === 'ok' ? CheckCircle2 : tone === 'warn' ? AlertTriangle : Info;
      const toneColor =
        tone === 'ok'
          ? 'text-[var(--status-ok)] border-[var(--status-ok)]/30 bg-[var(--status-ok)]/10'
          : tone === 'warn'
            ? 'text-[var(--status-warn)] border-[var(--status-warn)]/30 bg-[var(--status-warn)]/10'
            : 'text-[var(--accent-primary)] border-[var(--accent-primary)]/30 bg-[var(--accent-soft)]';
      return (
        <div style={boxStyle} className={`rounded-xl border p-4 ${toneColor}`}>
          <div className="flex items-start gap-2.5">
            <Icon className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              {block.content.title && (
                <div className="text-xs font-semibold text-[var(--text-primary)]">
                  {block.content.title}
                </div>
              )}
              {block.content.body && (
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  {block.content.body}
                </p>
              )}
            </div>
          </div>
        </div>
      );
    }

    case 'image': {
      const safeUrl = sanitizeBuilderUrl(block.content.imageUrl, true);
      return (
        <div style={boxStyle} className="space-y-3">
          {block.content.title && (
            <div className="text-xs font-semibold text-[var(--text-primary)]">
              {block.content.title}
            </div>
          )}
          {!safeUrl || imgError ? (
            <div className="h-44 rounded-xl border border-dashed border-[var(--border-hairline)] bg-[var(--bg-elevated)] flex flex-col items-center justify-center gap-2 text-xs text-[var(--text-muted)]">
              <ImageIcon className="w-6 h-6 text-[var(--accent-primary)]" />
              <span>{block.content.imageAlt || 'Vista previa visual sin imagen cargada'}</span>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)]/40 flex items-center justify-center max-h-64">
              <img
                src={safeUrl}
                alt={block.content.imageAlt || block.content.title || 'Imagen VectorIA'}
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="max-h-64 w-auto object-contain"
              />
            </div>
          )}
          {block.content.subtitle && (
            <p className="text-[11px] text-[var(--text-muted)]">{block.content.subtitle}</p>
          )}
        </div>
      );
    }

    case 'button': {
      const variant = block.content.buttonVariant ?? 'primary';
      const btnCls =
        variant === 'secondary'
          ? 'bg-[var(--accent-secondary)] text-[var(--accent-contrast)]'
          : variant === 'outline'
            ? 'border border-[var(--border-strong)] surface-elevated text-[var(--text-primary)] hover:border-[var(--accent-primary)]'
            : 'bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-contrast)]';
      return (
        <div style={boxStyle} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            {block.content.title && (
              <div className="text-xs font-semibold text-[var(--text-primary)]">
                {block.content.title}
              </div>
            )}
            {block.content.subtitle && (
              <div className="text-[11px] text-[var(--text-muted)]">{block.content.subtitle}</div>
            )}
          </div>
          <button
            type="button"
            onClick={handleActionClick}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${btnCls}`}
          >
            <span>{block.content.buttonLabel || 'Ejecutar acción'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      );
    }

    case 'kpi': {
      const kpi = resolveKpiDisplay();
      return (
        <div style={boxStyle} className="space-y-1.5">
          <div className="text-[11px] font-medium text-[var(--text-muted)]">
            {block.content.title || 'Indicador'}
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-[var(--accent-primary)]">
            {kpi.value}
            {block.content.kpiUnit ?? ''}
          </div>
          <div className="text-[11px] text-[var(--text-secondary)]">{kpi.caption}</div>
        </div>
      );
    }

    case 'stats-panel':
      return (
        <div style={boxStyle} className="space-y-3">
          <div>
            <div className="text-sm font-semibold text-[var(--text-primary)]">
              {block.content.title || 'Panel Estadístico Global'}
            </div>
            {block.content.subtitle && (
              <div className="text-xs text-[var(--text-muted)]">{block.content.subtitle}</div>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="surface-elevated rounded-xl p-3 space-y-0.5">
              <div className="text-[var(--text-muted)]">Dígitos 0–9</div>
              <div className="font-mono font-bold tabular-nums text-base text-[var(--text-primary)]">
                {(digitsSummary.valAccuracy * 100).toFixed(1)}%
              </div>
              <div className="text-[11px] text-[var(--text-muted)]">
                {digitsSummary.epochsTrained} épocas
              </div>
            </div>
            <div className="surface-elevated rounded-xl p-3 space-y-0.5">
              <div className="text-[var(--text-muted)]">Letras A–Z</div>
              <div className="font-mono font-bold tabular-nums text-base text-[var(--text-primary)]">
                {(lettersSummary.valAccuracy * 100).toFixed(1)}%
              </div>
              <div className="text-[11px] text-[var(--text-muted)]">
                {lettersSummary.epochsTrained} épocas
              </div>
            </div>
            <div className="surface-elevated rounded-xl p-3 space-y-0.5">
              <div className="text-[var(--text-muted)]">Combinado 36</div>
              <div className="font-mono font-bold tabular-nums text-base text-[var(--accent-primary)]">
                {(alphanumericSummary.valAccuracy * 100).toFixed(1)}%
              </div>
              <div className="text-[11px] text-[var(--text-muted)]">
                {alphanumericSummary.epochsTrained} épocas
              </div>
            </div>
            <div className="surface-elevated rounded-xl p-3 space-y-0.5">
              <div className="text-[var(--text-muted)]">Sesión Activa</div>
              <div className="font-mono font-bold tabular-nums text-base text-[var(--text-primary)]">
                {predictionHistory.length} / {simulationHistory.length}
              </div>
              <div className="text-[11px] text-[var(--text-muted)]">
                Inferencias / Sim.
              </div>
            </div>
          </div>
        </div>
      );

    case 'table': {
      const cols = block.content.tableColumns ?? ['Parámetro', 'Valor'];
      const rows = block.content.tableRows ?? [];
      return (
        <div style={boxStyle} className="space-y-3">
          {block.content.title && (
            <div className="text-sm font-semibold text-[var(--text-primary)]">
              {block.content.title}
            </div>
          )}
          <div className="overflow-x-auto rounded-xl border border-[var(--border-hairline)]">
            <table className="w-full text-xs font-mono tabular-nums">
              <thead>
                <tr className="border-b border-[var(--border-hairline)] bg-[var(--bg-elevated)] text-[var(--text-muted)]">
                  {cols.map((col, idx) => (
                    <th
                      key={idx}
                      className={`py-2 px-3 font-sans font-semibold ${
                        idx === 0 ? 'text-left' : 'text-right'
                      }`}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rIdx) => (
                  <tr
                    key={rIdx}
                    className="border-b border-[var(--border-hairline)] last:border-none hover:bg-[var(--bg-elevated)]/60"
                  >
                    {cols.map((_, cIdx) => (
                      <td
                        key={cIdx}
                        className={`py-1.5 px-3 ${
                          cIdx === 0
                            ? 'text-left font-medium text-[var(--text-primary)]'
                            : 'text-right text-[var(--text-secondary)]'
                        }`}
                      >
                        {row[cIdx] ?? '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    case 'nav-menu': {
      const links: Array<{ id: ModuleId; label: string }> = [
        { id: 'classifier', label: 'Clasificador' },
        { id: 'linear-algebra', label: 'Álgebra Lineal' },
        { id: 'simulation-lab', label: 'Simulation Lab' },
        { id: 'analytics', label: 'Analítica' },
        { id: 'omni-bot', label: 'Omni Bot' },
      ];
      return (
        <div style={boxStyle} className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-semibold text-[var(--text-primary)]">
            {block.content.title || 'Accesos Rápidos'}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {links.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => !isEditorCanvas && setActiveModule(item.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium surface-elevated border border-[var(--border-hairline)] hover:border-[var(--accent-primary)] text-[var(--text-primary)] cursor-pointer whitespace-nowrap"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      );
    }

    case 'diagram': {
      const kind = block.content.diagramKind ?? 'mlp-architecture';
      const nodes =
        kind === 'linear-transform-flow'
          ? ['Matriz A ∈ ℝⁿˣⁿ', 'Descomposición PA=LU / QR', 'Autovalores λ / Det', 'Verificación Residuo']
          : kind === 'pipeline-backprop'
            ? ['Forward Z=WX+b', 'Activación ReLU / Softmax', 'Gradiente ∂L/∂W', 'Paso SGD + Momento']
            : ['Entrada 16×16 (256)', 'Oculta ReLU 1', 'Oculta ReLU 2', 'Salida Softmax (36)'];
      return (
        <div style={boxStyle} className="space-y-3">
          <div>
            <div className="text-sm font-semibold text-[var(--text-primary)]">
              {block.content.title || 'Diagrama de Flujo'}
            </div>
            {block.content.subtitle && (
              <div className="text-xs text-[var(--text-muted)]">{block.content.subtitle}</div>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
            {nodes.map((node, i) => (
              <div
                key={i}
                className="surface-elevated rounded-xl p-3 border border-[var(--border-hairline)] text-center space-y-1"
              >
                <div className="text-[10px] font-mono text-[var(--accent-primary)]">
                  Etapa 0{i + 1}
                </div>
                <div className="text-xs font-semibold text-[var(--text-primary)]">{node}</div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    case 'chart': {
      const cfg = block.content.chartConfig;
      if (!cfg || !chartData) {
        return (
          <div style={boxStyle} className="text-xs text-[var(--text-muted)]">
            Gráfica sin configuración válida.
          </div>
        );
      }

      if (cfg.chartKind === 'confusion-matrix' && chartData.confusionMatrix) {
        return (
          <ConfusionMatrixHeatmap
            title={cfg.title}
            subtitle={cfg.subtitle}
            labels={chartData.confusionMatrix.labels}
            matrix={chartData.confusionMatrix.matrix}
            exportFilename={`builder_${block.id}`}
          />
        );
      }

      const activeSeries =
        cfg.series && cfg.series.length > 0
          ? cfg.series.filter((s) => s.visible)
          : DEFAULT_FALLBACK_SERIES;
      const seriesToDraw =
        activeSeries.length > 0
          ? activeSeries
          : chartData.availableSeries.slice(0, 2).map((s) => ({
              key: s.key,
              label: s.label,
              color: s.defaultColor,
              visible: true,
            }));

      const tableRows = chartData.rows.map((r) => [
        String(r[chartData.xKey] ?? ''),
        ...seriesToDraw.map((s) => Number(r[s.key] ?? 0)),
      ]);

      return (
        <ScientificChartCard
          title={cfg.title}
          subtitle={cfg.subtitle}
          exportFilename={`builder_${block.id}`}
          dataTable={{
            columns: [cfg.xAxisLabel || chartData.xKey, ...seriesToDraw.map((s) => s.label)],
            rows: tableRows,
          }}
        >
          {chartData.emptyReason ? (
            <div className="h-52 flex items-center justify-center text-xs text-[var(--text-muted)]">
              {chartData.emptyReason}
            </div>
          ) : cfg.chartKind === 'heatmap' && chartData.heatmapMatrix ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono tabular-nums">
                <thead>
                  <tr className="text-[var(--text-muted)]">
                    <th className="py-1.5 px-2 text-left">Modelo</th>
                    {chartData.heatmapMatrix.colLabels.map((c, idx) => (
                      <th key={idx} className="py-1.5 px-2 text-right">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {chartData.heatmapMatrix.matrix.map((row, rIdx) => (
                    <tr key={rIdx}>
                      <td className="py-1.5 px-2 font-semibold text-[var(--text-primary)]">
                        {chartData.heatmapMatrix!.rowLabels[rIdx]}
                      </td>
                      {row.map((val, cIdx) => {
                        const alpha = Math.min(0.85, Math.max(0.12, val / 100));
                        return (
                          <td
                            key={cIdx}
                            className="py-1.5 px-2 text-right rounded-md"
                            style={{
                              backgroundColor: `color-mix(in srgb, ${palette.chart1} ${Math.round(alpha * 100)}%, transparent)`,
                            }}
                          >
                            {val}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ height: `${cfg.heightPx}px` }} className="w-full">
              <ResponsiveContainer width="100%" height="100%">
                {cfg.chartKind === 'line' ? (
                  <LineChart data={chartData.rows} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                    {cfg.showGrid && (
                      <CartesianGrid strokeDasharray="3 3" stroke={palette.borderHairline} />
                    )}
                    <XAxis
                      dataKey={chartData.xKey}
                      tick={{ fill: palette.textMuted, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                      stroke={palette.borderHairline}
                    />
                    <YAxis
                      domain={cfg.scaleMode === 'percentage' ? [0, 100] : ['auto', 'auto']}
                      tick={{ fill: palette.textMuted, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                      stroke={palette.borderHairline}
                    />
                    <Tooltip content={<ScientificTooltip decimals={2} />} />
                    {seriesToDraw.map((s) => (
                      <Line
                        key={s.key}
                        type="monotone"
                        dataKey={s.key}
                        name={s.label}
                        stroke={s.color || palette.chart1}
                        strokeWidth={2.2}
                        dot={{ r: 3 }}
                      />
                    ))}
                  </LineChart>
                ) : cfg.chartKind === 'area' ? (
                  <AreaChart data={chartData.rows} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                    {cfg.showGrid && (
                      <CartesianGrid strokeDasharray="3 3" stroke={palette.borderHairline} />
                    )}
                    <XAxis
                      dataKey={chartData.xKey}
                      tick={{ fill: palette.textMuted, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                      stroke={palette.borderHairline}
                    />
                    <YAxis
                      domain={cfg.scaleMode === 'percentage' ? [0, 100] : ['auto', 'auto']}
                      tick={{ fill: palette.textMuted, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                      stroke={palette.borderHairline}
                    />
                    <Tooltip content={<ScientificTooltip decimals={2} />} />
                    {seriesToDraw.map((s) => (
                      <Area
                        key={s.key}
                        type="monotone"
                        dataKey={s.key}
                        name={s.label}
                        stroke={s.color || palette.chart1}
                        fill={s.color || palette.chart1}
                        fillOpacity={0.22}
                        strokeWidth={2}
                      />
                    ))}
                  </AreaChart>
                ) : cfg.chartKind === 'scatter' ? (
                  <ScatterChart margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                    {cfg.showGrid && (
                      <CartesianGrid strokeDasharray="3 3" stroke={palette.borderHairline} />
                    )}
                    <XAxis
                      type="category"
                      dataKey={chartData.xKey}
                      tick={{ fill: palette.textMuted, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                      stroke={palette.borderHairline}
                    />
                    <YAxis
                      type="number"
                      dataKey={seriesToDraw[0]?.key ?? 'valPct'}
                      tick={{ fill: palette.textMuted, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                      stroke={palette.borderHairline}
                    />
                    <Tooltip content={<ScientificTooltip decimals={2} />} />
                    <Scatter
                      name={seriesToDraw[0]?.label ?? 'Valor'}
                      data={chartData.rows}
                      fill={seriesToDraw[0]?.color || palette.chart2}
                    />
                  </ScatterChart>
                ) : (
                  <BarChart
                    data={chartData.rows}
                    layout={cfg.chartKind === 'horizontal-bar' ? 'vertical' : 'horizontal'}
                    margin={{ top: 8, right: 16, left: 8, bottom: 4 }}
                  >
                    {cfg.showGrid && (
                      <CartesianGrid strokeDasharray="3 3" stroke={palette.borderHairline} />
                    )}
                    {cfg.chartKind === 'horizontal-bar' ? (
                      <>
                        <XAxis
                          type="number"
                          domain={cfg.scaleMode === 'percentage' ? [0, 100] : ['auto', 'auto']}
                          tick={{ fill: palette.textMuted, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                          stroke={palette.borderHairline}
                        />
                        <YAxis
                          type="category"
                          dataKey={chartData.xKey}
                          width={90}
                          tick={{ fill: palette.textPrimary, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                          stroke={palette.borderHairline}
                        />
                      </>
                    ) : (
                      <>
                        <XAxis
                          dataKey={chartData.xKey}
                          tick={{ fill: palette.textMuted, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                          stroke={palette.borderHairline}
                        />
                        <YAxis
                          domain={cfg.scaleMode === 'percentage' ? [0, 100] : ['auto', 'auto']}
                          tick={{ fill: palette.textMuted, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                          stroke={palette.borderHairline}
                        />
                      </>
                    )}
                    <Tooltip content={<ScientificTooltip decimals={2} />} />
                    {seriesToDraw.map((s, sIdx) => (
                      <Bar
                        key={s.key}
                        dataKey={s.key}
                        name={s.label}
                        fill={s.color || palette.chart1}
                        radius={cfg.chartKind === 'horizontal-bar' ? [0, 6, 6, 0] : [6, 6, 0, 0]}
                      >
                        {cfg.chartKind === 'histogram' &&
                          chartData.rows.map((_, idx) => (
                            <Cell
                              key={idx}
                              fill={[palette.chart1, palette.chart2, palette.chart3, palette.chart4, palette.chart5][(idx + sIdx) % 5]}
                            />
                          ))}
                      </Bar>
                    ))}
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          )}
        </ScientificChartCard>
      );
    }

    case 'math-tool':
      return (
        <div style={boxStyle} className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-[var(--accent-primary)]" />
              <div>
                <div className="text-sm font-semibold text-[var(--text-primary)]">
                  {block.content.title || 'Herramienta de Álgebra Lineal'}
                </div>
                {block.content.subtitle && (
                  <div className="text-[11px] text-[var(--text-muted)]">{block.content.subtitle}</div>
                )}
              </div>
            </div>
            <select
              value={mathOp}
              onChange={(e) =>
                setMathOp(e.target.value as 'determinant' | 'inverse' | 'eigen' | 'lu' | 'qr')
              }
              className="px-2.5 py-1 rounded-lg surface-elevated border border-[var(--border-hairline)] text-xs font-mono text-[var(--text-primary)]"
            >
              <option value="eigen">Eigenvalores</option>
              <option value="determinant">Determinante</option>
              <option value="inverse">Inversa Gauss-Jordan</option>
              <option value="lu">Factorización PA=LU</option>
              <option value="qr">Factorización A=QR</option>
            </select>
          </div>
          <div className="surface-elevated rounded-xl p-3 text-xs font-mono space-y-1.5">
            <div className="text-[var(--text-muted)]">
              Matriz 2×2 compartida: [{sharedMatrix2D[0].join(', ')}] · [{sharedMatrix2D[1].join(', ')}]
            </div>
            {typeof mathResult === 'string' ? (
              <div className="text-[var(--status-warn)]">{mathResult}</div>
            ) : mathResult ? (
              <>
                <div className="text-[var(--accent-primary)] font-semibold">
                  {mathResult.resultLabel}
                </div>
                <div className="text-[11px] text-[var(--status-ok)]">
                  {mathResult.verification.statement} (residuo: {mathResult.verification.residual.toExponential(2)})
                </div>
              </>
            ) : null}
          </div>
        </div>
      );

    case 'ai-module':
      return (
        <div style={boxStyle} className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[var(--accent-secondary)]" />
              <div>
                <div className="text-sm font-semibold text-[var(--text-primary)]">
                  {block.content.title || 'Clasificador MLP en Vivo'}
                </div>
                {block.content.subtitle && (
                  <div className="text-[11px] text-[var(--text-muted)]">{block.content.subtitle}</div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <select
                value={aiMode}
                onChange={(e) => setAiMode(e.target.value as ClassifierMode)}
                className="px-2 py-1 rounded-lg surface-elevated border border-[var(--border-hairline)] text-xs text-[var(--text-primary)]"
              >
                <option value="digits">0–9</option>
                <option value="letters">A–Z</option>
                <option value="alphanumeric">36 clases</option>
              </select>
              <input
                type="text"
                maxLength={1}
                value={aiGlyph}
                onChange={(e) => setAiGlyph(e.target.value.toUpperCase() || 'A')}
                aria-label="Glifo de prueba"
                className="w-10 px-2 py-1 rounded-lg surface-elevated border border-[var(--border-hairline)] text-center font-mono text-xs text-[var(--text-primary)]"
              />
            </div>
          </div>

          {liveAiPrediction && (
            <div className="surface-elevated rounded-xl p-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-secondary)]">
                  Glifo evaluado: <strong className="font-mono text-[var(--text-primary)]">{liveAiPrediction.glyph}</strong>
                </span>
                <span className="font-mono font-bold tabular-nums text-[var(--status-ok)]">
                  Predicción: {liveAiPrediction.pred.topLabel} ({(liveAiPrediction.pred.confidence * 100).toFixed(1)}%)
                </span>
              </div>
              <div className="space-y-1">
                {liveAiPrediction.pred.topScores.slice(0, 3).map((s) => (
                  <div key={s.label} className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="w-5 text-[var(--text-primary)]">{s.label}</span>
                    <div className="flex-1 h-2 rounded-full bg-[var(--bg-canvas)] overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.round(s.probability * 100)}%`,
                          backgroundColor: 'var(--accent-primary)',
                        }}
                      />
                    </div>
                    <span className="w-12 text-right tabular-nums text-[var(--text-secondary)]">
                      {(s.probability * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );

    case 'module-adapter': {
      const targetId = block.content.linkedModuleId ?? 'verification';
      return (
        <div style={boxStyle} className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              {targetId === 'api-console' ? (
                <Server className="w-4 h-4 text-[var(--accent-primary)] shrink-0 mt-0.5" />
              ) : (
                <Layers className="w-4 h-4 text-[var(--accent-primary)] shrink-0 mt-0.5" />
              )}
              <div>
                <div className="text-sm font-semibold text-[var(--text-primary)]">
                  {block.content.title || 'Módulo Conectado de VectorIA Studio'}
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  {block.content.subtitle || `Adaptador hacia "${targetId}"`}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => !isEditorCanvas && setActiveModule(targetId)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent-soft)] text-[var(--accent-primary)] hover:opacity-90 cursor-pointer whitespace-nowrap"
            >
              <Play className="w-3 h-3" />
              Abrir
            </button>
          </div>

          {diagSnapshot ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono tabular-nums">
              <div className="surface-elevated rounded-lg p-2">
                <div className="text-[var(--text-muted)]">Uptime</div>
                <div className="font-semibold">{diagSnapshot.uptimeSec}s</div>
              </div>
              <div className="surface-elevated rounded-lg p-2">
                <div className="text-[var(--text-muted)]">Peticiones API</div>
                <div className="font-semibold">{diagSnapshot.apiRequests}</div>
              </div>
              <div className="surface-elevated rounded-lg p-2">
                <div className="text-[var(--text-muted)]">Latencia</div>
                <div className="font-semibold">{diagSnapshot.avgLatencyMs} ms</div>
              </div>
              <div className="surface-elevated rounded-lg p-2">
                <div className="text-[var(--text-muted)]">Caché Hits</div>
                <div className="font-semibold">{diagSnapshot.cacheHits}</div>
              </div>
            </div>
          ) : (
            <div className="surface-elevated rounded-xl p-2.5 text-[11px] text-[var(--text-secondary)] flex items-center justify-between">
              <span>Fuente Nivel 2: {linkedSourceModule?.name || targetId}</span>
              <span className="font-mono text-[var(--accent-primary)]">
                {activeConnection ? `${activeConnection.sourcePort} → ${activeConnection.targetPort}` : 'Conectado'}
              </span>
            </div>
          )}
        </div>
      );
    }

    case 'section':
    case 'container':
    case 'card':
    case 'panel':
    default:
      return (
        <div style={boxStyle} className="space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              {block.content.title && (
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  {block.content.title}
                </h3>
              )}
              {block.content.subtitle && (
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{block.content.subtitle}</p>
              )}
            </div>
            {block.type === 'panel' && (
              <Box className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
            )}
            {block.type === 'card' && (
              <Activity className="w-4 h-4 text-[var(--accent-secondary)] shrink-0" />
            )}
            {block.type === 'container' && (
              <BarChart3 className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
            )}
          </div>
          {block.content.body && (
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">
              {block.content.body}
            </p>
          )}
          {block.content.buttonLabel && (
            <div className="pt-1">
              <button
                type="button"
                onClick={handleActionClick}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-contrast)] cursor-pointer"
              >
                <span>{block.content.buttonLabel}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      );
  }
};
