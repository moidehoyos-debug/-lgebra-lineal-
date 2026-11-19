import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  FileArchive,
  FolderPlus,
  GripVertical,
  History,
  Layers,
  Lock,
  LogOut,
  Monitor,
  Palette,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  ShieldCheck,
  Smartphone,
  Tablet,
  Trash2,
  Undo2,
  Upload,
} from 'lucide-react';
import { useBuilder } from '../../context/BuilderContext';
import { useStudio } from '../../context/StudioContext';
import {
  BuilderBlock,
  BuilderComponentCategory,
  BuilderRole,
  BuilderSection,
  BuilderStateDocument,
  BuilderVersionEntry,
  PreparedModuleSpec,
} from '../../types/builder';
import {
  BUILDER_COMPONENT_LIBRARY,
  ComponentPaletteItem,
} from '../../utils/builderDefaults';
import { validateAndSanitizeBuilderDocument } from '../../utils/builderSecurity';
import {
  BuilderAdvancedPanel,
  BuilderHistoryAndCompare,
  BuilderPageManager,
  BuilderThemeCustomizer,
} from './BuilderAdminSubpanels';
import { BuilderBlockRenderer } from './BuilderBlockRenderer';
import { BuilderPropertyInspector } from './BuilderPropertyInspector';
import { ZipExportModal } from './ZipExportModal';

const CATEGORY_TABS: Array<{ id: BuilderComponentCategory; label: string }> = [
  { id: 'estructura', label: 'Estructura' },
  { id: 'contenido', label: 'Contenido' },
  { id: 'diseno', label: 'Diseño' },
  { id: 'graficas', label: 'Gráficas' },
  { id: 'indicadores', label: 'Indicadores' },
  { id: 'matematicas', label: 'Matemáticas' },
  { id: 'ia', label: 'Inteligencia artificial' },
  { id: 'herramientas', label: 'Herramientas' },
  { id: 'modulos', label: 'Módulos' },
];

type WorkspaceViewTab = 'canvas' | 'pages' | 'themes' | 'advanced' | 'history';
type PreviewViewport = 'desktop' | 'tablet' | 'mobile';

