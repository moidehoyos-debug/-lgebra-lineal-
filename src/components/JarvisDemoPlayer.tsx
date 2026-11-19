import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Film,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  buildJarvisDemoSequence,
  JarvisDemoFrame,
  JarvisDemoKind,
  JarvisDemoSequence,
} from '../engines/jarvisDemoEngine';
import { NeuralSuite } from '../engines/neuralEngine';
import { PredictionRecord } from '../types/vectoria';

interface JarvisDemoPlayerProps {
  demoKind: JarvisDemoKind;
  onChangeKind: (kind: JarvisDemoKind) => void;
  suite: NeuralSuite | null;
  lastPrediction: PredictionRecord | null;
}

const DEMO_OPTIONS: Array<{ id: JarvisDemoKind; label: string }> = [
  { id: 'neural-learning', label: 'Aprendizaje Backprop (2–3–2)' },
  { id: 'smart-irrigation', label: 'Riego Inteligente (2–4–1)' },
  { id: 'prediction-explain', label: 'Explicar Predicción (16×16)' },
  { id: 'before-after', label: 'Comparar Antes vs Después' },
  { id: 'matrix-multiply', label: 'Multiplicación Matricial' },
];

function readThemePalette() {
  if (typeof window === 'undefined') {
    return {
      bg: '#101018',
      card: '#181824',
      text: '#f4f4f5',
      muted: '#a1a1aa',
      primary: '#8b5cf6',
      secondary: '#22d3ee',
      ok: '#10b981',
      warn: '#f59e0b',
      err: '#ef4444',
      border: '#27273a',
    };
  }
  const styles = getComputedStyle(document.documentElement);
  const g = (v: string, fb: string) => styles.getPropertyValue(v).trim() || fb;
  return {
    bg: g('--bg-elevated', '#101018'),
    card: g('--bg-surface', '#181824'),
    text: g('--text-primary', '#f4f4f5'),
    muted: g('--text-muted', '#a1a1aa'),
    primary: g('--accent-primary', '#8b5cf6'),
    secondary: g('--accent-secondary', '#22d3ee'),
    ok: g('--status-ok', '#10b981'),
    warn: g('--status-warn', '#f59e0b'),
    err: g('--status-err', '#ef4444'),
    border: g('--border-hairline', '#27273a'),
  };
}

function drawJarvisFrameOnCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  frame: JarvisDemoFrame,
  seqTitle: string
) {
  const pal = readThemePalette();
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, width, height);

  // Subtle grid background
  ctx.strokeStyle = pal.border;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.35;
  for (let x = 0; x < width; x += 36) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += 36) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Header strip
  ctx.fillStyle = pal.card;
  ctx.fillRect(0, 0, width, 40);
  ctx.strokeStyle = pal.border;
  ctx.beginPath();
  ctx.moveTo(0, 40);
  ctx.lineTo(width, 40);
  ctx.stroke();

  ctx.fillStyle = pal.text;
  ctx.font = 'bold 13px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(`${seqTitle}  ·  ${frame.title}`, 16, 25);

  const hasCurve = frame.curvePoints.length > 0;
  const graphWidth = hasCurve ? Math.round(width * 0.66) : width;
  const layers = [0, 1, 2];
  const nodePos = new Map<string, { x: number; y: number }>();

  layers.forEach((layerIdx) => {
    const layerNodes = frame.nodes.filter((n) => n.layer === layerIdx);
    const x = 90 + (layerIdx * (graphWidth - 180)) / 2;
    const usableH = height - 115;
    layerNodes.forEach((node, idx) => {
      const y = 62 + ((idx + 0.5) * usableH) / Math.max(1, layerNodes.length);
      nodePos.set(node.id, { x, y });
    });
  });

  // Draw edges
  for (const edge of frame.edges) {
    const p1 = nodePos.get(edge.fromId);
    const p2 = nodePos.get(edge.toId);
    if (!p1 || !p2) continue;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    const isBack = edge.direction === 'backward';
    ctx.strokeStyle = isBack
      ? pal.warn
      : edge.weight >= 0
        ? pal.primary
        : pal.err;
    ctx.globalAlpha = edge.highlighted ? 0.9 : 0.28;
    ctx.lineWidth = edge.highlighted ? Math.min(4.2, 1.4 + Math.abs(edge.weight) * 1.8) : 1.1;
    if (isBack) {
      ctx.setLineDash([6, 4]);
    }
    ctx.stroke();

    if (edge.highlighted) {
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2 - 4;
      ctx.globalAlpha = 0.88;
      ctx.fillStyle = pal.text;
      ctx.font = '10px "JetBrains Mono", monospace';
      const wLabel =
        edge.deltaWeight !== undefined
          ? `w=${edge.weight.toFixed(2)} (Δ${edge.deltaWeight >= 0 ? '+' : ''}${edge.deltaWeight.toFixed(3)})`
          : `w=${edge.weight.toFixed(2)}`;
      ctx.fillText(wLabel, mx - 24, my);
    }
    ctx.restore();
  }

  // Draw nodes
  const toneColor = (tone: string) => {
    if (tone === 'ok') return pal.ok;
    if (tone === 'warn') return pal.warn;
    if (tone === 'err') return pal.err;
    if (tone === 'secondary') return pal.secondary;
    if (tone === 'primary') return pal.primary;
    return pal.muted;
  };

  for (const node of frame.nodes) {
    const pos = nodePos.get(node.id);
    if (!pos) continue;
    const radius = node.active ? 22 : 17;
    const c = toneColor(node.tone);

    ctx.save();
    if (node.active) {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius + 6, 0, Math.PI * 2);
      ctx.fillStyle = c;
      ctx.globalAlpha = 0.16;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = pal.card;
    ctx.globalAlpha = 1;
    ctx.fill();
    ctx.lineWidth = node.active ? 2.5 : 1.4;
    ctx.strokeStyle = c;
    ctx.stroke();

    ctx.fillStyle = pal.text;
    ctx.font = 'bold 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(node.label, pos.x, pos.y - 2);
    ctx.fillStyle = c;
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillText(node.valueText, pos.x, pos.y + 12);
    ctx.restore();
  }

  // Optional live learning curve panel on right
  if (hasCurve) {
    const px = graphWidth + 8;
    const pw = width - graphWidth - 22;
    const py = 58;
    const ph = height - 118;
    ctx.fillStyle = pal.card;
    ctx.strokeStyle = pal.border;
    ctx.lineWidth = 1;
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeRect(px, py, pw, ph);

    ctx.fillStyle = pal.text;
    ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('Curva Real de Aprendizaje (Loss)', px + 10, py + 18);

    const pts = frame.curvePoints;
    if (pts.length >= 1) {
      const maxLoss = Math.max(0.5, ...pts.map((p) => p.loss));
      const minX = px + 16;
      const maxX = px + pw - 16;
      const minY = py + 34;
      const maxY = py + ph - 24;

      ctx.beginPath();
      pts.forEach((pt, idx) => {
        const cx =
          pts.length === 1
            ? (minX + maxX) / 2
            : minX + (idx / (pts.length - 1)) * (maxX - minX);
        const cy = maxY - (pt.loss / maxLoss) * (maxY - minY);
        if (idx === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      });
      ctx.strokeStyle = pal.primary;
      ctx.lineWidth = 2.2;
      ctx.stroke();

      pts.forEach((pt, idx) => {
        const cx =
          pts.length === 1
            ? (minX + maxX) / 2
            : minX + (idx / (pts.length - 1)) * (maxX - minX);
        const cy = maxY - (pt.loss / maxLoss) * (maxY - minY);
        ctx.beginPath();
        ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = pal.secondary;
        ctx.fill();
      });

      const lastPt = pts[pts.length - 1];
      ctx.fillStyle = pal.muted;
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText(
        `Paso ${lastPt.step}: Loss=${lastPt.loss.toFixed(4)} | Acc=${lastPt.accuracyPct.toFixed(1)}%`,
        px + 10,
        py + ph - 8
      );
    }
  }

  // Synchronized bottom subtitle strip
  ctx.fillStyle = pal.card;
  ctx.fillRect(0, height - 46, width, 46);
  ctx.strokeStyle = pal.border;
  ctx.beginPath();
  ctx.moveTo(0, height - 46);
  ctx.lineTo(width, height - 46);
  ctx.stroke();

  ctx.fillStyle = pal.text;
  ctx.font = '12px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(frame.subtitle.slice(0, 118), 16, height - 19);
}

