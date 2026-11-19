import {
  ClassifierMode,
  Didactic232StepResult,
  Mnist784PerturbationConfig,
  Mnist784PerturbationResult,
  PredictionRecord,
  SimulationExperimentConfig,
  SimulationRunRecord,
  TechnicalReportRecord,
  ThemeId,
} from '../types/vectoria';
import type { SerializedMLPState } from '../engines/neuralEngine';

export const VECTORIA_VERSION = '2.1.0';
export const BACKUP_SCHEMA_VERSION = 1;
export const BACKUPS_STORAGE_KEY = 'vectoria-workspace-backups-v1';
export const MAX_BACKUP_SLOTS = 5;
export const MAX_BACKUP_FILE_BYTES = 2 * 1024 * 1024; // 2 MB

export interface WorkspaceUserProfile {
  name: string;
  role: string;
  institution: string;
  program: string;
  planTier: 'academico' | 'laboratorio' | 'institucional';
}

export interface WorkspaceBackupPayload {
  schemaVersion: number;
  appVersion: string;
  theme: ThemeId;
  classifierMode: ClassifierMode;
  userProfile: WorkspaceUserProfile;
  simulationHistory: SimulationRunRecord[];
  reportHistory: TechnicalReportRecord[];
}

export interface WorkspaceBackupSnapshot {
  id: string;
  createdAt: string;
  reason: string;
  payload: WorkspaceBackupPayload;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  summary: string;
  items: string[];
}

export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    version: '2.1.0',
    date: '2026-11-15',
    summary: 'Seguridad defensiva por capas, optimización, estabilidad Cloud Run y sistema de visualización científica',
    items: [
      'Compatibilidad nativa ESM Node 22 para despliegue en producción (Cloud Run).',
      'Headers CSP/seguridad, allowlist CORS, rate limiter en API, validación acotada y caché determinístico en /api/verify-math.',
      'Panel de diagnóstico en tiempo real (/api/diagnostics), React Error Boundaries por módulo y sistema de respaldos multiranura.',
      'Sistema Global de Visualización Científica adaptable a los 6 temas con exportación PNG y tabla numérica.',
    ],
  },
  {
    version: '2.0.0',
    date: '2026-11-15',
    summary: 'Expansión profesional: Geometría 2D/3D, XAI, Simulation Lab, MNIST 784 y Neural Cyberpunk',
    items: [
      'Simulation Lab aislado con experimentos Antes/Después, red didáctica 3–2–2 y modo A/B.',
      'Entrenamiento unificado real de 36 clases (0–9 + A–Z) y sexto tema Neural Cyberpunk.',
      'Geometría matemática 2D/3D, IA explicable XAI y Centro de Evaluación.',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-11-14',
    summary: 'Arquitectura inicial React 19 + TypeScript + Vite + Express',
    items: [
      'Motor de Álgebra Lineal verificable, MLP 16×16, Topología Neuronal y Omni Bot híbrido.',
    ],
  },
];

export const STORAGE_INVENTORY = [
  {
    key: 'vectoria-theme',
    purpose: 'Preferencia visual del tema activo (solo identificador de tema).',
    containsSecrets: false,
  },
  {
    key: 'vectoria-dashboard-layout-v2',
    purpose: 'Orden y visibilidad de paneles del Dashboard.',
    containsSecrets: false,
  },
  {
    key: 'vectoria-quickstart-dismissed-v1',
    purpose: 'Estado de visualización inicial de la Guía de Inicio Rápido.',
    containsSecrets: false,
  },
  {
    key: BACKUPS_STORAGE_KEY,
    purpose: 'Hasta 5 instantáneas rotativas de respaldo del espacio de trabajo (perfil, simulaciones e informes).',
    containsSecrets: false,
  },
  {
    key: 'vectoria-simulation-history-v1',
    purpose: 'Historial de ejecuciones de Simulation Lab (duración en ms y memoria medida en MB, sin secretos).',
    containsSecrets: false,
  },
  {
    key: 'vectoria-api-latency-history-v1',
    purpose: 'Registro cronológico de latencias HTTP en la Consola API y Panel Principal.',
    containsSecrets: false,
  },
  {
    key: 'vectoria-omni-command-history-v1',
    purpose: 'Últimas 10 consultas reutilizables del asistente Omni Bot.',
    containsSecrets: false,
  },
  {
    key: 'vectoria-local-backup-schedule-v1',
    purpose: 'Configuración e historial de respaldos locales automáticos programados.',
    containsSecrets: false,
  },
] as const;

export function sanitizeUserText(value: string, maxLen = 160): string {
  return value
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, maxLen);
}

