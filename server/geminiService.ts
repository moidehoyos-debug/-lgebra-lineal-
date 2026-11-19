import crypto from 'node:crypto';
import { GoogleGenAI, type Content } from '@google/genai';
import {
  executeAuthorizedOmniTool,
  OMNI_FUNCTION_DECLARATIONS,
  type OmniToolTraceEntry,
  type StudioWorkspaceSnapshotPayload,
} from './omniTools.ts';

export const PRIMARY_GEMINI_MODEL = 'gemini-4-hydrogen';
export const FALLBACK_GEMINI_MODEL = 'gemini-3.1-flash-lite';
export const ALLOWED_GEMINI_MODELS = [
  PRIMARY_GEMINI_MODEL,
  FALLBACK_GEMINI_MODEL,
] as const;

export type AllowedGeminiModel = (typeof ALLOWED_GEMINI_MODELS)[number];

let cachedClientDigest: string | null = null;
let cachedGeminiClient: GeminiClientLike | null = null;

/** Strip any accidental API keys, Bearer tokens, or query secrets from provider error strings. */
export function sanitizeGeminiErrorText(raw: string): string {
  return raw
    .replace(/AIza[0-9A-Za-z\-_]{20,}/g, '[REDACTED_KEY]')
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]')
    .replace(/([?&]key=)[^&\s]+/gi, '$1[REDACTED]')
    .replace(/(x-goog-api-key\s*[:=]\s*)\S+/gi, '$1[REDACTED]')
    .replace(/(GEMINI_API_KEY\s*=\s*)\S+/gi, '$1[REDACTED]')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .trim()
    .slice(0, 300);
}

export function isGeminiApiConfigured(): boolean {
  const apiKey = process.env.GEMINI_API_KEY?.trim() ?? '';
  return apiKey.length >= 10 && apiKey !== 'MY_GEMINI_API_KEY' && !/replace|tu_clave|example/i.test(apiKey);
}

export function resolveConfiguredGeminiModel(): {
  primaryModel: AllowedGeminiModel;
  fallbackModel: AllowedGeminiModel;
  warning: string | null;
} {
  const configured = process.env.GEMINI_MODEL?.trim();
  if (!configured) {
    return {
      primaryModel: PRIMARY_GEMINI_MODEL,
      fallbackModel: FALLBACK_GEMINI_MODEL,
      warning: null,
    };
  }
  if ((ALLOWED_GEMINI_MODELS as readonly string[]).includes(configured)) {
    const primary = configured as AllowedGeminiModel;
    return {
      primaryModel: primary,
      fallbackModel:
        primary === PRIMARY_GEMINI_MODEL ? FALLBACK_GEMINI_MODEL : PRIMARY_GEMINI_MODEL,
      warning: null,
    };
  }
  return {
    primaryModel: PRIMARY_GEMINI_MODEL,
    fallbackModel: FALLBACK_GEMINI_MODEL,
    warning: `GEMINI_MODEL="${configured}" no está en la lista permitida; usando ${PRIMARY_GEMINI_MODEL}.`,
  };
}

export interface GeminiClientLike {
  models: {
    generateContent: (params: {
      model: string;
      contents: Content[];
      config?: Record<string, unknown>;
    }) => Promise<{
      text?: string;
      functionCalls?: Array<{
        id?: string;
        name?: string;
        args?: Record<string, unknown>;
      }>;
      candidates?: Array<{
        finishReason?: string;
        content?: Content;
      }>;
    }>;
  };
}

export function createConfiguredGeminiClient(): GeminiClientLike | null {
  if (!isGeminiApiConfigured()) {
    cachedClientDigest = null;
    cachedGeminiClient = null;
    return null;
  }
  const apiKey = process.env.GEMINI_API_KEY!.trim();
  const digest = crypto.createHash('sha256').update(apiKey).digest('hex');
  if (cachedGeminiClient && cachedClientDigest === digest) {
    return cachedGeminiClient;
  }
  cachedGeminiClient = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  }) as unknown as GeminiClientLike;
  cachedClientDigest = digest;
  return cachedGeminiClient;
}

