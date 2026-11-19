import React, { useRef, useState } from 'react';
import { Check, Download, Table2 } from 'lucide-react';
import { exportContainerAsPng } from './chartTheme';

export interface ChartDataTableConfig {
  columns: string[];
  rows: Array<Array<string | number>>;
}

interface ScientificChartCardProps {
  title: string;
  subtitle?: string;
  exportFilename?: string;
  headerRight?: React.ReactNode;
  controls?: React.ReactNode;
  dataTable?: ChartDataTableConfig;
  footer?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export const ScientificChartCard: React.FC<ScientificChartCardProps> = ({
  title,
  subtitle,
  exportFilename,
  headerRight,
  controls,
  dataTable,
  footer,
  className = '',
  children,
}) => {
  const visualRef = useRef<HTMLDivElement | null>(null);
  const [showTable, setShowTable] = useState(false);
  const [exported, setExported] = useState(false);

  const handleExport = async () => {
    if (!exportFilename) return;
    const ok = await exportContainerAsPng(visualRef.current, exportFilename, title);
    if (ok) {
      setExported(true);
      setTimeout(() => setExported(false), 1800);
    }
  };

  return (
    <div className={`surface-card rounded-2xl p-5 space-y-4 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="space-y-0.5 min-w-0">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h2>
          {subtitle && <p className="text-xs text-[var(--text-muted)]">{subtitle}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {headerRight}
          {dataTable && dataTable.rows.length > 0 && (
            <button
              type="button"
              onClick={() => setShowTable((v) => !v)}
              title="Alternar vista de tabla numérica exacta"
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border cursor-pointer whitespace-nowrap transition-colors ${
                showTable
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--text-primary)]'
                  : 'border-[var(--border-hairline)] surface-elevated text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Table2 className="w-3.5 h-3.5" />
              {showTable ? 'Gráfica' : 'Tabla'}
            </button>
          )}
          {exportFilename && !showTable && (
            <button
              type="button"
              onClick={handleExport}
              title="Exportar visualización como imagen PNG"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border border-[var(--border-hairline)] surface-elevated text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)] cursor-pointer whitespace-nowrap transition-colors"
            >
              {exported ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[var(--status-ok)]" />
                  PNG
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  PNG
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {controls && <div className="flex flex-wrap items-center gap-2 text-xs">{controls}</div>}

      {showTable && dataTable ? (
        <div className="overflow-x-auto max-h-64 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)]/40">
          <table className="w-full text-xs font-mono tabular-nums">
            <thead>
              <tr className="border-b border-[var(--border-hairline)] text-[var(--text-muted)]">
                {dataTable.columns.map((col, i) => (
                  <th
                    key={i}
                    className={`py-2 px-3 font-sans font-medium ${i === 0 ? 'text-left' : 'text-right'}`}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dataTable.rows.map((row, rIdx) => (
                <tr
                  key={rIdx}
                  className="border-b border-[var(--border-hairline)] last:border-none hover:bg-[var(--bg-elevated)]"
                >
                  {row.map((cell, cIdx) => (
                    <td
                      key={cIdx}
                      className={`py-1.5 px-3 ${
                        cIdx === 0
                          ? 'text-left font-semibold text-[var(--accent-primary)]'
                          : 'text-right text-[var(--text-primary)]'
                      }`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={visualRef} className="w-full">
          {children}
        </div>
      )}

      {footer && (
        <div className="pt-2 border-t border-[var(--border-hairline)] text-xs text-[var(--text-muted)]">
          {footer}
        </div>
      )}
    </div>
  );
};