export const JarvisDemoPlayer: React.FC<JarvisDemoPlayerProps> = ({
  demoKind,
  onChangeKind,
  suite,
  lastPrediction,
}) => {
  const sequence: JarvisDemoSequence = useMemo(
    () => buildJarvisDemoSequence(demoKind, { suite, lastPrediction }),
    [demoKind, suite, lastPrediction]
  );

  const [stepIdx, setStepIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<0.5 | 1 | 1.5>(1);
  const [depth, setDepth] = useState<'basic' | 'advanced'>('basic');
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'ready' | 'unsupported'>('idle');
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [recordError, setRecordError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const currentFrame = sequence.frames[Math.min(stepIdx, sequence.frames.length - 1)];

  useEffect(() => {
    setStepIdx(0);
    setIsPlaying(false);
  }, [demoKind]);

  // Draw active frame on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentFrame) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawJarvisFrameOnCanvas(ctx, canvas.width, canvas.height, currentFrame, sequence.title);
  }, [currentFrame, sequence.title]);

  // Optional Web Speech API narration synchronized with active frame
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    if (!voiceEnabled || !currentFrame) return;
    const text =
      depth === 'advanced' ? currentFrame.narrativeAdvanced : currentFrame.narrativeBasic;
    const utter = new SpeechSynthesisUtterance(`${currentFrame.title}. ${text}`);
    utter.lang = 'es-MX';
    utter.rate = speed;
    window.speechSynthesis.speak(utter);
    return () => {
      window.speechSynthesis.cancel();
    };
  }, [voiceEnabled, currentFrame, depth, speed]);

  // Playback timer
  useEffect(() => {
    if (!isPlaying) return;
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const baseMs = prefersReduced ? 3600 : 2800;
    const timer = window.setTimeout(() => {
      setStepIdx((prev) => {
        if (prev + 1 >= sequence.frames.length) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, baseMs / speed);
    return () => window.clearTimeout(timer);
  }, [isPlaying, stepIdx, speed, sequence.frames.length]);

  const handleRecordWebm = useCallback(async () => {
    setRecordError(null);
    const canvas = canvasRef.current;
    if (
      !canvas ||
      typeof MediaRecorder === 'undefined' ||
      typeof canvas.captureStream !== 'function'
    ) {
      setRecordingState('unsupported');
      setRecordError('MediaRecorder / captureStream no está disponible en este navegador.');
      return;
    }

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : '';

    if (!mimeType) {
      setRecordingState('unsupported');
      setRecordError('El navegador no soporta codificación WebM.');
      return;
    }

    try {
      setIsPlaying(false);
      setRecordingState('recording');
      if (recordedVideoUrl) {
        URL.revokeObjectURL(recordedVideoUrl);
        setRecordedVideoUrl(null);
      }

      const stream = canvas.captureStream(24);
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunks.push(ev.data);
      };

      const done = new Promise<Blob>((resolve) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
      });

      recorder.start();
      const ctx = canvas.getContext('2d');
      for (let i = 0; i < sequence.frames.length; i += 1) {
        setStepIdx(i);
        if (ctx) {
          drawJarvisFrameOnCanvas(
            ctx,
            canvas.width,
            canvas.height,
            sequence.frames[i],
            sequence.title
          );
        }
        await new Promise((r) => setTimeout(r, Math.round(1400 / speed)));
      }
      recorder.stop();
      const blob = await done;
      const url = URL.createObjectURL(blob);
      setRecordedVideoUrl(url);
      setRecordingState('ready');
    } catch (err) {
      setRecordingState('idle');
      setRecordError(err instanceof Error ? err.message : 'Error grabando video WebM.');
    }
  }, [recordedVideoUrl, sequence.frames, sequence.title, speed]);

  useEffect(() => {
    return () => {
      if (recordedVideoUrl) URL.revokeObjectURL(recordedVideoUrl);
    };
  }, [recordedVideoUrl]);

  return (
    <section
      aria-label="Omni Bot Modo Jarvis — Demostración Visual Guiada"
      className="surface-card rounded-2xl p-4 sm:p-5 space-y-4 border border-[var(--border-hairline)]"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-[var(--border-hairline)]">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
            <Sparkles className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
            <span>Modo Jarvis — Demostración Guiada Sincronizada</span>
          </div>
          <p className="text-[11px] text-[var(--text-muted)]">
            {sequence.summary} · Fuente: <span className="font-mono">{sequence.sourceVerified}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Seleccionar demostración visual"
            value={demoKind}
            onChange={(e) => onChangeKind(e.target.value as JarvisDemoKind)}
            className="px-2.5 py-1.5 rounded-lg text-xs surface-elevated border border-[var(--border-hairline)] text-[var(--text-primary)]"
          >
            {DEMO_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setDepth((d) => (d === 'basic' ? 'advanced' : 'basic'))}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium surface-elevated border border-[var(--border-hairline)] text-[var(--text-secondary)] cursor-pointer whitespace-nowrap"
          >
            Nivel: {depth === 'basic' ? 'Básico' : 'Avanzado'}
          </button>

          <button
            type="button"
            onClick={() => setVoiceEnabled((v) => !v)}
            aria-label={voiceEnabled ? 'Desactivar narración por voz' : 'Activar narración por voz'}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border cursor-pointer whitespace-nowrap ${
              voiceEnabled
                ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                : 'surface-elevated border-[var(--border-hairline)] text-[var(--text-secondary)]'
            }`}
          >
            {voiceEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            Voz {voiceEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Synchronized Visual Canvas */}
      <div className="rounded-xl overflow-hidden border border-[var(--border-hairline)] bg-[var(--bg-elevated)]">
        <canvas
          ref={canvasRef}
          width={860}
          height={330}
          className="w-full h-auto block"
          aria-label={`Escena paso ${stepIdx + 1} de ${sequence.frames.length}: ${currentFrame?.title ?? ''}`}
        />
      </div>

      {/* Synchronized Captions & Detailed Explanation */}
      {currentFrame && (
        <div
          aria-live="polite"
          className="surface-elevated rounded-xl p-3.5 border border-[var(--border-hairline)] space-y-2.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-bold text-[var(--text-primary)]">
              Paso {stepIdx + 1}/{sequence.frames.length}: {currentFrame.title}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
              {currentFrame.metrics.map((m) => (
                <span
                  key={m.label}
                  className="px-2 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-secondary)]"
                >
                  {m.label}: <strong className="text-[var(--text-primary)]">{m.value}</strong>
                </span>
              ))}
            </div>
          </div>

          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            {depth === 'advanced' ? currentFrame.narrativeAdvanced : currentFrame.narrativeBasic}
          </p>
        </div>
      )}

      {/* Playback & WebM Educational Video Recording Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={stepIdx === 0}
            onClick={() => {
              setIsPlaying(false);
              setStepIdx((i) => Math.max(0, i - 1));
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs surface-elevated border border-[var(--border-hairline)] disabled:opacity-40 cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Anterior
          </button>

          <button
            type="button"
            onClick={() => {
              if (!isPlaying && stepIdx >= sequence.frames.length - 1) {
                setStepIdx(0);
              }
              setIsPlaying((p) => !p);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent-primary)] text-[var(--accent-contrast)] cursor-pointer"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {isPlaying ? 'Pausar' : 'Reproducir'}
          </button>

          <button
            type="button"
            disabled={stepIdx >= sequence.frames.length - 1}
            onClick={() => {
              setIsPlaying(false);
              setStepIdx((i) => Math.min(sequence.frames.length - 1, i + 1));
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs surface-elevated border border-[var(--border-hairline)] disabled:opacity-40 cursor-pointer"
          >
            Siguiente
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => {
              setIsPlaying(false);
              setStepIdx(0);
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs surface-elevated border border-[var(--border-hairline)] cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Repetir
          </button>

          <div className="inline-flex items-center gap-1 p-0.5 rounded-lg surface-elevated border border-[var(--border-hairline)] text-[11px]">
            {([0.5, 1, 1.5] as const).map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => setSpeed(spd)}
                className={`px-2 py-1 rounded font-mono cursor-pointer ${
                  speed === spd
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                    : 'text-[var(--text-secondary)]'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={recordingState === 'recording'}
            onClick={() => void handleRecordWebm()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium surface-elevated border border-[var(--border-strong)] hover:border-[var(--accent-primary)] text-[var(--text-primary)] cursor-pointer disabled:opacity-50"
          >
            <Film className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
            {recordingState === 'recording'
              ? 'Grabando demostración (.webm)...'
              : 'Grabar Video Educativo (.webm)'}
          </button>

          {recordedVideoUrl && (
            <a
              href={recordedVideoUrl}
              download={`vectoria_jarvis_${demoKind}.webm`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--status-ok)]/15 border border-[var(--status-ok)]/40 text-[var(--status-ok)]"
            >
              <Download className="w-3.5 h-3.5" />
              Descargar Video Real (.webm)
            </a>
          )}
        </div>
      </div>

      {recordingState === 'ready' && (
        <div className="text-[11px] text-[var(--text-muted)]">
          Video grabado de demostración interactiva (cálculos reales y subtítulos sincronizados en WebM).
        </div>
      )}

      {recordError && (
        <div className="text-[11px] text-[var(--status-warn)]">{recordError}</div>
      )}
    </section>
  );
};
