import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { Award, Play } from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { getMnist784Meta } from '../engines/mnist784Engine';
import { ClassifierMode } from '../types/vectoria';
import { LossAccuracyChart } from './charts/LossAccuracyChart';
import { ScientificChartCard } from './charts/ScientificChartCard';
import { ScientificTooltip } from './charts/ScientificTooltip';
import { useChartPalette } from './charts/chartTheme';

export const EvaluationCenterView: React.FC = () => {
  const {
    suiteRef,
    digitsSummary,
    lettersSummary,
    alphanumericSummary,
    trainAlphanumericModel,
    trainingProgress,
  } = useStudio();

  const palette = useChartPalette();
  const [selectedMode, setSelectedMode] = useState<ClassifierMode>('digits');
  const suite = suiteRef.current;

  const evalMap = useMemo(() => {
    return {
      digits: suite.digitsModel.evaluateDetailed(suite.digitsVal),
      letters: suite.lettersModel.evaluateDetailed(suite.lettersVal),
      alphanumeric: suite.alphanumericModel.evaluateDetailed(suite.alphanumericVal),
    };
  }, [suite, digitsSummary, lettersSummary, alphanumericSummary]);

  const activeEval = evalMap[selectedMode];
  const activeSummary =
    selectedMode === 'digits'
      ? digitsSummary
      : selectedMode === 'letters'
        ? lettersSummary
        : alphanumericSummary;

  const mnistMeta = useMemo(() => getMnist784Meta(), []);
  const comparisonData = [
    {
      name: 'Dígitos (0–9)',
      exactitud: Number((evalMap.digits.accuracy * 100).toFixed(1)),
      macroF1: Number((evalMap.digits.macroF1 * 100).toFixed(1)),
      azarTeorico: Number(((1 / 10) * 100).toFixed(1)),
    },
    {
      name: 'Letras (A–Z)',
      exactitud: Number((evalMap.letters.accuracy * 100).toFixed(1)),
      macroF1: Number((evalMap.letters.macroF1 * 100).toFixed(1)),
      azarTeorico: Number(((1 / 26) * 100).toFixed(1)),
    },
    {
      name: 'Alfanumérico (36)',
      exactitud: evalMap.alphanumeric.isTrained
        ? Number((evalMap.alphanumeric.accuracy * 100).toFixed(1))
        : 0,
      macroF1: evalMap.alphanumeric.isTrained
        ? Number((evalMap.alphanumeric.macroF1 * 100).toFixed(1))
        : 0,
      azarTeorico: Number(((1 / 36) * 100).toFixed(1)),
    },
    {
      name: '784–128–10 (Sintético)',
      exactitud: Number((mnistMeta.evaluacion.exactitud * 100).toFixed(1)),
      macroF1: 0,
      azarTeorico: 10,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            Centro de Evaluación de Modelos
          </h1>
          <p className="text-xs text-[var(--text-muted)]">
            Métricas experimentales medidas sobre conjuntos de validación reales: Accuracy, Precision, Recall, F1-Score, Matriz de Confusión y tiempo de inferencia.
          </p>
        </div>

        <div className="inline-flex items-center gap-1 p-1 rounded-xl surface-elevated self-start">
          {(
            [
              { id: 'digits', label: 'Dígitos (0–9)' },
              { id: 'letters', label: 'Letras (A–Z)' },
              { id: 'alphanumeric', label: 'Alfanumérico (36)' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedMode(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap ${
                selectedMode === tab.id
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {!activeEval.isTrained ? (
        <div className="surface-card rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1 text-xs">
            <div className="text-sm font-semibold text-[var(--status-warn)]">
              Modelo Alfanumérico (36 clases) sin entrenar
            </div>
            <p className="text-[var(--text-secondary)]">
              No se reportan métricas inventadas. Ejecuta el entrenamiento real para calcular Precision, Recall y F1 sobre las 36 clases.
            </p>
          </div>
          <button
            type="button"
            disabled={trainingProgress.isTraining}
            onClick={() => trainAlphanumericModel(30)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-[var(--accent-primary)] text-[var(--accent-contrast)] cursor-pointer whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5" />
            {trainingProgress.isTraining ? 'Entrenando...' : 'Entrenar 36 Clases'}
          </button>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs">
            <div className="surface-card rounded-xl p-4">
              <div className="text-[var(--text-muted)]">Exactitud (Val)</div>
              <div className="text-xl font-bold font-mono tabular-nums text-[var(--accent-primary)] mt-1">
                {(activeEval.accuracy * 100).toFixed(2)}%
              </div>
            </div>
            <div className="surface-card rounded-xl p-4">
              <div className="text-[var(--text-muted)]">Macro Precision</div>
              <div className="text-xl font-bold font-mono tabular-nums text-[var(--text-primary)] mt-1">
                {(activeEval.macroPrecision * 100).toFixed(2)}%
              </div>
            </div>
            <div className="surface-card rounded-xl p-4">
              <div className="text-[var(--text-muted)]">Macro Recall</div>
              <div className="text-xl font-bold font-mono tabular-nums text-[var(--text-primary)] mt-1">
                {(activeEval.macroRecall * 100).toFixed(2)}%
              </div>
            </div>
            <div className="surface-card rounded-xl p-4">
              <div className="text-[var(--text-muted)]">Macro F1-Score</div>
              <div className="text-xl font-bold font-mono tabular-nums text-[var(--status-ok)] mt-1">
                {(activeEval.macroF1 * 100).toFixed(2)}%
              </div>
            </div>
            <div className="surface-card rounded-xl p-4">
              <div className="text-[var(--text-muted)]">Latencia Media</div>
              <div className="text-xl font-bold font-mono tabular-nums text-[var(--accent-secondary)] mt-1">
                {activeEval.avgInferenceMs.toFixed(3)} ms
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6">
              <LossAccuracyChart
                title="Curva de Aprendizaje Real (Loss & Validación)"
                subtitle={`Arquitectura ${activeSummary.architecture} · ${activeSummary.epochsTrained} épocas`}
                data={activeSummary.history.map((h) => ({
                  step: h.epoch,
                  loss: h.loss,
                  accuracyPct: Number((h.accuracy * 100).toFixed(1)),
                  valAccuracyPct: Number((h.valAccuracy * 100).toFixed(1)),
                }))}
                exportFilename={`vectoria_eval_curva_${selectedMode}`}
                heightClass="h-60"
              />
            </div>

            <div className="lg:col-span-6">
              <ScientificChartCard
                title="Comparativa Experimental vs Línea Base Teórica (1/K)"
                subtitle="Exactitud medida, Macro-F1 y azar uniforme"
                exportFilename="vectoria_comparativa_modelos"
                headerRight={<Award className="w-4 h-4 text-[var(--accent-primary)]" />}
                dataTable={{
                  columns: ['Modelo', 'Exactitud (%)', 'Macro F1 (%)', 'Azar 1/K (%)'],
                  rows: comparisonData.map((r) => [
                    r.name,
                    `${r.exactitud}%`,
                    `${r.macroF1}%`,
                    `${r.azarTeorico}%`,
                  ]),
                }}
              >
                <div className="h-60 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparisonData} margin={{ top: 14, right: 12, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={palette.borderHairline} vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: palette.textPrimary, fontSize: 10 }}
                        stroke={palette.borderHairline}
                      />
                      <YAxis
                        domain={[0, 100]}
                        unit="%"
                        tick={{ fill: palette.textMuted, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                        stroke={palette.borderHairline}
                        width={42}
                      />
                      <Tooltip
                        cursor={{ fill: palette.bgElevated, opacity: 0.4 }}
                        content={
                          <ScientificTooltip
                            unitByKey={{ exactitud: '%', macroF1: '%', azarTeorico: '%' }}
                            decimals={1}
                          />
                        }
                      />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Bar dataKey="exactitud" name="Exactitud (%)" fill={palette.chart1} radius={[4, 4, 0, 0]}>
                        <LabelList
                          dataKey="exactitud"
                          position="top"
                          formatter={(v: unknown) => `${v}%`}
                          style={{ fill: palette.textSecondary, fontSize: 9, fontFamily: 'JetBrains Mono' }}
                        />
                      </Bar>
                      <Bar dataKey="macroF1" name="Macro F1 (%)" fill={palette.chart2} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="azarTeorico" name="Azar 1/K (%)" fill={palette.textMuted} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ScientificChartCard>
            </div>
          </div>

          {/* Scatter Plot: Per-class Precision vs Recall */}
          <ScientificChartCard
            title="Dispersión por Clase: Precision vs Recall (Validación Real)"
            subtitle={`Cada punto representa una clase real de ${selectedMode === 'digits' ? '0–9' : selectedMode === 'letters' ? 'A–Z' : '36 clases'} (tamaño proporcional a F1-Score)`}
            exportFilename={`vectoria_precision_recall_${selectedMode}`}
            dataTable={{
              columns: ['Clase', 'Precision (%)', 'Recall (%)', 'F1 (%)', 'Soporte'],
              rows: activeEval.perClass.map((c) => [
                c.label,
                `${(c.precision * 100).toFixed(1)}%`,
                `${(c.recall * 100).toFixed(1)}%`,
                `${(c.f1 * 100).toFixed(1)}%`,
                c.support,
              ]),
            }}
          >
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 18, left: 4, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={palette.borderHairline} />
                  <XAxis
                    type="number"
                    dataKey="precisionPct"
                    name="Precision"
                    domain={[0, 105]}
                    unit="%"
                    tick={{ fill: palette.textMuted, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                    stroke={palette.borderHairline}
                  />
                  <YAxis
                    type="number"
                    dataKey="recallPct"
                    name="Recall"
                    domain={[0, 105]}
                    unit="%"
                    tick={{ fill: palette.textMuted, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                    stroke={palette.borderHairline}
                    width={42}
                  />
                  <ZAxis type="number" dataKey="f1Pct" range={[45, 160]} name="F1-Score" />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3', stroke: palette.accentSecondary }}
                    content={
                      <ScientificTooltip
                        unitByKey={{ precisionPct: '%', recallPct: '%', f1Pct: '%' }}
                        decimals={1}
                        extraMeta={(p) => `Clase "${p.label}" · Soporte: ${p.support} muestras`}
                      />
                    }
                  />
                  <Scatter
                    name="Clases evaluadas"
                    data={activeEval.perClass.map((c) => ({
                      label: c.label,
                      precisionPct: Number((c.precision * 100).toFixed(1)),
                      recallPct: Number((c.recall * 100).toFixed(1)),
                      f1Pct: Number((c.f1 * 100).toFixed(1)),
                      support: c.support,
                    }))}
                    fill={palette.accentSecondary}
                    fillOpacity={0.85}
                    stroke={palette.accentPrimary}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </ScientificChartCard>

          {/* Per-class Precision / Recall / F1 Table */}
          <div className="surface-card rounded-2xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Desglose por Clase ({activeEval.sampleCount} muestras de validación)
            </h2>
            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--border-hairline)] text-[var(--text-muted)]">
                    <th className="py-2 text-left">Clase</th>
                    <th className="py-2 text-right">Soporte</th>
                    <th className="py-2 text-right">Precision</th>
                    <th className="py-2 text-right">Recall</th>
                    <th className="py-2 text-right">F1-Score</th>
                  </tr>
                </thead>
                <tbody>
                  {activeEval.perClass.map((row) => (
                    <tr key={row.label} className="border-b border-[var(--border-hairline)] last:border-none font-mono tabular-nums">
                      <td className="py-1.5 font-bold text-[var(--accent-primary)]">{row.label}</td>
                      <td className="py-1.5 text-right text-[var(--text-muted)]">{row.support}</td>
                      <td className="py-1.5 text-right text-[var(--text-primary)]">
                        {(row.precision * 100).toFixed(1)}%
                      </td>
                      <td className="py-1.5 text-right text-[var(--text-primary)]">
                        {(row.recall * 100).toFixed(1)}%
                      </td>
                      <td className="py-1.5 text-right text-[var(--status-ok)]">
                        {(row.f1 * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
