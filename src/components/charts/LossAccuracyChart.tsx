import React, { useId, useMemo, useState } from 'react';
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
import { ScientificChartCard } from './ScientificChartCard';
import { ScientificTooltip } from './ScientificTooltip';
import { useChartPalette } from './chartTheme';

export interface LossAccuracyPoint {
  step: number;
  loss: number;
  accuracyPct?: number;
  valAccuracyPct?: number;
}

interface LossAccuracyChartProps {
  title: string;
  subtitle?: string;
  data: LossAccuracyPoint[];
  xLabel?: string;
  hasAccuracy?: boolean;
  exportFilename?: string;
  heightClass?: string;
}

export const LossAccuracyChart: React.FC<LossAccuracyChartProps> = ({
  title,
  subtitle,
  data,
  xLabel = 'Época',
  hasAccuracy = true,
  exportFilename = 'vectoria_curva_entrenamiento',
  heightClass = 'h-64',
}) => {
  const palette = useChartPalette();
  const uid = useId().replace(/:/g, '');
  const [showLoss, setShowLoss] = useState(true);
  const [showTrain, setShowTrain] = useState(true);
  const [showVal, setShowVal] = useState(true);

  const hasTrainSeries = hasAccuracy && data.some((d) => typeof d.accuracyPct === 'number');
  const hasValSeries = hasAccuracy && data.some((d) => typeof d.valAccuracyPct === 'number');

  const tableConfig = useMemo(() => {
    const columns = [xLabel, 'Loss CE'];
    if (hasTrainSeries) columns.push('Train (%)');
    if (hasValSeries) columns.push('Val (%)');
    const rows = data.map((d) => {
      const r: Array<string | number> = [d.step, d.loss.toFixed(4)];
      if (hasTrainSeries) r.push(typeof d.accuracyPct === 'number' ? `${d.accuracyPct.toFixed(1)}%` : '—');
      if (hasValSeries) r.push(typeof d.valAccuracyPct === 'number' ? `${d.valAccuracyPct.toFixed(1)}%` : '—');
      return r;
    });
    return { columns, rows };
  }, [data, hasTrainSeries, hasValSeries, xLabel]);

  const controls = (
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
      {hasTrainSeries && (
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
      )}
      {hasValSeries && (
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
  );

  return (
    <ScientificChartCard
      title={title}
      subtitle={subtitle}
      exportFilename={exportFilename}
      controls={controls}
      dataTable={tableConfig}
    >
      {data.length === 0 ? (
        <div className={`${heightClass} flex items-center justify-center text-xs text-[var(--text-muted)]`}>
          Sin puntos de entrenamiento registrados todavía.
        </div>
      ) : (
        <div className={`${heightClass} w-full`}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: hasAccuracy ? 12 : 16, left: 0, bottom: 4 }}>
              <defs>
                <linearGradient id={`lossGrad-${uid}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={palette.chart1} stopOpacity={0.34} />
                  <stop offset="95%" stopColor={palette.chart1} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id={`valGrad-${uid}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={palette.chart3} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={palette.chart3} stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={palette.borderHairline} vertical={false} />
              <XAxis
                dataKey="step"
                tick={{ fill: palette.textMuted, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                stroke={palette.borderHairline}
              />
              <YAxis
                yAxisId="left"
                tick={{ fill: palette.textMuted, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                stroke={palette.borderHairline}
                width={44}
              />
              {(hasTrainSeries || hasValSeries) && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 100]}
                  unit="%"
                  tick={{ fill: palette.textMuted, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                  stroke={palette.borderHairline}
                  width={44}
                />
              )}
              <Tooltip
                content={
                  <ScientificTooltip
                    labelPrefix={`${xLabel} `}
                    decimals={3}
                    unitByKey={{ accuracyPct: '%', valAccuracyPct: '%' }}
                  />
                }
              />
              {showLoss && (
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="loss"
                  name="Loss CE"
                  stroke={palette.chart1}
                  strokeWidth={2.2}
                  fill={`url(#lossGrad-${uid})`}
                  dot={data.length <= 16 ? { r: 2.5, fill: palette.chart1 } : false}
                  activeDot={{ r: 4.5, stroke: palette.bgCanvas, strokeWidth: 1.5 }}
                />
              )}
              {hasValSeries && showVal && (
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="valAccuracyPct"
                  name="Precisión Val"
                  stroke={palette.chart3}
                  strokeWidth={2.2}
                  fill={`url(#valGrad-${uid})`}
                  dot={false}
                  activeDot={{ r: 4.5, stroke: palette.bgCanvas, strokeWidth: 1.5 }}
                />
              )}
              {hasTrainSeries && showTrain && (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="accuracyPct"
                  name="Precisión Train"
                  stroke={palette.chart2}
                  strokeWidth={1.8}
                  strokeDasharray="4 3"
                  dot={false}
                  activeDot={{ r: 4, stroke: palette.bgCanvas, strokeWidth: 1.5 }}
                />
              )}
              {data.length >= 10 && (
                <Brush
                  dataKey="step"
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
    </ScientificChartCard>
  );
};
