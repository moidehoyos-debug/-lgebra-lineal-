import React, { useMemo, useState } from 'react';
import { Box, CheckCircle2, Play, XCircle } from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import {
  analyzeLinearIndependence,
  analyzeVectors,
  applyLinearTransformation2D,
  computeEigen,
  formatNum,
  Matrix,
  matrixAdd,
  matrixDeterminant,
  matrixInverse,
  matrixLU,
  matrixMultiply,
  matrixQR,
  matrixRank,
  matrixTranspose,
  solveLinearSystem,
  Vector,
} from '../engines/linearAlgebra';
import { MathOperationOutput } from '../types/vectoria';
import { ScientificChartCard } from './charts/ScientificChartCard';

type AlgebraTopic =
  | 'add'
  | 'multiply'
  | 'transpose'
  | 'determinant'
  | 'inverse'
  | 'rank'
  | 'lu'
  | 'qr'
  | 'system-gauss'
  | 'system-jordan'
  | 'vectors'
  | 'independence'
  | 'transform2d'
  | 'eigen';

const TOPICS: Array<{ id: AlgebraTopic; label: string }> = [
  { id: 'add', label: 'Suma / Resta' },
  { id: 'multiply', label: 'Multiplicación' },
  { id: 'transpose', label: 'Transpuesta' },
  { id: 'determinant', label: 'Determinante' },
  { id: 'inverse', label: 'Matriz Inversa' },
  { id: 'rank', label: 'Rango y Nulidad' },
  { id: 'lu', label: 'Descomposición LU' },
  { id: 'qr', label: 'Factorización QR' },
  { id: 'system-gauss', label: 'Eliminación Gauss' },
  { id: 'system-jordan', label: 'Gauss-Jordan' },
  { id: 'vectors', label: 'Vectores' },
  { id: 'independence', label: 'Base y Dimensión' },
  { id: 'transform2d', label: 'Transformación 2D' },
  { id: 'eigen', label: 'Valores Propios' },
];

function parseMatrixText(raw: string): Matrix {
  const rows = raw
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) =>
      line
        .split(/[\s,;]+/)
        .filter(Boolean)
        .map(Number)
    );
  return rows;
}

function parseVectorText(raw: string): Vector {
  return raw
    .trim()
    .split(/[\s,;]+/)
    .filter(Boolean)
    .map(Number);
}

