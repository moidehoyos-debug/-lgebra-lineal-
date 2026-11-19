import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Box,
  Calculator,
  Compass,
  Eye,
  FlaskConical,
  Grid3X3,
  Play,
  X,
} from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { ModuleId } from '../types/vectoria';

export const QUICKSTART_STORAGE_KEY = 'vectoria-quickstart-dismissed';

export function shouldShowQuickStartGuide(storage?: Pick<Storage, 'getItem'> | null): boolean {
  try {
    const store = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    if (!store) return true;
    return store.getItem(QUICKSTART_STORAGE_KEY) !== 'true';
  } catch {
    return true;
  }
}

export function persistQuickStartDismissed(
  dismissed: boolean,
  storage?: Pick<Storage, 'setItem' | 'removeItem'> | null
): void {
  try {
    const store = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    if (!store) return;
    if (dismissed) {
      store.setItem(QUICKSTART_STORAGE_KEY, 'true');
    } else {
      store.removeItem(QUICKSTART_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors in restricted browsing modes
  }
}

interface QuickStartGuideProps {
  onDismiss: () => void;
  onNavigate: (module: ModuleId) => void;
}

interface TourStep {
  id: string;
  badge: string;
  title: string;
  description: string;
  tip: string;
  highlights: Array<{
    title: string;
    detail: string;
    module: ModuleId;
    cta: string;
    icon: React.FC<{ className?: string }>;
    action?: () => void;
  }>;
}

export const QuickStartGuide: React.FC<QuickStartGuideProps> = ({
  onDismiss,
  onNavigate,
}) => {
  const { loadSampleGlyph, setSharedMatrix2D, logEvent } = useStudio();
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onDismiss]);

  const launchClassifierDemo = (glyph: string, mode: 'digits' | 'letters', target: ModuleId) => {
    loadSampleGlyph(glyph, mode);
    logEvent('system', `Tour interactivo: muestra '${glyph}'`, `Cargada desde Guía Rápida hacia ${target}`);
    onNavigate(target);
  };

  const launchGeometryDemo = () => {
    setSharedMatrix2D([
      [0.866, -0.5],
      [0.5, 0.866],
    ]);
    logEvent('math', 'Tour interactivo: Rotación 30° en ℝ²', 'Matriz compartida enviada a Geometría 2D/3D');
    onNavigate('geometry');
  };

  const steps: TourStep[] = [
    {
      id: 'overview',
      badge: 'Paso 1 de 4 · Bienvenida',
      title: 'Recorrido Interactivo por VectorIA Studio',
      description:
        'VectorIA Studio conecta el Álgebra Lineal exacta con el entrenamiento, simulación e interpretabilidad de redes neuronales. Sigue estos 4 pasos con ejemplos ejecutables reales o salta cuando quieras.',
      tip: 'Puedes elegir cualquiera de los 6 temas globales (incluyendo Neural Cyberpunk, Black & Gold y Holographic) en todo momento.',
      highlights: [
        {
          title: 'Álgebra Lineal Verificable',
          detail: 'Matrices, Gauss-Jordan, LU, QR, rango, vectores y eigenanálisis con verificación automática por residuo.',
          module: 'linear-algebra',
          cta: 'Ir al Laboratorio Matricial',
          icon: Calculator,
        },
        {
          title: 'Clasificador Alfanumérico (ℝ²⁵⁶) y MNIST 784',
          detail: 'Dibuja en 16×16 (0–9, A–Z, 36 clases) o cambia a la pestaña MNIST 784 (Original) para usar el lienzo 280×280 con la red 784–128–10 e inspector de pesos.',
          module: 'classifier',
          cta: 'Probar Clasificador',
          icon: Grid3X3,
        },
      ],
    },
    {
      id: 'math-geometry',
      badge: 'Paso 2 de 4 · Geometría y Matrices',
      title: 'Del Cálculo Matricial a la Visualización 2D/3D',
      description:
        'Cada matriz 2×2 deforma el espacio bidimensional y cada vector en ℝ³ define ángulos, proyecciones, planos y producto cruz.',
      tip: 'Prueba el ejemplo de rotación 30° para ver cómo T(x) = Ax transforma el cuadrado unitario.',
      highlights: [
        {
          title: 'Ejemplo: Rotación 30° en Geometría 2D/3D',
          detail: 'Carga una matriz ortogonal de rotación en ℝ² y explora vectores, planos y rectas en 3D interactivo.',
          module: 'geometry',
          cta: 'Cargar Rotación 30° en 2D/3D',
          icon: Box,
          action: launchGeometryDemo,
        },
        {
          title: 'Descomposiciones LU, QR y Rango',
          detail: 'Inspecciona pasos intermedios, pivoteo parcial y ortogonalización de Gram-Schmidt.',
          module: 'linear-algebra',
          cta: 'Abrir Álgebra Lineal',
          icon: Calculator,
        },
      ],
    },
    {
      id: 'classifier-xai',
      badge: 'Paso 3 de 4 · Redes Neuronales y XAI',
      title: 'Inferencia Softmax e IA Explicable (Saliency)',
      description:
        'Observa no solo qué predice la red, sino qué píxeles (mediante gradiente × entrada) y neuronas ocultas impulsaron el logit ganador.',
      tip: 'Los pares ambiguos como 0 vs O y 1 vs I permiten estudiar por qué el modelo unificado de 36 clases requiere entrenamiento propio.',
      highlights: [
        {
          title: 'Ejemplo: Cargar dígito "3" en Clasificador',
          detail: 'Vectoriza el carácter "3" en 16×16 y visualiza sus probabilidades Softmax y entropía.',
          module: 'classifier',
          cta: 'Cargar "3" y Clasificar',
          icon: Grid3X3,
          action: () => launchClassifierDemo('3', 'digits', 'classifier'),
        },
        {
          title: 'Ejemplo: Mapa de Saliencia XAI',
          detail: 'Inspecciona ∂z_top/∂x ⊙ x sobre el carácter "8" y las neuronas ReLU más activas.',
          module: 'xai',
          cta: 'Analizar "8" en XAI',
          icon: Eye,
          action: () => launchClassifierDemo('8', 'digits', 'xai'),
        },
      ],
    },
    {
      id: 'simulation-omni',
      badge: 'Paso 4 de 4 · Experimentación y Asistente',
      title: 'Simulation Lab Aislado y Omni Bot Híbrido',
      description:
        'Interviene parámetros (Δx, Δy, ruido σ, pesos 3–2–2, pruebas A/B) sin alterar los modelos base, y consulta dudas o genera ejercicios académicos con Omni Bot.',
      tip: 'Al terminar podrás reabrir este recorrido guiado desde el botón "Repetir guía interactiva" del Dashboard.',
      highlights: [
        {
          title: 'Simulation Lab, Perturbaciones 28×28 y Redes 3–2–2 / 2–3–2',
          detail: 'Compara escenarios antes/después, rotación/escala/grosor 28×28, pruebas A/B reproducibles y simuladores paso a paso de retropropagación.',
          module: 'simulation-lab',
          cta: 'Entrar a Simulation Lab',
          icon: FlaskConical,
        },
        {
          title: 'Omni Bot Intelligence',
          detail: 'Ejecuta comandos como det([[2,1],[1,3]]) o genera ejercicios resueltos paso a paso.',
          module: 'omni-bot',
          cta: 'Conversar con Omni Bot',
          icon: Bot,
        },
      ],
    },
  ];

  const current = steps[stepIdx];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quickstart-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
    >
      <section
        aria-label="Guía de Inicio Rápido"
        className="surface-card rounded-2xl p-6 space-y-5 border border-[var(--border-strong)] w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--accent-primary)]">
              <Compass className="w-4 h-4 shrink-0" />
              <span>{current.badge}</span>
            </div>
            <h2
              id="quickstart-modal-title"
              className="text-lg sm:text-xl font-bold text-[var(--text-primary)]"
            >
              {current.title}
            </h2>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-3xl leading-relaxed">
            {current.description}
          </p>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          aria-label="Ocultar guía de inicio rápido"
          className="p-2 rounded-lg border border-[var(--border-hairline)] hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Step Indicator */}
      <div className="grid grid-cols-4 gap-2" aria-label="Progreso del recorrido">
        {steps.map((s, idx) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStepIdx(idx)}
            className={`h-2 rounded-full transition-colors cursor-pointer ${
              idx <= stepIdx ? 'bg-[var(--accent-primary)]' : 'bg-[var(--bg-elevated)]'
            }`}
            aria-label={`Ir al paso ${idx + 1}: ${s.title}`}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {current.highlights.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className="surface-elevated rounded-xl p-5 flex flex-col justify-between gap-4"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                  <Icon className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
                  <span>{item.title}</span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  {item.detail}
                </p>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => (item.action ? item.action() : onNavigate(item.module))}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--accent-primary)] hover:underline cursor-pointer whitespace-nowrap"
                >
                  <Play className="w-3 h-3" />
                  {item.cta}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-3 border-t border-[var(--border-hairline)] flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-[var(--text-muted)] max-w-xl">
          Ayuda contextual: {current.tip}
        </span>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onDismiss}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer whitespace-nowrap"
          >
            Ocultar guía
          </button>
          {stepIdx > 0 && (
            <button
              type="button"
              onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border-hairline)] surface-elevated text-[var(--text-primary)] cursor-pointer whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Anterior
            </button>
          )}
          {stepIdx < steps.length - 1 ? (
            <button
              type="button"
              onClick={() => setStepIdx((i) => Math.min(steps.length - 1, i + 1))}
              className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-contrast)] cursor-pointer whitespace-nowrap"
            >
              Siguiente
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onDismiss}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-contrast)] cursor-pointer whitespace-nowrap"
            >
              Finalizar guía
            </button>
          )}
        </div>
      </div>
      </section>
    </div>
  );
};
