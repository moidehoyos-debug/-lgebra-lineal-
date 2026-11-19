import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Check, Download, Layers, Pause, Play, SlidersHorizontal } from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { useTheme } from '../context/ThemeContext';
import { getMnist784WeightSlices, infer784 } from '../engines/mnist784Engine';
import { ModuleErrorBoundary } from './ErrorBoundary';
import { exportContainerAsPng, useChartPalette } from './charts/chartTheme';

const NeuralTopology3DCanvas = lazy(() =>
  import('./NeuralTopology3DCanvas').then((m) => ({ default: m.NeuralTopology3DCanvas }))
);

interface NodeCoord {
  layerIdx: number;
  nodeIdx: number;
  x: number;
  y: number;
  activation: number;
  zValue: number;
  label?: string;
}

export const NeuralTopologyView: React.FC = () => {
  const {
    classifierMode,
    currentInputGrid,
    lastPrediction,
    suiteRef,
    loadSampleGlyph,
    alphanumericSummary,
    mnist784Pixels,
    mnist784Result,
    loadMnist784Example,
  } = useStudio();
  const { theme } = useTheme();
  const palette = useChartPalette();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasBoxRef = useRef<HTMLDivElement | null>(null);
  const [networkView, setNetworkView] = useState<'vectoria16' | 'mnist784'>('vectoria16');
  const [renderMode, setRenderMode] = useState<'2d' | '3d'>('2d');
  const [animatePulse, setAnimatePulse] = useState(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return false;
    }
    return true;
  });
  const [topKPerNode, setTopKPerNode] = useState(4);
  const [selectedNode, setSelectedNode] = useState<{
    layerIdx: number;
    nodeIdx: number;
  } | null>(null);
  const [hoveredNode, setHoveredNode] = useState<NodeCoord | null>(null);
  const [exportedPng, setExportedPng] = useState(false);

  // Pick active model matching classifier mode (fallback to digits if 36-class isn't trained yet)
  const activeModel = useMemo(() => {
    const suite = suiteRef.current;
    if (classifierMode === 'letters') return suite.lettersModel;
    if (classifierMode === 'alphanumeric' && suite.alphanumericModel.isTrained) {
      return suite.alphanumericModel;
    }
    return suite.digitsModel;
  }, [classifierMode, suiteRef, alphanumericSummary.isTrained]);

  const forwardData = useMemo(() => {
    return activeModel.forward(currentInputGrid);
  }, [activeModel, currentInputGrid]);

  // Pool 256 input pixels into 16 4x4 spatial blocks for clear topological rendering
  const pooledInput = useMemo(() => {
    const blocks: number[] = [];
    for (let br = 0; br < 4; br++) {
      for (let bc = 0; bc < 4; bc++) {
        let sum = 0;
        for (let r = 0; r < 4; r++) {
          for (let c = 0; c < 4; c++) {
            sum += currentInputGrid[(br * 4 + r) * 16 + (bc * 4 + c)] ?? 0;
          }
        }
        blocks.push(sum / 16);
      }
    }
    return blocks;
  }, [currentInputGrid]);

  // Precompute visible node coordinates & pruned connections
  const layout = useMemo(() => {
    const width = 920;
    const height = 480;

    if (networkView === 'mnist784') {
      const res784 = mnist784Result ?? infer784(mnist784Pixels);
      const slices = getMnist784WeightSlices();

      // Pool 28x28 into 4x4 spatial blocks (7x7 px per block)
      const blocks784: number[] = [];
      for (let br = 0; br < 4; br++) {
        for (let bc = 0; bc < 4; bc++) {
          let sum = 0;
          for (let r = 0; r < 7; r++) {
            for (let c = 0; c < 7; c++) {
              sum += mnist784Pixels[(br * 7 + r) * 28 + (bc * 7 + c)] ?? 0;
            }
          }
          blocks784.push(sum / 49);
        }
      }

      // First 16 hidden neurons from the 128 ReLU layer
      const hiddenIndices = Array.from({ length: 16 }, (_, j) => j);
      const layerConfigs = [
        {
          title: 'Entrada 28×28 (4×4 bloques)',
          values: blocks784,
          zValues: blocks784,
          biases: blocks784.map(() => 0),
          labels: blocks784.map((_, i) => `B${i + 1}`),
        },
        {
          title: 'Oculta (128 ReLU · N0–15)',
          values: hiddenIndices.map((j) => res784.a1[j] ?? 0),
          zValues: hiddenIndices.map((j) => res784.z1[j] ?? 0),
          biases: hiddenIndices.map((j) => slices.b1At(j)),
          labels: hiddenIndices.map((j) => `H${j}`),
        },
        {
          title: 'Salida Softmax (10 dígitos)',
          values: res784.probs,
          zValues: res784.z2,
          biases: Array.from({ length: 10 }, (_, k) => slices.b2At(k)),
          labels: Array.from({ length: 10 }, (_, k) => String(k)),
        },
      ];

      const xPositions = [130, 460, 790];
      const nodesByLayer: NodeCoord[][] = layerConfigs.map((cfg, lIdx) => {
        const count = cfg.values.length;
        const topPad = 56;
        const bottomPad = 34;
        const availH = height - topPad - bottomPad;
        const step = count > 1 ? availH / (count - 1) : 0;
        const maxVal = Math.max(1e-6, ...cfg.values.map(Math.abs));
        return cfg.values.map((val, nIdx) => ({
          layerIdx: lIdx,
          nodeIdx: nIdx,
          x: xPositions[lIdx],
          y: count === 1 ? height / 2 : topPad + nIdx * step,
          activation: lIdx === 2 ? val : Math.min(1, val / maxVal),
          zValue: cfg.zValues[nIdx],
          label: cfg.labels[nIdx],
        }));
      });

      interface Edge {
        from: NodeCoord;
        to: NodeCoord;
        weight: number;
        signal: number;
      }
      const edges: Edge[] = [];
      for (let l = 0; l < 2; l++) {
        const srcNodes = nodesByLayer[l];
        const dstNodes = nodesByLayer[l + 1];
        for (const dst of dstNodes) {
          const candidates: Edge[] = srcNodes.map((src) => {
            let w = 0;
            if (l === 0) {
              const br = Math.floor(src.nodeIdx / 4);
              const bc = src.nodeIdx % 4;
              let sumW = 0;
              for (let r = 0; r < 7; r++) {
                for (let c = 0; c < 7; c++) {
                  sumW += slices.w1At((br * 7 + r) * 28 + (bc * 7 + c), dst.nodeIdx);
                }
              }
              w = sumW / 49;
            } else {
              w = slices.w2At(src.nodeIdx, dst.nodeIdx);
            }
            return {
              from: src,
              to: dst,
              weight: w,
              signal: Math.abs(w) * (0.2 + src.activation),
            };
          });
          candidates.sort((a, b) => b.signal - a.signal);
          edges.push(...candidates.slice(0, topKPerNode));
        }
      }

      return { width, height, layerConfigs, nodesByLayer, edges, outputLayerIdx: 2 };
    }

    const snaps = forwardData.snapshots;

    const layerConfigs = [
      {
        title: 'Entrada (4×4 bloques)',
        values: pooledInput,
        zValues: pooledInput,
        biases: pooledInput.map(() => 0),
        labels: pooledInput.map((_, i) => `B${i + 1}`),
      },
      {
        title: `Oculta 1 (${snaps[1].size} ReLU)`,
        values: snaps[1].aValues.slice(0, 16),
        zValues: snaps[1].zValues.slice(0, 16),
        biases: snaps[1].aValues.slice(0, 16).map((_, i) => activeModel.layers[0]?.b[i] ?? 0),
        labels: snaps[1].aValues.slice(0, 16).map((_, i) => `H1.${i + 1}`),
      },
      {
        title: `Oculta 2 (${snaps[2].size} ReLU)`,
        values: snaps[2].aValues.slice(0, 14),
        zValues: snaps[2].zValues.slice(0, 14),
        biases: snaps[2].aValues.slice(0, 14).map((_, i) => activeModel.layers[1]?.b[i] ?? 0),
        labels: snaps[2].aValues.slice(0, 14).map((_, i) => `H2.${i + 1}`),
      },
      {
        title: `Salida Softmax (${activeModel.labels.length})`,
        values: snaps[3].aValues.slice(0, 18),
        zValues: snaps[3].zValues.slice(0, 18),
        biases: snaps[3].aValues.slice(0, 18).map((_, i) => activeModel.layers[2]?.b[i] ?? 0),
        labels: activeModel.labels.slice(0, 18),
      },
    ];

    const xPositions = [110, 355, 600, 825];
    const nodesByLayer: NodeCoord[][] = layerConfigs.map((cfg, lIdx) => {
      const count = cfg.values.length;
      const topPad = 56;
      const bottomPad = 34;
      const availH = height - topPad - bottomPad;
      const step = count > 1 ? availH / (count - 1) : 0;
      const maxVal = Math.max(1e-6, ...cfg.values.map(Math.abs));

      return cfg.values.map((val, nIdx) => ({
        layerIdx: lIdx,
        nodeIdx: nIdx,
        x: xPositions[lIdx],
        y: count === 1 ? height / 2 : topPad + nIdx * step,
        activation: lIdx === 3 ? val : Math.min(1, val / maxVal),
        zValue: cfg.zValues[nIdx],
        label: cfg.labels[nIdx],
      }));
    });

    // Build pruned top-K edges between adjacent rendered layers using real model weights
    interface Edge {
      from: NodeCoord;
      to: NodeCoord;
      weight: number;
      signal: number;
    }
    const edges: Edge[] = [];
    for (let l = 0; l < 3; l++) {
      const srcNodes = nodesByLayer[l];
      const dstNodes = nodesByLayer[l + 1];
      const weightMatrix = activeModel.layers[l]?.W;

      for (const dst of dstNodes) {
        const candidates: Edge[] = srcNodes.map((src) => {
          let w = 0;
          if (l === 0 && weightMatrix) {
            // Average 4x4 block incoming weights to hidden neuron dst.nodeIdx
            const blockRow = Math.floor(src.nodeIdx / 4);
            const blockCol = src.nodeIdx % 4;
            let sumW = 0;
            for (let r = 0; r < 4; r++) {
              for (let c = 0; c < 4; c++) {
                sumW += weightMatrix[dst.nodeIdx][(blockRow * 4 + r) * 16 + (blockCol * 4 + c)] ?? 0;
              }
            }
            w = sumW / 16;
          } else if (weightMatrix) {
            w = weightMatrix[dst.nodeIdx]?.[src.nodeIdx] ?? 0;
          }
          return {
            from: src,
            to: dst,
            weight: w,
            signal: Math.abs(w) * (0.2 + src.activation),
          };
        });

        candidates.sort((a, b) => b.signal - a.signal);
        edges.push(...candidates.slice(0, topKPerNode));
      }
    }

    return { width, height, layerConfigs, nodesByLayer, edges, outputLayerIdx: 3 };
  }, [activeModel, forwardData, pooledInput, topKPerNode, networkView, mnist784Pixels, mnist784Result]);

  // Efficient requestAnimationFrame canvas loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = layout.width * dpr;
    canvas.height = layout.height * dpr;

    const accentPrimary = palette.accentPrimary;
    const accentSecondary = palette.accentSecondary;
    const textPrimary = palette.textPrimary;
    const textMuted = palette.textMuted;
    const bgElevated = palette.bgElevated;
    const borderHairline = palette.borderHairline;

    let rafId = 0;
    const startTime = performance.now();

    const drawFrame = (now: number) => {
      const elapsed = (now - startTime) / 1000;
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, layout.width, layout.height);

      // Subtle layer column bands
      layout.layerConfigs.forEach((cfg, idx) => {
        const x = layout.nodesByLayer[idx][0]?.x ?? 100;
        ctx.fillStyle = bgElevated;
        ctx.globalAlpha = 0.28;
        ctx.beginPath();
        ctx.roundRect(x - 54, 34, 108, layout.height - 46, 12);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = borderHairline;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = textMuted;
        ctx.textAlign = 'center';
        ctx.fillText(cfg.title, x, 22);
      });

      // Connections (cubic Bezier curves for clean neural topology)
      for (let i = 0; i < layout.edges.length; i++) {
        const edge = layout.edges[i];
        const isConnectedToSelected =
          (selectedNode &&
            ((selectedNode.layerIdx === edge.from.layerIdx && selectedNode.nodeIdx === edge.from.nodeIdx) ||
              (selectedNode.layerIdx === edge.to.layerIdx && selectedNode.nodeIdx === edge.to.nodeIdx))) ||
          (hoveredNode &&
            ((hoveredNode.layerIdx === edge.from.layerIdx && hoveredNode.nodeIdx === edge.from.nodeIdx) ||
              (hoveredNode.layerIdx === edge.to.layerIdx && hoveredNode.nodeIdx === edge.to.nodeIdx)));

        const baseAlpha = Math.min(0.75, 0.14 + edge.signal * 0.85);
        const alpha = selectedNode || hoveredNode ? (isConnectedToSelected ? 0.92 : 0.09) : baseAlpha;
        ctx.strokeStyle = edge.weight >= 0 ? accentSecondary : accentPrimary;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = isConnectedToSelected
          ? Math.min(3.0, 1.0 + Math.abs(edge.weight) * 1.6)
          : Math.min(2.2, 0.6 + Math.abs(edge.weight) * 1.25);

        const midX = (edge.from.x + edge.to.x) / 2;
        ctx.beginPath();
        ctx.moveTo(edge.from.x, edge.from.y);
        ctx.bezierCurveTo(midX, edge.from.y, midX, edge.to.y, edge.to.x, edge.to.y);
        ctx.stroke();

        if (animatePulse && edge.from.activation > 0.12 && (!selectedNode || isConnectedToSelected)) {
          const t = (elapsed * 0.6 + (i % 7) * 0.14) % 1;
          const u = 1 - t;
          const px =
            u * u * u * edge.from.x +
            3 * u * u * t * midX +
            3 * u * t * t * midX +
            t * t * t * edge.to.x;
          const py =
            u * u * u * edge.from.y +
            3 * u * u * t * edge.from.y +
            3 * u * t * t * edge.to.y +
            t * t * t * edge.to.y;
          ctx.globalAlpha = Math.min(0.95, 0.45 + edge.from.activation * 0.55);
          ctx.fillStyle = edge.weight >= 0 ? accentSecondary : accentPrimary;
          ctx.beginPath();
          ctx.arc(px, py, 2.3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.globalAlpha = 1;

      // Nodes
      for (const layerNodes of layout.nodesByLayer) {
        for (const node of layerNodes) {
          const isSelected =
            selectedNode?.layerIdx === node.layerIdx && selectedNode?.nodeIdx === node.nodeIdx;
          const isHovered =
            hoveredNode?.layerIdx === node.layerIdx && hoveredNode?.nodeIdx === node.nodeIdx;
          const radius = node.layerIdx === layout.outputLayerIdx ? 9.5 : 8;

          if (node.activation > 0.35 || isSelected || isHovered) {
            ctx.save();
            ctx.shadowColor = node.layerIdx === layout.outputLayerIdx ? accentPrimary : accentSecondary;
            ctx.shadowBlur = isSelected || isHovered ? 14 : 8;
            ctx.fillStyle = bgElevated;
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          } else {
            ctx.fillStyle = bgElevated;
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
            ctx.fill();
          }

          if (node.activation > 0.03) {
            ctx.fillStyle = node.layerIdx === layout.outputLayerIdx ? accentPrimary : accentSecondary;
            ctx.globalAlpha = Math.min(1, 0.22 + node.activation * 0.85);
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius - 1.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
          }

          ctx.strokeStyle = isSelected || isHovered ? textPrimary : accentPrimary;
          ctx.lineWidth = isSelected || isHovered ? 2.5 : 1.25;
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
          ctx.stroke();

          if (node.layerIdx === layout.outputLayerIdx && node.label) {
            ctx.font = '600 11px "JetBrains Mono", monospace';
            ctx.fillStyle = textPrimary;
            ctx.textAlign = 'left';
            ctx.fillText(
              `${node.label}  ${(node.activation * 100).toFixed(1)}%`,
              node.x + 15,
              node.y + 4
            );
          }
        }
      }

      ctx.restore();
      if (animatePulse) {
        rafId = requestAnimationFrame(drawFrame);
      }
    };

    rafId = requestAnimationFrame(drawFrame);
    return () => cancelAnimationFrame(rafId);
  }, [layout, animatePulse, selectedNode, hoveredNode, theme, palette]);

  const findClosestNode = (e: React.MouseEvent<HTMLCanvasElement>): NodeCoord | null => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * layout.width;
    const y = ((e.clientY - rect.top) / rect.height) * layout.height;

    let closest: NodeCoord | null = null;
    let minD = 18;
    for (const layer of layout.nodesByLayer) {
      for (const n of layer) {
        const d = Math.hypot(n.x - x, n.y - y);
        if (d < minD) {
          minD = d;
          closest = n;
        }
      }
    }
    return closest;
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const closest = findClosestNode(e);
    if (closest) {
      setSelectedNode({ layerIdx: closest.layerIdx, nodeIdx: closest.nodeIdx });
    }
  };

  const handleCanvasMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const closest = findClosestNode(e);
    setHoveredNode(closest);
  };

  const handleExportTopology = async () => {
    const ok = await exportContainerAsPng(
      canvasBoxRef.current,
      `vectoria_topologia_${networkView}`,
      'VectorIA Studio — Neural Topology'
    );
    if (ok) {
      setExportedPng(true);
      setTimeout(() => setExportedPng(false), 1800);
    }
  };

  const inspectedNode = useMemo(() => {
    if (!selectedNode) return null;
    return layout.nodesByLayer[selectedNode.layerIdx]?.[selectedNode.nodeIdx] ?? null;
  }, [layout, selectedNode]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            Neural Topology
          </h1>
          <p className="text-xs text-[var(--text-muted)]">
            Arquitectura activa:{' '}
            {networkView === 'mnist784'
              ? '784 → 128 (ReLU) → 10 (Softmax) · Modelo Original'
              : activeModel.getArchitectureString()}{' '}
            · Poda visual de conexiones Top-{topKPerNode} por neurona.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-1 p-1 rounded-xl surface-elevated text-xs">
            <button
              type="button"
              onClick={() => {
                setSelectedNode(null);
                setNetworkView('vectoria16');
              }}
              className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer whitespace-nowrap ${
                networkView === 'vectoria16'
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              16×16 VectorIA
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedNode(null);
                setNetworkView('mnist784');
              }}
              className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer whitespace-nowrap ${
                networkView === 'mnist784'
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              784–128–10 (Original)
            </button>
          </div>
          <div className="inline-flex items-center gap-1 p-1 rounded-xl surface-elevated text-xs">
            <button
              type="button"
              onClick={() => setRenderMode('2d')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium cursor-pointer whitespace-nowrap ${
                renderMode === '2d'
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Vista 2D (Canvas)
            </button>
            <button
              type="button"
              onClick={() => setRenderMode('3d')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium cursor-pointer whitespace-nowrap ${
                renderMode === '3d'
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              Vista 3D (WebGL)
            </button>
          </div>
          <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] surface-elevated px-3 py-1.5 rounded-lg">
            <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span>Conexiones/nodo: {topKPerNode}</span>
            <input
              type="range"
              min={1}
              max={8}
              value={topKPerNode}
              onChange={(e) => setTopKPerNode(Number(e.target.value))}
              className="w-20 accent-[var(--accent-primary)]"
            />
          </label>
          {renderMode === '2d' && (
            <button
              type="button"
              onClick={handleExportTopology}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border-hairline)] surface-elevated text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer whitespace-nowrap"
            >
              {exportedPng ? <Check className="w-3.5 h-3.5 text-[var(--status-ok)]" /> : <Download className="w-3.5 h-3.5" />}
              PNG
            </button>
          )}
          <button
            type="button"
            onClick={() => setAnimatePulse((p) => !p)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--accent-primary)] text-[var(--accent-contrast)] cursor-pointer whitespace-nowrap"
          >
            {animatePulse ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {animatePulse ? 'Pausar pulsos' : 'Animar flujo'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-9 surface-card rounded-2xl p-4 overflow-x-auto">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 text-[11px] text-[var(--text-muted)]">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: palette.accentSecondary }} />
                Peso excitador (w &ge; 0)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: palette.accentPrimary }} />
                Peso inhibidor (w &lt; 0)
              </span>
            </div>
            <span className="font-mono tabular-nums text-[var(--text-primary)]">
              {hoveredNode
                ? `Hover ${hoveredNode.label}: Z = ${hoveredNode.zValue.toFixed(4)} · A = ${hoveredNode.activation.toFixed(4)}`
                : 'Pasa el cursor o haz clic en una neurona'}
            </span>
          </div>
          {renderMode === '2d' ? (
            <div ref={canvasBoxRef}>
              <canvas
                ref={canvasRef}
                onClick={handleCanvasClick}
                onPointerMove={handleCanvasMove}
                onPointerLeave={() => setHoveredNode(null)}
                className="w-full min-w-[700px] h-auto cursor-pointer"
                style={{ aspectRatio: `${layout.width} / ${layout.height}` }}
              />
            </div>
          ) : (
            <ModuleErrorBoundary
              moduleName="Topología Neuronal 3D (WebGL)"
              onReturnHome={() => setRenderMode('2d')}
            >
              <Suspense
                fallback={
                  <div className="h-[460px] rounded-xl surface-elevated flex items-center justify-center text-xs text-[var(--text-muted)]">
                    Inicializando escena WebGL 3D...
                  </div>
                }
              >
                <NeuralTopology3DCanvas
                  layerConfigs={layout.layerConfigs}
                  nodesByLayer={layout.nodesByLayer}
                  edges={layout.edges}
                  selectedNode={selectedNode}
                  animatePulse={animatePulse}
                  accentPrimary={palette.accentPrimary}
                  accentSecondary={palette.accentSecondary}
                  bgSurface={palette.bgSurface}
                  onSelectNode={setSelectedNode}
                  onHoverNode={setHoveredNode}
                />
              </Suspense>
            </ModuleErrorBoundary>
          )}
          <div className="mt-3 pt-3 border-t border-[var(--border-hairline)] flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--text-muted)]">
            <span>Haz clic en cualquier neurona para fijar Z = WX+b y A en el inspector lateral.</span>
            <div className="flex items-center gap-2">
              <span>Probar entrada:</span>
              {networkView === 'mnist784'
                ? [0, 1, 3, 7, 8].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => loadMnist784Example(d)}
                      className="px-2 py-1 rounded bg-[var(--bg-elevated)] hover:border-[var(--accent-primary)] border border-[var(--border-hairline)] font-mono text-[var(--text-primary)] cursor-pointer"
                    >
                      {d}
                    </button>
                  ))
                : ['0', '3', '7', 'A', 'O'].map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => loadSampleGlyph(g, /^[0-9]$/.test(g) ? 'digits' : 'letters')}
                      className="px-2 py-1 rounded bg-[var(--bg-elevated)] hover:border-[var(--accent-primary)] border border-[var(--border-hairline)] font-mono text-[var(--text-primary)] cursor-pointer"
                    >
                      {g}
                    </button>
                  ))}
            </div>
          </div>
        </div>

        <div className="xl:col-span-3 space-y-4">
          <div className="surface-card rounded-2xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Inspector Neuronal
            </h2>
            {inspectedNode ? (
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Neurona</span>
                  <span className="font-mono font-semibold text-[var(--text-primary)]">
                    {inspectedNode.label}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Capa</span>
                  <span className="text-[var(--text-secondary)]">
                    {layout.layerConfigs[inspectedNode.layerIdx].title}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Preactivación Z</span>
                  <span className="font-mono tabular-nums text-[var(--text-primary)]">
                    {inspectedNode.zValue.toFixed(4)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Activación A</span>
                  <span className="font-mono tabular-nums text-[var(--accent-primary)]">
                    {inspectedNode.activation.toFixed(4)}
                  </span>
                </div>
                {inspectedNode.layerIdx > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Sesgo b</span>
                    <span className="font-mono tabular-nums text-[var(--text-secondary)]">
                      {(
                        layout.layerConfigs[inspectedNode.layerIdx]?.biases[inspectedNode.nodeIdx] ?? 0
                      ).toFixed(4)}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                Selecciona cualquier nodo en el diagrama para ver su valor preactivación Z = WX + b, su activación ReLU/Softmax y su sesgo real.
              </p>
            )}
          </div>

          <div className="surface-card rounded-2xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Salida Dominante Actual
            </h2>
            {networkView === 'mnist784' && mnist784Result ? (
              <div className="space-y-2 text-xs">
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-2xl font-bold text-[var(--accent-primary)]">
                    {mnist784Result.digit}
                  </span>
                  <span className="font-mono tabular-nums text-sm font-semibold text-[var(--text-primary)]">
                    {(mnist784Result.confidence * 100).toFixed(2)}%
                  </span>
                </div>
                <div className="text-[var(--text-muted)]">
                  Red 784–128–10 · {mnist784Result.activeNeurons}/128 neuronas ReLU activas.
                </div>
              </div>
            ) : lastPrediction ? (
              <div className="space-y-2 text-xs">
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-2xl font-bold text-[var(--accent-primary)]">
                    {lastPrediction.topLabel}
                  </span>
                  <span className="font-mono tabular-nums text-sm font-semibold text-[var(--text-primary)]">
                    {(lastPrediction.confidence * 100).toFixed(2)}%
                  </span>
                </div>
                <div className="text-[var(--text-muted)]">
                  Mostrando primeras {Math.min(18, activeModel.labels.length)} neuronas de salida del modelo activo.
                </div>
              </div>
            ) : (
              <p className="text-xs text-[var(--text-muted)]">Dibuja o selecciona un carácter.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
