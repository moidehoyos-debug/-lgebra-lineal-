import React, { useEffect, useMemo } from 'react';
import {
  Eye,
  EyeOff,
  Monitor,
  Pencil,
  Redo2,
  RotateCcw,
  SlidersHorizontal,
  Smartphone,
  Tablet,
  Undo2,
  X,
} from 'lucide-react';
import {
  BuilderModificationProvider,
  useBuilderModifications,
  useOptionalBuilderModifications,
} from './builderContext.ts';
import type {
  BuilderLayoutProps,
  BuilderViewportMode,
  ComponentOverridePatch,
  EditableTargetId,
} from './types.ts';

const COL_SPAN_CLASSES: Record<3 | 4 | 6 | 8 | 12, string> = {
  3: 'lg:col-span-3',
  4: 'lg:col-span-4',
  6: 'lg:col-span-6',
  8: 'lg:col-span-8',
  12: 'lg:col-span-12',
};

const VIEWPORT_WIDTH_CLASSES: Record<BuilderViewportMode, string> = {
  desktop: 'w-full',
  tablet: 'max-w-[780px] mx-auto',
  mobile: 'max-w-[400px] mx-auto',
};

export interface BuilderEditableSlotProps {
  targetId: EditableTargetId;
  defaultTitle: string;
  defaultSubtitle?: string;
  category?: string;
  defaultColSpan?: 3 | 4 | 6 | 8 | 12;
  children: React.ReactNode;
}

/**
 * Envuelve un componente existente de VectorIA Studio sin modificar ni sobrescribir
 * su lógica, estado interno ni cálculos matemáticos.
 */
export const BuilderEditableSlot: React.FC<BuilderEditableSlotProps> = ({
  targetId,
  defaultTitle,
  defaultSubtitle,
  category,
  defaultColSpan = 12,
  children,
}) => {
  const {
    state,
    registerTarget,
    selectTarget,
    applyOverride,
    getEffectiveOverride,
  } = useBuilderModifications();

  useEffect(() => {
    registerTarget({
      targetId,
      defaultTitle,
      defaultSubtitle,
      category,
      defaultColSpan,
    });
  }, [targetId, defaultTitle, defaultSubtitle, category, defaultColSpan, registerTarget]);

  const override = getEffectiveOverride(targetId);
  const isVisible = override?.visible ?? true;
  const isSelected = state.isEditMode && state.selectedTargetId === targetId;
  const effectiveColSpan = override?.colSpan ?? defaultColSpan;
  const effectiveTitle = override?.customTitle ?? defaultTitle;
  const effectiveSubtitle = override?.customSubtitle ?? defaultSubtitle;

  if (!isVisible && !state.isEditMode) {
    return null;
  }

  const inlineStyle: React.CSSProperties = {
    order: override?.order,
    padding: override?.paddingPx !== undefined ? `${override.paddingPx}px` : undefined,
    borderRadius:
      override?.borderRadiusPx !== undefined ? `${override.borderRadiusPx}px` : undefined,
    backgroundColor: override?.backgroundColor || undefined,
    color: override?.textColor || undefined,
    borderColor: isSelected
      ? 'var(--accent-primary)'
      : override?.accentColor || undefined,
  };

  return (
    <section
      data-builder-target={targetId}
      style={inlineStyle}
      onClick={(e) => {
        if (!state.isEditMode) return;
        e.stopPropagation();
        selectTarget(targetId);
      }}
      className={`col-span-12 ${COL_SPAN_CLASSES[effectiveColSpan]} surface-card rounded-2xl transition-colors ${
        state.isEditMode
          ? isSelected
            ? 'ring-2 ring-[var(--accent-primary)] border-[var(--accent-primary)] cursor-pointer'
            : 'border-dashed hover:border-[var(--accent-primary)] cursor-pointer'
          : ''
      } ${!isVisible ? 'opacity-50' : ''}`}
    >
      {(state.isEditMode || override?.customTitle || override?.customSubtitle || override?.customNote) && (
        <div className="px-4 pt-3 pb-2 border-b border-[var(--border-hairline)] flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              {category && (
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-muted)] whitespace-nowrap">
                  {category}
                </span>
              )}
              <h3
                className="text-sm font-semibold truncate"
                style={override?.accentColor ? { color: override.accentColor } : undefined}
              >
                {effectiveTitle}
              </h3>
            </div>
            {effectiveSubtitle && (
              <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">
                {effectiveSubtitle}
              </p>
            )}
            {override?.customNote && (
              <p className="text-xs mt-1 px-2.5 py-1 rounded-lg bg-[var(--bg-elevated)] text-[var(--text-primary)]">
                {override.customNote}
              </p>
            )}
          </div>

          {state.isEditMode && (
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  applyOverride(targetId, { visible: !isVisible });
                }}
                aria-label={isVisible ? 'Ocultar componente' : 'Mostrar componente'}
                className="p-1.5 rounded-lg border border-[var(--border-hairline)] hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] cursor-pointer"
              >
                {isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  selectTarget(targetId);
                }}
                aria-label="Editar propiedades"
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[var(--accent-primary)] text-[var(--accent-contrast)] whitespace-nowrap cursor-pointer"
              >
                Editar
              </button>
            </div>
          )}
        </div>
      )}

      <div className={override?.paddingPx !== undefined ? '' : 'p-1'}>{children}</div>
    </section>
  );
};

