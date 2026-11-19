import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  BarChart3,
  BookOpen,
  Bot,
  Box,
  Calculator,
  CheckSquare,
  Compass,
  Cpu,
  Droplets,
  Eye,
  FileDown,
  FileText,
  FlaskConical,
  Grid3X3,
  LayoutDashboard,
  Loader2,
  Menu,
  Network,
  Server,
  Shield,
  SlidersHorizontal,
  User,
  X,
} from 'lucide-react';
import { DashboardView } from './components/DashboardView';
import { ModuleErrorBoundary } from './components/ErrorBoundary';
import { ThemeSwitcher } from './components/ThemeSwitcher';
import { VectorIALogo } from './components/VectorIALogo';
import { NeuralHeaderBackdrop } from './components/NeuralHeaderBackdrop';
import { GlobalSearchBar } from './components/GlobalSearchBar';
import { WelcomeTutorialOverlay } from './components/WelcomeTutorialOverlay';
import { BuilderProvider, useBuilder } from './context/BuilderContext';
import { BuilderModificationProvider } from './components/builder/builderContext';
import { StudioProvider, useStudio } from './context/StudioContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { exportMainAreaToPdf, LAB_ANALYSIS_MODULE_IDS } from './services/pdfExportService';
import { executeLocalBackupExport } from './services/localBackupRunner';
import { ModuleId } from './types/vectoria';
import { updateDocumentFavicon } from './utils/dynamicFavicon';
import { buildGlobalSearchEntries } from './utils/globalSearch';
import { isBackupDue } from './utils/scheduledBackup';

const SimulationLabView = lazy(() =>
  import('./components/SimulationLabView').then((m) => ({ default: m.SimulationLabView }))
);
const AlphanumericClassifierView = lazy(() =>
  import('./components/AlphanumericClassifierView').then((m) => ({
    default: m.AlphanumericClassifierView,
  }))
);
const XaiView = lazy(() =>
  import('./components/XaiView').then((m) => ({ default: m.XaiView }))
);
const NeuralTopologyView = lazy(() =>
  import('./components/NeuralTopologyView').then((m) => ({ default: m.NeuralTopologyView }))
);
const NeuralEngineeringLabView = lazy(() =>
  import('./components/NeuralEngineeringLabView').then((m) => ({
    default: m.NeuralEngineeringLabView,
  }))
);
const SmartIrrigationLabView = lazy(() =>
  import('./components/SmartIrrigationLabView').then((m) => ({
    default: m.SmartIrrigationLabView,
  }))
);
const LinearAlgebraLabView = lazy(() =>
  import('./components/LinearAlgebraLabView').then((m) => ({
    default: m.LinearAlgebraLabView,
  }))
);
const GeometryLabView = lazy(() =>
  import('./components/GeometryLabView').then((m) => ({ default: m.GeometryLabView }))
);
const OmniBotView = lazy(() =>
  import('./components/OmniBotView').then((m) => ({ default: m.OmniBotView }))
);
const EvaluationCenterView = lazy(() =>
  import('./components/EvaluationCenterView').then((m) => ({
    default: m.EvaluationCenterView,
  }))
);
const AnalyticsView = lazy(() =>
  import('./components/AnalyticsView').then((m) => ({ default: m.AnalyticsView }))
);
const RobustnessView = lazy(() =>
  import('./components/RobustnessView').then((m) => ({ default: m.RobustnessView }))
);
const VerificationView = lazy(() =>
  import('./components/VerificationView').then((m) => ({ default: m.VerificationView }))
);
const SourcesView = lazy(() =>
  import('./components/SourcesReportsApiAccountViews').then((m) => ({
    default: m.SourcesView,
  }))
);
const ReportsView = lazy(() =>
  import('./components/SourcesReportsApiAccountViews').then((m) => ({
    default: m.ReportsView,
  }))
);
const ApiConsoleView = lazy(() =>
  import('./components/SourcesReportsApiAccountViews').then((m) => ({
    default: m.ApiConsoleView,
  }))
);
const AccountView = lazy(() =>
  import('./components/SourcesReportsApiAccountViews').then((m) => ({
    default: m.AccountView,
  }))
);
const VisualBuilderView = lazy(() =>
  import('./components/builder/VisualBuilderView').then((m) => ({
    default: m.VisualBuilderView,
  }))
);
const PublishedPageView = lazy(() =>
  import('./components/builder/PublishedPageView').then((m) => ({
    default: m.PublishedPageView,
  }))
);

