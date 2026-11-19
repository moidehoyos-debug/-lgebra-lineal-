import React, { useMemo, useRef, useState } from 'react';
import {
  Activity,
  Bot,
  CornerDownLeft,
  FileText,
  History,
  Loader2,
  Network,
  RotateCcw,
  Send,
  Sliders,
  Sparkles,
  Trash2,
  Wrench,
} from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import {
  detectJarvisDemoKind,
  JarvisDemoKind,
} from '../engines/jarvisDemoEngine';
import {
  buildLocalAcademicFallback,
  tryRunLocalOmniEngine,
  WorkspaceInspectionSnapshot,
} from '../engines/omniLocalEngine';
import { OmniMessage } from '../types/vectoria';
import { geminiService, GeminiServiceError } from '../services/geminiService';
import { JarvisDemoPlayer } from './JarvisDemoPlayer';
import {
  clearOmniCommandHistoryStorage,
  loadOmniCommandHistory,
  MAX_OMNI_COMMAND_HISTORY,
  OmniCommandHistoryEntry,
  recordOmniCommand,
  saveOmniCommandHistory,
} from '../utils/omniCommandHistory';
import {
  buildOmniTechnicalReport,
  formatCalibrationAssistantMessage,
  formatReportAssistantMessage,
  OmniQuickCommandDescriptor,
  resolveOmniQuickCommands,
} from '../utils/omniQuickCommands';

const QUICK_PROMPTS = [
  'det([[3,1,2],[0,4,-1],[2,1,5]])',
  'inv([[4,7],[2,6]])',
  'solve([[2,1],[1,-1]],[5,1])',
  '¿Cuál es el estado de los modelos y última predicción 784?',
  '¿El 83% del modelo 784-128-10 es MNIST oficial o sintético?',
  'Explica Z = WX + b, ReLU, Softmax y Backpropagation',
];

