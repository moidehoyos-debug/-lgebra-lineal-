import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type {
  BuilderAuditEntry,
  BuilderRole,
  BuilderStateDocument,
  BuilderVersionEntry,
} from '../src/types/builder.ts';
import { createInitialBuilderDocument } from '../src/utils/builderDefaults.ts';
import { validateAndSanitizeBuilderDocument } from '../src/utils/builderSecurity.ts';

interface PersistedBuilderFile {
  authInitialized: boolean;
  adminHash: string | null; // format: saltHex:derivedHex
  editorHash: string | null;
  viewerHash: string | null;
  signingSecret: string;
  tokenVersion: number;
  revokedTokens: Array<{ jti: string; exp: number }>;
  draft: BuilderStateDocument;
  published: BuilderStateDocument;
  versions: BuilderVersionEntry[];
  auditLog: BuilderAuditEntry[];
  updatedAt: string;
  publishedAt: string | null;
}

export interface VerifiedSessionToken {
  jti: string;
  role: BuilderRole;
  displayName: string;
  tv: number;
  exp: number;
}

export interface BuilderStoreOptions {
  setupToken?: string;
}

const SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
const MAX_VERSIONS = 30;
const MAX_AUDIT_ENTRIES = 80;
const MAX_REVOKED_TOKENS = 200;

