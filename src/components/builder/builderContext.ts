import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react';
import { sanitizeBuilderText, sanitizeColorToken } from '../../utils/builderSecurity.ts';
import type {
  BuilderModificationAction,
  BuilderModificationContextValue,
  BuilderModificationState,
  BuilderViewportMode,
  ComponentOverridePatch,
  EditableTargetId,
  OverrideMap,
  RegisteredEditableTarget,
} from './types.ts';

export const BUILDER_OVERRIDES_STORAGE_KEY = 'vectoria-builder-overrides-v1';
const MAX_HISTORY_STEPS = 30;
const VALID_COL_SPANS = new Set<3 | 4 | 6 | 8 | 12>([3, 4, 6, 8, 12]);

function cloneOverrideMap(map: OverrideMap): OverrideMap {
  return JSON.parse(JSON.stringify(map)) as OverrideMap;
}

function clampNumber(val: unknown, min: number, max: number): number | undefined {
  if (typeof val !== 'number' || !Number.isFinite(val)) return undefined;
  return Math.max(min, Math.min(max, Math.round(val)));
}

/**
 * Sanitiza un parche de modificación para asegurar integridad y evitar inyecciones XSS.
 */
export function sanitizeComponentPatch(
  targetId: EditableTargetId,
  patch: Partial<Omit<ComponentOverridePatch, 'targetId' | 'updatedAt'>>,
  existing?: ComponentOverridePatch
): ComponentOverridePatch {
  const safeId = sanitizeBuilderText(targetId, 80);
  const next: ComponentOverridePatch = {
    ...(existing ?? {}),
    targetId: safeId,
    updatedAt: new Date().toISOString(),
  };

  if (patch.customTitle !== undefined) {
    const clean = sanitizeBuilderText(patch.customTitle, 140);
    if (clean) next.customTitle = clean;
    else delete next.customTitle;
  }
  if (patch.customSubtitle !== undefined) {
    const clean = sanitizeBuilderText(patch.customSubtitle, 260);
    if (clean) next.customSubtitle = clean;
    else delete next.customSubtitle;
  }
  if (patch.customNote !== undefined) {
    const clean = sanitizeBuilderText(patch.customNote, 500);
    if (clean) next.customNote = clean;
    else delete next.customNote;
  }
  if (patch.visible !== undefined) {
    next.visible = Boolean(patch.visible);
  }
  if (patch.colSpan !== undefined && VALID_COL_SPANS.has(patch.colSpan)) {
    next.colSpan = patch.colSpan;
  }
  if (patch.order !== undefined) {
    const clamped = clampNumber(patch.order, 0, 200);
    if (clamped !== undefined) next.order = clamped;
  }
  if (patch.paddingPx !== undefined) {
    const clamped = clampNumber(patch.paddingPx, 0, 64);
    if (clamped !== undefined) next.paddingPx = clamped;
  }
  if (patch.borderRadiusPx !== undefined) {
    const clamped = clampNumber(patch.borderRadiusPx, 0, 32);
    if (clamped !== undefined) next.borderRadiusPx = clamped;
  }
  if (patch.backgroundColor !== undefined) {
    const color = sanitizeColorToken(patch.backgroundColor, '');
    if (color) next.backgroundColor = color;
    else delete next.backgroundColor;
  }
  if (patch.textColor !== undefined) {
    const color = sanitizeColorToken(patch.textColor, '');
    if (color) next.textColor = color;
    else delete next.textColor;
  }
  if (patch.accentColor !== undefined) {
    const color = sanitizeColorToken(patch.accentColor, '');
    if (color) next.accentColor = color;
    else delete next.accentColor;
  }

  return next;
}

export function createInitialModificationState(
  initialOverrides: OverrideMap = {}
): BuilderModificationState {
  return {
    isEditMode: false,
    viewport: 'desktop',
    selectedTargetId: null,
    targets: {},
    overrides: cloneOverrideMap(initialOverrides),
    past: [],
    future: [],
    dirty: false,
    lastModifiedAt: null,
  };
}

