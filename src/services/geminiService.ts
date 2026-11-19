/**
 * Client-side GeminiService proxy for VectorIA Studio.
 *
 * Security design:
 * - Never imports @google/genai, never stores API keys, and never invokes Google endpoints
 *   directly from the browser.
 * - Routes all requests exclusively through server-side Express endpoints (/api/omni/chat,
 *   /api/health) where GEMINI_API_KEY remains isolated in Node.js memory.
 * - Enforces request timeouts, exponential backoff retries (429, 5xx, timeout, network),
 *   strict payload validation, and centralized secret-redacted error management.
 * - Reports all network/API failures through StudioContext's `logEvent` for an auditable
 *   stability history inside the platform.
 */

import type { SystemEventRecord } from '../types/vectoria';

export type GeminiEventLogger = (
  category: SystemEventRecord['category'],
  title: string,
  detail: string,
  status?: SystemEventRecord['status']
) => void;

export type GeminiServiceErrorCode =
  | 'TIMEOUT'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'GEMINI_NOT_CONFIGURED'
  | 'INVALID_API_KEY'
  | 'BAD_REQUEST'
  | 'INVALID_RESPONSE'
  | 'NETWORK_ERROR'
  | 'ABORTED';

export interface GeminiChatMessageInput {
  role: 'user' | 'assistant' | 'model';
  content: string;
}

export interface GeminiWorkspaceContextInput {
  activeModule?: string;
  digitsValAccuracy?: number;
  lettersValAccuracy?: number;
  alphanumericTrained?: boolean;
  alphanumericValAccuracy?: number;
  lastPrediction?: {
    label: string;
    confidence: number;
    mode?: string;
    entropy?: number;
  } | null;
  mnist784Result?: {
    digit: number;
    confidence: number;
    activeNeurons?: number;
    activePixels?: number;
  } | null;
  lastMathOperation?: {
    operation?: string;
    resultLabel?: string;
    verification?: string;
  } | null;
}

export interface GeminiChatRequestPayload {
  messages: GeminiChatMessageInput[];
  workspaceContext?: GeminiWorkspaceContextInput;
  signal?: AbortSignal;
  logEvent?: GeminiEventLogger;
}

export interface GeminiToolTraceRecord {
  tool: string;
  status: 'ok' | 'error';
  argsSummary: string;
  resultSummary: string;
  durationMs: number;
}

export interface GeminiChatResponse {
  reply: string;
  model: string;
  provider: 'gemini';
  fallbackModelUsed: boolean;
  toolTrace: GeminiToolTraceRecord[];
  attempts: number;
}

export interface GeminiAvailabilityStatus {
  available: boolean;
  model: string | null;
  checkedAt: string;
}

export interface GeminiServiceOptions {
  endpoint?: string;
  healthEndpoint?: string;
  timeoutMs?: number;
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  fetchImpl?: typeof fetch;
  sleepImpl?: (ms: number) => Promise<void>;
  logEvent?: GeminiEventLogger;
}

interface RawServerResponseBody {
  reply?: unknown;
  model?: unknown;
  provider?: unknown;
  fallbackModelUsed?: unknown;
  toolTrace?: unknown;
  error?: unknown;
  code?: unknown;
  retryable?: unknown;
  modelAttempted?: unknown;
  message?: unknown;
}

const DEFAULT_ENDPOINT = '/api/omni/chat';
const DEFAULT_HEALTH_ENDPOINT = '/api/health';

let globalEventLogger: GeminiEventLogger | null = null;

/** Strip any accidental credential signatures before surfacing errors to UI. */
export function sanitizeGeminiClientMessage(raw: string): string {
  return raw
    .replace(/AIza[0-9A-Za-z\-_]{20,}/g, '[REDACTED_KEY]')
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]')
    .replace(/([?&]key=)[^&\s]+/gi, '$1[REDACTED]')
    .replace(/(x-goog-api-key\s*[:=]\s*)\S+/gi, '$1[REDACTED]')
    .replace(/(GEMINI_API_KEY\s*=\s*)\S+/gi, '$1[REDACTED]')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .trim()
    .slice(0, 320);
}

export class GeminiServiceError extends Error {
  readonly code: GeminiServiceErrorCode;
  readonly status: number;
  readonly retryable: boolean;
  readonly attempts: number;
  readonly retryAfterMs?: number;
  readonly modelAttempted?: string;
  readonly serverCode?: string;

