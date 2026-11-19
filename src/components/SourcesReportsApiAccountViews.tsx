import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Cloud,
  Download,
  FileArchive,
  FileJson,
  HardDrive,
  History,
  KeyRound,
  Loader2,
  Lock,
  Pause,
  Play,
  Printer,
  RotateCcw,
  Save,
  Send,
  Server,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
  User,
} from 'lucide-react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useStudio } from '../context/StudioContext';
import { getMnist784Meta } from '../engines/mnist784Engine';
import { TechnicalReportRecord } from '../types/vectoria';
import { ThemeSwitcher } from './ThemeSwitcher';
import { VectorIALogo, THEME_LOGO_PALETTES } from './VectorIALogo';
import { DevelopmentTeamSection } from './DevelopmentTeamSection';
import { ScientificChartCard } from './charts/ScientificChartCard';
import { ScientificTooltip } from './charts/ScientificTooltip';
import { useChartPalette } from './charts/chartTheme';
import { THEME_OPTIONS, useTheme } from '../context/ThemeContext';
import { useBuilder } from '../context/BuilderContext';
import {
  BackendZipExportResult,
  exportProjectZipViaBackend,
  formatZipByteSize,
  triggerZipBrowserDownload,
  ZIP_MODALITY_DETAILS,
  ZipExportModality,
  ZipExportStage,
} from '../services/zipExportService';
import {
  BACKUP_SCHEMA_VERSION,
  buildSecureExperimentsAndModelsExport,
  CHANGELOG_ENTRIES,
  decryptEncryptedGlobalStateJson,
  encryptGlobalStateToJson,
  STORAGE_INVENTORY,
  validateUploadedStateJson,
  VECTORIA_VERSION,
  WorkspaceBackupPayload,
} from '../utils/backupVersioning';
import { executeLocalBackupExport } from '../services/localBackupRunner';
import {
  BACKUP_FREQUENCY_OPTIONS,
  BackupDestination,
  BackupFrequency,
  CloudBackupSnapshotItem,
  CloudBackupStateResponse,
  deleteCloudBackupSnapshot,
  downloadCloudBackupSnapshot,
  fetchCloudBackupState,
  formatTimeUntilIso,
  LocalBackupFormat,
  triggerCloudBackupNow,
  updateCloudBackupSchedule,
} from '../utils/scheduledBackup';

const ACADEMIC_SOURCES = [
  {
    title: 'Introduction to Linear Algebra (5th Ed.)',
    author: 'Gilbert Strang — MIT',
    topic: 'Espacios vectoriales, Gauss-Jordan, LU, QR, rango-nulidad y descomposición espectral',
    lab: 'linear-algebra' as const,
  },
  {
    title: 'Linear Algebra and Its Applications',
    author: 'David C. Lay, Steven R. Lay, Judi J. McDonald',
    topic: 'Transformaciones lineales 2D/3D, determinantes y ortogonalidad',
    lab: 'geometry' as const,
  },
  {
    title: 'Deep Learning',
    author: 'Ian Goodfellow, Yoshua Bengio, Aaron Courville',
    topic: 'Retropropagación, ReLU, Softmax, optimización SGD con momento',
    lab: 'neural-lab' as const,
  },
  {
    title: 'Neural Networks and Deep Learning',
    author: 'Michael Nielsen',
    topic: 'Cálculo de gradientes, mapas de saliencia e interpretabilidad',
    lab: 'xai' as const,
  },
  {
    title: 'EMNIST: Extending MNIST to Handwritten Letters',
    author: 'Gregory Cohen, Saeed Afshar, Jonathan Tapson, André van Schaik',
    topic: 'Clasificación alfanumérica de 36/47 clases y ambigüedad 0/O, 1/I',
    lab: 'classifier' as const,
  },
  {
    title: 'Pattern Recognition and Machine Learning',
    author: 'Christopher M. Bishop',
    topic: 'Entropía cruzada, precisión, recall, F1-score y regularización L2',
    lab: 'evaluation' as const,
  },
];