export function loadBackupSnapshots(
  storage: Pick<Storage, 'getItem'> | null = typeof window !== 'undefined' ? window.localStorage : null
): WorkspaceBackupSnapshot[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(BACKUPS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is WorkspaceBackupSnapshot =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof item.id === 'string' &&
        typeof item.createdAt === 'string' &&
        typeof item.reason === 'string' &&
        Boolean(item.payload) &&
        item.payload.schemaVersion === BACKUP_SCHEMA_VERSION
    );
  } catch {
    return [];
  }
}

/**
 * Saves a timestamped snapshot into a ring buffer (up to MAX_BACKUP_SLOTS)
 * so creating a new backup never overwrites the sole previous backup.
 */
export function saveBackupSnapshot(
  reason: string,
  payload: WorkspaceBackupPayload,
  storage: Pick<Storage, 'getItem' | 'setItem'> | null = typeof window !== 'undefined'
    ? window.localStorage
    : null
): WorkspaceBackupSnapshot[] {
  const cleanReason = sanitizeUserText(reason, 80) || 'Respaldo manual';
  const entry: WorkspaceBackupSnapshot = {
    id: `bak-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
    reason: cleanReason,
    payload: {
      ...payload,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      appVersion: VECTORIA_VERSION,
      userProfile: {
        name: sanitizeUserText(payload.userProfile.name, 80) || 'Investigador VectorIA',
        role: sanitizeUserText(payload.userProfile.role, 80) || 'Estudiante / Investigador',
        institution: sanitizeUserText(payload.userProfile.institution, 120),
        program: sanitizeUserText(payload.userProfile.program, 120),
        planTier: payload.userProfile.planTier,
      },
    },
  };

  const existing = loadBackupSnapshots(storage);
  const next = [entry, ...existing].slice(0, MAX_BACKUP_SLOTS);
  if (storage) {
    try {
      storage.setItem(BACKUPS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore quota errors
    }
  }
  return next;
}

const VALID_THEMES: ReadonlyArray<ThemeId> = [
  'dark-purple',
  'light-yellow',
  'classic-mono',
  'holographic',
  'black-gold',
  'neural-cyberpunk',
];

const VALID_CLASSIFIER_MODES: ReadonlyArray<ClassifierMode> = [
  'digits',
  'letters',
  'alphanumeric',
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isCompatibleMajorVersion(appVersion: unknown, allowedMajors: readonly number[]): boolean {
  if (typeof appVersion !== 'string') return false;
  const m = appVersion.trim().match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return false;
  return allowedMajors.includes(Number(m[1]));
}

export function validateBackupUpload(
  fileName: string,
  fileSizeBytes: number,
  rawJsonText: string
): { valid: true; payload: WorkspaceBackupPayload } | { valid: false; error: string } {
  if (!fileName.toLowerCase().endsWith('.json')) {
    return { valid: false, error: 'Solo se admiten archivos de respaldo con extensión .json.' };
  }
  if (fileSizeBytes <= 0 || fileSizeBytes > MAX_BACKUP_FILE_BYTES) {
    return {
      valid: false,
      error: `Tamaño de archivo no permitido (máximo ${Math.round(MAX_BACKUP_FILE_BYTES / (1024 * 1024))} MB).`,
    };
  }
  if (/GEMINI_API_KEY|AIza[0-9A-Za-z\-_]{20,}/i.test(rawJsonText)) {
    return {
      valid: false,
      error: 'Archivo rechazado: contiene patrones compatibles con credenciales secretas.',
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJsonText);
  } catch {
    return { valid: false, error: 'Archivo corrupto: el contenido no es JSON válido.' };
  }

  if (!isPlainObject(parsed)) {
    return { valid: false, error: 'Archivo corrupto: la estructura raíz debe ser un objeto JSON.' };
  }

  const candidate = parsed as Partial<WorkspaceBackupPayload>;
  if (candidate.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    return {
      valid: false,
      error: `Versión de esquema incompatible: recibido "${String(candidate.schemaVersion ?? 'ausente')}", esperado ${BACKUP_SCHEMA_VERSION}.`,
    };
  }
  if (candidate.appVersion !== undefined && !isCompatibleMajorVersion(candidate.appVersion, [1, 2])) {
    return {
      valid: false,
      error: `Versión de aplicación incompatible ("${String(candidate.appVersion)}"). Versiones soportadas: 1.x / 2.x.`,
    };
  }
  if (!isPlainObject(candidate.userProfile) || typeof candidate.userProfile.name !== 'string' || !candidate.userProfile.name.trim()) {
    return { valid: false, error: 'Campos obligatorios faltantes: falta "userProfile.name" válido.' };
  }
  if (!VALID_THEMES.includes(candidate.theme as ThemeId)) {
    return { valid: false, error: 'Campo obligatorio inválido o corrupto: "theme" no reconocido.' };
  }
  if (!VALID_CLASSIFIER_MODES.includes(candidate.classifierMode as ClassifierMode)) {
    return { valid: false, error: 'Campo obligatorio inválido o corrupto: "classifierMode" no reconocido.' };
  }
  if (!Array.isArray(candidate.simulationHistory) || !Array.isArray(candidate.reportHistory)) {
    return {
      valid: false,
      error: 'Campos obligatorios faltantes: "simulationHistory" y "reportHistory" deben ser listas.',
    };
  }

  const theme = candidate.theme as ThemeId;
  const classifierMode = candidate.classifierMode as ClassifierMode;

  return {
    valid: true,
    payload: {
      schemaVersion: BACKUP_SCHEMA_VERSION,
      appVersion: typeof candidate.appVersion === 'string' ? candidate.appVersion : VECTORIA_VERSION,
      theme,
      classifierMode,
      userProfile: {
        name: sanitizeUserText(candidate.userProfile.name, 80) || 'Investigador VectorIA',
        role: sanitizeUserText(candidate.userProfile.role || 'Estudiante / Investigador', 80),
        institution: sanitizeUserText(candidate.userProfile.institution || '', 120),
        program: sanitizeUserText(candidate.userProfile.program || '', 120),
        planTier:
          candidate.userProfile.planTier === 'laboratorio' ||
          candidate.userProfile.planTier === 'institucional'
            ? candidate.userProfile.planTier
            : 'academico',
      },
      simulationHistory: candidate.simulationHistory.slice(0, 40),
      reportHistory: candidate.reportHistory.slice(0, 40),
    },
  };
}

export const EXPERIMENTS_MODELS_ARCHIVE_SCHEMA = 'vectoria-experiments-models-v1';

export interface ExperimentsAndModelsData {
  profileSummary: {
    role: string;
    program: string;
    planTier: WorkspaceUserProfile['planTier'];
  };
  activeState: {
    theme: ThemeId;
    classifierMode: ClassifierMode;
    sharedMatrix2D: number[][];
  };
  experiments: {
    simulationConfig: SimulationExperimentConfig;
    simulationHistory: SimulationRunRecord[];
    predictionHistory: Array<
      Pick<
        PredictionRecord,
        'id' | 'timestamp' | 'mode' | 'topLabel' | 'confidence' | 'entropy' | 'topScores' | 'comparison'
      >
    >;
    mnist784PerturbConfig: Mnist784PerturbationConfig;
    mnist784PerturbResult: Mnist784PerturbationResult | null;
    last232Step: Didactic232StepResult | null;
    reportHistory: TechnicalReportRecord[];
  };
  trainedModels: {
    includeWeights: boolean;
    digits: SerializedMLPState;
    letters: SerializedMLPState;
    alphanumeric: SerializedMLPState;
    mnist784ReadOnlySummary: {
      architecture: string;
      parameters: number;
      syntheticEvalTotal: number;
      syntheticEvalCorrect: number;
      syntheticEvalAccuracy: number;
    };
  };
}

export interface ExperimentsAndModelsExport {
  schema: typeof EXPERIMENTS_MODELS_ARCHIVE_SCHEMA;
  appVersion: string;
  exportedAt: string;
  security: {
    containsSecrets: false;
    sanitized: true;
    piiMinimized: true;
    notes: string;
  };
  integrity: {
    algorithm: 'SHA-256' | 'FNV-1a-32';
    digest: string;
  };
  data: ExperimentsAndModelsData;
}

const SECRET_TOKEN_REGEX =
  /AIza[0-9A-Za-z\-_]{20,}|GEMINI_API_KEY\s*=\s*[^\s"']+|Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi;

export function stripSecretPatternsFromText(raw: string): string {
  return raw.replace(SECRET_TOKEN_REGEX, '[REDACTED]');
}

export async function computeSafeIntegrityDigest(
  canonicalText: string
): Promise<{ algorithm: 'SHA-256' | 'FNV-1a-32'; digest: string }> {
  try {
    if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
      const bytes = new TextEncoder().encode(canonicalText);
      const buf = await globalThis.crypto.subtle.digest('SHA-256', bytes);
      const hex = Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      return { algorithm: 'SHA-256', digest: hex };
    }
  } catch {
    // Fallback below when subtle crypto is unavailable
  }
  let hash = 0x811c9dc5;
  for (let i = 0; i < canonicalText.length; i++) {
    hash ^= canonicalText.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return { algorithm: 'FNV-1a-32', digest: (hash >>> 0).toString(16).padStart(8, '0') };
}

export interface BuildExperimentsModelsArchiveInput {
  theme: ThemeId;
  classifierMode: ClassifierMode;
  userProfile: WorkspaceUserProfile;
  sharedMatrix2D: number[][];
  simulationConfig: SimulationExperimentConfig;
  simulationHistory: SimulationRunRecord[];
  predictionHistory: PredictionRecord[];
  mnist784PerturbConfig: Mnist784PerturbationConfig;
  mnist784PerturbResult: Mnist784PerturbationResult | null;
  last232Step: Didactic232StepResult | null;
  reportHistory: TechnicalReportRecord[];
  includeWeights: boolean;
  digitsModelState: SerializedMLPState;
  lettersModelState: SerializedMLPState;
  alphanumericModelState: SerializedMLPState;
  mnist784ReadOnlySummary: ExperimentsAndModelsData['trainedModels']['mnist784ReadOnlySummary'];
}

export async function buildSecureExperimentsAndModelsExport(
  input: BuildExperimentsModelsArchiveInput
): Promise<{ archive: ExperimentsAndModelsExport; jsonText: string; byteSize: number }> {
  const rawData: ExperimentsAndModelsData = {
    profileSummary: {
      role: sanitizeUserText(input.userProfile.role, 80) || 'Estudiante / Investigador',
      program: sanitizeUserText(input.userProfile.program, 120),
      planTier: input.userProfile.planTier,
    },
    activeState: {
      theme: input.theme,
      classifierMode: input.classifierMode,
      sharedMatrix2D: input.sharedMatrix2D.map((row) =>
        row.map((v) => (Number.isFinite(v) ? Number(v.toFixed(6)) : 0))
      ),
    },
    experiments: {
      simulationConfig: {
        ...input.simulationConfig,
        targetGlyph: sanitizeUserText(input.simulationConfig.targetGlyph, 4) || '3',
        selectedClasses: input.simulationConfig.selectedClasses
          .slice(0, 36)
          .map((c) => sanitizeUserText(c, 4))
          .filter(Boolean),
      },
      simulationHistory: input.simulationHistory.slice(0, 30),
      predictionHistory: input.predictionHistory.slice(0, 25).map((p) => ({
        id: p.id,
        timestamp: p.timestamp,
        mode: p.mode,
        topLabel: p.topLabel,
        confidence: p.confidence,
        entropy: p.entropy,
        topScores: p.topScores,
        comparison: p.comparison,
      })),
      mnist784PerturbConfig: { ...input.mnist784PerturbConfig },
      mnist784PerturbResult: input.mnist784PerturbResult,
      last232Step: input.last232Step,
      reportHistory: input.reportHistory.slice(0, 20),
    },
    trainedModels: {
      includeWeights: input.includeWeights,
      digits: input.digitsModelState,
      letters: input.lettersModelState,
      alphanumeric: input.alphanumericModelState,
      mnist784ReadOnlySummary: input.mnist784ReadOnlySummary,
    },
  };

  // Strip any accidental secret patterns strictly inside string values before hashing
  const sanitizedDataJson = JSON.stringify(rawData, (_key, val) =>
    typeof val === 'string' ? stripSecretPatternsFromText(val) : val
  );
  const cleanData = JSON.parse(sanitizedDataJson) as ExperimentsAndModelsData;
  const canonicalForHash = JSON.stringify(cleanData);
  const integrity = await computeSafeIntegrityDigest(canonicalForHash);

  const archive: ExperimentsAndModelsExport = {
    schema: EXPERIMENTS_MODELS_ARCHIVE_SCHEMA,
    appVersion: VECTORIA_VERSION,
    exportedAt: new Date().toISOString(),
    security: {
      containsSecrets: false,
      sanitized: true,
      piiMinimized: true,
      notes:
        'Resguardo local seguro: excluye credenciales API, variables de entorno del servidor e identificadores personales sensibles.',
    },
    integrity,
    data: cleanData,
  };

  const jsonText = JSON.stringify(archive, null, 2);
  const byteSize = new TextEncoder().encode(jsonText).byteLength;
  return { archive, jsonText, byteSize };
}

export async function verifyExperimentsAndModelsExport(
  rawJsonText: string
): Promise<{ valid: boolean; reason?: string; archive?: ExperimentsAndModelsExport }> {
  if (/GEMINI_API_KEY/i.test(rawJsonText) || /AIza[0-9A-Za-z\-_]{30,}/.test(rawJsonText)) {
    return { valid: false, reason: 'El archivo contiene patrones compatibles con credenciales.' };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJsonText);
  } catch {
    return { valid: false, reason: 'JSON inválido.' };
  }
  const candidate = parsed as Partial<ExperimentsAndModelsExport>;
  if (
    !candidate ||
    candidate.schema !== EXPERIMENTS_MODELS_ARCHIVE_SCHEMA ||
    !candidate.data ||
    !candidate.integrity
  ) {
    return { valid: false, reason: 'Esquema de archivo de experimentos/modelos inválido.' };
  }
  const computed = await computeSafeIntegrityDigest(JSON.stringify(candidate.data));
  if (
    computed.algorithm !== candidate.integrity.algorithm ||
    computed.digest !== candidate.integrity.digest
  ) {
    return { valid: false, reason: 'Fallo en verificación de integridad criptográfica.' };
  }
  return { valid: true, archive: candidate as ExperimentsAndModelsExport };
}

export type UploadedJsonValidationErrorCode =
  | 'INVALID_EXTENSION'
  | 'INVALID_SIZE'
  | 'SECRET_DETECTED'
  | 'CORRUPT_JSON'
  | 'CORRUPT_STRUCTURE'
  | 'INCOMPATIBLE_VERSION'
  | 'MISSING_FIELDS'
  | 'INTEGRITY_MISMATCH'
  | 'PASSPHRASE_REQUIRED'
  | 'DECRYPTION_FAILED';

export type ValidatedUploadedJsonResult =
  | { valid: true; kind: 'workspace-backup'; payload: WorkspaceBackupPayload }
  | { valid: true; kind: 'experiments-models'; archive: ExperimentsAndModelsExport }
  | { valid: false; errorCode: UploadedJsonValidationErrorCode; error: string };

function validateSerializedModelStructure(
  modelObj: unknown,
  expectedMode: ClassifierMode,
  expectedClassCount: number
): string | null {
  if (!isPlainObject(modelObj)) {
    return `Falta el bloque obligatorio del modelo "${expectedMode}".`;
  }
  if (modelObj.mode !== expectedMode) {
    return `Modelo "${expectedMode}" corrupto: campo "mode" no coincide.`;
  }
  if (!Array.isArray(modelObj.labels) || modelObj.labels.length !== expectedClassCount) {
    return `Modelo "${expectedMode}" corrupto: se esperaban ${expectedClassCount} etiquetas de clase.`;
  }
  if (typeof modelObj.isTrained !== 'boolean' || typeof modelObj.epochsTrained !== 'number' || !Number.isFinite(modelObj.epochsTrained)) {
    return `Modelo "${expectedMode}" incompleto: faltan métricas de entrenamiento válidas.`;
  }
  if (!Array.isArray(modelObj.history) || !Array.isArray(modelObj.confusionMatrix)) {
    return `Modelo "${expectedMode}" corrupto: "history" o "confusionMatrix" no son listas válidas.`;
  }
  if (modelObj.layers !== undefined) {
    if (!Array.isArray(modelObj.layers) || modelObj.layers.length !== 3) {
      return `Modelo "${expectedMode}" corrupto: estructura de capas sinápticas inválida.`;
    }
    for (const layer of modelObj.layers) {
      if (
        !isPlainObject(layer) ||
        typeof layer.inDim !== 'number' ||
        typeof layer.outDim !== 'number' ||
        !Array.isArray(layer.W) ||
        !Array.isArray(layer.b) ||
        layer.W.length !== layer.outDim ||
        layer.b.length !== layer.outDim
      ) {
        return `Modelo "${expectedMode}" corrupto: dimensiones de pesos/sesgos inconsistentes.`;
      }
      for (const row of layer.W) {
        if (!Array.isArray(row) || row.length !== layer.inDim || row.some((v) => typeof v !== 'number' || !Number.isFinite(v))) {
          return `Modelo "${expectedMode}" corrupto: valores de matriz W no finitos o dañados.`;
        }
      }
      if (layer.b.some((v) => typeof v !== 'number' || !Number.isFinite(v))) {
        return `Modelo "${expectedMode}" corrupto: vector de sesgos b contiene valores inválidos.`;
      }
    }
  }
  return null;
}

/**
 * Utilidad unificada de validación previa a cualquier restauración desde archivo JSON subido.
 * Verifica extensión, tamaño, ausencia de secretos, sintaxis JSON, versión compatible,
 * campos obligatorios, estructura de modelos/experimentos y huella criptográfica SHA-256.
 */
export async function validateUploadedStateJson(
  fileName: string,
  fileSizeBytes: number,
  rawJsonText: string
): Promise<ValidatedUploadedJsonResult> {
  if (!fileName.toLowerCase().endsWith('.json')) {
    return {
      valid: false,
      errorCode: 'INVALID_EXTENSION',
      error: 'Formato inválido: solo se permiten archivos con extensión .json.',
    };
  }
  if (!Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0 || fileSizeBytes > MAX_BACKUP_FILE_BYTES) {
    return {
      valid: false,
      errorCode: 'INVALID_SIZE',
      error: `Archivo vacío o demasiado grande (límite máximo: ${Math.round(MAX_BACKUP_FILE_BYTES / (1024 * 1024))} MB).`,
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJsonText);
  } catch {
    return {
      valid: false,
      errorCode: 'CORRUPT_JSON',
      error: 'Archivo corrupto: no fue posible analizar la sintaxis JSON. Verifica que no esté truncado ni dañado.',
    };
  }

  if (!isPlainObject(parsed)) {
    return {
      valid: false,
      errorCode: 'CORRUPT_STRUCTURE',
      error: 'Archivo corrupto: el contenido raíz debe ser un objeto JSON válido.',
    };
  }

  // Branch 0: Archivo global cifrado con AES-256-GCM (schema: vectoria-encrypted-state-v1)
  // El ciphertext Base64 es binario cifrado opaco; el análisis de secretos sobre el texto plano
  // se ejecuta tras el descifrado dentro de decryptEncryptedGlobalStateJson.
  if (parsed.schema === ENCRYPTED_GLOBAL_ARCHIVE_SCHEMA) {
    if (!isCompatibleMajorVersion(parsed.appVersion, [2])) {
      return {
        valid: false,
        errorCode: 'INCOMPATIBLE_VERSION',
        error: `Versión de aplicación incompatible en archivo cifrado: "${String(parsed.appVersion ?? 'desconocida')}".`,
      };
    }
    if (
      !isPlainObject(parsed.encryption) ||
      typeof parsed.encryption.salt !== 'string' ||
      typeof parsed.encryption.iv !== 'string' ||
      typeof parsed.ciphertext !== 'string'
    ) {
      return {
        valid: false,
        errorCode: 'CORRUPT_STRUCTURE',
        error: 'Archivo cifrado corrupto: faltan metadatos criptográficos (salt, iv o ciphertext).',
      };
    }
    return {
      valid: false,
      errorCode: 'PASSPHRASE_REQUIRED',
      error:
        'Archivo cifrado (AES-256-GCM) detectado: introduce la contraseña de cifrado para descifrar y restaurar el estado.',
    };
  }

  if (/GEMINI_API_KEY/i.test(rawJsonText) || /AIza[0-9A-Za-z\-_]{30,}/.test(rawJsonText)) {
    return {
      valid: false,
      errorCode: 'SECRET_DETECTED',
      error: 'Archivo rechazado por seguridad: contiene patrones de credenciales o claves API.',
    };
  }

  // Branch A: Archivo seguro de Experimentos y Modelos (schema: vectoria-experiments-models-v1)
  if ('schema' in parsed) {
    if (parsed.schema !== EXPERIMENTS_MODELS_ARCHIVE_SCHEMA) {
      return {
        valid: false,
        errorCode: 'INCOMPATIBLE_VERSION',
        error: `Versión incompatible: esquema "${String(parsed.schema)}" no soportado (esperado "${EXPERIMENTS_MODELS_ARCHIVE_SCHEMA}").`,
      };
    }
    if (!isCompatibleMajorVersion(parsed.appVersion, [2])) {
      return {
        valid: false,
        errorCode: 'INCOMPATIBLE_VERSION',
        error: `Versión de aplicación incompatible: "${String(parsed.appVersion ?? 'desconocida')}". Se requiere VectorIA Studio v2.x.`,
      };
    }
    if (!isPlainObject(parsed.integrity) || typeof parsed.integrity.digest !== 'string' || !isPlainObject(parsed.data)) {
      return {
        valid: false,
        errorCode: 'MISSING_FIELDS',
        error: 'Campos obligatorios faltantes: faltan los bloques "data" o "integrity".',
      };
    }

    const data = parsed.data;
    if (
      !isPlainObject(data.profileSummary) ||
      !isPlainObject(data.activeState) ||
      !isPlainObject(data.experiments) ||
      !isPlainObject(data.trainedModels)
    ) {
      return {
        valid: false,
        errorCode: 'MISSING_FIELDS',
        error: 'Estructura incompleta: faltan bloques obligatorios (profileSummary, activeState, experiments o trainedModels).',
      };
    }

    if (
      !VALID_THEMES.includes(data.activeState.theme as ThemeId) ||
      !VALID_CLASSIFIER_MODES.includes(data.activeState.classifierMode as ClassifierMode) ||
      !Array.isArray(data.activeState.sharedMatrix2D)
    ) {
      return {
        valid: false,
        errorCode: 'CORRUPT_STRUCTURE',
        error: 'Estado activo corrupto: tema, modo o matriz 2D compartida inválidos.',
      };
    }

    const exps = data.experiments;
    if (
      !isPlainObject(exps.simulationConfig) ||
      !Array.isArray(exps.simulationHistory) ||
      !Array.isArray(exps.predictionHistory) ||
      !isPlainObject(exps.mnist784PerturbConfig) ||
      !Array.isArray(exps.reportHistory)
    ) {
      return {
        valid: false,
        errorCode: 'MISSING_FIELDS',
        error: 'Experimentos incompletos: faltan campos obligatorios en el bloque "experiments".',
      };
    }

    const models = data.trainedModels;
    const modelErr =
      validateSerializedModelStructure(models.digits, 'digits', 10) ||
      validateSerializedModelStructure(models.letters, 'letters', 26) ||
      validateSerializedModelStructure(models.alphanumeric, 'alphanumeric', 36);
    if (modelErr) {
      return {
        valid: false,
        errorCode: 'CORRUPT_STRUCTURE',
        error: modelErr,
      };
    }

    const integrityCheck = await verifyExperimentsAndModelsExport(rawJsonText);
    if (!integrityCheck.valid || !integrityCheck.archive) {
      return {
        valid: false,
        errorCode: 'INTEGRITY_MISMATCH',
        error:
          integrityCheck.reason ||
          'Archivo corrupto o alterado: la huella criptográfica SHA-256 no coincide.',
      };
    }

    return {
      valid: true,
      kind: 'experiments-models',
      archive: integrityCheck.archive,
    };
  }

  // Branch B: Respaldo estándar de espacio de trabajo (schemaVersion: 1)
  if ('schemaVersion' in parsed) {
    const res = validateBackupUpload(fileName, fileSizeBytes, rawJsonText);
    if (!res.valid) {
      const code: UploadedJsonValidationErrorCode = res.error.includes('incompatible')
        ? 'INCOMPATIBLE_VERSION'
        : res.error.includes('faltantes')
          ? 'MISSING_FIELDS'
          : 'CORRUPT_STRUCTURE';
      return { valid: false, errorCode: code, error: res.error };
    }
    return { valid: true, kind: 'workspace-backup', payload: res.payload };
  }

  return {
    valid: false,
    errorCode: 'MISSING_FIELDS',
    error:
      'Estructura no reconocida: faltan los campos obligatorios de versión ("schema" o "schemaVersion").',
  };
}

export const ENCRYPTED_GLOBAL_ARCHIVE_SCHEMA = 'vectoria-encrypted-state-v1';
export const PBKDF2_ITERATIONS = 120_000;

export interface EncryptedGlobalStateEnvelope {
  schema: typeof ENCRYPTED_GLOBAL_ARCHIVE_SCHEMA;
  appVersion: string;
  exportedAt: string;
  encryption: {
    algorithm: 'AES-256-GCM';
    kdf: 'PBKDF2-SHA256';
    iterations: number;
    salt: string;
    iv: string;
  };
  security: {
    containsSecrets: false;
    plaintextExposed: false;
    integrityAuthenticated: true;
  };
  ciphertext: string;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, Math.min(bytes.length, i + chunk));
    for (let j = 0; j < slice.length; j++) {
      binary += String.fromCharCode(slice[j]);
    }
  }
  return btoa(binary);
}

function base64ToUint8(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

async function deriveAesGcmKey(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
  usage: KeyUsage[]
): Promise<CryptoKey> {
  if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.subtle) {
    throw new Error('Web Crypto API (crypto.subtle) no está disponible en este entorno.');
  }
  const passBytes = new TextEncoder().encode(passphrase);
  const baseKey = await globalThis.crypto.subtle.importKey(
    'raw',
    passBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  return globalThis.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    usage
  );
}

/**
 * Cifra el estado global completo (configuración, pesos de modelos, historial de experimentos)
 * mediante PBKDF2-SHA256 + AES-256-GCM para descarga local segura en formato .json.
 */
export async function encryptGlobalStateToJson(
  input: Omit<BuildExperimentsModelsArchiveInput, 'includeWeights'> & { includeWeights?: boolean },
  passphrase: string
): Promise<{
  envelope: EncryptedGlobalStateEnvelope;
  jsonText: string;
  byteSize: number;
  innerDigest: string;
}> {
  if (!passphrase || passphrase.trim().length < 8) {
    throw new Error('La contraseña de cifrado debe tener al menos 8 caracteres.');
  }

  const { archive, jsonText: innerJsonText } = await buildSecureExperimentsAndModelsExport({
    ...input,
    includeWeights: input.includeWeights ?? true,
  });

  const salt = new Uint8Array(new ArrayBuffer(16));
  const iv = new Uint8Array(new ArrayBuffer(12));
  globalThis.crypto.getRandomValues(salt);
  globalThis.crypto.getRandomValues(iv);

  const aesKey = await deriveAesGcmKey(passphrase, salt, PBKDF2_ITERATIONS, ['encrypt']);
  const plaintextBytes = new TextEncoder().encode(innerJsonText);
  const cipherBuffer = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    plaintextBytes
  );

  const envelope: EncryptedGlobalStateEnvelope = {
    schema: ENCRYPTED_GLOBAL_ARCHIVE_SCHEMA,
    appVersion: VECTORIA_VERSION,
    exportedAt: archive.exportedAt,
    encryption: {
      algorithm: 'AES-256-GCM',
      kdf: 'PBKDF2-SHA256',
      iterations: PBKDF2_ITERATIONS,
      salt: uint8ToBase64(salt),
      iv: uint8ToBase64(iv),
    },
    security: {
      containsSecrets: false,
      plaintextExposed: false,
      integrityAuthenticated: true,
    },
    ciphertext: uint8ToBase64(new Uint8Array(cipherBuffer)),
  };

  const jsonText = JSON.stringify(envelope, null, 2);
  const byteSize = new TextEncoder().encode(jsonText).byteLength;
  return {
    envelope,
    jsonText,
    byteSize,
    innerDigest: archive.integrity.digest,
  };
}

/**
 * Descifra un archivo .json cifrado con AES-256-GCM y verifica estructura,
 * versión compatible, campos obligatorios y huella SHA-256 antes de restaurar.
 */
export async function decryptEncryptedGlobalStateJson(
  fileName: string,
  fileSizeBytes: number,
  rawJsonText: string,
  passphrase: string
): Promise<ValidatedUploadedJsonResult> {
  if (!passphrase || passphrase.length < 1) {
    return {
      valid: false,
      errorCode: 'PASSPHRASE_REQUIRED',
      error: 'Introduce la contraseña de cifrado para descifrar el archivo.',
    };
  }
  if (!fileName.toLowerCase().endsWith('.json')) {
    return {
      valid: false,
      errorCode: 'INVALID_EXTENSION',
      error: 'Formato inválido: solo se admiten archivos con extensión .json.',
    };
  }
  if (!Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0 || fileSizeBytes > MAX_BACKUP_FILE_BYTES) {
    return {
      valid: false,
      errorCode: 'INVALID_SIZE',
      error: `Archivo vacío o demasiado grande (límite máximo: ${Math.round(MAX_BACKUP_FILE_BYTES / (1024 * 1024))} MB).`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJsonText);
  } catch {
    return {
      valid: false,
      errorCode: 'CORRUPT_JSON',
      error: 'Archivo corrupto: sintaxis JSON inválida.',
    };
  }

  if (!isPlainObject(parsed) || parsed.schema !== ENCRYPTED_GLOBAL_ARCHIVE_SCHEMA) {
    return {
      valid: false,
      errorCode: 'INCOMPATIBLE_VERSION',
      error: 'El archivo no corresponde al esquema cifrado compatible (vectoria-encrypted-state-v1).',
    };
  }

  if (
    !isPlainObject(parsed.encryption) ||
    parsed.encryption.algorithm !== 'AES-256-GCM' ||
    typeof parsed.encryption.salt !== 'string' ||
    typeof parsed.encryption.iv !== 'string' ||
    typeof parsed.encryption.iterations !== 'number' ||
    parsed.encryption.iterations < 10_000 ||
    parsed.encryption.iterations > 1_000_000 ||
    typeof parsed.ciphertext !== 'string'
  ) {
    return {
      valid: false,
      errorCode: 'CORRUPT_STRUCTURE',
      error: 'Metadatos de cifrado corruptos o manipulados.',
    };
  }

  try {
    const salt = base64ToUint8(parsed.encryption.salt);
    const iv = base64ToUint8(parsed.encryption.iv);
    const cipherBytes = base64ToUint8(parsed.ciphertext);
    const aesKey = await deriveAesGcmKey(
      passphrase,
      salt,
      parsed.encryption.iterations,
      ['decrypt']
    );
    const plainBuffer = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      cipherBytes
    );
    const plainText = new TextDecoder().decode(plainBuffer);
    const plainBytes = new TextEncoder().encode(plainText).byteLength;
    return await validateUploadedStateJson(fileName, plainBytes, plainText);
  } catch {
    return {
      valid: false,
      errorCode: 'DECRYPTION_FAILED',
      error:
        'No se pudo descifrar el archivo: contraseña incorrecta o archivo cifrado corrupto/alterado.',
    };
  }
}
