import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import {
  BuilderAuditEntry,
  BuilderAuthSession,
  BuilderPage,
  BuilderRole,
  BuilderStateDocument,
  BuilderThemePreset,
  BuilderVersionEntry,
} from '../types/builder';
import { createInitialBuilderDocument } from '../utils/builderDefaults';
import { validateAndSanitizeBuilderDocument } from '../utils/builderSecurity';
import { useTheme } from './ThemeContext';

const AUTH_SESSION_KEY = 'vectoria-builder-session-v1';

interface BuilderContextValue {
  published: BuilderStateDocument;
  activeCustomPageId: string | null;
  setActiveCustomPageId: (pageId: string | null) => void;
  session: BuilderAuthSession | null;
  authInitialized: boolean;
  diskPersisted: boolean;
  refreshPublished: () => Promise<void>;
  refreshAuthStatus: () => Promise<void>;
  setupAdminPasscode: (
    adminPasscode: string,
    editorPasscode?: string,
    setupToken?: string,
    viewerPasscode?: string
  ) => Promise<{ ok: boolean; error?: string }>;
  loginBuilder: (
    passcode: string,
    role: BuilderRole
  ) => Promise<{ ok: boolean; error?: string }>;
  logoutBuilder: () => Promise<void>;
  fetchFullBundle: () => Promise<{
    ok: boolean;
    error?: string;
    draft?: BuilderStateDocument;
    published?: BuilderStateDocument;
    hasUnpublishedChanges?: boolean;
    versions?: BuilderVersionEntry[];
    auditLog?: BuilderAuditEntry[];
    publishedAt?: string | null;
    updatedAt?: string;
  }>;
  saveDraftRemote: (
    doc: BuilderStateDocument,
    description: string,
    changedItems: string[]
  ) => Promise<{
    ok: boolean;
    error?: string;
    bundle?: {
      draft: BuilderStateDocument;
      published: BuilderStateDocument;
      hasUnpublishedChanges: boolean;
      versions: BuilderVersionEntry[];
      auditLog: BuilderAuditEntry[];
      publishedAt: string | null;
    };
  }>;
  publishDraftRemote: (description?: string) => Promise<{
    ok: boolean;
    error?: string;
    bundle?: {
      draft: BuilderStateDocument;
      published: BuilderStateDocument;
      hasUnpublishedChanges: boolean;
      versions: BuilderVersionEntry[];
      auditLog: BuilderAuditEntry[];
      publishedAt: string | null;
    };
  }>;
  discardDraftRemote: () => Promise<{ ok: boolean; draft?: BuilderStateDocument; error?: string }>;
  restoreVersionRemote: (versionId: string) => Promise<{
    ok: boolean;
    draft?: BuilderStateDocument;
    versions?: BuilderVersionEntry[];
    error?: string;
  }>;
  publishedCustomPages: BuilderPage[];
  activeThemePreset: BuilderThemePreset | null;
}

const BuilderContext = createContext<BuilderContextValue | null>(null);

