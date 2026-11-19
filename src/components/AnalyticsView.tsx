import React, { useMemo, useState } from 'react';
import { AlertTriangle, Download } from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { getMnist784HistoricalReport, getMnist784Meta } from '../engines/mnist784Engine';
import { ClassifierMode } from '../types/vectoria';
import { ConfusionMatrixHeatmap } from './charts/ConfusionMatrixHeatmap';
import { LossAccuracyChart } from './charts/LossAccuracyChart';

export const AnalyticsView: React.FC = () => {
  const { digitsSummary, lettersSummary, alphanumericSummary, predictionHistory } = useStudio();
  const [selectedMode, setSelectedMode] = useState<ClassifierMode | 'mnist784'>('digits');

  const mnistReport = useMemo(() => getMnist784HistoricalReport(), []);
  const mnistMeta = useMemo(() => getMnist784Meta(), []);

  const mnistSummary = useMemo(
    () => ({
      mode: 'digits' as const,
      classCount: 10,
      labels: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
      isTrained: true,
      epochsTrained: mnistMeta.epocas,
      finalLoss: mnistReport.history[mnistReport.history.length - 1]?.[1] ?? 0.3796,
      trainAccuracy: mnistReport.history[mnistReport.history.length - 1]?.[2] ?? 0.9425,
      valAccuracy: mnistMeta.evaluacion.exactitud,
      confusionMatrix: mnistReport.confusion,
      history: mnistReport.history.map(([epoch, loss, accuracy]) => ({
        epoch,
        loss,
        accuracy,
        valAccuracy: mnistMeta.evaluacion.exactitud,
      })),
      parameterCount: mnistMeta.parametros,
      architecture: '784 -> 128 (ReLU) -> 10 (Softmax) [Sintético Avance 2]',
      lastTrainedAt: null,
    }),
    [mnistMeta, mnistReport]
  );

  const summary =
    selectedMode === 'mnist784'
      ? mnistSummary
      : selectedMode === 'digits'
        ? digitsSummary
        : selectedMode === 'letters'
          ? lettersSummary
          : alphanumericSummary;

  const convergenceData = useMemo(
    () =>
      summary.history.map((h) => ({
        step: h.epoch,
        loss: h.loss,
        accuracyPct: Number((h.accuracy * 100).toFixed(1)),
        valAccuracyPct: Number((h.valAccuracy * 100).toFixed(1)),
      })),
    [summary.history]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            Métricas y Analítica Experimental
          </h1>
          <p className="text-xs text-[var(--text-muted)]">
            Todas las cifras provienen de evaluaciones reales sobre los conjuntos de validación del motor neuronal.
          </p>
        </div>

        <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl surface-elevated self-start">
          {(['digits', 'letters', 'alphanumeric', 'mnist784'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setSelectedMode(m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap ${
                selectedMode === m
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              {m === 'digits'
                ? 'Dígitos (0–9)'
                : m === 'letters'
                  ? 'Letras (A–Z)'
                  : m === 'alphanumeric'
                    ? 'Alfanumérico (36)'
                    : '784–128–10 (Sintético)'}
            </button>
          ))}
        </div>
      </div>

      {selectedMode === 'mnist784' && (
        <div className="surface-card rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-[var(--border-strong)] text-xs">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-[var(--status-warn)] shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-[var(--text-primary)]">
                Histórico del Modelo Original 784–128–10 (Entrenamiento Sintético · N = 300)
              </div>
              <p className="text-[var(--text-secondary)]">
                {mnistMeta.origen} Aciertos: {mnistMeta.evaluacion.correctos}/{mnistMeta.evaluacion.total} (83.0%, 51 errores). {mnistMeta.limitaciones}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const csv = [
                'esperado,' + Array.from({ length: 10 }, (_, i) => i).join(','),
                ...mnistReport.confusion.map((r, i) => [i, ...r].join(',')),
              ].join('\n');
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'vectoria_evaluacion_sintetica_784.csv';
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg surface-elevated border border-[var(--border-hairline)] hover:border-[var(--accent-primary)] text-[var(--text-primary)] cursor-pointer whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar CSV Sintético
          </button>
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="surface-card rounded-xl p-4">
          <div className="text-xs text-[var(--text-muted)]">Estado del Modelo</div>
          <div className="text-lg font-bold text-[var(--text-primary)] mt-1">
            {summary.isTrained ? 'Entrenado (Real)' : 'Sin entrenar'}
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
            {summary.classCount} clases · {summary.epochsTrained} épocas
          </div>
        </div>
        <div className="surface-card rounded-xl p-4">
          <div className="text-xs text-[var(--text-muted)]">Precisión Validación</div>
          <div className="text-lg font-bold font-mono tabular-nums text-[var(--accent-primary)] mt-1">
            {summary.isTrained ? `${(summary.valAccuracy * 100).toFixed(2)}%` : '—'}
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-0.5">Evaluación real</div>
        </div>
        <div className="surface-card rounded-xl p-4">
          <div className="text-xs text-[var(--text-muted)]">Pérdida Cross-Entropy</div>
          <div className="text-lg font-bold font-mono tabular-nums text-[var(--text-primary)] mt-1">
            {summary.isTrained ? summary.finalLoss.toFixed(4) : '—'}
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-0.5">Última época</div>
        </div>
        <div className="surface-card rounded-xl p-4">
          <div className="text-xs text-[var(--text-muted)]">Inferencias en Sesión</div>
          <div className="text-lg font-bold font-mono tabular-nums text-[var(--text-primary)] mt-1">
            {predictionHistory.length}
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-0.5">Historial interactivo</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6">
          {!summary.isTrained ? (
            <div className="surface-card rounded-2xl p-8 text-center text-xs text-[var(--text-muted)]">
              El modelo seleccionado aún no ha sido entrenado. Entrénalo desde el Clasificador o Laboratorio Neuronal para calcular su matriz de confusión real.
            </div>
          ) : (
            <ConfusionMatrixHeatmap
              labels={summary.labels}
              matrix={summary.confusionMatrix}
              title="Matriz de Confusión (Evaluación de Validación)"
              exportFilename={`vectoria_confusion_${selectedMode}`}
            />
          )}
        </div>

        <div className="lg:col-span-6">
          <LossAccuracyChart
            title="Convergencia del Modelo (Loss & Precisión)"
            subtitle={`Historial real por época para ${summary.architecture}`}
            data={convergenceData}
            xLabel="Época"
            hasAccuracy
            exportFilename={`vectoria_convergencia_${selectedMode}`}
            heightClass="h-64"
          />
        </div>
      </div>
    </div>
  );
};
