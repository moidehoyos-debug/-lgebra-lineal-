import {
  analyzeVectors,
  formatMatrixInline,
  formatNum,
  formatVectorInline,
  matrixDeterminant,
  matrixInverse,
  matrixMultiply,
  solveLinearSystem,
} from './linearAlgebra';
import {
  Didactic232StepResult,
  Mnist784InferenceResult,
  ModelEvaluationSummary,
  PredictionRecord,
} from '../types/vectoria';

export interface WorkspaceInspectionSnapshot {
  activeModule: string;
  digitsSummary: ModelEvaluationSummary;
  lettersSummary: ModelEvaluationSummary;
  alphanumericSummary: ModelEvaluationSummary;
  lastPrediction: PredictionRecord | null;
  mnist784Result?: Mnist784InferenceResult | null;
  last232Step?: Didactic232StepResult | null;
  lastMathOperation?: { operation: string; resultLabel: string; verification: string } | null;
}

export interface LocalOmniResponse {
  handledLocally: boolean;
  answer: string;
  source: 'local-math' | 'local-knowledge';
  toolTrace: string[];
}

function parseJsonLiteral<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function tryRunLocalOmniEngine(
  query: string,
  snapshot: WorkspaceInspectionSnapshot
): LocalOmniResponse | null {
  const q = query.trim();
  const lower = q.toLowerCase();
  const toolTrace: string[] = [];

  // 1. Deterministic mathematical command parser: det(...), inv(...), dot(...), norm(...), mul(...), solve(...)
  const detMatch = q.match(/det\s*\(\s*(\[\[[\s\S]+\]\])\s*\)/i);
  if (detMatch) {
    const mat = parseJsonLiteral<number[][]>(detMatch[1]);
    if (mat) {
      try {
        const res = matrixDeterminant(mat);
        toolTrace.push('motor_algebra_lineal.determinante');
        return {
          handledLocally: true,
          source: 'local-math',
          toolTrace,
          answer: [
            `Cálculo verificado por el motor local de Álgebra Lineal:`,
            `- Entrada: ${res.inputSummary}`,
            `- Procedimiento: ${res.procedure}`,
            `- Resultado: det(A) = ${formatNum(res.result)}`,
            `- Verificación: ${res.verification.statement}`,
            `- Contexto IA: ${res.aiInterpretation}`,
          ].join('\n'),
        };
      } catch (err) {
        return {
          handledLocally: true,
          source: 'local-math',
          toolTrace: ['motor_algebra_lineal.validacion'],
          answer: `Error de validación matemática: ${err instanceof Error ? err.message : 'Entrada inválida.'}`,
        };
      }
    }
  }

  const invMatch = q.match(/inv\s*\(\s*(\[\[[\s\S]+\]\])\s*\)/i);
  if (invMatch) {
    const mat = parseJsonLiteral<number[][]>(invMatch[1]);
    if (mat) {
      try {
        const res = matrixInverse(mat);
        toolTrace.push('motor_algebra_lineal.inversa_gauss_jordan');
        return {
          handledLocally: true,
          source: 'local-math',
          toolTrace,
          answer: [
            `Matriz inversa calculada por Gauss-Jordan:`,
            `- A⁻¹ = ${formatMatrixInline(res.result)}`,
            `- Verificación: ${res.verification.statement}`,
            `- Contexto IA: ${res.aiInterpretation}`,
          ].join('\n'),
        };
      } catch (err) {
        return {
          handledLocally: true,
          source: 'local-math',
          toolTrace: ['motor_algebra_lineal.inversa_gauss_jordan'],
          answer: `No se pudo invertir la matriz: ${err instanceof Error ? err.message : 'Error matricial.'}`,
        };
      }
    }
  }

  const dotMatch = q.match(/dot\s*\(\s*(\[[^\]]+\])\s*,\s*(\[[^\]]+\])\s*\)/i);
  if (dotMatch) {
    const u = parseJsonLiteral<number[]>(dotMatch[1]);
    const v = parseJsonLiteral<number[]>(dotMatch[2]);
    if (u && v) {
      try {
        const res = analyzeVectors(u, v);
        toolTrace.push('motor_algebra_lineal.analisis_vectorial');
        return {
          handledLocally: true,
          source: 'local-math',
          toolTrace,
          answer: [
            `Análisis vectorial verificado:`,
            `- u·v = ${formatNum(res.result.dotProduct)}`,
            `- ||u||₂ = ${formatNum(res.result.normU)}, ||v||₂ = ${formatNum(res.result.normV)}`,
            `- Similitud coseno = ${formatNum(res.result.cosineSimilarity)} (θ = ${formatNum(res.result.angleDeg, 2)}°)`,
            `- Verificación: ${res.verification.statement}`,
          ].join('\n'),
        };
      } catch (err) {
        return {
          handledLocally: true,
          source: 'local-math',
          toolTrace: ['motor_algebra_lineal.analisis_vectorial'],
          answer: `Error vectorial: ${err instanceof Error ? err.message : 'Dimensión incompatible.'}`,
        };
      }
    }
  }

  const mulMatch = q.match(/mul\s*\(\s*(\[\[[\s\S]+\]\])\s*,\s*(\[\[[\s\S]+\]\])\s*\)/i);
  if (mulMatch) {
    const A = parseJsonLiteral<number[][]>(mulMatch[1]);
    const B = parseJsonLiteral<number[][]>(mulMatch[2]);
    if (A && B) {
      try {
        const res = matrixMultiply(A, B);
        toolTrace.push('motor_algebra_lineal.multiplicacion');
        return {
          handledLocally: true,
          source: 'local-math',
          toolTrace,
          answer: [
            `Producto matricial A × B verificado:`,
            `- Resultado: ${formatMatrixInline(res.result)}`,
            `- Verificación: ${res.verification.statement}`,
          ].join('\n'),
        };
      } catch (err) {
        return {
          handledLocally: true,
          source: 'local-math',
          toolTrace: ['motor_algebra_lineal.multiplicacion'],
          answer: `Error en multiplicación: ${err instanceof Error ? err.message : 'Dimensiones incompatibles.'}`,
        };
      }
    }
  }

  const solveMatch = q.match(/solve\s*\(\s*(\[\[[\s\S]+\]\])\s*,\s*(\[[^\]]+\])\s*\)/i);
  if (solveMatch) {
    const A = parseJsonLiteral<number[][]>(solveMatch[1]);
    const b = parseJsonLiteral<number[]>(solveMatch[2]);
    if (A && b) {
      try {
        const res = solveLinearSystem(A, b, 'gauss-jordan');
        toolTrace.push('motor_algebra_lineal.gauss_jordan');
        return {
          handledLocally: true,
          source: 'local-math',
          toolTrace,
          answer: [
            `Sistema lineal resuelto por Gauss-Jordan:`,
            `- Estado: ${res.resultLabel}`,
            res.result.solution ? `- Solución x = ${formatVectorInline(res.result.solution)}` : `- Rango(A) = ${res.result.rankA}, Rango([A|b]) = ${res.result.rankAug}`,
            `- Verificación: ${res.verification.statement}`,
          ].join('\n'),
        };
      } catch (err) {
        return {
          handledLocally: true,
          source: 'local-math',
          toolTrace: ['motor_algebra_lineal.gauss_jordan'],
          answer: `Error en sistema lineal: ${err instanceof Error ? err.message : 'Entrada inválida.'}`,
        };
      }
    }
  }

  // 2a. Official MNIST vs synthetic 83% provenance question (before generic state check)
  if (lower.includes('mnist') && (lower.includes('83') || lower.includes('sintétic') || lower.includes('sintetic') || lower.includes('oficial'))) {
    toolTrace.push('auditoria_procedencia_784');
    return {
      handledLocally: true,
      source: 'local-knowledge',
      toolTrace,
      answer: [
        `Aclaración científica sobre el modelo 784–128–10 del HTML original:`,
        `- Los 101,770 parámetros integrados proceden de un entrenamiento previo sobre 1,200 imágenes sintéticas y una evaluación sintética de N = 300 muestras (249/300 = 83.0%).`,
        `- NO corresponden al conjunto oficial MNIST (60,000 entrenamiento / 10,000 prueba de Yann LeCun et al.).`,
        `- Para reportar métricas sobre MNIST oficial se requiere entrenar o cargar un archivo de pesos entrenado específicamente con los archivos oficiales de MNIST.`,
      ].join('\n'),
    };
  }

  // 2b. Internal workspace state inspection queries (including 784-128-10 and 2-3-2)
  if (
    (lower.includes('estado') || lower.includes('resumen') || lower.includes('última predicción') || lower.includes('ultima prediccion') || lower.includes('modelo') || lower.includes('784') || lower.includes('2-3-2') || lower.includes('2–3–2')) &&
    (lower.includes('estudio') || lower.includes('red') || lower.includes('predic') || lower.includes('alfanum') || lower.includes('modelo') || lower.includes('784') || lower.includes('mnist') || lower.includes('2-3-2') || lower.includes('2–3–2'))
  ) {
    toolTrace.push('inspeccion_modelos_neuronales', 'inspeccion_ultima_prediccion');
    const predText = snapshot.lastPrediction
      ? `Última inferencia 16×16: clase "${snapshot.lastPrediction.topLabel}" con ${(snapshot.lastPrediction.confidence * 100).toFixed(2)}% de confianza (modo ${snapshot.lastPrediction.mode}, entropía ${snapshot.lastPrediction.entropy.toFixed(3)} bits).`
      : 'Aún no se ha ejecutado ninguna inferencia 16×16 en esta sesión.';

    const mnist784Text = snapshot.mnist784Result
      ? `Modelo 784–128–10 (Original Sintético): predicción dígito ${snapshot.mnist784Result.digit} (${(snapshot.mnist784Result.confidence * 100).toFixed(2)}%), ${snapshot.mnist784Result.activeNeurons}/128 neuronas ReLU activas, ${snapshot.mnist784Result.activePixels}/784 píxeles > 0.1.`
      : 'Modelo 784–128–10 disponible (101,770 parámetros sintéticos).';

    const didactic232Text = snapshot.last232Step
      ? `Último paso 2–3–2: L₀=${snapshot.last232Step.lossBefore.toFixed(5)} → L₁=${snapshot.last232Step.lossAfter.toFixed(5)}, error máx diferencias finitas=${snapshot.last232Step.maxFiniteDiffError.toExponential(2)}.`
      : 'Simulador 2–3–2 listo (en espera de paso de retropropagación).';

    const alphaStatus = snapshot.alphanumericSummary.isTrained
      ? `Entrenado (${snapshot.alphanumericSummary.epochsTrained} épocas, precisión validación ${(snapshot.alphanumericSummary.valAccuracy * 100).toFixed(1)}%).`
      : 'NO entrenado todavía (inferencia combinada 36 clases bloqueada hasta ejecutar entrenamiento conjunto real).';

    return {
      handledLocally: true,
      source: 'local-knowledge',
      toolTrace,
      answer: [
        `Inspección directa del estado real de VectorIA Studio:`,
        `- Módulo activo: ${snapshot.activeModule}`,
        `- Modelo Dígitos (0–9): ${snapshot.digitsSummary.epochsTrained} épocas, precisión val ${(snapshot.digitsSummary.valAccuracy * 100).toFixed(1)}%, pérdida ${snapshot.digitsSummary.finalLoss.toFixed(4)}`,
        `- Modelo Letras (A–Z): ${snapshot.lettersSummary.epochsTrained} épocas, precisión val ${(snapshot.lettersSummary.valAccuracy * 100).toFixed(1)}%, pérdida ${snapshot.lettersSummary.finalLoss.toFixed(4)}`,
        `- Modelo Alfanumérico (36 clases): ${alphaStatus}`,
        `- ${predText}`,
        `- ${mnist784Text}`,
        `- ${didactic232Text}`,
      ].join('\n'),
    };
  }

  // 3. Academic exercise generator
  if (lower.includes('ejercicio') && (lower.includes('genera') || lower.includes('practica') || lower.includes('práctica') || lower.includes('dame'))) {
    toolTrace.push('generador_ejercicios_academicos', 'motor_algebra_lineal');
    if (lower.includes('red') || lower.includes('neuronal') || lower.includes('relu') || lower.includes('softmax')) {
      return {
        handledLocally: true,
        source: 'local-knowledge',
        toolTrace,
        answer: [
          `Ejercicio Académico Generado — Propagación hacia adelante y ReLU:`,
          `Dada la entrada x = [1, -2]ᵀ, pesos W = [[2, 1], [-1, 3]] y sesgo b = [0.5, 4]ᵀ:`,
          `1. Calcula Z = W·x + b.`,
          `2. Aplica A = ReLU(Z) = max(0, Z).`,
          ``,
          `Solución verificada paso a paso:`,
          `- z₁ = 2(1) + 1(-2) + 0.5 = 0.5 → a₁ = max(0, 0.5) = 0.5`,
          `- z₂ = -1(1) + 3(-2) + 4 = -3.0 → a₂ = max(0, -3.0) = 0`,
          `Puedes comprobar estos valores en el Editor 3–2–2 dentro de Simulation Lab.`,
        ].join('\n'),
      };
    }

    const sampleA = [
      [3, 2],
      [1, 4],
    ];
    const detRes = matrixDeterminant(sampleA);
    const invRes = matrixInverse(sampleA);
    return {
      handledLocally: true,
      source: 'local-math',
      toolTrace,
      answer: [
        `Ejercicio Académico Generado — Determinante e Inversa 2×2:`,
        `Dada la matriz A = [[3, 2], [1, 4]]:`,
        `1. Calcula det(A) y verifica si es invertible.`,
        `2. Halla A⁻¹ por fórmula 2×2 o Gauss-Jordan.`,
        ``,
        `Solución verificada por el motor:`,
        `- det(A) = (3)(4) - (2)(1) = ${formatNum(detRes.result)} ≠ 0 (invertible)`,
        `- A⁻¹ = ${formatMatrixInline(invRes.result)}`,
        `- Comprobación: ${invRes.verification.statement}`,
      ].join('\n'),
    };
  }

  return null;
}