export function builderModificationReducer(
  state: BuilderModificationState,
  action: BuilderModificationAction
): BuilderModificationState {
  switch (action.type) {
    case 'SET_EDIT_MODE':
      return {
        ...state,
        isEditMode: action.enabled,
        selectedTargetId: action.enabled ? state.selectedTargetId : null,
      };

    case 'SET_VIEWPORT':
      return {
        ...state,
        viewport: action.viewport,
      };

    case 'SELECT_TARGET':
      return {
        ...state,
        selectedTargetId: action.targetId ? sanitizeBuilderText(action.targetId, 80) : null,
      };

    case 'REGISTER_TARGET': {
      const safeId = sanitizeBuilderText(action.target.targetId, 80);
      if (!safeId) return state;
      const existing = state.targets[safeId];
      const nextTarget: RegisteredEditableTarget = {
        targetId: safeId,
        defaultTitle: sanitizeBuilderText(action.target.defaultTitle, 140) || safeId,
        defaultSubtitle: action.target.defaultSubtitle
          ? sanitizeBuilderText(action.target.defaultSubtitle, 260)
          : undefined,
        category: action.target.category
          ? sanitizeBuilderText(action.target.category, 60)
          : undefined,
        defaultColSpan: action.target.defaultColSpan,
      };
      if (
        existing &&
        existing.defaultTitle === nextTarget.defaultTitle &&
        existing.defaultSubtitle === nextTarget.defaultSubtitle &&
        existing.category === nextTarget.category &&
        existing.defaultColSpan === nextTarget.defaultColSpan
      ) {
        return state;
      }
      return {
        ...state,
        targets: {
          ...state.targets,
          [safeId]: nextTarget,
        },
      };
    }

    case 'APPLY_OVERRIDE': {
      const safeId = sanitizeBuilderText(action.targetId, 80);
      if (!safeId) return state;
      const prevOverrides = state.overrides;
      const updatedPatch = sanitizeComponentPatch(safeId, action.patch, prevOverrides[safeId]);
      const nextOverrides: OverrideMap = {
        ...prevOverrides,
        [safeId]: updatedPatch,
      };
      const past = [...state.past, cloneOverrideMap(prevOverrides)].slice(-MAX_HISTORY_STEPS);
      return {
        ...state,
        overrides: nextOverrides,
        past,
        future: [],
        dirty: true,
        lastModifiedAt: updatedPatch.updatedAt,
      };
    }

    case 'RESET_OVERRIDE': {
      const safeId = sanitizeBuilderText(action.targetId, 80);
      if (!safeId || !state.overrides[safeId]) return state;
      const prevOverrides = state.overrides;
      const nextOverrides = { ...prevOverrides };
      delete nextOverrides[safeId];
      const past = [...state.past, cloneOverrideMap(prevOverrides)].slice(-MAX_HISTORY_STEPS);
      return {
        ...state,
        overrides: nextOverrides,
        past,
        future: [],
        dirty: true,
        lastModifiedAt: new Date().toISOString(),
      };
    }

    case 'RESET_ALL_OVERRIDES': {
      if (Object.keys(state.overrides).length === 0) return state;
      const past = [...state.past, cloneOverrideMap(state.overrides)].slice(-MAX_HISTORY_STEPS);
      return {
        ...state,
        overrides: {},
        past,
        future: [],
        dirty: true,
        lastModifiedAt: new Date().toISOString(),
      };
    }

    case 'HYDRATE_OVERRIDES': {
      const sanitized: OverrideMap = {};
      for (const [id, patch] of Object.entries(action.overrides)) {
        const cleanId = sanitizeBuilderText(id, 80);
        if (!cleanId || !patch || typeof patch !== 'object') continue;
        sanitized[cleanId] = sanitizeComponentPatch(cleanId, patch);
      }
      const past = [...state.past, cloneOverrideMap(state.overrides)].slice(-MAX_HISTORY_STEPS);
      return {
        ...state,
        overrides: sanitized,
        past,
        future: [],
        dirty: true,
        lastModifiedAt: new Date().toISOString(),
      };
    }

    case 'UNDO': {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        ...state,
        overrides: cloneOverrideMap(previous),
        past: state.past.slice(0, -1),
        future: [cloneOverrideMap(state.overrides), ...state.future].slice(0, MAX_HISTORY_STEPS),
        dirty: true,
        lastModifiedAt: new Date().toISOString(),
      };
    }

    case 'REDO': {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      return {
        ...state,
        overrides: cloneOverrideMap(next),
        past: [...state.past, cloneOverrideMap(state.overrides)].slice(-MAX_HISTORY_STEPS),
        future: state.future.slice(1),
        dirty: true,
        lastModifiedAt: new Date().toISOString(),
      };
    }

    default:
      return state;
  }
}

function loadPersistedOverrides(): OverrideMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(BUILDER_OVERRIDES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const sanitized: OverrideMap = {};
    for (const [key, val] of Object.entries(parsed as Record<string, unknown>)) {
      if (!val || typeof val !== 'object') continue;
      const cleanId = sanitizeBuilderText(key, 80);
      if (!cleanId) continue;
      sanitized[cleanId] = sanitizeComponentPatch(
        cleanId,
        val as Partial<ComponentOverridePatch>
      );
    }
    return sanitized;
  } catch {
    return {};
  }
}

const BuilderModificationContext = createContext<BuilderModificationContextValue | null>(null);

export interface BuilderModificationProviderProps {
  children?: React.ReactNode;
  persistLocally?: boolean;
  initialOverrides?: OverrideMap;
}