export const VisualBuilderView: React.FC = () => {
  const {
    session,
    authInitialized,
    diskPersisted,
    setupAdminPasscode,
    loginBuilder,
    logoutBuilder,
    fetchFullBundle,
    saveDraftRemote,
    publishDraftRemote,
    discardDraftRemote,
    restoreVersionRemote,
    published: contextPublished,
  } = useBuilder();
  const { setActiveModule, logEvent } = useStudio();

  // Auth form state
  const [setupAdminPass, setSetupAdminPass] = useState('');
  const [setupEditorPass, setSetupEditorPass] = useState('');
  const [setupViewerPass, setSetupViewerPass] = useState('');
  const [setupToken, setSetupToken] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginRole, setLoginRole] = useState<BuilderRole>('admin');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  // Editor state
  const [draft, setDraft] = useState<BuilderStateDocument>(() =>
    JSON.parse(JSON.stringify(contextPublished))
  );
  const [publishedDoc, setPublishedDoc] = useState<BuilderStateDocument>(contextPublished);
  const [versions, setVersions] = useState<BuilderVersionEntry[]>([]);
  const [hasServerPendingPublish, setHasServerPendingPublish] = useState(false);
  const [hasUnsavedLocalEdits, setHasUnsavedLocalEdits] = useState(false);
  const [undoStack, setUndoStack] = useState<BuilderStateDocument[]>([]);
  const [redoStack, setRedoStack] = useState<BuilderStateDocument[]>([]);

  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceViewTab>('canvas');
  const [activeCategory, setActiveCategory] = useState<BuilderComponentCategory>('estructura');
  const [activePageId, setActivePageId] = useState<string>(draft.pages[0]?.id ?? '');
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [viewport, setViewport] = useState<PreviewViewport>('desktop');

  const [statusBanner, setStatusBanner] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [showZipExportModal, setShowZipExportModal] = useState(false);
  const [publishNote, setPublishNote] = useState('Actualización validada desde Visual Builder');
  const [busyAction, setBusyAction] = useState(false);
  const [dragBlockId, setDragBlockId] = useState<string | null>(null);

  const loadRemoteState = useCallback(async () => {
    const res = await fetchFullBundle();
    if (res.ok && res.draft && res.published) {
      setDraft(res.draft);
      setPublishedDoc(res.published);
      setVersions(res.versions ?? []);
      setHasServerPendingPublish(Boolean(res.hasUnpublishedChanges));
      setHasUnsavedLocalEdits(false);
      setActivePageId((prev) =>
        res.draft!.pages.some((p) => p.id === prev) ? prev : res.draft!.pages[0]?.id ?? ''
      );
    }
  }, [fetchFullBundle]);

  useEffect(() => {
    if (session) {
      void loadRemoteState();
    }
  }, [session, loadRemoteState]);

  const readOnly = !session || session.role === 'viewer';
  const canPublish = session?.role === 'admin';

  const activePage = useMemo(
    () => draft.pages.find((p) => p.id === activePageId) ?? draft.pages[0] ?? null,
    [draft.pages, activePageId]
  );

  const selectedSection = useMemo(() => {
    if (!activePage || !selectedSectionId) return null;
    return activePage.sections.find((s) => s.id === selectedSectionId) ?? null;
  }, [activePage, selectedSectionId]);

  const selectedBlock = useMemo(() => {
    if (!activePage || !selectedBlockId) return null;
    for (const sec of activePage.sections) {
      const found = sec.blocks.find((b) => b.id === selectedBlockId);
      if (found) return found;
    }
    return null;
  }, [activePage, selectedBlockId]);

  const commitDraftEdit = useCallback(
    (next: BuilderStateDocument) => {
      setUndoStack((prev) => [...prev.slice(-24), draft]);
      setRedoStack([]);
      setDraft(next);
      setHasUnsavedLocalEdits(true);
    },
    [draft]
  );

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    setRedoStack((s) => [...s, draft]);
    setDraft(prev);
    setHasUnsavedLocalEdits(true);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((s) => s.slice(0, -1));
    setUndoStack((s) => [...s, draft]);
    setDraft(next);
    setHasUnsavedLocalEdits(true);
  };

  const handleSaveDraft = async () => {
    if (readOnly) return;
    setBusyAction(true);
    setStatusBanner(null);
    try {
      const check = validateAndSanitizeBuilderDocument(draft);
      if (!check.valid) {
        setStatusBanner({ type: 'err', text: check.errors.join(' ') });
        return;
      }
      const res = await saveDraftRemote(
        check.document,
        `Borrador guardado (${activePage?.title ?? 'Visual Builder'})`,
        [activePage?.title ?? 'Configuración']
      );
      if (!res.ok || !res.bundle) {
        setStatusBanner({ type: 'err', text: res.error || 'No se pudo guardar el borrador.' });
        return;
      }
      setDraft(res.bundle.draft);
      setPublishedDoc(res.bundle.published);
      setVersions(res.bundle.versions);
      setHasServerPendingPublish(res.bundle.hasUnpublishedChanges);
      setHasUnsavedLocalEdits(false);
      setStatusBanner({
        type: 'ok',
        text: 'Borrador guardado y validado correctamente (aún pendiente de publicación).',
      });
      logEvent('system', 'Visual Builder: borrador guardado', activePage?.title ?? '', 'ok');
    } finally {
      setBusyAction(false);
    }
  };

  const handleConfirmPublish = async () => {
    if (!canPublish) return;
    setBusyAction(true);
    setStatusBanner(null);
    try {
      if (hasUnsavedLocalEdits) {
        const saveRes = await saveDraftRemote(draft, 'Guardado previo a publicación', [
          activePage?.title ?? 'Borrador',
        ]);
        if (!saveRes.ok) {
          setStatusBanner({
            type: 'err',
            text: saveRes.error || 'Error validando el borrador antes de publicar.',
          });
          setShowPublishConfirm(false);
          return;
        }
      }
      const pubRes = await publishDraftRemote(publishNote);
      if (!pubRes.ok || !pubRes.bundle) {
        setStatusBanner({ type: 'err', text: pubRes.error || 'Error al publicar.' });
        return;
      }
      setDraft(pubRes.bundle.draft);
      setPublishedDoc(pubRes.bundle.published);
      setVersions(pubRes.bundle.versions);
      setHasServerPendingPublish(false);
      setHasUnsavedLocalEdits(false);
      setShowPublishConfirm(false);
      setStatusBanner({
        type: 'ok',
        text: 'Cambios publicados correctamente en VectorIA Studio.',
      });
      logEvent('system', 'Visual Builder: versión publicada', publishNote, 'ok');
    } finally {
      setBusyAction(false);
    }
  };

  const handleDiscardDraft = async () => {
    if (readOnly) return;
    setBusyAction(true);
    try {
      const res = await discardDraftRemote();
      if (res.ok && res.draft) {
        setDraft(res.draft);
        setHasUnsavedLocalEdits(false);
        setHasServerPendingPublish(false);
        setUndoStack([]);
        setRedoStack([]);
        setStatusBanner({
          type: 'ok',
          text: 'Cambios de borrador descartados; sincronizado con la versión publicada.',
        });
      }
    } finally {
      setBusyAction(false);
    }
  };

  const handleRestoreVersion = async (versionId: string) => {
    if (!canPublish) return;
    setBusyAction(true);
    try {
      const res = await restoreVersionRemote(versionId);
      if (!res.ok || !res.draft) {
        setStatusBanner({ type: 'err', text: res.error || 'No se pudo recuperar la versión.' });
        return;
      }
      setDraft(res.draft);
      if (res.versions) setVersions(res.versions);
      setHasUnsavedLocalEdits(false);
      setHasServerPendingPublish(true);
      setWorkspaceTab('canvas');
      setStatusBanner({
        type: 'ok',
        text: 'Versión recuperada en borrador. Previsualiza y publica cuando estés listo.',
      });
    } finally {
      setBusyAction(false);
    }
  };

  const addSectionToPage = () => {
    if (!activePage || readOnly) return;
    const newSec: BuilderSection = {
      id: `sec-${Date.now()}`,
      title: `Nueva Sección ${activePage.sections.length + 1}`,
      description: 'Sección agregada desde Visual Builder',
      visible: true,
      columns: 2,
      gapPx: 16,
      blocks: [],
    };
    const nextPages = draft.pages.map((p) =>
      p.id === activePage.id ? { ...p, sections: [...p.sections, newSec] } : p
    );
    commitDraftEdit({ ...draft, pages: nextPages });
    setSelectedSectionId(newSec.id);
    setSelectedBlockId(null);
  };

  const addBlockToSection = (item: ComponentPaletteItem, targetSecId?: string) => {
    if (!activePage || readOnly) return;
    const secId = targetSecId ?? selectedSectionId ?? activePage.sections[0]?.id;
    if (!secId) {
      addSectionToPage();
      return;
    }
    const newBlock = item.createDefaultBlock(`blk-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`);
    const nextPages = draft.pages.map((p) =>
      p.id !== activePage.id
        ? p
        : {
            ...p,
            sections: p.sections.map((s) =>
              s.id === secId ? { ...s, blocks: [...s.blocks, newBlock] } : s
            ),
          }
    );
    commitDraftEdit({ ...draft, pages: nextPages });
    setSelectedSectionId(secId);
    setSelectedBlockId(newBlock.id);
    setWorkspaceTab('canvas');
  };

  const addTemplateBlock = (tplId: string) => {
    const tpl = draft.templates.find((t) => t.id === tplId);
    if (!tpl || !activePage || readOnly) return;
    const secId = selectedSectionId ?? activePage.sections[0]?.id;
    if (!secId) return;
    const block: BuilderBlock = {
      ...JSON.parse(JSON.stringify(tpl.block)),
      id: `blk-tpl-${Date.now()}`,
    };
    const nextPages = draft.pages.map((p) =>
      p.id !== activePage.id
        ? p
        : {
            ...p,
            sections: p.sections.map((s) =>
              s.id === secId ? { ...s, blocks: [...s.blocks, block] } : s
            ),
          }
    );
    commitDraftEdit({ ...draft, pages: nextPages });
    setSelectedBlockId(block.id);
  };

  const moveBlock = (sectionId: string, blockId: string, delta: -1 | 1) => {
    if (!activePage || readOnly) return;
    const nextPages = draft.pages.map((p) => {
      if (p.id !== activePage.id) return p;
      return {
        ...p,
        sections: p.sections.map((s) => {
          if (s.id !== sectionId) return s;
          const idx = s.blocks.findIndex((b) => b.id === blockId);
          const target = idx + delta;
          if (idx < 0 || target < 0 || target >= s.blocks.length) return s;
          const blocks = [...s.blocks];
          const [moved] = blocks.splice(idx, 1);
          blocks.splice(target, 0, moved);
          return { ...s, blocks };
        }),
      };
    });
    commitDraftEdit({ ...draft, pages: nextPages });
  };

  const reorderBlockByDrop = (sectionId: string, draggedId: string, targetId: string) => {
    if (!activePage || readOnly || draggedId === targetId) return;
    const nextPages = draft.pages.map((p) => {
      if (p.id !== activePage.id) return p;
      return {
        ...p,
        sections: p.sections.map((s) => {
          if (s.id !== sectionId) return s;
          const fromIdx = s.blocks.findIndex((b) => b.id === draggedId);
          const toIdx = s.blocks.findIndex((b) => b.id === targetId);
          if (fromIdx < 0 || toIdx < 0) return s;
          const blocks = [...s.blocks];
          const [moved] = blocks.splice(fromIdx, 1);
          blocks.splice(toIdx, 0, moved);
          return { ...s, blocks };
        }),
      };
    });
    commitDraftEdit({ ...draft, pages: nextPages });
  };

  const duplicateBlock = (sectionId: string, block: BuilderBlock) => {
    if (!activePage || readOnly) return;
    const clone: BuilderBlock = {
      ...JSON.parse(JSON.stringify(block)),
      id: `blk-dup-${Date.now()}`,
      name: `${block.name} (Copia)`,
    };
    const nextPages = draft.pages.map((p) =>
      p.id !== activePage.id
        ? p
        : {
            ...p,
            sections: p.sections.map((s) =>
              s.id === sectionId ? { ...s, blocks: [...s.blocks, clone] } : s
            ),
          }
    );
    commitDraftEdit({ ...draft, pages: nextPages });
    setSelectedBlockId(clone.id);
  };

  const deleteBlock = (blockId: string) => {
    if (!activePage || readOnly) return;
    const nextPages = draft.pages.map((p) =>
      p.id !== activePage.id
        ? p
        : {
            ...p,
            sections: p.sections.map((s) => ({
              ...s,
              blocks: s.blocks.filter((b) => b.id !== blockId),
            })),
          }
    );
    commitDraftEdit({ ...draft, pages: nextPages });
    if (selectedBlockId === blockId) setSelectedBlockId(null);
  };

  const updateSelectedBlock = (patch: Partial<BuilderBlock>) => {
    if (!activePage || !selectedBlockId || readOnly) return;
    const nextPages = draft.pages.map((p) =>
      p.id !== activePage.id
        ? p
        : {
            ...p,
            sections: p.sections.map((s) => ({
              ...s,
              blocks: s.blocks.map((b) => (b.id === selectedBlockId ? { ...b, ...patch } : b)),
            })),
          }
    );
    commitDraftEdit({ ...draft, pages: nextPages });
  };

  const updateSelectedSection = (patch: Partial<BuilderSection>) => {
    if (!activePage || !selectedSectionId || readOnly) return;
    const nextPages = draft.pages.map((p) =>
      p.id !== activePage.id
        ? p
        : {
            ...p,
            sections: p.sections.map((s) => (s.id === selectedSectionId ? { ...s, ...patch } : s)),
          }
    );
    commitDraftEdit({ ...draft, pages: nextPages });
  };

  const handleSaveAsTemplate = (block: BuilderBlock, templateName: string) => {
    if (readOnly) return;
    const { id: _omit, ...rest } = JSON.parse(JSON.stringify(block)) as BuilderBlock;
    const nextTemplates = [
      ...draft.templates,
      {
        id: `tpl-${Date.now()}`,
        name: templateName,
        description: `Plantilla guardada de tipo ${block.type}`,
        createdAt: new Date().toISOString(),
        block: rest,
      },
    ];
    commitDraftEdit({ ...draft, templates: nextTemplates });
    setStatusBanner({ type: 'ok', text: `Plantilla "${templateName}" guardada.` });
  };

  const handleAttachModuleBlock = (mod: PreparedModuleSpec) => {
    if (!activePage || readOnly) return;
    const secId = activePage.sections[0]?.id;
    if (!secId) return;
    const newBlock: BuilderBlock = {
      id: `blk-mod-${Date.now()}`,
      type:
        mod.id === 'linear-algebra-engine'
          ? 'math-tool'
          : mod.id === 'neural-mlp-engine'
            ? 'ai-module'
            : mod.id === 'scientific-viz-suite'
              ? 'chart'
              : 'module-adapter',
      category: 'modulos',
      name: mod.name,
      visible: true,
      styles: {
        colSpan: 6,
        paddingPx: 16,
        marginBottomPx: 0,
        borderRadiusPx: 14,
        borderWidthPx: 1,
        borderColor: '',
        backgroundColor: '',
        textColor: '',
        accentColor: '',
        fontSizePx: 14,
        fontWeight: '500',
        fontFamily: 'sans',
        textAlign: 'left',
        shadow: 'subtle',
      },
      content: {
        title: mod.name,
        subtitle: mod.description,
        linkedModuleId: mod.linkedRoute,
        connectedSourceModuleId: mod.id,
        connectedInputPort: mod.inputPorts[0] ?? 'input',
        classifierModePreset: 'alphanumeric',
        mathOperationPreset: 'eigen',
        chartConfig:
          mod.id === 'scientific-viz-suite'
            ? {
                chartKind: 'bar',
                dataSource: 'models-comparison',
                title: 'Módulo de Visualización Conectado',
                subtitle: 'Datos en vivo',
                xAxisLabel: 'Modelo',
                yAxisLabel: '%',
                showLegend: true,
                showGrid: true,
                scaleMode: 'percentage',
                heightPx: 250,
                series: [{ key: 'valPct', label: 'Validación (%)', color: 'var(--chart-1)', visible: true }],
              }
            : undefined,
      },
    };
    const nextPages = draft.pages.map((p) =>
      p.id !== activePage.id
        ? p
        : {
            ...p,
            sections: p.sections.map((s) =>
              s.id === secId ? { ...s, blocks: [...s.blocks, newBlock] } : s
            ),
          }
    );
    commitDraftEdit({ ...draft, pages: nextPages });
    setSelectedBlockId(newBlock.id);
    setWorkspaceTab('canvas');
    setStatusBanner({ type: 'ok', text: `Módulo "${mod.name}" incorporado al lienzo.` });
  };

  const handleExportBuilderJson = () => {
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vectoria_visual_builder_v${draft.appVersion}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleImportBuilderJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || readOnly) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const check = validateAndSanitizeBuilderDocument(parsed);
      if (!check.valid) {
        setStatusBanner({ type: 'err', text: check.errors.join(' ') });
        return;
      }
      commitDraftEdit(check.document);
      setActivePageId(check.document.pages[0]?.id ?? '');
      setStatusBanner({
        type: 'ok',
        text: 'Configuración importada en borrador y validada contra inyección/XSS.',
      });
    } catch {
      setStatusBanner({ type: 'err', text: 'Archivo JSON inválido para Visual Builder.' });
    }
  };

  /* ------------------------------------------------------------------------ */
  /* Gate 1: Real Cryptographic Auth Setup / Login                            */
  /* ------------------------------------------------------------------------ */
  if (!session) {
    const handleSetupSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setAuthBusy(true);
      setAuthError(null);
      const res = await setupAdminPasscode(
        setupAdminPass,
        setupEditorPass,
        setupToken,
        setupViewerPass
      );
      setAuthBusy(false);
      if (!res.ok) {
        setAuthError(res.error || 'No se pudo configurar el acceso.');
      }
    };

    const handleLoginSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setAuthBusy(true);
      setAuthError(null);
      const res = await loginBuilder(loginPass, loginRole);
      setAuthBusy(false);
      if (!res.ok) {
        setAuthError(res.error || 'Acceso denegado.');
      }
    };

    return (
      <div className="max-w-lg mx-auto py-8 space-y-6">
        <div className="surface-card rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[var(--text-primary)]">
                VectorIA Visual Builder
              </h1>
              <p className="text-xs text-[var(--text-muted)]">
                Acceso administrativo protegido mediante hash scrypt y sesión HMAC-SHA256 en servidor.
              </p>
            </div>
          </div>

          {authError && (
            <div
              role="alert"
              className="rounded-xl p-3 bg-[var(--status-err)]/10 border border-[var(--status-err)]/30 text-xs text-[var(--status-err)]"
            >
              {authError}
            </div>
          )}

          {!authInitialized ? (
            <form onSubmit={handleSetupSubmit} className="space-y-3 text-xs">
              <div className="surface-elevated rounded-xl p-3 text-[var(--text-secondary)] leading-relaxed">
                Configuración inicial de seguridad: ingresa el token de inicialización del servidor (<code className="font-mono">VECTORIA_SETUP_TOKEN</code> o consola de arranque) y define contraseñas protegidas con <code className="font-mono">scrypt</code>.
              </div>
              <label className="block space-y-1">
                <span className="text-[var(--text-muted)]">Token de inicialización del servidor</span>
                <input
                  type="password"
                  required
                  value={setupToken}
                  onChange={(e) => setSetupToken(e.target.value)}
                  placeholder="Token único mostrado en consola o VECTORIA_SETUP_TOKEN"
                  className="w-full px-3 py-2 rounded-lg surface-elevated border border-[var(--border-hairline)] text-[var(--text-primary)] font-mono"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[var(--text-muted)]">Contraseña de Administrador (mín. 8 caracteres)</span>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={setupAdminPass}
                  onChange={(e) => setSetupAdminPass(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg surface-elevated border border-[var(--border-hairline)] text-[var(--text-primary)]"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[var(--text-muted)]">Contraseña de Editor (opcional, mín. 8 caracteres)</span>
                <input
                  type="password"
                  value={setupEditorPass}
                  onChange={(e) => setSetupEditorPass(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg surface-elevated border border-[var(--border-hairline)] text-[var(--text-primary)]"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[var(--text-muted)]">Contraseña de Revisor / Viewer (opcional, mín. 8 caracteres)</span>
                <input
                  type="password"
                  value={setupViewerPass}
                  onChange={(e) => setSetupViewerPass(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg surface-elevated border border-[var(--border-hairline)] text-[var(--text-primary)]"
                />
              </label>
              <button
                type="submit"
                disabled={authBusy}
                className="w-full py-2.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-contrast)] font-semibold cursor-pointer"
              >
                {authBusy ? 'Inicializando credenciales...' : 'Configurar y Entrar como Administrador'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleLoginSubmit} className="space-y-3 text-xs">
              <label className="block space-y-1">
                <span className="text-[var(--text-muted)]">Rol de acceso</span>
                <select
                  value={loginRole}
                  onChange={(e) => setLoginRole(e.target.value as BuilderRole)}
                  className="w-full px-3 py-2 rounded-lg surface-elevated border border-[var(--border-hairline)] text-[var(--text-primary)]"
                >
                  <option value="admin">Administrador (Edición + Publicación + Módulos)</option>
                  <option value="editor">Editor (Solo Borradores y Páginas)</option>
                  <option value="viewer">Revisor (Vista de Solo Lectura con contraseña)</option>
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-[var(--text-muted)]">Contraseña</span>
                <input
                  type="password"
                  required
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg surface-elevated border border-[var(--border-hairline)] text-[var(--text-primary)]"
                />
              </label>
              <button
                type="submit"
                disabled={authBusy}
                className="w-full py-2.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-contrast)] font-semibold cursor-pointer"
              >
                {authBusy ? 'Verificando...' : 'Iniciar Sesión en Visual Builder'}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Main 4-Area Visual Builder Workspace                                     */
  /* ------------------------------------------------------------------------ */
  const filteredPalette = BUILDER_COMPONENT_LIBRARY.filter(
    (item) => item.category === activeCategory
  );

  const viewportWidthCls =
    viewport === 'mobile'
      ? 'max-w-[390px] mx-auto'
      : viewport === 'tablet'
        ? 'max-w-[768px] mx-auto'
        : 'w-full';

  return (
    <div className="space-y-4">
      {/* A. Top Bar */}
      <div className="surface-card rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
            <span className="text-sm font-bold text-[var(--text-primary)] whitespace-nowrap">
              VectorIA Visual Builder
            </span>
          </div>

          <select
            aria-label="Página activa en el editor"
            value={activePage?.id ?? ''}
            onChange={(e) => {
              setActivePageId(e.target.value);
              setSelectedBlockId(null);
              setSelectedSectionId(null);
            }}
            className="px-2.5 py-1.5 rounded-lg surface-elevated border border-[var(--border-hairline)] text-xs font-medium text-[var(--text-primary)]"
          >
            {draft.pages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>

          <span className="text-[11px] font-medium text-[var(--text-muted)] whitespace-nowrap">
            {hasUnsavedLocalEdits
              ? 'Cambios locales sin guardar'
              : hasServerPendingPublish
                ? 'Borrador guardado (sin publicar)'
                : 'Publicado y sincronizado'}
            {' · '}
            Rol: <strong className="text-[var(--text-primary)]">{session.role}</strong>
            {!diskPersisted && ' · Memoria'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <button
            type="button"
            disabled={readOnly || undoStack.length === 0}
            onClick={handleUndo}
            title="Deshacer"
            className="p-1.5 rounded-lg surface-elevated border border-[var(--border-hairline)] disabled:opacity-40 cursor-pointer"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={readOnly || redoStack.length === 0}
            onClick={handleRedo}
            title="Rehacer"
            className="p-1.5 rounded-lg surface-elevated border border-[var(--border-hairline)] disabled:opacity-40 cursor-pointer"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setPreviewMode((v) => !v)}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium cursor-pointer whitespace-nowrap ${
              previewMode
                ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)] text-[var(--accent-primary)]'
                : 'surface-elevated border-[var(--border-hairline)] text-[var(--text-primary)]'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            {previewMode ? 'Editar' : 'Vista previa'}
          </button>

          <button
            type="button"
            disabled={readOnly || busyAction}
            onClick={() => void handleSaveDraft()}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg surface-elevated border border-[var(--border-strong)] hover:border-[var(--accent-primary)] text-xs font-semibold text-[var(--text-primary)] cursor-pointer whitespace-nowrap disabled:opacity-45"
          >
            <Save className="w-3.5 h-3.5" />
            Guardar
          </button>

          <button
            type="button"
            disabled={!canPublish || busyAction}
            onClick={() => setShowPublishConfirm(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-contrast)] text-xs font-semibold cursor-pointer whitespace-nowrap disabled:opacity-45"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Publicar
          </button>

          <button
            type="button"
            onClick={() => setWorkspaceTab('history')}
            title="Historial de versiones"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg surface-elevated border border-[var(--border-hairline)] text-xs cursor-pointer whitespace-nowrap"
          >
            <History className="w-3.5 h-3.5" />
            Historial
          </button>

          <button
            type="button"
            onClick={() => setShowZipExportModal(true)}
            title="Exportar proyecto completo, distribución o respaldo en .ZIP"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg surface-elevated border border-[var(--border-strong)] hover:border-[var(--accent-primary)] text-xs font-semibold text-[var(--text-primary)] cursor-pointer whitespace-nowrap"
          >
            <FileArchive className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            EXPORTAR PROYECTO (.ZIP)
          </button>

          <button
            type="button"
            onClick={() => void logoutBuilder()}
            title="Cerrar sesión administrativa"
            className="p-1.5 rounded-lg surface-elevated border border-[var(--border-hairline)] text-[var(--text-muted)] hover:text-[var(--status-err)] cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setActiveModule('dashboard')}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg surface-elevated border border-[var(--border-hairline)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer whitespace-nowrap"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Salir
          </button>
        </div>
      </div>

      {/* Mode Navigation & Export/Import Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl surface-card">
          {[
            { id: 'canvas' as const, label: 'Lienzo Visual (Nivel 1)' },
            { id: 'pages' as const, label: 'Páginas y Menú' },
            { id: 'themes' as const, label: 'Temas y Estilos' },
            { id: 'advanced' as const, label: 'Constructor Avanzado (Nivel 2)' },
            { id: 'history' as const, label: 'Versiones y Comparación' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setWorkspaceTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg font-medium cursor-pointer whitespace-nowrap ${
                workspaceTab === tab.id
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {workspaceTab === 'canvas' && (
            <div className="flex items-center gap-1 p-1 rounded-lg surface-card mr-1">
              {[
                { id: 'desktop' as const, icon: Monitor, title: 'Escritorio' },
                { id: 'tablet' as const, icon: Tablet, title: 'Tablet' },
                { id: 'mobile' as const, icon: Smartphone, title: 'Móvil' },
              ].map((vp) => {
                const Icon = vp.icon;
                return (
                  <button
                    key={vp.id}
                    type="button"
                    onClick={() => setViewport(vp.id)}
                    title={vp.title}
                    className={`p-1.5 rounded-md cursor-pointer ${
                      viewport === vp.id
                        ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                        : 'text-[var(--text-muted)]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                );
              })}
            </div>
          )}

          <button
            type="button"
            disabled={readOnly || (!hasUnsavedLocalEdits && !hasServerPendingPublish)}
            onClick={() => void handleDiscardDraft()}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg surface-card hover:border-[var(--status-warn)] text-[var(--text-secondary)] cursor-pointer disabled:opacity-40"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Descartar borrador
          </button>

          <button
            type="button"
            onClick={handleExportBuilderJson}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg surface-card hover:border-[var(--accent-primary)] text-[var(--text-secondary)] cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar .json
          </button>

          <label className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg surface-card hover:border-[var(--accent-primary)] text-[var(--text-secondary)] cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            Importar .json
            <input
              type="file"
              accept=".json,application/json"
              disabled={readOnly}
              onChange={handleImportBuilderJson}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {statusBanner && (
        <div
          role="alert"
          className={`rounded-xl px-4 py-2.5 text-xs font-medium border ${
            statusBanner.type === 'ok'
              ? 'bg-[var(--status-ok)]/10 border-[var(--status-ok)]/30 text-[var(--status-ok)]'
              : 'bg-[var(--status-err)]/10 border-[var(--status-err)]/30 text-[var(--status-err)]'
          }`}
        >
          {statusBanner.text}
        </div>
      )}

      {/* Workspace Body */}
      {workspaceTab === 'pages' && (
        <BuilderPageManager
          doc={draft}
          activePageId={activePage?.id ?? ''}
          readOnly={readOnly}
          onSelectPage={(pid) => {
            setActivePageId(pid);
            setWorkspaceTab('canvas');
          }}
          onUpdateDocument={(next) => commitDraftEdit(next)}
        />
      )}

      {workspaceTab === 'themes' && (
        <BuilderThemeCustomizer
          doc={draft}
          readOnly={readOnly}
          onUpdateDocument={(next) => commitDraftEdit(next)}
        />
      )}

      {workspaceTab === 'advanced' && (
        <BuilderAdvancedPanel
          doc={draft}
          activePageId={activePage?.id ?? ''}
          readOnly={readOnly}
          onUpdateDocument={(next) => commitDraftEdit(next)}
          onAttachModuleBlock={handleAttachModuleBlock}
        />
      )}

      {workspaceTab === 'history' && (
        <BuilderHistoryAndCompare
          versions={versions}
          draft={draft}
          published={publishedDoc}
          canAdminPublish={Boolean(canPublish)}
          onRestoreVersion={(vid) => void handleRestoreVersion(vid)}
        />
      )}

      {workspaceTab === 'canvas' && activePage && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
          {/* B. Left Panel — Component Library */}
          {!previewMode && (
            <aside className="xl:col-span-3 surface-card rounded-2xl overflow-hidden flex flex-col max-h-[78vh]">
              <div className="p-3 border-b border-[var(--border-hairline)] flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)]">
                  <Layers className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                  <span>Componentes</span>
                </div>
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={addSectionToPage}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--accent-soft)] text-[var(--accent-primary)] text-[11px] font-semibold cursor-pointer"
                >
                  <FolderPlus className="w-3 h-3" />
                  Sección
                </button>
              </div>

              <div className="p-2 border-b border-[var(--border-hairline)] flex flex-wrap gap-1">
                {CATEGORY_TABS.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-2 py-1 rounded-md text-[11px] font-medium cursor-pointer ${
                      activeCategory === cat.id
                        ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                        : 'surface-elevated text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <div className="p-3 space-y-2 overflow-y-auto flex-1">
                {filteredPalette.map((item, idx) => (
                  <button
                    key={`${item.category}-${item.type}-${idx}`}
                    type="button"
                    disabled={readOnly}
                    draggable={!readOnly}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/x-vectoria-palette', `${item.category}:${item.type}:${item.name}`);
                    }}
                    onClick={() => addBlockToSection(item)}
                    className="w-full text-left p-2.5 rounded-xl surface-elevated border border-[var(--border-hairline)] hover:border-[var(--accent-primary)] cursor-pointer space-y-0.5 transition-colors disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-primary)]">
                      <span>{item.name}</span>
                      <Plus className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0" />
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] leading-snug">
                      {item.description}
                    </p>
                  </button>
                ))}

                {draft.templates.length > 0 && (
                  <div className="pt-3 border-t border-[var(--border-hairline)] space-y-2">
                    <div className="text-[11px] font-semibold text-[var(--text-muted)]">
                      Plantillas Guardadas ({draft.templates.length})
                    </div>
                    {draft.templates.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        disabled={readOnly}
                        onClick={() => addTemplateBlock(tpl.id)}
                        className="w-full text-left p-2 rounded-lg surface-elevated border border-[var(--border-hairline)] hover:border-[var(--accent-secondary)] text-xs cursor-pointer"
                      >
                        + {tpl.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </aside>
          )}

          {/* C. Center Area — Editable Canvas */}
          <section
            className={`${previewMode ? 'xl:col-span-12' : 'xl:col-span-6'} surface-card rounded-2xl p-4 min-h-[70vh] overflow-x-auto`}
          >
            <div className={`${viewportWidthCls} space-y-5 transition-all`}>
              <div className="pb-3 border-b border-[var(--border-hairline)] flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold text-[var(--text-primary)]">{activePage.title}</h2>
                  <p className="text-xs text-[var(--text-muted)]">{activePage.description}</p>
                </div>
                {!previewMode && (
                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={addSectionToPage}
                    className="px-3 py-1.5 rounded-lg surface-elevated border border-[var(--border-hairline)] text-xs font-medium cursor-pointer whitespace-nowrap"
                  >
                    + Agregar Sección
                  </button>
                )}
              </div>

              {activePage.sections.map((section) => {
                if (previewMode && !section.visible) return null;
                const isSecSelected = !previewMode && selectedSectionId === section.id && !selectedBlockId;

                return (
                  <div
                    key={section.id}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const paletteKey = e.dataTransfer.getData('application/x-vectoria-palette');
                      if (paletteKey) {
                        const found = BUILDER_COMPONENT_LIBRARY.find(
                          (it) => `${it.category}:${it.type}:${it.name}` === paletteKey
                        );
                        if (found) addBlockToSection(found, section.id);
                      }
                    }}
                    onClick={() => {
                      if (!previewMode) {
                        setSelectedSectionId(section.id);
                        setSelectedBlockId(null);
                      }
                    }}
                    className={`rounded-xl p-3 space-y-3 transition-colors ${
                      !previewMode ? 'border border-dashed' : ''
                    } ${
                      isSecSelected
                        ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)]/30'
                        : 'border-[var(--border-hairline)]'
                    } ${!section.visible && !previewMode ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-semibold text-[var(--text-primary)]">
                          {section.title}
                        </div>
                        {section.description && (
                          <div className="text-[11px] text-[var(--text-muted)]">
                            {section.description}
                          </div>
                        )}
                      </div>
                      {!previewMode && !section.visible && (
                        <span className="text-[11px] text-[var(--status-warn)]">Sección oculta</span>
                      )}
                    </div>

                    <div className="grid grid-cols-12" style={{ gap: `${section.gapPx}px` }}>
                      {section.blocks.map((block, bIdx) => {
                        if (previewMode && !block.visible) return null;
                        const spanCls =
                          block.styles.colSpan === 12
                            ? 'col-span-12'
                            : block.styles.colSpan === 8
                              ? 'col-span-12 lg:col-span-8'
                              : block.styles.colSpan === 4
                                ? 'col-span-12 sm:col-span-6 lg:col-span-4'
                                : block.styles.colSpan === 3
                                  ? 'col-span-12 sm:col-span-6 lg:col-span-3'
                                  : 'col-span-12 lg:col-span-6';
                        const isSelected = !previewMode && selectedBlockId === block.id;

                        return (
                          <div
                            key={block.id}
                            draggable={!previewMode && !readOnly}
                            onDragStart={() => setDragBlockId(block.id)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.stopPropagation();
                              if (dragBlockId) {
                                reorderBlockByDrop(section.id, dragBlockId, block.id);
                                setDragBlockId(null);
                              }
                            }}
                            onClick={(e) => {
                              if (previewMode) return;
                              e.stopPropagation();
                              setSelectedSectionId(section.id);
                              setSelectedBlockId(block.id);
                            }}
                            className={`${spanCls} relative group rounded-xl transition-all ${
                              isSelected
                                ? 'ring-2 ring-[var(--accent-primary)]'
                                : !previewMode
                                  ? 'hover:ring-1 hover:ring-[var(--border-strong)]'
                                  : ''
                            } ${!block.visible && !previewMode ? 'opacity-45' : ''}`}
                          >
                            {!previewMode && !readOnly && (
                              <div className="flex items-center justify-between px-2 py-1 mb-1 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-hairline)] text-[11px]">
                                <div className="flex items-center gap-1 text-[var(--text-muted)] cursor-grab">
                                  <GripVertical className="w-3 h-3" />
                                  <span className="truncate max-w-[120px] font-medium text-[var(--text-primary)]">
                                    {block.name}
                                  </span>
                                </div>
                                <div className="flex items-center gap-0.5">
                                  <button
                                    type="button"
                                    disabled={bIdx === 0}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      moveBlock(section.id, block.id, -1);
                                    }}
                                    title="Subir"
                                    className="p-1 rounded hover:bg-[var(--bg-hover)] disabled:opacity-30 cursor-pointer"
                                  >
                                    <ArrowUp className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={bIdx === section.blocks.length - 1}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      moveBlock(section.id, block.id, 1);
                                    }}
                                    title="Bajar"
                                    className="p-1 rounded hover:bg-[var(--bg-hover)] disabled:opacity-30 cursor-pointer"
                                  >
                                    <ArrowDown className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      duplicateBlock(section.id, block);
                                    }}
                                    title="Duplicar"
                                    className="p-1 rounded hover:bg-[var(--bg-hover)] cursor-pointer"
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteBlock(block.id);
                                    }}
                                    title="Eliminar"
                                    className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--status-err)] cursor-pointer"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            )}

                            <BuilderBlockRenderer
                              block={block}
                              modules={draft.modules}
                              connections={draft.connections}
                              isEditorCanvas={!previewMode}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* D. Right Panel — Property Inspector */}
          {!previewMode && (
            <aside className="xl:col-span-3 surface-card rounded-2xl overflow-hidden max-h-[78vh] flex flex-col">
              <BuilderPropertyInspector
                selectedBlock={selectedBlock}
                selectedSection={selectedSection}
                pages={draft.pages}
                modules={draft.modules}
                readOnly={readOnly}
                onUpdateBlock={updateSelectedBlock}
                onUpdateSection={updateSelectedSection}
                onDeleteBlock={deleteBlock}
                onSaveAsTemplate={handleSaveAsTemplate}
              />
            </aside>
          )}
        </div>
      )}

      {/* Confirmation Modal before Publishing */}
      {showPublishConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
        >
          <div className="surface-card rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2 text-base font-bold text-[var(--text-primary)]">
              <Palette className="w-4 h-4 text-[var(--accent-primary)]" />
              <span>Confirmar Publicación en VectorIA Studio</span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Esta acción validará el borrador actual y actualizará las páginas personalizadas, navegación y estilos publicados sin afectar los motores matemáticos ni redes entrenadas.
            </p>
            <label className="block space-y-1 text-xs">
              <span className="text-[var(--text-muted)]">Nota del cambio para el historial</span>
              <input
                type="text"
                value={publishNote}
                onChange={(e) => setPublishNote(e.target.value)}
                className="w-full px-3 py-2 rounded-lg surface-elevated border border-[var(--border-hairline)] text-[var(--text-primary)]"
              />
            </label>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPublishConfirm(false)}
                className="px-3.5 py-2 rounded-lg surface-elevated border border-[var(--border-hairline)] text-xs font-medium cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busyAction}
                onClick={() => void handleConfirmPublish()}
                className="px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-[var(--accent-contrast)] text-xs font-semibold cursor-pointer"
              >
                {busyAction ? 'Publicando...' : 'Confirmar y Publicar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ZipExportModal
        open={showZipExportModal}
        token={session.token}
        role={session.role}
        onClose={() => setShowZipExportModal(false)}
        onExportCompleted={(filename, mode, sizeBytes) => {
          logEvent(
            'system',
            `Exportación ZIP (${mode})`,
            `${filename} (${Math.round(sizeBytes / 1024)} KB)`,
            'ok'
          );
          setStatusBanner({
            type: 'ok',
            text: `Proyecto exportado y validado correctamente (${filename}).`,
          });
        }}
      />
    </div>
  );
};