  constructor(params: {
    code: GeminiServiceErrorCode;
    status: number;
    retryable: boolean;
    message: string;
    attempts?: number;
    retryAfterMs?: number;
    modelAttempted?: string;
    serverCode?: string;
  }) {
    super(sanitizeGeminiClientMessage(params.message));
    this.name = 'GeminiServiceError';
    this.code = params.code;
    this.status = params.status;
    this.retryable = params.retryable;
    this.attempts = params.attempts ?? 1;
    this.retryAfterMs = params.retryAfterMs;
    this.modelAttempted = params.modelAttempted;
    this.serverCode = params.serverCode;
  }
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(headerVal: string | null): number | undefined {
  if (!headerVal) return undefined;
  const trimmed = headerVal.trim();
  if (/^\d+$/.test(trimmed)) {
    return Math.max(0, Number(trimmed) * 1000);
  }
  const parsedDate = Date.parse(trimmed);
  if (!Number.isNaN(parsedDate)) {
    return Math.max(0, parsedDate - Date.now());
  }
  return undefined;
}

function validateAndNormalizeSuccessPayload(
  raw: RawServerResponseBody,
  attempts: number
): GeminiChatResponse {
  if (typeof raw.reply !== 'string' || raw.reply.trim().length === 0) {
    throw new GeminiServiceError({
      code: 'INVALID_RESPONSE',
      status: 502,
      retryable: true,
      attempts,
      message: 'La respuesta del servidor Gemini llegó vacía o sin campo "reply" válido.',
    });
  }

  const normalizedTrace: GeminiToolTraceRecord[] = Array.isArray(raw.toolTrace)
    ? raw.toolTrace
        .filter(
          (item): item is Record<string, unknown> =>
            Boolean(item) && typeof item === 'object' && !Array.isArray(item)
        )
        .map((item) => ({
          tool: typeof item.tool === 'string' ? item.tool.slice(0, 64) : 'unknown',
          status: item.status === 'error' ? 'error' : 'ok',
          argsSummary:
            typeof item.argsSummary === 'string' ? item.argsSummary.slice(0, 180) : '',
          resultSummary:
            typeof item.resultSummary === 'string' ? item.resultSummary.slice(0, 240) : '',
          durationMs:
            typeof item.durationMs === 'number' && Number.isFinite(item.durationMs)
              ? item.durationMs
              : 0,
        }))
    : [];

  return {
    reply: raw.reply.trim(),
    model:
      typeof raw.model === 'string' && raw.model.trim().length > 0
        ? raw.model.trim()
        : 'gemini-4-hydrogen',
    provider: 'gemini',
    fallbackModelUsed: Boolean(raw.fallbackModelUsed),
    toolTrace: normalizedTrace,
    attempts,
  };
}

function buildHttpError(
  status: number,
  body: RawServerResponseBody,
  retryAfterMs: number | undefined,
  attempts: number
): GeminiServiceError {
  const rawServerCode =
    typeof body.code === 'string'
      ? body.code
      : typeof body.error === 'string'
        ? body.error
        : undefined;
  const serverMessage =
    typeof body.message === 'string' && body.message.trim().length > 0
      ? sanitizeGeminiClientMessage(body.message)
      : '';
  const modelAttempted =
    typeof body.modelAttempted === 'string' ? body.modelAttempted : undefined;

  if (rawServerCode === 'GEMINI_NOT_CONFIGURED') {
    return new GeminiServiceError({
      code: 'GEMINI_NOT_CONFIGURED',
      status,
      retryable: false,
      attempts,
      serverCode: rawServerCode,
      modelAttempted,
      message:
        serverMessage ||
        'GEMINI_API_KEY no está configurada en el servidor. Configúrala en Settings > Secrets.',
    });
  }

  if (rawServerCode === 'INVALID_API_KEY') {
    return new GeminiServiceError({
      code: 'INVALID_API_KEY',
      status,
      retryable: false,
      attempts,
      serverCode: rawServerCode,
      modelAttempted,
      message:
        serverMessage ||
        'La clave configurada en el servidor fue rechazada. Verifica Settings > Secrets.',
    });
  }

  if (status === 429 || rawServerCode === 'RATE_LIMITED' || rawServerCode === 'RATE_LIMIT_EXCEEDED') {
    return new GeminiServiceError({
      code: 'RATE_LIMITED',
      status: 429,
      retryable: true,
      attempts,
      retryAfterMs,
      serverCode: rawServerCode,
      modelAttempted,
      message:
        serverMessage ||
        'Límite temporal de solicitudes alcanzado (429). Reintentando con backoff exponencial.',
    });
  }

  if (status === 504 || rawServerCode === 'TIMEOUT') {
    return new GeminiServiceError({
      code: 'TIMEOUT',
      status: 504,
      retryable: true,
      attempts,
      serverCode: rawServerCode,
      modelAttempted,
      message: serverMessage || 'Tiempo de espera agotado al esperar respuesta de Gemini (504).',
    });
  }

  if (status === 503 || rawServerCode === 'SERVICE_UNAVAILABLE') {
    return new GeminiServiceError({
      code: 'SERVICE_UNAVAILABLE',
      status: 503,
      retryable: true,
      attempts,
      retryAfterMs,
      serverCode: rawServerCode,
      modelAttempted,
      message:
        serverMessage || 'El servicio de Gemini no está disponible temporalmente (503).',
    });
  }

  if (status >= 500) {
    return new GeminiServiceError({
      code: 'SERVER_ERROR',
      status,
      retryable: body.retryable === false ? false : true,
      attempts,
      serverCode: rawServerCode,
      modelAttempted,
      message:
        serverMessage || `Error interno del servidor de proxy Gemini (HTTP ${status}).`,
    });
  }

  return new GeminiServiceError({
    code: 'BAD_REQUEST',
    status,
    retryable: false,
    attempts,
    serverCode: rawServerCode,
    modelAttempted,
    message: serverMessage || `Solicitud rechazada por el servidor (HTTP ${status}).`,
  });
}

export class GeminiService {
  private readonly endpoint: string;
  private readonly healthEndpoint: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly fetchFn?: typeof fetch;
  private readonly sleepFn: (ms: number) => Promise<void>;
  private instanceEventLogger: GeminiEventLogger | null;
  private readonly useGlobalLogger: boolean;

