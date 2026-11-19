import type React from 'react';
import type {
  BuilderAuthSession,
  BuilderAuditEntry,
  BuilderBlock,
  BuilderBlockType,
  BuilderChartConfig,
  BuilderChartKind,
  BuilderComponentCategory,
  BuilderComponentTemplate,
  BuilderDataSourceKey,
  BuilderPage,
  BuilderRole,
  BuilderSection,
  BuilderStateDocument,
  BuilderBlockStyles,
  BuilderThemePreset,
  BuilderVersionEntry,
  ModuleConnection,
  PreparedModuleSpec,
} from '../../types/builder.ts';

export type {
  BuilderAuthSession,
  BuilderAuditEntry,
  BuilderBlock,
  BuilderBlockType,
  BuilderChartConfig,
  BuilderChartKind,
  BuilderComponentCategory,
  BuilderComponentTemplate,
  BuilderDataSourceKey,
  BuilderPage,
  BuilderRole,
  BuilderSection,
  BuilderStateDocument,
  BuilderBlockStyles,
  BuilderThemePreset,
  BuilderVersionEntry,
  ModuleConnection,
  PreparedModuleSpec,
};

/**
 * Identificador único de un componente existente o sección registrada
 * para edición visual no destructiva.
 */
export type EditableTargetId = string;

/**
 * Previsualización responsiva disponible en el layout del Visual Builder.
 */
export type BuilderViewportMode = 'desktop' | 'tablet' | 'mobile';

/**
 * Modificación no destructiva aplicada encima de un componente existente
 * sin alterar ni sobrescribir su lógica interna ni su motor matemático/neuronal.
 */
export interface ComponentOverridePatch {
  targetId: EditableTargetId;
  customTitle?: string;
  customSubtitle?: string;
  customNote?: string;
  visible?: boolean;
  colSpan?: 3 | 4 | 6 | 8 | 12;
  order?: number;
  paddingPx?: number;
  borderRadiusPx?: number;
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
  updatedAt: string;
}

/**
 * Metadatos descriptivos de un componente existente expuesto al editor visual.
 */
export interface RegisteredEditableTarget {
  targetId: EditableTargetId;
  defaultTitle: string;
  defaultSubtitle?: string;
  category?: string;
  defaultColSpan?: 3 | 4 | 6 | 8 | 12;
}

export type OverrideMap = Record<EditableTargetId, ComponentOverridePatch>;

export interface BuilderModificationState {
  isEditMode: boolean;
  viewport: BuilderViewportMode;
  selectedTargetId: EditableTargetId | null;
  targets: Record<EditableTargetId, RegisteredEditableTarget>;
  overrides: OverrideMap;
  past: OverrideMap[];
  future: OverrideMap[];
  dirty: boolean;
  lastModifiedAt: string | null;
}

export type BuilderModificationAction =
  | { type: 'SET_EDIT_MODE'; enabled: boolean }
  | { type: 'SET_VIEWPORT'; viewport: BuilderViewportMode }
  | { type: 'SELECT_TARGET'; targetId: EditableTargetId | null }
  | { type: 'REGISTER_TARGET'; target: RegisteredEditableTarget }
  | {
      type: 'APPLY_OVERRIDE';
      targetId: EditableTargetId;
      patch: Partial<Omit<ComponentOverridePatch, 'targetId' | 'updatedAt'>>;
    }
  | { type: 'RESET_OVERRIDE'; targetId: EditableTargetId }
  | { type: 'RESET_ALL_OVERRIDES' }
  | { type: 'HYDRATE_OVERRIDES'; overrides: OverrideMap }
  | { type: 'UNDO' }
  | { type: 'REDO' };

export interface BuilderModificationContextValue {
  state: BuilderModificationState;
  setEditMode: (enabled: boolean) => void;
  toggleEditMode: () => void;
  setViewport: (viewport: BuilderViewportMode) => void;
  selectTarget: (targetId: EditableTargetId | null) => void;
  registerTarget: (target: RegisteredEditableTarget) => void;
  applyOverride: (
    targetId: EditableTargetId,
    patch: Partial<Omit<ComponentOverridePatch, 'targetId' | 'updatedAt'>>
  ) => void;
  resetOverride: (targetId: EditableTargetId) => void;
  resetAllOverrides: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  getEffectiveOverride: (targetId: EditableTargetId) => ComponentOverridePatch | null;
  exportOverridesJson: () => string;
  importOverridesJson: (rawJson: string) => { ok: boolean; error?: string };
}

export interface BuilderLayoutSlot {
  targetId: EditableTargetId;
  defaultTitle: string;
  defaultSubtitle?: string;
  category?: string;
  defaultColSpan?: 3 | 4 | 6 | 8 | 12;
  render: () => React.ReactNode;
}

export interface BuilderLayoutProps {
  title?: string;
  subtitle?: string;
  slots?: BuilderLayoutSlot[];
  children?: React.ReactNode;
  allowEditToggle?: boolean;
  onOpenFullBuilder?: () => void;
  className?: string;
}
