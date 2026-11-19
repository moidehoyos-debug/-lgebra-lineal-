import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  Brush,
  Download,
  Eraser,
  Eye,
  Network,
  Play,
  Shield,
  Trash2,
  Undo2,
} from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import {
  getMnist784Meta,
  inspectMnist784Neuron,
  normalizeCanvasTo28x28,
} from '../engines/mnist784Engine';
import { SoftmaxBarChart } from './charts/SoftmaxBarChart';

const CANVAS_SIZE = 280;

export const Mnist784LabPanel: React.FC = () => {
  const {
    mnist784Pixels,
    mnist784Result,
    mnist784SourceLabel,
    runMnist784Inference,
    loadMnist784Example,
    setActiveModule,
    askOmniAboutExperiment,
  } = useStudio();

  const meta = useMemo(() => getMnist784Meta(), []);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const undoStackRef = useRef<ImageData[]>([]);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  const [brushSize, setBrushSize] = useState(20);
  const [toolMode, setToolMode] = useState<'draw' | 'erase'>('draw');
  const [undoCount, setUndoCount] = useState(0);
  const [pixelIndex, setPixelIndex] = useState(380);
  const [neuronIndex, setNeuronIndex] = useState(0);
  const [inspectorTab, setInspectorTab] = useState<'neuron' | 'matrix' | 'vector'>('neuron');
  const [emptyNotice, setEmptyNotice] = useState<string | null>(null);

  const drawPixelsToCanvas = (pixels: number[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const off = document.createElement('canvas');
    off.width = 28;
    off.height = 28;
    const oc = off.getContext('2d');
    if (!oc) return;
    const imgData = oc.createImageData(28, 28);
    for (let i = 0; i < 784; i++) {
      const c = Math.max(0, Math.min(255, Math.round((pixels[i] ?? 0) * 255)));
      const p = i * 4;
      imgData.data[p] = c;
      imgData.data[p + 1] = c;
      imgData.data[p + 2] = c;
      imgData.data[p + 3] = 255;
    }
    oc.putImageData(imgData, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#09090d';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.drawImage(off, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
  };

  useEffect(() => {
    drawPixelsToCanvas(mnist784Pixels);
  }, [mnist784Pixels]);

  const getPointerPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * CANVAS_SIZE,
      y: ((e.clientY - rect.top) / rect.height) * CANVAS_SIZE,
    };
  };

  const pushUndoSnapshot = (ctx: CanvasRenderingContext2D) => {
    const snap = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    undoStackRef.current.push(snap);
    if (undoStackRef.current.length > 10) undoStackRef.current.shift();
    setUndoCount(undoStackRef.current.length);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    pushUndoSnapshot(ctx);
    setEmptyNotice(null);
    isDrawingRef.current = true;
    const pos = getPointerPos(e);
    lastPosRef.current = pos;

    ctx.fillStyle = toolMode === 'draw' ? '#ffffff' : '#09090d';
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, brushSize / 2, 0, Math.PI * 2);
    ctx.fill();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx || !lastPosRef.current) return;

    const pos = getPointerPos(e);
    ctx.strokeStyle = toolMode === 'draw' ? '#ffffff' : '#09090d';
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPosRef.current = pos;
  };

  const handlePointerUp = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    lastPosRef.current = null;
  };

  const handleUndo = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const prev = undoStackRef.current.pop();
    setUndoCount(undoStackRef.current.length);
    if (prev) {
      ctx.putImageData(prev, 0, 0);
    }
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    pushUndoSnapshot(ctx);
    ctx.fillStyle = '#09090d';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    setEmptyNotice('Lienzo limpio. Dibuja un dígito o carga un ejemplo 0–9.');
  };

  const handleRunInference = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const normalized = normalizeCanvasTo28x28(canvas);
    const activeCount = normalized.filter((v) => v > 0.1).length;
    if (activeCount === 0) {
      setEmptyNotice('El lienzo está vacío: dibuja un dígito antes de ejecutar la inferencia.');
      return;
    }
    setEmptyNotice(null);
    runMnist784Inference(normalized, 'Lienzo manual 280×280 (normalizado 20×20 → 28×28)');
  };

  const handleDownloadCsv = () => {
    if (!mnist784Result) return;
    const lines = [
      'digito,probabilidad,logit_z2',
      ...mnist784Result.probs.map(
        (p, d) => `${d},${p.toFixed(10)},${mnist784Result.z2[d].toFixed(8)}`
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vectoria_784_probabilidades_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const inspection = useMemo(() => {
    if (!mnist784Result) return null;
    return inspectMnist784Neuron(mnist784Pixels, mnist784Result, pixelIndex, neuronIndex);
  }, [mnist784Pixels, mnist784Result, pixelIndex, neuronIndex]);

  const chartData = useMemo(() => {
    if (!mnist784Result) return [];
    return mnist784Result.probs.map((p, digit) => ({
      digit: String(digit),
      prob: Number((p * 100).toFixed(2)),
      logit: Number(mnist784Result.z2[digit].toFixed(3)),
      isBest: digit === mnist784Result.digit,
    }));
  }, [mnist784Result]);

  return (
    <div className="space-y-6">
      {/* Scientific Provenance Transparency Notice */}
      <div className="surface-card rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 border border-[var(--border-strong)]">
        <div className="flex items-start gap-2.5 text-xs">
          <AlertTriangle className="w-4 h-4 text-[var(--status-warn)] shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <div className="font-semibold text-[var(--text-primary)]">
              Modelo Original 784–128–10 ({meta.parametros.toLocaleString()} parámetros reales · Avance 2)
            </div>
            <p className="text-[var(--text-secondary)]">
              {meta.origen} Evaluación histórica registrada: {meta.evaluacion.correctos}/{meta.evaluacion.total} ={' '}
              {(meta.evaluacion.exactitud * 100).toFixed(1)}% sobre conjunto sintético. {meta.limitaciones}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveModule('robustness')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium surface-elevated border border-[var(--border-hairline)] hover:border-[var(--accent-primary)] text-[var(--text-primary)] cursor-pointer whitespace-nowrap"
          >
            <Shield className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            Perturbaciones 28×28
          </button>
          <button
            type="button"
            onClick={() => setActiveModule('topology')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium surface-elevated border border-[var(--border-hairline)] hover:border-[var(--accent-primary)] text-[var(--text-primary)] cursor-pointer whitespace-nowrap"
          >
            <Network className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
            Topología 784–128–10
          </button>
        </div>
      </div>

      {/* Main Drawing Canvas + Softmax Output */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: 280x280 Drawing Studio */}
        <div className="lg:col-span-5 surface-card rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                Lienzo Manual 280 × 280
              </h2>
              <p className="text-[11px] text-[var(--text-muted)]">{mnist784SourceLabel}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setToolMode('draw')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer ${
                  toolMode === 'draw'
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                    : 'surface-elevated text-[var(--text-secondary)]'
                }`}
              >
                <Brush className="w-3.5 h-3.5" />
                Pincel
              </button>
              <button
                type="button"
                onClick={() => setToolMode('erase')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer ${
                  toolMode === 'erase'
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                    : 'surface-elevated text-[var(--text-secondary)]'
                }`}
              >
                <Eraser className="w-3.5 h-3.5" />
                Borrar
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <canvas
              ref={canvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              onPointerCancel={handlePointerUp}
              aria-label="Lienzo de dibujo 280 por 280"
              className="w-[240px] h-[240px] sm:w-[260px] sm:h-[260px] rounded-xl border border-[var(--border-strong)] bg-[#09090d] touch-none cursor-crosshair shrink-0"
            />

            <div className="space-y-3 w-full">
              <div className="text-xs font-medium text-[var(--text-secondary)]">
                Procesado 28×28 (ℝ⁷⁸⁴)
              </div>
              <div
                className="grid p-1.5 rounded-lg bg-[#09090d] border border-[var(--border-hairline)] w-32 h-32"
                style={{ gridTemplateColumns: 'repeat(28, minmax(0, 1fr))' }}
                aria-label="Mapa de píxeles 28 por 28"
              >
                {mnist784Pixels.map((val, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setPixelIndex(idx);
                      setInspectorTab('neuron');
                    }}
                    title={`Píxel [${Math.floor(idx / 28)}, ${idx % 28}] (#${idx}) = ${val.toFixed(3)}`}
                    style={{
                      backgroundColor:
                        idx === pixelIndex
                          ? 'var(--accent-primary)'
                          : `rgba(56, 189, 248, ${Math.max(0.03, val)})`,
                    }}
                    className="w-full h-full cursor-pointer border-0 p-0"
                  />
                ))}
              </div>
              <div className="text-[11px] text-[var(--text-muted)]">
                Haz clic en cualquier celda 28×28 para inspeccionar su peso W₁[i,j].
              </div>
            </div>
          </div>

          {/* Brush + Undo/Clear/Infer Controls */}
          <div className="space-y-3 text-xs">
            <label className="block space-y-1">
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Grosor del pincel</span>
                <span className="font-mono tabular-nums text-[var(--text-primary)]">
                  {brushSize} px
                </span>
              </div>
              <input
                type="range"
                min={10}
                max={34}
                step={2}
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-full accent-[var(--accent-primary)]"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleRunInference}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-contrast)] cursor-pointer whitespace-nowrap"
              >
                <Play className="w-3.5 h-3.5" />
                Clasificar 784–128–10
              </button>
              <button
                type="button"
                onClick={handleUndo}
                disabled={undoCount === 0}
                className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs border border-[var(--border-hairline)] surface-elevated text-[var(--text-secondary)] disabled:opacity-40 cursor-pointer"
              >
                <Undo2 className="w-3.5 h-3.5" />
                Deshacer ({undoCount})
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs border border-[var(--border-hairline)] surface-elevated text-[var(--text-secondary)] cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Limpiar
              </button>
            </div>

            {emptyNotice && (
              <div className="text-[11px] text-[var(--status-warn)]">{emptyNotice}</div>
            )}
          </div>

          {/* 10 Synthetic Digit Examples */}
          <div className="space-y-1.5 pt-2 border-t border-[var(--border-hairline)]">
            <div className="text-xs text-[var(--text-muted)]">
              Ejemplos sintéticos originales (Avance 2):
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: 10 }, (_, d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setEmptyNotice(null);
                    loadMnist784Example(d);
                  }}
                  className={`w-8 h-8 rounded-lg font-mono text-xs font-semibold border cursor-pointer transition-colors ${
                    mnist784Result?.digit === d && mnist784SourceLabel.includes(`#${d}`)
                      ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] border-[var(--accent-primary)]'
                      : 'border-[var(--border-hairline)] bg-[var(--bg-elevated)] text-[var(--text-primary)] hover:border-[var(--accent-primary)]'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Softmax Distribution & Alternatives */}
        <div className="lg:col-span-7 space-y-5">
          <div className="surface-card rounded-2xl p-5 space-y-4">
            {mnist784Result ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-hairline)] pb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl surface-elevated flex items-center justify-center font-mono text-3xl font-bold text-[var(--accent-primary)]">
                      {mnist784Result.digit}
                    </div>
                    <div>
                      <div className="text-xs text-[var(--text-muted)]">
                        Predicción Red 784–128–10 (Softmax)
                      </div>
                      <div className="text-2xl font-bold font-mono tabular-nums text-[var(--text-primary)]">
                        {(mnist784Result.confidence * 100).toFixed(2)}%
                      </div>
                      <div className="text-xs font-mono tabular-nums text-[var(--text-muted)]">
                        Entropía: {mnist784Result.entropy.toFixed(3)} bits · Σp ={' '}
                        {mnist784Result.probs.reduce((a, b) => a + b, 0).toFixed(5)}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 text-xs">
                    <div className="font-mono tabular-nums text-[var(--text-secondary)]">
                      Píxeles &gt;0.1: {mnist784Result.activePixels}/784 · ReLU activas:{' '}
                      {mnist784Result.activeNeurons}/128
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleDownloadCsv}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[var(--border-hairline)] surface-elevated hover:border-[var(--accent-primary)] text-[var(--text-primary)] cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        CSV
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          askOmniAboutExperiment(
                            `Inferencia activa en modelo original 784–128–10 (${mnist784SourceLabel}):\n- Predicción: dígito ${mnist784Result.digit} (${(mnist784Result.confidence * 100).toFixed(2)}%)\n- Píxeles activos: ${mnist784Result.activePixels}/784\n- Neuronas ocultas ReLU activas: ${mnist784Result.activeNeurons}/128\n- Top 3 Softmax: ${mnist784Result.topAlternatives
                              .slice(0, 3)
                              .map((a) => `${a.digit}=${(a.probability * 100).toFixed(2)}%`)
                              .join(', ')}`
                          )
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[var(--border-hairline)] surface-elevated hover:border-[var(--accent-primary)] text-[var(--accent-primary)] cursor-pointer"
                      >
                        <Bot className="w-3.5 h-3.5" />
                        Analizar con Omni Bot
                      </button>
                    </div>
                  </div>
                </div>

                <SoftmaxBarChart
                  title="Distribución Softmax 784–128–10 (Dígitos 0–9)"
                  subtitle="Logits z₂ y probabilidad exacta por dígito · Línea punteada = 10% uniforme"
                  data={chartData.map((d) => ({
                    label: d.digit,
                    prob: d.prob,
                    logit: d.logit,
                    isTop: d.isBest,
                  }))}
                  layout="horizontal"
                  mode="single"
                  classCount={10}
                  exportFilename="vectoria_784_softmax"
                  heightClass="h-56"
                  onSelectLabel={(lbl) => loadMnist784Example(Number(lbl))}
                />

                {/* Top Alternatives Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                  {mnist784Result.topAlternatives.slice(0, 5).map((alt, rank) => (
                    <div
                      key={alt.digit}
                      className={`surface-elevated rounded-lg p-2.5 ${
                        rank === 0 ? 'border border-[var(--accent-primary)]' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-sm text-[var(--text-primary)]">
                          {alt.digit}
                        </span>
                        <span className="font-mono tabular-nums text-[var(--accent-primary)]">
                          {(alt.probability * 100).toFixed(2)}%
                        </span>
                      </div>
                      <div className="text-[11px] font-mono tabular-nums text-[var(--text-muted)]">
                        z₂={alt.logit.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* 3. Processing & Neural Network Inspector (Real 784-128-10 Calculations) */}
      <section className="surface-card rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-hairline)] pb-3">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-[var(--accent-primary)]" />
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                Inspector de Procesamiento y Red Neuronal (784 → 128 → 10)
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Valores reales extraídos de x ∈ ℝ⁷⁸⁴, W₁ ∈ ℝ⁷⁸⁴ˣ¹²⁸, b₁ ∈ ℝ¹²⁸, W₂ ∈ ℝ¹²⁸ˣ¹⁰ y b₂ ∈ ℝ¹⁰.
              </p>
            </div>
          </div>

          <div className="inline-flex items-center gap-1 p-1 rounded-xl surface-elevated text-xs">
            {(
              [
                { id: 'neuron', label: 'Pesos y Neurona' },
                { id: 'matrix', label: 'Matriz 28×28' },
                { id: 'vector', label: 'Vector x ∈ ℝ⁷⁸⁴' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setInspectorTab(t.id)}
                className={`px-3 py-1 rounded-lg font-medium cursor-pointer whitespace-nowrap ${
                  inspectorTab === t.id
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                    : 'text-[var(--text-secondary)]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {inspectorTab === 'neuron' && inspection && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <label className="space-y-1">
                <span className="text-[var(--text-secondary)]">
                  Índice de píxel i ∈ [0, 783] (fila {inspection.row}, col {inspection.col})
                </span>
                <input
                  type="number"
                  min={0}
                  max={783}
                  value={pixelIndex}
                  onChange={(e) =>
                    setPixelIndex(Math.max(0, Math.min(783, Math.round(Number(e.target.value) || 0))))
                  }
                  className="w-full px-3 py-2 rounded-lg font-mono surface-elevated text-[var(--text-primary)]"
                />
              </label>

              <label className="space-y-1">
                <span className="text-[var(--text-secondary)]">
                  Neurona oculta j ∈ [0, 127]
                </span>
                <input
                  type="number"
                  min={0}
                  max={127}
                  value={neuronIndex}
                  onChange={(e) =>
                    setNeuronIndex(Math.max(0, Math.min(127, Math.round(Number(e.target.value) || 0))))
                  }
                  className="w-full px-3 py-2 rounded-lg font-mono surface-elevated text-[var(--text-primary)]"
                />
              </label>

              <div className="surface-elevated rounded-lg p-2.5 flex flex-col justify-center">
                <div className="text-[var(--text-muted)]">Estado ReLU j={inspection.neuronIndex}</div>
                <div className="font-mono font-bold text-sm text-[var(--accent-primary)]">
                  {inspection.a1 > 0 ? 'ACTIVA (a₁ > 0)' : 'INACTIVA (a₁ = 0)'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
              <div className="surface-elevated rounded-xl p-4 space-y-2 font-mono tabular-nums">
                <div className="font-sans font-semibold text-[var(--text-primary)]">
                  Operación Exacta en Capa Oculta 1
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">x[{inspection.pixelIndex}]</span>
                  <span>{inspection.pixelValue.toFixed(6)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">
                    W₁[{inspection.pixelIndex}, {inspection.neuronIndex}]
                  </span>
                  <span>{inspection.weight.toFixed(6)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Contribución xᵢ · Wᵢⱼ</span>
                  <span className="text-[var(--accent-secondary)]">
                    {inspection.contribution.toFixed(7)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Sesgo b₁[{inspection.neuronIndex}]</span>
                  <span>{inspection.bias.toFixed(6)}</span>
                </div>
                <div className="flex justify-between border-t border-[var(--border-hairline)] pt-1.5">
                  <span className="text-[var(--text-muted)]">z₁[{inspection.neuronIndex}] = Σ(xᵢWᵢⱼ)+bⱼ</span>
                  <span className="font-semibold">{inspection.z1.toFixed(6)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">a₁[{inspection.neuronIndex}] = ReLU(z₁)</span>
                  <span className="font-bold text-[var(--accent-primary)]">
                    {inspection.a1.toFixed(6)}
                  </span>
                </div>
              </div>

              <div className="surface-elevated rounded-xl p-4 space-y-2">
                <div className="font-semibold text-[var(--text-primary)]">
                  Top Píxeles Más Influyentes sobre H[{inspection.neuronIndex}]
                </div>
                <div className="space-y-1 font-mono tabular-nums text-[11px]">
                  {inspection.topContributingPixels.length === 0 ? (
                    <div className="text-[var(--text-muted)]">No hay píxeles activos &gt; 0.01</div>
                  ) : (
                    inspection.topContributingPixels.map((item) => (
                      <button
                        key={item.pixelIndex}
                        type="button"
                        onClick={() => setPixelIndex(item.pixelIndex)}
                        className="w-full flex justify-between px-2 py-1 rounded hover:bg-[var(--bg-surface)] cursor-pointer text-left"
                      >
                        <span>
                          x[{item.pixelIndex}] ({item.row},{item.col})={item.pixelValue.toFixed(2)}
                        </span>
                        <span
                          className={
                            item.contribution >= 0
                              ? 'text-[var(--status-ok)]'
                              : 'text-[var(--status-err)]'
                          }
                        >
                          {item.contribution >= 0 ? '+' : ''}
                          {item.contribution.toFixed(4)}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="surface-elevated rounded-xl p-4 space-y-2">
                <div className="font-semibold text-[var(--text-primary)]">
                  Contribución de H[{inspection.neuronIndex}] a Logits z₂[0..9]
                </div>
                <div className="grid grid-cols-2 gap-1.5 font-mono tabular-nums text-[11px]">
                  {inspection.outputProjections.map((op) => (
                    <div
                      key={op.digit}
                      className="flex justify-between px-2 py-1 rounded bg-[var(--bg-surface)]"
                    >
                      <span>Dígito {op.digit}</span>
                      <span
                        className={
                          op.contributionToLogit >= 0
                            ? 'text-[var(--status-ok)]'
                            : 'text-[var(--status-err)]'
                        }
                      >
                        {op.contributionToLogit >= 0 ? '+' : ''}
                        {op.contributionToLogit.toFixed(3)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {inspectorTab === 'matrix' && (
          <div className="space-y-2">
            <div className="text-xs text-[var(--text-muted)]">
              Matriz de intensidad normalizada 28 × 28 (haz clic en una celda para cargar su índice i en el inspector de pesos):
            </div>
            <div className="overflow-x-auto">
              <div className="inline-grid gap-0.5 font-mono text-[9px]" style={{ gridTemplateColumns: 'repeat(28, 22px)' }}>
                {mnist784Pixels.map((v, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setPixelIndex(idx);
                      setInspectorTab('neuron');
                    }}
                    className={`h-5 flex items-center justify-center rounded-sm cursor-pointer border ${
                      idx === pixelIndex
                        ? 'border-[var(--accent-primary)] font-bold'
                        : 'border-transparent'
                    }`}
                    style={{
                      backgroundColor: `rgba(139, 92, 246, ${Math.max(0.06, v * 0.85)})`,
                      color: v > 0.45 ? '#ffffff' : 'var(--text-muted)',
                    }}
                  >
                    {v > 0.05 ? v.toFixed(1).slice(1) : '0'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {inspectorTab === 'vector' && (
          <div className="space-y-2 text-xs">
            <div className="text-[var(--text-muted)]">
              Vector plano x ∈ ℝ⁷⁸⁴ (primeros 140 elementos y resumen estadístico real):
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono tabular-nums">
              <div className="surface-elevated rounded-lg p-3">
                <div className="text-[var(--text-muted)]">Norma ||x||₂</div>
                <div className="font-bold text-[var(--text-primary)]">
                  {Math.sqrt(mnist784Pixels.reduce((s, v) => s + v * v, 0)).toFixed(4)}
                </div>
              </div>
              <div className="surface-elevated rounded-lg p-3">
                <div className="text-[var(--text-muted)]">Suma Σ xᵢ</div>
                <div className="font-bold text-[var(--text-primary)]">
                  {mnist784Pixels.reduce((s, v) => s + v, 0).toFixed(3)}
                </div>
              </div>
              <div className="surface-elevated rounded-lg p-3">
                <div className="text-[var(--text-muted)]">Píxeles &gt; 0.1</div>
                <div className="font-bold text-[var(--accent-primary)]">
                  {mnist784Pixels.filter((v) => v > 0.1).length} / 784
                </div>
              </div>
              <div className="surface-elevated rounded-lg p-3">
                <div className="text-[var(--text-muted)]">Máximo xᵢ</div>
                <div className="font-bold text-[var(--text-primary)]">
                  {Math.max(...mnist784Pixels).toFixed(4)}
                </div>
              </div>
            </div>
            <pre className="p-3 rounded-xl surface-elevated font-mono text-[11px] overflow-x-auto text-[var(--text-secondary)]">
              [{mnist784Pixels.slice(0, 140).map((v) => v.toFixed(2)).join(', ')}, ...]
            </pre>
          </div>
        )}
      </section>
    </div>
  );
};