function loadStoredSession(): BuilderAuthSession | null {
  try {
    const raw = window.sessionStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BuilderAuthSession;
    if (!parsed.token || !parsed.expiresAt || Date.now() >= Date.parse(parsed.expiresAt)) {
      window.sessionStorage.removeItem(AUTH_SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export const BuilderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { setTheme } = useTheme();
  const [published, setPublished] = useState<BuilderStateDocument>(() =>
    createInitialBuilderDocument()
  );
  const [activeCustomPageId, setActiveCustomPageId] = useState<string | null>(null);
  const [session, setSession] = useState<BuilderAuthSession | null>(() => loadStoredSession());
  const [authInitialized, setAuthInitialized] = useState(false);
  const [diskPersisted, setDiskPersisted] = useState(true);

  const persistSession = useCallback((next: BuilderAuthSession | null) => {
    setSession(next);
    try {
      if (next) {
        window.sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(next));
      } else {
        window.sessionStorage.removeItem(AUTH_SESSION_KEY);
      }
    } catch {
      // Ignore storage failures
    }
  }, []);

  const refreshPublished = useCallback(async () => {
    try {
      const res = await fetch('/api/builder/published');
      if (!res.ok) return;
      const data = (await res.json()) as { published?: unknown };
      const check = validateAndSanitizeBuilderDocument(data.published);
      if (check.valid) {
        setPublished(check.document);
      }
    } catch {
      // Keep local fallback cleanly if server temporarily unavailable
    }
  }, []);

  const refreshAuthStatus = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (session?.token) {
        headers.Authorization = `Bearer ${session.token}`;
      }
      const res = await fetch('/api/builder/auth/status', { headers });
      if (!res.ok) return;
      const data = (await res.json()) as {
        initialized: boolean;
        diskPersisted?: boolean;
        authenticated: boolean;
      };
      setAuthInitialized(Boolean(data.initialized));
      if (typeof data.diskPersisted === 'boolean') {
        setDiskPersisted(data.diskPersisted);
      }
      if (session && !data.authenticated) {
        persistSession(null);
      }
    } catch {
      // Ignore transient network errors
    }
  }, [session, persistSession]);

  useEffect(() => {
    void refreshPublished();
    void refreshAuthStatus();
  }, [refreshPublished, refreshAuthStatus]);

  // Apply non-destructive CSS variable overrides when a published custom theme preset is active
  const activeThemePreset =
    published.activeThemePresetId
      ? published.themePresets.find((p) => p.id === published.activeThemePresetId) ?? null
      : null;

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (!activeThemePreset) {
      root.style.removeProperty('--builder-custom-radius');
      root.style.removeProperty('--builder-custom-font');
      return;
    }
    setTheme(activeThemePreset.baseTheme);
    root.style.setProperty('--accent-primary', activeThemePreset.primaryColor);
    root.style.setProperty('--accent-secondary', activeThemePreset.secondaryColor);
    root.style.setProperty('--bg-canvas', activeThemePreset.canvasBg);
    root.style.setProperty('--bg-surface', activeThemePreset.surfaceBg);
    root.style.setProperty('--builder-custom-radius', `${activeThemePreset.borderRadiusPx}px`);
    root.style.setProperty('--builder-custom-font', activeThemePreset.fontFamily);
  }, [activeThemePreset, setTheme]);

  const setupAdminPasscode = useCallback(
    async (
      adminPasscode: string,
      editorPasscode?: string,
      setupToken?: string,
      viewerPasscode?: string
    ) => {
      try {
        const res = await fetch('/api/builder/auth/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adminPasscode,
            editorPasscode,
            viewerPasscode,
            setupToken,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          return { ok: false, error: data.message || 'No se pudo configurar el acceso.' };
        }
        persistSession({
          token: data.token,
          role: data.role,
          displayName: data.displayName,
          expiresAt: data.expiresAt,
        });
        setAuthInitialized(true);
        return { ok: true };
      } catch {
        return { ok: false, error: 'Error de conexión con el servidor.' };
      }
    },
    [persistSession]
  );

  const loginBuilder = useCallback(
    async (passcode: string, role: BuilderRole) => {
      try {
        const res = await fetch('/api/builder/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ passcode, role }),
        });
        const data = await res.json();
        if (!res.ok) {
          return { ok: false, error: data.message || 'Credenciales inválidas.' };
        }
        persistSession({
          token: data.token,
          role: data.role,
          displayName: data.displayName,
          expiresAt: data.expiresAt,
        });
        return { ok: true };
      } catch {
        return { ok: false, error: 'Error de conexión con el servidor.' };
      }
    },
    [persistSession]
  );

  const logoutBuilder = useCallback(async () => {
    try {
      if (session?.token) {
        await fetch('/api/builder/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.token}` },
        });
      }
    } finally {
      persistSession(null);
    }
  }, [session, persistSession]);

  const fetchFullBundle = useCallback(async () => {
    if (!session?.token) {
      return { ok: false, error: 'Sesión no iniciada.' };
    }
    try {
      const res = await fetch('/api/builder/state', {
        headers: { Authorization: `Bearer ${session.token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) persistSession(null);
        return { ok: false, error: data.message || 'No autorizado.' };
      }
      if (data.published) {
        setPublished(data.published);
      }
      return { ok: true, ...data };
    } catch {
      return { ok: false, error: 'No se pudo cargar el borrador del servidor.' };
    }
  }, [session, persistSession]);

  const saveDraftRemote = useCallback(
    async (doc: BuilderStateDocument, description: string, changedItems: string[]) => {
      if (!session?.token) return { ok: false, error: 'Debes iniciar sesión primero.' };
      try {
        const res = await fetch('/api/builder/draft', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.token}`,
          },
          body: JSON.stringify({ document: doc, description, changedItems }),
        });
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 401) persistSession(null);
          return { ok: false, error: data.message || 'Error al guardar borrador.' };
        }
        return { ok: true, bundle: data };
      } catch {
        return { ok: false, error: 'Error de red al guardar el borrador.' };
      }
    },
    [session, persistSession]
  );

  const publishDraftRemote = useCallback(
    async (description = 'Publicación desde VectorIA Visual Builder') => {
      if (!session?.token) return { ok: false, error: 'Debes iniciar sesión como Administrador.' };
      try {
        const res = await fetch('/api/builder/publish', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.token}`,
          },
          body: JSON.stringify({ description }),
        });
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 401) persistSession(null);
          return { ok: false, error: data.message || 'Error al publicar.' };
        }
        if (data.published) {
          setPublished(data.published);
        }
        return { ok: true, bundle: data };
      } catch {
        return { ok: false, error: 'Error de red al publicar cambios.' };
      }
    },
    [session, persistSession]
  );

  const discardDraftRemote = useCallback(async () => {
    if (!session?.token) return { ok: false, error: 'Sesión no iniciada.' };
    try {
      const res = await fetch('/api/builder/discard', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.token}` },
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.message || 'No se pudo descartar.' };
      return { ok: true, draft: data.draft };
    } catch {
      return { ok: false, error: 'Error de red al descartar borrador.' };
    }
  }, [session]);

  const restoreVersionRemote = useCallback(
    async (versionId: string) => {
      if (!session?.token) return { ok: false, error: 'Sesión no iniciada.' };
      try {
        const res = await fetch(`/api/builder/versions/${encodeURIComponent(versionId)}/restore`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.token}` },
        });
        const data = await res.json();
        if (!res.ok) return { ok: false, error: data.message || 'No se pudo restaurar versión.' };
        return { ok: true, draft: data.draft, versions: data.versions };
      } catch {
        return { ok: false, error: 'Error de red al restaurar versión.' };
      }
    },
    [session]
  );

  const publishedCustomPages = [...published.pages]
    .filter((p) => !p.isSystemPage && p.visible && p.showInSidebar)
    .sort((a, b) => a.order - b.order);

  return (
    <BuilderContext.Provider
      value={{
        published,
        activeCustomPageId,
        setActiveCustomPageId,
        session,
        authInitialized,
        diskPersisted,
        refreshPublished,
        refreshAuthStatus,
        setupAdminPasscode,
        loginBuilder,
        logoutBuilder,
        fetchFullBundle,
        saveDraftRemote,
        publishDraftRemote,
        discardDraftRemote,
        restoreVersionRemote,
        publishedCustomPages,
        activeThemePreset,
      }}
    >
      {children}
    </BuilderContext.Provider>
  );
};

export function useBuilder(): BuilderContextValue {
  const ctx = useContext(BuilderContext);
  if (!ctx) {
    throw new Error('useBuilder debe usarse dentro de BuilderProvider');
  }
  return ctx;
}
