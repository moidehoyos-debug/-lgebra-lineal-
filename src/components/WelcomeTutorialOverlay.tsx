import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Box,
  Calculator,
  Compass,
  Eye,
  FileDown,
  FlaskConical,
  Grid3X3,
  Layers,
  Play,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { ModuleId } from '../types/vectoria';

interface WelcomeTutorialOverlayProps {
  open: boolean;
  onDismiss: () => void;
  onNavigate: (module: ModuleId) => void;
}

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface TutorialStep {
  id: string;
  stepLabel: string;
  targetModule: ModuleId;
  targetAreaLabel: string;
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

export const WelcomeTutorialOverlay: React.FC<WelcomeTutorialOverlayProps> = ({
  open,
  onDismiss,
  onNavigate,
}) => {
  const { loadSampleGlyph, setSharedMatrix2D, logEvent } = useStudio();
  const [stepIdx, setStepIdx] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null);

  const launchClassifierDemo = (glyph: string, mode: 'digits' | 'letters', target: ModuleId) => {
    loadSampleGlyph(glyph, mode);
    logEvent(
      'system',
      `Tutorial guiado: muestra '${glyph}'`,
      `Cargada hacia ${target}`,
      'ok'
    );
    onNavigate(target);
  };

  const launchGeometryDemo = () => {
    setSharedMatrix2D([
      [0.866, -0.5],
      [0.5, 0.866],
    ]);
    logEvent(
      'math',
      'Tutorial guiado: Rotación 30° en ℝ²',
      'Matriz compartida cargada en Geometría 2D/3D',
      'ok'
    );
    onNavigate('geometry');
  };

  const steps: TutorialStep[] = [
    {
      id: 'welcome-overview',
      stepLabel: 'Paso 1 de 5 · Bienvenida',
      targetModule: 'dashboard',
      targetAreaLabel: 'Panel Principal',
      title: 'Bienvenido a VectorIA Studio',
      description:
        'Plataforma interactiva que une Álgebra Lineal verificable, Redes Neuronales (MLP 16×16 y MNIST 784–128–10), Simulación Científica e Inteligencia Híbrida sin datos simulados.',
      tip: 'Puedes cambiar entre los 6 temas globales (Dark Purple, Neural Cyberpunk, Black & Gold, Holographic, Light Yellow y Classic Mono) desde la barra superior.',
      highlights: [
        {
          title: 'Panel Principal Dinámico',
          detail:
            'Monitorea exactitud real de los 4 modelos, estadísticas por laboratorio y línea de tiempo de latencia API en vivo.',
          module: 'dashboard',
          cta: 'Explorar Panel Principal',
          icon: Layers,
        },
        {
          title: 'Calidad y Seguridad Auditada',
          detail:
            'Verifica gradientes numéricos, residuos algebraicos y telemetría real del servidor Express.',
          module: 'verification',
          cta: 'Abrir Auditoría y Calidad',
          icon: ShieldCheck,
        },
      ],
    },
    {
      id: 'linear-geometry',
      stepLabel: 'Paso 2 de 5 · Matrices y Espacio ℝ² / ℝ³',
      targetModule: 'linear-algebra',
      targetAreaLabel: 'Álgebra Lineal y Geometría 2D/3D',
      title: 'Álgebra Lineal Exacta y Geometría Interactiva',
      description:
        'Resuelve Gauss-Jordan, LU, QR, rango-nulidad y eigenvalores con comprobación automática de residuo ‖r‖, y observa transformaciones lineales en ℝ²/ℝ³.',
      tip: 'Usa el botón de rotación 30° para enviar una matriz ortogonal directamente al plano transformado.',
      highlights: [
        {
          title: 'Cargar Rotación 30° en Geometría 2D/3D',
          detail:
            'Proyecta el cuadrado unitario bajo T(x) = Ax y explora producto cruz, planos y vectores 3D.',
          module: 'geometry',
          cta: 'Probar Rotación 30°',
          icon: Box,
          action: launchGeometryDemo,
        },
        {
          title: 'Laboratorio Simbólico-Numérico',
          detail:
            'Inspecciona pasos intermedios, pivoteo parcial y ortogonalización de Gram-Schmidt.',
          module: 'linear-algebra',
          cta: 'Ir a Álgebra Lineal',
          icon: Calculator,
        },
      ],
    },
    {
      id: 'classifier-xai',
      stepLabel: 'Paso 3 de 5 · Redes Neuronales y XAI',
      targetModule: 'classifier',
      targetAreaLabel: 'Clasificador Alfanumérico e IA Explicable',
      title: 'Clasificación Softmax e Interpretabilidad (XAI)',
      description:
        'Dibuja dígitos y letras en el lienzo 16×16 o cambia a MNIST 784 (Original) 280×280, y analiza exactamente qué píxeles y neuronas ReLU activaron la predicción.',
      tip: 'En XAI puedes estudiar pares ambiguos reales como 0 vs O y 1 vs I mediante mapas de saliencia ∂z/∂x ⊙ x.',
      highlights: [
        {
          title: 'Probar Inferencia con Dígito "3"',
          detail:
            'Rasteriza el carácter en ℝ²⁵⁶ y observa probabilidades Softmax, logits y entropía.',
          module: 'classifier',
          cta: 'Cargar "3" y Clasificar',
          icon: Grid3X3,
          action: () => launchClassifierDemo('3', 'digits', 'classifier'),
        },
        {
          title: 'Inspeccionar Saliencia en XAI',
          detail:
            'Visualiza la sensibilidad gradiente × entrada y las neuronas ocultas dominantes del carácter "8".',
          module: 'xai',
          cta: 'Analizar "8" en XAI',
          icon: Eye,
          action: () => launchClassifierDemo('8', 'digits', 'xai'),
        },
      ],
    },
    {
      id: 'simulation-robustness',
      stepLabel: 'Paso 4 de 5 · Experimentación Aislada',
      targetModule: 'simulation-lab',
      targetAreaLabel: 'Simulation Lab y Robustez',
      title: 'Simulation Lab Aislado y Pruebas de Robustez',
      description:
        'Ejecuta experimentos Antes/Después, comparativas A/B con semilla determinística, perturbaciones 28×28 y retropropagación didáctica 3–2–2 y 2–3–2 sin alterar modelos base.',
      tip: 'Cada experimento registrado actualiza en tiempo real los widgets estadísticos del Panel Principal.',
      highlights: [
        {
          title: 'Simulation Lab en Clones Aislados',
          detail:
            'Modifica desplazamientos, ruido σ y tasa de aprendizaje manteniendo intactos los pesos originales.',
          module: 'simulation-lab',
          cta: 'Entrar a Simulation Lab',
          icon: FlaskConical,
        },
        {
          title: 'Curvas de Sensibilidad y Robustez',
          detail:
            'Mide la estabilidad del modelo ante rotación, escala, grosor y distorsión geométrica.',
          module: 'robustness',
          cta: 'Abrir Robustez',
          icon: ShieldCheck,
        },
      ],
    },
    {
      id: 'omni-pdf-export',
      stepLabel: 'Paso 5 de 5 · Asistente, PDF y Respaldo Seguro',
      targetModule: 'omni-bot',
      targetAreaLabel: 'Omni Bot, Reportes PDF y Configuración',
      title: 'Omni Bot, Exportación PDF y Paquetes Seguros',
      description:
        'Consulta a Omni Bot reutilizando su historial de 10 comandos, exporta cualquier análisis de laboratorio a PDF imprimible y resguarda tus experimentos en JSON cifrado o proyecto .ZIP.',
      tip: 'Puedes reabrir este tutorial guiado en cualquier momento desde el botón "Tutorial guiado" del Panel Principal.',
      highlights: [
        {
          title: 'Omni Bot con Historial de Comandos',
          detail:
            'Ejecuta operaciones como det([[2,1],[1,3]]) y reutiliza tus últimas 10 consultas al instante.',
          module: 'omni-bot',
          cta: 'Abrir Omni Bot',
          icon: Bot,
        },
        {
          title: 'Reportes PDF y Exportación Segura',
          detail:
            'Genera reportes imprimibles (.PDF) desde los laboratorios o exporta el proyecto en .ZIP sin secretos.',
          module: 'evaluation',
          cta: 'Ir a Evaluación (PDF)',
          icon: FileDown,
        },
      ],
    },
  ];

  const current = steps[stepIdx] ?? steps[0];

  useEffect(() => {
    if (!open) return;
    setStepIdx(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const updateSpotlight = () => {
      const target = document.querySelector<HTMLElement>(
        `[data-tour-module="${current.targetModule}"]`
      );
      if (!target) {
        setSpotlightRect(null);
        return;
      }
      const rect = target.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        setSpotlightRect(null);
        return;
      }
      setSpotlightRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    };

    updateSpotlight();
    window.addEventListener('resize', updateSpotlight);
    return () => window.removeEventListener('resize', updateSpotlight);
  }, [open, current.targetModule]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onDismiss();
      } else if (e.key === 'ArrowRight') {
        setStepIdx((i) => Math.min(steps.length - 1, i + 1));
      } else if (e.key === 'ArrowLeft') {
        setStepIdx((i) => Math.max(0, i - 1));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onDismiss, steps.length]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-tutorial-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
    >
      {/* Interactive Spotlight Frame highlighting the corresponding navigation target */}
      {spotlightRect && (
        <div
          aria-hidden="true"
          className="fixed pointer-events-none z-50 rounded-lg border-2 border-[var(--accent-primary)] transition-all duration-200"
          style={{
            top: spotlightRect.top - 3,
            left: spotlightRect.left - 3,
            width: spotlightRect.width + 6,
            height: spotlightRect.height + 6,
            boxShadow: '0 0 0 4px var(--accent-soft)',
          }}
        />
      )}

      <section
        aria-label="Tutorial interactivo de bienvenida de VectorIA Studio"
        className="relative z-50 surface-card rounded-2xl p-6 space-y-5 border border-[var(--border-strong)] w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--accent-primary)]">
              <Compass className="w-4 h-4 shrink-0" />
              <span>{current.stepLabel}</span>
              <span aria-hidden="true" className="text-[var(--text-muted)]">
                ·
              </span>
              <span className="text-[var(--text-muted)] font-normal">
                Módulo destacado: {current.targetAreaLabel}
              </span>
            </div>
            <h2
              id="welcome-tutorial-title"
              className="text-lg sm:text-2xl font-bold text-[var(--text-primary)] text-balance"
            >
              {current.title}
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-2xl leading-relaxed">
              {current.description}
            </p>
          </div>

          <button
            type="button"
            onClick={onDismiss}
            aria-label="Cerrar tutorial de bienvenida"
            className="p-2 rounded-lg border border-[var(--border-hairline)] hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Guided Stepper Bar */}
        <div className="grid grid-cols-5 gap-2" aria-label="Progreso del tutorial guiado">
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

        {/* Feature Cards with Direct Executable Demos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {current.highlights.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="surface-elevated rounded-xl p-5 flex flex-col justify-between gap-4 border border-[var(--border-hairline)]"
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
                    onClick={() => {
                      if (item.action) {
                        item.action();
                      } else {
                        onNavigate(item.module);
                      }
                      onDismiss();
                    }}
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
          <span className="text-xs text-[var(--text-muted)] max-w-xl leading-relaxed">
            Sugerencia: {current.tip}
          </span>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onDismiss}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer whitespace-nowrap"
            >
              Saltar tutorial
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
                Comenzar a explorar
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