const BuilderSlotInspectorPanel: React.FC = () => {
  const { state, selectTarget, applyOverride, resetOverride } = useBuilderModifications();
  const targetId = state.selectedTargetId;

  if (!state.isEditMode || !targetId) {
    return null;
  }

  const targetMeta = state.targets[targetId];
  const current: Partial<ComponentOverridePatch> = state.overrides[targetId] ?? {};
  const effectiveVisible = current.visible ?? true;
  const effectiveColSpan = current.colSpan ?? targetMeta?.defaultColSpan ?? 12;

  return (
    <aside
      aria-label="Inspector rápido de componente"
      className="surface-card rounded-2xl p-4 space-y-4 border border-[var(--border-hairline)]"
    >
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--border-hairline)]">
        <div className="min-w-0">
          <p className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
            Inspector de componente
          </p>
          <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
            {targetMeta?.defaultTitle ?? targetId}
          </p>
        </div>
        <button
          type="button"
          onClick={() => selectTarget(null)}
          aria-label="Cerrar inspector"
          className="p-1.5 rounded-lg border border-[var(--border-hairline)] hover:bg-[var(--bg-elevated)] cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-3 text-xs">
        <label className="block space-y-1">
          <span className="text-[var(--text-muted)] font-medium">Título personalizado</span>
          <input
            type="text"
            value={current.customTitle ?? ''}
            placeholder={targetMeta?.defaultTitle ?? 'Título del componente'}
            onChange={(e) => applyOverride(targetId, { customTitle: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-[var(--text-muted)] font-medium">Subtítulo descriptivo</span>
          <input
            type="text"
            value={current.customSubtitle ?? ''}
            placeholder={targetMeta?.defaultSubtitle ?? 'Descripción opcional'}
            onChange={(e) => applyOverride(targetId, { customSubtitle: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-[var(--text-muted)] font-medium">Nota o aviso editorial</span>
          <textarea
            rows={2}
            value={current.customNote ?? ''}
            placeholder="Nota visible sin alterar el motor interno..."
            onChange={(e) => applyOverride(targetId, { customNote: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-hairline)] text-[var(--text-primary)] resize-none"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-[var(--text-muted)] font-medium">Ancho (12 col.)</span>
            <select
              value={effectiveColSpan}
              onChange={(e) =>
                applyOverride(targetId, {
                  colSpan: Number(e.target.value) as 3 | 4 | 6 | 8 | 12,
                })
              }
              className="w-full px-2.5 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
            >
              <option value={3}>3 columnas (25%)</option>
              <option value={4}>4 columnas (33%)</option>
              <option value={6}>6 columnas (50%)</option>
              <option value={8}>8 columnas (66%)</option>
              <option value={12}>12 columnas (100%)</option>
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-[var(--text-muted)] font-medium">Orden visual</span>
            <input
              type="number"
              min={0}
              max={200}
              value={current.order ?? 0}
              onChange={(e) => applyOverride(targetId, { order: Number(e.target.value) })}
              className="w-full px-2.5 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-hairline)] text-[var(--text-primary)] tabular-nums"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-[var(--text-muted)] font-medium">Relleno (px)</span>
            <input
              type="number"
              min={0}
              max={64}
              value={current.paddingPx ?? 4}
              onChange={(e) => applyOverride(targetId, { paddingPx: Number(e.target.value) })}
              className="w-full px-2.5 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-hairline)] text-[var(--text-primary)] tabular-nums"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-[var(--text-muted)] font-medium">Acento HEX</span>
            <input
              type="text"
              value={current.accentColor ?? ''}
              placeholder="#38bdf8"
              onChange={(e) => applyOverride(targetId, { accentColor: e.target.value })}
              className="w-full px-2.5 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-hairline)] text-[var(--text-primary)] font-mono"
            />
          </label>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-[var(--border-hairline)] gap-2">
          <button
            type="button"
            onClick={() => applyOverride(targetId, { visible: !effectiveVisible })}
            className="px-3 py-1.5 rounded-lg border border-[var(--border-hairline)] hover:bg-[var(--bg-elevated)] text-xs font-medium whitespace-nowrap cursor-pointer"
          >
            {effectiveVisible ? 'Ocultar bloque' : 'Mostrar bloque'}
          </button>
          <button
            type="button"
            onClick={() => resetOverride(targetId)}
            className="px-3 py-1.5 rounded-lg border border-[var(--border-hairline)] hover:bg-[var(--bg-elevated)] text-xs font-medium text-[var(--text-muted)] flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restaurar
          </button>
        </div>
      </div>
    </aside>
  );
};

const BuilderLayoutInner: React.FC<BuilderLayoutProps> = ({
  title = 'Capa Visual Editable',
  subtitle = 'Personaliza la presentación de los módulos existentes sin alterar su lógica interna.',
  slots,
  children,
  allowEditToggle = true,
  onOpenFullBuilder,
  className = '',
}) => {
  const {
    state,
    toggleEditMode,
    setViewport,
    resetAllOverrides,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useBuilderModifications();

  const sortedSlots = useMemo(() => {
    if (!slots) return [];
    return [...slots].sort((a, b) => {
      const orderA = state.overrides[a.targetId]?.order ?? 0;
      const orderB = state.overrides[b.targetId]?.order ?? 0;
      return orderA - orderB;
    });
  }, [slots, state.overrides]);

  const overrideCount = Object.keys(state.overrides).length;

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="surface-card rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 border border-[var(--border-hairline)]">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)] truncate">{title}</h2>
            {overrideCount > 0 && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-muted)] tabular-nums whitespace-nowrap">
                {overrideCount} ajuste{overrideCount === 1 ? '' : 's'}
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">{subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {state.isEditMode && (
            <>
              <div
                className="flex items-center rounded-lg border border-[var(--border-hairline)] p-0.5 bg-[var(--bg-elevated)]"
                role="group"
                aria-label="Vista responsiva"
              >
                {(
                  [
                    { id: 'desktop', icon: Monitor, label: 'Escritorio' },
                    { id: 'tablet', icon: Tablet, label: 'Tablet' },
                    { id: 'mobile', icon: Smartphone, label: 'Móvil' },
                  ] as const
                ).map((vp) => {
                  const Icon = vp.icon;
                  const active = state.viewport === vp.id;
                  return (
                    <button
                      key={vp.id}
                      type="button"
                      onClick={() => setViewport(vp.id)}
                      aria-label={vp.label}
                      className={`p-1.5 rounded-md cursor-pointer ${
                        active
                          ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                disabled={!canUndo}
                onClick={undo}
                aria-label="Deshacer"
                className="p-2 rounded-lg border border-[var(--border-hairline)] disabled:opacity-40 hover:bg-[var(--bg-elevated)] cursor-pointer"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={!canRedo}
                onClick={redo}
                aria-label="Rehacer"
                className="p-2 rounded-lg border border-[var(--border-hairline)] disabled:opacity-40 hover:bg-[var(--bg-elevated)] cursor-pointer"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
              {overrideCount > 0 && (
                <button
                  type="button"
                  onClick={resetAllOverrides}
                  className="px-2.5 py-1.5 rounded-lg border border-[var(--border-hairline)] hover:bg-[var(--bg-elevated)] text-xs font-medium text-[var(--text-muted)] whitespace-nowrap cursor-pointer"
                >
                  Restablecer todo
                </button>
              )}
            </>
          )}

          {onOpenFullBuilder && (
            <button
              type="button"
              onClick={onOpenFullBuilder}
              className="px-3 py-1.5 rounded-lg border border-[var(--border-hairline)] hover:bg-[var(--bg-elevated)] text-xs font-medium text-[var(--text-primary)] whitespace-nowrap cursor-pointer"
            >
              Visual Builder Completo
            </button>
          )}

          {allowEditToggle && (
            <button
              type="button"
              onClick={toggleEditMode}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                state.isEditMode
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                  : 'border border-[var(--border-hairline)] hover:bg-[var(--bg-elevated)] text-[var(--text-primary)]'
              }`}
            >
              <Pencil className="w-3.5 h-3.5" />
              {state.isEditMode ? 'Salir de edición' : 'Editar layout'}
            </button>
          )}
        </div>
      </div>

      <div
        className={`grid grid-cols-1 ${
          state.isEditMode && state.selectedTargetId ? 'xl:grid-cols-[1fr_320px]' : ''
        } gap-4 items-start`}
      >
        <div className={VIEWPORT_WIDTH_CLASSES[state.viewport]}>
          {sortedSlots.length > 0 ? (
            <div className="grid grid-cols-12 gap-4">
              {sortedSlots.map((slot) => (
                <BuilderEditableSlot
                  key={slot.targetId}
                  targetId={slot.targetId}
                  defaultTitle={slot.defaultTitle}
                  defaultSubtitle={slot.defaultSubtitle}
                  category={slot.category}
                  defaultColSpan={slot.defaultColSpan}
                >
                  {slot.render()}
                </BuilderEditableSlot>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-12 gap-4">{children}</div>
          )}
        </div>

        <BuilderSlotInspectorPanel />
      </div>
    </div>
  );
};

/**
 * Componente Layout básico del Visual Builder.
 * Funciona tanto dentro de <BuilderModificationProvider> como de forma autónoma.
 */
export const BuilderLayout: React.FC<BuilderLayoutProps> = (props) => {
  const existingCtx = useOptionalBuilderModifications();
  if (existingCtx) {
    return <BuilderLayoutInner {...props} />;
  }
  return (
    <BuilderModificationProvider>
      <BuilderLayoutInner {...props} />
    </BuilderModificationProvider>
  );
};