export interface ClassifiedGeminiError {
  status: number;
  code:
    | 'INVALID_API_KEY'
    | 'MODEL_NOT_FOUND'
    | 'RATE_LIMITED'
    | 'SERVICE_UNAVAILABLE'
    | 'TIMEOUT'
    | 'BAD_GATEWAY'
    | 'NETWORK_ERROR'
    | 'SAFETY_BLOCKED'
    | 'EMPTY_RESPONSE'
    | 'REQUEST_FAILED';
  retryable: boolean;
  tryFallbackModel: boolean;
  message: string;
}

export function classifyGeminiError(err: unknown): ClassifiedGeminiError {
  const rawUnsafe = err instanceof Error ? err.message : String(err ?? 'Error desconocido');
  const raw = sanitizeGeminiErrorText(rawUnsafe);
  const statusFromErr =
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    typeof (err as { status?: unknown }).status === 'number'
      ? (err as { status: number }).status
      : null;

  if (/timeout|timed out|abort/i.test(raw)) {
    return {
      status: 504,
      code: 'TIMEOUT',
      retryable: true,
      tryFallbackModel: true,
      message: 'Tiempo de espera agotado al consultar Gemini.',
    };
  }
  if (
    statusFromErr === 401 ||
    statusFromErr === 403 ||
    /API_KEY_INVALID|PERMISSION_DENIED|API key not valid|invalid api key|unauthorized/i.test(raw)
  ) {
    return {
      status: 503,
      code: 'INVALID_API_KEY',
      retryable: false,
      tryFallbackModel: false,
      message:
        'La clave GEMINI_API_KEY del servidor fue rechazada o carece de permisos. Verifica la configuración en Settings > Secrets.',
    };
  }
  if (
    statusFromErr === 404 ||
    /\b404\b|NOT_FOUND|models\/.*not found|unsupported model/i.test(raw)
  ) {
    return {
      status: 502,
      code: 'MODEL_NOT_FOUND',
      retryable: false,
      tryFallbackModel: true,
      message: 'El modelo configurado en Gemini no está disponible en este momento.',
    };
  }
  if (statusFromErr === 429 || /\b429\b|RESOURCE_EXHAUSTED|quota|rate limit/i.test(raw)) {
    return {
      status: 429,
      code: 'RATE_LIMITED',
      retryable: true,
      tryFallbackModel: true,
      message: 'Límite temporal de cuota o solicitudes alcanzado en Gemini (429).',
    };
  }
  if (
    /ECONNRESET|ETIMEDOUT|ENOTFOUND|ECONNREFUSED|EAI_AGAIN|fetch failed|network error|socket hang up|UND_ERR_/i.test(
      raw
    )
  ) {
    return {
      status: 502,
      code: 'NETWORK_ERROR',
      retryable: true,
      tryFallbackModel: true,
      message: 'Error transitorio de conectividad con el servicio externo de Gemini.',
    };
  }
  if (statusFromErr === 503 || /\b503\b|UNAVAILABLE|high demand/i.test(raw)) {
    return {
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
      retryable: true,
      tryFallbackModel: true,
      message: 'Servicio de Gemini temporalmente saturado (503).',
    };
  }
  if (statusFromErr === 502 || /\b502\b|BAD_GATEWAY/i.test(raw)) {
    return {
      status: 502,
      code: 'BAD_GATEWAY',
      retryable: true,
      tryFallbackModel: true,
      message: 'Error de pasarela al contactar con Gemini (502).',
    };
  }
  if (statusFromErr === 500 || /\b500\b|\bINTERNAL\b/i.test(raw)) {
    return {
      status: 500,
      code: 'REQUEST_FAILED',
      retryable: true,
      tryFallbackModel: true,
      message: 'Error interno temporal en el proveedor Gemini (500).',
    };
  }
  if (/SAFETY|PROHIBITED_CONTENT|RECITATION|BLOCKLIST/i.test(raw)) {
    return {
      status: 400,
      code: 'SAFETY_BLOCKED',
      retryable: false,
      tryFallbackModel: false,
      message: 'La consulta fue bloqueada por las políticas de seguridad del modelo.',
    };
  }
  return {
    status: statusFromErr && statusFromErr >= 400 && statusFromErr < 600 ? statusFromErr : 502,
    code: 'REQUEST_FAILED',
    retryable: false,
    tryFallbackModel: false,
    message: raw || 'No fue posible completar la solicitud a Gemini API.',
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`Gemini timeout after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function runGeminiOmniChat(params: {
  aiClient: GeminiClientLike;
  history: Array<{ role: 'user' | 'model'; text: string }>;
  workspaceContext: StudioWorkspaceSnapshotPayload;
  contextSummaryText: string;
  timeoutMs?: number;
  retryDelayMs?: number;
  maxRetriesPerModel?: number;
}): Promise<
  | {
      ok: true;
      reply: string;
      model: string;
      provider: 'gemini';
      fallbackModelUsed: boolean;
      toolTrace: OmniToolTraceEntry[];
    }
  | {
      ok: false;
      status: number;
      code: string;
      retryable: boolean;
      message: string;
      modelAttempted: string;
      toolTrace: OmniToolTraceEntry[];
    }
> {
  const { primaryModel, fallbackModel } = resolveConfiguredGeminiModel();
  const timeoutMs = Math.max(100, Math.min(30_000, params.timeoutMs ?? 18_000));
  const retryDelayMs = Math.max(0, Math.min(2_500, params.retryDelayMs ?? 350));
  const maxRetriesPerModel = Math.max(0, Math.min(2, params.maxRetriesPerModel ?? 1));
  const toolTrace: OmniToolTraceEntry[] = [];

  const boundedHistory = params.history
    .slice(-12)
    .map((h) => ({
      role: h.role,
      text: h.text.replace(/[<>]/g, '').trim().slice(0, 2000),
    }))
    .filter((h) => h.text.length > 0);

  if (boundedHistory.length === 0) {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_HISTORY',
      retryable: false,
      message: 'No hay mensajes válidos para procesar en Gemini.',
      modelAttempted: primaryModel,
      toolTrace,
    };
  }

  const safeContextSummary = sanitizeGeminiErrorText(params.contextSummaryText).slice(0, 2500);
  const systemInstruction = [
    'Eres Omni Bot, el asistente técnico y académico de VectorIA Studio (Álgebra Lineal e Ingeniería de IA).',
    'Responde en español claro, preciso y estructurado.',
    'Reglas estrictas de integridad:',
    '1. Nunca inventes porcentajes, predicciones, métricas de entrenamiento ni memorias de sesiones pasadas.',
    '2. Utiliza las herramientas declaradas (run_linear_algebra_op, inspect_studio_workspace, explain_model_architecture, compare_models) siempre que necesites calcular matrices o verificar métricas reales.',
    '3. Si el contexto indica que el modelo alfanumérico de 36 clases o Riego Inteligente no ha sido entrenado, indícalo explícitamente.',
    '4. Fundamenta las explicaciones con fórmulas reales (Z = WX + b, ReLU, Softmax, Sigmoide, Gauss-Jordan, Av = λv).',
    `Contexto actual del estudio: ${safeContextSummary}`,
  ].join('\n');

  const modelQueue: AllowedGeminiModel[] =
    primaryModel === fallbackModel ? [primaryModel] : [primaryModel, fallbackModel];
  let lastError: ClassifiedGeminiError = {
    status: 503,
    code: 'SERVICE_UNAVAILABLE',
    retryable: false,
    tryFallbackModel: false,
    message: 'Gemini no disponible.',
  };
  let lastModel = primaryModel;

  for (let mIdx = 0; mIdx < modelQueue.length; mIdx += 1) {
    const model = modelQueue[mIdx];
    lastModel = model;

    for (let attempt = 0; attempt <= maxRetriesPerModel; attempt += 1) {
      if (attempt > 0 && retryDelayMs > 0) {
        const expDelay = Math.min(3_000, retryDelayMs * Math.pow(2, attempt - 1));
        const jitter = Math.round(Math.random() * Math.min(120, retryDelayMs * 0.3));
        await new Promise((r) => setTimeout(r, expDelay + jitter));
      }

      const conversationContents: Content[] = boundedHistory.map((h) => ({
        role: h.role,
        parts: [{ text: h.text }],
      }));

      try {
        let finalReply = '';
        let blockedReason: string | undefined;
        // Max 3 structured tool rounds + final synthesis round without tool declarations
        for (let round = 0; round < 4; round += 1) {
          const allowTools = round < 3;
          const response = await withTimeout(
            params.aiClient.models.generateContent({
              model,
              contents: conversationContents,
              config: {
                systemInstruction,
                ...(allowTools
                  ? { tools: [{ functionDeclarations: OMNI_FUNCTION_DECLARATIONS }] }
                  : {}),
              },
            }),
            timeoutMs
          );

          const functionCalls = response.functionCalls;
          if (Array.isArray(functionCalls) && functionCalls.length > 0 && allowTools) {
            const candidateContent = response.candidates?.[0]?.content;
            if (candidateContent) {
              conversationContents.push(candidateContent);
            } else {
              conversationContents.push({
                role: 'model',
                parts: functionCalls.map((fc) => ({
                  functionCall: {
                    name: fc.name ?? 'unknown',
                    args: fc.args ?? {},
                    ...(fc.id ? { id: fc.id } : {}),
                  },
                })),
              });
            }

            const fnResponseParts = functionCalls.map((fc) => {
              const name = fc.name ?? 'unknown';
              const args =
                fc.args && typeof fc.args === 'object'
                  ? (fc.args as Record<string, unknown>)
                  : {};
              const executed = executeAuthorizedOmniTool(
                name,
                args,
                params.workspaceContext
              );
              toolTrace.push(executed.trace);
              return {
                functionResponse: {
                  name,
                  response: executed.response,
                  ...(fc.id ? { id: fc.id } : {}),
                },
              };
            });

            conversationContents.push({
              role: 'user',
              parts: fnResponseParts,
            });
            continue;
          }

          blockedReason = response.candidates?.[0]?.finishReason;
          finalReply = response.text?.trim() ?? '';
          break;
        }

        if (!finalReply) {
          if (blockedReason && /SAFETY|PROHIBITED|RECITATION|BLOCKLIST/i.test(blockedReason)) {
            lastError = {
              status: 400,
              code: 'SAFETY_BLOCKED',
              retryable: false,
              tryFallbackModel: false,
              message: 'La consulta fue bloqueada por las políticas de seguridad del modelo.',
            };
            break;
          }
          lastError = {
            status: 502,
            code: 'EMPTY_RESPONSE',
            retryable: true,
            tryFallbackModel: true,
            message: 'El modelo devolvió una respuesta vacía.',
          };
          continue;
        }

        return {
          ok: true,
          reply: finalReply,
          model,
          provider: 'gemini',
          fallbackModelUsed: mIdx > 0,
          toolTrace,
        };
      } catch (err) {
        const classified = classifyGeminiError(err);
        lastError = classified;
        if (!classified.retryable) {
          break;
        }
      }
    }

    if (!lastError.tryFallbackModel) {
      break;
    }
  }

  return {
    ok: false,
    status: lastError.status,
    code: lastError.code,
    retryable: lastError.retryable,
    message: sanitizeGeminiErrorText(lastError.message),
    modelAttempted: lastModel,
    toolTrace,
  };
}