  constructor(options: GeminiServiceOptions = {}) {
    this.endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
    this.healthEndpoint = options.healthEndpoint ?? DEFAULT_HEALTH_ENDPOINT;
    this.timeoutMs = Math.max(250, Math.min(60_000, options.timeoutMs ?? 25_000));
    this.maxRetries = Math.max(0, Math.min(5, options.maxRetries ?? 2));
    this.baseDelayMs = Math.max(0, Math.min(5_000, options.baseDelayMs ?? 450));
    this.maxDelayMs = Math.max(this.baseDelayMs, Math.min(30_000, options.maxDelayMs ?? 6_000));
    this.fetchFn = options.fetchImpl;
    this.sleepFn = options.sleepImpl ?? defaultSleep;
    this.instanceEventLogger = options.logEvent ?? null;
    this.useGlobalLogger = options.logEvent === undefined;
  }

  /**
   * Bind StudioContext's `logEvent` callback so all network/API errors emitted via this
   * service are recorded in the auditable platform event log. Returns an unsubscribe callback.
   */
  setEventLogger(logger: GeminiEventLogger | null): () => void {
    this.instanceEventLogger = logger;
    if (this === geminiService) {
      globalEventLogger = logger;
    }
    return () => {
      if (this.instanceEventLogger === logger) {
        this.instanceEventLogger = null;
      }
      if (this === geminiService && globalEventLogger === logger) {
        globalEventLogger = null;
      }
    };
  }

  private resolveLogger(override?: GeminiEventLogger): GeminiEventLogger | null {
    if (override) return override;
    if (this.instanceEventLogger) return this.instanceEventLogger;
    return this.useGlobalLogger ? globalEventLogger : null;
  }

  private emitAuditEvent(
    loggerOverride: GeminiEventLogger | undefined,
    title: string,
    detail: string,
    status: SystemEventRecord['status']
  ): void {
    const logger = this.resolveLogger(loggerOverride);
    if (!logger) return;
    try {
      logger(
        'omni',
        sanitizeGeminiClientMessage(title).slice(0, 120),
        sanitizeGeminiClientMessage(detail).slice(0, 320),
        status
      );
    } catch {
      // Never let UI logging exceptions mask API error handling
    }
  }

  private reportServiceError(
    loggerOverride: GeminiEventLogger | undefined,
    err: GeminiServiceError,
    phase: 'retry' | 'final',
    endpointLabel: string
  ): void {
    const modelPart = err.modelAttempted ? ` · modelo=${err.modelAttempted}` : '';
    const codePart = err.serverCode && err.serverCode !== err.code ? `/${err.serverCode}` : '';
    if (phase === 'retry') {
      this.emitAuditEvent(
        loggerOverride,
        `Reintento Gemini (${err.code}${codePart})`,
        `Intento #${err.attempts} en ${endpointLabel}: ${err.message} (HTTP ${err.status}${modelPart})`,
        'warn'
      );
      return;
    }
    this.emitAuditEvent(
      loggerOverride,
      err.code === 'ABORTED'
        ? 'Consulta Gemini cancelada'
        : `Error de asistente Gemini (${err.code}${codePart})`,
      `${err.message} (HTTP ${err.status} · intentos=${err.attempts}${modelPart} · ruta=${endpointLabel})`,
      err.code === 'ABORTED' ? 'warn' : 'error'
    );
  }

