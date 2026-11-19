import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Download,
  Gauge,
  Lock,
  Package,
  Play,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { rasterizeGlyph } from '../engines/alphanumericDataset';
import {
  analyzeLinearIndependence,
  computeEigen,
  matrixDeterminant,
  matrixInverse,
  matrixLU,
  matrixMultiply,
  matrixQR,
  matrixRank,
  matrixTranspose,
  solveLinearSystem,
} from '../engines/linearAlgebra';
import { VerificationSuiteResult } from '../types/vectoria';
import {
  sanitizeUserText,
  validateBackupUpload,
  VECTORIA_VERSION,
} from '../utils/backupVersioning';

interface ServerDiagnosticsSnapshot {
  status: string;
  startedAt: string;
  uptimeSec: number;
  nodeVersion: string;
  memoryMb: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
  };
  traffic: {
    totalRequests: number;
    apiRequests: number;
    rateLimitedCount: number;
    avgLatencyMs: number;
    p95LatencyMs: number;
  };
  mathCache: {
    entries: number;
    limit: number;
    hits: number;
    misses: number;
  };
  security: {
    cspEnabled: boolean;
    corsAllowlistActive: boolean;
    rateLimiterActive: boolean;
    apiKeyIsolatedServerSide: boolean;
  };
  recentErrors: Array<{
    timestamp: string;
    route: string;
    status: number;
    message: string;
  }>;
}

interface BenchmarkMetrics {
  matMul28Ms: number;
  mlp100ForwardMs: number;
  rafAvgFrameMs: number;
  rafFps: number;
  heapMb: string;
  measuredAt: string;
}

