import React, { useId, useMemo, useState } from 'react';
import { Grid3X3 } from 'lucide-react';
import {
  Area,
  Brush,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getMnist784HistoricalReport, getMnist784Meta } from '../../engines/mnist784Engine';
import type { ModelEvaluationSummary } from '../../types/vectoria';
import {
  buildClassifierTrainingProgressSeries,
  buildSingleClassifierEpochSeries,
  computeClassifierTrainingProgressStats,
  type ClassifierTrainingMetric,
  type ClassifierTrainingViewMode,
} from '../../utils/dashboardMetrics';
import { ScientificChartCard } from './ScientificChartCard';
import { ScientificTooltip } from './ScientificTooltip';
import { useChartPalette } from './chartTheme';

interface ClassifierTrainingProgressCardProps {
  digitsSummary: ModelEvaluationSummary;
  lettersSummary: ModelEvaluationSummary;
  alphanumericSummary: ModelEvaluationSummary;
  onOpenClassifier: () => void;
  onOpenAnalytics?: () => void;
}

const MODEL_TABS: Array<{ id: ClassifierTrainingViewMode; label: string }> = [
  { id: 'all', label: 'Comparativa (Todos)' },
  { id: 'digits', label: 'Dígitos 0–9' },
  { id: 'letters', label: 'Letras A–Z' },
  { id: 'alphanumeric', label: 'Alfanumérico (36)' },
  { id: 'mnist784', label: '784–128–10' },
];

