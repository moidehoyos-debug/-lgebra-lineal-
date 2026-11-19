import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../server.ts';
import {
  classifyGeminiError,
  FALLBACK_GEMINI_MODEL,
  isGeminiApiConfigured,
  PRIMARY_GEMINI_MODEL,
  runGeminiOmniChat,
  sanitizeGeminiErrorText,
  type GeminiClientLike,
} from '../server/geminiService.ts';
import {
  AUTHORIZED_OMNI_TOOL_NAMES,
  executeAuthorizedOmniTool,
} from '../server/omniTools.ts';
import {
  GeminiService,
  GeminiServiceError,
  sanitizeGeminiClientMessage,
} from '../src/services/geminiService.ts';
import { createInitialBuilderDocument } from '../src/utils/builderDefaults.ts';

describe('Phase 1.3 — Critical Visual Builder Security & RBAC Hardening', () => {
  it('blocks unauthenticated private state, requires bootstrap setupToken, enforces passworded viewer + RBAC isolation, and honors revocation', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vectoria-sec-p1-'));
    const storeFile = path.join(tmpDir, 'builder.json');
    const setupToken = 'BootstrapSecret#VectorIA2026';
    const app = createApp({ builderStoragePath: storeFile, setupToken });
    const server = app.listen(0);
    const port = (server.address() as { port: number }).port;
    const base = `http://127.0.0.1:${port}`;

    try {
      // 1. Unauthenticated /status must NOT reveal diskPersisted or private state
      const statusBefore = await fetch(`${base}/api/builder/auth/status`);
      expect(statusBefore.status).toBe(200);
      const statusJson = (await statusBefore.json()) as Record<string, unknown>;
      expect(statusJson.initialized).toBe(false);
      expect(statusJson.setupTokenRequired).toBe(true);
      expect('diskPersisted' in statusJson).toBe(false);

      // 2. Unauthenticated visitor blocked from ALL private/mutating routes
      for (const req of [
        fetch(`${base}/api/builder/state`),
        fetch(`${base}/api/builder/draft`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ document: createInitialBuilderDocument() }),
        }),
        fetch(`${base}/api/builder/publish`, { method: 'POST' }),
        fetch(`${base}/api/builder/export-zip`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'distribution' }),
        }),
        fetch(`${base}/api/backup/schedule`),
        fetch(`${base}/api/builder/auth/roles`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ viewerPasscode: 'NewViewer#2026' }),
        }),
      ]) {
        const res = await req;
        expect(res.status).toBe(401);
      }

      // 3. Login blocked while uninitialized (403)
      const preInitLogin = await fetch(`${base}/api/builder/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'viewer', passcode: '' }),
      });
      expect(preInitLogin.status).toBe(403);

      // 4. Visitor CANNOT hijack initialization without valid setupToken
      const hijackMissingToken = await fetch(`${base}/api/builder/auth/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPasscode: 'AttackerPass123' }),
      });
      expect(hijackMissingToken.status).toBe(403);

      const hijackWrongToken = await fetch(`${base}/api/builder/auth/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminPasscode: 'AttackerPass123',
          setupToken: 'wrong-token',
        }),
      });
      expect(hijackWrongToken.status).toBe(403);

      // 5. Authorized initial setup succeeds (201), repeat setup rejected (409)
      const validSetup = await fetch(`${base}/api/builder/auth/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminPasscode: 'AdminStrong#2026',
          editorPasscode: 'EditorStrong#2026',
          viewerPasscode: 'ViewerStrong#2026',
          setupToken,
        }),
      });
      expect(validSetup.status).toBe(201);
      const adminSession = (await validSetup.json()) as { token: string; role: string };
      expect(adminSession.role).toBe('admin');

      const repeatSetup = await fetch(`${base}/api/builder/auth/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminPasscode: 'Overwrite#2026',
          setupToken,
        }),
      });
      expect(repeatSetup.status).toBe(409);

      // 6. Passwordless or wrong-passcode viewer login MUST be rejected (401)
      const emptyViewerLogin = await fetch(`${base}/api/builder/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'viewer', passcode: '' }),
      });
      expect(emptyViewerLogin.status).toBe(401);

      const wrongViewerLogin = await fetch(`${base}/api/builder/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'viewer', passcode: 'InvalidViewer99' }),
      });
      expect(wrongViewerLogin.status).toBe(401);

      // 7. Invalid / tampered Bearer token rejected (401)
      const tamperedRes = await fetch(`${base}/api/builder/state`, {
        headers: { Authorization: `Bearer ${adminSession.token.slice(0, -4)}AAAA` },
      });
      expect(tamperedRes.status).toBe(401);

      // 8. Admin saves private unpublished draft -> verify viewer & editor scope isolation
      const privateDraft = createInitialBuilderDocument();
      privateDraft.pages[0].title = 'Borrador Confidencial Interno';
      const draftSaveRes = await fetch(`${base}/api/builder/draft`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminSession.token}`,
        },
        body: JSON.stringify({
          document: privateDraft,
          description: 'Cambio secreto en borrador',
          changedItems: ['Título'],
        }),
      });
      expect(draftSaveRes.status).toBe(200);

      // Login as Viewer and Editor
      const viewerLogin = await fetch(`${base}/api/builder/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'viewer', passcode: 'ViewerStrong#2026' }),
      });
      expect(viewerLogin.status).toBe(200);
      const viewerSession = (await viewerLogin.json()) as { token: string };

      const editorLogin = await fetch(`${base}/api/builder/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'editor', passcode: 'EditorStrong#2026' }),
      });
      expect(editorLogin.status).toBe(200);
      const editorSession = (await editorLogin.json()) as { token: string };

      // Viewer must NOT see unpublished draft title, versions, auditLog, or diskPersisted
      const viewerState = await fetch(`${base}/api/builder/state`, {
        headers: { Authorization: `Bearer ${viewerSession.token}` },
      });
      expect(viewerState.status).toBe(200);
      const viewerBundle = (await viewerState.json()) as {
        draft: { pages: Array<{ title: string }> };
        versions: unknown[];
        auditLog: unknown[];
        diskPersisted?: boolean;
      };
      expect(viewerBundle.draft.pages[0].title).toBe('Observatorio del Estudio');
      expect(viewerBundle.versions).toHaveLength(0);
      expect(viewerBundle.auditLog).toHaveLength(0);
      expect('diskPersisted' in viewerBundle).toBe(false);

      // Viewer cannot mutate anything
      for (const req of [
        fetch(`${base}/api/builder/draft`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${viewerSession.token}`,
          },
          body: JSON.stringify({ document: privateDraft }),
        }),
        fetch(`${base}/api/builder/publish`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${viewerSession.token}` },
        }),
        fetch(`${base}/api/builder/auth/roles`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${viewerSession.token}`,
          },
          body: JSON.stringify({ viewerPasscode: 'Hack1234' }),
        }),
      ]) {
        expect((await req).status).toBe(403);
      }

      // Editor sees draft, does NOT see auditLog, CANNOT publish/export/change roles
      const editorState = await fetch(`${base}/api/builder/state`, {
        headers: { Authorization: `Bearer ${editorSession.token}` },
      });
      expect(editorState.status).toBe(200);
      const editorBundle = (await editorState.json()) as {
        draft: { pages: Array<{ title: string }> };
        auditLog: unknown[];
      };
      expect(editorBundle.draft.pages[0].title).toBe('Borrador Confidencial Interno');
      expect(editorBundle.auditLog).toHaveLength(0);

      for (const req of [
        fetch(`${base}/api/builder/publish`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${editorSession.token}` },
        }),
        fetch(`${base}/api/builder/export-zip`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${editorSession.token}`,
          },
          body: JSON.stringify({ mode: 'full' }),
        }),
        fetch(`${base}/api/builder/auth/roles`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${editorSession.token}`,
          },
          body: JSON.stringify({ viewerPasscode: 'Hack1234' }),
        }),
      ]) {
        expect((await req).status).toBe(403);
      }

      // 9. Admin rotates credentials with revokeExistingSessions=true -> existing viewer/editor tokens fail (401)
      const rotateRes = await fetch(`${base}/api/builder/auth/roles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminSession.token}`,
        },
        body: JSON.stringify({
          viewerPasscode: 'ViewerRotated#2026',
          revokeExistingSessions: true,
        }),
      });
      expect(rotateRes.status).toBe(200);

      const revokedViewerCall = await fetch(`${base}/api/builder/state`, {
        headers: { Authorization: `Bearer ${viewerSession.token}` },
      });
      expect(revokedViewerCall.status).toBe(401);

      const revokedEditorCall = await fetch(`${base}/api/builder/state`, {
        headers: { Authorization: `Bearer ${editorSession.token}` },
      });
      expect(revokedEditorCall.status).toBe(401);
    } finally {
      server.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('Phase 2 — Gemini Service Centralization, Bounded Retries & Authorized Omni Tools', () => {
  it('executes authorized function calls preserving candidate thoughtSignature and functionResponse.id', async () => {
    const capturedCalls: Array<{
      model: string;
      contents: unknown[];
    }> = [];

    const mockClient: GeminiClientLike = {
      models: {
        generateContent: async (params) => {
          capturedCalls.push({ model: params.model, contents: params.contents });
          if (capturedCalls.length === 1) {
            return {
              functionCalls: [
                {
                  id: 'call-det-1',
                  name: 'run_linear_algebra_op',
                  args: {
                    operation: 'determinant',
                    matrixA: [
                      [3, 1],
                      [2, 4],
                    ],
                  },
                },
              ],
              candidates: [
                {
                  content: {
                    role: 'model',
                    parts: [
                      {
                        thought: true,
                        thoughtSignature: 'sig-opaque-test-token',
                        functionCall: {
                          id: 'call-det-1',
                          name: 'run_linear_algebra_op',
                          args: {
                            operation: 'determinant',
                            matrixA: [
                              [3, 1],
                              [2, 4],
                            ],
                          },
                        },
                      } as unknown as Record<string, unknown>,
                    ],
                  },
                },
              ],
            };
          }
          return {
            text: 'El determinante exacto de la matriz 2×2 es det(A) = 10.',
          };
        },
      },
    };

    const result = await runGeminiOmniChat({
      aiClient: mockClient,
      history: [{ role: 'user', text: 'Calcula el determinante de [[3,1],[2,4]]' }],
      workspaceContext: { activeModule: 'omni-bot', alphanumericTrained: false },
      contextSummaryText: 'Módulo omni-bot',
      retryDelayMs: 0,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.model).toBe(PRIMARY_GEMINI_MODEL);
      expect(result.provider).toBe('gemini');
      expect(result.fallbackModelUsed).toBe(false);
      expect(result.toolTrace).toHaveLength(1);
      expect(result.toolTrace[0].tool).toBe('run_linear_algebra_op');
      expect(result.toolTrace[0].status).toBe('ok');
      expect(result.toolTrace[0].resultSummary).toContain('10');
    }

    // Second Gemini call must include preserved model candidateContent + functionResponse with matching id
    expect(capturedCalls).toHaveLength(2);
    const secondContents = capturedCalls[1].contents as Array<{
      role?: string;
      parts?: Array<Record<string, unknown>>;
    }>;
    expect(secondContents).toHaveLength(3);
    expect(
      (secondContents[1].parts?.[0] as { thoughtSignature?: string })?.thoughtSignature
    ).toBe('sig-opaque-test-token');
    expect(
      (secondContents[2].parts?.[0]?.functionResponse as { id?: string; response?: { result?: number } })?.id
    ).toBe('call-det-1');
    expect(
      (secondContents[2].parts?.[0]?.functionResponse as { response?: { result?: number } })?.response?.result
    ).toBe(10);
  });

  it('handles 503/429 upstream errors with bounded retries and switches cleanly to fallback model', async () => {
    const modelsCalled: string[] = [];
    const mockClient: GeminiClientLike = {
      models: {
        generateContent: async (params) => {
          modelsCalled.push(params.model);
          if (params.model === PRIMARY_GEMINI_MODEL) {
            const err = new Error('503 Service Unavailable') as Error & { status?: number };
            err.status = 503;
            throw err;
          }
          return {
            text: 'Respuesta generada correctamente mediante modelo de respaldo.',
          };
        },
      },
    };

    const result = await runGeminiOmniChat({
      aiClient: mockClient,
      history: [{ role: 'user', text: 'Explica Softmax' }],
      workspaceContext: { activeModule: 'classifier' },
      contextSummaryText: 'Módulo classifier',
      retryDelayMs: 0,
      maxRetriesPerModel: 1,
    });

    expect(result.ok).toBe(true);
    // 2 bounded attempts on primary (initial + 1 retry), then 1 success on fallback
    expect(modelsCalled).toEqual([
      PRIMARY_GEMINI_MODEL,
      PRIMARY_GEMINI_MODEL,
      FALLBACK_GEMINI_MODEL,
    ]);
    if (result.ok) {
      expect(result.model).toBe(FALLBACK_GEMINI_MODEL);
      expect(result.fallbackModelUsed).toBe(true);
    }
  });

  it('rejects unauthorized tool execution and verifies tool whitelist integrity', () => {
    expect(AUTHORIZED_OMNI_TOOL_NAMES.has('run_linear_algebra_op')).toBe(true);
    expect(AUTHORIZED_OMNI_TOOL_NAMES.has('inspect_studio_workspace')).toBe(true);

    const blocked = executeAuthorizedOmniTool('exec_shell_command', { cmd: 'ls' }, {});
    expect(blocked.trace.status).toBe('error');
    expect(blocked.response.error).toContain('no autorizada');
  });

  it('redacts leaked API keys/tokens and classifies 401/403 vs 404/network errors cleanly', async () => {
    const fakeKey = ['AIza', 'SyDummySecretValue1234567890'].join('');
    const dirtyError = new Error(
      `403 PERMISSION_DENIED for https://generativelanguage.googleapis.com?key=${fakeKey}`
    );
    const sanitized = sanitizeGeminiErrorText(dirtyError.message);
    expect(sanitized).not.toContain(fakeKey);
    expect(sanitized).toContain('[REDACTED]');

    const authErr = classifyGeminiError(dirtyError);
    expect(authErr.code).toBe('INVALID_API_KEY');
    expect(authErr.retryable).toBe(false);
    expect(authErr.tryFallbackModel).toBe(false);

    // Auth failure (403) MUST stop immediately without retrying or falling back
    let callsOnAuthFail = 0;
    const authFailClient: GeminiClientLike = {
      models: {
        generateContent: async () => {
          callsOnAuthFail += 1;
          const err = new Error('PERMISSION_DENIED API_KEY_INVALID') as Error & { status?: number };
          err.status = 403;
          throw err;
        },
      },
    };
    const authFailRes = await runGeminiOmniChat({
      aiClient: authFailClient,
      history: [{ role: 'user', text: 'Hola' }],
      workspaceContext: {},
      contextSummaryText: 'test',
      retryDelayMs: 0,
      maxRetriesPerModel: 2,
    });
    expect(authFailRes.ok).toBe(false);
    expect(callsOnAuthFail).toBe(1);
    if (!authFailRes.ok) {
      expect(authFailRes.code).toBe('INVALID_API_KEY');
      expect(authFailRes.retryable).toBe(false);
    }

    // 404 MODEL_NOT_FOUND skips retrying broken primary model and immediately uses fallbackModel
    const notFoundCalls: string[] = [];
    const fallbackClient: GeminiClientLike = {
      models: {
        generateContent: async (params) => {
          notFoundCalls.push(params.model);
          if (params.model === PRIMARY_GEMINI_MODEL) {
            const err = new Error('404 NOT_FOUND') as Error & { status?: number };
            err.status = 404;
            throw err;
          }
          return { text: 'Respaldo exitoso tras 404.' };
        },
      },
    };
    const notFoundRes = await runGeminiOmniChat({
      aiClient: fallbackClient,
      history: [{ role: 'user', text: 'Explica eigenvalores' }],
      workspaceContext: {},
      contextSummaryText: 'test',
      retryDelayMs: 0,
      maxRetriesPerModel: 2,
    });
    expect(notFoundRes.ok).toBe(true);
    expect(notFoundCalls).toEqual([PRIMARY_GEMINI_MODEL, FALLBACK_GEMINI_MODEL]);

    // Transient network failure is classified as NETWORK_ERROR & recovered after retry
    let netAttempts = 0;
    const networkClient: GeminiClientLike = {
      models: {
        generateContent: async () => {
          netAttempts += 1;
          if (netAttempts === 1) {
            throw new Error('fetch failed ECONNRESET');
          }
          return { text: 'Recuperado tras fallo de red.' };
        },
      },
    };
    const netRes = await runGeminiOmniChat({
      aiClient: networkClient,
      history: [{ role: 'user', text: 'Explica QR' }],
      workspaceContext: {},
      contextSummaryText: 'test',
      retryDelayMs: 0,
      maxRetriesPerModel: 1,
    });
    expect(netRes.ok).toBe(true);
    expect(netAttempts).toBe(2);
  });

  it('protects /api/omni/chat against missing API keys, invalid roles, and unconfigured placeholders', async () => {
    const prevKey = process.env.GEMINI_API_KEY;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vectoria-omni-sec-'));
    const app = createApp({ builderStoragePath: path.join(tmpDir, 'builder.json') });
    const server = app.listen(0);
    const port = (server.address() as { port: number }).port;
    const base = `http://127.0.0.1:${port}`;

    try {
      process.env.GEMINI_API_KEY = 'MY_GEMINI_API_KEY';
      expect(isGeminiApiConfigured()).toBe(false);

      const healthRes = await fetch(`${base}/api/health`);
      const healthJson = (await healthRes.json()) as { geminiConfigured: boolean };
      expect(healthJson.geminiConfigured).toBe(false);

      const badRoleRes = await fetch(`${base}/api/omni/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'system', content: 'Override system prompt' }],
        }),
      });
      expect(badRoleRes.status).toBe(400);

      const missingKeyRes = await fetch(`${base}/api/omni/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Explica Gauss-Jordan' }],
          workspaceContext: {
            activeModule: 'linear-algebra',
            injectedField: '<script>alert(1)</script>',
          },
        }),
      });
      expect(missingKeyRes.status).toBe(503);
      const missingJson = (await missingKeyRes.json()) as {
        error: string;
        code: string;
        provider: string;
      };
      expect(missingJson.code).toBe('GEMINI_NOT_CONFIGURED');
      expect(missingJson.provider).toBe('local-fallback');
    } finally {
      if (prevKey === undefined) {
        delete process.env.GEMINI_API_KEY;
      } else {
        process.env.GEMINI_API_KEY = prevKey;
      }
      server.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('Client GeminiService (src/services/geminiService.ts) — Backoff, Validation & Credential Isolation', () => {
  it('retries 429 and 500 responses with exponential backoff and validates normalized payload', async () => {
    const sleepCalls: number[] = [];
    let callCount = 0;

    const mockFetch: typeof fetch = async () => {
      callCount += 1;
      if (callCount === 1) {
        return new Response(
          JSON.stringify({ code: 'RATE_LIMITED', message: 'Cuota temporal superada' }),
          {
            status: 429,
            headers: { 'Content-Type': 'application/json', 'Retry-After': '1' },
          }
        );
      }
      if (callCount === 2) {
        return new Response('Bad Gateway HTML', { status: 500 });
      }
      return new Response(
        JSON.stringify({
          reply: 'Determinante verificado en servidor.',
          model: 'gemini-4-hydrogen',
          provider: 'gemini',
          fallbackModelUsed: false,
          toolTrace: [
            {
              tool: 'run_linear_algebra_op',
              status: 'ok',
              argsSummary: 'det(2×2)',
              resultSummary: 'det(A) = 10',
              durationMs: 1.2,
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const service = new GeminiService({
      fetchImpl: mockFetch,
      maxRetries: 2,
      baseDelayMs: 200,
      maxDelayMs: 2_000,
      sleepImpl: async (ms) => {
        sleepCalls.push(ms);
      },
    });

    const result = await service.chat({
      messages: [{ role: 'user', content: 'Calcula el determinante' }],
    });

    expect(callCount).toBe(3);
    expect(result.attempts).toBe(3);
    expect(result.reply).toBe('Determinante verificado en servidor.');
    expect(result.toolTrace).toHaveLength(1);
    expect(sleepCalls).toHaveLength(2);
    // First retry honors Retry-After: 1s (>= 1000ms), second uses exponential backoff (>= 400ms)
    expect(sleepCalls[0]).toBeGreaterThanOrEqual(1000);
    expect(sleepCalls[1]).toBeGreaterThanOrEqual(400);
  });

  it('validates upstream JSON responses and maps timeouts / non-retryable 400 cleanly', async () => {
    // 1. Empty reply in HTTP 200 -> INVALID_RESPONSE (retried, then fails cleanly)
    let malformedCalls = 0;
    const malformedService = new GeminiService({
      maxRetries: 1,
      baseDelayMs: 0,
      sleepImpl: async () => {},
      fetchImpl: async () => {
        malformedCalls += 1;
        return new Response(JSON.stringify({ reply: '   ', model: 'gemini-4-hydrogen' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    });

    await expect(
      malformedService.chat({ messages: [{ role: 'user', content: 'Hola' }] })
    ).rejects.toMatchObject({
      name: 'GeminiServiceError',
      code: 'INVALID_RESPONSE',
      status: 502,
      attempts: 2,
    });
    expect(malformedCalls).toBe(2);

    // 2. Client timeout -> TIMEOUT (504)
    const timeoutService = new GeminiService({
      timeoutMs: 250,
      maxRetries: 0,
      fetchImpl: (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }),
    });

    await expect(
      timeoutService.chat({ messages: [{ role: 'user', content: 'Prueba timeout' }] })
    ).rejects.toMatchObject({
      code: 'TIMEOUT',
      status: 504,
      retryable: true,
    });

    // 3. Invalid empty message validation rejects before network call
    let shouldNotBeCalled = false;
    const guardService = new GeminiService({
      fetchImpl: async () => {
        shouldNotBeCalled = true;
        return new Response('{}', { status: 200 });
      },
    });
    await expect(
      guardService.chat({ messages: [{ role: 'user', content: '   ' }] })
    ).rejects.toBeInstanceOf(GeminiServiceError);
    expect(shouldNotBeCalled).toBe(false);
  });

  it('never imports @google/genai, never embeds API keys in src/services/geminiService.ts, and redacts credentials', () => {
    const clientServicePath = path.join(process.cwd(), 'src', 'services', 'geminiService.ts');
    const source = fs.readFileSync(clientServicePath, 'utf-8');
    expect(source).not.toMatch(/from\s+['"]@google\/genai['"]/);
    expect(source).not.toContain('process.env');
    expect(source).not.toContain('import.meta.env');
    expect(source).not.toContain('generativelanguage.googleapis.com');

    const dummySecret = ['AIza', 'SyUnitTestDummySecret987654321'].join('');
    const scrubbed = sanitizeGeminiClientMessage(`Error Upstream key=${dummySecret}`);
    expect(scrubbed).not.toContain(dummySecret);
    expect(scrubbed).toContain('[REDACTED_KEY]');
  });

  it('reports retry warnings, final network/API errors, and availability failures through logEvent', async () => {
    const logged: Array<{
      category: string;
      title: string;
      detail: string;
      status?: string;
    }> = [];
    const logEvent = (
      category: 'math' | 'neural' | 'simulation' | 'omni' | 'system',
      title: string,
      detail: string,
      status?: 'ok' | 'warn' | 'error'
    ) => {
      logged.push({ category, title, detail, status });
    };

    const dummyKey = ['AIza', 'SyUnitTestLeakCheck1234567890'].join('');
    let calls = 0;
    const failingService = new GeminiService({
      maxRetries: 1,
      baseDelayMs: 0,
      sleepImpl: async () => {},
      logEvent,
      fetchImpl: async () => {
        calls += 1;
        if (calls === 1) {
          return new Response(
            JSON.stringify({ code: 'RATE_LIMITED', message: `Cuota agotada key=${dummyKey}` }),
            { status: 429, headers: { 'Content-Type': 'application/json' } }
          );
        }
        throw new Error(`ECONNRESET socket hang up key=${dummyKey}`);
      },
    });

    await expect(
      failingService.chat({ messages: [{ role: 'user', content: 'Hola' }] })
    ).rejects.toMatchObject({ code: 'NETWORK_ERROR', attempts: 2 });

    expect(logged).toHaveLength(2);
    expect(logged[0]).toMatchObject({ category: 'omni', status: 'warn' });
    expect(logged[0].title).toContain('RATE_LIMITED');
    expect(logged[0].detail).not.toContain(dummyKey);
    expect(logged[1]).toMatchObject({ category: 'omni', status: 'error' });
    expect(logged[1].title).toContain('NETWORK_ERROR');
    expect(logged[1].detail).not.toContain(dummyKey);

    // Health check failure also writes an auditable omni error event
    const badHealth = await failingService.checkAvailability();
    expect(badHealth.available).toBe(false);
    expect(logged).toHaveLength(3);
    expect(logged[2]).toMatchObject({ category: 'omni', status: 'error' });
  });

  it('enforces strict production CSP without unsafe-inline/eval, scopes /api/diagnostics, validates login roles, and protects unknown /api/* routes', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vectoria-sec-phase1-'));
    const prevNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const app = createApp({
      builderStoragePath: path.join(tmpDir, 'builder.json'),
      setupToken: 'phase1-audit-token-1234',
      startBackupTimer: false,
    });
    const server = app.listen(0);
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 3029;
    const base = `http://127.0.0.1:${port}`;

    try {
      // 1. Initialize admin so we can verify public vs admin diagnostics
      const setupRes = await fetch(`${base}/api/builder/auth/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setupToken: 'phase1-audit-token-1234',
          adminPasscode: 'AdminPhase1#2026',
        }),
      });
      expect(setupRes.status).toBe(201);
      const { token: adminToken } = (await setupRes.json()) as { token: string };

      // 2. Unknown role on login is rejected with 400 (never silently coerced to admin)
      const badRoleLogin = await fetch(`${base}/api/builder/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: 'AdminPhase1#2026', role: 'superadmin' }),
      });
      expect(badRoleLogin.status).toBe(400);

      // 3. Unknown /api/* route returns 404 JSON (never HTML) and production CSP omits unsafe-inline/eval
      const notFoundApi = await fetch(`${base}/api/nonexistent-route`);
      expect(notFoundApi.status).toBe(404);
      const notFoundJson = (await notFoundApi.json()) as { error?: string };
      expect(notFoundJson.error).toBe('API_ROUTE_NOT_FOUND');
      const csp = notFoundApi.headers.get('content-security-policy') ?? '';
      const scriptSrcPart = csp.split(';').find((d) => d.trim().startsWith('script-src')) ?? '';
      expect(scriptSrcPart).toContain("script-src 'self'");
      expect(scriptSrcPart).not.toContain("'unsafe-inline'");
      expect(csp).not.toContain("'unsafe-eval'");
      expect(csp).toContain("object-src 'none'");

      // 4. CORS rejects arbitrary .run.app domain while allowing legitimate AI Studio origin
      const evilRunApp = await fetch(`${base}/api/health`, {
        headers: { Origin: 'https://attacker.run.app' },
      });
      expect(evilRunApp.status).toBe(403);

      const allowedRunApp = await fetch(`${base}/api/health`, {
        headers: { Origin: 'https://ais-dev-demo-1234.us-east1.run.app' },
      });
      expect(allowedRunApp.status).toBe(200);
      expect(allowedRunApp.headers.get('access-control-allow-origin')).toBe(
        'https://ais-dev-demo-1234.us-east1.run.app'
      );

      // 5. Trigger a 400 error so recentErrors is populated, then check public vs admin /api/diagnostics
      await fetch(`${base}/api/verify-math`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: 'determinant', matrixA: 'invalid' }),
      });

      const pubDiag = (await (await fetch(`${base}/api/diagnostics`)).json()) as {
        diagnosticsScope: string;
        nodeVersion: string;
        recentErrors: unknown[];
        recentErrorCount: number;
      };
      expect(pubDiag.diagnosticsScope).toBe('public-summary');
      expect(pubDiag.nodeVersion).toBe('Node.js LTS');
      expect(pubDiag.recentErrors).toEqual([]);
      expect(pubDiag.recentErrorCount).toBeGreaterThanOrEqual(1);

      const adminDiag = (await (
        await fetch(`${base}/api/diagnostics`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        })
      ).json()) as {
        diagnosticsScope: string;
        nodeVersion: string;
        recentErrors: unknown[];
      };
      expect(adminDiag.diagnosticsScope).toBe('admin-full');
      expect(adminDiag.nodeVersion).toBe(process.version);
      expect(adminDiag.recentErrors.length).toBeGreaterThanOrEqual(1);

      // 6. index.html loads external /theme-init.js without inline <script>
      const indexHtml = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf-8');
      expect(indexHtml).toContain('src="/theme-init.js"');
      expect(indexHtml).not.toMatch(/<script>\s*\(function/);
    } finally {
      process.env.NODE_ENV = prevNodeEnv;
      server.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('completes 3 multi-step Gemini tool rounds and produces final text synthesis on round 4', async () => {
    let callIdx = 0;
    const mockClient: GeminiClientLike = {
      models: {
        generateContent: async () => {
          callIdx += 1;
          if (callIdx <= 3) {
            return {
              functionCalls: [
                {
                  id: `fc-${callIdx}`,
                  name: 'inspect_studio_workspace',
                  args: { focus: 'all' },
                },
              ],
            };
          }
          return { text: 'Síntesis final verificada tras 3 herramientas.' };
        },
      },
    };

    const res = await runGeminiOmniChat({
      aiClient: mockClient,
      history: [{ role: 'user', text: 'Audita el estudio paso a paso' }],
      workspaceContext: { activeModule: 'dashboard' },
      contextSummaryText: '{"activeModule":"dashboard"}',
      retryDelayMs: 0,
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.toolTrace).toHaveLength(3);
      expect(res.reply).toContain('Síntesis final verificada');
    }
  });
});