function hashPasscode(passcode: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(passcode, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPasscodeHash(passcode: string, stored: string | null): boolean {
  if (!passcode || !stored || !stored.includes(':')) return false;
  const [salt, expectedHex] = stored.split(':');
  if (!salt || !expectedHex) return false;
  const actualBuf = crypto.scryptSync(passcode, salt, 64);
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  if (actualBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}

function sha256Digest(value: string): Buffer {
  return crypto.createHash('sha256').update(value, 'utf-8').digest();
}

function constantTimeEquals(a: string, b: string): boolean {
  if (!a || !b) return false;
  return crypto.timingSafeEqual(sha256Digest(a), sha256Digest(b));
}

function deepClone<T>(val: T): T {
  return JSON.parse(JSON.stringify(val)) as T;
}

function summarizeDoc(doc: BuilderStateDocument): string {
  const totalSections = doc.pages.reduce((s, p) => s + p.sections.length, 0);
  const totalBlocks = doc.pages.reduce(
    (s, p) => s + p.sections.reduce((sb, sec) => sb + sec.blocks.length, 0),
    0
  );
  const enabledMods = doc.modules.filter((m) => m.enabled).length;
  return `${doc.pages.length} pág. · ${totalSections} secc. · ${totalBlocks} comp. · ${enabledMods} mód.`;
}

export class BuilderStore {
  private state: PersistedBuilderFile;
  private filePath: string;
  private persistenceWritable = true;
  private revokedTokenIds = new Set<string>();
  private bootstrapSetupToken: string | null = null;

  constructor(storagePath?: string, options?: BuilderStoreOptions) {
    this.filePath =
      storagePath ?? path.resolve(process.cwd(), 'data', 'vectoria-builder.json');
    this.state = this.loadOrInit();
    for (const entry of this.state.revokedTokens) {
      if (Date.now() < entry.exp) {
        this.revokedTokenIds.add(entry.jti);
      }
    }
    if (!this.isAuthInitialized()) {
      const configuredToken =
        options?.setupToken?.trim() || process.env.VECTORIA_SETUP_TOKEN?.trim();
      if (configuredToken && configuredToken.length >= 12) {
        this.bootstrapSetupToken = configuredToken;
      } else {
        this.bootstrapSetupToken = crypto.randomBytes(24).toString('hex');
      }
    }
  }

  private loadOrInit(): PersistedBuilderFile {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw) as Partial<PersistedBuilderFile>;
        const draftRes = validateAndSanitizeBuilderDocument(parsed.draft);
        const pubRes = validateAndSanitizeBuilderDocument(parsed.published);
        if (draftRes.valid && pubRes.valid && typeof parsed.signingSecret === 'string') {
          const loaded: PersistedBuilderFile = {
            authInitialized: Boolean(parsed.authInitialized && parsed.adminHash),
            adminHash: typeof parsed.adminHash === 'string' ? parsed.adminHash : null,
            editorHash: typeof parsed.editorHash === 'string' ? parsed.editorHash : null,
            viewerHash: typeof parsed.viewerHash === 'string' ? parsed.viewerHash : null,
            signingSecret: parsed.signingSecret,
            tokenVersion:
              typeof parsed.tokenVersion === 'number' && parsed.tokenVersion >= 1
                ? parsed.tokenVersion
                : 1,
            revokedTokens: Array.isArray(parsed.revokedTokens)
              ? parsed.revokedTokens.filter(
                  (t): t is { jti: string; exp: number } =>
                    Boolean(t && typeof t.jti === 'string' && typeof t.exp === 'number')
                )
              : [],
            draft: draftRes.document,
            published: pubRes.document,
            versions: Array.isArray(parsed.versions) ? parsed.versions.slice(0, MAX_VERSIONS) : [],
            auditLog: Array.isArray(parsed.auditLog)
              ? parsed.auditLog.slice(0, MAX_AUDIT_ENTRIES)
              : [],
            updatedAt:
              typeof parsed.updatedAt === 'string'
                ? parsed.updatedAt
                : new Date().toISOString(),
            publishedAt:
              typeof parsed.publishedAt === 'string' ? parsed.publishedAt : null,
          };

          // Allow env-based bootstrap if persisted file has not initialized admin yet
          if (!loaded.authInitialized) {
            const envAdminPass = process.env.VECTORIA_ADMIN_PASSCODE?.trim();
            if (envAdminPass && envAdminPass.length >= 8) {
              const envEditorPass = process.env.VECTORIA_EDITOR_PASSCODE?.trim();
              const envViewerPass = process.env.VECTORIA_VIEWER_PASSCODE?.trim();
              loaded.adminHash = hashPasscode(envAdminPass);
              if (!loaded.editorHash && envEditorPass && envEditorPass.length >= 8) {
                loaded.editorHash = hashPasscode(envEditorPass);
              }
              if (!loaded.viewerHash && envViewerPass && envViewerPass.length >= 8) {
                loaded.viewerHash = hashPasscode(envViewerPass);
              }
              loaded.authInitialized = true;
            }
          }
          return loaded;
        }
      }
    } catch {
      // Fallback to fresh initialized state
    }

    const initialDoc = createInitialBuilderDocument();
    const envAdminPass = process.env.VECTORIA_ADMIN_PASSCODE?.trim();
    const envEditorPass = process.env.VECTORIA_EDITOR_PASSCODE?.trim();
    const envViewerPass = process.env.VECTORIA_VIEWER_PASSCODE?.trim();
    const hasEnvPass = Boolean(envAdminPass && envAdminPass.length >= 8);
    const now = new Date().toISOString();

    const fresh: PersistedBuilderFile = {
      authInitialized: hasEnvPass,
      adminHash: hasEnvPass ? hashPasscode(envAdminPass!) : null,
      editorHash:
        hasEnvPass && envEditorPass && envEditorPass.length >= 8
          ? hashPasscode(envEditorPass)
          : null,
      viewerHash:
        hasEnvPass && envViewerPass && envViewerPass.length >= 8
          ? hashPasscode(envViewerPass)
          : null,
      signingSecret: crypto.randomBytes(32).toString('hex'),
      tokenVersion: 1,
      revokedTokens: [],
      draft: deepClone(initialDoc),
      published: deepClone(initialDoc),
      versions: [
        {
          id: `ver-init-${Date.now()}`,
          timestamp: now,
          authorRole: 'admin',
          description: 'Versión inicial estable publicada de VectorIA Visual Builder',
          changedItems: ['Páginas iniciales', 'Catálogo Nivel 2'],
          publishState: 'published',
          previousSummary: 'Inicio del repositorio',
          nextSummary: summarizeDoc(initialDoc),
          snapshot: deepClone(initialDoc),
        },
      ],
      auditLog: [
        {
          id: `aud-init-${Date.now()}`,
          timestamp: now,
          role: 'admin',
          action: 'INIT_STORE',
          detail: 'Repositorio de configuración inicializado con estado publicado estable.',
        },
      ],
      updatedAt: now,
      publishedAt: now,
    };

    this.state = fresh;
    this.persistToDisk();
    return fresh;
  }

  private persistToDisk(): void {
    if (!this.persistenceWritable) return;
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const now = Date.now();
      this.state.revokedTokens = this.state.revokedTokens
        .filter((t) => now < t.exp)
        .slice(-MAX_REVOKED_TOKENS);
      const tmp = `${this.filePath}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.state, null, 2), 'utf-8');
      fs.renameSync(tmp, this.filePath);
    } catch {
      // Graceful fallback to in-memory persistence on read-only containers
      this.persistenceWritable = false;
    }
  }

  private appendAudit(role: BuilderRole, action: string, detail: string): void {
    this.state.auditLog.unshift({
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      role,
      action,
      detail: detail.slice(0, 240),
    });
    if (this.state.auditLog.length > MAX_AUDIT_ENTRIES) {
      this.state.auditLog.length = MAX_AUDIT_ENTRIES;
    }
  }

  public isAuthInitialized(): boolean {
    return Boolean(this.state.authInitialized && this.state.adminHash);
  }

  public isDiskPersisted(): boolean {
    return this.persistenceWritable;
  }

  /**
   * Server-side bootstrap token for controlled first-time initialization only.
   * Never expose over unauthenticated HTTP endpoints.
   */
  public getBootstrapSetupToken(): string | null {
    return this.isAuthInitialized() ? null : this.bootstrapSetupToken;
  }

  public setupInitialCredentials(
    adminPasscode: string,
    editorPasscode?: string,
    providedSetupToken?: string,
    viewerPasscode?: string
  ):
    | { ok: true; token: string; role: BuilderRole; expiresAt: string }
    | { ok: false; error: string; code: 'ALREADY_INITIALIZED' | 'INVALID_SETUP_TOKEN' | 'INVALID_PASSCODE' } {
    if (this.isAuthInitialized()) {
      return {
        ok: false,
        code: 'ALREADY_INITIALIZED',
        error: 'El acceso administrativo ya fue configurado previamente.',
      };
    }

    const expectedToken = this.bootstrapSetupToken;
    const cleanToken = typeof providedSetupToken === 'string' ? providedSetupToken.trim() : '';
    if (!expectedToken || !constantTimeEquals(cleanToken, expectedToken)) {
      this.appendAudit(
        'admin',
        'AUTH_SETUP_DENIED',
        'Intento de configuración inicial sin token maestro de arranque válido.'
      );
      this.persistToDisk();
      return {
        ok: false,
        code: 'INVALID_SETUP_TOKEN',
        error:
          'Token de inicialización inválido o ausente. Define VECTORIA_SETUP_TOKEN / VECTORIA_ADMIN_PASSCODE en el servidor o verifica la consola de arranque.',
      };
    }

    if (!adminPasscode || adminPasscode.trim().length < 8) {
      return {
        ok: false,
        code: 'INVALID_PASSCODE',
        error: 'La contraseña de administrador debe tener al menos 8 caracteres.',
      };
    }
    if (editorPasscode && editorPasscode.trim().length > 0 && editorPasscode.trim().length < 8) {
      return {
        ok: false,
        code: 'INVALID_PASSCODE',
        error: 'La contraseña de editor (opcional) debe tener al menos 8 caracteres.',
      };
    }
    if (viewerPasscode && viewerPasscode.trim().length > 0 && viewerPasscode.trim().length < 8) {
      return {
        ok: false,
        code: 'INVALID_PASSCODE',
        error: 'La contraseña de revisor (opcional) debe tener al menos 8 caracteres.',
      };
    }

    this.state.adminHash = hashPasscode(adminPasscode.trim());
    this.state.editorHash =
      editorPasscode && editorPasscode.trim().length >= 8
        ? hashPasscode(editorPasscode.trim())
        : null;
    this.state.viewerHash =
      viewerPasscode && viewerPasscode.trim().length >= 8
        ? hashPasscode(viewerPasscode.trim())
        : null;
    this.state.authInitialized = true;
    this.bootstrapSetupToken = null;
    this.appendAudit(
      'admin',
      'AUTH_SETUP',
      'Credenciales administrativas protegidas con scrypt inicializadas tras verificación de token.'
    );
    this.persistToDisk();

    const issued = this.issueToken('admin', 'Administrador VectorIA');
    return { ok: true, ...issued, role: 'admin' };
  }

  public updateRolePasscodes(
    actorRole: BuilderRole,
    updates: { editorPasscode?: string; viewerPasscode?: string; revokeExistingSessions?: boolean }
  ): { ok: true } | { ok: false; error: string } {
    if (actorRole !== 'admin' || !this.isAuthInitialized()) {
      return { ok: false, error: 'Solo el administrador autenticado puede gestionar credenciales de roles.' };
    }
    if (
      updates.editorPasscode !== undefined &&
      updates.editorPasscode.trim().length > 0 &&
      updates.editorPasscode.trim().length < 8
    ) {
      return { ok: false, error: 'La contraseña de editor debe tener al menos 8 caracteres.' };
    }
    if (
      updates.viewerPasscode !== undefined &&
      updates.viewerPasscode.trim().length > 0 &&
      updates.viewerPasscode.trim().length < 8
    ) {
      return { ok: false, error: 'La contraseña de revisor debe tener al menos 8 caracteres.' };
    }

    if (updates.editorPasscode !== undefined) {
      this.state.editorHash =
        updates.editorPasscode.trim().length >= 8
          ? hashPasscode(updates.editorPasscode.trim())
          : null;
    }
    if (updates.viewerPasscode !== undefined) {
      this.state.viewerHash =
        updates.viewerPasscode.trim().length >= 8
          ? hashPasscode(updates.viewerPasscode.trim())
          : null;
    }
    if (updates.revokeExistingSessions) {
      this.state.tokenVersion += 1;
    }
    this.appendAudit('admin', 'AUTH_ROLES_UPDATED', 'Credenciales de roles editor/revisor actualizadas.');
    this.persistToDisk();
    return { ok: true };
  }

  public login(
    passcode: string,
    requestedRole: BuilderRole = 'admin'
  ): { ok: true; token: string; role: BuilderRole; displayName: string; expiresAt: string } | { ok: false; error: string; code?: 'NOT_INITIALIZED' | 'INVALID_CREDENTIALS' } {
    if (!this.isAuthInitialized()) {
      return {
        ok: false,
        code: 'NOT_INITIALIZED',
        error: 'Acceso bloqueado: primero completa la configuración segura de administrador en el servidor.',
      };
    }

    const clean = typeof passcode === 'string' ? passcode.trim() : '';
    if (!clean) {
      this.appendAudit(requestedRole, 'AUTH_FAILED', `Intento de acceso sin contraseña para rol ${requestedRole}.`);
      this.persistToDisk();
      return {
        ok: false,
        code: 'INVALID_CREDENTIALS',
        error: 'Se requiere una contraseña válida para autenticar la sesión.',
      };
    }

    if (requestedRole === 'admin') {
      if (!verifyPasscodeHash(clean, this.state.adminHash)) {
        this.appendAudit('admin', 'AUTH_FAILED', 'Intento de acceso administrativo rechazado.');
        this.persistToDisk();
        return { ok: false, code: 'INVALID_CREDENTIALS', error: 'Contraseña de administrador inválida.' };
      }
      this.appendAudit('admin', 'AUTH_LOGIN', 'Sesión administrativa iniciada.');
      this.persistToDisk();
      const issued = this.issueToken('admin', 'Administrador VectorIA');
      return { ok: true, ...issued, role: 'admin', displayName: 'Administrador VectorIA' };
    }

    if (requestedRole === 'editor') {
      // Editor role accepts either editor passcode (if set) or admin passcode
      const validEditor =
        verifyPasscodeHash(clean, this.state.editorHash) ||
        verifyPasscodeHash(clean, this.state.adminHash);
      if (!validEditor) {
        this.appendAudit('editor', 'AUTH_FAILED', 'Intento de acceso de editor rechazado.');
        this.persistToDisk();
        return { ok: false, code: 'INVALID_CREDENTIALS', error: 'Credencial de editor inválida.' };
      }
      this.appendAudit('editor', 'AUTH_LOGIN', 'Sesión de editor iniciada.');
      this.persistToDisk();
      const issued = this.issueToken('editor', 'Editor de Contenido');
      return { ok: true, ...issued, role: 'editor', displayName: 'Editor de Contenido' };
    }

    // Viewer role strictly requires a valid viewer, editor, or admin passcode (no passwordless tokens)
    const validViewer =
      verifyPasscodeHash(clean, this.state.viewerHash) ||
      verifyPasscodeHash(clean, this.state.editorHash) ||
      verifyPasscodeHash(clean, this.state.adminHash);
    if (!validViewer) {
      this.appendAudit('viewer', 'AUTH_FAILED', 'Intento de acceso de revisor rechazado.');
      this.persistToDisk();
      return {
        ok: false,
        code: 'INVALID_CREDENTIALS',
        error: 'Credencial de revisor inválida. Solicita una contraseña de acceso al administrador.',
      };
    }
    this.appendAudit('viewer', 'AUTH_LOGIN', 'Sesión de revisor (solo lectura) iniciada.');
    this.persistToDisk();
    const issued = this.issueToken('viewer', 'Revisor (Solo lectura)');
    return { ok: true, ...issued, role: 'viewer', displayName: 'Revisor (Solo lectura)' };
  }

  private issueToken(
    role: BuilderRole,
    displayName: string
  ): { token: string; expiresAt: string } {
    const exp = Date.now() + SESSION_TTL_MS;
    const payload: VerifiedSessionToken = {
      jti: crypto.randomBytes(12).toString('hex'),
      role,
      displayName,
      tv: this.state.tokenVersion,
      exp,
    };
    const encoded = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
    const sig = crypto
      .createHmac('sha256', this.state.signingSecret)
      .update(encoded)
      .digest('base64url');
    return {
      token: `${encoded}.${sig}`,
      expiresAt: new Date(exp).toISOString(),
    };
  }

  public verifyToken(authHeader?: string): VerifiedSessionToken | null {
    if (!this.isAuthInitialized()) return null;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.slice(7).trim();
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [encoded, providedSig] = parts;
    const expectedSig = crypto
      .createHmac('sha256', this.state.signingSecret)
      .update(encoded)
      .digest('base64url');
    const a = Buffer.from(providedSig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return null;
    }
    try {
      const payload = JSON.parse(
        Buffer.from(encoded, 'base64url').toString('utf-8')
      ) as VerifiedSessionToken;
      if (
        !payload ||
        !payload.jti ||
        (payload.role !== 'admin' && payload.role !== 'editor' && payload.role !== 'viewer') ||
        payload.tv !== this.state.tokenVersion ||
        Date.now() >= payload.exp
      ) {
        return null;
      }
      if (this.revokedTokenIds.has(payload.jti)) {
        return null;
      }
      return payload;
    } catch {
      return null;
    }
  }

  public revokeToken(authHeader?: string): void {
    const verified = this.verifyToken(authHeader);
    if (verified) {
      this.revokedTokenIds.add(verified.jti);
      this.state.revokedTokens.push({ jti: verified.jti, exp: verified.exp });
      this.appendAudit(verified.role, 'AUTH_LOGOUT', 'Sesión cerrada y token revocado.');
      this.persistToDisk();
    }
  }

  public getPublishedState() {
    return {
      published: this.state.published,
      publishedAt: this.state.publishedAt,
      updatedAt: this.state.updatedAt,
    };
  }

  public getBundleForRole(role: BuilderRole) {
    const hasUnpublishedChanges =
      JSON.stringify(this.state.draft) !== JSON.stringify(this.state.published);

    if (role === 'viewer') {
      // Viewer has strictly limited read-only access: no private versions, no internal audit logs, no disk paths
      return {
        initialized: this.isAuthInitialized(),
        draft: this.state.published,
        published: this.state.published,
        hasUnpublishedChanges: false,
        versions: [],
        auditLog: [],
        updatedAt: this.state.updatedAt,
        publishedAt: this.state.publishedAt,
      };
    }

    if (role === 'editor') {
      // Editor can inspect and save drafts & version history, but never internal admin audit logs
      return {
        initialized: this.isAuthInitialized(),
        draft: this.state.draft,
        published: this.state.published,
        hasUnpublishedChanges,
        versions: this.state.versions,
        auditLog: [],
        updatedAt: this.state.updatedAt,
        publishedAt: this.state.publishedAt,
      };
    }

    return {
      initialized: this.isAuthInitialized(),
      draft: this.state.draft,
      published: this.state.published,
      hasUnpublishedChanges,
      versions: this.state.versions,
      auditLog: this.state.auditLog,
      updatedAt: this.state.updatedAt,
      publishedAt: this.state.publishedAt,
      diskPersisted: this.persistenceWritable,
    };
  }

  public getFullBundle() {
    return this.getBundleForRole('admin');
  }

  public saveDraft(
    rawDoc: unknown,
    role: BuilderRole,
    description = 'Guardado de borrador en Visual Builder',
    changedItems: string[] = ['Borrador actualizado']
  ): { ok: true; bundle: ReturnType<BuilderStore['getBundleForRole']> } | { ok: false; errors: string[] } {
    if (role !== 'admin' && role !== 'editor') {
      return { ok: false, errors: ['Permisos insuficientes para guardar borradores.'] };
    }
    if (!this.isAuthInitialized()) {
      return { ok: false, errors: ['Sistema de seguridad del Builder no inicializado.'] };
    }
    const validation = validateAndSanitizeBuilderDocument(rawDoc);
    if (!validation.valid) {
      return { ok: false, errors: validation.errors };
    }
    const prevSummary = summarizeDoc(this.state.draft);
    const nextSummary = summarizeDoc(validation.document);
    const now = new Date().toISOString();

    this.state.draft = deepClone(validation.document);
    this.state.updatedAt = now;
    this.state.versions.unshift({
      id: `ver-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: now,
      authorRole: role,
      description: description.slice(0, 160),
      changedItems: changedItems.slice(0, 8),
      publishState: 'draft',
      previousSummary: prevSummary,
      nextSummary,
      snapshot: deepClone(validation.document),
    });
    if (this.state.versions.length > MAX_VERSIONS) {
      this.state.versions.length = MAX_VERSIONS;
    }
    this.appendAudit(role, 'SAVE_DRAFT', `${description} (${nextSummary})`);
    this.persistToDisk();
    return { ok: true, bundle: this.getBundleForRole(role) };
  }

  public publishDraft(
    role: BuilderRole,
    description = 'Publicación de versión estable en producción'
  ): { ok: true; bundle: ReturnType<BuilderStore['getBundleForRole']> } | { ok: false; errors: string[] } {
    if (role !== 'admin') {
      return { ok: false, errors: ['Solo el Administrador puede publicar cambios a producción.'] };
    }
    if (!this.isAuthInitialized()) {
      return { ok: false, errors: ['Sistema de seguridad del Builder no inicializado.'] };
    }
    const validation = validateAndSanitizeBuilderDocument(this.state.draft);
    if (!validation.valid) {
      return { ok: false, errors: validation.errors };
    }
    const prevSummary = summarizeDoc(this.state.published);
    const nextSummary = summarizeDoc(validation.document);
    const now = new Date().toISOString();

    this.state.published = deepClone(validation.document);
    this.state.publishedAt = now;
    this.state.updatedAt = now;
    this.state.versions.unshift({
      id: `ver-pub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: now,
      authorRole: role,
      description: description.slice(0, 160),
      changedItems: ['Publicación aprobada'],
      publishState: 'published',
      previousSummary: prevSummary,
      nextSummary,
      snapshot: deepClone(validation.document),
    });
    if (this.state.versions.length > MAX_VERSIONS) {
      this.state.versions.length = MAX_VERSIONS;
    }
    this.appendAudit(role, 'PUBLISH', `${description} (${nextSummary})`);
    this.persistToDisk();
    return { ok: true, bundle: this.getBundleForRole(role) };
  }

  public discardDraft(role: BuilderRole): ReturnType<BuilderStore['getBundleForRole']> {
    if (role !== 'admin' && role !== 'editor') {
      return this.getBundleForRole(role);
    }
    this.state.draft = deepClone(this.state.published);
    this.state.updatedAt = new Date().toISOString();
    this.appendAudit(role, 'DISCARD_DRAFT', 'Borrador descartado; restaurado desde versión publicada.');
    this.persistToDisk();
    return this.getBundleForRole(role);
  }

  public restoreVersionToDraft(
    versionId: string,
    role: BuilderRole
  ): { ok: true; bundle: ReturnType<BuilderStore['getBundleForRole']> } | { ok: false; error: string } {
    if (role !== 'admin') {
      return { ok: false, error: 'Solo el Administrador puede restaurar versiones históricas.' };
    }
    const found = this.state.versions.find((v) => v.id === versionId);
    if (!found) {
      return { ok: false, error: 'La versión solicitada no existe en el historial.' };
    }
    const res = this.saveDraft(
      found.snapshot,
      role,
      `Restauración al borrador de la versión ${found.timestamp.slice(0, 19).replace('T', ' ')}`,
      ['Restauración de versión']
    );
    if (!res.ok) {
      return { ok: false, error: res.errors.join(' ') };
    }
    return { ok: true, bundle: res.bundle };
  }
}
