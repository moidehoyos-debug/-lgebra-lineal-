import type {
  BuilderBlock,
  BuilderBlockType,
  BuilderChartKind,
  BuilderComponentCategory,
  BuilderDataSourceKey,
  BuilderPage,
  BuilderSection,
  BuilderStateDocument,
  ModuleConnection,
  PreparedModuleSpec,
} from '../types/builder.ts';
import type { ModuleId } from '../types/vectoria.ts';

const VALID_BLOCK_TYPES = new Set<BuilderBlockType>([
  'section',
  'container',
  'card',
  'panel',
  'text',
  'image',
  'button',
  'table',
  'kpi',
  'chart',
  'diagram',
  'callout',
  'divider',
  'nav-menu',
  'stats-panel',
  'math-tool',
  'ai-module',
  'module-adapter',
]);

const VALID_CATEGORIES = new Set<BuilderComponentCategory>([
  'estructura',
  'contenido',
  'diseno',
  'graficas',
  'indicadores',
  'matematicas',
  'ia',
  'herramientas',
  'modulos',
]);

const VALID_CHART_KINDS = new Set<BuilderChartKind>([
  'bar',
  'horizontal-bar',
  'line',
  'area',
  'scatter',
  'histogram',
  'heatmap',
  'confusion-matrix',
]);

const VALID_DATA_SOURCES = new Set<BuilderDataSourceKey>([
  'models-comparison',
  'training-digits',
  'training-letters',
  'training-alphanumeric',
  'softmax-last',
  'prediction-timeline',
  'confusion-matrix',
  'simulation-history',
  'eigen-spectrum',
]);

const VALID_SYSTEM_MODULES = new Set<ModuleId>([
  'dashboard',
  'simulation-lab',
  'classifier',
  'xai',
  'topology',
  'neural-lab',
  'linear-algebra',
  'geometry',
  'smart-irrigation',
  'omni-bot',
  'evaluation',
  'analytics',
  'robustness',
  'verification',
  'sources',
  'reports',
  'api-console',
  'account',
]);

/**
 * Strips angle brackets, script event handlers, and control chars to prevent XSS or code injection.
 */
export function sanitizeBuilderText(raw: unknown, maxLen = 1200): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/[<>]/g, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/javascript:/gi, '')
    .trim()
    .slice(0, maxLen);
}

/**
 * Strictly validates URLs for images, buttons, and links (never allows javascript:, data:text/html, or SVG script payloads).
 */
export function sanitizeBuilderUrl(raw: unknown, allowImageDataUri = false): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim().slice(0, 600_000);
  if (!trimmed) return '';
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('data:text/') ||
    lower.startsWith('data:image/svg')
  ) {
    return '';
  }
  if (trimmed.startsWith('/')) {
    return trimmed;
  }
  if (allowImageDataUri && /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/.test(trimmed)) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    return '';
  }
  return '';
}

export function sanitizeColorToken(raw: unknown, fallback = ''): string {
  if (typeof raw !== 'string') return fallback;
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) return trimmed;
  if (/^var\(--[a-zA-Z0-9-]+\)$/.test(trimmed)) return trimmed;
  if (/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(\s*,\s*(0|1|0?\.\d+))?\s*\)$/.test(trimmed)) {
    return trimmed;
  }
  return fallback;
}

export function validateModuleDependencies(
  modules: PreparedModuleSpec[]
): { valid: boolean; errors: string[] } {
  const byId = new Map(modules.map((m) => [m.id, m]));
  const errors: string[] = [];

  for (const mod of modules) {
    if (!mod.enabled) continue;
    for (const depId of mod.dependencies) {
      const dep = byId.get(depId);
      if (!dep) {
        errors.push(`El módulo "${mod.name}" depende de "${depId}", que no existe en el catálogo.`);
      } else if (!dep.enabled) {
        errors.push(`El módulo "${mod.name}" requiere que "${dep.name}" esté habilitado.`);
      }
    }
  }

  // Detect dependency cycles
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const dfs = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    const mod = byId.get(id);
    if (mod) {
      for (const dep of mod.dependencies) {
        if (dfs(dep)) return true;
      }
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  };

  for (const mod of modules) {
    if (dfs(mod.id)) {
      errors.push(`Se detectó una dependencia circular que involucra al módulo "${mod.name}".`);
      break;
    }
  }

  return { valid: errors.length === 0, errors };
}

