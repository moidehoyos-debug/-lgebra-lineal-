import React, { useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Download } from 'lucide-react';
import { exportContainerAsPng, useChartPalette } from './chartTheme';

interface ConfusionMatrixHeatmapProps {
  labels: string[];
  matrix: number[][];
  title?: string;
  subtitle?: string;
  exportFilename?: string;
}

export const ConfusionMatrixHeatmap: React.FC<ConfusionMatrixHeatmapProps> = ({
  labels,
  matrix,
  title = 'Matriz de Confusión (Validación Real)',
  subtitle,
  exportFilename = 'vectoria_matriz_confusion',
}) => {
  const palette = useChartPalette();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [normalized, setNormalized] = useState(false);
  const [sliceOffset, setSliceOffset] = useState(0);
  const [selectedCell, setSelectedCell] = useState<{
    r: number;
    c: number;
    val: number;
    rowSum: number;
    colSum: number;
  } | null>(null);

  const pageSize = 12;
  const maxOffset = Math.max(0, labels.length - pageSize);
  const safeOffset = Math.min(sliceOffset, maxOffset);
  const visibleIndices = useMemo(() => {
    const count = Math.min(pageSize, labels.length);
    return Array.from({ length: count }, (_, i) => safeOffset + i);
  }, [labels.length, safeOffset]);

  const rowSums = useMemo(
    () => matrix.map((row) => row.reduce((a, b) => a + b, 0)),
    [matrix]
  );
  const colSums = useMemo(
    () =>
      labels.map((_, c) =>
        matrix.reduce((sum, row) => sum + (row[c] ?? 0), 0)
      ),
    [labels, matrix]
  );

  const maxVal = useMemo(() => {
    if (normalized) return 100;
    let m = 1;
    for (const r of visibleIndices) {
      for (const c of visibleIndices) {
        const v = matrix[r]?.[c] ?? 0;
        if (v > m) m = v;
      }
    }
    return m;
  }, [matrix, normalized, visibleIndices]);

  const diagColorScale = useMemo(() => {
    return d3
      .scaleLinear<string>()
      .domain([0, maxVal])
      .range([palette.bgElevated, palette.accentPrimary]);
  }, [maxVal, palette.bgElevated, palette.accentPrimary]);

  const offDiagColorScale = useMemo(() => {
    return d3
      .scaleLinear<string>()
      .domain([0, maxVal])
      .range([palette.bgElevated, palette.statusWarn]);
  }, [maxVal, palette.bgElevated, palette.statusWarn]);

  const handleExportPng = async () => {
    // Render crisp SVG matrix into offscreen SVG for 2x PNG export
    const n = visibleIndices.length;
    const cellSz = 32;
    const padL = 44;
    const padT = 36;
    const w = padL + n * cellSz + 16;
    const h = padT + n * cellSz + 20;
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', String(w));
    svg.setAttribute('height', String(h));

    visibleIndices.forEach((cIdx, ci) => {
      const th = document.createElementNS(ns, 'text');
      th.setAttribute('x', String(padL + ci * cellSz + cellSz / 2));
      th.setAttribute('y', String(padT - 10));
      th.setAttribute('text-anchor', 'middle');
      th.setAttribute('font-size', '10');
      th.setAttribute('font-family', 'JetBrains Mono, monospace');
      th.setAttribute('fill', palette.textSecondary);
      th.textContent = labels[cIdx];
      svg.appendChild(th);
    });

    visibleIndices.forEach((rIdx, ri) => {
      const rl = document.createElementNS(ns, 'text');
      rl.setAttribute('x', String(padL - 8));
      rl.setAttribute('y', String(padT + ri * cellSz + cellSz / 2 + 4));
      rl.setAttribute('text-anchor', 'end');
      rl.setAttribute('font-size', '10');
      rl.setAttribute('font-family', 'JetBrains Mono, monospace');
      rl.setAttribute('fill', palette.textSecondary);
      rl.textContent = labels[rIdx];
      svg.appendChild(rl);

      visibleIndices.forEach((cIdx, ci) => {
        const raw = matrix[rIdx]?.[cIdx] ?? 0;
        const pct = rowSums[rIdx] > 0 ? (raw / rowSums[rIdx]) * 100 : 0;
        const metricVal = normalized ? pct : raw;
        const isDiag = rIdx === cIdx;
        const bg =
          raw === 0
            ? palette.bgElevated
            : isDiag
              ? diagColorScale(metricVal)
              : offDiagColorScale(metricVal);

        const rect = document.createElementNS(ns, 'rect');
        rect.setAttribute('x', String(padL + ci * cellSz));
        rect.setAttribute('y', String(padT + ri * cellSz));
        rect.setAttribute('width', String(cellSz - 2));
        rect.setAttribute('height', String(cellSz - 2));
        rect.setAttribute('rx', '4');
        rect.setAttribute('fill', bg);
        rect.setAttribute('stroke', palette.borderHairline);
        svg.appendChild(rect);

        const txt = document.createElementNS(ns, 'text');
        txt.setAttribute('x', String(padL + ci * cellSz + (cellSz - 2) / 2));
        txt.setAttribute('y', String(padT + ri * cellSz + (cellSz - 2) / 2 + 4));
        txt.setAttribute('text-anchor', 'middle');
        txt.setAttribute('font-size', '9');
        txt.setAttribute('font-family', 'JetBrains Mono, monospace');
        txt.setAttribute('fill', palette.textPrimary);
        txt.textContent = normalized ? `${Math.round(pct)}` : String(raw);
        svg.appendChild(txt);
      });
    });

    const host = document.createElement('div');
    host.style.position = 'fixed';
    host.style.left = '-9999px';
    host.appendChild(svg);
    document.body.appendChild(host);
    await exportContainerAsPng(host, exportFilename, title);
    document.body.removeChild(host);
  };

  return (
    <div ref={containerRef} className="surface-card rounded-2xl p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h2>
          <p className="text-xs text-[var(--text-muted)]">
            {subtitle ||
              `Filas: clase real · Columnas: predicha (${visibleIndices.length} de ${labels.length} clases). Haz clic en una celda para inspeccionar.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-[11px] shrink-0">
          <div className="inline-flex items-center p-0.5 rounded-lg surface-elevated border border-[var(--border-hairline)]">
            <button
              type="button"
              onClick={() => setNormalized(false)}
              className={`px-2 py-1 rounded-md cursor-pointer ${
                !normalized
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] font-semibold'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              Conteo
            </button>
            <button
              type="button"
              onClick={() => setNormalized(true)}
              className={`px-2 py-1 rounded-md cursor-pointer ${
                normalized
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] font-semibold'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              % Fila
            </button>
          </div>
          <button
            type="button"
            onClick={handleExportPng}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[var(--border-hairline)] surface-elevated text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)] cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            PNG
          </button>
        </div>
      </div>

      {labels.length > pageSize && (
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="text-[var(--text-muted)]">Ventana de clases:</span>
          {[0, 10, 22, Math.max(0, labels.length - pageSize)]
            .filter((v, idx, arr) => v <= maxOffset && arr.indexOf(v) === idx)
            .map((off) => (
              <button
                key={off}
                type="button"
                onClick={() => setSliceOffset(off)}
                className={`px-2 py-0.5 rounded font-mono border cursor-pointer ${
                  safeOffset === off
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--text-primary)]'
                    : 'border-[var(--border-hairline)] surface-elevated text-[var(--text-secondary)]'
                }`}
              >
                {labels[off]}–{labels[Math.min(labels.length - 1, off + pageSize - 1)]}
              </button>
            ))}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="border-collapse font-mono text-[11px] tabular-nums mx-auto">
          <thead>
            <tr>
              <th className="p-1.5 text-[var(--text-muted)] text-[10px]">R \ P</th>
              {visibleIndices.map((cIdx) => (
                <th key={cIdx} className="p-1 text-[var(--text-secondary)] font-semibold">
                  {labels[cIdx]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleIndices.map((rIdx) => (
              <tr key={rIdx}>
                <td className="p-1.5 font-semibold text-[var(--text-secondary)] text-right">
                  {labels[rIdx]}
                </td>
                {visibleIndices.map((cIdx) => {
                  const val = matrix[rIdx]?.[cIdx] ?? 0;
                  const rowSum = rowSums[rIdx] || 1;
                  const pct = (val / rowSum) * 100;
                  const isDiag = rIdx === cIdx;
                  const isSelected = selectedCell?.r === rIdx && selectedCell?.c === cIdx;
                  const bg =
                    val === 0
                      ? palette.bgElevated
                      : isDiag
                        ? diagColorScale(normalized ? pct : val)
                        : offDiagColorScale(normalized ? pct : val);

                  return (
                    <td key={cIdx} className="p-0.5">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedCell({
                            r: rIdx,
                            c: cIdx,
                            val,
                            rowSum: rowSums[rIdx] ?? 0,
                            colSum: colSums[cIdx] ?? 0,
                          })
                        }
                        style={{
                          backgroundColor: bg,
                          borderColor: isSelected ? palette.accentSecondary : palette.borderHairline,
                        }}
                        className={`w-8 h-8 rounded flex items-center justify-center border text-[var(--text-primary)] cursor-pointer transition-transform hover:scale-105 ${
                          isDiag ? 'font-bold' : 'font-normal'
                        }`}
                        title={`Real ${labels[rIdx]} → Predicho ${labels[cIdx]}: ${val} (${pct.toFixed(1)}%)`}
                      >
                        {normalized ? `${Math.round(pct)}%` : val}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Calibrated Colorbar & Cell Inspector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[var(--border-hairline)] text-[11px]">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[var(--text-muted)]">0</span>
          <div
            className="h-2.5 w-28 rounded-full border border-[var(--border-hairline)]"
            style={{
              background: `linear-gradient(90deg, ${palette.bgElevated}, ${palette.accentPrimary})`,
            }}
          />
          <span className="font-mono text-[var(--text-muted)]">
            {normalized ? '100% (Acierto)' : `${maxVal} (Acierto)`}
          </span>
        </div>

        <div className="font-mono text-[var(--text-secondary)]">
          {selectedCell ? (
            <span>
              Real <strong className="text-[var(--accent-primary)]">{labels[selectedCell.r]}</strong> → Pred{' '}
              <strong className="text-[var(--accent-secondary)]">{labels[selectedCell.c]}</strong>:{' '}
              {selectedCell.val} muestras (Recall{' '}
              {selectedCell.rowSum > 0 ? ((selectedCell.val / selectedCell.rowSum) * 100).toFixed(1) : '0.0'}
              %)
            </span>
          ) : (
            <span className="text-[var(--text-muted)]">Selecciona una celda para ver recall/precisión local</span>
          )}
        </div>
      </div>
    </div>
  );
};