interface NavItem {
  id: ModuleId;
  label: string;
  group: 'principal' | 'laboratorios' | 'analisis';
  icon: React.FC<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Panel Principal', group: 'principal', icon: LayoutDashboard },
  { id: 'simulation-lab', label: 'Simulation Lab', group: 'laboratorios', icon: FlaskConical },
  { id: 'classifier', label: 'Clasificador Alfanumérico', group: 'laboratorios', icon: Grid3X3 },
  { id: 'xai', label: 'IA Explicable (XAI)', group: 'laboratorios', icon: Eye },
  { id: 'topology', label: 'Neural Topology', group: 'laboratorios', icon: Network },
  { id: 'neural-lab', label: 'Ingeniería Neuronal', group: 'laboratorios', icon: Cpu },
  { id: 'smart-irrigation', label: 'Riego Inteligente (MLP)', group: 'laboratorios', icon: Droplets },
  { id: 'linear-algebra', label: 'Álgebra Lineal', group: 'laboratorios', icon: Calculator },
  { id: 'geometry', label: 'Geometría 2D / 3D', group: 'laboratorios', icon: Box },
  { id: 'omni-bot', label: 'Omni Bot', group: 'laboratorios', icon: Bot },
  { id: 'evaluation', label: 'Evaluación de Modelos', group: 'analisis', icon: Award },
  { id: 'analytics', label: 'Métricas y Analítica', group: 'analisis', icon: BarChart3 },
  { id: 'robustness', label: 'Robustez', group: 'analisis', icon: Shield },
  { id: 'verification', label: 'Calidad y Seguridad', group: 'analisis', icon: CheckSquare },
  { id: 'sources', label: 'Fuentes Académicas', group: 'analisis', icon: BookOpen },
  { id: 'reports', label: 'Informes Técnicos', group: 'analisis', icon: FileText },
  { id: 'api-console', label: 'Consola API', group: 'analisis', icon: Server },
  { id: 'visual-builder', label: 'Visual Builder', group: 'principal', icon: SlidersHorizontal },
  { id: 'account', label: 'Configuración y Usuario', group: 'principal', icon: User },
];

const ModuleFallback: React.FC = () => (
  <div className="surface-card rounded-2xl p-8 text-center text-xs text-[var(--text-muted)]">
    Cargando módulo de VectorIA Studio...
  </div>
);