  private resolveFetch(): typeof fetch {
    if (this.fetchFn) return this.fetchFn;
    if (typeof globalThis.fetch === 'function') {
      return globalThis.fetch.bind(globalThis);
    }
    throw new GeminiServiceError({
      code: 'NETWORK_ERROR',
      status: 0,
      retryable: false,
      message: 'API fetch no disponible en este entorno de ejecución.',
    });
  }

  private computeBackoffDelayMs(attemptIndex: number, retryAfterMs?: number): number {
    if (this.baseDelayMs <= 0) {
      return retryAfterMs !== undefined ? Math.min(this.maxDelayMs, retryAfterMs) : 0;
    }
    const exponential = Math.min(this.maxDelayMs, this.baseDelayMs * Math.pow(2, attemptIndex));
    const jitter = Math.round(Math.random() * Math.min(200, exponential * 0.25));
    const computed = Math.min(this.maxDelayMs, exponential + jitter);
    if (retryAfterMs !== undefined && Number.isFinite(retryAfterMs)) {
      return Math.min(this.maxDelayMs, Math.max(computed, retryAfterMs));
    }
    return computed;
  }

  async checkAvailability(logEventOverride?: GeminiEventLogger): Promise<GeminiAvailabilityStatus> {
    const checkedAt = new Date().toISOString();
    let fetchImpl: typeof fetch;
    try {
      fetchImpl = this.resolveFetch();
    } catch (err) {
      if (err instanceof GeminiServiceError) {
        this.reportServiceError(logEventOverride, err, 'final', this.healthEndpoint);
      }
      return { available: false, model: null, checkedAt };
    }

    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), Math.min(this.timeoutMs, 8_000)) : null;

