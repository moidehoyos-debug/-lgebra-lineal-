import React, { useId, useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ScientificChartCard } from './ScientificChartCard';
import { ScientificTooltip } from './ScientificTooltip';
import { useChartPalette } from './chartTheme';

export interface SoftmaxDatum {
  label: string;
  prob: number;
  logit?: number;
  beforePct?: number;
  afterPct?: number;
  isTop?: boolean;
}

interface SoftmaxBarChartProps {
  title: string;
  subtitle?: string;
  data: SoftmaxDatum[];
  layout?: 'vertical' | 'horizontal';
  mode?: 'single' | 'compare';
  classCount?: number;
  exportFilename?: string;
  heightClass?: string;
  onSelectLabel?: (label: string) => void;
}

export const SoftmaxBarChart: React.FC<SoftmaxBarChartProps> = ({
  title,
  subtitle,
  data,
  layout = 'horizontal',
  mode = 'single',
  classCount = 10,
  exportFilename = 'vectoria_softmax',
  heightClass = 'h-56',
  onSelectLabel,
}) => {
  const palette = useChartPalette();
  const uid = useId().replace(/:/g, '');
  const uniformChancePct = Number((100 / Math.max(1, classCount)).toFixed(2));

  const tableConfig = useMemo(() => {
    if (mode === 'compare') {
      return {
        columns: ['Clase', 'Antes (%)', 'Después (%)', 'Δ (pts)'],
        rows: data.map((d) => {
          const b = d.beforePct ?? 0;
          const a = d.afterPct ?? 0;
          const delta = a - b;
          return [
            d.label,
            `${b.toFixed(2)}%`,
            `${a.toFixed(2)}%`,
            `${delta >= 0 ? '+' : ''}${delta.toFixed(2)}`,
          ];
        }),
      };
    }
    const hasLogit = data.some((d) => typeof d.logit === 'number');
    return {
      columns: hasLogit ? ['Clase', 'Probabilidad (%)', 'Logit z'] : ['Clase', 'Probabilidad (%)'],
      rows: data.map((d) =>
        hasLogit
          ? [d.label, `${d.prob.toFixed(2)}%`, typeof d.logit === 'number' ? d.logit.toFixed(3) : '—']
          : [d.label, `${d.prob.toFixed(2)}%`]
      ),
    };
  }, [data, mode]);

  return (
    <ScientificChartCard
      title={title}
      subtitle={subtitle}
      exportFilename={exportFilename}
      dataTable={tableConfig}
    >
      <div className={`${heightClass} w-full`}>
        <ResponsiveContainer width="100%" height="100%">
          {layout === 'vertical' && mode === 'single' ? (
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 44, left: 6, bottom: 4 }}>
              <defs>
                <linearGradient id={`topBar-${uid}`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={palette.accentPrimary} stopOpacity={0.75} />
                  <stop offset="100%" stopColor={palette.accentSecondary} stopOpacity={1} />
                </linearGradient>
                <linearGradient id={`altBar-${uid}`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={palette.chart1} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={palette.chart2} stopOpacity={0.72} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={palette.borderHairline} horizontal={false} />
              <XAxis
                type="number"
                domain={[0, 100]}
                unit="%"
                tick={{ fill: palette.textMuted, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                stroke={palette.borderHairline}
              />
              <YAxis
                type="category"
                dataKey="label"
                width={34}
                tick={{ fill: palette.textPrimary, fontSize: 12, fontFamily: 'JetBrains Mono', fontWeight: 600 }}
                stroke={palette.borderHairline}
              />
              <ReferenceLine
                x={uniformChancePct}
                stroke={palette.textMuted}
                strokeDasharray="4 4"
              />
              <Tooltip
                cursor={{ fill: palette.bgElevated, opacity: 0.45 }}
                content={
                  <ScientificTooltip
                    labelPrefix="Clase "
                    unitByKey={{ prob: '%' }}
                    extraMeta={(p) =>
                      typeof p.logit === 'number' ? `Logit z = ${Number(p.logit).toFixed(3)}` : null
                    }
                  />
                }
              />
              <Bar
                dataKey="prob"
                name="Softmax"
                radius={[0, 6, 6, 0]}
                onClick={(entry) => {
                  const lbl = (entry as unknown as { label?: string })?.label;
                  if (lbl && onSelectLabel) onSelectLabel(lbl);
                }}
              >
                {data.map((entry, idx) => (
                  <Cell
                    key={entry.label}
                    fill={idx === 0 || entry.isTop ? `url(#topBar-${uid})` : `url(#altBar-${uid})`}
                    style={{ cursor: onSelectLabel ? 'pointer' : 'default' }}
                  />
                ))}
                <LabelList
                  dataKey="prob"
                  position="right"
                  formatter={(v: unknown) => `${Number(v).toFixed(1)}%`}
                  style={{ fill: palette.textSecondary, fontSize: 10, fontFamily: 'JetBrains Mono' }}
                />
              </Bar>
            </BarChart>
          ) : mode === 'compare' ? (
            <BarChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 4 }}>
              <defs>
                <linearGradient id={`cmpBefore-${uid}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={palette.chart2} stopOpacity={0.95} />
                  <stop offset="100%" stopColor={palette.chart2} stopOpacity={0.45} />
                </linearGradient>
                <linearGradient id={`cmpAfter-${uid}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={palette.chart1} stopOpacity={1} />
                  <stop offset="100%" stopColor={palette.chart1} stopOpacity={0.5} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={palette.borderHairline} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: palette.textPrimary, fontSize: 11, fontFamily: 'JetBrains Mono' }}
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
                cursor={{ fill: palette.bgElevated, opacity: 0.4 }}
                content={
                  <ScientificTooltip
                    labelPrefix="Clase "
                    unitByKey={{ beforePct: '%', afterPct: '%' }}
                    extraMeta={(p) => {
                      const d = Number(p.afterPct ?? 0) - Number(p.beforePct ?? 0);
                      return `Cambio Δ = ${d >= 0 ? '+' : ''}${d.toFixed(2)} pts`;
                    }}
                  />
                }
              />
              <Legend wrapperStyle={{ fontSize: '11px', color: palette.textSecondary }} />
              <Bar dataKey="beforePct" name="Original (%)" fill={`url(#cmpBefore-${uid})`} radius={[4, 4, 0, 0]} />
              <Bar dataKey="afterPct" name="Modificada (%)" fill={`url(#cmpAfter-${uid})`} radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : (
            <BarChart data={data} margin={{ top: 18, right: 12, left: 0, bottom: 4 }}>
              <defs>
                <linearGradient id={`barVTop-${uid}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={palette.accentSecondary} stopOpacity={1} />
                  <stop offset="100%" stopColor={palette.accentPrimary} stopOpacity={0.7} />
                </linearGradient>
                <linearGradient id={`barVAlt-${uid}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={palette.chart2} stopOpacity={0.8} />
                  <stop offset="100%" stopColor={palette.chart1} stopOpacity={0.35} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={palette.borderHairline} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: palette.textPrimary, fontSize: 12, fontFamily: 'JetBrains Mono', fontWeight: 600 }}
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
                y={uniformChancePct}
                stroke={palette.textMuted}
                strokeDasharray="4 4"
              />
              <Tooltip
                cursor={{ fill: palette.bgElevated, opacity: 0.4 }}
                content={
                  <ScientificTooltip
                    labelPrefix="Clase "
                    unitByKey={{ prob: '%' }}
                    extraMeta={(p) =>
                      typeof p.logit === 'number' ? `Logit z = ${Number(p.logit).toFixed(3)}` : null
                    }
                  />
                }
              />
              <Bar
                dataKey="prob"
                name="Probabilidad"
                radius={[6, 6, 0, 0]}
                onClick={(entry) => {
                  const lbl = (entry as unknown as { label?: string })?.label;
                  if (lbl && onSelectLabel) onSelectLabel(lbl);
                }}
              >
                {data.map((entry, idx) => (
                  <Cell
                    key={entry.label}
                    fill={idx === 0 || entry.isTop ? `url(#barVTop-${uid})` : `url(#barVAlt-${uid})`}
                    style={{ cursor: onSelectLabel ? 'pointer' : 'default' }}
                  />
                ))}
                <LabelList
                  dataKey="prob"
                  position="top"
                  formatter={(v: unknown) => `${Number(v).toFixed(1)}%`}
                  style={{ fill: palette.textSecondary, fontSize: 10, fontFamily: 'JetBrains Mono' }}
                />
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </ScientificChartCard>
  );
};