function sanitizeBlock(raw: unknown): BuilderBlock | null {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as Partial<BuilderBlock>;
  if (!b.id || typeof b.id !== 'string') return null;
  if (!b.type || !VALID_BLOCK_TYPES.has(b.type)) return null;
  if (!b.category || !VALID_CATEGORIES.has(b.category)) return null;

  const colSpan =
    b.styles?.colSpan === 3 ||
    b.styles?.colSpan === 4 ||
    b.styles?.colSpan === 6 ||
    b.styles?.colSpan === 8 ||
    b.styles?.colSpan === 12
      ? b.styles.colSpan
      : 6;

  const content = b.content ?? {};
  const chartConfig = content.chartConfig;

  const sanitizedBlock: BuilderBlock = {
    id: sanitizeBuilderText(b.id, 64),
    type: b.type,
    category: b.category,
    name: sanitizeBuilderText(b.name ?? 'Bloque', 80) || 'Bloque',
    visible: b.visible !== false,
    styles: {
      colSpan,
      paddingPx: Math.min(48, Math.max(8, Number(b.styles?.paddingPx ?? 16) || 16)),
      marginBottomPx: Math.min(48, Math.max(0, Number(b.styles?.marginBottomPx ?? 0) || 0)),
      borderRadiusPx: Math.min(32, Math.max(0, Number(b.styles?.borderRadiusPx ?? 14) || 14)),
      borderWidthPx: Math.min(4, Math.max(0, Number(b.styles?.borderWidthPx ?? 1) || 1)),
      borderColor: sanitizeColorToken(b.styles?.borderColor, ''),
      backgroundColor: sanitizeColorToken(b.styles?.backgroundColor, ''),
      textColor: sanitizeColorToken(b.styles?.textColor, ''),
      accentColor: sanitizeColorToken(b.styles?.accentColor, ''),
      fontSizePx: Math.min(32, Math.max(11, Number(b.styles?.fontSizePx ?? 14) || 14)),
      fontWeight:
        b.styles?.fontWeight === '400' ||
        b.styles?.fontWeight === '500' ||
        b.styles?.fontWeight === '600' ||
        b.styles?.fontWeight === '700'
          ? b.styles.fontWeight
          : '500',
      fontFamily: b.styles?.fontFamily === 'mono' ? 'mono' : 'sans',
      textAlign:
        b.styles?.textAlign === 'center' || b.styles?.textAlign === 'right'
          ? b.styles.textAlign
          : 'left',
      shadow:
        b.styles?.shadow === 'subtle' || b.styles?.shadow === 'elevated'
          ? b.styles.shadow
          : 'none',
    },
    content: {
      title: content.title !== undefined ? sanitizeBuilderText(content.title, 140) : undefined,
      subtitle:
        content.subtitle !== undefined ? sanitizeBuilderText(content.subtitle, 220) : undefined,
      body: content.body !== undefined ? sanitizeBuilderText(content.body, 3000) : undefined,
      imageUrl:
        content.imageUrl !== undefined
          ? sanitizeBuilderUrl(content.imageUrl, true)
          : undefined,
      imageAlt:
        content.imageAlt !== undefined ? sanitizeBuilderText(content.imageAlt, 140) : undefined,
      buttonLabel:
        content.buttonLabel !== undefined
          ? sanitizeBuilderText(content.buttonLabel, 60)
          : undefined,
      buttonAction:
        content.buttonAction === 'navigate-module' ||
        content.buttonAction === 'navigate-page' ||
        content.buttonAction === 'open-url'
          ? content.buttonAction
          : 'navigate-module',
      buttonTarget:
        content.buttonTarget !== undefined
          ? content.buttonAction === 'open-url'
            ? sanitizeBuilderUrl(content.buttonTarget, false)
            : sanitizeBuilderText(content.buttonTarget, 80)
          : undefined,
      buttonVariant:
        content.buttonVariant === 'secondary' || content.buttonVariant === 'outline'
          ? content.buttonVariant
          : 'primary',
      kpiValueSource: content.kpiValueSource,
      kpiManualValue:
        content.kpiManualValue !== undefined
          ? sanitizeBuilderText(content.kpiManualValue, 40)
          : undefined,
      kpiUnit:
        content.kpiUnit !== undefined ? sanitizeBuilderText(content.kpiUnit, 24) : undefined,
      tableColumns: Array.isArray(content.tableColumns)
        ? content.tableColumns.slice(0, 8).map((c) => sanitizeBuilderText(String(c), 48))
        : undefined,
      tableRows: Array.isArray(content.tableRows)
        ? content.tableRows
            .slice(0, 20)
            .map((row) =>
              Array.isArray(row)
                ? row
                    .slice(0, 8)
                    .map((cell) =>
                      typeof cell === 'number' && Number.isFinite(cell)
                        ? cell
                        : sanitizeBuilderText(String(cell), 80)
                    )
                : []
            )
        : undefined,
      diagramKind: content.diagramKind,
      calloutTone:
        content.calloutTone === 'ok' || content.calloutTone === 'warn'
          ? content.calloutTone
          : 'info',
      linkedModuleId:
        content.linkedModuleId && VALID_SYSTEM_MODULES.has(content.linkedModuleId)
          ? content.linkedModuleId
          : undefined,
      classifierModePreset:
        content.classifierModePreset === 'digits' ||
        content.classifierModePreset === 'letters' ||
        content.classifierModePreset === 'alphanumeric'
          ? content.classifierModePreset
          : undefined,
      mathOperationPreset: content.mathOperationPreset,
      connectedSourceModuleId:
        content.connectedSourceModuleId !== undefined
          ? sanitizeBuilderText(content.connectedSourceModuleId, 64)
          : undefined,
      connectedInputPort:
        content.connectedInputPort !== undefined
          ? sanitizeBuilderText(content.connectedInputPort, 64)
          : undefined,
      chartConfig:
        chartConfig &&
        VALID_CHART_KINDS.has(chartConfig.chartKind) &&
        VALID_DATA_SOURCES.has(chartConfig.dataSource)
          ? {
              chartKind: chartConfig.chartKind,
              dataSource: chartConfig.dataSource,
              title: sanitizeBuilderText(chartConfig.title, 120) || 'Gráfica Científica',
              subtitle: sanitizeBuilderText(chartConfig.subtitle ?? '', 180),
              xAxisLabel: sanitizeBuilderText(chartConfig.xAxisLabel ?? 'Eje X', 60),
              yAxisLabel: sanitizeBuilderText(chartConfig.yAxisLabel ?? 'Eje Y', 60),
              showLegend: chartConfig.showLegend !== false,
              showGrid: chartConfig.showGrid !== false,
              scaleMode:
                chartConfig.scaleMode === 'percentage' || chartConfig.scaleMode === 'unit'
                  ? chartConfig.scaleMode
                  : 'auto',
              heightPx: Math.min(460, Math.max(180, Number(chartConfig.heightPx ?? 260) || 260)),
              series: Array.isArray(chartConfig.series)
                ? chartConfig.series.slice(0, 6).map((s) => ({
                    key: sanitizeBuilderText(s.key, 48),
                    label: sanitizeBuilderText(s.label, 64),
                    color: sanitizeColorToken(s.color, 'var(--chart-1)'),
                    visible: s.visible !== false,
                  }))
                : [],
            }
          : undefined,
    },
  };

  return sanitizedBlock;
}

