import React from 'react';

export interface TooltipEntry {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
  payload?: Record<string, unknown>;
}

interface ScientificTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  labelPrefix?: string;
  unitByKey?: Record<string, string>;
  decimals?: number;
  extraMeta?: (payload: Record<string, unknown>) => string | null;
}

export const ScientificTooltip: React.FC<ScientificTooltipProps> = ({
  active,
  payload,
  label,
  labelPrefix = '',
  unitByKey = {},
  decimals = 2,
  extraMeta,
}) => {
  if (!active || !payload || payload.length === 0) return null;

  const firstPayload = payload[0]?.payload;
  const note = firstPayload && extraMeta ? extraMeta(firstPayload) : null;

  return (
    <div
      className="rounded-xl px-3.5 py-2.5 text-xs shadow-xl border"
      style={{
        backgroundColor: 'var(--glass-bg)',
        borderColor: 'var(--border-strong)',
        color: 'var(--text-primary)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {label !== undefined && label !== '' && (
        <div className="font-mono font-semibold text-[11px] text-[var(--text-secondary)] pb-1.5 mb-1.5 border-b border-[var(--border-hairline)]">
          {labelPrefix}
          {label}
        </div>
      )}
      <div className="space-y-1">
        {payload.map((entry, idx) => {
          const key = String(entry.dataKey ?? entry.name ?? idx);
          const unit = unitByKey[key] ?? '';
          const rawVal = entry.value;
          const formatted =
            typeof rawVal === 'number' && Number.isFinite(rawVal)
              ? `${rawVal.toFixed(decimals)}${unit}`
              : `${rawVal ?? ''}${unit}`;
          return (
            <div key={`${key}-${idx}`} className="flex items-center justify-between gap-4 font-mono tabular-nums">
              <span className="flex items-center gap-1.5 font-sans text-[11px] text-[var(--text-secondary)]">
                <span
                  className="w-2 h-2 rounded-xs shrink-0"
                  style={{ backgroundColor: entry.color || 'var(--accent-primary)' }}
                />
                {entry.name ?? key}
              </span>
              <span className="font-semibold text-[var(--text-primary)]">{formatted}</span>
            </div>
          );
        })}
      </div>
      {note && (
        <div className="mt-1.5 pt-1.5 border-t border-[var(--border-hairline)] font-mono text-[10px] text-[var(--accent-secondary)]">
          {note}
        </div>
      )}
    </div>
  );
};