export function buildLocalAcademicFallback(query: string, snapshot: WorkspaceInspectionSnapshot): LocalOmniResponse {
  const lower = query.toLowerCase();
  const toolTrace: string[] = ['base_academica_verificada'];

  if (lower.includes('o y 0') || lower.includes('0 y o') || lower.includes('i y 1') || lower.includes('1 y i') || lower.includes('confusión entre') || lower.includes('confusion entre')) {
    toolTrace.push('analisis_morfologico_36_clases');
    return {
      handledLocally: true,
      source: 'local-knowledge',
      toolTrace,
      answer: [
        `Diferenciación matemática y morfológica en clasificación alfanumérica (36 clases):`,
        `1. Par 0 vs O: En el espacio de características ℝ²⁵⁶ (16×16), '0' suele presentar una relación de aspecto más estrecha o un trazo diagonal interior, mientras 'O' es más simétrica radialmente. En clasificadores separados (10 vs 26 clases) nunca compiten entre sí; solo un modelo unificado de 36 clases con Softmax conjunto aprende un hiperplano discriminante W[0] - W[O] que separa ambas distribuciones.`,
        `2. Par 1 vs I: El dígito '1' presenta un trazo oblicuo superior (bandera) con menor simetría horizontal superior que la 'I' con serifas simétricas arriba y abajo.`,
        `Estado actual en VectorIA: el modelo combinado de 36 clases ${snapshot.alphanumericSummary.isTrained ? `está entrenado (${(snapshot.alphanumericSummary.valAccuracy * 100).toFixed(1)}% val)` : 'requiere entrenamiento conjunto en el Clasificador Alfanumérico antes de emitir probabilidades reales entre 0/O y 1/I'}.`,
      ].join('\n'),
    };
  }

  if (lower.includes('relu') || lower.includes('softmax')) {
    return {
      handledLocally: true,
      source: 'local-knowledge',
      toolTrace,
      answer: [
        `Funciones de activación en VectorIA Studio:`,
        `- ReLU(z) = max(0, z): introduce no linealidad por tramos, evita el desvanecimiento del gradiente para z > 0 y anula neuronas inactivas (esparcidad).`,
        `- Softmax(zᵢ) = exp(zᵢ - max(z)) / Σⱼ exp(zⱼ - max(z)): normaliza los logits de la capa de salida en una distribución de probabilidad estricta (Σᵢ pᵢ = 1, pᵢ ∈ (0,1)).`,
        `Fórmula de capa oculta implementada en nuestro motor: Z = W·X + b, A = ReLU(Z).`,
      ].join('\n'),
    };
  }

  if (lower.includes('backprop') || lower.includes('retropropag') || lower.includes('gradiente') || lower.includes('época') || lower.includes('epoca')) {
    return {
      handledLocally: true,
      source: 'local-knowledge',
      toolTrace,
      answer: [
        `Retropropagación y Descenso del Gradiente en el motor MLP:`,
        `1. Forward pass: Z⁽ˡ⁾ = W⁽ˡ⁾A⁽ˡ⁻¹⁾ + b⁽ˡ⁾, A⁽ˡ⁾ = ReLU(Z⁽ˡ⁾), ŷ = Softmax(Z⁽ᴸ⁾).`,
        `2. Error en salida (Entropía Cruzada + Softmax): δ⁽ᴸ⁾ = ŷ - y.`,
        `3. Regla de la cadena hacia atrás: δ⁽ˡ⁾ = ((W⁽ˡ⁺¹⁾)ᵀ δ⁽ˡ⁺¹⁾) ⊙ 𝟙(Z⁽ˡ⁾ > 0).`,
        `4. Gradientes y actualización con momento μ: ∇W⁽ˡ⁾ = δ⁽ˡ⁾(A⁽ˡ⁻¹⁾)ᵀ, v ← μv - η∇W, W ← W + v.`,
        `Una época completa recorre todos los ejemplos del conjunto de entrenamiento una vez.`,
      ].join('\n'),
    };
  }

  if (lower.includes('matriz de confusión') || lower.includes('matriz de confusion')) {
    return {
      handledLocally: true,
      source: 'local-knowledge',
      toolTrace,
      answer: [
        `La Matriz de Confusión C ∈ ℝ^(K×K) registra en C[i, j] cuántas muestras cuya clase real es i fueron predichas como j.`,
        `- La diagonal principal C[i, i] contiene los aciertos por clase.`,
        `- Los elementos fuera de la diagonal muestran confusiones sistemáticas (por ejemplo '3' vs '8' o 'O' vs 'Q').`,
        `En el módulo de Analítica puedes inspeccionar las matrices reales evaluadas sobre los conjuntos de validación de cada red.`,
      ].join('\n'),
    };
  }

  if (lower.includes('determinante') || lower.includes('inversa') || lower.includes('vector') || lower.includes('matriz') || lower.includes('gauss')) {
    return {
      handledLocally: true,
      source: 'local-knowledge',
      toolTrace,
      answer: [
        `Fundamentos de Álgebra Lineal aplicados a IA:`,
        `- Matrices y Multiplicación (W·X): proyectan vectores de entrada de ℝⁿ a ℝᵐ mediante combinaciones lineales de las filas de W.`,
        `- Determinante (det(A)): mide el escalado de volumen orientado; si det(A) = 0 la transformación colapsa el espacio y no es invertible.`,
        `- Eliminación de Gauss / Gauss-Jordan: reduce [A | b] o [A | I] a forma escalonada (RREF) para resolver sistemas lineales o hallar A⁻¹.`,
        `Puedes probar comandos exactos aquí mismo, por ejemplo: det([[2,1],[1,3]]), inv([[2,1],[1,1]]), dot([1,2,3],[4,5,6]) o solve([[2,1],[1,-1]],[5,1]).`,
      ].join('\n'),
    };
  }

  return {
    handledLocally: true,
    source: 'local-knowledge',
    toolTrace,
    answer: [
      `Motor local de VectorIA Studio activo. Puedo ayudarte con:`,
      `- Cálculos verificados instantáneos: escribe det([[2,1],[5,3]]), inv([[4,7],[2,6]]), mul([[1,2],[3,4]],[[2,0],[1,2]]), dot([1,2],[3,4]) o solve([[2,1],[1,-1]],[5,1]).`,
      `- Explicaciones sobre Álgebra Lineal, Redes Neuronales (Z = WX + b, ReLU, Softmax, Backpropagation), Matriz de Confusión y diferencias entre 0/O o 1/I.`,
      `- Inspección de estado real del estudio ("estado de los modelos y última predicción").`,
    ].join('\n'),
  };
}