export function validateAndSanitizeBuilderDocument(
  raw: unknown
): { valid: true; document: BuilderStateDocument } | { valid: false; errors: string[] } {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, errors: ['Documento de configuración vacío o inválido.'] };
  }
  const doc = raw as Partial<BuilderStateDocument>;
  const errors: string[] = [];

  if (typeof doc.schemaVersion !== 'number' || doc.schemaVersion !== 1) {
    errors.push('Versión de esquema incompatible en Visual Builder (esperada: 1).');
  }
  if (!Array.isArray(doc.pages) || doc.pages.length === 0 || doc.pages.length > 30) {
    errors.push('El documento debe incluir entre 1 y 30 páginas configuradas.');
  }
  if (!Array.isArray(doc.modules)) {
    errors.push('Falta el catálogo de módulos preparados.');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const cleanPages: BuilderPage[] = [];
  for (const rawPage of doc.pages!) {
    if (!rawPage || typeof rawPage !== 'object' || typeof rawPage.id !== 'string') {
      errors.push('Una página contiene estructura inválida.');
      continue;
    }
    const cleanSections: BuilderSection[] = [];
    if (Array.isArray(rawPage.sections)) {
      for (const rawSec of rawPage.sections.slice(0, 24)) {
        if (!rawSec || typeof rawSec !== 'object' || typeof rawSec.id !== 'string') continue;
        const cleanBlocks: BuilderBlock[] = [];
        if (Array.isArray(rawSec.blocks)) {
          for (const rawBlk of rawSec.blocks.slice(0, 36)) {
            const sanitized = sanitizeBlock(rawBlk);
            if (sanitized) cleanBlocks.push(sanitized);
          }
        }
        cleanSections.push({
          id: sanitizeBuilderText(rawSec.id, 64),
          title: sanitizeBuilderText(rawSec.title ?? 'Sección', 120) || 'Sección',
          description: sanitizeBuilderText(rawSec.description ?? '', 240),
          visible: rawSec.visible !== false,
          columns: rawSec.columns === 1 || rawSec.columns === 3 ? rawSec.columns : 2,
          gapPx: Math.min(40, Math.max(8, Number(rawSec.gapPx ?? 16) || 16)),
          blocks: cleanBlocks,
        });
      }
    }

    cleanPages.push({
      id: sanitizeBuilderText(rawPage.id, 64),
      slug: sanitizeBuilderText(rawPage.slug ?? rawPage.id, 64)
        .toLowerCase()
        .replace(/[^a-z0-9-_]/g, '-'),
      title: sanitizeBuilderText(rawPage.title ?? 'Página', 80) || 'Página',
      description: sanitizeBuilderText(rawPage.description ?? '', 240),
      visible: rawPage.visible !== false,
      showInSidebar: rawPage.showInSidebar !== false,
      order: Number.isFinite(rawPage.order) ? Number(rawPage.order) : cleanPages.length,
      isSystemPage: Boolean(rawPage.isSystemPage),
      linkedSystemModuleId:
        rawPage.linkedSystemModuleId && VALID_SYSTEM_MODULES.has(rawPage.linkedSystemModuleId)
          ? rawPage.linkedSystemModuleId
          : undefined,
      updatedAt:
        typeof rawPage.updatedAt === 'string' ? rawPage.updatedAt : new Date().toISOString(),
      sections: cleanSections,
    });
  }

  const cleanModules: PreparedModuleSpec[] = (doc.modules ?? [])
    .filter((m): m is PreparedModuleSpec => Boolean(m && typeof m.id === 'string'))
    .slice(0, 40)
    .map((m) => ({
      id: sanitizeBuilderText(m.id, 64),
      name: sanitizeBuilderText(m.name, 80),
      category:
        m.category === 'math' ||
        m.category === 'ai' ||
        m.category === 'visualization' ||
        m.category === 'analytics'
          ? m.category
          : 'system',
      description: sanitizeBuilderText(m.description, 260),
      dependencies: Array.isArray(m.dependencies)
        ? m.dependencies.map((d) => sanitizeBuilderText(String(d), 64))
        : [],
      inputPorts: Array.isArray(m.inputPorts)
        ? m.inputPorts.map((p) => sanitizeBuilderText(String(p), 48))
        : [],
      outputPorts: Array.isArray(m.outputPorts)
        ? m.outputPorts.map((p) => sanitizeBuilderText(String(p), 48))
        : [],
      linkedRoute: VALID_SYSTEM_MODULES.has(m.linkedRoute) ? m.linkedRoute : 'dashboard',
      enabled: m.enabled !== false,
      builtIn: Boolean(m.builtIn),
    }));

  const depCheck = validateModuleDependencies(cleanModules);
  if (!depCheck.valid) {
    return { valid: false, errors: depCheck.errors };
  }

  const cleanConnections: ModuleConnection[] = Array.isArray(doc.connections)
    ? doc.connections
        .filter((c): c is ModuleConnection => Boolean(c && typeof c.id === 'string'))
        .slice(0, 60)
        .map((c) => ({
          id: sanitizeBuilderText(c.id, 64),
          sourceModuleId: sanitizeBuilderText(c.sourceModuleId, 64),
          sourcePort: sanitizeBuilderText(c.sourcePort, 48),
          targetPageId: sanitizeBuilderText(c.targetPageId, 64),
          targetBlockId: sanitizeBuilderText(c.targetBlockId, 64),
          targetPort: sanitizeBuilderText(c.targetPort, 48),
          enabled: c.enabled !== false,
        }))
    : [];

  const cleanTemplates = Array.isArray(doc.templates)
    ? doc.templates
        .slice(0, 30)
        .map((t) => {
          if (!t || typeof t !== 'object' || !t.block) return null;
          const sanitized = sanitizeBlock({ ...t.block, id: 'tpl' });
          if (!sanitized) return null;
          const { id: _omit, ...rest } = sanitized;
          return {
            id: sanitizeBuilderText(t.id ?? `tpl-${Date.now()}`, 64),
            name: sanitizeBuilderText(t.name ?? 'Plantilla', 80),
            description: sanitizeBuilderText(t.description ?? '', 180),
            createdAt: typeof t.createdAt === 'string' ? t.createdAt : new Date().toISOString(),
            block: rest,
          };
        })
        .filter((x): x is NonNullable<typeof x> => Boolean(x))
    : [];

  const cleanPresets = Array.isArray(doc.themePresets)
    ? doc.themePresets.slice(0, 20).map((p) => ({
        id: sanitizeBuilderText(p.id, 64),
        name: sanitizeBuilderText(p.name, 60),
        baseTheme: p.baseTheme,
        primaryColor: sanitizeColorToken(p.primaryColor, '#8b5cf6'),
        secondaryColor: sanitizeColorToken(p.secondaryColor, '#22d3ee'),
        canvasBg: sanitizeColorToken(p.canvasBg, '#07070b'),
        surfaceBg: sanitizeColorToken(p.surfaceBg, '#101018'),
        fontFamily:
          p.fontFamily === 'JetBrains Mono' || p.fontFamily === 'system-ui'
            ? p.fontFamily
            : ('Plus Jakarta Sans' as const),
        borderRadiusPx: Math.min(28, Math.max(2, Number(p.borderRadiusPx ?? 14) || 14)),
        spacingScale:
          p.spacingScale === 'compact' || p.spacingScale === 'airy' ? p.spacingScale : ('balanced' as const),
        cardAppearance:
          p.cardAppearance === 'glass' || p.cardAppearance === 'flat' ? p.cardAppearance : ('bordered' as const),
        buttonStyle:
          p.buttonStyle === 'sharp' || p.buttonStyle === 'soft' ? p.buttonStyle : ('rounded' as const),
        density:
          p.density === 'compact' || p.density === 'comfortable' ? p.density : ('standard' as const),
        panelLayout:
          p.panelLayout === 'wide-canvas' ? ('wide-canvas' as const) : ('sidebar-standard' as const),
      }))
    : [];

  const hiddenSystemModules = Array.isArray(doc.hiddenSystemModules)
    ? doc.hiddenSystemModules.filter((m): m is ModuleId => VALID_SYSTEM_MODULES.has(m))
    : [];

  const cleanDoc: BuilderStateDocument = {
    schemaVersion: 1,
    appVersion: sanitizeBuilderText(doc.appVersion ?? '2.2.0', 24) || '2.2.0',
    pages: cleanPages,
    activeThemePresetId:
      typeof doc.activeThemePresetId === 'string'
        ? sanitizeBuilderText(doc.activeThemePresetId, 64)
        : null,
    themePresets: cleanPresets,
    templates: cleanTemplates,
    modules: cleanModules,
    connections: cleanConnections,
    sidebarOrder: Array.isArray(doc.sidebarOrder)
      ? doc.sidebarOrder.slice(0, 60).map((s) => sanitizeBuilderText(String(s), 64))
      : [],
    hiddenSystemModules,
  };

  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return { valid: true, document: cleanDoc };
}