export const ClassifierTrainingProgressCard: React.FC<ClassifierTrainingProgressCardProps> = ({
  digitsSummary,
  lettersSummary,
  alphanumericSummary,
  onOpenClassifier,
  onOpenAnalytics,
}) => {
  const palette = useChartPalette();
  const uid = useId().replace(/:/g, '');

  const [viewMode, setViewMode] = useState<ClassifierTrainingViewMode>('all');
  const [metric, setMetric] = useState<ClassifierTrainingMetric>('valAccuracy');

  // Toggleable curves in multi-model comparative mode
  const [visibleModels, setVisibleModels] = useState<
    Record<'digits' | 'letters' | 'alphanumeric' | 'mnist784', boolean>
  >({
    digits: true,
    letters: true,
    alphanumeric: true,
    mnist784: true,
  });

  // Toggleable curves in single-model detail mode
  const [showLoss, setShowLoss] = useState(true);
  const [showTrain, setShowTrain] = useState(true);
  const [showVal, setShowVal] = useState(true);

  const mnistReport = useMemo(() => getMnist784HistoricalReport(), []);
  const mnistMeta = useMemo(() => getMnist784Meta(), []);

  const progressInput = useMemo(
    () => ({
      digitsSummary,
      lettersSummary,
      alphanumericSummary,
      mnistHistory: mnistReport.history,
    }),
    [digitsSummary, lettersSummary, alphanumericSummary, mnistReport.history]
  );

  const comparativeSeries = useMemo(
    () => buildClassifierTrainingProgressSeries(progressInput),
    [progressInput]
  );

  const singleSeries = useMemo(() => {
    if (viewMode === 'all') return [];
    return buildSingleClassifierEpochSeries(viewMode, progressInput);
  }, [viewMode, progressInput]);

  const stats = useMemo(
    () => computeClassifierTrainingProgressStats(progressInput),
    [progressInput]
  );

  const dataTable = useMemo(() => {
    if (viewMode === 'all') {
      const unitSuffix = metric === 'loss' ? '' : '%';
      return {
        columns: [
          'Época',
          `Dígitos 0–9 (${metric === 'loss' ? 'Loss' : metric === 'accuracy' ? 'Train' : 'Val'})`,
          `Letras A–Z (${metric === 'loss' ? 'Loss' : metric === 'accuracy' ? 'Train' : 'Val'})`,
          `Alfanumérico 36 (${metric === 'loss' ? 'Loss' : metric === 'accuracy' ? 'Train' : 'Val'})`,
          metric === 'valAccuracy'
            ? '784–128–10 (solo Train/Eval)'
            : `784–128–10 (${metric === 'loss' ? 'Loss' : 'Train'})`,
        ],
        rows: comparativeSeries.map((pt) => {
          const fmt = (val: number | undefined, dec = 1) =>
            typeof val === 'number' ? `${val.toFixed(dec)}${unitSuffix}` : '—';
          if (metric === 'loss') {
            return [
              pt.epoch,
              fmt(pt.digitsLoss, 4),
              fmt(pt.lettersLoss, 4),
              fmt(pt.alphanumericLoss, 4),
              fmt(pt.mnistLoss, 4),
            ];
          }
          if (metric === 'accuracy') {
            return [
              pt.epoch,
              fmt(pt.digitsTrainPct, 1),
              fmt(pt.lettersTrainPct, 1),
              fmt(pt.alphanumericTrainPct, 1),
              fmt(pt.mnistTrainPct, 1),
            ];
          }
          return [
            pt.epoch,
            fmt(pt.digitsValPct, 1),
            fmt(pt.lettersValPct, 1),
            fmt(pt.alphanumericValPct, 1),
            '—',
          ];
        }),
      };
    }

    const hasVal = singleSeries.some((s) => typeof s.valPct === 'number');
    return {
      columns: hasVal
        ? ['Época', 'Loss CE', 'Train (%)', 'Validación (%)']
        : ['Época', 'Loss CE', 'Train (%)'],
      rows: singleSeries.map((s) =>
        hasVal
          ? [s.epoch, s.loss.toFixed(4), `${s.trainPct.toFixed(1)}%`, `${(s.valPct ?? 0).toFixed(1)}%`]
          : [s.epoch, s.loss.toFixed(4), `${s.trainPct.toFixed(1)}%`]
      ),
    };
  }, [viewMode, metric, comparativeSeries, singleSeries]);

  const toggleModelVisibility = (key: 'digits' | 'letters' | 'alphanumeric' | 'mnist784') => {
    setVisibleModels((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const controls = (
    <div className="flex flex-wrap items-center justify-between gap-2 w-full">
      <div
        role="tablist"
        aria-label="Seleccionar modelo del Clasificador Alfanumérico"
        className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg surface-elevated border border-[var(--border-hairline)]"
      >
        {MODEL_TABS.map((tab) => {
          const active = viewMode === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setViewMode(tab.id)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium cursor-pointer transition-colors whitespace-nowrap ${
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
        {viewMode === 'all' ? (
          <div
            role="group"
            aria-label="Seleccionar métrica histórica"
            className="inline-flex items-center gap-1 p-1 rounded-lg surface-elevated border border-[var(--border-hairline)]"
          >
            {(
              [
                { id: 'valAccuracy', label: 'Validación (%)' },
                { id: 'accuracy', label: 'Train (%)' },
                { id: 'loss', label: 'Loss CE' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setMetric(opt.id)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium cursor-pointer transition-colors whitespace-nowrap ${
                  metric === opt.id
                    ? 'bg-[var(--accent-secondary)] text-[var(--accent-contrast)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowLoss((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium cursor-pointer transition-opacity ${
                showLoss
                  ? 'border-[var(--border-strong)] surface-elevated text-[var(--text-primary)]'
                  : 'border-[var(--border-hairline)] opacity-45 text-[var(--text-muted)]'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: palette.chart1 }} />
              Loss CE
            </button>
            <button
              type="button"
              onClick={() => setShowTrain((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium cursor-pointer transition-opacity ${
                showTrain
                  ? 'border-[var(--border-strong)] surface-elevated text-[var(--text-primary)]'
                  : 'border-[var(--border-hairline)] opacity-45 text-[var(--text-muted)]'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: palette.chart2 }} />
              Train (%)
            </button>
            {viewMode !== 'mnist784' && (
              <button
                type="button"
                onClick={() => setShowVal((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium cursor-pointer transition-opacity ${
                  showVal
                    ? 'border-[var(--border-strong)] surface-elevated text-[var(--text-primary)]'
                    : 'border-[var(--border-hairline)] opacity-45 text-[var(--text-muted)]'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: palette.chart3 }} />
                Val (%)
              </button>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={onOpenClassifier}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border-hairline)] surface-elevated text-[var(--text-primary)] hover:border-[var(--accent-primary)] cursor-pointer whitespace-nowrap shrink-0"
        >
          <Grid3X3 className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
          Clasificador →
        </button>
        {onOpenAnalytics && (
          <button
            type="button"
            onClick={onOpenAnalytics}
            className="px-2.5 py-1.5 rounded-lg text-xs text-[var(--accent-secondary)] font-medium hover:underline cursor-pointer whitespace-nowrap shrink-0"
          >
            Analítica →
          </button>
        )}
      </div>
    </div>
  );

  const unitByKey = useMemo((): Record<string, string> => {
    if (metric === 'loss') {
      return {};
    }
    return {
      digitsValPct: '%',
      lettersValPct: '%',
      alphanumericValPct: '%',
      digitsTrainPct: '%',
      lettersTrainPct: '%',
      alphanumericTrainPct: '%',
      mnistTrainPct: '%',
    };
  }, [metric]);

  return (
    <ScientificChartCard
      title="Progreso Histórico de Entrenamiento — Clasificador Alfanumérico"
      subtitle="Curvas reales época a época de exactitud y pérdida Cross-Entropy en los modelos 16×16 (0–9, A–Z, 36 clases) y registro 784–128–10"
      exportFilename="vectoria_clasificador_progreso_entrenamiento"
      controls={controls}
      dataTable={dataTable}
    >
      <div className="space-y-4">
        {/* Live per-model epoch summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="surface-elevated rounded-xl p-3">
            <div className="text-[var(--text-muted)]">Dígitos 0–9</div>
            <div className="text-sm font-bold font-mono tabular-nums text-[var(--text-primary)] mt-0.5">
              {stats.digitsValPct !== null ? `${stats.digitsValPct.toFixed(1)}% val` : 'Sin entrenar'}
            </div>
            <div className="text-[11px] font-mono tabular-nums text-[var(--text-muted)]">
              {stats.digitsEpochs} épocas · Loss {digitsSummary.finalLoss.toFixed(3)}
            </div>
          </div>

          <div className="surface-elevated rounded-xl p-3">
            <div className="text-[var(--text-muted)]">Letras A–Z</div>
            <div className="text-sm font-bold font-mono tabular-nums text-[var(--text-primary)] mt-0.5">
              {stats.lettersValPct !== null ? `${stats.lettersValPct.toFixed(1)}% val` : 'Sin entrenar'}
            </div>
            <div className="text-[11px] font-mono tabular-nums text-[var(--text-muted)]">
              {stats.lettersEpochs} épocas · Loss {lettersSummary.finalLoss.toFixed(3)}
            </div>
          </div>

          <div className="surface-elevated rounded-xl p-3">
            <div className="text-[var(--text-muted)]">Alfanumérico (36)</div>
            <div className="text-sm font-bold font-mono tabular-nums text-[var(--accent-primary)] mt-0.5">
              {stats.alphanumericValPct !== null
                ? `${stats.alphanumericValPct.toFixed(1)}% val`
                : 'Sin entrenar'}
            </div>
            <div className="text-[11px] font-mono tabular-nums text-[var(--text-muted)]">
              {stats.alphanumericEpochs > 0
                ? `${stats.alphanumericEpochs} épocas · Loss ${alphanumericSummary.finalLoss.toFixed(3)}`
                : 'Entrena en Clasificador'}
            </div>
          </div>

          <div className="surface-elevated rounded-xl p-3">
            <div className="text-[var(--text-muted)]">784–128–10 (Original)</div>
            <div className="text-sm font-bold font-mono tabular-nums text-[var(--accent-secondary)] mt-0.5">
              {(mnistMeta.evaluacion.exactitud * 100).toFixed(1)}% eval
            </div>
            <div className="text-[11px] font-mono tabular-nums text-[var(--text-muted)]">
              {stats.mnistEpochs} épocas · Train {stats.mnistTrainPct?.toFixed(1) ?? '0.0'}%
            </div>
          </div>
        </div>

        {/* Interactive Legend Series Toggles in comparative mode */}
        {viewMode === 'all' && (
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <button
              type="button"
              onClick={() => toggleModelVisibility('digits')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border cursor-pointer transition-opacity ${
                visibleModels.digits
                  ? 'border-[var(--border-strong)] surface-elevated text-[var(--text-primary)]'
                  : 'border-[var(--border-hairline)] opacity-45 text-[var(--text-muted)]'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: palette.chart1 }} />
              Dígitos 0–9
            </button>
            <button
              type="button"
              onClick={() => toggleModelVisibility('letters')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border cursor-pointer transition-opacity ${
                visibleModels.letters
                  ? 'border-[var(--border-strong)] surface-elevated text-[var(--text-primary)]'
                  : 'border-[var(--border-hairline)] opacity-45 text-[var(--text-muted)]'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: palette.chart2 }} />
              Letras A–Z
            </button>
            <button
              type="button"
              onClick={() => toggleModelVisibility('alphanumeric')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border cursor-pointer transition-opacity ${
                visibleModels.alphanumeric
                  ? 'border-[var(--border-strong)] surface-elevated text-[var(--text-primary)]'
                  : 'border-[var(--border-hairline)] opacity-45 text-[var(--text-muted)]'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: palette.chart3 }} />
              Combinado 36
            </button>
            {metric !== 'valAccuracy' && (
              <button
                type="button"
                onClick={() => toggleModelVisibility('mnist784')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border cursor-pointer transition-opacity ${
                  visibleModels.mnist784
                    ? 'border-[var(--border-strong)] surface-elevated text-[var(--text-primary)]'
                    : 'border-[var(--border-hairline)] opacity-45 text-[var(--text-muted)]'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: palette.chart4 }} />
                784–128–10 (Sintético)
              </button>
            )}
          </div>
        )}

        {/* Chart Area */}
        {viewMode === 'all' ? (
          comparativeSeries.length === 0 ? (
            <div className="h-60 flex items-center justify-center text-xs text-[var(--text-muted)]">
              Sin épocas de entrenamiento registradas todavía.
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={comparativeSeries}
                  margin={{ top: 10, right: 16, left: 0, bottom: 4 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={palette.borderHairline}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="epoch"
                    tickFormatter={(v) => `Ép. ${v}`}
                    tick={{ fill: palette.textMuted, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                    stroke={palette.borderHairline}
                  />
                  <YAxis
                    domain={metric === 'loss' ? ['auto', 'auto'] : [0, 100]}
                    unit={metric === 'loss' ? '' : '%'}
                    tick={{ fill: palette.textMuted, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                    stroke={palette.borderHairline}
                    width={46}
                  />
                  <Tooltip
                    content={
                      <ScientificTooltip
                        labelPrefix="Época "
                        decimals={metric === 'loss' ? 4 : 1}
                        unitByKey={unitByKey}
                      />
                    }
                  />
                  {visibleModels.digits && (
                    <Line
                      type="monotone"
                      dataKey={
                        metric === 'loss'
                          ? 'digitsLoss'
                          : metric === 'accuracy'
                            ? 'digitsTrainPct'
                            : 'digitsValPct'
                      }
                      name="Dígitos 0–9"
                      stroke={palette.chart1}
                      strokeWidth={2.3}
                      dot={{ r: 3, fill: palette.chart1 }}
                      activeDot={{ r: 5, stroke: palette.bgCanvas, strokeWidth: 1.5 }}
                      connectNulls={false}
                    />
                  )}
                  {visibleModels.letters && (
                    <Line
                      type="monotone"
                      dataKey={
                        metric === 'loss'
                          ? 'lettersLoss'
                          : metric === 'accuracy'
                            ? 'lettersTrainPct'
                            : 'lettersValPct'
                      }
                      name="Letras A–Z"
                      stroke={palette.chart2}
                      strokeWidth={2.3}
                      dot={{ r: 3, fill: palette.chart2 }}
                      activeDot={{ r: 5, stroke: palette.bgCanvas, strokeWidth: 1.5 }}
                      connectNulls={false}
                    />
                  )}
                  {visibleModels.alphanumeric && (
                    <Line
                      type="monotone"
                      dataKey={
                        metric === 'loss'
                          ? 'alphanumericLoss'
                          : metric === 'accuracy'
                            ? 'alphanumericTrainPct'
                            : 'alphanumericValPct'
                      }
                      name="Alfanumérico (36)"
                      stroke={palette.chart3}
                      strokeWidth={2.3}
                      dot={{ r: 3, fill: palette.chart3 }}
                      activeDot={{ r: 5, stroke: palette.bgCanvas, strokeWidth: 1.5 }}
                      connectNulls={false}
                    />
                  )}
                  {metric !== 'valAccuracy' && visibleModels.mnist784 && (
                    <Line
                      type="monotone"
                      dataKey={metric === 'loss' ? 'mnistLoss' : 'mnistTrainPct'}
                      name="784–128–10 (Sintético)"
                      stroke={palette.chart4}
                      strokeWidth={2.1}
                      strokeDasharray="5 3"
                      dot={{ r: 3, fill: palette.chart4 }}
                      activeDot={{ r: 5, stroke: palette.bgCanvas, strokeWidth: 1.5 }}
                      connectNulls={false}
                    />
                  )}
                  {comparativeSeries.length >= 6 && (
                    <Brush
                      dataKey="epoch"
                      height={20}
                      stroke={palette.accentPrimary}
                      fill={palette.bgElevated}
                      travellerWidth={8}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )
        ) : singleSeries.length === 0 ? (
          <div className="h-60 flex flex-col items-center justify-center gap-2.5 text-xs text-[var(--text-muted)] text-center px-4">
            <span>
              Este modelo aún no registra épocas de entrenamiento en sesión. Entrena directamente desde el Clasificador Alfanumérico para observar su convergencia real.
            </span>
            <button
              type="button"
              onClick={onOpenClassifier}
              className="text-[var(--accent-primary)] font-semibold hover:underline cursor-pointer"
            >
              Entrenar en el Clasificador Alfanumérico →
            </button>
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={singleSeries}
                margin={{ top: 10, right: 14, left: 0, bottom: 4 }}
              >
                <defs>
                  <linearGradient id={`clfLoss-${uid}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={palette.chart1} stopOpacity={0.34} />
                    <stop offset="95%" stopColor={palette.chart1} stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id={`clfVal-${uid}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={palette.chart3} stopOpacity={0.26} />
                    <stop offset="95%" stopColor={palette.chart3} stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={palette.borderHairline}
                  vertical={false}
                />
                <XAxis
                  dataKey="epoch"
                  tickFormatter={(v) => `Ép. ${v}`}
                  tick={{ fill: palette.textMuted, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                  stroke={palette.borderHairline}
                />
                <YAxis
                  yAxisId="loss"
                  tick={{ fill: palette.textMuted, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                  stroke={palette.borderHairline}
                  width={46}
                />
                <YAxis
                  yAxisId="acc"
                  orientation="right"
                  domain={[0, 100]}
                  unit="%"
                  tick={{ fill: palette.textMuted, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                  stroke={palette.borderHairline}
                  width={44}
                />
                <Tooltip
                  content={
                    <ScientificTooltip
                      labelPrefix="Época "
                      decimals={3}
                      unitByKey={{ trainPct: '%', valPct: '%' }}
                    />
                  }
                />
                {showLoss && (
                  <Area
                    yAxisId="loss"
                    type="monotone"
                    dataKey="loss"
                    name="Loss CE"
                    stroke={palette.chart1}
                    strokeWidth={2.2}
                    fill={`url(#clfLoss-${uid})`}
                    dot={{ r: 3, fill: palette.chart1 }}
                    activeDot={{ r: 5, stroke: palette.bgCanvas, strokeWidth: 1.5 }}
                  />
                )}
                {viewMode !== 'mnist784' && showVal && (
                  <Area
                    yAxisId="acc"
                    type="monotone"
                    dataKey="valPct"
                    name="Validación"
                    stroke={palette.chart3}
                    strokeWidth={2.2}
                    fill={`url(#clfVal-${uid})`}
                    dot={{ r: 3, fill: palette.chart3 }}
                    activeDot={{ r: 5, stroke: palette.bgCanvas, strokeWidth: 1.5 }}
                  />
                )}
                {showTrain && (
                  <Line
                    yAxisId="acc"
                    type="monotone"
                    dataKey="trainPct"
                    name="Train"
                    stroke={palette.chart2}
                    strokeWidth={2}
                    strokeDasharray="4 3"
                    dot={{ r: 2.5, fill: palette.chart2 }}
                    activeDot={{ r: 4.5, stroke: palette.bgCanvas, strokeWidth: 1.5 }}
                  />
                )}
                {singleSeries.length >= 6 && (
                  <Brush
                    dataKey="epoch"
                    height={20}
                    stroke={palette.accentPrimary}
                    fill={palette.bgElevated}
                    travellerWidth={8}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </ScientificChartCard>
  );
};
