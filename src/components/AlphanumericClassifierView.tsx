import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Eraser, Layers, Network, Play, Sparkles } from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { GRID_SIZE } from '../engines/alphanumericDataset';
import { ClassifierMode } from '../types/vectoria';
import { ALPHANUMERIC_COMBINED_CONFIG } from '../utils/alphanumericTraining';
import { Mnist784LabPanel } from './Mnist784LabPanel';
import { SoftmaxBarChart } from './charts/SoftmaxBarChart';

const CANVAS_PX = 256;

const QUICK_SAMPLES: Record<ClassifierMode, string[]> = {
  digits: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
  letters: ['A', 'B', 'C', 'E', 'G', 'I', 'M', 'O', 'Q', 'X'],
  alphanumeric: ['0', 'O', '1', 'I', '3', 'B', '7', 'A', 'Q', 'Z'],
};

export const AlphanumericClassifierView: React.FC = () => {
  const {
    classifierMode,
    setClassifierMode,
    currentInputGrid,
    classifyGrid,
    loadSampleGlyph,
    lastPrediction,
    predictionHistory,
    digitsSummary,
    lettersSummary,
    alphanumericSummary,
    trainAlphanumericModel,
    trainingProgress,
    setActiveModule,
  } = useStudio();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const [hasStrokes, setHasStrokes] = useState(true);
  const [viewMode, setViewMode] = useState<ClassifierMode | 'mnist784'>(classifierMode);

  // Sync grid back to canvas when preset loaded
  const renderGridToCanvas = (grid: number[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#09090d';
    ctx.fillRect(0, 0, CANVAS_PX, CANVAS_PX);
    const cell = CANVAS_PX / GRID_SIZE;
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const val = grid[r * GRID_SIZE + c] ?? 0;
        if (val > 0.02) {
          const lum = Math.round(val * 255);
          ctx.fillStyle = `rgb(${lum}, ${lum}, ${lum})`;
          ctx.fillRect(c * cell, r * cell, cell + 0.5, cell + 0.5);
        }
      }
    }
  };

  useEffect(() => {
    if (viewMode !== 'mnist784') {
      renderGridToCanvas(currentInputGrid);
    }
  }, [currentInputGrid, viewMode]);

  const extractGridFromCanvas = (): number[] => {
    const canvas = canvasRef.current;
    if (!canvas) return currentInputGrid;
    const ctx = canvas.getContext('2d');
    if (!ctx) return currentInputGrid;

    const img = ctx.getImageData(0, 0, CANVAS_PX, CANVAS_PX).data;
    // Compute bounding box of active ink so drawn characters center cleanly like MNIST/EMNIST
    let minX = CANVAS_PX,
      minY = CANVAS_PX,
      maxX = -1,
      maxY = -1;
    for (let y = 0; y < CANVAS_PX; y++) {
      for (let x = 0; x < CANVAS_PX; x++) {
        const idx = (y * CANVAS_PX + x) * 4;
        const val = img[idx] / 255;
        if (val > 0.12) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    const grid = new Array<number>(GRID_SIZE * GRID_SIZE).fill(0);
    if (maxX < minX || maxY < minY) return grid;

    // Normalize bounding box into [0.16..0.84] inside 16x16 grid
    const boxW = Math.max(16, maxX - minX + 1);
    const boxH = Math.max(16, maxY - minY + 1);
    const size = Math.max(boxW, boxH);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const targetSpan = GRID_SIZE * 0.72;

    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        // Map grid cell back to source square centered at (cx, cy)
        const sx0 = cx + ((c - GRID_SIZE / 2) / targetSpan) * size;
        const sx1 = cx + ((c + 1 - GRID_SIZE / 2) / targetSpan) * size;
        const sy0 = cy + ((r - GRID_SIZE / 2) / targetSpan) * size;
        const sy1 = cy + ((r + 1 - GRID_SIZE / 2) / targetSpan) * size;

        let sum = 0;
        let count = 0;
        const xStart = Math.max(0, Math.floor(sx0));
        const xEnd = Math.min(CANVAS_PX - 1, Math.ceil(sx1));
        const yStart = Math.max(0, Math.floor(sy0));
        const yEnd = Math.min(CANVAS_PX - 1, Math.ceil(sy1));

        for (let y = yStart; y <= yEnd; y++) {
          for (let x = xStart; x <= xEnd; x++) {
            sum += img[(y * CANVAS_PX + x) * 4] / 255;
            count++;
          }
        }
        grid[r * GRID_SIZE + c] = count > 0 ? Number(Math.min(1, sum / count).toFixed(4)) : 0;
      }
    }
    return grid;
  };

  const getPointerPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * CANVAS_PX,
      y: ((e.clientY - rect.top) / rect.height) * CANVAS_PX,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!hasStrokes) {
      ctx.fillStyle = '#09090d';
      ctx.fillRect(0, 0, CANVAS_PX, CANVAS_PX);
    }
    isDrawingRef.current = true;
    const pos = getPointerPos(e);
    lastPosRef.current = pos;
    setHasStrokes(true);

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 10, 0, Math.PI * 2);
    ctx.fill();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx || !lastPosRef.current) return;

    const pos = getPointerPos(e);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 20;
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
    const grid = extractGridFromCanvas();
    classifyGrid(grid);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#09090d';
        ctx.fillRect(0, 0, CANVAS_PX, CANVAS_PX);
      }
    }
    setHasStrokes(false);
  };

  const handleModeSwitch = (mode: ClassifierMode | 'mnist784') => {
    setViewMode(mode);
    if (mode !== 'mnist784') {
      setClassifierMode(mode);
      if (mode !== 'alphanumeric' || alphanumericSummary.isTrained) {
        classifyGrid(currentInputGrid, mode);
      }
    }
  };

  const isAlphanumericBlocked =
    viewMode === 'alphanumeric' && !alphanumericSummary.isTrained;

  const chartData =
    lastPrediction && !isAlphanumericBlocked
      ? lastPrediction.topScores.map((s, idx) => ({
          label: s.label,
          prob: Number((s.probability * 100).toFixed(2)),
          logit: Number(s.logit.toFixed(3)),
          isTop: idx === 0,
        }))
      : [];

  return (
    <div className="space-y-6">
      {/* Header + Mode Segmented Control */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            Clasificador Alfanumérico
          </h1>
          <p className="text-xs text-[var(--text-muted)]">
            {viewMode === 'mnist784'
              ? 'Lienzo manual 280×280 → ℝ⁷⁸⁴ (28×28) con modelo original 784–128–10 (101,770 parámetros) e inspector matemático.'
              : 'Inferencia real sobre vectores normalizados ℝ²⁵⁶ (16×16) con salida Softmax verificable.'}
          </p>
        </div>
        <div
          className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl surface-elevated self-start"
          role="tablist"
          aria-label="Modo de clasificación"
        >
          {(
            [
              { id: 'digits', label: 'Dígitos (0–9)' },
              { id: 'letters', label: 'Letras (A–Z)' },
              { id: 'alphanumeric', label: 'Alfanumérico (36)' },
              { id: 'mnist784', label: 'MNIST 784 (Original)' },
            ] as const
          ).map((tab) => {
            const active = viewMode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => handleModeSwitch(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
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
      </div>

      {viewMode === 'mnist784' ? (
        <Mnist784LabPanel />
      ) : (
        <>

      {/* Strict 36-class Gate Notice when untrained */}
      {isAlphanumericBlocked && (
        <div className="surface-card rounded-2xl p-6 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-2 max-w-3xl">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--status-warn)]">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Modelo Alfanumérico Combinado (36 clases) aún no entrenado</span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Por rigor matemático, VectorIA Studio no combina ni inventa porcentajes a partir de los
                modelos separados de 10 dígitos y 26 letras, ya que sus distribuciones Softmax operan
                sobre espacios de salida disjuntos y no han aprendido fronteras conjuntas para pares
                ambiguos como <span className="font-mono font-semibold">0 vs O</span> o{' '}
                <span className="font-mono font-semibold">1 vs I</span>.
              </p>
              <div className="text-xs text-[var(--text-muted)] font-mono">
                Arquitectura lista: 256 → 40 (ReLU) → 32 (ReLU) → 36 (Softmax) ·{' '}
                {alphanumericSummary.parameterCount.toLocaleString()} parámetros reales
              </div>
            </div>
            <button
              type="button"
              disabled={trainingProgress.isTraining}
              onClick={() => trainAlphanumericModel(30)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-contrast)] disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Play className="w-4 h-4" />
              {trainingProgress.isTraining
                ? `Entrenando época ${trainingProgress.currentEpoch}/${trainingProgress.totalEpochs}...`
                : 'Entrenar Modelo 36 Clases (Real)'}
            </button>
          </div>
          {trainingProgress.isTraining && trainingProgress.targetMode === 'alphanumeric' && (
            <div className="h-2 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
              <div
                className="h-full bg-[var(--accent-primary)] transition-all"
                style={{
                  width: `${Math.round(
                    (trainingProgress.currentEpoch / trainingProgress.totalEpochs) * 100
                  )}%`,
                }}
              />
            </div>
          )}
        </div>
      )}

      {viewMode === 'alphanumeric' && (
        <details className="surface-card rounded-2xl p-4 text-xs">
          <summary className="cursor-pointer font-semibold text-[var(--text-primary)] flex items-center justify-between gap-2">
            <span>
              Especificación Técnica: {ALPHANUMERIC_COMBINED_CONFIG.displayName}
            </span>
            <span className="font-mono text-[11px] text-[var(--accent-primary)]">
              Tensor [{ALPHANUMERIC_COMBINED_CONFIG.inputTensor.shape.join('×')}] → One-Hot [
              {ALPHANUMERIC_COMBINED_CONFIG.targetTensor.shape.join('')}]
            </span>
          </summary>
          <div className="mt-3 pt-3 border-t border-[var(--border-hairline)] grid grid-cols-1 md:grid-cols-3 gap-4 text-[var(--text-secondary)]">
            <div className="space-y-1">
              <div className="font-semibold text-[var(--text-primary)]">Tensor de Entrada</div>
              <div className="font-mono text-[11px]">
                {ALPHANUMERIC_COMBINED_CONFIG.inputTensor.name} ·{' '}
                {ALPHANUMERIC_COMBINED_CONFIG.inputTensor.dtype} ·{' '}
                {ALPHANUMERIC_COMBINED_CONFIG.inputTensor.spatialShape?.join('×')} en [0, 1]
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">
                {ALPHANUMERIC_COMBINED_CONFIG.inputTensor.normalization}
              </p>
            </div>
            <div className="space-y-1">
              <div className="font-semibold text-[var(--text-primary)]">Arquitectura y Etiquetas</div>
              <div className="font-mono text-[11px]">
                {ALPHANUMERIC_COMBINED_CONFIG.architecture.layerSizes.join(' → ')} (
                {ALPHANUMERIC_COMBINED_CONFIG.architecture.optimizer}, η=
                {ALPHANUMERIC_COMBINED_CONFIG.architecture.learningRate})
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">
                Índices 0..9 (Dígitos 0–9) · Índices 10..35 (Letras A–Z) · Pares críticos:{' '}
                {ALPHANUMERIC_COMBINED_CONFIG.dataRequirements.criticalDisambiguationPairs
                  .map(([a, b]) => `${a}/${b}`)
                  .join(', ')}
              </p>
            </div>
            <div className="space-y-1">
              <div className="font-semibold text-[var(--text-primary)]">Requisitos de Datos</div>
              <div className="font-mono text-[11px]">
                Mín: {ALPHANUMERIC_COMBINED_CONFIG.dataRequirements.minSamplesPerClassTrain} train /{' '}
                {ALPHANUMERIC_COMBINED_CONFIG.dataRequirements.minSamplesPerClassVal} val por clase (
                {ALPHANUMERIC_COMBINED_CONFIG.dataRequirements.totalMinTrainSamples}+ muestras)
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">
                {ALPHANUMERIC_COMBINED_CONFIG.dataRequirements.documentationNotes[1]}
              </p>
            </div>
          </div>
        </details>
      )}

      {/* Main 2-column Interactive Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Drawing Canvas + Quick Presets + 16x16 Tensor Preview */}
        <div className="lg:col-span-5 surface-card rounded-2xl p-5 space-y-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Lienzo de Entrada (Dibuja o elige muestra)
            </h2>
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border border-[var(--border-hairline)] hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] cursor-pointer whitespace-nowrap"
            >
              <Eraser className="w-3.5 h-3.5" />
              Limpiar
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <canvas
              ref={canvasRef}
              width={CANVAS_PX}
              height={CANVAS_PX}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              className="w-60 h-60 rounded-xl border border-[var(--border-strong)] bg-[#09090d] touch-none cursor-crosshair shrink-0"
            />
            <div className="space-y-3 w-full">
              <div className="text-xs font-medium text-[var(--text-secondary)]">
                Vectorización 16×16 (ℝ²⁵⁶)
              </div>
              <div
                className="grid gap-px p-2 rounded-lg bg-[#09090d] border border-[var(--border-hairline)] w-32 h-32"
                style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))` }}
                aria-label="Matriz de entrada 16 por 16"
              >
                {currentInputGrid.map((val, idx) => (
                  <div
                    key={idx}
                    style={{
                      backgroundColor: `rgba(56, 189, 248, ${Math.max(0.04, val)})`,
                    }}
                  />
                ))}
              </div>
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveModule('topology')}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--accent-primary)] hover:underline cursor-pointer"
                >
                  <Network className="w-3.5 h-3.5" />
                  Ver propagación en Topología →
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModule('xai')}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--accent-secondary)] hover:underline cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Explicar con mapa XAI →
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-[var(--text-muted)]">
              Muestras canónicas de prueba (incluye pares críticos 0/O y 1/I):
            </div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_SAMPLES[classifierMode].map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => {
                    setHasStrokes(true);
                    loadSampleGlyph(ch);
                  }}
                  className="w-8 h-8 rounded-lg font-mono text-xs font-semibold border border-[var(--border-hairline)] bg-[var(--bg-elevated)] hover:border-[var(--accent-primary)] text-[var(--text-primary)] transition-colors cursor-pointer"
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Softmax Distribution, Comparison & History */}
        <div className="lg:col-span-7 space-y-5">
          {/* Primary Prediction Result */}
          <div className="surface-card rounded-2xl p-5 space-y-4">
            {isAlphanumericBlocked ? (
              <div className="py-10 text-center space-y-2">
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  Clasificación combinada en espera de entrenamiento
                </p>
                <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">
                  Entrena el modelo unificado de 36 clases arriba o cambia temporalmente al modo
                  Dígitos (0–9) o Letras (A–Z), cuyos pesos reales ya están entrenados.
                </p>
              </div>
            ) : lastPrediction ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-hairline)] pb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl surface-elevated flex items-center justify-center font-mono text-3xl font-bold text-[var(--accent-primary)]">
                      {lastPrediction.topLabel}
                    </div>
                    <div>
                      <div className="text-xs text-[var(--text-muted)]">
                        Predicción Softmax ({lastPrediction.mode === 'digits' ? 'Dígitos' : lastPrediction.mode === 'letters' ? 'Letras' : 'Alfanumérico 36'})
                      </div>
                      <div className="text-2xl font-bold font-mono tabular-nums text-[var(--text-primary)]">
                        {(lastPrediction.confidence * 100).toFixed(2)}%
                      </div>
                      <div className="text-xs font-mono tabular-nums text-[var(--text-muted)]">
                        Entropía de Shannon: {lastPrediction.entropy.toFixed(3)} bits
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-xs text-[var(--text-muted)] space-y-1">
                    <div>
                      Val. dígitos: {(digitsSummary.valAccuracy * 100).toFixed(1)}%
                    </div>
                    <div>
                      Val. letras: {(lettersSummary.valAccuracy * 100).toFixed(1)}%
                    </div>
                    <div>
                      Val. 36 clases:{' '}
                      {alphanumericSummary.isTrained
                        ? `${(alphanumericSummary.valAccuracy * 100).toFixed(1)}% (${alphanumericSummary.epochsTrained} ép.)`
                        : 'No entrenado'}
                    </div>
                    {viewMode === 'alphanumeric' && alphanumericSummary.isTrained && (
                      <button
                        type="button"
                        disabled={trainingProgress.isTraining}
                        onClick={() => trainAlphanumericModel(10)}
                        className="mt-1 inline-flex items-center gap-1 px-2 py-1 rounded-md border border-[var(--border-hairline)] bg-[var(--bg-elevated)] hover:border-[var(--accent-primary)] text-[11px] font-medium text-[var(--accent-primary)] disabled:opacity-60 cursor-pointer"
                      >
                        <Play className="w-3 h-3" />
                        {trainingProgress.isTraining ? 'Entrenando...' : '+10 épocas 36 clases'}
                      </button>
                    )}
                  </div>
                </div>

                <SoftmaxBarChart
                  title="Distribución de probabilidades Softmax (Top 6 clases)"
                  subtitle="Haz clic en una barra para cargar la muestra canónica correspondiente · Línea punteada = azar 1/K"
                  data={chartData}
                  layout="vertical"
                  mode="single"
                  classCount={
                    lastPrediction.mode === 'digits'
                      ? 10
                      : lastPrediction.mode === 'letters'
                        ? 26
                        : 36
                  }
                  exportFilename={`vectoria_softmax_${lastPrediction.mode}`}
                  heightClass="h-56"
                  onSelectLabel={(lbl) => {
                    setHasStrokes(true);
                    loadSampleGlyph(lbl);
                  }}
                />

                {/* Comparison across individual & combined models */}
                {lastPrediction.comparison && (
                  <div className="pt-3 border-t border-[var(--border-hairline)] space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)]">
                      <Layers className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                      <span>Comparación paralela entre modelos</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div className="surface-elevated rounded-lg p-3">
                        <div className="text-[var(--text-muted)]">Solo Dígitos (0–9)</div>
                        <div className="font-mono font-semibold text-[var(--text-primary)] mt-1">
                          {lastPrediction.comparison.digitsTop
                            ? `${lastPrediction.comparison.digitsTop.label} · ${(
                                lastPrediction.comparison.digitsTop.confidence * 100
                              ).toFixed(1)}%`
                            : 'N/A'}
                        </div>
                      </div>
                      <div className="surface-elevated rounded-lg p-3">
                        <div className="text-[var(--text-muted)]">Solo Letras (A–Z)</div>
                        <div className="font-mono font-semibold text-[var(--text-primary)] mt-1">
                          {lastPrediction.comparison.lettersTop
                            ? `${lastPrediction.comparison.lettersTop.label} · ${(
                                lastPrediction.comparison.lettersTop.confidence * 100
                              ).toFixed(1)}%`
                            : 'N/A'}
                        </div>
                      </div>
                      <div className="surface-elevated rounded-lg p-3">
                        <div className="text-[var(--text-muted)]">Combinado (36 clases)</div>
                        <div className="font-mono font-semibold text-[var(--text-primary)] mt-1">
                          {lastPrediction.comparison.alphanumericTop
                            ? `${lastPrediction.comparison.alphanumericTop.label} · ${(
                                lastPrediction.comparison.alphanumericTop.confidence * 100
                              ).toFixed(1)}%`
                            : 'Requiere entrenamiento'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>

          {/* Prediction History */}
          <div className="surface-card rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Historial de Predicciones ({predictionHistory.length})
              </h3>
              <Sparkles className="w-4 h-4 text-[var(--text-muted)]" />
            </div>
            {predictionHistory.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">
                Dibuja un carácter en el lienzo para registrar inferencias.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border-hairline)] text-[var(--text-muted)]">
                      <th className="py-2 text-left font-medium">Clase</th>
                      <th className="py-2 text-left font-medium">Modo</th>
                      <th className="py-2 text-right font-medium">Confianza</th>
                      <th className="py-2 text-right font-medium">Entropía</th>
                      <th className="py-2 text-right font-medium">Hora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {predictionHistory.slice(0, 7).map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-[var(--border-hairline)] last:border-none hover:bg-[var(--bg-elevated)]"
                      >
                        <td className="py-2 font-mono font-bold text-[var(--accent-primary)]">
                          {item.topLabel}
                        </td>
                        <td className="py-2 text-[var(--text-secondary)]">
                          {item.mode === 'digits'
                            ? 'Dígitos'
                            : item.mode === 'letters'
                              ? 'Letras'
                              : '36 Clases'}
                        </td>
                        <td className="py-2 text-right font-mono tabular-nums text-[var(--text-primary)]">
                          {(item.confidence * 100).toFixed(2)}%
                        </td>
                        <td className="py-2 text-right font-mono tabular-nums text-[var(--text-muted)]">
                          {item.entropy.toFixed(3)}
                        </td>
                        <td className="py-2 text-right font-mono tabular-nums text-[var(--text-muted)]">
                          {new Date(item.timestamp).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
        </>
      )}
    </div>
  );
};