export const SourcesView: React.FC = () => {
  const { setActiveModule } = useStudio();
  const [filter, setFilter] = useState('');

  const filtered = ACADEMIC_SOURCES.filter(
    (s) =>
      s.title.toLowerCase().includes(filter.toLowerCase()) ||
      s.author.toLowerCase().includes(filter.toLowerCase()) ||
      s.topic.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            Fuentes Académicas y Referencias
          </h1>
          <p className="text-xs text-[var(--text-muted)]">
            Fundamentación bibliográfica que respalda cada módulo de VectorIA Studio.
          </p>
        </div>
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filtrar por autor o tema..."
          className="px-3 py-2 rounded-lg text-xs surface-elevated text-[var(--text-primary)] w-full sm:w-64"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((src) => (
          <div key={src.title} className="surface-card rounded-xl p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">{src.title}</h2>
                <div className="text-xs text-[var(--text-muted)]">{src.author}</div>
              </div>
              <BookOpen className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
            </div>
            <p className="text-xs text-[var(--text-secondary)]">{src.topic}</p>
            <button
              type="button"
              onClick={() => setActiveModule(src.lab)}
              className="text-xs font-medium text-[var(--accent-primary)] hover:underline cursor-pointer"
            >
              Ir al laboratorio relacionado →
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export const ReportsView: React.FC = () => {
  const {
    digitsSummary,
    lettersSummary,
    alphanumericSummary,
    lastPrediction,
    lastMathOutput,
    predictionHistory,
    simulationHistory,
    reportHistory,
    addReportRecord,
    logEvent,
  } = useStudio();
  const palette = useChartPalette();

  const reportChartData = useMemo(() => {
    const meta784 = getMnist784Meta();
    return [
      {
        model: 'Dígitos 0–9',
        valPct: Number((digitsSummary.valAccuracy * 100).toFixed(2)),
        loss: Number(digitsSummary.finalLoss.toFixed(4)),
        params: digitsSummary.parameterCount,
      },
      {
        model: 'Letras A–Z',
        valPct: Number((lettersSummary.valAccuracy * 100).toFixed(2)),
        loss: Number(lettersSummary.finalLoss.toFixed(4)),
        params: lettersSummary.parameterCount,
      },
      {
        model: 'Combinado 36',
        valPct: alphanumericSummary.isTrained
          ? Number((alphanumericSummary.valAccuracy * 100).toFixed(2))
          : 0,
        loss: alphanumericSummary.isTrained ? Number(alphanumericSummary.finalLoss.toFixed(4)) : 0,
        params: alphanumericSummary.parameterCount,
      },
      {
        model: '784–128–10',
        valPct: Number((meta784.evaluacion.exactitud * 100).toFixed(2)),
        loss: 0,
        params: meta784.parametros,
      },
    ];
  }, [digitsSummary, lettersSummary, alphanumericSummary]);

  const [title, setTitle] = useState('Informe Experimental — VectorIA Studio');
  const [objectives, setObjectives] = useState(
    'Verificar la estabilidad numérica del motor de Álgebra Lineal y evaluar el desempeño experimental de los clasificadores MLP sobre entradas 16×16.'
  );
  const [parameters, setParameters] = useState(
    `Arquitectura: ${digitsSummary.architecture} | Épocas 0–9: ${digitsSummary.epochsTrained} | Épocas A–Z: ${lettersSummary.epochsTrained} | Simulaciones en sesión: ${simulationHistory.length}`
  );
  const [procedure, setProcedure] = useState(
    '1. Vectorización 16×16 normalizada en [0,1]. 2. Propagación hacia adelante ReLU + Softmax. 3. Cálculo de residuos de verificación en Álgebra Lineal y pruebas aisladas en Simulation Lab.'
  );
  const [formulas, setFormulas] = useState(
    'Z⁽ˡ⁾ = W⁽ˡ⁾A⁽ˡ⁻¹⁾ + b⁽ˡ⁾ | Softmax(z)_i = exp(z_i)/Σexp(z_j) | P·A = L·U | A = Q·R'
  );
  const [analysis, setAnalysis] = useState(
    'Los modelos especializados (0–9 y A–Z) separan dígitos y letras con pérdida estable. Las ambigüedades geométricas en pares como 0/O y 1/I justifican el entrenamiento conjunto de 36 clases.'
  );
  const [conclusions, setConclusions] = useState(
    'Los invariantes algebraicos y el chequeo numérico de gradientes se mantienen dentro de tolerancia (< 1e-4). Los resultados simulados permanecen aislados.'
  );
  const [savedNotice, setSavedNotice] = useState(false);

  const metricsSummary = [
    `Dígitos (0–9): Val ${(digitsSummary.valAccuracy * 100).toFixed(2)}% · Loss ${digitsSummary.finalLoss.toFixed(4)}`,
    `Letras (A–Z): Val ${(lettersSummary.valAccuracy * 100).toFixed(2)}% · Loss ${lettersSummary.finalLoss.toFixed(4)}`,
    `Alfanumérico (36): ${
      alphanumericSummary.isTrained
        ? `Entrenado (${(alphanumericSummary.valAccuracy * 100).toFixed(2)}% val)`
        : 'Sin entrenar (bloqueado)'
    }`,
    lastPrediction
      ? `Última inferencia: "${lastPrediction.topLabel}" (${(lastPrediction.confidence * 100).toFixed(2)}%, entropía ${lastPrediction.entropy.toFixed(3)} bits)`
      : 'Sin inferencia reciente',
    lastMathOutput
      ? `Último cálculo lineal: ${lastMathOutput.operation} -> ${lastMathOutput.verification.statement}`
      : 'Sin cálculo lineal reciente',
    `Total inferencias en sesión: ${predictionHistory.length}`,
  ].join('\n');

  const modelInfo = `0–9 (${digitsSummary.parameterCount} params) | A–Z (${lettersSummary.parameterCount} params) | 36-clases (${alphanumericSummary.isTrained ? 'activo' : 'pendiente'})`;

  const markdownReport = [
    `# ${title}`,
    `Fecha: ${new Date().toISOString()}`,
    `Modelos: ${modelInfo}`,
    ``,
    `## 1. Objetivos`,
    objectives,
    ``,
    `## 2. Parámetros Configurados`,
    parameters,
    ``,
    `## 3. Procedimiento`,
    procedure,
    ``,
    `## 4. Fórmulas Aplicadas`,
    formulas,
    ``,
    `## 5. Resultados y Métricas Experimentales Reales`,
    metricsSummary,
    ``,
    `## 6. Análisis Técnico`,
    analysis,
    ``,
    `## 7. Conclusiones`,
    conclusions,
  ].join('\n');

  const saveReportToHistory = () => {
    const rec: TechnicalReportRecord = {
      id: `rep-${Date.now()}`,
      createdAt: new Date().toISOString(),
      title,
      objectives,
      parameters,
      procedure,
      formulas,
      results: metricsSummary,
      analysis,
      conclusions,
      modelInfo,
    };
    addReportRecord(rec);
    logEvent('system', `Informe guardado: ${title}`, 'Registrado en historial de investigación');
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  const loadFromHistory = (rec: TechnicalReportRecord) => {
    setTitle(rec.title);
    setObjectives(rec.objectives);
    setParameters(rec.parameters);
    setProcedure(rec.procedure);
    setFormulas(rec.formulas);
    setAnalysis(rec.analysis);
    setConclusions(rec.conclusions);
  };

  const downloadMarkdown = () => {
    const blob = new Blob([markdownReport], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vectoria-informe-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadJson = () => {
    const payload = {
      title,
      createdAt: new Date().toISOString(),
      modelInfo,
      objectives,
      parameters,
      procedure,
      formulas,
      metricsSummary,
      analysis,
      conclusions,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vectoria-informe-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            Centro de Investigación e Informes Técnicos
          </h1>
          <p className="text-xs text-[var(--text-muted)]">
            Genera informes estructurados con objetivos, fórmulas, resultados experimentales reales y exportación PDF/Markdown/JSON.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 self-start">
          <button
            type="button"
            onClick={saveReportToHistory}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border border-[var(--border-strong)] surface-elevated text-[var(--text-primary)] cursor-pointer whitespace-nowrap"
          >
            <Save className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            {savedNotice ? 'Guardado en historial' : 'Guardar en Historial'}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border border-[var(--border-strong)] surface-elevated text-[var(--text-primary)] cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
            Imprimir / Guardar PDF
          </button>
          <button
            type="button"
            onClick={downloadMarkdown}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[var(--accent-primary)] text-[var(--accent-contrast)] cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Markdown
          </button>
          <button
            type="button"
            onClick={downloadJson}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border border-[var(--border-hairline)] surface-elevated text-[var(--text-secondary)] cursor-pointer whitespace-nowrap"
          >
            <FileJson className="w-3.5 h-3.5" />
            JSON
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Editable structured inputs */}
        <div className="lg:col-span-5 surface-card rounded-2xl p-5 space-y-3 text-xs no-print">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            Editor de Secciones del Informe
          </h2>
          <label className="block space-y-1">
            <span className="text-[var(--text-secondary)]">Nombre del experimento / informe</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg surface-elevated text-[var(--text-primary)]"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[var(--text-secondary)]">Objetivos</span>
            <textarea
              rows={2}
              value={objectives}
              onChange={(e) => setObjectives(e.target.value)}
              className="w-full px-3 py-2 rounded-lg surface-elevated text-[var(--text-primary)]"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[var(--text-secondary)]">Parámetros</span>
            <textarea
              rows={2}
              value={parameters}
              onChange={(e) => setParameters(e.target.value)}
              className="w-full px-3 py-2 rounded-lg font-mono surface-elevated text-[var(--text-primary)]"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[var(--text-secondary)]">Procedimiento</span>
            <textarea
              rows={2}
              value={procedure}
              onChange={(e) => setProcedure(e.target.value)}
              className="w-full px-3 py-2 rounded-lg surface-elevated text-[var(--text-primary)]"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[var(--text-secondary)]">Fórmulas aplicadas</span>
            <textarea
              rows={2}
              value={formulas}
              onChange={(e) => setFormulas(e.target.value)}
              className="w-full px-3 py-2 rounded-lg font-mono surface-elevated text-[var(--text-primary)]"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[var(--text-secondary)]">Análisis técnico</span>
            <textarea
              rows={2}
              value={analysis}
              onChange={(e) => setAnalysis(e.target.value)}
              className="w-full px-3 py-2 rounded-lg surface-elevated text-[var(--text-primary)]"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[var(--text-secondary)]">Conclusiones</span>
            <textarea
              rows={2}
              value={conclusions}
              onChange={(e) => setConclusions(e.target.value)}
              className="w-full px-3 py-2 rounded-lg surface-elevated text-[var(--text-primary)]"
            />
          </label>
        </div>

        {/* Printable Structured Preview */}
        <div className="lg:col-span-7 surface-card rounded-2xl p-6 space-y-4 text-xs">
          <div className="border-b border-[var(--border-hairline)] pb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <VectorIALogo variant="full" size="sm" />
              <h2 className="text-lg font-bold text-[var(--text-primary)] pt-1">{title}</h2>
            </div>
            <div className="text-right font-mono text-[11px] text-[var(--text-muted)]">
              <div>{new Date().toLocaleString()}</div>
              <div>{modelInfo}</div>
            </div>
          </div>

          <div className="space-y-1">
            <div className="font-semibold text-[var(--accent-primary)]">1. Objetivos</div>
            <p className="text-[var(--text-secondary)] leading-relaxed">{objectives}</p>
          </div>
          <div className="space-y-1">
            <div className="font-semibold text-[var(--accent-primary)]">2. Parámetros e Hiperparámetros</div>
            <p className="font-mono text-[var(--text-secondary)] leading-relaxed">{parameters}</p>
          </div>
          <div className="space-y-1">
            <div className="font-semibold text-[var(--accent-primary)]">3. Procedimiento Experimental</div>
            <p className="text-[var(--text-secondary)] leading-relaxed">{procedure}</p>
          </div>
          <div className="space-y-1">
            <div className="font-semibold text-[var(--accent-primary)]">4. Fórmulas Matemáticas</div>
            <pre className="surface-elevated rounded-xl p-3 font-mono text-[var(--text-primary)] whitespace-pre-wrap">
              {formulas}
            </pre>
          </div>
          <div className="space-y-1">
            <div className="font-semibold text-[var(--accent-primary)]">
              5. Resultados y Métricas Medidas en Sesión
            </div>
            <pre className="surface-elevated rounded-xl p-3 font-mono text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
              {metricsSummary}
            </pre>
          </div>
          <div className="space-y-1">
            <div className="font-semibold text-[var(--accent-primary)]">6. Análisis</div>
            <p className="text-[var(--text-secondary)] leading-relaxed">{analysis}</p>
          </div>
          <div className="space-y-1">
            <div className="font-semibold text-[var(--accent-primary)]">7. Conclusiones</div>
            <p className="text-[var(--text-secondary)] leading-relaxed">{conclusions}</p>
          </div>
        </div>
      </div>

      {/* Experimental Report Figure */}
      <ScientificChartCard
        title="Figura Experimental Adjunta — Exactitud de Validación y Pérdida Cross-Entropy"
        subtitle="Datos reales medidos en los modelos activos para documentación técnica e impresión"
        exportFilename="vectoria_informe_figura_modelos"
        dataTable={{
          columns: ['Modelo', 'Validación (%)', 'Loss CE', 'Parámetros'],
          rows: reportChartData.map((r) => [
            r.model,
            `${r.valPct.toFixed(2)}%`,
            r.loss > 0 ? r.loss.toFixed(4) : '—',
            r.params.toLocaleString(),
          ]),
        }}
      >
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={reportChartData} margin={{ top: 18, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={palette.borderHairline} vertical={false} />
              <XAxis
                dataKey="model"
                tick={{ fill: palette.textSecondary, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                stroke={palette.borderHairline}
              />
              <YAxis
                yAxisId="left"
                domain={[0, 100]}
                unit="%"
                tick={{ fill: palette.textMuted, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                stroke={palette.borderHairline}
                width={44}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fill: palette.textMuted, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                stroke={palette.borderHairline}
                width={44}
              />
              <Tooltip
                content={
                  <ScientificTooltip
                    decimals={3}
                    unitByKey={{ valPct: '%' }}
                    extraMeta={(p) => `Parámetros: ${Number(p.params).toLocaleString()}`}
                  />
                }
              />
              <Bar yAxisId="left" dataKey="valPct" name="Validación (%)" fill={palette.chart1} radius={[6, 6, 0, 0]}>
                <LabelList
                  dataKey="valPct"
                  position="top"
                  formatter={(v: unknown) => `${Number(v).toFixed(1)}%`}
                  style={{ fill: palette.textSecondary, fontSize: 10, fontFamily: 'JetBrains Mono' }}
                />
              </Bar>
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="loss"
                name="Loss CE"
                stroke={palette.chart2}
                strokeWidth={2.2}
                dot={{ r: 4, fill: palette.chart2 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </ScientificChartCard>

      {/* Report History */}
      {reportHistory.length > 0 && (
        <div className="surface-card rounded-2xl p-5 space-y-3 no-print">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            Historial de Informes Generados ({reportHistory.length})
          </h3>
          <div className="space-y-2">
            {reportHistory.map((rep) => (
              <div
                key={rep.id}
                className="surface-elevated rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="font-semibold text-[var(--text-primary)]">{rep.title}</div>
                  <div className="font-mono text-[11px] text-[var(--text-muted)]">
                    {new Date(rep.createdAt).toLocaleString()} · {rep.modelInfo}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => loadFromHistory(rep)}
                  className="text-xs font-semibold text-[var(--accent-primary)] hover:underline cursor-pointer"
                >
                  Cargar en editor →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const ApiConsoleView: React.FC = () => {
  const { apiLatencyHistory, recordApiLatency, clearApiLatencyHistory, logEvent } = useStudio();
  const [endpoint, setEndpoint] = useState<'health' | 'verify-math' | 'diagnostics'>('health');
  const [payloadText, setPayloadText] = useState(
    JSON.stringify(
      {
        operation: 'qr',
        matrixA: [
          [2, 1, 1],
          [4, -6, 0],
          [-2, 7, 2],
        ],
      },
      null,
      2
    )
  );
  const [responseText, setResponseText] = useState<string>('');
  const [statusCode, setStatusCode] = useState<number | null>(null);
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const invokeEndpoint = async () => {
    setLoading(true);
    const url =
      endpoint === 'health'
        ? '/api/health'
        : endpoint === 'diagnostics'
          ? '/api/diagnostics'
          : '/api/verify-math';
    const method: 'GET' | 'POST' = endpoint === 'verify-math' ? 'POST' : 'GET';
    const t0 = performance.now();

    try {
      const res =
        method === 'GET'
          ? await fetch(url)
          : await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: payloadText,
            });
      const latencyMs = Number((performance.now() - t0).toFixed(2));
      setStatusCode(res.status);
      setLastLatencyMs(latencyMs);

      recordApiLatency({
        endpoint: url,
        method,
        status: res.status,
        latencyMs,
        ok: res.ok,
        source: 'api-console',
      });

      const data = await res.json();
      setResponseText(JSON.stringify(data, null, 2));
      logEvent(
        'system',
        `Consola API: ${method} ${url}`,
        `HTTP ${res.status} en ${latencyMs.toFixed(2)} ms`,
        res.ok ? 'ok' : 'warn'
      );
    } catch (err) {
      const latencyMs = Number((performance.now() - t0).toFixed(2));
      setStatusCode(500);
      setLastLatencyMs(latencyMs);
      recordApiLatency({
        endpoint: url,
        method,
        status: 500,
        latencyMs,
        ok: false,
        source: 'api-console',
      });
      setResponseText(
        JSON.stringify({ error: err instanceof Error ? err.message : 'Error de red' }, null, 2)
      );
      logEvent('system', `Error en Consola API: ${method} ${url}`, `${latencyMs.toFixed(2)} ms`, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          Consola API del Servidor
        </h1>
        <p className="text-xs text-[var(--text-muted)]">
          Pruebas reales contra los endpoints Express de VectorIA Studio con medición de latencia en tiempo real reflejada en el Dashboard.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 surface-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
            <Server className="w-4 h-4 text-[var(--accent-primary)]" />
            <span>Seleccionar Endpoint</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setEndpoint('health')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono cursor-pointer whitespace-nowrap ${
                endpoint === 'health'
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                  : 'surface-elevated text-[var(--text-secondary)]'
              }`}
            >
              GET /api/health
            </button>
            <button
              type="button"
              onClick={() => setEndpoint('verify-math')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono cursor-pointer whitespace-nowrap ${
                endpoint === 'verify-math'
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                  : 'surface-elevated text-[var(--text-secondary)]'
              }`}
            >
              POST /api/verify-math
            </button>
            <button
              type="button"
              onClick={() => setEndpoint('diagnostics')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono cursor-pointer whitespace-nowrap ${
                endpoint === 'diagnostics'
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                  : 'surface-elevated text-[var(--text-secondary)]'
              }`}
            >
              GET /api/diagnostics
            </button>
          </div>

          {endpoint === 'verify-math' && (
            <textarea
              rows={8}
              value={payloadText}
              onChange={(e) => setPayloadText(e.target.value)}
              className="w-full p-3 rounded-lg font-mono text-xs surface-elevated text-[var(--text-primary)]"
            />
          )}

          <button
            type="button"
            disabled={loading}
            onClick={invokeEndpoint}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-[var(--accent-primary)] text-[var(--accent-contrast)] cursor-pointer disabled:opacity-60"
          >
            <Send className="w-3.5 h-3.5" />
            {loading ? 'Ejecutando...' : 'Enviar Petición Real'}
          </button>
        </div>

        <div className="lg:col-span-7 surface-card rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[var(--text-primary)]">Respuesta JSON</span>
            <div className="flex items-center gap-3 font-mono tabular-nums">
              {lastLatencyMs !== null && (
                <span className="text-[var(--text-secondary)]">
                  Latencia: {lastLatencyMs.toFixed(2)} ms
                </span>
              )}
              {statusCode !== null && (
                <span className="text-[var(--accent-primary)] font-semibold">
                  HTTP {statusCode}
                </span>
              )}
            </div>
          </div>
          <pre className="surface-elevated rounded-xl p-4 font-mono text-xs text-[var(--text-secondary)] overflow-auto max-h-80">
            {responseText || '// Ejecuta una petición para inspeccionar la respuesta del servidor.'}
          </pre>
        </div>
      </div>

      {/* Measured Request Latency Log */}
      <div className="surface-card rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs font-semibold text-[var(--text-primary)]">
            Registro de Latencia de Peticiones ({apiLatencyHistory.length})
          </div>
          {apiLatencyHistory.length > 0 && (
            <button
              type="button"
              onClick={clearApiLatencyHistory}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--status-err)] cursor-pointer"
            >
              Limpiar mediciones
            </button>
          )}
        </div>
        {apiLatencyHistory.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">
            Aún no hay mediciones en esta sesión. Envía una petición real arriba para visualizar su latencia aquí y en la línea de tiempo del Panel Principal.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border-hairline)] text-[var(--text-muted)]">
                  <th className="py-1.5 text-left">Hora</th>
                  <th className="py-1.5 text-left">Método y Endpoint</th>
                  <th className="py-1.5 text-right">HTTP</th>
                  <th className="py-1.5 text-right">Latencia (ms)</th>
                </tr>
              </thead>
              <tbody>
                {apiLatencyHistory.slice(0, 10).map((item) => (
                  <tr key={item.id} className="border-b border-[var(--border-hairline)] last:border-none">
                    <td className="py-1.5 pr-3 font-mono tabular-nums text-[var(--text-muted)]">
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-1.5 pr-3 font-mono text-[var(--text-primary)]">
                      {item.method} {item.endpoint}
                    </td>
                    <td
                      className={`py-1.5 pr-3 text-right font-mono tabular-nums ${
                        item.ok ? 'text-[var(--status-ok)]' : 'text-[var(--status-err)]'
                      }`}
                    >
                      {item.status}
                    </td>
                    <td className="py-1.5 text-right font-mono tabular-nums font-semibold text-[var(--accent-primary)]">
                      {item.latencyMs.toFixed(2)} ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export const AccountView: React.FC = () => {
  const {
    userProfile,
    setUserProfile,
    classifierMode,
    suiteRef,
    digitsSummary,
    lettersSummary,
    alphanumericSummary,
    simulationConfig,
    simulationHistory,
    predictionHistory,
    sharedMatrix2D,
    mnist784PerturbConfig,
    mnist784PerturbResult,
    last232Step,
    reportHistory,
    backupSnapshots,
    createManualBackupSnapshot,
    restoreFromBackupPayload,
    restoreFromExperimentsAndModelsArchive,
    clearAllExperimentalData,
    logEvent,
    localBackupSchedule,
    updateLocalBackupSchedule,
    recordLocalBackupExecution,
    clearLocalBackupHistory,
  } = useStudio();
  const { theme, setTheme } = useTheme();
  const { session, authInitialized, loginBuilder, setupAdminPasscode } = useBuilder();
  const [backupMessage, setBackupMessage] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);
  const [includeWeights, setIncludeWeights] = useState(true);
  const [isExportingArchive, setIsExportingArchive] = useState(false);
  const [encryptionPassphrase, setEncryptionPassphrase] = useState('');
  const [pendingEncryptedFile, setPendingEncryptedFile] = useState<{
    name: string;
    size: number;
    text: string;
  } | null>(null);
  const [decryptPassphrase, setDecryptPassphrase] = useState('');
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [archiveExportResult, setArchiveExportResult] = useState<{
    filename: string;
    sizeKb: string;
    algorithm: string;
    digest: string;
    exportedAt: string;
  } | null>(null);

  // ZIP Project Export state (Proyecto Completo, Distribución, Respaldo)
  const [zipMode, setZipMode] = useState<ZipExportModality>('full');
  const [zipStage, setZipStage] = useState<ZipExportStage>('idle');
  const [zipProgressPct, setZipProgressPct] = useState(0);
  const [zipStageLabel, setZipStageLabel] = useState('');
  const [zipError, setZipError] = useState<string | null>(null);
  const [zipResult, setZipResult] = useState<BackendZipExportResult | null>(null);
  const [adminPasscodeInput, setAdminPasscodeInput] = useState('');
  const [adminAuthError, setAdminAuthError] = useState<string | null>(null);
  const [isAuthenticatingAdmin, setIsAuthenticatingAdmin] = useState(false);

  // Scheduled Automatic Backups (Cloud Vault + Local Browser/Download)
  const [scheduleDestination, setScheduleDestination] = useState<BackupDestination>('cloud');
  const [nowTickMs, setNowTickMs] = useState<number>(() => Date.now());
  const [cloudState, setCloudState] = useState<CloudBackupStateResponse | null>(null);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudSaving, setCloudSaving] = useState(false);
  const [cloudRunningNow, setCloudRunningNow] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [cloudNotice, setCloudNotice] = useState<string | null>(null);
  const [cloudFreqDraft, setCloudFreqDraft] = useState<BackupFrequency>('24h');
  const [cloudModeDraft, setCloudModeDraft] = useState<ZipExportModality>('backup');
  const [cloudRetentionDraft, setCloudRetentionDraft] = useState<number>(5);

  const [localFreqDraft, setLocalFreqDraft] = useState<BackupFrequency>(
    localBackupSchedule.frequency
  );
  const [localModeDraft, setLocalModeDraft] = useState<ZipExportModality>(
    localBackupSchedule.mode
  );
  const [localFormatDraft, setLocalFormatDraft] = useState<LocalBackupFormat>(
    localBackupSchedule.localFormat
  );
  const [localAutoDownloadDraft, setLocalAutoDownloadDraft] = useState<boolean>(
    localBackupSchedule.autoDownload
  );
  const [localRetentionDraft, setLocalRetentionDraft] = useState<number>(
    localBackupSchedule.retentionCount
  );
  const [localRunningNow, setLocalRunningNow] = useState(false);
  const [localNotice, setLocalNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNowTickMs(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (session?.role !== 'admin' || !session.token) {
      setCloudState(null);
      return;
    }
    let cancelled = false;
    setCloudLoading(true);
    setCloudError(null);
    fetchCloudBackupState(session.token)
      .then((res) => {
        if (cancelled) return;
        setCloudState(res);
        setCloudFreqDraft(res.schedule.frequency);
        setCloudModeDraft(res.schedule.mode);
        setCloudRetentionDraft(res.schedule.retentionCount);
      })
      .catch((err) => {
        if (cancelled) return;
        setCloudError(
          err instanceof Error ? err.message : 'No se pudo cargar la programación en la nube.'
        );
      })
      .finally(() => {
        if (!cancelled) setCloudLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.role, session?.token]);

  const handleExportBackupJson = () => {
    const payload: WorkspaceBackupPayload = {
      schemaVersion: BACKUP_SCHEMA_VERSION,
      appVersion: VECTORIA_VERSION,
      theme,
      classifierMode,
      userProfile,
      simulationHistory,
      reportHistory,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vectoria_backup_v${VECTORIA_VERSION}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setBackupMessage({ type: 'ok', text: 'Archivo de respaldo .json exportado correctamente.' });
  };

  const handleImportBackupFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPendingEncryptedFile(null);
    try {
      const text = await file.text();
      const validation = await validateUploadedStateJson(file.name, file.size, text);
      if (!validation.valid) {
        if (validation.errorCode === 'PASSPHRASE_REQUIRED') {
          setPendingEncryptedFile({ name: file.name, size: file.size, text });
          setDecryptPassphrase('');
          setBackupMessage({ type: 'ok', text: validation.error });
          return;
        }
        setBackupMessage({ type: 'err', text: validation.error });
        logEvent('system', 'Archivo JSON de respaldo rechazado', validation.error, 'warn');
        return;
      }
      if (validation.kind === 'workspace-backup') {
        restoreFromBackupPayload(validation.payload);
        setBackupMessage({
          type: 'ok',
          text: `Respaldo "${file.name}" verificado y restaurado (se conservó instantánea previa).`,
        });
      } else {
        restoreFromExperimentsAndModelsArchive(validation.archive);
        setBackupMessage({
          type: 'ok',
          text: `Archivo seguro "${file.name}" verificado (${validation.archive.integrity.algorithm}) y modelos/experimentos restaurados.`,
        });
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'No fue posible verificar o restaurar el archivo JSON seleccionado.';
      setBackupMessage({ type: 'err', text: msg });
    }
  };

  const handleDecryptAndRestore = async () => {
    if (!pendingEncryptedFile) return;
    setIsDecrypting(true);
    try {
      const res = await decryptEncryptedGlobalStateJson(
        pendingEncryptedFile.name,
        pendingEncryptedFile.size,
        pendingEncryptedFile.text,
        decryptPassphrase
      );
      if (!res.valid) {
        setBackupMessage({ type: 'err', text: res.error });
        logEvent('system', 'Fallo al descifrar respaldo', res.error, 'warn');
        return;
      }
      if (res.kind === 'experiments-models') {
        restoreFromExperimentsAndModelsArchive(res.archive);
        setBackupMessage({
          type: 'ok',
          text: `Archivo cifrado "${pendingEncryptedFile.name}" descifrado, verificado y restaurado correctamente.`,
        });
      } else {
        restoreFromBackupPayload(res.payload);
      }
      setPendingEncryptedFile(null);
      setDecryptPassphrase('');
    } finally {
      setIsDecrypting(false);
    }
  };

  const handleExportExperimentsAndModels = async () => {
    setIsExportingArchive(true);
    try {
      const suite = suiteRef.current;
      const meta784 = getMnist784Meta();
      const { archive, jsonText, byteSize } = await buildSecureExperimentsAndModelsExport({
        theme,
        classifierMode,
        userProfile,
        sharedMatrix2D,
        simulationConfig,
        simulationHistory,
        predictionHistory,
        mnist784PerturbConfig,
        mnist784PerturbResult,
        last232Step,
        reportHistory,
        includeWeights,
        digitsModelState: suite.digitsModel.exportSerializedState(includeWeights),
        lettersModelState: suite.lettersModel.exportSerializedState(includeWeights),
        alphanumericModelState: suite.alphanumericModel.exportSerializedState(includeWeights),
        mnist784ReadOnlySummary: {
          architecture: '784 → 128 (ReLU) → 10 (Softmax)',
          parameters: meta784.parametros,
          syntheticEvalTotal: meta784.evaluacion.total,
          syntheticEvalCorrect: meta784.evaluacion.correctos,
          syntheticEvalAccuracy: meta784.evaluacion.exactitud,
        },
      });

      const dateSlug = archive.exportedAt.slice(0, 10);
      const filename = `vectoria_experimentos_modelos_v${VECTORIA_VERSION}_${dateSlug}.json`;
      const blob = new Blob([jsonText], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      const sizeKb = (byteSize / 1024).toFixed(1);
      setArchiveExportResult({
        filename,
        sizeKb,
        algorithm: archive.integrity.algorithm,
        digest: archive.integrity.digest,
        exportedAt: archive.exportedAt,
      });
      logEvent(
        'system',
        'Archivo seguro de experimentos y modelos exportado',
        `${filename} (${sizeKb} KB · ${archive.integrity.algorithm} ${archive.integrity.digest.slice(0, 12)}…)`,
        'ok'
      );
    } catch {
      setBackupMessage({
        type: 'err',
        text: 'No se pudo generar la exportación segura de experimentos y modelos.',
      });
    } finally {
      setIsExportingArchive(false);
    }
  };

  const handleExportEncryptedGlobalJson = async () => {
    if (encryptionPassphrase.trim().length < 8) {
      setBackupMessage({
        type: 'err',
        text: 'Introduce una contraseña de al menos 8 caracteres para cifrar el archivo .json con AES-256-GCM.',
      });
      return;
    }
    setIsExportingArchive(true);
    try {
      const suite = suiteRef.current;
      const meta784 = getMnist784Meta();
      const { envelope, jsonText, byteSize, innerDigest } = await encryptGlobalStateToJson(
        {
          theme,
          classifierMode,
          userProfile,
          sharedMatrix2D,
          simulationConfig,
          simulationHistory,
          predictionHistory,
          mnist784PerturbConfig,
          mnist784PerturbResult,
          last232Step,
          reportHistory,
          includeWeights: true,
          digitsModelState: suite.digitsModel.exportSerializedState(true),
          lettersModelState: suite.lettersModel.exportSerializedState(true),
          alphanumericModelState: suite.alphanumericModel.exportSerializedState(true),
          mnist784ReadOnlySummary: {
            architecture: '784 → 128 (ReLU) → 10 (Softmax)',
            parameters: meta784.parametros,
            syntheticEvalTotal: meta784.evaluacion.total,
            syntheticEvalCorrect: meta784.evaluacion.correctos,
            syntheticEvalAccuracy: meta784.evaluacion.exactitud,
          },
        },
        encryptionPassphrase
      );

      const dateSlug = envelope.exportedAt.slice(0, 10);
      const filename = `vectoria_estado_cifrado_v${VECTORIA_VERSION}_${dateSlug}.json`;
      const blob = new Blob([jsonText], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      const sizeKb = (byteSize / 1024).toFixed(1);
      setEncryptionPassphrase('');
      setArchiveExportResult({
        filename,
        sizeKb,
        algorithm: 'AES-256-GCM + SHA-256',
        digest: innerDigest,
        exportedAt: envelope.exportedAt,
      });
      setBackupMessage({
        type: 'ok',
        text: `Estado global cifrado (configuración, pesos de modelos e historial) descargado en "${filename}".`,
      });
      logEvent(
        'system',
        'Estado global exportado en JSON cifrado',
        `${filename} (${sizeKb} KB · AES-256-GCM / PBKDF2-SHA256)`,
        'ok'
      );
    } catch (err) {
      setBackupMessage({
        type: 'err',
        text:
          err instanceof Error
            ? err.message
            : 'No se pudo cifrar y exportar el estado global de la aplicación.',
      });
    } finally {
      setIsExportingArchive(false);
    }
  };

  const isZipExporting =
    zipStage === 'preparing' || zipStage === 'compressing' || zipStage === 'validating';

  const handleAuthenticateAdminForZip = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminAuthError(null);
    if (adminPasscodeInput.trim().length < 8) {
      setAdminAuthError('La clave de Administrador debe tener al menos 8 caracteres.');
      return;
    }
    setIsAuthenticatingAdmin(true);
    try {
      const authRes = authInitialized
        ? await loginBuilder(adminPasscodeInput, 'admin')
        : await setupAdminPasscode(adminPasscodeInput);
      if (!authRes.ok) {
        setAdminAuthError(authRes.error || 'Credenciales de Administrador inválidas.');
        return;
      }
      setAdminPasscodeInput('');
      setZipError(null);
      logEvent(
        'system',
        'Sesión Administrador verificada para exportación ZIP',
        'Acceso RBAC concedido desde Configuración',
        'ok'
      );
    } finally {
      setIsAuthenticatingAdmin(false);
    }
  };

  const handleExportProjectZip = async () => {
    if (isZipExporting) return;
    if (!session?.token || session.role !== 'admin') {
      setZipStage('error');
      setZipProgressPct(0);
      setZipError(
        'Debes autenticar una sesión con rol Administrador para generar y descargar el paquete .ZIP del proyecto.'
      );
      return;
    }

    setZipError(null);
    setZipResult(null);
    setZipStage('preparing');
    setZipProgressPct(8);
    setZipStageLabel('Preparando archivos...');

    try {
      const exported = await exportProjectZipViaBackend({
        mode: zipMode,
        token: session.token,
        onProgress: (update) => {
          setZipStage(update.stage);
          setZipProgressPct(update.progressPct);
          setZipStageLabel(update.stageLabel);
        },
      });
      setZipResult(exported);
      triggerZipBrowserDownload(exported.blob, exported.filename);
      logEvent(
        'system',
        `Proyecto exportado en ZIP (${exported.mode})`,
        `${exported.filename} (${formatZipByteSize(exported.sizeBytes)} · ${exported.entryCount} archivos)`,
        'ok'
      );
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Error inesperado al generar o validar el archivo ZIP del proyecto.';
      setZipStage('error');
      setZipError(message);
      setZipStageLabel('Error de exportación');
      logEvent('system', 'Fallo al exportar proyecto (.ZIP)', message, 'error');
    }
  };

  const handleSaveCloudSchedule = async (enabledOverride?: boolean) => {
    if (!session?.token || session.role !== 'admin') {
      setCloudError('Autentica una sesión Administrador para configurar respaldos en la nube.');
      return;
    }
    setCloudSaving(true);
    setCloudError(null);
    setCloudNotice(null);
    try {
      const targetEnabled =
        enabledOverride !== undefined ? enabledOverride : (cloudState?.schedule.enabled ?? true);
      const updated = await updateCloudBackupSchedule(session.token, {
        enabled: targetEnabled,
        frequency: cloudFreqDraft,
        mode: cloudModeDraft,
        retentionCount: cloudRetentionDraft,
      });
      setCloudState(updated);
      setNowTickMs(Date.now());
      setCloudNotice(
        updated.schedule.enabled
          ? `Respaldo en la nube programado (${BACKUP_FREQUENCY_OPTIONS.find((f) => f.id === updated.schedule.frequency)?.label ?? updated.schedule.frequency}).`
          : 'Programación automática en la nube pausada.'
      );
      logEvent(
        'system',
        updated.schedule.enabled
          ? 'Respaldo automático en la nube activado'
          : 'Respaldo automático en la nube pausado',
        `Frecuencia ${updated.schedule.frequency} · Modalidad ${updated.schedule.mode} · Retención ${updated.schedule.retentionCount}`,
        'ok'
      );
    } catch (err) {
      setCloudError(
        err instanceof Error ? err.message : 'No se pudo actualizar la programación en la nube.'
      );
    } finally {
      setCloudSaving(false);
    }
  };

  const handleRunCloudBackupNow = async () => {
    if (!session?.token || session.role !== 'admin') {
      setCloudError('Autentica una sesión Administrador para ejecutar un respaldo en la nube.');
      return;
    }
    setCloudRunningNow(true);
    setCloudError(null);
    setCloudNotice(null);
    try {
      const { snapshot, state } = await triggerCloudBackupNow(session.token);
      setCloudState(state);
      setNowTickMs(Date.now());
      setCloudNotice(
        `Instantánea almacenada en bóveda: ${snapshot.filename} (${formatZipByteSize(snapshot.sizeBytes)} · ${snapshot.entryCount} archivos).`
      );
      logEvent(
        'system',
        'Respaldo en la nube completado',
        `${snapshot.filename} · SHA-256 ${snapshot.sha256.slice(0, 12)}…`,
        'ok'
      );
    } catch (err) {
      setCloudError(
        err instanceof Error ? err.message : 'Error al ejecutar el respaldo en la nube.'
      );
    } finally {
      setCloudRunningNow(false);
    }
  };

  const handleDownloadCloudSnapshot = async (snap: CloudBackupSnapshotItem) => {
    if (!session?.token || session.role !== 'admin') return;
    setCloudError(null);
    try {
      await downloadCloudBackupSnapshot(session.token, snap.id, snap.filename);
    } catch (err) {
      setCloudError(
        err instanceof Error ? err.message : 'No fue posible descargar la copia seleccionada.'
      );
    }
  };

  const handleDeleteCloudSnapshot = async (snapshotId: string) => {
    if (!session?.token || session.role !== 'admin') return;
    setCloudError(null);
    try {
      const updated = await deleteCloudBackupSnapshot(session.token, snapshotId);
      setCloudState(updated);
      setCloudNotice('Copia eliminada de la bóveda del servidor.');
    } catch (err) {
      setCloudError(
        err instanceof Error ? err.message : 'No se pudo eliminar la copia en la nube.'
      );
    }
  };

  const handleSaveLocalSchedule = (enabledOverride?: boolean) => {
    const nextEnabled =
      enabledOverride !== undefined ? enabledOverride : localBackupSchedule.enabled;
    updateLocalBackupSchedule({
      enabled: nextEnabled,
      frequency: localFreqDraft,
      mode: localModeDraft,
      localFormat: localFormatDraft,
      autoDownload: localAutoDownloadDraft,
      retentionCount: localRetentionDraft,
    });
    setNowTickMs(Date.now());
    const freqLabel =
      BACKUP_FREQUENCY_OPTIONS.find((f) => f.id === localFreqDraft)?.label ?? localFreqDraft;
    setLocalNotice({
      type: 'ok',
      text: nextEnabled
        ? `Respaldo automático local programado (${freqLabel}).`
        : 'Configuración local guardada (programador pausado).',
    });
    logEvent(
      'system',
      nextEnabled ? 'Respaldo automático local activado' : 'Respaldo automático local pausado',
      `Frecuencia ${localFreqDraft} · Formato ${localFormatDraft} · Modalidad ${localModeDraft}`,
      'ok'
    );
  };

  const handleRunLocalBackupNow = async () => {
    if (localRunningNow) return;
    setLocalRunningNow(true);
    setLocalNotice(null);
    try {
      const effectiveSchedule = {
        ...localBackupSchedule,
        frequency: localFreqDraft,
        mode: localModeDraft,
        localFormat: localFormatDraft,
        autoDownload: localAutoDownloadDraft,
        retentionCount: localRetentionDraft,
      };
      const entry = await executeLocalBackupExport({
        schedule: effectiveSchedule,
        trigger: 'manual',
        theme,
        classifierMode,
        userProfile,
        sharedMatrix2D,
        simulationConfig,
        simulationHistory,
        predictionHistory,
        mnist784PerturbConfig,
        mnist784PerturbResult,
        last232Step,
        reportHistory,
        suite: suiteRef.current,
        token: session?.token ?? null,
        role: session?.role ?? null,
        createManualBackupSnapshot,
      });
      recordLocalBackupExecution(entry);
      setNowTickMs(Date.now());
      setLocalNotice({
        type: entry.status === 'ok' ? 'ok' : 'err',
        text:
          entry.status === 'ok'
            ? `Respaldo local ejecutado: ${entry.filename} (${entry.detail}).`
            : entry.detail,
      });
      logEvent(
        'system',
        entry.status === 'ok' ? 'Respaldo local manual completado' : 'Error en respaldo local',
        `${entry.filename} · ${entry.detail}`,
        entry.status === 'ok' ? 'ok' : 'error'
      );
    } finally {
      setLocalRunningNow(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            Configuración, Usuarios, Respaldo y Privacidad
          </h1>
          <p className="text-xs text-[var(--text-muted)]">
            Gestión de perfil académico, selector global de 6 temas, respaldos multiranura, versionado y control de datos locales.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg surface-elevated border border-[var(--border-hairline)] text-xs font-mono text-[var(--accent-primary)] self-start">
          VectorIA Studio v{VECTORIA_VERSION}
        </span>
      </div>

      <section className="surface-card rounded-2xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">
          Tema Global de VectorIA Studio (6 Temas)
        </h2>
        <ThemeSwitcher />
      </section>

      {/* Brand Identity Kit */}
      <section className="surface-card rounded-2xl p-5 space-y-5">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            Sistema de Identidad Visual — VectorIA Studio
          </h2>
          <p className="text-xs text-[var(--text-muted)]">
            Isotipo V geométrica con nodos y conexiones neuronales: logotipo completo, símbolo independiente, icono de aplicación, favicon y adaptación cromática a los 6 temas.
          </p>
        </div>

        {/* Light, Dark and Monochrome lockups */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl p-5 bg-white text-slate-900 border border-slate-200 flex flex-col gap-2">
            <span className="text-[11px] font-medium text-slate-500">Logotipo · Fondo Claro</span>
            <VectorIALogo variant="full" tone="light" size="lg" />
          </div>
          <div className="rounded-xl p-5 bg-[#09090f] text-slate-100 border border-slate-800 flex flex-col gap-2">
            <span className="text-[11px] font-medium text-slate-400">Logotipo · Fondo Oscuro</span>
            <VectorIALogo variant="full" tone="dark" size="lg" />
          </div>
          <div className="rounded-xl p-5 surface-elevated flex flex-col gap-2">
            <span className="text-[11px] font-medium text-[var(--text-muted)]">Logotipo · Monocromático</span>
            <VectorIALogo variant="full" tone="mono" size="lg" />
          </div>
        </div>

        {/* Standalone Mark, App Icon, and Favicon */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          <div className="rounded-xl p-4 surface-elevated flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-[var(--text-primary)]">Símbolo Independiente</div>
              <div className="text-[11px] text-[var(--text-muted)]">V vectorial y nodos sin contenedor</div>
            </div>
            <VectorIALogo variant="mark" tone="auto" size="xl" />
          </div>

          <div className="rounded-xl p-4 surface-elevated flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-[var(--text-primary)]">Icono de Aplicación</div>
              <div className="text-[11px] text-[var(--text-muted)]">Retícula orbital de alta precisión</div>
            </div>
            <VectorIALogo variant="app-icon" tone="auto" size="xl" />
          </div>

          <div className="rounded-xl p-4 surface-elevated flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-[var(--text-primary)]">Favicon (32px · 16px)</div>
              <div className="text-[11px] text-[var(--text-muted)]">Lectura nítida en pestañas</div>
            </div>
            <div className="flex items-center gap-3">
              <VectorIALogo variant="favicon" tone="auto" size="lg" />
              <VectorIALogo variant="favicon" tone="auto" size="sm" />
            </div>
          </div>
        </div>

        {/* Adaptation across the 6 visual themes */}
        <div className="space-y-2.5 pt-1">
          <div className="text-xs font-semibold text-[var(--text-secondary)]">
            Adaptación de Marca en los 6 Temas Visuales (clic para activar)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {THEME_OPTIONS.map((opt) => {
              const p = THEME_LOGO_PALETTES[opt.id];
              const isActive = theme === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTheme(opt.id)}
                  style={{
                    backgroundColor: p.bg,
                    borderColor: isActive ? p.primary : p.border,
                    color: p.text,
                  }}
                  className={`rounded-xl p-3.5 border text-left transition-transform hover:-translate-y-0.5 cursor-pointer flex items-center justify-between gap-3 ${
                    isActive ? 'ring-1 ring-[var(--accent-primary)]' : ''
                  }`}
                >
                  <VectorIALogo variant="full" themeOverride={opt.id} size="sm" />
                  <span
                    className="text-[10px] font-mono whitespace-nowrap"
                    style={{ color: p.sub }}
                  >
                    {opt.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Official Development Team & Institutional Credits */}
      <DevelopmentTeamSection id="equipo-desarrollo" />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 surface-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
            <User className="w-4 h-4 text-[var(--accent-primary)]" />
            <span>Perfil Académico de Sesión</span>
          </div>
          <div className="space-y-3 text-xs">
            <label className="block space-y-1">
              <span className="text-[var(--text-secondary)]">Nombre</span>
              <input
                type="text"
                value={userProfile.name}
                onChange={(e) => setUserProfile((p) => ({ ...p, name: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg surface-elevated text-[var(--text-primary)]"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[var(--text-secondary)]">Programa Académico</span>
              <input
                type="text"
                value={userProfile.program}
                onChange={(e) => setUserProfile((p) => ({ ...p, program: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg surface-elevated text-[var(--text-primary)]"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[var(--text-secondary)]">Rol</span>
              <select
                value={userProfile.role}
                onChange={(e) => setUserProfile((p) => ({ ...p, role: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg surface-elevated text-[var(--text-primary)]"
              >
                <option value="Estudiante / Investigador">Estudiante / Investigador</option>
                <option value="Docente de Álgebra Lineal">Docente de Álgebra Lineal</option>
                <option value="Ingeniero de IA">Ingeniero de IA</option>
              </select>
            </label>
          </div>
        </div>

        <div className="lg:col-span-6 surface-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--status-warn)]">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>Planes y Certificación (Demostración Académica)</span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Aviso de transparencia: esta sección conserva la estructura de niveles y certificación con fines estrictamente demostrativos. No procesa cobros reales ni emite credenciales oficiales.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {(
              [
                { id: 'academico', name: 'Académico', desc: 'Laboratorios completos y motor local' },
                { id: 'laboratorio', name: 'Laboratorio', desc: 'Entrenamiento 36 clases e informes' },
                { id: 'institucional', name: 'Institucional', desc: 'Demo multiusuario docente' },
              ] as const
            ).map((plan) => (
              <button
                key={plan.id}
                type="button"
                onClick={() => setUserProfile((p) => ({ ...p, planTier: plan.id }))}
                className={`p-3 rounded-xl border text-left cursor-pointer ${
                  userProfile.planTier === plan.id
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)]'
                    : 'border-[var(--border-hairline)] surface-elevated'
                }`}
              >
                <div className="font-semibold text-[var(--text-primary)]">{plan.name} (Demo)</div>
                <div className="text-[11px] text-[var(--text-muted)] mt-1">{plan.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Secure Local Export of Current Experiments & Trained Models */}
      <section className="surface-card rounded-2xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
              <FileJson className="w-4 h-4 text-[var(--accent-primary)]" />
              <span>Exportar Estado de Experimentos y Modelos Entrenados (JSON Seguro)</span>
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              Genera un resguardo local íntegro con el estado actual de simulaciones, inferencias, informes, métricas y pesos entrenados, sanitizado, sin claves API y firmado con resumen criptográfico.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <label className="inline-flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeWeights}
                onChange={(e) => setIncludeWeights(e.target.checked)}
                className="accent-[var(--accent-primary)]"
              />
              Incluir pesos (W, b)
            </label>
            <button
              type="button"
              disabled={isExportingArchive}
              onClick={() => void handleExportExperimentsAndModels()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-contrast)] disabled:opacity-60 cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              {isExportingArchive
                ? 'Generando JSON seguro...'
                : 'Exportar Experimentos y Modelos (.json)'}
            </button>
            <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border-strong)] surface-elevated text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent-primary)] cursor-pointer whitespace-nowrap">
              <Upload className="w-3.5 h-3.5" />
              Importar y Verificar (.json)
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleImportBackupFile}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Encrypted Global State Export Bar (AES-256-GCM) */}
        <div className="surface-elevated rounded-xl p-3.5 border border-[var(--border-hairline)] flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 text-xs">
            <Lock className="w-4 h-4 text-[var(--status-ok)] shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-[var(--text-primary)]">
                Exportación Global Cifrada (AES-256-GCM + PBKDF2-SHA256)
              </div>
              <div className="text-[11px] text-[var(--text-muted)]">
                Cifra localmente configuración, pesos de todos los modelos e historial de experimentos antes de descargar.
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <input
              type="password"
              value={encryptionPassphrase}
              onChange={(e) => setEncryptionPassphrase(e.target.value)}
              placeholder="Contraseña (mín. 8 caracteres)"
              aria-label="Contraseña para cifrar el archivo JSON"
              className="px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-xs text-[var(--text-primary)] w-52"
            />
            <button
              type="button"
              disabled={isExportingArchive}
              onClick={() => void handleExportEncryptedGlobalJson()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent-secondary)] text-[var(--accent-contrast)] hover:opacity-90 disabled:opacity-60 cursor-pointer whitespace-nowrap"
            >
              <Lock className="w-3.5 h-3.5" />
              {isExportingArchive ? 'Cifrando...' : 'Exportar Estado Cifrado (.json)'}
            </button>
          </div>
        </div>

        {pendingEncryptedFile && (
          <div className="rounded-xl p-3.5 border border-[var(--accent-primary)]/40 bg-[var(--accent-soft)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <div className="font-semibold text-[var(--text-primary)]">
                Descifrar archivo: <span className="font-mono">{pendingEncryptedFile.name}</span>
              </div>
              <div className="text-[11px] text-[var(--text-muted)]">
                Introduce la contraseña con la que se generó este respaldo cifrado AES-256-GCM.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={decryptPassphrase}
                onChange={(e) => setDecryptPassphrase(e.target.value)}
                placeholder="Contraseña de descifrado"
                aria-label="Contraseña para descifrar respaldo JSON"
                className="px-3 py-1.5 rounded-lg surface-elevated border border-[var(--border-strong)] text-xs text-[var(--text-primary)] w-48"
              />
              <button
                type="button"
                disabled={isDecrypting}
                onClick={() => void handleDecryptAndRestore()}
                className="px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] text-[var(--accent-contrast)] font-semibold cursor-pointer whitespace-nowrap disabled:opacity-60"
              >
                {isDecrypting ? 'Descifrando...' : 'Descifrar y Restaurar'}
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="surface-elevated rounded-xl p-3 space-y-0.5">
            <div className="text-[var(--text-muted)]">Modelos Entrenados</div>
            <div className="font-mono font-semibold text-[var(--text-primary)]">
              0–9 ({(digitsSummary.valAccuracy * 100).toFixed(1)}%) · A–Z (
              {(lettersSummary.valAccuracy * 100).toFixed(1)}%)
            </div>
            <div className="text-[11px] font-mono text-[var(--accent-primary)]">
              36 clases:{' '}
              {alphanumericSummary.isTrained
                ? `${(alphanumericSummary.valAccuracy * 100).toFixed(1)}% (${alphanumericSummary.epochsTrained} ép.)`
                : 'Pendiente'}
            </div>
          </div>

          <div className="surface-elevated rounded-xl p-3 space-y-0.5">
            <div className="text-[var(--text-muted)]">Experimentos e Historial</div>
            <div className="font-mono font-semibold text-[var(--text-primary)]">
              {simulationHistory.length} simulaciones · {predictionHistory.length} inferencias
            </div>
            <div className="text-[11px] text-[var(--text-muted)]">
              Configuración Lab + {reportHistory.length} informes técnicos
            </div>
          </div>

          <div className="surface-elevated rounded-xl p-3 space-y-0.5">
            <div className="text-[var(--text-muted)]">Estado Matemático y MNIST</div>
            <div className="font-mono font-semibold text-[var(--text-primary)]">
              Matriz 2D · Perturb. 28×28
            </div>
            <div className="text-[11px] text-[var(--text-muted)]">
              Didáctica 2–3–2: {last232Step ? 'Con paso registrado' : 'Configuración base'}
            </div>
          </div>

          <div className="surface-elevated rounded-xl p-3 space-y-0.5">
            <div className="text-[var(--text-muted)]">Garantía de Seguridad</div>
            <div className="font-mono font-semibold text-[var(--status-ok)]">
              0 secretos · Sanitizado
            </div>
            <div className="text-[11px] text-[var(--text-muted)]">
              Verificación de integridad SHA-256
            </div>
          </div>
        </div>

        {archiveExportResult && (
          <div className="rounded-xl p-3 bg-[var(--status-ok)]/10 border border-[var(--status-ok)]/30 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="text-[var(--status-ok)] font-medium">
              Exportado: <span className="font-mono">{archiveExportResult.filename}</span> (
              {archiveExportResult.sizeKb} KB)
            </div>
            <div className="font-mono text-[11px] text-[var(--text-secondary)]">
              {archiveExportResult.algorithm}: {archiveExportResult.digest.slice(0, 24)}…
            </div>
          </div>
        )}
      </section>

      {/* Project ZIP Export Section (Proyecto Completo, Distribución, Respaldo) */}
      <section className="surface-card rounded-2xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
              <FileArchive className="w-4 h-4 text-[var(--accent-primary)]" />
              <span>Exportación Completa del Proyecto (.ZIP)</span>
            </div>
            <p className="text-xs text-[var(--text-muted)] max-w-3xl">
              Empaqueta dinámicamente los directorios reales del proyecto excluyendo node_modules, .git, archivos .env y credenciales, con verificación previa de integridad vía JSZip.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              disabled={isZipExporting}
              onClick={() => void handleExportProjectZip()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-contrast)] disabled:opacity-60 cursor-pointer whitespace-nowrap shrink-0"
            >
              {isZipExporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Archive className="w-3.5 h-3.5" />
              )}
              {isZipExporting ? 'Generando paquete...' : 'Exportar Proyecto (.ZIP)'}
            </button>

            {zipResult && zipStage === 'ready' && (
              <button
                type="button"
                onClick={() => triggerZipBrowserDownload(zipResult.blob, zipResult.filename)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border border-[var(--border-strong)] surface-elevated text-[var(--text-primary)] hover:border-[var(--accent-primary)] cursor-pointer whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                Descargar nuevamente
              </button>
            )}
          </div>
        </div>

        {/* 3 ZIP Modalities */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {ZIP_MODALITY_DETAILS.map((opt) => {
            const active = zipMode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                disabled={isZipExporting}
                onClick={() => {
                  setZipMode(opt.id);
                  setZipError(null);
                }}
                className={`text-left rounded-xl p-4 border transition-colors flex flex-col justify-between gap-3 cursor-pointer disabled:opacity-60 ${
                  active
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)]/50 ring-1 ring-[var(--accent-primary)]'
                    : 'surface-elevated border-[var(--border-hairline)] hover:border-[var(--border-strong)]'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono text-[var(--accent-primary)]">
                      {opt.badge}
                    </span>
                    {active && <CheckCircle2 className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />}
                  </div>
                  <div className="text-sm font-bold text-[var(--text-primary)]">{opt.title}</div>
                  <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                    {opt.subtitle}
                  </p>
                </div>

                <div className="space-y-2 pt-2 border-t border-[var(--border-hairline)] text-[11px]">
                  <div>
                    <div className="font-semibold text-[var(--status-ok)] mb-0.5">Incluye:</div>
                    <ul className="space-y-0.5 text-[var(--text-muted)] list-disc list-inside">
                      {opt.includes.map((line) => (
                        <li key={line} className="leading-snug">
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="font-semibold text-[var(--status-warn)] mb-0.5">Excluye:</div>
                    <ul className="space-y-0.5 text-[var(--text-muted)] list-disc list-inside">
                      {opt.excludes.map((line) => (
                        <li key={line} className="leading-snug">
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* RBAC Admin Verification Gate when no active admin token */}
        {session?.role !== 'admin' ? (
          <form
            onSubmit={(e) => void handleAuthenticateAdminForZip(e)}
            className="surface-elevated rounded-xl p-3.5 border border-[var(--border-hairline)] flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs"
          >
            <div className="flex items-start gap-2.5">
              <KeyRound className="w-4 h-4 text-[var(--accent-primary)] shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-[var(--text-primary)]">
                  {authInitialized
                    ? 'Autorización de Administrador requerida para descargar paquetes del código fuente'
                    : 'Configura la contraseña maestra de Administrador para habilitar descargas protegidas'}
                </div>
                <div className="text-[11px] text-[var(--text-muted)]">
                  Token HMAC-SHA256 verificado en servidor; las credenciales nunca se incluyen en el archivo ZIP.
                </div>
                {adminAuthError && (
                  <div className="text-[11px] text-[var(--status-err)] font-medium mt-1">
                    {adminAuthError}
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <input
                type="password"
                value={adminPasscodeInput}
                onChange={(e) => setAdminPasscodeInput(e.target.value)}
                placeholder={
                  authInitialized ? 'Contraseña Administrador' : 'Nueva clave Admin (mín. 8)'
                }
                aria-label="Contraseña de Administrador para exportación ZIP"
                className="px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-xs text-[var(--text-primary)] w-52"
              />
              <button
                type="submit"
                disabled={isAuthenticatingAdmin}
                className="px-3.5 py-1.5 rounded-lg bg-[var(--accent-secondary)] text-[var(--accent-contrast)] font-semibold cursor-pointer whitespace-nowrap disabled:opacity-60"
              >
                {isAuthenticatingAdmin
                  ? 'Verificando...'
                  : authInitialized
                    ? 'Autorizar Admin'
                    : 'Crear clave y autorizar'}
              </button>
            </div>
          </form>
        ) : (
          <div className="text-[11px] text-[var(--text-muted)] flex flex-wrap items-center justify-between gap-2 px-1">
            <span className="inline-flex items-center gap-1.5 text-[var(--status-ok)] font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              Sesión Administrador activa · Endpoint protegido listo
            </span>
            <span>Modalidad seleccionada: {ZIP_MODALITY_DETAILS.find((m) => m.id === zipMode)?.title}</span>
          </div>
        )}

        {/* Progress & Validation Feedback */}
        {zipStage !== 'idle' && (
          <div className="surface-elevated rounded-xl p-4 border border-[var(--border-hairline)] space-y-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
                {isZipExporting ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-primary)]" />
                ) : zipStage === 'ready' ? (
                  <CheckCircle2 className="w-4 h-4 text-[var(--status-ok)]" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-[var(--status-err)]" />
                )}
                <span>{zipStageLabel || 'Procesando paquete ZIP...'}</span>
              </div>
              <span className="font-mono tabular-nums text-[var(--text-muted)]">
                {zipProgressPct}%
              </span>
            </div>

            <div className="w-full h-2 rounded-full bg-[var(--bg-card)] overflow-hidden border border-[var(--border-hairline)]">
              <div
                className={`h-full transition-all duration-200 ${
                  zipStage === 'error'
                    ? 'bg-[var(--status-err)]'
                    : zipStage === 'ready'
                      ? 'bg-[var(--status-ok)]'
                      : 'bg-[var(--accent-primary)]'
                }`}
                style={{ width: `${zipProgressPct}%` }}
              />
            </div>

            {zipError && (
              <div
                role="alert"
                className="rounded-lg p-3 bg-[var(--status-err)]/10 border border-[var(--status-err)]/30 text-[var(--status-err)] flex items-start gap-2"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{zipError}</span>
              </div>
            )}

            {zipResult && zipStage === 'ready' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
                <div className="rounded-lg p-2.5 bg-[var(--bg-card)] border border-[var(--border-hairline)]">
                  <div className="text-[11px] text-[var(--text-muted)]">Archivo generado</div>
                  <div className="font-mono font-semibold text-[var(--text-primary)] truncate mt-0.5">
                    {zipResult.filename}
                  </div>
                </div>
                <div className="rounded-lg p-2.5 bg-[var(--bg-card)] border border-[var(--border-hairline)]">
                  <div className="text-[11px] text-[var(--text-muted)]">Tamaño final</div>
                  <div className="font-mono font-semibold tabular-nums text-[var(--text-primary)] mt-0.5">
                    {formatZipByteSize(zipResult.sizeBytes)}
                  </div>
                </div>
                <div className="rounded-lg p-2.5 bg-[var(--bg-card)] border border-[var(--border-hairline)]">
                  <div className="text-[11px] text-[var(--text-muted)]">Entradas verificadas</div>
                  <div className="font-mono font-semibold tabular-nums text-[var(--status-ok)] mt-0.5">
                    {zipResult.entryCount} archivos · 0 secretos
                  </div>
                </div>
                <div className="rounded-lg p-2.5 bg-[var(--bg-card)] border border-[var(--border-hairline)]">
                  <div className="text-[11px] text-[var(--text-muted)]">Resumen SHA-256</div>
                  <div className="font-mono text-[11px] tabular-nums text-[var(--text-primary)] truncate mt-0.5">
                    {zipResult.sha256 ? `${zipResult.sha256.slice(0, 20)}…` : 'Verificado'}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Scheduled Automatic Backups Section (Cloud Vault & Local) */}
      <section className="surface-card rounded-2xl p-5 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
              <CalendarClock className="w-4 h-4 text-[var(--accent-primary)]" />
              <span>Programación de Respaldos Automáticos (Nube y Local)</span>
            </div>
            <p className="text-xs text-[var(--text-muted)] max-w-3xl">
              Configura la frecuencia de exportación automática del proyecto hacia la bóveda persistente del servidor o mediante copias locales programadas en tu navegador.
            </p>
          </div>

          <div
            role="tablist"
            aria-label="Destino de respaldos programados"
            className="inline-flex rounded-xl p-1 surface-elevated border border-[var(--border-hairline)] shrink-0 self-start lg:self-auto"
          >
            <button
              type="button"
              role="tab"
              aria-selected={scheduleDestination === 'cloud'}
              onClick={() => setScheduleDestination('cloud')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                scheduleDestination === 'cloud'
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Cloud className="w-3.5 h-3.5" />
              En la Nube
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={scheduleDestination === 'local'}
              onClick={() => setScheduleDestination('local')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                scheduleDestination === 'local'
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5" />
              Local
            </button>
          </div>
        </div>

        {scheduleDestination === 'cloud' ? (
          <div className="space-y-4">
            {session?.role !== 'admin' ? (
              <div className="surface-elevated rounded-xl p-4 space-y-3 text-xs">
                <div className="flex items-start gap-2.5">
                  <KeyRound className="w-4 h-4 text-[var(--accent-primary)] shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-[var(--text-primary)]">
                      Autorización de Administrador requerida para programar la bóveda en la nube
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)]">
                      Los respaldos automáticos del código fuente y estado del servidor generan archivos .ZIP protegidos por RBAC y libres de credenciales.
                    </div>
                  </div>
                </div>
                <form
                  onSubmit={(e) => void handleAuthenticateAdminForZip(e)}
                  className="flex flex-wrap items-center gap-2"
                >
                  <input
                    type="password"
                    value={adminPasscodeInput}
                    onChange={(e) => setAdminPasscodeInput(e.target.value)}
                    placeholder={
                      authInitialized ? 'Contraseña Administrador' : 'Nueva clave Admin (mín. 8)'
                    }
                    aria-label="Contraseña Administrador para programación en la nube"
                    className="px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-xs text-[var(--text-primary)] w-56"
                  />
                  <button
                    type="submit"
                    disabled={isAuthenticatingAdmin}
                    className="px-3.5 py-1.5 rounded-lg bg-[var(--accent-secondary)] text-[var(--accent-contrast)] font-semibold cursor-pointer whitespace-nowrap disabled:opacity-60"
                  >
                    {isAuthenticatingAdmin
                      ? 'Verificando...'
                      : authInitialized
                        ? 'Autorizar Admin'
                        : 'Crear clave y autorizar'}
                  </button>
                </form>
                {adminAuthError && (
                  <div className="text-[11px] text-[var(--status-err)] font-medium">
                    {adminAuthError}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <div className="surface-elevated rounded-xl p-3">
                    <div className="text-[11px] text-[var(--text-muted)]">Estado del programador</div>
                    <div
                      className={`font-semibold mt-0.5 ${
                        cloudState?.schedule.enabled
                          ? 'text-[var(--status-ok)]'
                          : 'text-[var(--text-secondary)]'
                      }`}
                    >
                      {cloudLoading
                        ? 'Consultando...'
                        : cloudState?.schedule.enabled
                          ? 'Activo (Automático)'
                          : 'Pausado'}
                    </div>
                  </div>
                  <div className="surface-elevated rounded-xl p-3">
                    <div className="text-[11px] text-[var(--text-muted)]">Frecuencia guardada</div>
                    <div className="font-mono font-semibold tabular-nums text-[var(--text-primary)] mt-0.5">
                      {BACKUP_FREQUENCY_OPTIONS.find((f) => f.id === cloudState?.schedule.frequency)
                        ?.label ?? 'Diario (24 h)'}
                    </div>
                  </div>
                  <div className="surface-elevated rounded-xl p-3">
                    <div className="text-[11px] text-[var(--text-muted)]">Próxima ejecución</div>
                    <div className="font-mono font-semibold tabular-nums text-[var(--accent-primary)] mt-0.5">
                      {cloudState?.schedule.enabled
                        ? formatTimeUntilIso(cloudState.schedule.nextRunAt, nowTickMs)
                        : 'En pausa'}
                    </div>
                  </div>
                  <div className="surface-elevated rounded-xl p-3">
                    <div className="text-[11px] text-[var(--text-muted)]">Copias en la nube</div>
                    <div className="font-mono font-semibold tabular-nums text-[var(--text-primary)] mt-0.5">
                      {cloudState?.snapshots.length ?? 0} / {cloudState?.schedule.retentionCount ?? cloudRetentionDraft}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <label className="block space-y-1">
                    <span className="text-[var(--text-secondary)] font-medium">
                      Frecuencia de exportación
                    </span>
                    <select
                      value={cloudFreqDraft}
                      onChange={(e) => setCloudFreqDraft(e.target.value as BackupFrequency)}
                      className="w-full px-3 py-2 rounded-lg surface-elevated text-[var(--text-primary)]"
                    >
                      {BACKUP_FREQUENCY_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block space-y-1">
                    <span className="text-[var(--text-secondary)] font-medium">
                      Modalidad de paquete .ZIP
                    </span>
                    <select
                      value={cloudModeDraft}
                      onChange={(e) => setCloudModeDraft(e.target.value as ZipExportModality)}
                      className="w-full px-3 py-2 rounded-lg surface-elevated text-[var(--text-primary)]"
                    >
                      {ZIP_MODALITY_DETAILS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.title}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block space-y-1">
                    <span className="text-[var(--text-secondary)] font-medium">
                      Retención rotativa máxima
                    </span>
                    <select
                      value={cloudRetentionDraft}
                      onChange={(e) => setCloudRetentionDraft(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg surface-elevated text-[var(--text-primary)] font-mono"
                    >
                      {[2, 3, 5, 8, 10].map((n) => (
                        <option key={n} value={n}>
                          Conservar {n} copias en servidor
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={cloudSaving || cloudLoading}
                      onClick={() => void handleSaveCloudSchedule()}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-contrast)] disabled:opacity-60 cursor-pointer whitespace-nowrap"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {cloudSaving ? 'Guardando...' : 'Guardar programación'}
                    </button>

                    <button
                      type="button"
                      disabled={cloudSaving || cloudLoading}
                      onClick={() => void handleSaveCloudSchedule(!cloudState?.schedule.enabled)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border border-[var(--border-strong)] surface-elevated text-[var(--text-primary)] hover:border-[var(--accent-primary)] disabled:opacity-60 cursor-pointer whitespace-nowrap"
                    >
                      {cloudState?.schedule.enabled ? (
                        <>
                          <Pause className="w-3.5 h-3.5" />
                          Pausar automático
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 text-[var(--status-ok)]" />
                          Activar automático
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={cloudRunningNow || cloudState?.isRunning}
                      onClick={() => void handleRunCloudBackupNow()}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border border-[var(--border-strong)] surface-elevated text-[var(--accent-primary)] hover:border-[var(--accent-primary)] disabled:opacity-60 cursor-pointer whitespace-nowrap"
                    >
                      {cloudRunningNow ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Cloud className="w-3.5 h-3.5" />
                      )}
                      {cloudRunningNow ? 'Generando en la nube...' : 'Respaldar en la nube ahora'}
                    </button>
                  </div>

                  {cloudState?.schedule.lastRunAt && (
                    <span className="text-[11px] font-mono tabular-nums text-[var(--text-muted)]">
                      Última ejecución: {new Date(cloudState.schedule.lastRunAt).toLocaleString()}
                    </span>
                  )}
                </div>

                {cloudError && (
                  <div
                    role="alert"
                    className="rounded-xl px-3.5 py-2.5 text-xs bg-[var(--status-err)]/10 border border-[var(--status-err)]/30 text-[var(--status-err)]"
                  >
                    {cloudError}
                  </div>
                )}

                {cloudNotice && (
                  <div className="rounded-xl px-3.5 py-2.5 text-xs bg-[var(--status-ok)]/10 border border-[var(--status-ok)]/30 text-[var(--status-ok)] font-medium">
                    {cloudNotice}
                  </div>
                )}

                <div className="space-y-2 pt-2 border-t border-[var(--border-hairline)]">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[var(--text-primary)]">
                      Instantáneas verificadas en la bóveda del servidor
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      Formato .ZIP auditado (0 secretos)
                    </span>
                  </div>

                  {!cloudState || cloudState.snapshots.length === 0 ? (
                    <p className="text-xs text-[var(--text-muted)] py-2">
                      Aún no existen respaldos almacenados en la bóveda. Activa la programación automática o pulsa &quot;Respaldar en la nube ahora&quot;.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-[var(--border-hairline)] text-[11px] text-[var(--text-muted)]">
                            <th className="py-2 text-left font-medium">Archivo</th>
                            <th className="py-2 text-left font-medium">Modalidad</th>
                            <th className="py-2 text-left font-medium">Fecha</th>
                            <th className="py-2 text-right font-medium">Tamaño</th>
                            <th className="py-2 text-right font-medium">Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cloudState.snapshots.map((snap) => (
                            <tr
                              key={snap.id}
                              className="border-b border-[var(--border-hairline)] last:border-none"
                            >
                              <td className="py-2 pr-3 font-mono text-[var(--text-primary)]">
                                <div className="truncate max-w-[230px]">{snap.filename}</div>
                                <div className="text-[10px] text-[var(--text-muted)]">
                                  SHA-256 {snap.sha256.slice(0, 12)}… · {snap.entryCount} archivos
                                </div>
                              </td>
                              <td className="py-2 pr-3 text-[var(--text-secondary)] whitespace-nowrap">
                                {snap.mode} · {snap.trigger === 'scheduled' ? 'Automático' : 'Manual'}
                              </td>
                              <td className="py-2 pr-3 font-mono tabular-nums text-[var(--text-muted)] whitespace-nowrap">
                                {new Date(snap.createdAt).toLocaleString()}
                              </td>
                              <td className="py-2 pr-3 text-right font-mono tabular-nums text-[var(--text-primary)] whitespace-nowrap">
                                {formatZipByteSize(snap.sizeBytes)}
                              </td>
                              <td className="py-2 text-right whitespace-nowrap">
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => void handleDownloadCloudSnapshot(snap)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[var(--border-strong)] hover:border-[var(--accent-primary)] text-[var(--accent-primary)] font-medium cursor-pointer"
                                  >
                                    <Download className="w-3 h-3" />
                                    Descargar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void handleDeleteCloudSnapshot(snap.id)}
                                    aria-label={`Eliminar respaldo ${snap.filename}`}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-[var(--border-hairline)] hover:border-[var(--status-err)] text-[var(--status-err)] cursor-pointer"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="surface-elevated rounded-xl p-3">
                <div className="text-[11px] text-[var(--text-muted)]">Estado local</div>
                <div
                  className={`font-semibold mt-0.5 ${
                    localBackupSchedule.enabled
                      ? 'text-[var(--status-ok)]'
                      : 'text-[var(--text-secondary)]'
                  }`}
                >
                  {localBackupSchedule.enabled ? 'Activo (Navegador)' : 'Pausado'}
                </div>
              </div>
              <div className="surface-elevated rounded-xl p-3">
                <div className="text-[11px] text-[var(--text-muted)]">Frecuencia guardada</div>
                <div className="font-mono font-semibold tabular-nums text-[var(--text-primary)] mt-0.5">
                  {BACKUP_FREQUENCY_OPTIONS.find((f) => f.id === localBackupSchedule.frequency)
                    ?.label ?? 'Cada 1 hora'}
                </div>
              </div>
              <div className="surface-elevated rounded-xl p-3">
                <div className="text-[11px] text-[var(--text-muted)]">Próxima exportación</div>
                <div className="font-mono font-semibold tabular-nums text-[var(--accent-primary)] mt-0.5">
                  {localBackupSchedule.enabled
                    ? formatTimeUntilIso(localBackupSchedule.nextRunAt, nowTickMs)
                    : 'En pausa'}
                </div>
              </div>
              <div className="surface-elevated rounded-xl p-3">
                <div className="text-[11px] text-[var(--text-muted)]">Historial retenido</div>
                <div className="font-mono font-semibold tabular-nums text-[var(--text-primary)] mt-0.5">
                  {localBackupSchedule.history.length} / {localBackupSchedule.retentionCount}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <label className="block space-y-1">
                <span className="text-[var(--text-secondary)] font-medium">
                  Frecuencia de exportación
                </span>
                <select
                  value={localFreqDraft}
                  onChange={(e) => setLocalFreqDraft(e.target.value as BackupFrequency)}
                  className="w-full px-3 py-2 rounded-lg surface-elevated text-[var(--text-primary)]"
                >
                  {BACKUP_FREQUENCY_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1">
                <span className="text-[var(--text-secondary)] font-medium">
                  Formato de salida local
                </span>
                <select
                  value={localFormatDraft}
                  onChange={(e) => setLocalFormatDraft(e.target.value as LocalBackupFormat)}
                  className="w-full px-3 py-2 rounded-lg surface-elevated text-[var(--text-primary)]"
                >
                  <option value="json-secure">Estado + Modelos (.JSON SHA-256)</option>
                  <option value="zip-backend">Código Fuente + Estado (.ZIP Admin)</option>
                </select>
              </label>

              <label className="block space-y-1">
                <span className="text-[var(--text-secondary)] font-medium">
                  Modalidad (para .ZIP)
                </span>
                <select
                  value={localModeDraft}
                  onChange={(e) => setLocalModeDraft(e.target.value as ZipExportModality)}
                  className="w-full px-3 py-2 rounded-lg surface-elevated text-[var(--text-primary)]"
                >
                  {ZIP_MODALITY_DETAILS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1">
                <span className="text-[var(--text-secondary)] font-medium">
                  Historial local retenido
                </span>
                <select
                  value={localRetentionDraft}
                  onChange={(e) => setLocalRetentionDraft(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg surface-elevated text-[var(--text-primary)] font-mono"
                >
                  {[2, 3, 5, 8, 10].map((n) => (
                    <option key={n} value={n}>
                      Conservar {n} registros
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={localAutoDownloadDraft}
                  onChange={(e) => setLocalAutoDownloadDraft(e.target.checked)}
                  className="accent-[var(--accent-primary)]"
                />
                Descargar automáticamente el archivo al cumplirse el intervalo (si está desmarcado solo guarda la instantánea interna)
              </label>

              {localBackupSchedule.lastRunAt && (
                <span className="text-[11px] font-mono tabular-nums text-[var(--text-muted)]">
                  Última ejecución: {new Date(localBackupSchedule.lastRunAt).toLocaleString()}
                </span>
              )}
            </div>

            {localFormatDraft === 'zip-backend' && session?.role !== 'admin' && (
              <div className="rounded-xl px-3.5 py-2.5 text-xs bg-[var(--status-warn)]/10 border border-[var(--status-warn)]/30 text-[var(--status-warn)]">
                Nota: para exportar paquetes .ZIP completos de forma automática debes desbloquear una sesión Administrador en la sección ZIP superior o en la pestaña &quot;En la Nube&quot;.
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleSaveLocalSchedule()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-contrast)] cursor-pointer whitespace-nowrap"
              >
                <Save className="w-3.5 h-3.5" />
                Guardar programación local
              </button>

              <button
                type="button"
                onClick={() => handleSaveLocalSchedule(!localBackupSchedule.enabled)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border border-[var(--border-strong)] surface-elevated text-[var(--text-primary)] hover:border-[var(--accent-primary)] cursor-pointer whitespace-nowrap"
              >
                {localBackupSchedule.enabled ? (
                  <>
                    <Pause className="w-3.5 h-3.5" />
                    Pausar automático local
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 text-[var(--status-ok)]" />
                    Activar automático local
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={localRunningNow}
                onClick={() => void handleRunLocalBackupNow()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border border-[var(--border-strong)] surface-elevated text-[var(--accent-primary)] hover:border-[var(--accent-primary)] disabled:opacity-60 cursor-pointer whitespace-nowrap"
              >
                {localRunningNow ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <HardDrive className="w-3.5 h-3.5" />
                )}
                {localRunningNow ? 'Exportando respaldo...' : 'Ejecutar respaldo local ahora'}
              </button>
            </div>

            {localNotice && (
              <div
                role="alert"
                className={`rounded-xl px-3.5 py-2.5 text-xs font-medium ${
                  localNotice.type === 'ok'
                    ? 'bg-[var(--status-ok)]/10 border border-[var(--status-ok)]/30 text-[var(--status-ok)]'
                    : 'bg-[var(--status-err)]/10 border border-[var(--status-err)]/30 text-[var(--status-err)]'
                }`}
              >
                {localNotice.text}
              </div>
            )}

            <div className="space-y-2 pt-2 border-t border-[var(--border-hairline)]">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[var(--text-primary)]">
                  Registro reciente de exportaciones locales programadas
                </span>
                {localBackupSchedule.history.length > 0 && (
                  <button
                    type="button"
                    onClick={clearLocalBackupHistory}
                    className="text-[11px] text-[var(--text-muted)] hover:text-[var(--status-err)] cursor-pointer"
                  >
                    Limpiar historial
                  </button>
                )}
              </div>

              {localBackupSchedule.history.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] py-2">
                  Todavía no hay ejecuciones registradas en el historial de respaldo local automático.
                </p>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {localBackupSchedule.history.map((entry) => (
                    <div
                      key={entry.id}
                      className="surface-elevated rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-mono font-semibold text-[var(--text-primary)] truncate">
                          {entry.filename}
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)]">
                          {new Date(entry.timestamp).toLocaleString()} ·{' '}
                          {entry.trigger === 'scheduled' ? 'Automático' : 'Manual'} · {entry.detail}
                        </div>
                      </div>
                      <span
                        className={`text-[11px] font-mono font-semibold ${
                          entry.status === 'ok'
                            ? 'text-[var(--status-ok)]'
                            : 'text-[var(--status-err)]'
                        }`}
                      >
                        {entry.status === 'ok' ? 'Completado' : 'Error'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {backupMessage && (
        <div
          role="alert"
          className={`rounded-xl px-4 py-3 text-xs font-medium ${
            backupMessage.type === 'ok'
              ? 'bg-[var(--status-ok)]/10 text-[var(--status-ok)] border border-[var(--status-ok)]/30'
              : 'bg-[var(--status-err)]/10 text-[var(--status-err)] border border-[var(--status-err)]/30'
          }`}
        >
          {backupMessage.text}
        </div>
      )}

      {/* Multi-slot Backup, Data Privacy & Versioning */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 surface-card rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
              <Archive className="w-4 h-4 text-[var(--accent-primary)]" />
              <span>Respaldo Multiranura (Buffer Circular de 5 Instantáneas)</span>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  createManualBackupSnapshot('Respaldo manual desde Configuración');
                  setBackupMessage({
                    type: 'ok',
                    text: 'Instantánea guardada sin sobrescribir copias previas.',
                  });
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] text-[var(--accent-contrast)] font-semibold cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                Crear respaldo
              </button>
              <button
                type="button"
                onClick={handleExportBackupJson}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-hairline)] surface-elevated text-[var(--text-primary)] cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Exportar .json
              </button>
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-hairline)] surface-elevated text-[var(--text-primary)] cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                Importar .json
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImportBackupFile}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {backupSnapshots.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">
              Aún no hay instantáneas guardadas en localStorage. Pulsa &quot;Crear respaldo&quot; para almacenar hasta 5 versiones rotativas sin sobrescribir la anterior.
            </p>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {backupSnapshots.map((snap) => (
                <div
                  key={snap.id}
                  className="surface-elevated rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <div className="font-semibold text-[var(--text-primary)]">{snap.reason}</div>
                    <div className="text-[11px] font-mono text-[var(--text-muted)]">
                      {new Date(snap.createdAt).toLocaleString()} · Tema {snap.payload.theme} ·{' '}
                      {snap.payload.simulationHistory.length} sim. · {snap.payload.reportHistory.length} inf.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      restoreFromBackupPayload(snap.payload);
                      setBackupMessage({
                        type: 'ok',
                        text: `Instantánea de ${new Date(snap.createdAt).toLocaleTimeString()} restaurada.`,
                      });
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--border-strong)] hover:border-[var(--accent-primary)] text-[var(--accent-primary)] font-medium cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Restaurar
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Privacy & One-Click Data Wipe */}
          <div className="pt-3 border-t border-[var(--border-hairline)] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)]">
                <ShieldCheck className="w-4 h-4 text-[var(--status-ok)]" />
                <span>Privacidad, Inventario de Datos y Limpieza</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  clearAllExperimentalData();
                  setBackupMessage({
                    type: 'ok',
                    text: 'Datos experimentales de sesión eliminados (se guardó copia de seguridad previa).',
                  });
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--status-err)]/40 text-[var(--status-err)] hover:bg-[var(--status-err)]/10 text-xs font-semibold cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Eliminar datos experimentales y de sesión
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-[var(--border-hairline)] text-[var(--text-muted)]">
                    <th className="py-1.5 text-left">Clave localStorage</th>
                    <th className="py-1.5 text-left">Propósito</th>
                    <th className="py-1.5 text-right">Secretos</th>
                  </tr>
                </thead>
                <tbody>
                  {STORAGE_INVENTORY.map((item) => (
                    <tr key={item.key} className="border-b border-[var(--border-hairline)] last:border-none">
                      <td className="py-1.5 pr-2 font-mono text-[var(--accent-primary)]">{item.key}</td>
                      <td className="py-1.5 pr-2 text-[var(--text-secondary)]">{item.purpose}</td>
                      <td className="py-1.5 text-right font-mono text-[var(--status-ok)]">
                        {item.containsSecrets ? 'Sí' : 'Ninguno'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="lg:col-span-5 surface-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
            <History className="w-4 h-4 text-[var(--accent-secondary)]" />
            <span>Historial de Versiones (Changelog)</span>
          </div>
          <div className="space-y-3">
            {CHANGELOG_ENTRIES.map((rel) => (
              <div key={rel.version} className="surface-elevated rounded-xl p-3.5 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-[var(--accent-primary)]">
                    v{rel.version}
                  </span>
                  <span className="font-mono text-[11px] text-[var(--text-muted)]">{rel.date}</span>
                </div>
                <div className="font-medium text-[var(--text-primary)]">{rel.summary}</div>
                <ul className="list-disc pl-4 space-y-1 text-[11px] text-[var(--text-secondary)]">
                  {rel.items.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
