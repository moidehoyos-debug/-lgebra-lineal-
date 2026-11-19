import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Calculator, FlaskConical, RotateCcw } from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import {
  analyzeLinearIndependence,
  analyzeVectors,
  applyLinearTransformation2D,
  formatNum,
} from '../engines/linearAlgebra';
import { ScientificChartCard } from './charts/ScientificChartCard';
import { useChartPalette } from './charts/chartTheme';

type GeoTab = '2d' | '3d';

export const GeometryLabView: React.FC = () => {
  const { sharedMatrix2D, setSharedMatrix2D, setActiveModule, logEvent } = useStudio();
  const palette = useChartPalette();
  const [tab, setTab] = useState<GeoTab>('2d');
  const [probe2D, setProbe2D] = useState<{ x: number; y: number } | null>(null);

  // 2D Transformation & Vectors state
  const [u2, setU2] = useState<[number, number]>([1.8, 1.0]);
  const [v2, setV2] = useState<[number, number]>([-0.6, 1.6]);
  const [rotAngle, setRotAngle] = useState<number>(30);

  // 3D Interactive Orbit state
  const canvas3dRef = useRef<HTMLCanvasElement | null>(null);
  const [yaw, setYaw] = useState(0.65);
  const [pitch, setPitch] = useState(0.42);
  const [zoom, setZoom] = useState(46);
  const draggingRef = useRef(false);
  const lastDragRef = useRef<{ x: number; y: number } | null>(null);

  const [u3, setU3] = useState<[number, number, number]>([2, 1, 1.2]);
  const [v3, setV3] = useState<[number, number, number]>([-0.5, 2.1, 0.8]);
  const [showPlane, setShowPlane] = useState(true);
  const [showLine, setShowLine] = useState(true);
  const [planeEq, setPlaneEq] = useState<{ a: number; b: number; c: number; d: number }>({
    a: 0.4,
    b: -0.3,
    c: 1.0,
    d: 0.8,
  });

  const applyPreset2D = (kind: 'rotation' | 'scale' | 'reflect-x' | 'reflect-yx' | 'shear', angleDeg = rotAngle) => {
    const rad = (angleDeg * Math.PI) / 180;
    let m: number[][] = [
      [1, 0],
      [0, 1],
    ];
    if (kind === 'rotation') {
      m = [
        [Number(Math.cos(rad).toFixed(3)), Number((-Math.sin(rad)).toFixed(3))],
        [Number(Math.sin(rad).toFixed(3)), Number(Math.cos(rad).toFixed(3))],
      ];
    } else if (kind === 'scale') {
      m = [
        [1.6, 0],
        [0, 0.75],
      ];
    } else if (kind === 'reflect-x') {
      m = [
        [1, 0],
        [0, -1],
      ];
    } else if (kind === 'reflect-yx') {
      m = [
        [0, 1],
        [1, 0],
      ];
    } else if (kind === 'shear') {
      m = [
        [1, 0.8],
        [0, 1],
      ];
    }
    setSharedMatrix2D(m);
    logEvent('math', `Transformación 2D (${kind})`, `A = [[${m[0].join(', ')}], [${m[1].join(', ')}]]`);
  };

  const metrics2D = useMemo(() => {
    const vecOut = analyzeVectors(u2, v2).result;
    const transOut = applyLinearTransformation2D(sharedMatrix2D, u2).result;
    return { vecOut, transOut };
  }, [u2, v2, sharedMatrix2D]);

  const metrics3D = useMemo(() => {
    const vecOut = analyzeVectors(u3, v3).result;
    const spanOut = analyzeLinearIndependence([u3, v3]).result;
    return { vecOut, spanOut };
  }, [u3, v3]);

  const toSvg2D = (x: number, y: number) => ({
    sx: 180 + x * 44,
    sy: 180 - y * 44,
  });

  // Render interactive 3D canvas projection
  useEffect(() => {
    if (tab !== '3d') return;
    const canvas = canvas3dRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const bgCanvas = palette.bgCanvas;
    const textMuted = palette.textMuted;
    const textPrimary = palette.textPrimary;
    const accentPrimary = palette.accentPrimary;
    const accentSecondary = palette.accentSecondary;
    const statusOk = palette.statusOk;
    const statusWarn = palette.statusWarn;
    const borderHairline = palette.borderHairline;

    ctx.fillStyle = bgCanvas;
    ctx.fillRect(0, 0, W, H);

    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);

    const project = (x: number, y: number, z: number) => {
      const rx = x * cosY - y * sinY;
      const ry = x * sinY + y * cosY;
      const rz = z;
      const py = ry * cosP - rz * sinP;
      const pz = ry * sinP + rz * cosP;
      const persp = 14 / (14 + py * 0.65);
      return {
        sx: W / 2 + rx * zoom * persp,
        sy: H / 2 - pz * zoom * persp,
        depth: py,
      };
    };

    // Draw reference floor grid (z = 0)
    ctx.strokeStyle = borderHairline;
    ctx.lineWidth = 1;
    for (let g = -3; g <= 3; g++) {
      const a1 = project(g, -3, 0);
      const a2 = project(g, 3, 0);
      ctx.beginPath();
      ctx.moveTo(a1.sx, a1.sy);
      ctx.lineTo(a2.sx, a2.sy);
      ctx.stroke();

      const b1 = project(-3, g, 0);
      const b2 = project(3, g, 0);
      ctx.beginPath();
      ctx.moveTo(b1.sx, b1.sy);
      ctx.lineTo(b2.sx, b2.sy);
      ctx.stroke();
    }

    // Plane ax + by + cz = d with parametric wireframe surface mesh
    if (showPlane && Math.abs(planeEq.c) > 0.05) {
      const zAt = (x: number, y: number) =>
        (planeEq.d - planeEq.a * x - planeEq.b * y) / planeEq.c;
      const corners = [
        project(-2.2, -2.2, zAt(-2.2, -2.2)),
        project(2.2, -2.2, zAt(2.2, -2.2)),
        project(2.2, 2.2, zAt(2.2, 2.2)),
        project(-2.2, 2.2, zAt(-2.2, 2.2)),
      ];
      ctx.save();
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = accentPrimary;
      ctx.beginPath();
      ctx.moveTo(corners[0].sx, corners[0].sy);
      for (let i = 1; i < 4; i++) ctx.lineTo(corners[i].sx, corners[i].sy);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.strokeStyle = accentPrimary;
      ctx.lineWidth = 1.1;
      ctx.stroke();

      // Surface wireframe grid lines
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = accentPrimary;
      ctx.lineWidth = 0.8;
      for (let k = -1.1; k <= 1.11; k += 1.1) {
        const s1 = project(k, -2.2, zAt(k, -2.2));
        const s2 = project(k, 2.2, zAt(k, 2.2));
        ctx.beginPath();
        ctx.moveTo(s1.sx, s1.sy);
        ctx.lineTo(s2.sx, s2.sy);
        ctx.stroke();

        const t1 = project(-2.2, k, zAt(-2.2, k));
        const t2 = project(2.2, k, zAt(2.2, k));
        ctx.beginPath();
        ctx.moveTo(t1.sx, t1.sy);
        ctx.lineTo(t2.sx, t2.sy);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Span parallelogram of u and v
    const o = project(0, 0, 0);
    const pu = project(u3[0], u3[1], u3[2]);
    const pv = project(v3[0], v3[1], v3[2]);
    const puv = project(u3[0] + v3[0], u3[1] + v3[1], u3[2] + v3[2]);
    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = accentSecondary;
    ctx.beginPath();
    ctx.moveTo(o.sx, o.sy);
    ctx.lineTo(pu.sx, pu.sy);
    ctx.lineTo(puv.sx, puv.sy);
    ctx.lineTo(pv.sx, pv.sy);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Axes X, Y, Z with ticks
    const drawAxis = (end: [number, number, number], label: string) => {
      const pEnd = project(end[0], end[1], end[2]);
      ctx.strokeStyle = textMuted;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(o.sx, o.sy);
      ctx.lineTo(pEnd.sx, pEnd.sy);
      ctx.stroke();
      ctx.fillStyle = textMuted;
      ctx.font = '600 11px JetBrains Mono, monospace';
      ctx.fillText(label, pEnd.sx + 5, pEnd.sy + 3);
    };
    drawAxis([3.2, 0, 0], 'X');
    drawAxis([0, 3.2, 0], 'Y');
    drawAxis([0, 0, 3.2], 'Z');

    // Parametric line r(t) = u + t*(v - u)
    if (showLine) {
      const l1 = project(
        u3[0] - 0.6 * (v3[0] - u3[0]),
        u3[1] - 0.6 * (v3[1] - u3[1]),
        u3[2] - 0.6 * (v3[2] - u3[2])
      );
      const l2 = project(
        u3[0] + 1.6 * (v3[0] - u3[0]),
        u3[1] + 1.6 * (v3[1] - u3[1]),
        u3[2] + 1.6 * (v3[2] - u3[2])
      );
      ctx.strokeStyle = statusWarn;
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(l1.sx, l1.sy);
      ctx.lineTo(l2.sx, l2.sy);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const drawVector3D = (vec: [number, number, number], color: string, label: string) => {
      const p = project(vec[0], vec[1], vec[2]);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(o.sx, o.sy);
      ctx.lineTo(p.sx, p.sy);
      ctx.stroke();

      // Arrowhead
      const angle = Math.atan2(p.sy - o.sy, p.sx - o.sx);
      const headLen = 9;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(p.sx, p.sy);
      ctx.lineTo(p.sx - headLen * Math.cos(angle - Math.PI / 7), p.sy - headLen * Math.sin(angle - Math.PI / 7));
      ctx.lineTo(p.sx - headLen * Math.cos(angle + Math.PI / 7), p.sy - headLen * Math.sin(angle + Math.PI / 7));
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = textPrimary;
      ctx.font = 'bold 12px JetBrains Mono, monospace';
      ctx.fillText(label, p.sx + 7, p.sy - 4);
    };

    drawVector3D(u3, accentPrimary, `u(${u3.map((n) => n.toFixed(1)).join(',')})`);
    drawVector3D(v3, accentSecondary, `v(${v3.map((n) => n.toFixed(1)).join(',')})`);
    if (metrics3D.vecOut.crossProduct) {
      const cp = metrics3D.vecOut.crossProduct as [number, number, number];
      const mag = Math.hypot(cp[0], cp[1], cp[2]);
      const scaled: [number, number, number] =
        mag > 3.2 ? [cp[0] * (3 / mag), cp[1] * (3 / mag), cp[2] * (3 / mag)] : cp;
      drawVector3D(scaled, statusOk, 'u×v');
    }
  }, [tab, yaw, pitch, zoom, u3, v3, showPlane, showLine, planeEq, metrics3D, palette]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            Geometría Matemática Interactiva (2D y 3D)
          </h1>
          <p className="text-xs text-[var(--text-muted)]">
            Transformaciones lineales ℝ², vectores, proyecciones, rectas paramétricas, planos y producto cruz conectados en tiempo real al motor matemático.
          </p>
        </div>

        <div className="inline-flex items-center gap-1 p-1 rounded-xl surface-elevated self-start">
          <button
            type="button"
            onClick={() => setTab('2d')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap ${
              tab === '2d'
                ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                : 'text-[var(--text-secondary)]'
            }`}
          >
            Plano 2D (Transformaciones)
          </button>
          <button
            type="button"
            onClick={() => setTab('3d')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap ${
              tab === '3d'
                ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                : 'text-[var(--text-secondary)]'
            }`}
          >
            Espacio 3D Interactivo
          </button>
        </div>
      </div>

      {tab === '2d' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 surface-card rounded-2xl p-5 space-y-4 text-xs">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Matriz de Transformación A (2×2) y Vectores
            </h2>

            <div className="grid grid-cols-2 gap-2">
              {sharedMatrix2D.map((row, r) =>
                row.map((val, c) => (
                  <label key={`${r}-${c}`} className="space-y-1">
                    <span className="text-[11px] font-mono text-[var(--text-muted)]">
                      A[{r + 1},{c + 1}]
                    </span>
                    <input
                      type="number"
                      step={0.1}
                      value={val}
                      onChange={(e) => {
                        const next = sharedMatrix2D.map((rw) => [...rw]);
                        next[r][c] = Number(e.target.value) || 0;
                        setSharedMatrix2D(next);
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg font-mono surface-elevated text-[var(--text-primary)]"
                    />
                  </label>
                ))
              )}
            </div>

            <div className="space-y-2 pt-1">
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Rotación paramétrica θ</span>
                <span className="font-mono tabular-nums text-[var(--accent-primary)]">{rotAngle}°</span>
              </div>
              <input
                type="range"
                min={-180}
                max={180}
                step={5}
                value={rotAngle}
                onChange={(e) => {
                  const deg = Number(e.target.value);
                  setRotAngle(deg);
                  applyPreset2D('rotation', deg);
                }}
                className="w-full accent-[var(--accent-primary)]"
              />
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => applyPreset2D('rotation', rotAngle)}
                  className="px-2.5 py-1 rounded-lg surface-elevated hover:border-[var(--accent-primary)] border border-[var(--border-hairline)] cursor-pointer"
                >
                  Rotación {rotAngle}°
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset2D('scale')}
                  className="px-2.5 py-1 rounded-lg surface-elevated hover:border-[var(--accent-primary)] border border-[var(--border-hairline)] cursor-pointer"
                >
                  Escala (1.6, 0.75)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset2D('reflect-x')}
                  className="px-2.5 py-1 rounded-lg surface-elevated hover:border-[var(--accent-primary)] border border-[var(--border-hairline)] cursor-pointer"
                >
                  Reflexión X
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset2D('reflect-yx')}
                  className="px-2.5 py-1 rounded-lg surface-elevated hover:border-[var(--accent-primary)] border border-[var(--border-hairline)] cursor-pointer"
                >
                  Reflexión y=x
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset2D('shear')}
                  className="px-2.5 py-1 rounded-lg surface-elevated hover:border-[var(--accent-primary)] border border-[var(--border-hairline)] cursor-pointer"
                >
                  Cizallamiento
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[var(--border-hairline)]">
              <div className="space-y-1">
                <span className="font-mono text-[var(--text-muted)]">Vector u = (u₁, u₂)</span>
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="number"
                    step={0.2}
                    value={u2[0]}
                    onChange={(e) => setU2([Number(e.target.value) || 0, u2[1]])}
                    className="px-2 py-1.5 rounded-lg font-mono surface-elevated text-[var(--text-primary)]"
                  />
                  <input
                    type="number"
                    step={0.2}
                    value={u2[1]}
                    onChange={(e) => setU2([u2[0], Number(e.target.value) || 0])}
                    className="px-2 py-1.5 rounded-lg font-mono surface-elevated text-[var(--text-primary)]"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <span className="font-mono text-[var(--text-muted)]">Vector v = (v₁, v₂)</span>
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="number"
                    step={0.2}
                    value={v2[0]}
                    onChange={(e) => setV2([Number(e.target.value) || 0, v2[1]])}
                    className="px-2 py-1.5 rounded-lg font-mono surface-elevated text-[var(--text-primary)]"
                  />
                  <input
                    type="number"
                    step={0.2}
                    value={v2[1]}
                    onChange={(e) => setV2([v2[0], Number(e.target.value) || 0])}
                    className="px-2 py-1.5 rounded-lg font-mono surface-elevated text-[var(--text-primary)]"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveModule('linear-algebra')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg surface-elevated border border-[var(--border-hairline)] text-[var(--accent-primary)] font-medium cursor-pointer"
              >
                <Calculator className="w-3.5 h-3.5" />
                Analizar A en Álgebra Lineal
              </button>
              <button
                type="button"
                onClick={() => setActiveModule('simulation-lab')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg surface-elevated border border-[var(--border-hairline)] text-[var(--text-secondary)] font-medium cursor-pointer"
              >
                <FlaskConical className="w-3.5 h-3.5" />
                Ir a Simulation Lab
              </button>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-4">
            <ScientificChartCard
              title="Plano Cartesiano ℝ² · Cuadrado unitario, u, v, proy_v(u) y T(u)=Au"
              subtitle={`|det(A)| = ${formatNum(metrics2D.transOut.areaScaleFactor, 3)} · ${
                metrics2D.transOut.preservesOrientation ? 'Orientación directa' : 'Orientación invertida'
              }`}
              exportFilename="vectoria_geometria_2d"
              headerRight={
                probe2D ? (
                  <span className="text-[11px] font-mono tabular-nums text-[var(--accent-secondary)] px-2 py-0.5 rounded surface-elevated">
                    ({probe2D.x.toFixed(2)}, {probe2D.y.toFixed(2)})
                  </span>
                ) : null
              }
              dataTable={{
                columns: ['Elemento', 'x₁', 'x₂', 'Norma ||·||₂'],
                rows: [
                  ['Vector u', formatNum(u2[0], 3), formatNum(u2[1], 3), formatNum(metrics2D.vecOut.normU, 3)],
                  ['Vector v', formatNum(v2[0], 3), formatNum(v2[1], 3), formatNum(metrics2D.vecOut.normV, 3)],
                  [
                    'proy_v(u)',
                    formatNum(metrics2D.vecOut.projectionUonV[0], 3),
                    formatNum(metrics2D.vecOut.projectionUonV[1], 3),
                    formatNum(
                      Math.hypot(metrics2D.vecOut.projectionUonV[0], metrics2D.vecOut.projectionUonV[1]),
                      3
                    ),
                  ],
                  [
                    'T(u) = A·u',
                    formatNum(metrics2D.transOut.transformedVector[0], 3),
                    formatNum(metrics2D.transOut.transformedVector[1], 3),
                    formatNum(
                      Math.hypot(
                        metrics2D.transOut.transformedVector[0],
                        metrics2D.transOut.transformedVector[1]
                      ),
                      3
                    ),
                  ],
                ],
              }}
            >
              <svg
                viewBox="0 0 360 360"
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const sx = ((e.clientX - rect.left) / rect.width) * 360;
                  const sy = ((e.clientY - rect.top) / rect.height) * 360;
                  setProbe2D({ x: (sx - 180) / 44, y: (180 - sy) / 44 });
                }}
                onMouseLeave={() => setProbe2D(null)}
                className="w-full max-w-[390px] mx-auto rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-hairline)] cursor-crosshair"
              >
                <defs>
                  <marker id="geoArrowPri" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                    <path d="M0,0 L6,3 L0,6 Z" fill={palette.textPrimary} />
                  </marker>
                  <marker id="geoArrowSec" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                    <path d="M0,0 L6,3 L0,6 Z" fill={palette.accentSecondary} />
                  </marker>
                  <marker id="geoArrowOk" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                    <path d="M0,0 L6,3 L0,6 Z" fill={palette.statusOk} />
                  </marker>
                </defs>
                {[-3, -2, -1, 1, 2, 3].map((g) => {
                  const p = toSvg2D(g, g);
                  return (
                    <g key={g}>
                      <line x1={p.sx} y1={0} x2={p.sx} y2={360} stroke={palette.borderHairline} strokeWidth="1" />
                      <line x1={0} y1={p.sy} x2={360} y2={p.sy} stroke={palette.borderHairline} strokeWidth="1" />
                      <text x={p.sx + 2} y={192} fill={palette.textMuted} fontSize="9" fontFamily="JetBrains Mono">{g}</text>
                      <text x={184} y={p.sy + 3} fill={palette.textMuted} fontSize="9" fontFamily="JetBrains Mono">{g}</text>
                    </g>
                  );
                })}
                <line x1="0" y1="180" x2="360" y2="180" stroke={palette.borderStrong} strokeWidth="1.2" />
                <line x1="180" y1="0" x2="180" y2="360" stroke={palette.borderStrong} strokeWidth="1.2" />

                {(() => {
                  const o = toSvg2D(0, 0);
                  const e1p = metrics2D.transOut.e1Prime;
                  const e2p = metrics2D.transOut.e2Prime;
                  const p1 = toSvg2D(e1p[0], e1p[1]);
                  const p2 = toSvg2D(e1p[0] + e2p[0], e1p[1] + e2p[1]);
                  const p3 = toSvg2D(e2p[0], e2p[1]);

                  const pu = toSvg2D(u2[0], u2[1]);
                  const pv = toSvg2D(v2[0], v2[1]);
                  const pProj = toSvg2D(
                    metrics2D.vecOut.projectionUonV[0],
                    metrics2D.vecOut.projectionUonV[1]
                  );
                  const pTu = toSvg2D(
                    metrics2D.transOut.transformedVector[0],
                    metrics2D.transOut.transformedVector[1]
                  );

                  // Angle arc between u and v
                  const angU = Math.atan2(-u2[1], u2[0]);
                  const angV = Math.atan2(-v2[1], v2[0]);
                  const arcR = 26;
                  const auX = o.sx + arcR * Math.cos(angU);
                  const auY = o.sy + arcR * Math.sin(angU);
                  const avX = o.sx + arcR * Math.cos(angV);
                  const avY = o.sy + arcR * Math.sin(angV);
                  let dAng = angV - angU;
                  while (dAng > Math.PI) dAng -= 2 * Math.PI;
                  while (dAng < -Math.PI) dAng += 2 * Math.PI;
                  const sweep = dAng >= 0 ? 1 : 0;

                  return (
                    <>
                      <polygon
                        points={`${o.sx},${o.sy} ${toSvg2D(1, 0).sx},${toSvg2D(1, 0).sy} ${toSvg2D(1, 1).sx},${toSvg2D(1, 1).sy} ${toSvg2D(0, 1).sx},${toSvg2D(0, 1).sy}`}
                        fill="none"
                        stroke={palette.textMuted}
                        strokeDasharray="4 3"
                      />
                      <polygon
                        points={`${o.sx},${o.sy} ${p1.sx},${p1.sy} ${p2.sx},${p2.sy} ${p3.sx},${p3.sy}`}
                        fill={palette.accentPrimary}
                        fillOpacity={0.14}
                        stroke={palette.accentPrimary}
                        strokeWidth="1.8"
                      />
                      <path
                        d={`M ${auX} ${auY} A ${arcR} ${arcR} 0 0 ${sweep} ${avX} ${avY}`}
                        fill="none"
                        stroke={palette.statusWarn}
                        strokeWidth="1.5"
                      />
                      <line
                        x1={pu.sx}
                        y1={pu.sy}
                        x2={pProj.sx}
                        y2={pProj.sy}
                        stroke={palette.textMuted}
                        strokeDasharray="3 3"
                      />
                      <line x1={o.sx} y1={o.sy} x2={pv.sx} y2={pv.sy} stroke={palette.accentSecondary} strokeWidth="2.2" markerEnd="url(#geoArrowSec)" />
                      <line x1={o.sx} y1={o.sy} x2={pu.sx} y2={pu.sy} stroke={palette.textPrimary} strokeWidth="2.2" markerEnd="url(#geoArrowPri)" />
                      <line x1={o.sx} y1={o.sy} x2={pTu.sx} y2={pTu.sy} stroke={palette.statusOk} strokeWidth="2.5" markerEnd="url(#geoArrowOk)" />
                      <circle cx={pProj.sx} cy={pProj.sy} r="4" fill={palette.statusWarn} />
                      <text x={pu.sx + 7} y={pu.sy - 4} fill={palette.textPrimary} fontSize="11" fontFamily="JetBrains Mono" fontWeight="bold">u</text>
                      <text x={pv.sx + 7} y={pv.sy - 4} fill={palette.accentSecondary} fontSize="11" fontFamily="JetBrains Mono" fontWeight="bold">v</text>
                      <text x={pTu.sx + 7} y={pTu.sy - 4} fill={palette.statusOk} fontSize="11" fontFamily="JetBrains Mono" fontWeight="bold">Au</text>
                    </>
                  );
                })()}
              </svg>
            </ScientificChartCard>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono tabular-nums">
              <div className="surface-card rounded-xl p-3">
                <div className="font-sans text-[11px] text-[var(--text-muted)]">||u||₂ / ||v||₂</div>
                <div className="font-semibold text-[var(--text-primary)] mt-1">
                  {formatNum(metrics2D.vecOut.normU, 2)} / {formatNum(metrics2D.vecOut.normV, 2)}
                </div>
              </div>
              <div className="surface-card rounded-xl p-3">
                <div className="font-sans text-[11px] text-[var(--text-muted)]">Ángulo θ(u,v)</div>
                <div className="font-semibold text-[var(--accent-secondary)] mt-1">
                  {formatNum(metrics2D.vecOut.angleDeg, 2)}°
                </div>
              </div>
              <div className="surface-card rounded-xl p-3">
                <div className="font-sans text-[11px] text-[var(--text-muted)]">proy_v(u)</div>
                <div className="font-semibold text-[var(--status-warn)] mt-1">
                  [{metrics2D.vecOut.projectionUonV.map((n) => formatNum(n, 2)).join(', ')}]
                </div>
              </div>
              <div className="surface-card rounded-xl p-3">
                <div className="font-sans text-[11px] text-[var(--text-muted)]">T(u) = A·u</div>
                <div className="font-semibold text-[var(--status-ok)] mt-1">
                  [{metrics2D.transOut.transformedVector.map((n) => formatNum(n, 2)).join(', ')}]
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 surface-card rounded-2xl p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                Parámetros en ℝ³ (Arrastra el lienzo para rotar)
              </h2>
              <button
                type="button"
                onClick={() => {
                  setYaw(0.65);
                  setPitch(0.42);
                  setZoom(46);
                }}
                className="inline-flex items-center gap-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Vista inicial
              </button>
            </div>

            <div className="space-y-2">
              <span className="font-mono text-[var(--text-secondary)]">Vector u ∈ ℝ³</span>
              <div className="grid grid-cols-3 gap-2">
                {u3.map((val, i) => (
                  <input
                    key={i}
                    type="number"
                    step={0.2}
                    value={val}
                    onChange={(e) => {
                      const next = [...u3] as [number, number, number];
                      next[i] = Number(e.target.value) || 0;
                      setU3(next);
                    }}
                    className="px-2.5 py-1.5 rounded-lg font-mono surface-elevated text-[var(--text-primary)]"
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <span className="font-mono text-[var(--text-secondary)]">Vector v ∈ ℝ³</span>
              <div className="grid grid-cols-3 gap-2">
                {v3.map((val, i) => (
                  <input
                    key={i}
                    type="number"
                    step={0.2}
                    value={val}
                    onChange={(e) => {
                      const next = [...v3] as [number, number, number];
                      next[i] = Number(e.target.value) || 0;
                      setV3(next);
                    }}
                    className="px-2.5 py-1.5 rounded-lg font-mono surface-elevated text-[var(--text-primary)]"
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-[var(--border-hairline)]">
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPlane}
                    onChange={(e) => setShowPlane(e.target.checked)}
                    className="accent-[var(--accent-primary)]"
                  />
                  <span>Mostrar plano ax+by+cz=d</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showLine}
                    onChange={(e) => setShowLine(e.target.checked)}
                    className="accent-[var(--accent-primary)]"
                  />
                  <span>Mostrar recta r(t) = u + t(v−u)</span>
                </label>
              </div>
              {showPlane && (
                <div className="grid grid-cols-4 gap-2 pt-1">
                  {(['a', 'b', 'c', 'd'] as const).map((k) => (
                    <label key={k} className="space-y-1">
                      <span className="font-mono text-[11px] text-[var(--text-muted)]">{k}</span>
                      <input
                        type="number"
                        step={0.1}
                        value={planeEq[k]}
                        onChange={(e) =>
                          setPlaneEq((p) => ({ ...p, [k]: Number(e.target.value) || 0 }))
                        }
                        className="w-full px-2 py-1 rounded font-mono surface-elevated text-[var(--text-primary)]"
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>

            <label className="block space-y-1">
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Zoom perspectiva</span>
                <span className="font-mono tabular-nums">{zoom} px/u</span>
              </div>
              <input
                type="range"
                min={28}
                max={74}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full accent-[var(--accent-primary)]"
              />
            </label>
          </div>

          <div className="lg:col-span-7 space-y-4">
            <ScientificChartCard
              title="Espacio ℝ³ Interactivo (Arrastre libre + rueda para zoom)"
              subtitle={`Span dim = ${metrics3D.spanOut.dimension} (${
                metrics3D.spanOut.isLinearlyIndependent ? 'Linealmente indep.' : 'Linealmente dep.'
              }) · Malla del plano ax+by+cz=d`}
              exportFilename="vectoria_geometria_3d"
              dataTable={{
                columns: ['Vector ℝ³', 'x', 'y', 'z'],
                rows: [
                  ['u', formatNum(u3[0], 3), formatNum(u3[1], 3), formatNum(u3[2], 3)],
                  ['v', formatNum(v3[0], 3), formatNum(v3[1], 3), formatNum(v3[2], 3)],
                  ...(metrics3D.vecOut.crossProduct
                    ? [
                        [
                          'u × v',
                          formatNum(metrics3D.vecOut.crossProduct[0], 3),
                          formatNum(metrics3D.vecOut.crossProduct[1], 3),
                          formatNum(metrics3D.vecOut.crossProduct[2], 3),
                        ],
                      ]
                    : []),
                  [
                    'proy_v(u)',
                    formatNum(metrics3D.vecOut.projectionUonV[0], 3),
                    formatNum(metrics3D.vecOut.projectionUonV[1], 3),
                    formatNum(metrics3D.vecOut.projectionUonV[2], 3),
                  ],
                ],
              }}
            >
              <canvas
                ref={canvas3dRef}
                width={620}
                height={360}
                onWheel={(e) => {
                  e.preventDefault();
                  setZoom((z) => Math.max(28, Math.min(74, Math.round(z - e.deltaY * 0.04))));
                }}
                onPointerDown={(e) => {
                  draggingRef.current = true;
                  lastDragRef.current = { x: e.clientX, y: e.clientY };
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  if (!draggingRef.current || !lastDragRef.current) return;
                  const dx = e.clientX - lastDragRef.current.x;
                  const dy = e.clientY - lastDragRef.current.y;
                  setYaw((y) => y + dx * 0.01);
                  setPitch((p) => Math.max(-1.4, Math.min(1.4, p + dy * 0.01)));
                  lastDragRef.current = { x: e.clientX, y: e.clientY };
                }}
                onPointerUp={() => {
                  draggingRef.current = false;
                  lastDragRef.current = null;
                }}
                className="w-full rounded-xl border border-[var(--border-hairline)] cursor-grab active:cursor-grabbing touch-none"
              />
            </ScientificChartCard>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono tabular-nums">
              <div className="surface-card rounded-xl p-3">
                <div className="font-sans text-[11px] text-[var(--text-muted)]">Producto punto & Ángulo</div>
                <div className="font-semibold text-[var(--text-primary)] mt-1">
                  u·v = {formatNum(metrics3D.vecOut.dotProduct, 3)} · {formatNum(metrics3D.vecOut.angleDeg, 2)}°
                </div>
              </div>
              <div className="surface-card rounded-xl p-3">
                <div className="font-sans text-[11px] text-[var(--text-muted)]">Producto cruz u × v</div>
                <div className="font-semibold text-[var(--status-ok)] mt-1">
                  [{metrics3D.vecOut.crossProduct?.map((n) => formatNum(n, 2)).join(', ')}]
                </div>
              </div>
              <div className="surface-card rounded-xl p-3">
                <div className="font-sans text-[11px] text-[var(--text-muted)]">Proyección proy_v(u)</div>
                <div className="font-semibold text-[var(--accent-secondary)] mt-1">
                  [{metrics3D.vecOut.projectionUonV.map((n) => formatNum(n, 2)).join(', ')}]
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