    try {
      const resp = await fetchImpl(this.healthEndpoint, {
        method: 'GET',
        cache: 'no-store',
        ...(ctrl ? { signal: ctrl.signal } : {}),
      });
      if (!resp.ok) {
        this.emitAuditEvent(
          logEventOverride,
          `Sondeo Gemini con fallo HTTP ${resp.status}`,
          `El endpoint ${this.healthEndpoint} respondió estado ${resp.status}.`,
          resp.status >= 500 ? 'error' : 'warn'
        );
        return { available: false, model: null, checkedAt };
      }
      const data = (await resp.json()) as {
        geminiConfigured?: unknown;
        geminiModel?: unknown;
      };
      return {
        available: data.geminiConfigured === true,
        model: typeof data.geminiModel === 'string' ? data.geminiModel : null,
        checkedAt,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Fallo de red en sondeo /api/health';
      this.emitAuditEvent(
        logEventOverride,
        'Error de red al verificar disponibilidad de Gemini',
        `${this.healthEndpoint}: ${msg}`,
        'error'
      );
      return { available: false, model: null, checkedAt };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async chat(request: GeminiChatRequestPayload): Promise<GeminiChatResponse> {
    const sanitizedMessages = (Array.isArray(request.messages) ? request.messages : [])
      .slice(-12)
      .filter(
        (m): m is GeminiChatMessageInput =>
          Boolean(m) &&
          typeof m.content === 'string' &&
          m.content.trim().length > 0 &&
          (m.role === 'user' || m.role === 'assistant' || m.role === 'model')
      )
      .map((m) => ({
        role: m.role,
        content: m.content.trim().slice(0, 2000),
      }));

    if (sanitizedMessages.length === 0) {
      const validationErr = new GeminiServiceError({
        code: 'BAD_REQUEST',
        status: 400,
        retryable: false,
        attempts: 0,
        message: 'Se requiere al menos un mensaje válido para consultar a Gemini.',
      });
      this.reportServiceError(request.logEvent, validationErr, 'final', this.endpoint);
      throw validationErr;
    }

    let fetchImpl: typeof fetch;
    try {
      fetchImpl = this.resolveFetch();
    } catch (err) {
      if (err instanceof GeminiServiceError) {
        this.reportServiceError(request.logEvent, err, 'final', this.endpoint);
      }
      throw err;
    }
    let lastError: GeminiServiceError | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      if (request.signal?.aborted) {
        const abortErr = new GeminiServiceError({
          code: 'ABORTED',
          status: 499,
          retryable: false,
          attempts: attempt,
          message: 'La consulta a Gemini fue cancelada por el usuario.',
        });
        this.reportServiceError(request.logEvent, abortErr, 'final', this.endpoint);
        throw abortErr;
      }

      if (attempt > 0) {
        const delayMs = this.computeBackoffDelayMs(attempt - 1, lastError?.retryAfterMs);
        if (delayMs > 0) {
          await this.sleepFn(delayMs);
        }
      }

      const attemptNum = attempt + 1;
      const attemptCtrl =
        typeof AbortController !== 'undefined' ? new AbortController() : null;
      let timedOut = false;

      const onExternalAbort = () => {
        attemptCtrl?.abort();
      };
      if (request.signal && attemptCtrl) {
        request.signal.addEventListener('abort', onExternalAbort, { once: true });
      }
      const timeoutHandle = attemptCtrl
        ? setTimeout(() => {
            timedOut = true;
            attemptCtrl.abort();
          }, this.timeoutMs)
        : null;

      try {
        const resp = await fetchImpl(this.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          ...(attemptCtrl ? { signal: attemptCtrl.signal } : {}),
          body: JSON.stringify({
            messages: sanitizedMessages,
            ...(request.workspaceContext !== undefined
              ? { workspaceContext: request.workspaceContext }
              : {}),
          }),
        });

        const rawText = await resp.text();
        let parsedBody: RawServerResponseBody = {};
        if (rawText.trim().length > 0) {
          try {
            const candidate = JSON.parse(rawText);
            if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
              parsedBody = candidate as RawServerResponseBody;
            }
          } catch {
            if (resp.ok) {
              throw new GeminiServiceError({
                code: 'INVALID_RESPONSE',
                status: 502,
                retryable: true,
                attempts: attemptNum,
                message: 'El servidor devolvió una respuesta no JSON inesperada.',
              });
            }
          }
        }

        if (!resp.ok) {
          const retryAfterMs = parseRetryAfterMs(resp.headers?.get('retry-after') ?? null);
          throw buildHttpError(resp.status, parsedBody, retryAfterMs, attemptNum);
        }

        return validateAndNormalizeSuccessPayload(parsedBody, attemptNum);
      } catch (err) {
        if (err instanceof GeminiServiceError) {
          lastError = err;
        } else if (request.signal?.aborted && !timedOut) {
          const abortErr = new GeminiServiceError({
            code: 'ABORTED',
            status: 499,
            retryable: false,
            attempts: attemptNum,
            message: 'La consulta a Gemini fue cancelada por el usuario.',
          });
          this.reportServiceError(request.logEvent, abortErr, 'final', this.endpoint);
          throw abortErr;
        } else if (
          timedOut ||
          (err instanceof Error && (err.name === 'AbortError' || /timeout|timed out/i.test(err.message)))
        ) {
          lastError = new GeminiServiceError({
            code: 'TIMEOUT',
            status: 504,
            retryable: true,
            attempts: attemptNum,
            message: `Tiempo de espera agotado (${this.timeoutMs} ms) en /api/omni/chat.`,
          });
        } else {
          const rawMsg = err instanceof Error ? err.message : 'Fallo de red inesperado';
          lastError = new GeminiServiceError({
            code: 'NETWORK_ERROR',
            status: 502,
            retryable: true,
            attempts: attemptNum,
            message: `Error de red al contactar el proxy Gemini: ${rawMsg}`,
          });
        }

        if (!lastError.retryable || attempt >= this.maxRetries) {
          this.reportServiceError(request.logEvent, lastError, 'final', this.endpoint);
          throw lastError;
        }

        this.reportServiceError(request.logEvent, lastError, 'retry', this.endpoint);
      } finally {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        if (request.signal && attemptCtrl) {
          request.signal.removeEventListener('abort', onExternalAbort);
        }
      }
    }

    const fallbackErr =
      lastError ??
      new GeminiServiceError({
        code: 'SERVER_ERROR',
        status: 500,
        retryable: false,
        message: 'Error inesperado al ejecutar la solicitud en GeminiService.',
      });
    this.reportServiceError(request.logEvent, fallbackErr, 'final', this.endpoint);
    throw fallbackErr;
  }
}

export const geminiService = new GeminiService();
export default geminiService;
