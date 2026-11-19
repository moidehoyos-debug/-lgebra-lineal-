import 'dotenv/config';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  analyzeLinearIndependence,
  analyzeVectors,
  computeEigen,
  matrixDeterminant,
  matrixInverse,
  matrixLU,
  matrixMultiply,
  matrixQR,
  matrixRank,
  matrixTranspose,
  solveLinearSystem,
} from './src/engines/linearAlgebra.ts';
import fs from 'fs';
import type { BuilderRole } from './src/types/builder.ts';
import { BuilderStore } from './server/builderStore.ts';
import { ProjectExporter } from './server/projectExporter.ts';
import type { ZipExportMode } from './server/projectExporter.ts';
import { BackupScheduler } from './server/backupScheduler.ts';
import {
  createConfiguredGeminiClient,
  isGeminiApiConfigured,
  resolveConfiguredGeminiModel,
  runGeminiOmniChat,
  sanitizeGeminiErrorText,
} from './server/geminiService.ts';
import type { StudioWorkspaceSnapshotPayload } from './server/omniTools.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const MAX_MATRIX_DIM = 12;
const MATH_CACHE_LIMIT = 200;
const RATE_WINDOW_MS = 60_000;

interface RateBucket {
  count: number;
  resetAt: number;
}

interface DiagnosticsErrorEntry {
  timestamp: string;
  route: string;
  status: number;
  message: string;
}

/** Redact API keys or bearer secrets from error messages or diagnostic logs. */
export function redactSecrets(raw: string): string {
  return sanitizeGeminiErrorText(raw);
}

function clampFiniteNumber(val: unknown, min: number, max: number): number | undefined {
  return typeof val === 'number' && Number.isFinite(val)
    ? Math.min(max, Math.max(min, val))
    : undefined;
}

function sanitizeWorkspaceContext(raw: unknown): StudioWorkspaceSnapshotPayload {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  const src = raw as Record<string, unknown>;
  const safe: StudioWorkspaceSnapshotPayload = {};

  if (typeof src.activeModule === 'string') {
    safe.activeModule = sanitizeServerText(src.activeModule, 64);
  }
  const digitsVal = clampFiniteNumber(src.digitsValAccuracy, 0, 1);
  if (digitsVal !== undefined) safe.digitsValAccuracy = digitsVal;
  const lettersVal = clampFiniteNumber(src.lettersValAccuracy, 0, 1);
  if (lettersVal !== undefined) safe.lettersValAccuracy = lettersVal;
  if (typeof src.alphanumericTrained === 'boolean') {
    safe.alphanumericTrained = src.alphanumericTrained;
  }
  const alphaVal = clampFiniteNumber(src.alphanumericValAccuracy, 0, 1);
  if (alphaVal !== undefined) safe.alphanumericValAccuracy = alphaVal;

  if (src.lastPrediction && typeof src.lastPrediction === 'object' && !Array.isArray(src.lastPrediction)) {
    const lp = src.lastPrediction as Record<string, unknown>;
    const label = typeof lp.label === 'string' ? sanitizeServerText(lp.label, 16) : '';
    const confidence = clampFiniteNumber(lp.confidence, 0, 1);
    if (label && confidence !== undefined) {
      safe.lastPrediction = {
        label,
        confidence,
        ...(typeof lp.mode === 'string' ? { mode: sanitizeServerText(lp.mode, 32) } : {}),
        ...(clampFiniteNumber(lp.entropy, 0, 20) !== undefined
          ? { entropy: clampFiniteNumber(lp.entropy, 0, 20) }
          : {}),
      };
    }
  }

  if (src.mnist784Result && typeof src.mnist784Result === 'object' && !Array.isArray(src.mnist784Result)) {
    const mr = src.mnist784Result as Record<string, unknown>;
    const digit = typeof mr.digit === 'number' && Number.isInteger(mr.digit) && mr.digit >= 0 && mr.digit <= 9 ? mr.digit : undefined;
    const confidence = clampFiniteNumber(mr.confidence, 0, 1);
    if (digit !== undefined && confidence !== undefined) {
      safe.mnist784Result = {
        digit,
        confidence,
        ...(clampFiniteNumber(mr.activeNeurons, 0, 2000) !== undefined
          ? { activeNeurons: clampFiniteNumber(mr.activeNeurons, 0, 2000) }
          : {}),
        ...(clampFiniteNumber(mr.activePixels, 0, 784) !== undefined
          ? { activePixels: clampFiniteNumber(mr.activePixels, 0, 784) }
          : {}),
      };
    }
  }

  if (src.smartIrrigationSummary && typeof src.smartIrrigationSummary === 'object' && !Array.isArray(src.smartIrrigationSummary)) {
    const sis = src.smartIrrigationSummary as Record<string, unknown>;
    safe.smartIrrigationSummary = {
      ...(clampFiniteNumber(sis.epochsTrained, 0, 100000) !== undefined
        ? { epochsTrained: clampFiniteNumber(sis.epochsTrained, 0, 100000) }
        : {}),
      ...(clampFiniteNumber(sis.trainAccuracy, 0, 1) !== undefined
        ? { trainAccuracy: clampFiniteNumber(sis.trainAccuracy, 0, 1) }
        : {}),
      ...(clampFiniteNumber(sis.valAccuracy, 0, 1) !== undefined
        ? { valAccuracy: clampFiniteNumber(sis.valAccuracy, 0, 1) }
        : {}),
      ...(clampFiniteNumber(sis.finalLoss, 0, 1000) !== undefined
        ? { finalLoss: clampFiniteNumber(sis.finalLoss, 0, 1000) }
        : {}),
    };
  }

  if (src.lastMathOperation && typeof src.lastMathOperation === 'object' && !Array.isArray(src.lastMathOperation)) {
    const lmo = src.lastMathOperation as Record<string, unknown>;
    safe.lastMathOperation = {
      ...(typeof lmo.operation === 'string'
        ? { operation: sanitizeServerText(lmo.operation, 80) }
        : {}),
      ...(typeof lmo.resultLabel === 'string'
        ? { resultLabel: sanitizeServerText(lmo.resultLabel, 80) }
        : {}),
      ...(typeof lmo.verification === 'string'
        ? { verification: sanitizeServerText(lmo.verification, 180) }
        : {}),
    };
  }
  return safe;
}