const StudioShell: React.FC = () => {
  const {
    activeModule,
    setActiveModule,
    classifierMode,
    alphanumericSummary,
    logEvent,
    userProfile,
    sharedMatrix2D,
    simulationConfig,
    simulationHistory,
    predictionHistory,
    mnist784PerturbConfig,
    mnist784PerturbResult,
    last232Step,
    reportHistory,
    suiteRef,
    createManualBackupSnapshot,
    localBackupSchedule,
    recordLocalBackupExecution,
    isTutorialOpen,
    openTutorial,
    closeTutorial,
  } = useStudio();
  const {
    published,
    publishedCustomPages,
    activeCustomPageId,
    setActiveCustomPageId,
    session,
  } = useBuilder();
  const { theme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [pdfFeedback, setPdfFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const mainAreaRef = useRef<HTMLElement | null>(null);
  const localBackupInFlightRef = useRef(false);

  const latestBackupDepsRef = useRef({
    localBackupSchedule,
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
    suiteRef,
    createManualBackupSnapshot,
    recordLocalBackupExecution,
    logEvent,
    session,
  });
  latestBackupDepsRef.current = {
    localBackupSchedule,
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
    suiteRef,
    createManualBackupSnapshot,
    recordLocalBackupExecution,
    logEvent,
    session,
  };

  useEffect(() => {
    if (!localBackupSchedule.enabled) return;

    const runIfDue = async () => {
      if (localBackupInFlightRef.current) return;
      const deps = latestBackupDepsRef.current;
      if (!isBackupDue(deps.localBackupSchedule)) return;
      localBackupInFlightRef.current = true;
      try {
        const entry = await executeLocalBackupExport({
          schedule: deps.localBackupSchedule,
          trigger: 'scheduled',
          theme: deps.theme,
          classifierMode: deps.classifierMode,
          userProfile: deps.userProfile,
          sharedMatrix2D: deps.sharedMatrix2D,
          simulationConfig: deps.simulationConfig,
          simulationHistory: deps.simulationHistory,
          predictionHistory: deps.predictionHistory,
          mnist784PerturbConfig: deps.mnist784PerturbConfig,
          mnist784PerturbResult: deps.mnist784PerturbResult,
          last232Step: deps.last232Step,
          reportHistory: deps.reportHistory,
          suite: deps.suiteRef.current,
          token: deps.session?.token ?? null,
          role: deps.session?.role ?? null,
          createManualBackupSnapshot: deps.createManualBackupSnapshot,
        });
        deps.recordLocalBackupExecution(entry);
        deps.logEvent(
          'system',
          entry.status === 'ok'
            ? `Respaldo local automático completado (${entry.format === 'zip-backend' ? '.ZIP' : '.JSON'})`
            : 'Error en respaldo local automático',
          `${entry.filename} · ${entry.detail}`,
          entry.status === 'ok' ? 'ok' : 'error'
        );
      } finally {
        localBackupInFlightRef.current = false;
      }
    };

    void runIfDue();
    const timer = window.setInterval(() => {
      void runIfDue();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [localBackupSchedule.enabled, localBackupSchedule.nextRunAt]);

  const activeCustomPage = activeCustomPageId
    ? publishedCustomPages.find((p) => p.id === activeCustomPageId) ?? null
    : null;
  const currentNav = NAV_ITEMS.find((n) => n.id === activeModule) ?? NAV_ITEMS[0];
  const hiddenSet = new Set(published.hiddenSystemModules);
  const isLabAnalysisView = !activeCustomPage && LAB_ANALYSIS_MODULE_IDS.has(activeModule);

  const searchEntries = useMemo(
    () =>
      buildGlobalSearchEntries(
        NAV_ITEMS,
        published.hiddenSystemModules,
        publishedCustomPages
      ),
    [published.hiddenSystemModules, publishedCustomPages]
  );

  const iconByModuleId = useMemo(() => {
    const map: Partial<Record<ModuleId, React.FC<{ className?: string }>>> = {};
    for (const item of NAV_ITEMS) {
      map[item.id] = item.icon;
    }
    return map;
  }, []);

  const handleSelectModule = (id: ModuleId) => {
    setActiveCustomPageId(null);
    setActiveModule(id);
    setPdfFeedback(null);
    setMobileMenuOpen(false);
  };

  const handleSelectCustomPage = (pageId: string) => {
    setActiveCustomPageId(pageId);
    setPdfFeedback(null);
    setMobileMenuOpen(false);
  };

  const handleExportCurrentLabPdf = async () => {
    const targetEl = mainAreaRef.current;
    if (!targetEl || isExportingPdf) return;
    setIsExportingPdf(true);
    setPdfFeedback(null);
    try {
      const result = await exportMainAreaToPdf({
        element: targetEl,
        moduleId: activeModule,
        moduleTitle: currentNav.label,
        authorName: userProfile.name,
        program: userProfile.program,
      });
      setPdfFeedback({
        type: 'ok',
        text: `PDF generado (${result.pageCount} pág.): ${result.filename}`,
      });
      logEvent(
        'system',
        `Análisis exportado a PDF (${currentNav.label})`,
        `${result.filename} · ${result.pageCount} páginas`,
        'ok'
      );
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'No se pudo generar el reporte PDF del análisis.';
      setPdfFeedback({ type: 'err', text: msg });
      logEvent('system', `Error al exportar PDF (${currentNav.label})`, msg, 'error');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const renderModule = () => {
    if (activeCustomPage) {
      return <PublishedPageView page={activeCustomPage} />;
    }
    switch (activeModule) {
      case 'dashboard':
        return <DashboardView />;
      case 'simulation-lab':
        return <SimulationLabView />;
      case 'classifier':
        return <AlphanumericClassifierView />;
      case 'xai':
        return <XaiView />;
      case 'topology':
        return <NeuralTopologyView />;
      case 'neural-lab':
        return <NeuralEngineeringLabView />;
      case 'smart-irrigation':
        return <SmartIrrigationLabView />;
      case 'linear-algebra':
        return <LinearAlgebraLabView />;
      case 'geometry':
        return <GeometryLabView />;
      case 'omni-bot':
        return <OmniBotView />;
      case 'evaluation':
        return <EvaluationCenterView />;
      case 'analytics':
        return <AnalyticsView />;
      case 'robustness':
        return <RobustnessView />;
      case 'verification':
        return <VerificationView />;
      case 'sources':
        return <SourcesView />;
      case 'reports':
        return <ReportsView />;
      case 'api-console':
        return <ApiConsoleView />;
      case 'visual-builder':
        return <VisualBuilderView />;
      case 'account':
        return <AccountView />;
    }
  };

  const renderNavGroup = (group: NavItem['group'], heading: string) => (
    <div className="space-y-1">
      <div className="px-3 py-1.5 text-[11px] font-semibold text-[var(--text-muted)]">
        {heading}
      </div>
      {NAV_ITEMS.filter((item) => item.group === group && !hiddenSet.has(item.id)).map((item) => {
        const Icon = item.icon;
        const active = !activeCustomPage && item.id === activeModule;
        return (
          <button
            key={item.id}
            type="button"
            data-tour-module={item.id}
            onClick={() => handleSelectModule(item.id)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left ${
              active
                ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)] font-semibold'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </button>
        );
      })}
      {group === 'principal' &&
        publishedCustomPages.map((page) => {
          const active = activeCustomPage?.id === page.id;
          return (
            <button
              key={page.id}
              type="button"
              onClick={() => handleSelectCustomPage(page.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left ${
                active
                  ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)] font-semibold'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span className="truncate">{page.title}</span>
            </button>
          );
        })}
    </div>
  );

  return (
    <div className="relative min-h-screen flex flex-col lg:flex-row text-[var(--text-primary)]">
      {theme === 'neural-cyberpunk' && (
        <svg
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 w-full h-full z-0 opacity-[0.16]"
          viewBox="0 0 1200 800"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <linearGradient id="nc-edge-a" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#2f7cf6" />
              <stop offset="50%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#d946ef" />
            </linearGradient>
          </defs>
          <g stroke="url(#nc-edge-a)" strokeWidth="1" fill="none">
            <path d="M120 140 L380 230 L670 110 L980 250" />
            <path d="M210 560 L460 410 L760 520 L1060 390" />
            <path d="M380 230 L460 410 L670 110 L760 520" strokeOpacity="0.6" />
            <path d="M120 140 L210 560 M980 250 L1060 390" strokeOpacity="0.45" />
          </g>
          <g fill="#22d3ee">
            <circle cx="120" cy="140" r="3" />
            <circle cx="380" cy="230" r="3.5" />
            <circle cx="670" cy="110" r="3" />
            <circle cx="980" cy="250" r="3.5" />
            <circle cx="210" cy="560" r="3" />
            <circle cx="460" cy="410" r="3.5" />
            <circle cx="760" cy="520" r="3" />
            <circle cx="1060" cy="390" r="3.5" />
          </g>
        </svg>
      )}
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-[var(--border-hairline)] bg-[var(--bg-surface)] z-20">
        <div className="relative overflow-hidden h-16 px-4 flex items-center justify-between border-b border-[var(--border-hairline)]">
          <NeuralHeaderBackdrop variant="sidebar-header" />
          <button
            type="button"
            onClick={() => handleSelectModule('dashboard')}
            className="relative z-10 cursor-pointer text-left"
            aria-label="Ir al Panel Principal de VectorIA Studio"
          >
            <VectorIALogo variant="full" size="sm" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-5" aria-label="Navegación principal">
          {renderNavGroup('principal', 'Inicio y Perfil')}
          {renderNavGroup('laboratorios', 'Laboratorios Interactivos')}
          {renderNavGroup('analisis', 'Analítica, Calidad e Informes')}
        </nav>

        <div className="p-4 border-t border-[var(--border-hairline)] text-[11px] text-[var(--text-muted)] space-y-2">
          <div>Modelo 36 clases: {alphanumericSummary.isTrained ? 'Entrenado' : 'Pendiente'}</div>
          <button
            type="button"
            onClick={openTutorial}
            className="inline-flex items-center gap-1.5 text-[var(--accent-primary)] font-medium hover:underline cursor-pointer"
          >
            <Compass className="w-3.5 h-3.5" />
            Tutorial guiado de bienvenida
          </button>
        </div>
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] bg-[var(--bg-surface)] border-r border-[var(--border-hairline)] flex flex-col h-full z-50">
            <div className="relative overflow-hidden h-14 px-4 flex items-center justify-between border-b border-[var(--border-hairline)]">
              <NeuralHeaderBackdrop variant="sidebar-header" />
              <div className="relative z-10">
                <VectorIALogo variant="full" size="sm" />
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Cerrar menú"
                className="relative z-10 p-2 rounded-lg hover:bg-[var(--bg-elevated)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 space-y-5">
              {renderNavGroup('principal', 'Inicio y Perfil')}
              {renderNavGroup('laboratorios', 'Laboratorios Interactivos')}
              {renderNavGroup('analisis', 'Analítica, Calidad e Informes')}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="relative z-10 flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Clean 3-Zone Top Bar */}
        <header className="sticky top-0 z-20 h-16 px-4 sm:px-6 flex items-center justify-between gap-3 sm:gap-4 border-b border-[var(--border-hairline)] glass-panel">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir navegación"
              className="lg:hidden p-2 rounded-lg border border-[var(--border-hairline)] hover:bg-[var(--bg-elevated)] cursor-pointer shrink-0"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-xs sm:text-sm min-w-0">
              <span className="text-[var(--text-muted)] hidden sm:inline whitespace-nowrap">
                VectorIA Studio
              </span>
              <span className="text-[var(--text-muted)] hidden sm:inline" aria-hidden="true">
                /
              </span>
              <span className="font-semibold text-[var(--text-primary)] truncate">
                {activeCustomPage ? activeCustomPage.title : currentNav.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <GlobalSearchBar
              entries={searchEntries}
              activeModule={activeModule}
              activeCustomPageId={activeCustomPageId}
              iconByModuleId={iconByModuleId}
              onSelectModule={handleSelectModule}
              onSelectCustomPage={handleSelectCustomPage}
            />
            <ThemeSwitcher compact />
            <button
              type="button"
              onClick={() => handleSelectModule('omni-bot')}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-contrast)] whitespace-nowrap shrink-0 cursor-pointer"
            >
              Omni Bot
            </button>
          </div>
        </header>

        <main
          id="vectoria-main-content"
          ref={mainAreaRef}
          className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto"
        >
          {isLabAnalysisView && (
            <div
              data-pdf-ignore="true"
              className="no-print mb-5 surface-elevated rounded-xl px-4 py-2.5 border border-[var(--border-hairline)] flex flex-wrap items-center justify-between gap-3 text-xs"
            >
              <div className="flex flex-wrap items-center gap-2 text-[var(--text-muted)] min-w-0">
                <span className="font-medium text-[var(--text-secondary)]">
                  Reporte imprimible del área principal
                </span>
                {pdfFeedback && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span
                      className={
                        pdfFeedback.type === 'ok'
                          ? 'text-[var(--status-ok)] font-medium'
                          : 'text-[var(--status-err)] font-medium'
                      }
                    >
                      {pdfFeedback.text}
                    </span>
                  </>
                )}
              </div>
              <button
                type="button"
                disabled={isExportingPdf}
                onClick={() => void handleExportCurrentLabPdf()}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-strong)] bg-[var(--bg-surface)] hover:border-[var(--accent-primary)] text-[var(--text-primary)] disabled:opacity-60 cursor-pointer whitespace-nowrap shrink-0"
              >
                {isExportingPdf ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--accent-primary)]" />
                ) : (
                  <FileDown className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                )}
                {isExportingPdf ? 'Capturando PDF...' : 'Exportar Análisis a PDF'}
              </button>
            </div>
          )}

          <ModuleErrorBoundary
            key={activeCustomPage ? activeCustomPage.id : activeModule}
            moduleName={activeCustomPage ? activeCustomPage.title : currentNav.label}
            onReturnHome={() => handleSelectModule('dashboard')}
            onErrorCaptured={(modName, msg) =>
              logEvent('system', `Recuperación en ${modName}`, msg, 'error')
            }
          >
            <Suspense fallback={<ModuleFallback />}>{renderModule()}</Suspense>
          </ModuleErrorBoundary>
        </main>
      </div>

      <WelcomeTutorialOverlay
        open={isTutorialOpen}
        onDismiss={closeTutorial}
        onNavigate={handleSelectModule}
      />
    </div>
  );
};

const DynamicFaviconSync: React.FC = () => {
  const { theme } = useTheme();

  useEffect(() => {
    updateDocumentFavicon(theme);
  }, [theme]);

  return null;
};

export default function App() {
  return (
    <ThemeProvider>
      <DynamicFaviconSync />
      <ModuleErrorBoundary moduleName="VectorIA Studio">
        <StudioProvider>
          <BuilderProvider>
            <BuilderModificationProvider>
              <StudioShell />
            </BuilderModificationProvider>
          </BuilderProvider>
        </StudioProvider>
      </ModuleErrorBoundary>
    </ThemeProvider>
  );
}