function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const VerificationView: React.FC = () => {
  const {
    suiteRef,
    digitsSummary,
    lettersSummary,
    alphanumericSummary,
    mnist784Result,
    systemEvents,
    logEvent,
  } = useStudio();

  const [results, setResults] = useState<VerificationSuiteResult[]>([]);
  const [benchmarkInfo, setBenchmarkInfo] = useState<BenchmarkMetrics | null>(null);
  const [isBenchmarking, setIsBenchmarking] = useState(false);

  const [diagnostics, setDiagnostics] = useState<ServerDiagnosticsSnapshot | null>(null);
  const [healthInfo, setHealthInfo] = useState<{
    geminiConfigured: boolean;
    roundTripMs: number;
    checkedAt: string;
  } | null>(null);
  const [diagError, setDiagError] = useState<string | null>(null);
  const [loadingDiag, setLoadingDiag] = useState(false);

  const fetchDiagnostics = useCallback(async () => {
    setLoadingDiag(true);
    setDiagError(null);
    const t0 = performance.now();
    try {
      const [diagRes, healthRes] = await Promise.all([
        fetch('/api/diagnostics', { cache: 'no-store' }),
        fetch('/api/health', { cache: 'no-store' }),
      ]);
      const roundTripMs = Number((performance.now() - t0).toFixed(1));
      if (!diagRes.ok || !healthRes.ok) {
        throw new Error(`HTTP ${diagRes.status} / ${healthRes.status}`);
      }
      const diagJson = (await diagRes.json()) as ServerDiagnosticsSnapshot;
      const healthJson = (await healthRes.json()) as { geminiConfigured: boolean };
      setDiagnostics(diagJson);
      setHealthInfo({
        geminiConfigured: Boolean(healthJson.geminiConfigured),
        roundTripMs,
        checkedAt: new Date().toLocaleTimeString(),
      });
    } catch (err) {
      setDiagError(
        err instanceof Error ? err.message : 'No fue posible consultar /api/diagnostics'
      );
    } finally {
      setLoadingDiag(false);
    }
  }, []);

  useEffect(() => {
    void fetchDiagnostics();
    const timer = window.setInterval(() => {
      void fetchDiagnostics();
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [fetchDiagnostics]);

  const runSuite = () => {
    const suite = suiteRef.current;
    const checks: VerificationSuiteResult[] = [];

    const runCheck = (
      id: string,
      name: string,
      category: VerificationSuiteResult['category'],
      fn: () => { passed: boolean; details: string; metric: string }
    ) => {
      const t0 = performance.now();
      try {
        const res = fn();
        checks.push({
          id,
          name,
          category,
          passed: res.passed,
          details: res.details,
          metric: res.metric,
          durationMs: Number((performance.now() - t0).toFixed(2)),
        });
      } catch (err) {
        checks.push({
          id,
          name,
          category,
          passed: false,
          details: err instanceof Error ? err.message : 'Excepción inesperada',
          metric: 'Error',
          durationMs: Number((performance.now() - t0).toFixed(2)),
        });
      }
    };

    runCheck('det-id', 'Identidad det(A) = det(Aᵀ) en 3×3', 'linear-algebra', () => {
      const out = matrixDeterminant([
        [3, 1, 2],
        [0, 4, -1],
        [2, 1, 5],
      ]);
      return {
        passed: out.verification.passed && Math.abs(out.result - 45) < 1e-8,
        details: out.verification.statement,
        metric: `det = ${out.result}`,
      };
    });

    runCheck('inv-res', 'Inversa por Gauss-Jordan ||A·A⁻¹ - I||_F', 'linear-algebra', () => {
      const out = matrixInverse([
        [4, 7],
        [2, 6],
      ]);
      return {
        passed: out.verification.passed,
        details: out.verification.statement,
        metric: `residuo = ${out.verification.residual.toExponential(2)}`,
      };
    });

    runCheck('trans-inv', 'Involutiva de Transpuesta ||(Aᵀ)ᵀ - A||_F', 'linear-algebra', () => {
      const out = matrixTranspose([
        [1, 2, 3],
        [4, 5, 6],
      ]);
      return {
        passed: out.verification.passed,
        details: out.verification.statement,
        metric: `residuo = ${out.verification.residual.toExponential(2)}`,
      };
    });

    runCheck('rank-null', 'Rango + Nulidad = n en matriz 3×3 singular', 'linear-algebra', () => {
      const out = matrixRank([
        [1, 2, 3],
        [2, 4, 6],
        [1, 1, 2],
      ]);
      return {
        passed: out.verification.passed && out.result.rank === 2,
        details: out.verification.statement,
        metric: `rank = ${out.result.rank}, null = ${out.result.nullity}`,
      };
    });

    runCheck('lu-res', 'Descomposición ||PA - LU||_F', 'linear-algebra', () => {
      const out = matrixLU([
        [2, 1, 1],
        [4, -6, 0],
        [-2, 7, 2],
      ]);
      return {
        passed: out.verification.passed,
        details: out.verification.statement,
        metric: `residuo = ${out.verification.residual.toExponential(2)}`,
      };
    });

    runCheck('qr-ortho', 'Factorización QR: ||A - QR||_F y ||QᵀQ - I||_F', 'linear-algebra', () => {
      const out = matrixQR([
        [2, 1, 1],
        [4, -6, 0],
        [-2, 7, 2],
      ]);
      return {
        passed: out.verification.passed,
        details: out.verification.statement,
        metric: `residuo = ${out.verification.residual.toExponential(2)}`,
      };
    });

    runCheck('sys-res', 'Sistema lineal Gauss-Jordan ||Ax - b||₂', 'linear-algebra', () => {
      const out = solveLinearSystem(
        [
          [2, 1, -1],
          [-3, -1, 2],
          [-2, 1, 2],
        ],
        [8, -11, -3],
        'gauss-jordan'
      );
      return {
        passed: out.verification.passed && out.result.status === 'unique',
        details: out.verification.statement,
        metric: `x = [${out.result.solution?.map((n) => n.toFixed(2)).join(', ')}]`,
      };
    });

    runCheck('indep-rank', 'Teorema Rango-Nulidad en subespacio ℝ³', 'linear-algebra', () => {
      const out = analyzeLinearIndependence([
        [1, 0, 2],
        [0, 1, -1],
        [1, 1, 1],
      ]);
      return {
        passed: out.verification.passed && !out.result.isLinearlyIndependent,
        details: out.verification.statement,
        metric: `rango = ${out.result.rank}, nulidad = ${out.result.nullity}`,
      };
    });

    runCheck('eigen-res', 'Ecuación propia ||Av - λv||₂', 'linear-algebra', () => {
      const out = computeEigen([
        [4, 1],
        [2, 3],
      ]);
      return {
        passed: out.verification.passed && out.result.pairs.length === 2,
        details: out.verification.statement,
        metric: `λ = [${out.result.pairs.map((p) => p.eigenvalue.toFixed(2)).join(', ')}]`,
      };
    });

    runCheck('softmax-sum', 'Conservación de probabilidad Softmax Σ pᵢ = 1', 'neural-engine', () => {
      const fwd = suite.digitsModel.forward(rasterizeGlyph('7'));
      const sum = fwd.probs.reduce((a, b) => a + b, 0);
      const err = Math.abs(sum - 1);
      return {
        passed: err < 1e-9,
        details: `Suma de probabilidades de salida en modelo 0–9: ${sum.toFixed(10)}`,
        metric: `Δ = ${err.toExponential(2)}`,
      };
    });

    runCheck(
      'grad-check',
      'Verificación de gradiente analítico vs diferencias finitas',
      'neural-engine',
      () => {
        const chk = suite.digitsModel.checkNumericalGradient({
          input: rasterizeGlyph('5'),
          label: '5',
          labelIndex: 5,
        });
        return {
          passed: chk.passed,
          details: `${chk.checkedWeights} pesos verificados mediante (L(w+ε)-L(w-ε))/(2ε).`,
          metric: `err_rel = ${chk.maxRelError.toExponential(2)}`,
        };
      }
    );

    runCheck('alpha-gate', 'Estado real de modelo combinado (36 clases)', 'classifier', () => {
      const trained = alphanumericSummary.isTrained;
      return {
        passed: trained,
        details: trained
          ? `Modelo de 36 clases entrenado (${alphanumericSummary.epochsTrained} épocas, val ${(alphanumericSummary.valAccuracy * 100).toFixed(1)}%).`
          : 'Modelo de 36 clases aún no entrenado; compuerta de seguridad activa.',
        metric: trained ? 'Entrenado (Activo)' : 'Bloqueado',
      };
    });

    runCheck('sec-nan', 'Rechazo estricto de entradas NaN / Infinity', 'security', () => {
      let rejected = false;
      try {
        matrixDeterminant([
          [1, Number.NaN],
          [0, 1],
        ]);
      } catch {
        rejected = true;
      }
      return {
        passed: rejected,
        details: rejected
          ? 'El motor de álgebra lineal rechazó matrices con valores NaN/no finitos antes de operar.'
          : 'No se rechazó entrada no finita.',
        metric: rejected ? 'Bloqueado (OK)' : 'Fallo',
      };
    });

    runCheck('sec-dim', 'Validación dimensional estricta en matrices y tensores', 'security', () => {
      let rejectedMat = false;
      let rejectedMlp = false;
      try {
        matrixMultiply([[1, 2]], [[1, 2]]);
      } catch {
        rejectedMat = true;
      }
      try {
        suite.digitsModel.forward([1, 2, 3]);
      } catch {
        rejectedMlp = true;
      }
      return {
        passed: rejectedMat && rejectedMlp,
        details:
          'Dimensiones incompatibles en multiplicación matricial y longitud != 256 en MLP lanzan excepción controlada.',
        metric: rejectedMat && rejectedMlp ? '2/2 Validadas' : 'Fallo',
      };
    });

    runCheck('sec-keys', 'Ausencia de secretos API en localStorage y bundle Vite', 'security', () => {
      let leakedInStorage = false;
      try {
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i) || '';
          const v = window.localStorage.getItem(k) || '';
          if (/AIza[0-9A-Za-z\-_]{20,}|GEMINI_API_KEY/i.test(k + v)) {
            leakedInStorage = true;
          }
        }
      } catch {
        // Ignore restricted storage
      }
      const envKeys = Object.keys((import.meta as unknown as { env?: Record<string, unknown> }).env || {});
      const leakedEnv = envKeys.some((k) => /GEMINI_API_KEY|SECRET|PRIVATE/i.test(k));
      const clean = !leakedInStorage && !leakedEnv;
      return {
        passed: clean,
        details: clean
          ? 'Cero claves API detectadas en localStorage o variables cliente import.meta.env.'
          : 'Se detectó una clave potencialmente expuesta en el cliente.',
        metric: clean ? 'Aislado (OK)' : 'Alerta',
      };
    });

    runCheck('sec-xss-backup', 'Sanitización XSS y validación de archivo respaldo (.json)', 'security', () => {
      const cleaned = sanitizeUserText('<script>alert(1)</script> Investigador  ');
      const rejectExt = validateBackupUpload('respaldo.txt', 100, '{}');
      const rejectSecret = validateBackupUpload(
        'ok.json',
        100,
        JSON.stringify({ secret: 'AIzaSyTestFakeKeyValue123456789012345' })
      );
      const passed =
        !cleaned.includes('<') &&
        !cleaned.includes('>') &&
        !rejectExt.valid &&
        !rejectSecret.valid;
      return {
        passed,
        details:
          'Etiquetas HTML neutralizadas en texto de usuario; archivos no .json o con patrones de clave son rechazados.',
        metric: passed ? '3/3 Reglas OK' : 'Fallo',
      };
    });

    setResults(checks);
    const passed = checks.filter((c) => c.passed).length;
    logEvent(
      'system',
      `Suite de verificación y seguridad ejecutada (${passed}/${checks.length})`,
      `Invariantes matemáticos, gradientes, validación dimensional y aislamiento verificados`,
      passed === checks.length ? 'ok' : 'warn'
    );
  };

  const runBenchmark = async () => {
    setIsBenchmarking(true);
    try {
      const n = 28;
      const A = Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (__, j) => ((i + j) % 5) * 0.5 + 1)
      );
      const t0 = performance.now();
      matrixMultiply(A, A);
      const matMul28Ms = Number((performance.now() - t0).toFixed(2));

      const sample = rasterizeGlyph('3');
      const t1 = performance.now();
      for (let i = 0; i < 100; i++) {
        suiteRef.current.digitsModel.forward(sample);
      }
      const mlp100ForwardMs = Number((performance.now() - t1).toFixed(2));

      // Real 10-frame requestAnimationFrame timing measurement
      const frameDeltas: number[] = [];
      await new Promise<void>((resolve) => {
        let count = 0;
        let lastTs = performance.now();
        const step = (ts: number) => {
          if (count > 0) {
            frameDeltas.push(Math.max(0.1, ts - lastTs));
          }
          lastTs = ts;
          count += 1;
          if (count <= 10) {
            window.requestAnimationFrame(step);
          } else {
            resolve();
          }
        };
        window.requestAnimationFrame(step);
      });

      const rafAvgFrameMs =
        frameDeltas.length > 0
          ? Number((frameDeltas.reduce((a, b) => a + b, 0) / frameDeltas.length).toFixed(2))
          : 16.7;
      const rafFps = Number(Math.min(240, 1000 / Math.max(1, rafAvgFrameMs)).toFixed(1));

      const perfMem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
      const heapMb = perfMem
        ? `${(perfMem.usedJSHeapSize / (1024 * 1024)).toFixed(1)} MB`
        : 'No expuesto por navegador';

      setBenchmarkInfo({
        matMul28Ms,
        mlp100ForwardMs,
        rafAvgFrameMs,
        rafFps,
        heapMb,
        measuredAt: new Date().toLocaleTimeString(),
      });
      logEvent(
        'system',
        'Benchmark real de rendimiento ejecutado',
        `MatMul 28×28: ${matMul28Ms} ms · 100 MLP: ${mlp100ForwardMs} ms · rAF: ${rafFps} FPS (${rafAvgFrameMs} ms/frame)`
      );
    } finally {
      setIsBenchmarking(false);
    }
  };

  const exportAuditReport = (format: 'md' | 'json') => {
    const passed = results.filter((r) => r.passed).length;
    const payload = {
      app: 'VectorIA Studio',
      version: VECTORIA_VERSION,
      generatedAt: new Date().toISOString(),
      diagnostics,
      clientHealthRoundTripMs: healthInfo?.roundTripMs ?? null,
      benchmarkInfo,
      verificationSummary: {
        executed: results.length,
        passed,
        checks: results,
      },
      models: {
        digitsValAcc: digitsSummary.valAccuracy,
        lettersValAcc: lettersSummary.valAccuracy,
        alphanumericValAcc: alphanumericSummary.valAccuracy,
        mnist784LastDigit: mnist784Result?.digit ?? null,
      },
      knownLimitations: [
        'Las dependencias usan bun.lock en este entorno; npm audit sin package-lock devuelve ENOLOCK.',
        'La memoria JS Heap del navegador solo se muestra en navegadores Chromium que exponen performance.memory.',
        'Los controles de seguridad implementados (CSP, CORS allowlist, rate limiting, sanitización y validación acotada) reducen superficie de ataque pero no constituyen una certificación externa formal.',
      ],
    };

    if (format === 'json') {
      downloadBlob(
        `vectoria_audit_${VECTORIA_VERSION}.json`,
        JSON.stringify(payload, null, 2),
        'application/json'
      );
      return;
    }

    const md = [
      `# Informe de Auditoría Técnica, Seguridad y Rendimiento — VectorIA Studio v${VECTORIA_VERSION}`,
      `Generado: ${payload.generatedAt}`,
      '',
      '## 1. Diagnóstico del Servidor en Vivo (`/api/diagnostics`)',
      diagnostics
        ? [
            `- Estado: ${diagnostics.status} (Node ${diagnostics.nodeVersion}, uptime ${diagnostics.uptimeSec}s)`,
            `- Memoria proceso: RSS ${diagnostics.memoryMb.rss} MB · Heap ${diagnostics.memoryMb.heapUsed}/${diagnostics.memoryMb.heapTotal} MB`,
            `- Tráfico API: ${diagnostics.traffic.apiRequests} peticiones · Promedio ${diagnostics.traffic.avgLatencyMs} ms · p95 ${diagnostics.traffic.p95LatencyMs} ms · Limitadas (429): ${diagnostics.traffic.rateLimitedCount}`,
            `- Caché /api/verify-math: ${diagnostics.mathCache.entries}/${diagnostics.mathCache.limit} entradas (hits: ${diagnostics.mathCache.hits}, misses: ${diagnostics.mathCache.misses})`,
            `- Round-trip cliente medido: ${healthInfo?.roundTripMs ?? 'N/D'} ms`,
          ].join('\n')
        : '- Diagnóstico remoto no disponible en el momento de la exportación.',
      '',
      '## 2. Benchmark de Cliente Medido',
      benchmarkInfo
        ? [
            `- MatMul 28×28: ${benchmarkInfo.matMul28Ms} ms`,
            `- 100 Inferencias MLP (ℝ²⁵⁶→ℝ¹⁰): ${benchmarkInfo.mlp100ForwardMs} ms`,
            `- Render rAF (10 frames): ${benchmarkInfo.rafFps} FPS (${benchmarkInfo.rafAvgFrameMs} ms/frame)`,
            `- JS Heap navegador: ${benchmarkInfo.heapMb}`,
          ].join('\n')
        : '- No ejecutado aún en esta sesión.',
      '',
      `## 3. Suite de Verificación y Seguridad (${passed}/${results.length})`,
      ...results.map(
        (r) => `- [${r.passed ? 'OK' : 'FALLO'}] **${r.name}** (${r.metric}, ${r.durationMs} ms) — ${r.details}`
      ),
      '',
      '## 4. Limitaciones Conocidas',
      ...payload.knownLimitations.map((l) => `- ${l}`),
    ].join('\n');

    downloadBlob(`vectoria_audit_${VECTORIA_VERSION}.md`, md, 'text/markdown');
  };

  const passedCount = results.filter((r) => r.passed).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            Centro de Calidad, Seguridad, Monitoreo y Diagnóstico
          </h1>
          <p className="text-xs text-[var(--text-muted)]">
            Telemetría real del servidor Node/Express, benchmarks medidos en navegador y auditoría de {16} invariantes matemáticos y de seguridad.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 self-start">
          <button
            type="button"
            onClick={() => void fetchDiagnostics()}
            disabled={loadingDiag}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-semibold border border-[var(--border-hairline)] surface-elevated text-[var(--text-primary)] cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingDiag ? 'animate-spin' : ''}`} />
            Actualizar Telemetría
          </button>
          <button
            type="button"
            onClick={() => void runBenchmark()}
            disabled={isBenchmarking}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-xs font-semibold border border-[var(--border-strong)] surface-elevated text-[var(--text-primary)] cursor-pointer disabled:opacity-60"
          >
            <Gauge className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
            {isBenchmarking ? 'Midiendo 10 frames...' : 'Benchmark Rendimiento'}
          </button>
          <button
            type="button"
            onClick={runSuite}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-contrast)] cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            Ejecutar Suite (16 Pruebas)
          </button>
        </div>
      </div>

      {/* Real-time Server & Runtime Monitoring */}
      <div className="surface-card rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-hairline)] pb-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
            <Activity className="w-4 h-4 text-[var(--accent-primary)]" />
            <span>Monitoreo y Diagnóstico en Tiempo Real (`/api/diagnostics`)</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            {healthInfo && (
              <span className="font-mono text-[var(--text-muted)]">
                Última lectura: {healthInfo.checkedAt} · Round-trip {healthInfo.roundTripMs} ms
              </span>
            )}
            <button
              type="button"
              onClick={() => exportAuditReport('md')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-[var(--border-hairline)] surface-elevated text-[var(--text-primary)] hover:border-[var(--accent-primary)] cursor-pointer"
            >
              <Download className="w-3 h-3" />
              MD
            </button>
            <button
              type="button"
              onClick={() => exportAuditReport('json')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-[var(--border-hairline)] surface-elevated text-[var(--text-primary)] hover:border-[var(--accent-primary)] cursor-pointer"
            >
              <Download className="w-3 h-3" />
              JSON
            </button>
          </div>
        </div>

        {diagError ? (
          <div className="rounded-xl p-4 border border-[var(--status-warn)]/40 bg-[var(--status-warn)]/10 text-xs text-[var(--status-warn)] flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>No se pudo consultar la telemetría del servidor: {diagError}</span>
          </div>
        ) : diagnostics ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="surface-elevated rounded-xl p-3.5 space-y-1">
              <div className="text-[var(--text-muted)]">Servidor Express & Node</div>
              <div className="font-mono font-bold text-base text-[var(--status-ok)]">
                {diagnostics.nodeVersion} · {diagnostics.uptimeSec}s
              </div>
              <div className="text-[11px] text-[var(--text-muted)]">
                Gemini servidor: {healthInfo?.geminiConfigured ? 'Configurado' : 'Modo local'}
              </div>
            </div>

            <div className="surface-elevated rounded-xl p-3.5 space-y-1">
              <div className="text-[var(--text-muted)]">Memoria Proceso (RSS / Heap)</div>
              <div className="font-mono font-bold text-base text-[var(--accent-primary)]">
                {diagnostics.memoryMb.rss} MB RSS
              </div>
              <div className="text-[11px] text-[var(--text-muted)] font-mono">
                Heap: {diagnostics.memoryMb.heapUsed} / {diagnostics.memoryMb.heapTotal} MB
              </div>
            </div>

            <div className="surface-elevated rounded-xl p-3.5 space-y-1">
              <div className="text-[var(--text-muted)]">Latencia API & Tráfico</div>
              <div className="font-mono font-bold text-base text-[var(--accent-secondary)]">
                {diagnostics.traffic.avgLatencyMs} ms prom.
              </div>
              <div className="text-[11px] text-[var(--text-muted)] font-mono">
                p95: {diagnostics.traffic.p95LatencyMs} ms · API: {diagnostics.traffic.apiRequests} · 429: {diagnostics.traffic.rateLimitedCount}
              </div>
            </div>

            <div className="surface-elevated rounded-xl p-3.5 space-y-1">
              <div className="text-[var(--text-muted)]">Caché Matemático Servidor</div>
              <div className="font-mono font-bold text-base text-[var(--text-primary)]">
                {diagnostics.mathCache.entries}/{diagnostics.mathCache.limit} entradas
              </div>
              <div className="text-[11px] text-[var(--text-muted)] font-mono">
                Hits: {diagnostics.mathCache.hits} · Misses: {diagnostics.mathCache.misses}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-xs text-[var(--text-muted)]">Consultando telemetría...</div>
        )}

        {/* Active 4 Models Health Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs pt-1">
          <div className="rounded-xl p-3 border border-[var(--border-hairline)] flex items-center justify-between">
            <span className="text-[var(--text-secondary)] flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              Dígitos (0–9)
            </span>
            <span className="font-mono font-semibold text-[var(--text-primary)]">
              {(digitsSummary.valAccuracy * 100).toFixed(1)}%
            </span>
          </div>
          <div className="rounded-xl p-3 border border-[var(--border-hairline)] flex items-center justify-between">
            <span className="text-[var(--text-secondary)] flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
              Letras (A–Z)
            </span>
            <span className="font-mono font-semibold text-[var(--text-primary)]">
              {(lettersSummary.valAccuracy * 100).toFixed(1)}%
            </span>
          </div>
          <div className="rounded-xl p-3 border border-[var(--border-hairline)] flex items-center justify-between">
            <span className="text-[var(--text-secondary)] flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-[var(--status-ok)]" />
              Combinado (36)
            </span>
            <span className="font-mono font-semibold text-[var(--text-primary)]">
              {alphanumericSummary.isTrained
                ? `${(alphanumericSummary.valAccuracy * 100).toFixed(1)}%`
                : 'Pendiente'}
            </span>
          </div>
          <div className="rounded-xl p-3 border border-[var(--border-hairline)] flex items-center justify-between">
            <span className="text-[var(--text-secondary)] flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              Red 784–128–10
            </span>
            <span className="font-mono font-semibold text-[var(--text-primary)]">
              {mnist784Result ? `Pred ${mnist784Result.digit} (101,770p)` : 'Lista'}
            </span>
          </div>
        </div>
      </div>

      {/* Security & Dependency Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="surface-card rounded-2xl p-5 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-[var(--status-ok)]">
            <Lock className="w-4 h-4" />
            <span>Aislamiento API, CSP y CORS</span>
          </div>
          <p className="text-[var(--text-secondary)] leading-relaxed">
            <code className="font-mono">GEMINI_API_KEY</code> permanece exclusivamente en Node.js; Express aplica CSP, <code className="font-mono">X-Content-Type-Options: nosniff</code>, lista blanca CORS y redacción automática de secretos en logs.
          </p>
        </div>

        <div className="surface-card rounded-2xl p-5 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-[var(--accent-primary)]">
            <ShieldCheck className="w-4 h-4" />
            <span>Rate Limiting y Validación Acotada</span>
          </div>
          <p className="text-[var(--text-secondary)] leading-relaxed">
            Ventana deslizante por IP (<code className="font-mono">120/min</code> en <code className="font-mono">/api/verify-math</code>, <code className="font-mono">25/min</code> en <code className="font-mono">/api/omni/chat</code>), límite matricial 12×12 y rechazo de valores <code className="font-mono">NaN/Infinity</code>.
          </p>
        </div>

        <div className="surface-card rounded-2xl p-5 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-[var(--accent-secondary)]">
            <Package className="w-4 h-4" />
            <span>Auditoría de Stack y Empaquetado</span>
          </div>
          <p className="text-[var(--text-secondary)] leading-relaxed font-mono text-[11px]">
            React 19 · TypeScript 7 · Vite 8 (manualChunks) · Express 4 · Tailwind v4 · Vitest 5 · Node 22 ESM
          </p>
        </div>
      </div>

      {/* Benchmark Card */}
      {benchmarkInfo && (
        <div className="surface-card rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span className="font-semibold text-[var(--text-primary)]">
              Resultados de Benchmark en Vivo (Medidos en este navegador)
            </span>
            <span className="font-mono">{benchmarkInfo.measuredAt}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="surface-elevated rounded-xl p-3.5">
              <div className="text-[var(--text-muted)]">Multiplicación Matricial 28×28</div>
              <div className="text-lg font-bold font-mono tabular-nums text-[var(--accent-primary)] mt-1">
                {benchmarkInfo.matMul28Ms} ms
              </div>
            </div>
            <div className="surface-elevated rounded-xl p-3.5">
              <div className="text-[var(--text-muted)]">100 Inferencias MLP (ℝ²⁵⁶→ℝ¹⁰)</div>
              <div className="text-lg font-bold font-mono tabular-nums text-[var(--accent-secondary)] mt-1">
                {benchmarkInfo.mlp100ForwardMs} ms
              </div>
            </div>
            <div className="surface-elevated rounded-xl p-3.5">
              <div className="text-[var(--text-muted)]">Fluidez UI (10 frames rAF)</div>
              <div className="text-lg font-bold font-mono tabular-nums text-[var(--status-ok)] mt-1">
                {benchmarkInfo.rafFps} FPS ({benchmarkInfo.rafAvgFrameMs} ms)
              </div>
            </div>
            <div className="surface-elevated rounded-xl p-3.5">
              <div className="text-[var(--text-muted)]">Memoria JS Heap Cliente</div>
              <div className="text-lg font-bold font-mono tabular-nums text-[var(--text-primary)] mt-1">
                {benchmarkInfo.heapMb}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Verification Results */}
      {results.length === 0 ? (
        <div className="surface-card rounded-2xl p-8 text-center text-xs text-[var(--text-muted)]">
          Pulsa &quot;Ejecutar Suite (16 Pruebas)&quot; para auditar en vivo todos los invariantes matemáticos, gradientes neuronales y controles de seguridad.
        </div>
      ) : (
        <div className="surface-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-3 text-xs">
            <span className="font-semibold text-[var(--text-primary)]">
              Resultado: {passedCount}/{results.length} verificaciones aprobadas
            </span>
            <span className="font-mono tabular-nums text-[var(--text-muted)]">
              Tiempo total: {results.reduce((s, r) => s + r.durationMs, 0).toFixed(2)} ms
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border-hairline)] text-[var(--text-muted)]">
                  <th className="py-2 text-left">Estado</th>
                  <th className="py-2 text-left">Prueba</th>
                  <th className="py-2 text-left">Detalle</th>
                  <th className="py-2 text-right">Métrica</th>
                  <th className="py-2 text-right">Duración</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-[var(--border-hairline)] last:border-none"
                  >
                    <td className="py-2.5 pr-3">
                      {r.passed ? (
                        <span className="inline-flex items-center gap-1 text-[var(--status-ok)] font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" /> OK
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[var(--status-err)] font-medium">
                          <XCircle className="w-3.5 h-3.5" /> FALLO
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 font-medium text-[var(--text-primary)]">{r.name}</td>
                    <td className="py-2.5 pr-3 text-[var(--text-secondary)]">{r.details}</td>
                    <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-[var(--accent-primary)]">
                      {r.metric}
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums text-[var(--text-muted)]">
                      {r.durationMs} ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Server Errors + Client Session Events */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 surface-card rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-sm text-[var(--text-primary)]">
              Registro de Errores del Servidor ({diagnostics?.recentErrors.length ?? 0})
            </span>
            <span className="text-[var(--text-muted)]">Sanitizado (sin secretos)</span>
          </div>
          {!diagnostics || diagnostics.recentErrors.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] py-4">
              Sin errores recientes registrados en el servidor Express.
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto text-xs">
              {diagnostics.recentErrors.map((e, idx) => (
                <div
                  key={`${e.timestamp}-${idx}`}
                  className="surface-elevated rounded-lg p-2.5 space-y-0.5"
                >
                  <div className="flex items-center justify-between font-mono text-[11px]">
                    <span className="text-[var(--status-warn)]">
                      HTTP {e.status} · {e.route}
                    </span>
                    <span className="text-[var(--text-muted)]">
                      {new Date(e.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-[var(--text-secondary)]">{e.message}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-7 surface-card rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-sm text-[var(--text-primary)]">
              Registro de Eventos del Sistema ({systemEvents.length})
            </span>
            <span className="text-[var(--text-muted)]">Trazabilidad de sesión</span>
          </div>
          <div className="overflow-x-auto max-h-64">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border-hairline)] text-[var(--text-muted)]">
                  <th className="py-2 text-left">Hora</th>
                  <th className="py-2 text-left">Categoría</th>
                  <th className="py-2 text-left">Evento</th>
                  <th className="py-2 text-left">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {systemEvents.map((evt) => (
                  <tr
                    key={evt.id}
                    className="border-b border-[var(--border-hairline)] last:border-none"
                  >
                    <td className="py-2 pr-3 font-mono tabular-nums text-[var(--text-muted)] whitespace-nowrap">
                      {new Date(evt.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-2 pr-3 font-mono text-[var(--accent-primary)]">
                      {evt.category}
                    </td>
                    <td className="py-2 pr-3 font-medium text-[var(--text-primary)]">
                      {evt.title}
                    </td>
                    <td className="py-2 text-[var(--text-secondary)]">{evt.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