/** Strip dangerous HTML angle brackets and control characters from plain text inputs. */
export function sanitizeServerText(input: string, maxLen = 2000): string {
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, maxLen);
}

function validateBoundedMatrix(m: unknown, name: string): number[][] {
  if (!Array.isArray(m) || m.length === 0 || m.length > MAX_MATRIX_DIM) {
    throw new Error(`${name} debe tener entre 1 y ${MAX_MATRIX_DIM} filas.`);
  }
  const cols = Array.isArray(m[0]) ? m[0].length : 0;
  if (cols === 0 || cols > MAX_MATRIX_DIM) {
    throw new Error(`${name} debe tener entre 1 y ${MAX_MATRIX_DIM} columnas.`);
  }
  return m.map((row, rIdx) => {
    if (!Array.isArray(row) || row.length !== cols) {
      throw new Error(`${name} tiene dimensión inconsistente en fila ${rIdx + 1}.`);
    }
    return row.map((val, cIdx) => {
      if (typeof val !== 'number' || !Number.isFinite(val)) {
        throw new Error(`${name}[${rIdx + 1},${cIdx + 1}] debe ser un número finito.`);
      }
      return val;
    });
  });
}

function validateBoundedVector(v: unknown, name: string): number[] {
  if (!Array.isArray(v) || v.length === 0 || v.length > MAX_MATRIX_DIM) {
    throw new Error(`${name} debe tener entre 1 y ${MAX_MATRIX_DIM} componentes.`);
  }
  return v.map((val, idx) => {
    if (typeof val !== 'number' || !Number.isFinite(val)) {
      throw new Error(`${name}[${idx + 1}] debe ser un número finito.`);
    }
    return val;
  });
}

// Gemini client construction centralized in server/geminiService.ts

function getAllowedOrigins(): Set<string> {
  const set = new Set<string>([
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ]);
  const appUrl = process.env.APP_URL?.trim();
  if (appUrl && appUrl !== 'MY_APP_URL') {
    try {
      set.add(new URL(appUrl).origin);
    } catch {
      // Ignore invalid APP_URL
    }
  }
  return set;
}

