import React, { useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  FilePlus2,
  GitBranch,
  History,
  Link2,
  Palette,
  Power,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { THEME_OPTIONS } from '../../context/ThemeContext';
import {
  BuilderPage,
  BuilderStateDocument,
  BuilderThemePreset,
  BuilderVersionEntry,
  PreparedModuleSpec,
} from '../../types/builder';
import { ModuleId, ThemeId } from '../../types/vectoria';
import { validateModuleDependencies } from '../../utils/builderSecurity';

/* -------------------------------------------------------------------------- */
/* Page & Navigation Manager                                                  */
/* -------------------------------------------------------------------------- */
interface PageManagerProps {
  doc: BuilderStateDocument;
  activePageId: string;
  readOnly: boolean;
  onSelectPage: (pageId: string) => void;
  onUpdateDocument: (next: BuilderStateDocument, desc: string, items: string[]) => void;
}

const SYSTEM_NAV_LABELS: Array<{ id: ModuleId; label: string }> = [
  { id: 'simulation-lab', label: 'Simulation Lab' },
  { id: 'classifier', label: 'Clasificador Alfanumérico' },
  { id: 'xai', label: 'IA Explicable (XAI)' },
  { id: 'topology', label: 'Neural Topology' },
  { id: 'neural-lab', label: 'Ingeniería Neuronal' },
  { id: 'smart-irrigation', label: 'Riego Inteligente' },
  { id: 'linear-algebra', label: 'Álgebra Lineal' },
  { id: 'geometry', label: 'Geometría 2D / 3D' },
  { id: 'omni-bot', label: 'Omni Bot' },
  { id: 'evaluation', label: 'Evaluación de Modelos' },
  { id: 'analytics', label: 'Métricas y Analítica' },
  { id: 'robustness', label: 'Robustez' },
  { id: 'sources', label: 'Fuentes Académicas' },
  { id: 'reports', label: 'Informes Técnicos' },
  { id: 'api-console', label: 'Consola API' },
];

export const BuilderPageManager: React.FC<PageManagerProps> = ({
  doc,
  activePageId,
  readOnly,
  onSelectPage,
  onUpdateDocument,
}) => {
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const createPage = () => {
    if (!newTitle.trim()) return;
    const id = `page-${Date.now()}`;
    const page: BuilderPage = {
      id,
      slug: newTitle
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-'),
      title: newTitle.trim(),
      description: newDesc.trim() || 'Página informativa administrada desde Visual Builder.',
      visible: true,
      showInSidebar: true,
      order: doc.pages.length,
      isSystemPage: false,
      updatedAt: new Date().toISOString(),
      sections: [
        {
          id: `sec-${Date.now()}`,
          title: 'Sección Principal',
          description: 'Agrega tarjetas, textos o gráficas desde el panel izquierdo.',
          visible: true,
          columns: 2,
          gapPx: 16,
          blocks: [],
        },
      ],
    };
    onUpdateDocument(
      { ...doc, pages: [...doc.pages, page] },
      `Página creada: ${page.title}`,
      ['Nueva página']
    );
    onSelectPage(id);
    setNewTitle('');
    setNewDesc('');
  };

  const duplicatePage = (page: BuilderPage) => {
    const id = `page-copy-${Date.now()}`;
    const copy: BuilderPage = {
      ...JSON.parse(JSON.stringify(page)),
      id,
      slug: `${page.slug}-copia`,
      title: `${page.title} (Copia)`,
      order: doc.pages.length,
      updatedAt: new Date().toISOString(),
    };
    onUpdateDocument(
      { ...doc, pages: [...doc.pages, copy] },
      `Página duplicada: ${copy.title}`,
      ['Duplicación de página']
    );
    onSelectPage(id);
  };

  const toggleSystemHidden = (modId: ModuleId) => {
    const hidden = new Set(doc.hiddenSystemModules);
    if (hidden.has(modId)) hidden.delete(modId);
    else hidden.add(modId);
    onUpdateDocument(
      { ...doc, hiddenSystemModules: Array.from(hidden) },
      `Visibilidad de navegación actualizada (${modId})`,
      ['Navegación lateral']
    );
  };

  return (
    <div className="space-y-6 text-xs">
      <div className="surface-card rounded-xl p-4 space-y-3">
        <div className="font-semibold text-sm text-[var(--text-primary)]">
          Crear Nueva Página Informativa
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input
            type="text"
            disabled={readOnly}
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Nombre de la página..."
            className="px-3 py-2 rounded-lg surface-elevated border border-[var(--border-hairline)] text-[var(--text-primary)]"
          />
          <input
            type="text"
            disabled={readOnly}
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Descripción breve..."
            className="px-3 py-2 rounded-lg surface-elevated border border-[var(--border-hairline)] text-[var(--text-primary)]"
          />
          <button
            type="button"
            disabled={readOnly || !newTitle.trim()}
            onClick={createPage}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-[var(--accent-contrast)] font-semibold cursor-pointer disabled:opacity-50"
          >
            <FilePlus2 className="w-3.5 h-3.5" />
            Crear Página
          </button>
        </div>
      </div>

      <div className="space-y-2.5">
        <div className="font-semibold text-sm text-[var(--text-primary)]">
          Páginas del Visual Builder ({doc.pages.length})
        </div>
        {doc.pages.map((p, idx) => (
          <div
            key={p.id}
            className={`surface-card rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              p.id === activePageId ? 'border-[var(--accent-primary)]' : ''
            }`}
          >
            <div className="space-y-1 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  disabled={readOnly}
                  value={p.title}
                  onChange={(e) => {
                    const nextPages = doc.pages.map((x) =>
                      x.id === p.id ? { ...x, title: e.target.value } : x
                    );
                    onUpdateDocument({ ...doc, pages: nextPages }, `Renombrada página ${e.target.value}`, [
                      'Páginas',
                    ]);
                  }}
                  className="font-semibold text-sm text-[var(--text-primary)] bg-transparent border-b border-transparent focus:border-[var(--accent-primary)] outline-none"
                />
                <span className="font-mono text-[11px] text-[var(--text-muted)]">/{p.slug}</span>
              </div>
              <input
                type="text"
                disabled={readOnly}
                value={p.description}
                onChange={(e) => {
                  const nextPages = doc.pages.map((x) =>
                    x.id === p.id ? { ...x, description: e.target.value } : x
                  );
                  onUpdateDocument({ ...doc, pages: nextPages }, 'Descripción de página editada', [
                    'Páginas',
                  ]);
                }}
                className="w-full text-xs text-[var(--text-secondary)] bg-transparent outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => onSelectPage(p.id)}
                className="px-2.5 py-1.5 rounded-lg bg-[var(--accent-soft)] text-[var(--accent-primary)] font-semibold cursor-pointer"
              >
                Abrir en Lienzo
              </button>
              <button
                type="button"
                disabled={readOnly}
                onClick={() => {
                  const nextPages = doc.pages.map((x) =>
                    x.id === p.id ? { ...x, showInSidebar: !x.showInSidebar } : x
                  );
                  onUpdateDocument({ ...doc, pages: nextPages }, 'Visibilidad en menú cambiada', [
                    'Navegación',
                  ]);
                }}
                className="px-2.5 py-1.5 rounded-lg surface-elevated border border-[var(--border-hairline)] cursor-pointer inline-flex items-center gap-1"
              >
                {p.showInSidebar ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                {p.showInSidebar ? 'En menú' : 'Oculta'}
              </button>
              <button
                type="button"
                disabled={readOnly}
                onClick={() => duplicatePage(p)}
                title="Duplicar página"
                className="p-1.5 rounded-lg surface-elevated border border-[var(--border-hairline)] cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              {doc.pages.length > 1 && idx > 0 && (
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => {
                    const nextPages = doc.pages.filter((x) => x.id !== p.id);
                    onUpdateDocument({ ...doc, pages: nextPages }, `Página eliminada: ${p.title}`, [
                      'Páginas',
                    ]);
                    if (activePageId === p.id) onSelectPage(nextPages[0].id);
                  }}
                  title="Eliminar página"
                  className="p-1.5 rounded-lg surface-elevated border border-[var(--border-hairline)] text-[var(--status-err)] cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="surface-card rounded-xl p-4 space-y-3">
        <div className="font-semibold text-sm text-[var(--text-primary)]">
          Visibilidad de Módulos Nativos en el Menú Lateral
        </div>
        <p className="text-[var(--text-muted)]">
          Oculta o muestra módulos sin eliminar sus rutas ni alterar sus motores matemáticos.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {SYSTEM_NAV_LABELS.map((item) => {
            const isHidden = doc.hiddenSystemModules.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                disabled={readOnly}
                onClick={() => toggleSystemHidden(item.id)}
                className={`flex items-center justify-between px-3 py-2 rounded-lg border text-left cursor-pointer ${
                  isHidden
                    ? 'border-[var(--border-hairline)] opacity-55 surface-elevated'
                    : 'border-[var(--accent-primary)]/40 bg-[var(--accent-soft)]'
                }`}
              >
                <span className="truncate">{item.label}</span>
                {isHidden ? <EyeOff className="w-3.5 h-3.5 shrink-0" /> : <Eye className="w-3.5 h-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Theme & Personalization Customizer (6 Built-In Themes Preserved)           */
/* -------------------------------------------------------------------------- */
interface ThemeCustomizerProps {
  doc: BuilderStateDocument;
  readOnly: boolean;
  onUpdateDocument: (next: BuilderStateDocument, desc: string, items: string[]) => void;
}

export const BuilderThemeCustomizer: React.FC<ThemeCustomizerProps> = ({
  doc,
  readOnly,
  onUpdateDocument,
}) => {
  const activePreset =
    doc.themePresets.find((p) => p.id === doc.activeThemePresetId) ??
    doc.themePresets[0] ?? {
      id: 'preset-custom',
      name: 'Personalizado',
      baseTheme: 'dark-purple' as ThemeId,
      primaryColor: '#8b5cf6',
      secondaryColor: '#22d3ee',
      canvasBg: '#07070b',
      surfaceBg: '#101018',
      fontFamily: 'Plus Jakarta Sans' as const,
      borderRadiusPx: 14,
      spacingScale: 'balanced' as const,
      cardAppearance: 'bordered' as const,
      buttonStyle: 'rounded' as const,
      density: 'standard' as const,
      panelLayout: 'sidebar-standard' as const,
    };

  const [form, setForm] = useState<BuilderThemePreset>(activePreset);

  const saveAndActivatePreset = () => {
    const cleanId = form.id || `preset-${Date.now()}`;
    const updated: BuilderThemePreset = { ...form, id: cleanId };
    const exists = doc.themePresets.some((p) => p.id === cleanId);
    const nextPresets = exists
      ? doc.themePresets.map((p) => (p.id === cleanId ? updated : p))
      : [...doc.themePresets, updated];
    onUpdateDocument(
      { ...doc, themePresets: nextPresets, activeThemePresetId: cleanId },
      `Preset visual aplicado: ${updated.name}`,
      ['Tema personalizado']
    );
  };

  return (
    <div className="space-y-6 text-xs">
      <div className="surface-card rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-semibold text-sm text-[var(--text-primary)]">
            <Palette className="w-4 h-4 text-[var(--accent-primary)]" />
            <span>Personalización No Destructiva sobre los 6 Temas Base</span>
          </div>
          <button
            type="button"
            disabled={readOnly}
            onClick={() =>
              onUpdateDocument(
                { ...doc, activeThemePresetId: null },
                'Restaurado tema original de VectorIA Studio',
                ['Temas']
              )
            }
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg surface-elevated border border-[var(--border-hairline)] cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Usar tema base sin sobrescritura
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="space-y-1">
            <span className="text-[var(--text-muted)]">Nombre del preset</span>
            <input
              type="text"
              disabled={readOnly}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-1.5 rounded-lg surface-elevated border border-[var(--border-hairline)]"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[var(--text-muted)]">Tema original base</span>
            <select
              disabled={readOnly}
              value={form.baseTheme}
              onChange={(e) => setForm({ ...form, baseTheme: e.target.value as ThemeId })}
              className="w-full px-3 py-1.5 rounded-lg surface-elevated border border-[var(--border-hairline)]"
            >
              {THEME_OPTIONS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[var(--text-muted)]">Tipografía</span>
            <select
              disabled={readOnly}
              value={form.fontFamily}
              onChange={(e) =>
                setForm({
                  ...form,
                  fontFamily: e.target.value as BuilderThemePreset['fontFamily'],
                })
              }
              className="w-full px-3 py-1.5 rounded-lg surface-elevated border border-[var(--border-hairline)]"
            >
              <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
              <option value="JetBrains Mono">JetBrains Mono</option>
              <option value="system-ui">Sistema Nativa</option>
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <label className="space-y-1">
            <span className="text-[var(--text-muted)]">Color principal</span>
            <input
              type="color"
              disabled={readOnly}
              value={form.primaryColor}
              onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
              className="w-full h-9 rounded cursor-pointer"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[var(--text-muted)]">Color secundario</span>
            <input
              type="color"
              disabled={readOnly}
              value={form.secondaryColor}
              onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })}
              className="w-full h-9 rounded cursor-pointer"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[var(--text-muted)]">Fondo lienzo</span>
            <input
              type="color"
              disabled={readOnly}
              value={form.canvasBg}
              onChange={(e) => setForm({ ...form, canvasBg: e.target.value })}
              className="w-full h-9 rounded cursor-pointer"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[var(--text-muted)]">Superficie tarjetas</span>
            <input
              type="color"
              disabled={readOnly}
              value={form.surfaceBg.startsWith('#') ? form.surfaceBg : '#101018'}
              onChange={(e) => setForm({ ...form, surfaceBg: e.target.value })}
              className="w-full h-9 rounded cursor-pointer"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <label className="space-y-1">
            <span className="text-[var(--text-muted)]">Radio: {form.borderRadiusPx}px</span>
            <input
              type="range"
              min={2}
              max={24}
              disabled={readOnly}
              value={form.borderRadiusPx}
              onChange={(e) => setForm({ ...form, borderRadiusPx: Number(e.target.value) })}
              className="w-full accent-[var(--accent-primary)]"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[var(--text-muted)]">Apariencia tarjetas</span>
            <select
              disabled={readOnly}
              value={form.cardAppearance}
              onChange={(e) =>
                setForm({
                  ...form,
                  cardAppearance: e.target.value as BuilderThemePreset['cardAppearance'],
                })
              }
              className="w-full px-2.5 py-1.5 rounded-lg surface-elevated border border-[var(--border-hairline)]"
            >
              <option value="bordered">Borde fino</option>
              <option value="glass">Translúcida</option>
              <option value="flat">Plana</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[var(--text-muted)]">Botones</span>
            <select
              disabled={readOnly}
              value={form.buttonStyle}
              onChange={(e) =>
                setForm({
                  ...form,
                  buttonStyle: e.target.value as BuilderThemePreset['buttonStyle'],
                })
              }
              className="w-full px-2.5 py-1.5 rounded-lg surface-elevated border border-[var(--border-hairline)]"
            >
              <option value="rounded">Redondeado</option>
              <option value="sharp">Recto</option>
              <option value="soft">Suave</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[var(--text-muted)]">Densidad visual</span>
            <select
              disabled={readOnly}
              value={form.density}
              onChange={(e) =>
                setForm({
                  ...form,
                  density: e.target.value as BuilderThemePreset['density'],
                })
              }
              className="w-full px-2.5 py-1.5 rounded-lg surface-elevated border border-[var(--border-hairline)]"
            >
              <option value="compact">Compacta</option>
              <option value="standard">Estándar</option>
              <option value="comfortable">Amplia</option>
            </select>
          </label>
        </div>

        <button
          type="button"
          disabled={readOnly}
          onClick={saveAndActivatePreset}
          className="px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-[var(--accent-contrast)] font-semibold cursor-pointer"
        >
          Guardar y Activar Preset en Borrador
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {doc.themePresets.map((preset) => {
          const isActive = doc.activeThemePresetId === preset.id;
          return (
            <div
              key={preset.id}
              className={`surface-card rounded-xl p-4 flex items-center justify-between gap-3 ${
                isActive ? 'border-[var(--accent-primary)]' : ''
              }`}
            >
              <div>
                <div className="font-semibold text-[var(--text-primary)]">{preset.name}</div>
                <div className="text-[11px] text-[var(--text-muted)]">
                  Base: {preset.baseTheme} · {preset.density} · {preset.borderRadiusPx}px
                </div>
              </div>
              <button
                type="button"
                disabled={readOnly}
                onClick={() => {
                  setForm(preset);
                  onUpdateDocument(
                    { ...doc, activeThemePresetId: preset.id },
                    `Activado preset ${preset.name}`,
                    ['Temas']
                  );
                }}
                className="px-3 py-1.5 rounded-lg bg-[var(--accent-soft)] text-[var(--accent-primary)] font-semibold cursor-pointer"
              >
                {isActive ? 'Activo' : 'Aplicar'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* LEVEL 2 — Advanced Builder (Modules, Dependencies & I/O Connections)       */
/* -------------------------------------------------------------------------- */
interface AdvancedBuilderProps {
  doc: BuilderStateDocument;
  activePageId: string;
  readOnly: boolean;
  onUpdateDocument: (next: BuilderStateDocument, desc: string, items: string[]) => void;
  onAttachModuleBlock: (mod: PreparedModuleSpec) => void;
}

export const BuilderAdvancedPanel: React.FC<AdvancedBuilderProps> = ({
  doc,
  activePageId,
  readOnly,
  onUpdateDocument,
  onAttachModuleBlock,
}) => {
  const [depError, setDepError] = useState<string | null>(null);
  const [sourceModId, setSourceModId] = useState(doc.modules[0]?.id ?? '');
  const [sourcePort, setSourcePort] = useState(doc.modules[0]?.outputPorts[0] ?? '');
  const [targetBlockId, setTargetBlockId] = useState('');

  const activePage = doc.pages.find((p) => p.id === activePageId);
  const allBlocks = activePage ? activePage.sections.flatMap((s) => s.blocks) : [];

  const toggleModule = (modId: string) => {
    setDepError(null);
    const nextModules = doc.modules.map((m) =>
      m.id === modId ? { ...m, enabled: !m.enabled } : m
    );
    const check = validateModuleDependencies(nextModules);
    if (!check.valid) {
      setDepError(check.errors.join(' '));
      return;
    }
    onUpdateDocument(
      { ...doc, modules: nextModules },
      `Estado del módulo "${modId}" actualizado en Nivel 2`,
      ['Módulos Nivel 2']
    );
  };

  const createConnection = () => {
    const mod = doc.modules.find((m) => m.id === sourceModId);
    const blk = allBlocks.find((b) => b.id === targetBlockId);
    if (!mod || !blk) return;
    const conn = {
      id: `conn-${Date.now()}`,
      sourceModuleId: mod.id,
      sourcePort: sourcePort || mod.outputPorts[0] || 'output',
      targetPageId: activePageId,
      targetBlockId: blk.id,
      targetPort: blk.content.connectedInputPort || mod.inputPorts[0] || 'input',
      enabled: true,
    };
    const updatedPages = doc.pages.map((p) =>
      p.id !== activePageId
        ? p
        : {
            ...p,
            sections: p.sections.map((s) => ({
              ...s,
              blocks: s.blocks.map((b) =>
                b.id === blk.id
                  ? {
                      ...b,
                      content: {
                        ...b.content,
                        connectedSourceModuleId: mod.id,
                        connectedInputPort: conn.targetPort,
                      },
                    }
                  : b
              ),
            })),
          }
    );
    onUpdateDocument(
      { ...doc, pages: updatedPages, connections: [...doc.connections, conn] },
      `Conexión creada: ${mod.name} → ${blk.name}`,
      ['Conexiones Nivel 2']
    );
  };

  return (
    <div className="space-y-6 text-xs">
      {depError && (
        <div
          role="alert"
          className="rounded-xl p-3 bg-[var(--status-err)]/10 border border-[var(--status-err)]/30 text-[var(--status-err)] font-medium"
        >
          {depError}
        </div>
      )}

      <div className="space-y-2">
        <div className="font-semibold text-sm text-[var(--text-primary)]">
          Catálogo de Módulos Preparados (Nivel 2)
        </div>
        <p className="text-[var(--text-muted)]">
          Activa, desactiva o incorpora módulos reales verificados en tu página activa sin alterar los algoritmos internos ni exponer el servidor.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {doc.modules.map((mod) => (
          <div key={mod.id} className="surface-card rounded-xl p-4 space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold text-sm text-[var(--text-primary)]">{mod.name}</div>
                <div className="text-[11px] text-[var(--text-muted)]">{mod.category}</div>
              </div>
              <button
                type="button"
                disabled={readOnly}
                onClick={() => toggleModule(mod.id)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
                  mod.enabled
                    ? 'bg-[var(--status-ok)]/15 text-[var(--status-ok)]'
                    : 'surface-elevated text-[var(--text-muted)]'
                }`}
              >
                <Power className="w-3 h-3" />
                {mod.enabled ? 'Activo' : 'Inactivo'}
              </button>
            </div>
            <p className="text-[var(--text-secondary)] leading-relaxed">{mod.description}</p>
            <div className="font-mono text-[11px] text-[var(--text-muted)] space-y-0.5">
              <div>Entradas: {mod.inputPorts.join(', ') || 'ninguna'}</div>
              <div>Salidas: {mod.outputPorts.join(', ') || 'ninguna'}</div>
              <div>
                Dependencias: {mod.dependencies.length > 0 ? mod.dependencies.join(', ') : 'independiente'}
              </div>
            </div>
            <div className="pt-1">
              <button
                type="button"
                disabled={readOnly || !mod.enabled}
                onClick={() => onAttachModuleBlock(mod)}
                className="px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] text-[var(--accent-contrast)] font-semibold cursor-pointer disabled:opacity-45"
              >
                + Incorporar en página activa
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="surface-card rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 font-semibold text-sm text-[var(--text-primary)]">
          <Link2 className="w-4 h-4 text-[var(--accent-primary)]" />
          <span>Configurador de Conexiones Entrada / Salida</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <select
            disabled={readOnly}
            value={sourceModId}
            onChange={(e) => {
              const nextMod = doc.modules.find((m) => m.id === e.target.value);
              setSourceModId(e.target.value);
              setSourcePort(nextMod?.outputPorts[0] ?? '');
            }}
            className="px-3 py-2 rounded-lg surface-elevated border border-[var(--border-hairline)]"
          >
            {doc.modules.filter((m) => m.enabled).map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <select
            disabled={readOnly}
            value={sourcePort}
            onChange={(e) => setSourcePort(e.target.value)}
            className="px-3 py-2 rounded-lg surface-elevated border border-[var(--border-hairline)] font-mono"
          >
            {(doc.modules.find((m) => m.id === sourceModId)?.outputPorts ?? []).map((p) => (
              <option key={p} value={p}>
                Salida: {p}
              </option>
            ))}
          </select>
          <select
            disabled={readOnly}
            value={targetBlockId}
            onChange={(e) => setTargetBlockId(e.target.value)}
            className="px-3 py-2 rounded-lg surface-elevated border border-[var(--border-hairline)]"
          >
            <option value="">Seleccionar componente destino...</option>
            {allBlocks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.type})
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={readOnly || !targetBlockId}
            onClick={createConnection}
            className="px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-[var(--accent-contrast)] font-semibold cursor-pointer disabled:opacity-50"
          >
            Conectar Puerto
          </button>
        </div>

        {doc.connections.length > 0 && (
          <div className="space-y-1.5 pt-2">
            {doc.connections.map((conn) => (
              <div
                key={conn.id}
                className="flex items-center justify-between px-3 py-2 rounded-lg surface-elevated font-mono text-[11px]"
              >
                <span>
                  {conn.sourceModuleId}.{conn.sourcePort} → {conn.targetBlockId}.{conn.targetPort}
                </span>
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() =>
                    onUpdateDocument(
                      {
                        ...doc,
                        connections: doc.connections.filter((c) => c.id !== conn.id),
                      },
                      'Conexión eliminada',
                      ['Conexiones']
                    )
                  }
                  className="text-[var(--status-err)] cursor-pointer"
                >
                  Desconectar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* History & Draft-vs-Published Compare View                                  */
/* -------------------------------------------------------------------------- */
interface HistoryCompareProps {
  versions: BuilderVersionEntry[];
  draft: BuilderStateDocument;
  published: BuilderStateDocument;
  canAdminPublish: boolean;
  onRestoreVersion: (versionId: string) => void;
}

export const BuilderHistoryAndCompare: React.FC<HistoryCompareProps> = ({
  versions,
  draft,
  published,
  canAdminPublish,
  onRestoreVersion,
}) => {
  const draftBlocks = draft.pages.reduce(
    (sum, p) => sum + p.sections.reduce((s, sec) => s + sec.blocks.length, 0),
    0
  );
  const pubBlocks = published.pages.reduce(
    (sum, p) => sum + p.sections.reduce((s, sec) => s + sec.blocks.length, 0),
    0
  );

  return (
    <div className="space-y-6 text-xs">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="surface-card rounded-xl p-4 space-y-1.5">
          <div className="flex items-center gap-2 font-semibold text-sm text-[var(--text-primary)]">
            <GitBranch className="w-4 h-4 text-[var(--accent-primary)]" />
            <span>Borrador Actual (En Edición)</span>
          </div>
          <div className="font-mono text-[var(--text-secondary)]">
            Páginas: {draft.pages.length} · Componentes: {draftBlocks} · Módulos activos:{' '}
            {draft.modules.filter((m) => m.enabled).length}
          </div>
          <div className="text-[11px] text-[var(--text-muted)]">
            Preset visual: {draft.activeThemePresetId || 'Tema nativo sin sobrescritura'}
          </div>
        </div>

        <div className="surface-card rounded-xl p-4 space-y-1.5">
          <div className="flex items-center gap-2 font-semibold text-sm text-[var(--status-ok)]">
            <CheckCircle2 className="w-4 h-4" />
            <span>Versión Publicada (Producción)</span>
          </div>
          <div className="font-mono text-[var(--text-secondary)]">
            Páginas: {published.pages.length} · Componentes: {pubBlocks} · Módulos activos:{' '}
            {published.modules.filter((m) => m.enabled).length}
          </div>
          <div className="text-[11px] text-[var(--text-muted)]">
            Preset visual: {published.activeThemePresetId || 'Tema nativo sin sobrescritura'}
          </div>
        </div>
      </div>

      <div className="surface-card rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 font-semibold text-sm text-[var(--text-primary)]">
          <History className="w-4 h-4 text-[var(--accent-primary)]" />
          <span>Registro de Versiones e Historial ({versions.length})</span>
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {versions.map((ver) => (
            <div
              key={ver.id}
              className="surface-elevated rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-semibold text-[var(--text-primary)]">
                    {ver.timestamp.slice(0, 19).replace('T', ' ')}
                  </span>
                  <span
                    className={`font-semibold ${
                      ver.publishState === 'published'
                        ? 'text-[var(--status-ok)]'
                        : 'text-[var(--status-warn)]'
                    }`}
                  >
                    {ver.publishState === 'published' ? 'Publicado' : 'Borrador'}
                  </span>
                  <span className="text-[var(--text-muted)]">por {ver.authorRole}</span>
                </div>
                <div className="text-[var(--text-primary)]">{ver.description}</div>
                <div className="text-[11px] font-mono text-[var(--text-muted)]">
                  Anterior: {ver.previousSummary} → Nuevo: {ver.nextSummary}
                </div>
              </div>
              <button
                type="button"
                disabled={!canAdminPublish}
                onClick={() => onRestoreVersion(ver.id)}
                className="px-3 py-1.5 rounded-lg border border-[var(--border-strong)] surface-card hover:border-[var(--accent-primary)] font-semibold cursor-pointer whitespace-nowrap disabled:opacity-45"
              >
                Recuperar en Borrador
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