export const OmniBotView: React.FC = () => {
  const {
    activeModule,
    setActiveModule,
    classifierMode,
    digitsSummary,
    lettersSummary,
    alphanumericSummary,
    lastPrediction,
    predictionHistory,
    simulationHistory,
    reportHistory,
    mnist784Result,
    last232Step,
    lastMathOutput,
    omniMessages,
    addOmniMessage,
    clearOmniMessages,
    retrainMode,
    trainingProgress,
    suiteRef,
    addReportRecord,
    logEvent,
  } = useStudio();

  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [commandHistory, setCommandHistory] = useState<OmniCommandHistoryEntry[]>(() =>
    loadOmniCommandHistory()
  );
  const [showHistoryPanel, setShowHistoryPanel] = useState(true);
  const [showJarvisMode, setShowJarvisMode] = useState(false);
  const [jarvisKind, setJarvisKind] = useState<JarvisDemoKind>('neural-learning');
  const [historyCursor, setHistoryCursor] = useState<number | null>(null);
  const listEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const buildSnapshot = (): WorkspaceInspectionSnapshot => ({
    activeModule,
    digitsSummary,
    lettersSummary,
    alphanumericSummary,
    lastPrediction,
    mnist784Result,
    last232Step,
    lastMathOperation: lastMathOutput
      ? {
          operation: lastMathOutput.operation,
          resultLabel: lastMathOutput.resultLabel,
          verification: lastMathOutput.verification.statement,
        }
      : null,
  });

  const handleSend = async (promptOverride?: string) => {
    const text = (promptOverride ?? input).trim();
    if (!text || isProcessing) return;

    setCommandHistory((prev) => {
      const next = recordOmniCommand(prev, text, MAX_OMNI_COMMAND_HISTORY);
      saveOmniCommandHistory(next);
      return next;
    });
    setHistoryCursor(null);

    const userMsg: OmniMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
      source: 'local-knowledge',
    };
    addOmniMessage(userMsg);
    if (!promptOverride) setInput('');
    setIsProcessing(true);

    const snapshot = buildSnapshot();

    // 0. Check if the user requested an interactive Jarvis visual demonstration
    const detectedJarvis = detectJarvisDemoKind(text);
    if (detectedJarvis) {
      setJarvisKind(detectedJarvis);
      setShowJarvisMode(true);
      addOmniMessage({
        id: `bot-jarvis-${Date.now()}`,
        role: 'assistant',
        content: `Modo Jarvis activado con datos reales sincronizados (${detectedJarvis}). Puedes reproducir paso a paso, ajustar la velocidad (0.5x / 1x / 1.5x), activar narración por voz y grabar un video educativo WebM arriba.`,
        timestamp: new Date().toISOString(),
        source: 'local-knowledge',
        providerLabel: 'Modo Jarvis Local (Cálculo Real Sincronizado)',
        toolTrace: ['jarvis_demo_engine', `secuencia=${detectedJarvis}`],
      });
      setIsProcessing(false);
      setTimeout(() => listEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      return;
    }

    // 1. Always try deterministic local math & workspace inspection engine first
    const localHit = tryRunLocalOmniEngine(text, snapshot);
    if (localHit) {
      addOmniMessage({
        id: `bot-${Date.now()}`,
        role: 'assistant',
        content: localHit.answer,
        timestamp: new Date().toISOString(),
        source: localHit.source,
        providerLabel:
          localHit.source === 'local-math'
            ? 'Motor Matemático Determinístico Local'
            : 'Motor Local Verificado',
        toolTrace: localHit.toolTrace,
      });
      setIsProcessing(false);
      setTimeout(() => listEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      return;
    }

    // 2. Otherwise query server-side Gemini API via GeminiService (backoff, validation & protected credentials)
    try {
      const historyPayload = [...omniMessages, userMsg].slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const data = await geminiService.chat({
        messages: historyPayload,
        logEvent,
        workspaceContext: {
          activeModule: snapshot.activeModule,
          digitsValAccuracy: snapshot.digitsSummary.valAccuracy,
          lettersValAccuracy: snapshot.lettersSummary.valAccuracy,
          alphanumericTrained: snapshot.alphanumericSummary.isTrained,
          alphanumericValAccuracy: snapshot.alphanumericSummary.valAccuracy,
          lastPrediction: snapshot.lastPrediction
            ? {
                label: snapshot.lastPrediction.topLabel,
                confidence: snapshot.lastPrediction.confidence,
                mode: snapshot.lastPrediction.mode,
                entropy: snapshot.lastPrediction.entropy,
              }
            : null,
          mnist784Result: snapshot.mnist784Result
            ? {
                digit: snapshot.mnist784Result.digit,
                confidence: snapshot.mnist784Result.confidence,
                activeNeurons: snapshot.mnist784Result.activeNeurons,
                activePixels: snapshot.mnist784Result.activePixels,
              }
            : null,
          lastMathOperation: snapshot.lastMathOperation,
        },
      });

      const formattedTools = data.toolTrace.map(
        (t) => `${t.tool}(${t.argsSummary}) → ${t.status} [${t.durationMs}ms]`
      );
      const modelLabel = data.model || 'gemini-4-hydrogen';

      addOmniMessage({
        id: `bot-${Date.now()}`,
        role: 'assistant',
        content: data.reply,
        timestamp: new Date().toISOString(),
        source: 'hybrid-gemini',
        modelUsed: modelLabel,
        providerLabel: data.fallbackModelUsed
          ? `Gemini (${modelLabel} · respaldo automático)`
          : `Gemini (${modelLabel})`,
        toolTrace: [
          `modelo=${modelLabel}`,
          ...(data.attempts > 1 ? [`intentos=${data.attempts}`] : []),
          ...formattedTools,
        ],
      });
    } catch (err) {
      // Graceful fallback to verified local academic knowledge engine
      const fallback = buildLocalAcademicFallback(text, snapshot);
      const reasonText =
        err instanceof GeminiServiceError
          ? `${err.message} (${err.code} · HTTP ${err.status})`
          : err instanceof Error && err.message
            ? err.message
            : '';
      const errNote = reasonText
        ? `[Gemini no disponible → Respuesta generada por Motor Local Verificado]\nMotivo técnico: ${reasonText}\n\n`
        : '[Gemini no disponible → Respuesta generada por Motor Local Verificado]\n\n';
      addOmniMessage({
        id: `bot-${Date.now()}`,
        role: 'assistant',
        content: errNote + fallback.answer,
        timestamp: new Date().toISOString(),
        source: 'error-fallback',
        providerLabel: 'Motor Local Verificado (Respaldo)',
        toolTrace: [...fallback.toolTrace, 'respaldo_local_verificado'],
      });
    } finally {
      setIsProcessing(false);
      setTimeout(() => listEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  };

  const handleLoadHistoryQuery = (query: string) => {
    setInput(query);
    setHistoryCursor(null);
    inputRef.current?.focus();
  };

  const handleClearCommandHistory = () => {
    setCommandHistory([]);
    setHistoryCursor(null);
    clearOmniCommandHistoryStorage();
  };

  const quickCommands = useMemo(
    () =>
      resolveOmniQuickCommands({
        classifierMode,
        digitsSummary,
        lettersSummary,
        alphanumericSummary,
        hasPrediction: Boolean(lastPrediction || mnist784Result),
        predictionCount: predictionHistory.length,
        simulationCount: simulationHistory.length,
        reportCount: reportHistory.length,
        commandHistoryCount: commandHistory.length,
        messageCount: omniMessages.length,
        isTraining: trainingProgress.isTraining,
        isProcessing,
      }),
    [
      classifierMode,
      digitsSummary,
      lettersSummary,
      alphanumericSummary,
      lastPrediction,
      mnist784Result,
      predictionHistory.length,
      simulationHistory.length,
      reportHistory.length,
      commandHistory.length,
      omniMessages.length,
      trainingProgress.isTraining,
      isProcessing,
    ]
  );

  const handleRunQuickCommand = async (cmd: OmniQuickCommandDescriptor) => {
    if (cmd.disabled) return;

    switch (cmd.id) {
      case 'calibrate-model': {
        const targetMode = cmd.targetMode ?? classifierMode;
        const epochs = cmd.epochs ?? 6;
        const suite = suiteRef.current;
        const model =
          targetMode === 'digits'
            ? suite.digitsModel
            : targetMode === 'letters'
              ? suite.lettersModel
              : suite.alphanumericModel;
        const before = model.getSummary();

        setIsProcessing(true);
        try {
          await retrainMode(targetMode, epochs, 0.005);
          const after = model.getSummary();
          logEvent(
            'neural',
            `Calibración rápida (${targetMode})`,
            `+${epochs} épocas SGD · Val ${(after.valAccuracy * 100).toFixed(2)}% · Loss ${after.finalLoss.toFixed(4)}`,
            'ok'
          );
          addOmniMessage({
            id: `cmd-cal-${Date.now()}`,
            role: 'assistant',
            content: formatCalibrationAssistantMessage({
              mode: targetMode,
              epochsAdded: epochs,
              before,
              after,
            }),
            timestamp: new Date().toISOString(),
            source: 'local-knowledge',
            toolTrace: ['comando_rapido.calibrar_modelo', `sgd_${targetMode}_${epochs}ep`],
          });
        } finally {
          setIsProcessing(false);
          setTimeout(() => listEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        }
        return;
      }

      case 'generate-report': {
        const snapshot = buildSnapshot();
        const report = buildOmniTechnicalReport(snapshot, {
          predictionCount: predictionHistory.length,
          simulationCount: simulationHistory.length,
        });
        addReportRecord(report);
        logEvent(
          'system',
          `Reporte generado desde Omni Bot: ${report.title}`,
          `${predictionHistory.length} inferencias · ${simulationHistory.length} simulaciones`,
          'ok'
        );
        addOmniMessage({
          id: `cmd-rep-${Date.now()}`,
          role: 'assistant',
          content: formatReportAssistantMessage(report),
          timestamp: new Date().toISOString(),
          source: 'local-knowledge',
          toolTrace: ['comando_rapido.generar_reporte', 'registro_informes_tecnicos'],
        });
        setTimeout(() => listEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        return;
      }

      case 'inspect-state': {
        const snapshot = buildSnapshot();
        const localRes = tryRunLocalOmniEngine(
          'estado de los modelos y última predicción',
          snapshot
        );
        if (localRes) {
          addOmniMessage({
            id: `cmd-state-${Date.now()}`,
            role: 'assistant',
            content: localRes.answer,
            timestamp: new Date().toISOString(),
            source: localRes.source,
            toolTrace: ['comando_rapido.inspeccionar_estado', ...localRes.toolTrace],
          });
          setTimeout(() => listEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        }
        return;
      }

      case 'clear-history': {
        handleClearCommandHistory();
        clearOmniMessages();
        logEvent(
          'system',
          'Historial y sesión de Omni Bot limpiados',
          'Consultas almacenadas y memoria temporal reiniciadas',
          'ok'
        );
        return;
      }

      case 'open-reports': {
        setActiveModule('reports');
        return;
      }

      case 'open-topology': {
        setActiveModule('topology');
        return;
      }
    }
  };

  const renderQuickCommandIcon = (cmd: OmniQuickCommandDescriptor) => {
    if (cmd.id === 'calibrate-model' && trainingProgress.isTraining) {
      return <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />;
    }
    switch (cmd.id) {
      case 'calibrate-model':
        return <Sliders className="w-3.5 h-3.5 shrink-0" />;
      case 'generate-report':
        return <FileText className="w-3.5 h-3.5 shrink-0" />;
      case 'inspect-state':
        return <Activity className="w-3.5 h-3.5 shrink-0" />;
      case 'clear-history':
        return <Trash2 className="w-3.5 h-3.5 shrink-0" />;
      case 'open-reports':
        return <FileText className="w-3.5 h-3.5 shrink-0" />;
      case 'open-topology':
        return <Network className="w-3.5 h-3.5 shrink-0" />;
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (commandHistory.length === 0) return;
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const nextIdx =
        historyCursor === null ? 0 : Math.min(commandHistory.length - 1, historyCursor + 1);
      setHistoryCursor(nextIdx);
      setInput(commandHistory[nextIdx].query);
    } else if (e.key === 'ArrowDown' && historyCursor !== null) {
      e.preventDefault();
      if (historyCursor === 0) {
        setHistoryCursor(null);
        setInput('');
      } else {
        const nextIdx = historyCursor - 1;
        setHistoryCursor(nextIdx);
        setInput(commandHistory[nextIdx].query);
      }
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            Omni Bot Intelligence
          </h1>
          <p className="text-xs text-[var(--text-muted)]">
            Arquitectura híbrida: cálculo matricial determinístico local + razonamiento en servidor + memoria temporal de sesión ({omniMessages.length} turnos).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start">
          <button
            type="button"
            onClick={() => setShowJarvisMode((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer whitespace-nowrap transition-colors ${
              showJarvisMode
                ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                : 'border-[var(--border-hairline)] hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Modo Jarvis {showJarvisMode ? 'Activo' : 'Visual'}
          </button>
          <button
            type="button"
            onClick={() => setShowHistoryPanel((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer whitespace-nowrap transition-colors ${
              showHistoryPanel
                ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                : 'border-[var(--border-hairline)] hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Historial ({commandHistory.length}/{MAX_OMNI_COMMAND_HISTORY})
          </button>
          <button
            type="button"
            onClick={clearOmniMessages}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border-hairline)] hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] cursor-pointer whitespace-nowrap"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Reiniciar sesión
          </button>
        </div>
      </div>

      {showJarvisMode && (
        <JarvisDemoPlayer
          demoKind={jarvisKind}
          onChangeKind={setJarvisKind}
          suite={suiteRef.current}
          lastPrediction={lastPrediction}
        />
      )}

      {/* Comandos Rápidos Contextuales */}
      <section
        aria-label="Comandos Rápidos de Omni Bot"
        className="surface-card rounded-2xl p-4 space-y-3 border border-[var(--border-hairline)]"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-0.5">
            <h2 className="text-xs font-semibold text-[var(--text-primary)]">
              Comandos Rápidos
            </h2>
            <p className="text-[11px] text-[var(--text-muted)]">
              Acciones directas sobre los motores activos, generación de reportes y gestión de sesión.
            </p>
          </div>
          {trainingProgress.isTraining && (
            <span className="text-[11px] font-mono tabular-nums text-[var(--accent-primary)]">
              Calibrando {trainingProgress.targetMode} ({trainingProgress.currentEpoch}/{trainingProgress.totalEpochs})
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-stretch gap-2.5">
          {quickCommands.map((cmd) => {
            const toneStyle =
              cmd.tone === 'primary'
                ? 'border-[var(--accent-primary)]/40 bg-[var(--accent-soft)] text-[var(--accent-primary)] hover:border-[var(--accent-primary)]'
                : cmd.tone === 'secondary'
                  ? 'border-[var(--border-strong)] surface-elevated text-[var(--text-primary)] hover:border-[var(--accent-secondary)]'
                  : cmd.tone === 'danger'
                    ? 'border-[var(--border-hairline)] surface-elevated text-[var(--text-secondary)] hover:border-[var(--status-err)] hover:text-[var(--status-err)]'
                    : 'border-[var(--border-hairline)] surface-elevated text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--text-primary)]';

            return (
              <button
                key={cmd.id}
                type="button"
                data-quick-command={cmd.id}
                disabled={cmd.disabled}
                onClick={() => void handleRunQuickCommand(cmd)}
                className={`min-h-[40px] px-3.5 py-2 rounded-xl border text-left transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-[var(--accent-primary)] flex items-center gap-2.5 ${toneStyle}`}
              >
                {renderQuickCommandIcon(cmd)}
                <div className="min-w-0">
                  <div className="text-xs font-semibold whitespace-nowrap leading-tight">
                    {cmd.label}
                  </div>
                  <div className="text-[11px] font-mono tabular-nums text-[var(--text-muted)] whitespace-nowrap leading-tight mt-0.5">
                    {cmd.contextHint}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Consultas frecuentes */}
        <div className="pt-2.5 border-t border-[var(--border-hairline)] flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-[var(--text-muted)] mr-1">
            Consultas rápidas:
          </span>
          {QUICK_PROMPTS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => handleSend(q)}
              className="px-2.5 py-1.5 rounded-lg text-xs border border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:border-[var(--accent-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              {q}
            </button>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Conversation Container */}
        <div
          className={`${
            showHistoryPanel ? 'lg:col-span-8' : 'lg:col-span-12'
          } surface-card rounded-2xl flex flex-col h-[540px]`}
        >
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {omniMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-3xl rounded-xl p-4 space-y-2 text-xs sm:text-sm ${
                    msg.role === 'user'
                      ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                      : 'surface-elevated text-[var(--text-primary)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4 text-[11px] opacity-85">
                    <span className="font-semibold flex items-center gap-1.5 flex-wrap">
                      {msg.role === 'assistant' && <Bot className="w-3.5 h-3.5" />}
                      <span>{msg.role === 'user' ? 'Tú' : 'Omni Bot'}</span>
                      {msg.role === 'assistant' && (
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)]">
                          {msg.providerLabel ??
                            (msg.source === 'hybrid-gemini'
                              ? `Gemini (${msg.modelUsed || 'gemini-4-hydrogen'})`
                              : msg.source === 'error-fallback'
                                ? 'Motor Local Verificado (Respaldo)'
                                : msg.source === 'local-math'
                                  ? 'Motor Matemático Local'
                                  : 'Motor Local Verificado')}
                        </span>
                      )}
                    </span>
                    <span className="font-mono tabular-nums shrink-0">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <pre className="whitespace-pre-wrap font-sans leading-relaxed">
                    {msg.content}
                  </pre>
                  {msg.toolTrace && msg.toolTrace.length > 0 && (
                    <div className="pt-2 border-t border-[var(--border-hairline)] flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-muted)] font-mono">
                      <Wrench className="w-3 h-3" />
                      <span>{msg.toolTrace.join(' · ')}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isProcessing && (
              <div className="flex justify-start">
                <div className="surface-elevated rounded-xl px-4 py-3 flex items-center gap-3 text-xs text-[var(--text-secondary)]">
                  <div className="flex items-center gap-1" aria-hidden="true">
                    <span className="w-2 h-2 rounded-full bg-[var(--accent-primary)] animate-bounce" />
                    <span
                      className="w-2 h-2 rounded-full bg-[var(--accent-secondary)] animate-bounce"
                      style={{ animationDelay: '120ms' }}
                    />
                    <span
                      className="w-2 h-2 rounded-full bg-[var(--accent-primary)] animate-bounce"
                      style={{ animationDelay: '240ms' }}
                    />
                  </div>
                  <span>Procesando motor matemático e inteligencia híbrida...</span>
                </div>
              </div>
            )}
            <div ref={listEndRef} />
          </div>

          {/* Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-4 border-t border-[var(--border-hairline)] flex items-center gap-3"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                if (historyCursor !== null) setHistoryCursor(null);
              }}
              onKeyDown={handleInputKeyDown}
              placeholder="Escribe una operación (ej. det([[1,2],[3,4]])) o usa ↑/↓ para navegar el historial..."
              className="flex-1 px-3.5 py-2.5 rounded-lg text-sm surface-elevated text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
            />
            <button
              type="submit"
              disabled={!input.trim() || isProcessing}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-contrast)] disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              <Send className="w-4 h-4" />
              Enviar
            </button>
          </form>
        </div>

        {/* Historial de Comandos (Últimas 10 Consultas) */}
        {showHistoryPanel && (
          <aside
            aria-label="Historial de Comandos de Omni Bot"
            className="lg:col-span-4 surface-card rounded-2xl p-4 space-y-3 border border-[var(--border-hairline)] h-[540px] flex flex-col"
          >
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--border-hairline)]">
              <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
                <History className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
                <span>Historial de Comandos (Últimas 10)</span>
              </div>
              {commandHistory.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearCommandHistory}
                  className="text-[11px] text-[var(--text-muted)] hover:text-[var(--status-err)] cursor-pointer whitespace-nowrap"
                >
                  Limpiar
                </button>
              )}
            </div>

            {commandHistory.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-3 text-xs text-[var(--text-muted)] space-y-2">
                <p>
                  Aún no has enviado consultas en Omni Bot. Las últimas 10 consultas aparecerán aquí para editarlas o reenviarlas al instante.
                </p>
                <span className="text-[11px]">
                  Tip: Usa también las teclas ↑ y ↓ en el campo de texto.
                </span>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {commandHistory.map((entry, idx) => (
                  <div
                    key={entry.id}
                    className="surface-elevated rounded-xl p-3 space-y-2 border border-[var(--border-hairline)] text-xs"
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--text-muted)] font-mono tabular-nums">
                      <span>#{idx + 1}</span>
                      <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div className="font-mono text-[11px] text-[var(--text-primary)] break-words line-clamp-3">
                      {entry.query}
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleLoadHistoryQuery(entry.query)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:border-[var(--accent-primary)] text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer whitespace-nowrap"
                      >
                        <CornerDownLeft className="w-3 h-3" />
                        Cargar
                      </button>
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => void handleSend(entry.query)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-contrast)] text-[11px] font-semibold disabled:opacity-50 cursor-pointer whitespace-nowrap"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Reenviar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
};