export function createApp(options?: {
  builderStoragePath?: string;
  setupToken?: string;
  projectRootDir?: string;
  exportTempDir?: string;
  backupVaultDir?: string;
  backupScheduleFilePath?: string;
  startBackupTimer?: boolean;
}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  const builderStore = new BuilderStore(options?.builderStoragePath, {
    setupToken: options?.setupToken,
  });
  app.locals.builderStore = builderStore;
  const projectExporter = new ProjectExporter({
    rootDir: options?.projectRootDir,
    tempDir: options?.exportTempDir,
    builderDataFilePath: options?.builderStoragePath,
  });
  const backupScheduler = new BackupScheduler({
    exporter: projectExporter,
    vaultDir: options?.backupVaultDir,
    scheduleFilePath: options?.backupScheduleFilePath,
    startTimer: options?.startBackupTimer,
  });
  app.locals.backupScheduler = backupScheduler;
  const allowedOrigins = getAllowedOrigins();
  const rateBuckets = new Map<string, RateBucket>();
  const mathCache = new Map<string, { value: unknown; expiresAt: number }>();

  const telemetry = {
    startedAt: new Date().toISOString(),
    totalRequests: 0,
    apiRequests: 0,
    rateLimitedCount: 0,
    mathCacheHits: 0,
    mathCacheMisses: 0,
    latenciesMs: [] as number[],
    recentErrors: [] as DiagnosticsErrorEntry[],
  };

  const recordError = (route: string, status: number, errMessage: string) => {
    telemetry.recentErrors.unshift({
      timestamp: new Date().toISOString(),
      route,
      status,
      message: redactSecrets(errMessage).slice(0, 200),
    });
    if (telemetry.recentErrors.length > 20) {
      telemetry.recentErrors.length = 20;
    }
  };

  // Security headers, CSP & defensive transport hygiene
  app.use((req: Request, res: Response, next: NextFunction) => {
    const t0 = performance.now();
    telemetry.totalRequests += 1;
    if (req.path.startsWith('/api/')) {
      telemetry.apiRequests += 1;
    }

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    const isProdEnv = process.env.NODE_ENV === 'production';
    const scriptSrcDirective = isProdEnv
      ? "script-src 'self'"
      : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        scriptSrcDirective,
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' data: https://fonts.gstatic.com",
        "img-src 'self' data: blob:",
        "connect-src 'self' https:",
        "object-src 'none'",
        "base-uri 'self'",
        "frame-ancestors 'self' https://aistudio.google.com https://*.google.com https://*.googleusercontent.com",
      ].join('; ')
    );
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    // Strict CORS allowlist for API calls
    const origin = req.headers.origin;
    if (origin) {
      const host = req.headers.host;
      const isSameHost =
        Boolean(host) && (origin === `http://${host}` || origin === `https://${host}`);
      const isAiStudioRunOrigin =
        /^https:\/\/ais-(?:dev|pre)-[a-z0-9-]+\.[a-z0-9-]+\.run\.app$/i.test(origin);
      if (isSameHost || allowedOrigins.has(origin) || isAiStudioRunOrigin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      } else if (req.path.startsWith('/api/')) {
        return res.status(403).json({ error: 'Origen CORS no autorizado.' });
      }
    }

    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    res.on('finish', () => {
      if (req.path.startsWith('/api/')) {
        const dt = Number((performance.now() - t0).toFixed(2));
        telemetry.latenciesMs.push(dt);
        if (telemetry.latenciesMs.length > 200) {
          telemetry.latenciesMs.shift();
        }
      }
    });

    return next();
  });

  app.use(express.json({ limit: '1mb' }));

  // Malformed JSON error handler without exposing stack traces
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof SyntaxError && 'body' in (err as object)) {
      recordError(req.path, 400, 'JSON inválido en el cuerpo de la solicitud');
      return res.status(400).json({ error: 'El cuerpo JSON enviado no es válido.' });
    }
    return next(err);
  });

  const makeRateLimiter = (scope: string, maxPerWindow: number) => {
    return (req: Request, res: Response, next: NextFunction) => {
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      const key = `${scope}:${ip}`;
      const now = Date.now();
      let bucket = rateBuckets.get(key);
      if (!bucket || now >= bucket.resetAt) {
        bucket = { count: 0, resetAt: now + RATE_WINDOW_MS };
        rateBuckets.set(key, bucket);
      }
      bucket.count += 1;
      res.setHeader('X-RateLimit-Limit', String(maxPerWindow));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, maxPerWindow - bucket.count)));

      if (bucket.count > maxPerWindow) {
        telemetry.rateLimitedCount += 1;
        const retrySec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
        res.setHeader('Retry-After', String(retrySec));
        recordError(req.path, 429, `Rate limit excedido en ${scope}`);
        return res.status(429).json({
          error: 'RATE_LIMIT_EXCEEDED',
          message: `Límite de solicitudes superado. Reintenta en ${retrySec} s.`,
        });
      }

      // Periodically prune stale buckets to keep memory bounded
      if (rateBuckets.size > 500) {
        for (const [k, v] of rateBuckets.entries()) {
          if (now >= v.resetAt) rateBuckets.delete(k);
        }
      }
      return next();
    };
  };

  app.get('/api/health', (_req, res) => {
    const geminiConfigured = isGeminiApiConfigured();
    const modelCfg = resolveConfiguredGeminiModel();
    res.json({
      status: 'ok',
      service: 'VectorIA Studio API',
      geminiConfigured,
      geminiModel: modelCfg.primaryModel,
      uptimeSec: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/diagnostics', (req, res) => {
    const session = builderStore.verifyToken(req.headers.authorization);
    const isAdmin = session?.role === 'admin';
    const mem = process.memoryUsage();
    const sortedLat = [...telemetry.latenciesMs].sort((a, b) => a - b);
    const avgLatencyMs =
      sortedLat.length > 0
        ? Number((sortedLat.reduce((s, x) => s + x, 0) / sortedLat.length).toFixed(2))
        : 0;
    const p95LatencyMs =
      sortedLat.length > 0
        ? sortedLat[Math.min(sortedLat.length - 1, Math.floor(sortedLat.length * 0.95))]
        : 0;

    res.json({
      status: 'ok',
      diagnosticsScope: isAdmin ? 'admin-full' : 'public-summary',
      startedAt: telemetry.startedAt,
      uptimeSec: Math.round(process.uptime()),
      nodeVersion: isAdmin ? process.version : 'Node.js LTS',
      memoryMb: {
        rss: Number((mem.rss / (1024 * 1024)).toFixed(1)),
        heapUsed: Number((mem.heapUsed / (1024 * 1024)).toFixed(1)),
        heapTotal: Number((mem.heapTotal / (1024 * 1024)).toFixed(1)),
      },
      traffic: {
        totalRequests: telemetry.totalRequests,
        apiRequests: telemetry.apiRequests,
        rateLimitedCount: telemetry.rateLimitedCount,
        avgLatencyMs,
        p95LatencyMs,
      },
      mathCache: {
        entries: mathCache.size,
        limit: MATH_CACHE_LIMIT,
        hits: telemetry.mathCacheHits,
        misses: telemetry.mathCacheMisses,
      },
      security: {
        cspEnabled: true,
        corsAllowlistActive: true,
        rateLimiterActive: true,
        apiKeyIsolatedServerSide: true,
      },
      recentErrorCount: telemetry.recentErrors.length,
      recentErrors: isAdmin ? telemetry.recentErrors : [],
    });
  });

  app.post('/api/verify-math', makeRateLimiter('verify-math', 120), (req, res) => {
    try {
      const { operation, matrixA, matrixB, vectorU, vectorV, vectors } = req.body ?? {};
      if (typeof operation !== 'string' || operation.length > 32) {
        return res.status(400).json({ error: 'El campo "operation" es obligatorio.' });
      }
      const cleanOp = sanitizeServerText(operation, 32);

      // Deterministic cache lookup
      const cacheKey = JSON.stringify({ cleanOp, matrixA, matrixB, vectorU, vectorV, vectors });
      if (cacheKey.length <= 4096) {
        const hit = mathCache.get(cacheKey);
        if (hit && Date.now() < hit.expiresAt) {
          telemetry.mathCacheHits += 1;
          res.setHeader('X-Cache', 'HIT');
          return res.json(hit.value);
        }
      }
      telemetry.mathCacheMisses += 1;

      let resultPayload: unknown;
      switch (cleanOp) {
        case 'determinant':
          resultPayload = matrixDeterminant(validateBoundedMatrix(matrixA, 'Matriz A'));
          break;
        case 'inverse':
          resultPayload = matrixInverse(validateBoundedMatrix(matrixA, 'Matriz A'));
          break;
        case 'multiply':
          resultPayload = matrixMultiply(
            validateBoundedMatrix(matrixA, 'Matriz A'),
            validateBoundedMatrix(matrixB, 'Matriz B')
          );
          break;
        case 'solve':
          resultPayload = solveLinearSystem(
            validateBoundedMatrix(matrixA, 'Matriz A'),
            validateBoundedVector(vectorU, 'Vector b'),
            'gauss-jordan'
          );
          break;
        case 'vectors':
          resultPayload = analyzeVectors(
            validateBoundedVector(vectorU, 'Vector u'),
            validateBoundedVector(vectorV, 'Vector v')
          );
          break;
        case 'independence':
          resultPayload = analyzeLinearIndependence(validateBoundedMatrix(vectors, 'Conjunto'));
          break;
        case 'eigen':
          resultPayload = computeEigen(validateBoundedMatrix(matrixA, 'Matriz A'));
          break;
        case 'transpose':
          resultPayload = matrixTranspose(validateBoundedMatrix(matrixA, 'Matriz A'));
          break;
        case 'rank':
          resultPayload = matrixRank(validateBoundedMatrix(matrixA, 'Matriz A'));
          break;
        case 'lu':
          resultPayload = matrixLU(validateBoundedMatrix(matrixA, 'Matriz A'));
          break;
        case 'qr':
          resultPayload = matrixQR(validateBoundedMatrix(matrixA, 'Matriz A'));
          break;
        default:
          return res.status(400).json({ error: `Operación no soportada: ${cleanOp}` });
      }

      if (cacheKey.length <= 4096) {
        if (mathCache.size >= MATH_CACHE_LIMIT) {
          const firstKey = mathCache.keys().next().value;
          if (firstKey !== undefined) mathCache.delete(firstKey);
        }
        mathCache.set(cacheKey, {
          value: resultPayload,
          expiresAt: Date.now() + 5 * 60_000,
        });
      }
      res.setHeader('X-Cache', 'MISS');
      return res.json(resultPayload);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al procesar operación matemática.';
      recordError('/api/verify-math', 400, msg);
      return res.status(400).json({
        error: redactSecrets(msg),
      });
    }
  });

  app.post('/api/omni/chat', makeRateLimiter('omni-chat', 25), async (req, res) => {
    try {
      const { messages, workspaceContext } = req.body ?? {};
      if (!Array.isArray(messages) || messages.length === 0 || messages.length > 50) {
        return res.status(400).json({
          error: 'INVALID_MESSAGES',
          code: 'INVALID_MESSAGES',
          retryable: false,
          message: 'Se requiere un historial de mensajes válido (1–50).',
        });
      }

      const sanitizedHistory: Array<{ role: 'user' | 'model'; text: string }> = messages
        .slice(-12)
        .filter(
          (m: unknown): m is { role: string; content: string } =>
            Boolean(m) &&
            typeof m === 'object' &&
            typeof (m as { role?: unknown }).role === 'string' &&
            typeof (m as { content?: unknown }).content === 'string' &&
            ((m as { role: string }).role === 'user' ||
              (m as { role: string }).role === 'assistant' ||
              (m as { role: string }).role === 'model')
        )
        .map((m) => ({
          role: (m.role === 'assistant' || m.role === 'model' ? 'model' : 'user') as
            | 'user'
            | 'model',
          text: sanitizeServerText(m.content, 2000),
        }))
        .filter((m) => m.text.length > 0);

      if (sanitizedHistory.length === 0) {
        return res.status(400).json({
          error: 'EMPTY_MESSAGES',
          code: 'EMPTY_MESSAGES',
          retryable: false,
          message: 'No hay mensajes válidos para procesar.',
        });
      }

      const ai = createConfiguredGeminiClient();
      if (!ai) {
        return res.status(503).json({
          error: 'GEMINI_NOT_CONFIGURED',
          code: 'GEMINI_NOT_CONFIGURED',
          retryable: false,
          provider: 'local-fallback',
          message:
            'La clave GEMINI_API_KEY no está configurada en el servidor. Configúrala en Settings > Secrets; se utilizará el motor local verificado.',
        });
      }

      const contextPayload = sanitizeWorkspaceContext(workspaceContext);
      const contextSummaryText = sanitizeServerText(JSON.stringify(contextPayload), 2500);

      const result = await runGeminiOmniChat({
        aiClient: ai,
        history: sanitizedHistory,
        workspaceContext: contextPayload,
        contextSummaryText,
      });

      if (!result.ok) {
        const safeErr = redactSecrets(result.message);
        recordError('/api/omni/chat', result.status, `${result.code}: ${safeErr}`);
        return res.status(result.status).json({
          error: result.code,
          code: result.code,
          retryable: result.retryable,
          provider: 'local-fallback',
          modelAttempted: result.modelAttempted,
          toolTrace: result.toolTrace,
          message:
            result.code === 'INVALID_API_KEY'
              ? safeErr
              : process.env.NODE_ENV === 'production'
                ? 'No fue posible completar la consulta externa con Gemini; activando motor local verificado.'
                : safeErr,
        });
      }

      return res.json({
        reply: result.reply,
        model: result.model,
        provider: result.provider,
        fallbackModelUsed: result.fallbackModelUsed,
        toolTrace: result.toolTrace,
      });
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : 'Error interno de Gemini API';
      const safeMsg = redactSecrets(rawMsg);
      recordError('/api/omni/chat', 500, safeMsg);
      return res.status(500).json({
        error: 'GEMINI_REQUEST_FAILED',
        code: 'GEMINI_REQUEST_FAILED',
        retryable: true,
        provider: 'local-fallback',
        message:
          process.env.NODE_ENV === 'production'
            ? 'No fue posible completar la consulta externa; usa el motor local o reintenta.'
            : safeMsg,
      });
    }
  });

  // ---------------------------------------------------------------------------
  // VectorIA Visual Builder — Authenticated Admin/Editor Persistence & RBAC
  // ---------------------------------------------------------------------------
  const requireBuilderRole = (allowed: BuilderRole[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
      const session = builderStore.verifyToken(req.headers.authorization);
      if (!session) {
        return res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Autenticación requerida para acceder a Visual Builder.',
        });
      }
      if (!allowed.includes(session.role)) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: `Permisos insuficientes para el rol "${session.role}".`,
        });
      }
      (req as Request & { builderSession?: typeof session }).builderSession = session;
      return next();
    };
  };

  app.get('/api/builder/published', (_req, res) => {
    return res.json(builderStore.getPublishedState());
  });

  app.get('/api/builder/auth/status', (req, res) => {
    const session = builderStore.verifyToken(req.headers.authorization);
    const initialized = builderStore.isAuthInitialized();
    const payload: Record<string, unknown> = {
      initialized,
      setupTokenRequired: !initialized,
      authenticated: Boolean(session),
      session: session
        ? {
            role: session.role,
            displayName: session.displayName,
            expiresAt: new Date(session.exp).toISOString(),
          }
        : null,
    };
    if (session?.role === 'admin') {
      payload.diskPersisted = builderStore.isDiskPersisted();
    }
    return res.json(payload);
  });

  app.post('/api/builder/auth/setup', makeRateLimiter('builder-auth', 15), (req, res) => {
    const { adminPasscode, editorPasscode, viewerPasscode, setupToken } = req.body ?? {};
    const headerSetupToken =
      typeof req.headers['x-vectoria-setup-token'] === 'string'
        ? req.headers['x-vectoria-setup-token']
        : undefined;
    const result = builderStore.setupInitialCredentials(
      typeof adminPasscode === 'string' ? adminPasscode : '',
      typeof editorPasscode === 'string' ? editorPasscode : undefined,
      typeof setupToken === 'string' ? setupToken : headerSetupToken,
      typeof viewerPasscode === 'string' ? viewerPasscode : undefined
    );
    if (!result.ok) {
      const statusCode =
        result.code === 'ALREADY_INITIALIZED'
          ? 409
          : result.code === 'INVALID_SETUP_TOKEN'
            ? 403
            : 400;
      recordError('/api/builder/auth/setup', statusCode, result.error);
      return res.status(statusCode).json({ error: result.code, message: result.error });
    }
    return res.status(201).json({
      token: result.token,
      role: result.role,
      displayName: 'Administrador VectorIA',
      expiresAt: result.expiresAt,
    });
  });

  app.post('/api/builder/auth/login', makeRateLimiter('builder-auth', 20), (req, res) => {
    const { passcode, role } = req.body ?? {};
    if (
      role !== undefined &&
      role !== 'admin' &&
      role !== 'editor' &&
      role !== 'viewer'
    ) {
      return res.status(400).json({
        error: 'INVALID_ROLE',
        message: 'Rol inválido. Usa únicamente admin, editor o viewer.',
      });
    }
    const cleanRole: BuilderRole = role ?? 'admin';
    const result = builderStore.login(
      typeof passcode === 'string' ? passcode : '',
      cleanRole
    );
    if (!result.ok) {
      const status = result.code === 'NOT_INITIALIZED' ? 403 : 401;
      recordError('/api/builder/auth/login', status, result.error);
      return res.status(status).json({
        error: result.code ?? 'INVALID_CREDENTIALS',
        message: result.error,
      });
    }
    return res.json(result);
  });

  app.post(
    '/api/builder/auth/roles',
    makeRateLimiter('builder-auth', 20),
    requireBuilderRole(['admin']),
    (req, res) => {
      const session = (req as Request & { builderSession?: { role: BuilderRole } }).builderSession!;
      const { editorPasscode, viewerPasscode, revokeExistingSessions } = req.body ?? {};
      const result = builderStore.updateRolePasscodes(session.role, {
        editorPasscode: typeof editorPasscode === 'string' ? editorPasscode : undefined,
        viewerPasscode: typeof viewerPasscode === 'string' ? viewerPasscode : undefined,
        revokeExistingSessions: Boolean(revokeExistingSessions),
      });
      if (!result.ok) {
        return res.status(400).json({ error: 'ROLE_UPDATE_FAILED', message: result.error });
      }
      return res.json({ ok: true });
    }
  );

  app.post('/api/builder/auth/logout', (req, res) => {
    builderStore.revokeToken(req.headers.authorization);
    return res.json({ ok: true });
  });

  app.get(
    '/api/builder/state',
    requireBuilderRole(['admin', 'editor', 'viewer']),
    (req, res) => {
      const session = (req as Request & { builderSession?: { role: BuilderRole } }).builderSession!;
      return res.json(builderStore.getBundleForRole(session.role));
    }
  );

  app.put(
    '/api/builder/draft',
    makeRateLimiter('builder-write', 60),
    requireBuilderRole(['admin', 'editor']),
    (req, res) => {
      const session = (req as Request & { builderSession?: { role: BuilderRole } }).builderSession!;
      const { document, description, changedItems } = req.body ?? {};
      const result = builderStore.saveDraft(
        document,
        session.role,
        typeof description === 'string' ? sanitizeServerText(description, 160) : undefined,
        Array.isArray(changedItems)
          ? changedItems.map((c) => sanitizeServerText(String(c), 80))
          : undefined
      );
      if (!result.ok) {
        return res.status(400).json({
          error: 'VALIDATION_FAILED',
          message: result.errors.join(' '),
          errors: result.errors,
        });
      }
      return res.json(result.bundle);
    }
  );

  app.post(
    '/api/builder/publish',
    makeRateLimiter('builder-write', 30),
    requireBuilderRole(['admin']),
    (req, res) => {
      const session = (req as Request & { builderSession?: { role: BuilderRole } }).builderSession!;
      const { description } = req.body ?? {};
      const result = builderStore.publishDraft(
        session.role,
        typeof description === 'string' ? sanitizeServerText(description, 160) : undefined
      );
      if (!result.ok) {
        return res.status(400).json({
          error: 'PUBLISH_VALIDATION_FAILED',
          message: result.errors.join(' '),
          errors: result.errors,
        });
      }
      return res.json(result.bundle);
    }
  );

  app.post(
    '/api/builder/discard',
    makeRateLimiter('builder-write', 30),
    requireBuilderRole(['admin', 'editor']),
    (req, res) => {
      const session = (req as Request & { builderSession?: { role: BuilderRole } }).builderSession!;
      return res.json(builderStore.discardDraft(session.role));
    }
  );

  app.post(
    '/api/builder/versions/:versionId/restore',
    makeRateLimiter('builder-write', 30),
    requireBuilderRole(['admin']),
    (req, res) => {
      const session = (req as Request & { builderSession?: { role: BuilderRole } }).builderSession!;
      const versionId = sanitizeServerText(String(req.params.versionId ?? ''), 80);
      const result = builderStore.restoreVersionToDraft(versionId, session.role);
      if (!result.ok) {
        return res.status(404).json({ error: 'VERSION_NOT_FOUND', message: result.error });
      }
      return res.json(result.bundle);
    }
  );

  // ---------------------------------------------------------------------------
  // VectorIA Project ZIP Exporter — Admin-Only Generation, Validation & Download
  // ---------------------------------------------------------------------------
  app.post(
    '/api/builder/export-zip',
    makeRateLimiter('builder-zip-export', 12),
    requireBuilderRole(['admin']),
    (req, res) => {
      const modeRaw = (req.body as { mode?: unknown } | undefined)?.mode;
      const mode: ZipExportMode | null =
        modeRaw === 'full' || modeRaw === 'distribution' || modeRaw === 'backup'
          ? modeRaw
          : null;
      if (!mode) {
        return res.status(400).json({
          error: 'INVALID_EXPORT_MODE',
          message: 'Modalidad de exportación inválida. Usa full, distribution o backup.',
        });
      }
      const job = projectExporter.startExportJob(mode);
      return res.status(202).json({
        jobId: job.jobId,
        mode: job.mode,
        status: job.status,
        stageLabel: job.stageLabel,
        progressPct: job.progressPct,
        filename: job.filename,
        createdAt: job.createdAt,
      });
    }
  );

  app.get(
    '/api/builder/export-zip/:jobId/status',
    requireBuilderRole(['admin']),
    (req, res) => {
      const jobId = sanitizeServerText(String(req.params.jobId ?? ''), 80);
      if (!/^zip-\d+-[a-f0-9]{12}$/.test(jobId)) {
        return res.status(400).json({
          error: 'INVALID_JOB_ID',
          message: 'Identificador de exportación inválido.',
        });
      }
      const job = projectExporter.getJob(jobId);
      if (!job) {
        return res.status(404).json({
          error: 'EXPORT_JOB_NOT_FOUND',
          message: 'El trabajo de exportación no existe o ha expirado.',
        });
      }
      return res.json({
        jobId: job.jobId,
        mode: job.mode,
        status: job.status,
        stageLabel: job.stageLabel,
        progressPct: job.progressPct,
        filename: job.filename,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
        fileCount: job.fileCount,
        sizeBytes: job.sizeBytes,
        validation: job.validation,
        error: job.error ? redactSecrets(job.error) : null,
      });
    }
  );

  app.get(
    '/api/builder/export-zip/:jobId/download',
    requireBuilderRole(['admin']),
    (req, res) => {
      const jobId = sanitizeServerText(String(req.params.jobId ?? ''), 80);
      if (!/^zip-\d+-[a-f0-9]{12}$/.test(jobId)) {
        return res.status(400).json({
          error: 'INVALID_JOB_ID',
          message: 'Identificador de exportación inválido.',
        });
      }
      const check = projectExporter.verifyBeforeDownload(jobId);
      if (!check.ok || !check.job || !check.job.tempFilePath) {
        const statusCode = check.error?.includes('no existe') ? 404 : 409;
        return res.status(statusCode).json({
          error: statusCode === 404 ? 'EXPORT_JOB_NOT_FOUND' : 'EXPORT_INTEGRITY_FAILED',
          message: check.error || 'El archivo ZIP no superó la verificación previa a descarga.',
        });
      }

      const job = check.job;
      const tempTarget = job.tempFilePath!;
      const safeFilename = path.basename(job.filename).replace(/[^A-Za-z0-9._-]/g, '_');
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
      res.setHeader('Content-Length', String(job.sizeBytes));
      if (job.validation?.sha256) {
        res.setHeader('X-Export-SHA256', job.validation.sha256);
      }
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');

      const stream = fs.createReadStream(tempTarget);
      stream.on('error', () => {
        projectExporter.cleanupJob(jobId);
        if (!res.headersSent) {
          res.status(500).json({
            error: 'STREAM_READ_FAILED',
            message: 'No fue posible leer el archivo temporal del ZIP.',
          });
        }
      });
      res.on('close', () => {
        if (!res.writableFinished) {
          projectExporter.cleanupJob(jobId);
        }
      });
      res.on('finish', () => {
        setTimeout(() => {
          projectExporter.cleanupJob(jobId);
        }, 15_000).unref();
      });
      return stream.pipe(res);
    }
  );

  app.delete(
    '/api/builder/export-zip/:jobId',
    requireBuilderRole(['admin']),
    (req, res) => {
      const jobId = sanitizeServerText(String(req.params.jobId ?? ''), 80);
      if (!/^zip-\d+-[a-f0-9]{12}$/.test(jobId)) {
        return res.status(400).json({
          error: 'INVALID_JOB_ID',
          message: 'Identificador de exportación inválido.',
        });
      }
      const cleaned = projectExporter.cleanupJob(jobId);
      return res.json({ ok: true, cleaned });
    }
  );

  // ---------------------------------------------------------------------------
  // Scheduled Automatic Cloud Backups (Admin RBAC Vault)
  // ---------------------------------------------------------------------------
  app.get('/api/backup/schedule', requireBuilderRole(['admin']), (_req, res) => {
    return res.json(backupScheduler.getState());
  });

  app.put(
    '/api/backup/schedule',
    makeRateLimiter('backup-write', 30),
    requireBuilderRole(['admin']),
    (req, res) => {
      const body = (req.body ?? {}) as {
        enabled?: unknown;
        frequency?: unknown;
        mode?: unknown;
        retentionCount?: unknown;
      };
      if (
        body.frequency !== undefined &&
        body.frequency !== '15m' &&
        body.frequency !== '1h' &&
        body.frequency !== '6h' &&
        body.frequency !== '24h' &&
        body.frequency !== '7d'
      ) {
        return res.status(400).json({
          error: 'INVALID_FREQUENCY',
          message: 'Frecuencia de respaldo inválida. Usa 15m, 1h, 6h, 24h o 7d.',
        });
      }
      if (
        body.mode !== undefined &&
        body.mode !== 'full' &&
        body.mode !== 'distribution' &&
        body.mode !== 'backup'
      ) {
        return res.status(400).json({
          error: 'INVALID_EXPORT_MODE',
          message: 'Modalidad de exportación inválida. Usa full, distribution o backup.',
        });
      }
      backupScheduler.updateSchedule(body);
      return res.json(backupScheduler.getState());
    }
  );

  app.post(
    '/api/backup/run',
    makeRateLimiter('backup-run', 12),
    requireBuilderRole(['admin']),
    async (_req, res) => {
      try {
        const snapshot = await backupScheduler.runNow('manual');
        const { storageFilename: _omit, ...publicSnapshot } = snapshot;
        return res.status(201).json({
          snapshot: publicSnapshot,
          state: backupScheduler.getState(),
        });
      } catch (err) {
        const msg = err instanceof Error ? redactSecrets(err.message) : 'Fallo al generar respaldo automático.';
        return res.status(500).json({
          error: 'BACKUP_RUN_FAILED',
          message: msg,
        });
      }
    }
  );

  app.get(
    '/api/backup/snapshots/:snapshotId/download',
    requireBuilderRole(['admin']),
    (req, res) => {
      const snapshotId = sanitizeServerText(String(req.params.snapshotId ?? ''), 80);
      if (!/^cloud-bkp-\d+-[a-f0-9]{8}$/.test(snapshotId)) {
        return res.status(400).json({
          error: 'INVALID_SNAPSHOT_ID',
          message: 'Identificador de respaldo inválido.',
        });
      }
      const found = backupScheduler.getSnapshotForDownload(snapshotId);
      if (!found) {
        return res.status(404).json({
          error: 'SNAPSHOT_NOT_FOUND',
          message: 'El archivo de respaldo solicitado no existe en la bóveda.',
        });
      }

      const safeFilename = path.basename(found.entry.filename).replace(/[^A-Za-z0-9._-]/g, '_');
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
      res.setHeader('Content-Length', String(found.entry.sizeBytes));
      res.setHeader('X-Export-SHA256', found.entry.sha256);
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');

      const stream = fs.createReadStream(found.filePath);
      stream.on('error', () => {
        if (!res.headersSent) {
          res.status(500).json({
            error: 'SNAPSHOT_READ_FAILED',
            message: 'No se pudo leer el paquete ZIP de respaldo almacenado.',
          });
        }
      });
      return stream.pipe(res);
    }
  );

  app.delete(
    '/api/backup/snapshots/:snapshotId',
    makeRateLimiter('backup-write', 30),
    requireBuilderRole(['admin']),
    (req, res) => {
      const snapshotId = sanitizeServerText(String(req.params.snapshotId ?? ''), 80);
      if (!/^cloud-bkp-\d+-[a-f0-9]{8}$/.test(snapshotId)) {
        return res.status(400).json({
          error: 'INVALID_SNAPSHOT_ID',
          message: 'Identificador de respaldo inválido.',
        });
      }
      const deleted = backupScheduler.deleteSnapshot(snapshotId);
      if (!deleted) {
        return res.status(404).json({
          error: 'SNAPSHOT_NOT_FOUND',
          message: 'No se encontró la copia de respaldo indicada.',
        });
      }
      return res.json(backupScheduler.getState());
    }
  );

  app.use('/api', (_req, res) => {
    return res.status(404).json({
      error: 'API_ROUTE_NOT_FOUND',
      message: 'Endpoint API no encontrado.',
    });
  });

  // Final fallback JSON error handler (prevents leaking stack traces)
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    const rawMsg = err instanceof Error ? err.message : 'Error interno inesperado';
    recordError(req.path, 500, rawMsg);
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Error interno controlado del servidor.',
    });
  });

  return app;
}

async function startServer() {
  const app = createApp();
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir, { maxAge: '1h', etag: true }));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`VectorIA Studio ejecutándose en http://0.0.0.0:${PORT} (${isProd ? 'production' : 'development'})`);
    const store = app.locals.builderStore as BuilderStore | undefined;
    const bootstrapToken = store?.getBootstrapSetupToken();
    if (bootstrapToken) {
      console.log(
        `[Seguridad Visual Builder] Pendiente de configuración inicial. Define VECTORIA_ADMIN_PASSCODE en .env o utiliza este token único de arranque: ${bootstrapToken}`
      );
    }
  });

  const shutdown = (signal: string) => {
    console.log(`Recibida señal ${signal}, cerrando VectorIA Studio limpiamente...`);
    (app.locals.backupScheduler as BackupScheduler | undefined)?.stop();
    server.close(() => {
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

if (process.env.VITEST !== 'true') {
  startServer().catch((err) => {
    console.error('Error iniciando VectorIA Studio:', err);
    process.exit(1);
  });
}