export const BuilderModificationProvider: React.FC<BuilderModificationProviderProps> = ({
  children,
  persistLocally = true,
  initialOverrides,
}) => {
  const [state, dispatch] = useReducer(
    builderModificationReducer,
    initialOverrides,
    (seed) => createInitialModificationState(seed ?? (persistLocally ? loadPersistedOverrides() : {}))
  );

  useEffect(() => {
    if (!persistLocally || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        BUILDER_OVERRIDES_STORAGE_KEY,
        JSON.stringify(state.overrides)
      );
    } catch {
      // Ignorar errores de cuota de almacenamiento local sin interrumpir la UI
    }
  }, [persistLocally, state.overrides]);

  const setEditMode = useCallback((enabled: boolean) => {
    dispatch({ type: 'SET_EDIT_MODE', enabled });
  }, []);

  const toggleEditMode = useCallback(() => {
    dispatch({ type: 'SET_EDIT_MODE', enabled: !state.isEditMode });
  }, [state.isEditMode]);

  const setViewport = useCallback((viewport: BuilderViewportMode) => {
    dispatch({ type: 'SET_VIEWPORT', viewport });
  }, []);

  const selectTarget = useCallback((targetId: EditableTargetId | null) => {
    dispatch({ type: 'SELECT_TARGET', targetId });
  }, []);

  const registerTarget = useCallback((target: RegisteredEditableTarget) => {
    dispatch({ type: 'REGISTER_TARGET', target });
  }, []);

  const applyOverride = useCallback(
    (
      targetId: EditableTargetId,
      patch: Partial<Omit<ComponentOverridePatch, 'targetId' | 'updatedAt'>>
    ) => {
      dispatch({ type: 'APPLY_OVERRIDE', targetId, patch });
    },
    []
  );

  const resetOverride = useCallback((targetId: EditableTargetId) => {
    dispatch({ type: 'RESET_OVERRIDE', targetId });
  }, []);

  const resetAllOverrides = useCallback(() => {
    dispatch({ type: 'RESET_ALL_OVERRIDES' });
  }, []);

  const undo = useCallback(() => {
    dispatch({ type: 'UNDO' });
  }, []);

  const redo = useCallback(() => {
    dispatch({ type: 'REDO' });
  }, []);

  const getEffectiveOverride = useCallback(
    (targetId: EditableTargetId) => state.overrides[targetId] ?? null,
    [state.overrides]
  );

  const exportOverridesJson = useCallback(() => {
    return JSON.stringify(
      {
        schema: 'vectoria-builder-overrides-v1',
        exportedAt: new Date().toISOString(),
        overrides: state.overrides,
      },
      null,
      2
    );
  }, [state.overrides]);

  const importOverridesJson = useCallback((rawJson: string) => {
    try {
      if (rawJson.length > 512_000) {
        return { ok: false, error: 'El archivo de modificaciones supera el límite permitido (512 KB).' };
      }
      const parsed = JSON.parse(rawJson) as {
        schema?: string;
        overrides?: OverrideMap;
      };
      if (
        !parsed ||
        parsed.schema !== 'vectoria-builder-overrides-v1' ||
        !parsed.overrides ||
        typeof parsed.overrides !== 'object' ||
        Array.isArray(parsed.overrides)
      ) {
        return {
          ok: false,
          error: 'Formato inválido: se esperaba un esquema vectoria-builder-overrides-v1.',
        };
      }
      dispatch({ type: 'HYDRATE_OVERRIDES', overrides: parsed.overrides });
      return { ok: true };
    } catch {
      return { ok: false, error: 'El JSON proporcionado no es válido.' };
    }
  }, []);

  const value = useMemo<BuilderModificationContextValue>(
    () => ({
      state,
      setEditMode,
      toggleEditMode,
      setViewport,
      selectTarget,
      registerTarget,
      applyOverride,
      resetOverride,
      resetAllOverrides,
      undo,
      redo,
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
      getEffectiveOverride,
      exportOverridesJson,
      importOverridesJson,
    }),
    [
      state,
      setEditMode,
      toggleEditMode,
      setViewport,
      selectTarget,
      registerTarget,
      applyOverride,
      resetOverride,
      resetAllOverrides,
      undo,
      redo,
      getEffectiveOverride,
      exportOverridesJson,
      importOverridesJson,
    ]
  );

  return React.createElement(BuilderModificationContext.Provider, { value }, children);
};

export const BuilderStateProvider = BuilderModificationProvider;

export function useBuilderModifications(): BuilderModificationContextValue {
  const ctx = useContext(BuilderModificationContext);
  if (!ctx) {
    throw new Error(
      'useBuilderModifications debe utilizarse dentro de <BuilderModificationProvider>.'
    );
  }
  return ctx;
}

export function useOptionalBuilderModifications(): BuilderModificationContextValue | null {
  return useContext(BuilderModificationContext);
}