export const LinearAlgebraLabView: React.FC = () => {
  const { setLastMathOutput, setSharedMatrix2D, setActiveModule, logEvent } = useStudio();

  const [topic, setTopic] = useState<AlgebraTopic>('inverse');
  const [matAText, setMatAText] = useState('4 7\n2 6');
  const [matBText, setMatBText] = useState('1 2\n3 4');
  const [vecUText, setVecUText] = useState('3 4 0');
  const [vecVText, setVecVText] = useState('1 2 2');
  const [vecBText, setVecBText] = useState('5 1');
  const [basisText, setBasisText] = useState('1 0 2\n0 1 -1\n1 1 1');
  const [subtractMode, setSubtractMode] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [output, setOutput] = useState<MathOperationOutput<unknown> | null>(() => {
    try {
      return matrixInverse([
        [4, 7],
        [2, 6],
      ]);
    } catch {
      return null;
    }
  });

  const loadPresetForTopic = (next: AlgebraTopic) => {
    setTopic(next);
    setErrorMsg(null);
    if (next === 'transform2d') {
      setMatAText('1.4 0.5\n-0.3 1.2');
      setVecUText('1 1');
    } else if (next === 'vectors') {
      setVecUText('3 4 0');
      setVecVText('1 2 2');
    } else if (next === 'system-gauss' || next === 'system-jordan') {
      setMatAText('2 1 -1\n-3 -1 2\n-2 1 2');
      setVecBText('8 -11 -3');
    } else if (next === 'eigen') {
      setMatAText('4 1\n2 3');
    } else if (next === 'determinant' || next === 'inverse') {
      setMatAText('4 7\n2 6');
    } else if (next === 'transpose') {
      setMatAText('1 2 3\n4 5 6');
    } else if (next === 'rank') {
      setMatAText('1 2 3\n2 4 6\n1 1 2');
    } else if (next === 'lu' || next === 'qr') {
      setMatAText('2 1 1\n4 -6 0\n-2 7 2');
    } else if (next === 'add' || next === 'multiply') {
      setMatAText('2 1\n0 3');
      setMatBText('1 4\n2 -1');
    }
  };

  const executeCalculation = () => {
    setErrorMsg(null);
    try {
      let res: MathOperationOutput<unknown>;
      const A = parseMatrixText(matAText);
      const B = parseMatrixText(matBText);
      const u = parseVectorText(vecUText);
      const v = parseVectorText(vecVText);
      const b = parseVectorText(vecBText);

      switch (topic) {
        case 'add':
          res = matrixAdd(A, B, subtractMode);
          break;
        case 'multiply':
          res = matrixMultiply(A, B);
          break;
        case 'transpose':
          res = matrixTranspose(A);
          break;
        case 'determinant':
          res = matrixDeterminant(A);
          break;
        case 'inverse':
          res = matrixInverse(A);
          break;
        case 'rank':
          res = matrixRank(A);
          break;
        case 'lu':
          res = matrixLU(A);
          break;
        case 'qr':
          res = matrixQR(A);
          break;
        case 'system-gauss':
          res = solveLinearSystem(A, b, 'gauss');
          break;
        case 'system-jordan':
          res = solveLinearSystem(A, b, 'gauss-jordan');
          break;
        case 'vectors':
          res = analyzeVectors(u, v);
          break;
        case 'independence': {
          const vecs = parseMatrixText(basisText);
          res = analyzeLinearIndependence(vecs);
          break;
        }
        case 'transform2d':
          res = applyLinearTransformation2D(A, u);
          break;
        case 'eigen':
          res = computeEigen(A);
          break;
      }

      setOutput(res);
      setLastMathOutput(res);
      logEvent(
        'math',
        res.operation,
        `${res.resultLabel} · ${res.verification.passed ? 'Verificado' : 'Advertencia'}`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error de validación en entrada matemática.');
    }
  };

  const sendToGeometryLab = () => {
    try {
      const A = parseMatrixText(matAText);
      if (A.length === 2 && A[0].length === 2) {
        setSharedMatrix2D(A);
      }
    } catch {
      // Keep current sharedMatrix2D if A is not 2x2
    }
    setActiveModule('geometry');
  };

  // Interactive 2D Transformation SVG coordinates
  const transform2DPreview = useMemo(() => {
    if (topic !== 'transform2d') return null;
    try {
      const A = parseMatrixText(matAText);
      const u = parseVectorText(vecUText);
      if (A.length !== 2 || A[0].length !== 2 || u.length !== 2) return null;
      return applyLinearTransformation2D(A, u).result;
    } catch {
      return null;
    }
  }, [topic, matAText, vecUText]);

  const toSvg = (x: number, y: number) => ({
    sx: 140 + x * 42,
    sy: 140 - y * 42,
  });

  const renderMatrixTable = (M: Matrix) => (
    <table className="tabular-nums border-collapse font-mono text-xs">
      <tbody>
        {M.map((row, rIdx) => (
          <tr key={rIdx}>
            {row.map((val, cIdx) => (
              <td
                key={cIdx}
                className="px-3 py-1.5 border border-[var(--border-hairline)] text-right"
              >
                {formatNum(val, 4)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            Laboratorio de Álgebra Lineal
          </h1>
          <p className="text-xs text-[var(--text-muted)]">
            Motor matemático determinístico: muestra entrada, fórmula, procedimiento, pasos intermedios, resultado, verificación por residuo e interpretación en IA.
          </p>
        </div>

        <button
          type="button"
          onClick={sendToGeometryLab}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold border border-[var(--border-strong)] surface-elevated hover:border-[var(--accent-primary)] text-[var(--text-primary)] cursor-pointer whitespace-nowrap self-start"
        >
          <Box className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
          Visualizar en Geometría 2D/3D
        </button>
      </div>

      {/* Topic Selector */}
      <div className="flex flex-wrap gap-1.5 p-1.5 rounded-xl surface-elevated">
        {TOPICS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => loadPresetForTopic(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap transition-colors ${
              topic === t.id
                ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Input Controls */}
        <div className="lg:col-span-5 surface-card rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            1. Datos de Entrada
          </h2>

          {topic !== 'vectors' && topic !== 'independence' && (
            <label className="block space-y-1.5 text-xs">
              <span className="text-[var(--text-secondary)] font-medium">
                Matriz A (una fila por línea, valores separados por espacio)
              </span>
              <textarea
                rows={4}
                value={matAText}
                onChange={(e) => setMatAText(e.target.value)}
                className="w-full p-3 rounded-lg font-mono text-xs surface-elevated text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
              />
            </label>
          )}

          {(topic === 'add' || topic === 'multiply') && (
            <>
              {topic === 'add' && (
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setSubtractMode(false)}
                    className={`px-2.5 py-1 rounded cursor-pointer ${
                      !subtractMode
                        ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                        : 'surface-elevated text-[var(--text-secondary)]'
                    }`}
                  >
                    A + B
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubtractMode(true)}
                    className={`px-2.5 py-1 rounded cursor-pointer ${
                      subtractMode
                        ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                        : 'surface-elevated text-[var(--text-secondary)]'
                    }`}
                  >
                    A - B
                  </button>
                </div>
              )}
              <label className="block space-y-1.5 text-xs">
                <span className="text-[var(--text-secondary)] font-medium">Matriz B</span>
                <textarea
                  rows={4}
                  value={matBText}
                  onChange={(e) => setMatBText(e.target.value)}
                  className="w-full p-3 rounded-lg font-mono text-xs surface-elevated text-[var(--text-primary)]"
                />
              </label>
            </>
          )}

          {(topic === 'system-gauss' || topic === 'system-jordan') && (
            <label className="block space-y-1.5 text-xs">
              <span className="text-[var(--text-secondary)] font-medium">
                Vector de términos independientes b
              </span>
              <input
                type="text"
                value={vecBText}
                onChange={(e) => setVecBText(e.target.value)}
                className="w-full p-2.5 rounded-lg font-mono text-xs surface-elevated text-[var(--text-primary)]"
              />
            </label>
          )}

          {(topic === 'vectors' || topic === 'transform2d') && (
            <label className="block space-y-1.5 text-xs">
              <span className="text-[var(--text-secondary)] font-medium">
                {topic === 'transform2d' ? 'Vector x en ℝ²' : 'Vector u'}
              </span>
              <input
                type="text"
                value={vecUText}
                onChange={(e) => setVecUText(e.target.value)}
                className="w-full p-2.5 rounded-lg font-mono text-xs surface-elevated text-[var(--text-primary)]"
              />
            </label>
          )}

          {topic === 'vectors' && (
            <label className="block space-y-1.5 text-xs">
              <span className="text-[var(--text-secondary)] font-medium">Vector v</span>
              <input
                type="text"
                value={vecVText}
                onChange={(e) => setVecVText(e.target.value)}
                className="w-full p-2.5 rounded-lg font-mono text-xs surface-elevated text-[var(--text-primary)]"
              />
            </label>
          )}

          {topic === 'independence' && (
            <label className="block space-y-1.5 text-xs">
              <span className="text-[var(--text-secondary)] font-medium">
                Conjunto de vectores (un vector por línea)
              </span>
              <textarea
                rows={4}
                value={basisText}
                onChange={(e) => setBasisText(e.target.value)}
                className="w-full p-3 rounded-lg font-mono text-xs surface-elevated text-[var(--text-primary)]"
              />
            </label>
          )}

          {errorMsg && (
            <div className="p-3 rounded-lg border border-[var(--status-err)] text-xs text-[var(--status-err)] flex items-start gap-2">
              <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="button"
            onClick={executeCalculation}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-contrast)] cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            Calcular y Verificar
          </button>

          {/* 2D Geometric Transformation SVG */}
          {topic === 'transform2d' && transform2DPreview && (
            <div className="pt-3 border-t border-[var(--border-hairline)]">
              <ScientificChartCard
                title="Deformación Geométrica ℝ²"
                subtitle={`|det(A)| = ${formatNum(transform2DPreview.areaScaleFactor, 3)} · ${
                  transform2DPreview.preservesOrientation ? 'Orientación directa' : 'Orientación invertida'
                }`}
                exportFilename="vectoria_algebra_transformacion_2d"
                dataTable={{
                  columns: ['Vector', 'x₁', 'x₂'],
                  rows: [
                    ['e₁\' = A·e₁', formatNum(transform2DPreview.e1Prime[0], 3), formatNum(transform2DPreview.e1Prime[1], 3)],
                    ['e₂\' = A·e₂', formatNum(transform2DPreview.e2Prime[0], 3), formatNum(transform2DPreview.e2Prime[1], 3)],
                    ['Entrada x', formatNum(transform2DPreview.inputVector[0], 3), formatNum(transform2DPreview.inputVector[1], 3)],
                    ['Salida Ax', formatNum(transform2DPreview.transformedVector[0], 3), formatNum(transform2DPreview.transformedVector[1], 3)],
                  ],
                }}
              >
                <svg
                  viewBox="0 0 280 280"
                  className="w-full max-w-[280px] mx-auto rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-hairline)]"
                >
                  <defs>
                    <marker id="laArrowMuted" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                      <path d="M0,0 L6,3 L0,6 Z" fill="var(--text-muted)" />
                    </marker>
                    <marker id="laArrowSec" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                      <path d="M0,0 L6,3 L0,6 Z" fill="var(--accent-secondary)" />
                    </marker>
                  </defs>
                  {[-2, -1, 1, 2].map((g) => {
                    const p = toSvg(g, g);
                    return (
                      <g key={g}>
                        <line x1={p.sx} y1="0" x2={p.sx} y2="280" stroke="var(--border-hairline)" strokeWidth="1" />
                        <line x1="0" y1={p.sy} x2="280" y2={p.sy} stroke="var(--border-hairline)" strokeWidth="1" />
                        <text x={p.sx + 2} y="152" fill="var(--text-muted)" fontSize="9" fontFamily="JetBrains Mono">{g}</text>
                        <text x="144" y={p.sy + 3} fill="var(--text-muted)" fontSize="9" fontFamily="JetBrains Mono">{g}</text>
                      </g>
                    );
                  })}
                  <line x1="0" y1="140" x2="280" y2="140" stroke="var(--border-strong)" strokeWidth="1.2" />
                  <line x1="140" y1="0" x2="140" y2="280" stroke="var(--border-strong)" strokeWidth="1.2" />
                  <polygon
                    points={`${toSvg(0, 0).sx},${toSvg(0, 0).sy} ${toSvg(1, 0).sx},${toSvg(1, 0).sy} ${toSvg(1, 1).sx},${toSvg(1, 1).sy} ${toSvg(0, 1).sx},${toSvg(0, 1).sy}`}
                    fill="none"
                    stroke="var(--text-muted)"
                    strokeDasharray="4 3"
                    strokeWidth="1.2"
                  />
                  {(() => {
                    const p0 = toSvg(0, 0);
                    const p1 = toSvg(transform2DPreview.e1Prime[0], transform2DPreview.e1Prime[1]);
                    const p2 = toSvg(
                      transform2DPreview.e1Prime[0] + transform2DPreview.e2Prime[0],
                      transform2DPreview.e1Prime[1] + transform2DPreview.e2Prime[1]
                    );
                    const p3 = toSvg(transform2DPreview.e2Prime[0], transform2DPreview.e2Prime[1]);
                    const vx = toSvg(transform2DPreview.inputVector[0], transform2DPreview.inputVector[1]);
                    const tx = toSvg(
                      transform2DPreview.transformedVector[0],
                      transform2DPreview.transformedVector[1]
                    );
                    return (
                      <>
                        <polygon
                          points={`${p0.sx},${p0.sy} ${p1.sx},${p1.sy} ${p2.sx},${p2.sy} ${p3.sx},${p3.sy}`}
                          fill="var(--accent-soft)"
                          stroke="var(--accent-primary)"
                          strokeWidth="2"
                        />
                        <line x1={p0.sx} y1={p0.sy} x2={vx.sx} y2={vx.sy} stroke="var(--text-muted)" strokeWidth="2" markerEnd="url(#laArrowMuted)" />
                        <line x1={p0.sx} y1={p0.sy} x2={tx.sx} y2={tx.sy} stroke="var(--accent-secondary)" strokeWidth="2.5" markerEnd="url(#laArrowSec)" />
                        <text x={p1.sx + 4} y={p1.sy - 4} fill="var(--accent-primary)" fontSize="10" fontFamily="JetBrains Mono">e₁&apos;</text>
                        <text x={p3.sx + 4} y={p3.sy - 4} fill="var(--accent-primary)" fontSize="10" fontFamily="JetBrains Mono">e₂&apos;</text>
                        <text x={vx.sx + 5} y={vx.sy - 4} fill="var(--text-muted)" fontSize="10" fontFamily="JetBrains Mono">x</text>
                        <text x={tx.sx + 5} y={tx.sy - 4} fill="var(--accent-secondary)" fontSize="10" fontFamily="JetBrains Mono" fontWeight="bold">Ax</text>
                      </>
                    );
                  })()}
                </svg>
              </ScientificChartCard>
            </div>
          )}
        </div>

        {/* Right: 7-part Structured Derivation */}
        <div className="lg:col-span-7 space-y-4">
          {output ? (
            <div className="surface-card rounded-2xl p-6 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border-hairline)] pb-4">
                <div>
                  <div className="text-xs text-[var(--text-muted)]">{output.category}</div>
                  <h2 className="text-lg font-bold text-[var(--text-primary)]">{output.operation}</h2>
                </div>
                <div className="text-right font-mono text-xs text-[var(--text-secondary)]">
                  {output.inputSummary}
                </div>
              </div>

              {output.formula && (
                <div className="surface-elevated rounded-xl p-3.5 space-y-1">
                  <div className="text-xs font-semibold text-[var(--accent-primary)]">
                    2. Fórmula Matemática
                  </div>
                  <div className="font-mono text-xs text-[var(--text-primary)]">
                    {output.formula}
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <div className="text-xs font-semibold text-[var(--accent-primary)]">
                  3. Procedimiento Matemático
                </div>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  {output.procedure}
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="text-xs font-semibold text-[var(--accent-primary)]">
                  4. Desarrollo Paso a Paso
                </div>
                <div className="space-y-2.5">
                  {output.steps.map((step, idx) => (
                    <div key={idx} className="surface-elevated rounded-xl p-3.5 space-y-2">
                      <div className="text-xs font-semibold text-[var(--text-primary)]">
                        Paso {idx + 1}: {step.title}
                      </div>
                      <pre className="font-mono text-xs text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
                        {step.expression}
                      </pre>
                      {step.matrixSnapshot && (
                        <div className="overflow-x-auto pt-1">
                          {renderMatrixTable(step.matrixSnapshot)}
                        </div>
                      )}
                      {step.note && (
                        <div className="text-[11px] text-[var(--text-muted)]">{step.note}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-[var(--accent-primary)]">
                  5. Resultado Final ({output.resultLabel})
                </div>
                <div className="surface-elevated rounded-xl p-4 font-mono text-xs text-[var(--text-primary)] overflow-x-auto space-y-3">
                  {typeof output.result === 'number' ? (
                    <span className="text-lg font-bold">{formatNum(output.result, 6)}</span>
                  ) : Array.isArray(output.result) && Array.isArray(output.result[0]) ? (
                    renderMatrixTable(output.result as Matrix)
                  ) : typeof output.result === 'object' &&
                    output.result !== null &&
                    'P' in output.result &&
                    'L' in output.result &&
                    'U' in output.result ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <div className="text-[11px] text-[var(--text-muted)] mb-1">Matriz P</div>
                        {renderMatrixTable((output.result as { P: Matrix }).P)}
                      </div>
                      <div>
                        <div className="text-[11px] text-[var(--text-muted)] mb-1">Matriz L</div>
                        {renderMatrixTable((output.result as { L: Matrix }).L)}
                      </div>
                      <div>
                        <div className="text-[11px] text-[var(--text-muted)] mb-1">Matriz U</div>
                        {renderMatrixTable((output.result as { U: Matrix }).U)}
                      </div>
                    </div>
                  ) : typeof output.result === 'object' &&
                    output.result !== null &&
                    'Q' in output.result &&
                    'R' in output.result ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <div className="text-[11px] text-[var(--text-muted)] mb-1">Matriz Q (Ortonormal)</div>
                        {renderMatrixTable((output.result as { Q: Matrix }).Q)}
                      </div>
                      <div>
                        <div className="text-[11px] text-[var(--text-muted)] mb-1">Matriz R (Triangular)</div>
                        {renderMatrixTable((output.result as { R: Matrix }).R)}
                      </div>
                    </div>
                  ) : (
                    <pre className="whitespace-pre-wrap">
                      {JSON.stringify(output.result, null, 2)}
                    </pre>
                  )}
                </div>
              </div>

              <div className="surface-elevated rounded-xl p-4 space-y-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
                  {output.verification.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-[var(--status-ok)]" />
                  ) : (
                    <XCircle className="w-4 h-4 text-[var(--status-err)]" />
                  )}
                  <span>6. Verificación Automática</span>
                </div>
                <p className="text-xs font-mono text-[var(--text-secondary)]">
                  {output.verification.statement}
                </p>
              </div>

              <div className="surface-elevated rounded-xl p-4 space-y-1">
                <div className="text-xs font-semibold text-[var(--accent-secondary)]">
                  7. Interpretación en Ingeniería de IA
                </div>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  {output.aiInterpretation}
                </p>
              </div>
            </div>
          ) : (
            <div className="surface-card rounded-2xl p-8 text-center text-xs text-[var(--text-muted)]">
              Ingresa matrices o vectores válidos y pulsa "Calcular y Verificar".
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
