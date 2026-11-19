import { Type, type FunctionDeclaration } from '@google/genai';
import {
  computeEigen,
  matrixDeterminant,
  matrixInverse,
  matrixLU,
  matrixMultiply,
  matrixQR,
  matrixRank,
  matrixTranspose,
  solveLinearSystem,
} from '../src/engines/linearAlgebra.ts';

export interface OmniToolTraceEntry {
  tool: string;
  status: 'ok' | 'error';
  argsSummary: string;
  resultSummary: string;
  durationMs: number;
}

export interface StudioWorkspaceSnapshotPayload {
  activeModule?: string;
  digitsValAccuracy?: number;
  lettersValAccuracy?: number;
  alphanumericTrained?: boolean;
  alphanumericValAccuracy?: number;
  lastPrediction?: {
    label?: string;
    confidence?: number;
    mode?: string;
    entropy?: number;
  } | null;
  mnist784Result?: {
    digit?: number;
    confidence?: number;
    activeNeurons?: number;
    activePixels?: number;
  } | null;
  smartIrrigationSummary?: {
    epochsTrained?: number;
    trainAccuracy?: number;
    valAccuracy?: number;
    finalLoss?: number;
  } | null;
  lastMathOperation?: {
    operation?: string;
    resultLabel?: string;
    verification?: string;
  } | null;
}

const MAX_TOOL_DIM = 8;

function sanitizeFiniteMatrix(raw: unknown, name: string): number[][] {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_TOOL_DIM) {
    throw new Error(`${name} debe tener entre 1 y ${MAX_TOOL_DIM} filas.`);
  }
  const cols = Array.isArray(raw[0]) ? raw[0].length : 0;
  if (cols === 0 || cols > MAX_TOOL_DIM) {
    throw new Error(`${name} debe tener entre 1 y ${MAX_TOOL_DIM} columnas.`);
  }
  return raw.map((row, r) => {
    if (!Array.isArray(row) || row.length !== cols) {
      throw new Error(`${name} tiene fila ${r + 1} inconsistente.`);
    }
    return row.map((v, c) => {
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        throw new Error(`${name}[${r + 1},${c + 1}] debe ser un número finito.`);
      }
      return v;
    });
  });
}

function sanitizeFiniteVector(raw: unknown, name: string): number[] {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_TOOL_DIM) {
    throw new Error(`${name} debe tener entre 1 y ${MAX_TOOL_DIM} elementos.`);
  }
  return raw.map((v, idx) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new Error(`${name}[${idx + 1}] debe ser un número finito.`);
    }
    return v;
  });
}

export const OMNI_FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'run_linear_algebra_op',
    description:
      'Ejecuta cálculos exactos y verificados de álgebra lineal (determinante, inversa, multiplicación, solve Ax=b, eigenvalores, transpuesta, rango, LU, QR) sobre matrices pequeñas hasta 8x8.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        operation: {
          type: Type.STRING,
          description:
            'Operación matemática autorizada: determinant | inverse | multiply | solve | eigen | transpose | rank | lu | qr',
        },
        matrixA: {
          type: Type.ARRAY,
          description: 'Matriz A numérica en formato arreglo de filas.',
          items: {
            type: Type.ARRAY,
            items: { type: Type.NUMBER },
          },
        },
        matrixB: {
          type: Type.ARRAY,
          description: 'Segunda matriz B (requerida únicamente para multiply).',
          items: {
            type: Type.ARRAY,
            items: { type: Type.NUMBER },
          },
        },
        vectorB: {
          type: Type.ARRAY,
          description: 'Vector b (requerido únicamente para solve Ax=b).',
          items: { type: Type.NUMBER },
        },
      },
      required: ['operation', 'matrixA'],
    },
  },
  {
    name: 'inspect_studio_workspace',
    description:
      'Consulta las métricas reales de la sesión actual del estudio (precisión de Dígitos 0-9, Letras A-Z, Alfanumérico 36, MNIST 784-128-10, Riego Inteligente 2-4-1, última predicción y última operación matemática).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        focus: {
          type: Type.STRING,
          description: 'Área de interés opcional: all | classifier | mnist784 | irrigation | math',
        },
      },
    },
  },
  {
    name: 'explain_model_architecture',
    description:
      'Devuelve la especificación técnica y matemática exacta de una arquitectura neuronal real de VectorIA Studio.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        modelId: {
          type: Type.STRING,
          description: 'Identificador: mlp-16x16 | mnist-784 | smart-irrigation | didactic-232',
        },
      },
      required: ['modelId'],
    },
  },
  {
    name: 'compare_models',
    description:
      'Compara objetivamente las métricas reales disponibles en la sesión entre los modelos del Clasificador Alfanumérico, MNIST 784 y Riego Inteligente.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        includeUntrained: {
          type: Type.BOOLEAN,
          description: 'Indica si incluir modelos aún no entrenados en la comparación.',
        },
      },
    },
  },
];

export const AUTHORIZED_OMNI_TOOL_NAMES = new Set(
  OMNI_FUNCTION_DECLARATIONS.map((d) => d.name!)
);

export function executeAuthorizedOmniTool(
  toolName: string,
  rawArgs: Record<string, unknown>,
  workspace: StudioWorkspaceSnapshotPayload
): { response: Record<string, unknown>; trace: OmniToolTraceEntry } {
  const t0 = performance.now();

  if (!AUTHORIZED_OMNI_TOOL_NAMES.has(toolName)) {
    return {
      response: { error: `Herramienta no autorizada: ${toolName}` },
      trace: {
        tool: toolName,
        status: 'error',
        argsSummary: 'tool_blocked',
        resultSummary: 'Bloqueada por lista blanca del servidor',
        durationMs: Number((performance.now() - t0).toFixed(2)),
      },
    };
  }

  try {
    switch (toolName) {
      case 'run_linear_algebra_op': {
        const op = String(rawArgs.operation ?? '').trim().toLowerCase();
        const matA = sanitizeFiniteMatrix(rawArgs.matrixA, 'matrixA');
        let output;
        switch (op) {
          case 'determinant':
            output = matrixDeterminant(matA);
            break;
          case 'inverse':
            output = matrixInverse(matA);
            break;
          case 'multiply': {
            const matB = sanitizeFiniteMatrix(rawArgs.matrixB, 'matrixB');
            output = matrixMultiply(matA, matB);
            break;
          }
          case 'solve': {
            const vecB = sanitizeFiniteVector(rawArgs.vectorB, 'vectorB');
            output = solveLinearSystem(matA, vecB, 'gauss-jordan');
            break;
          }
          case 'eigen':
            output = computeEigen(matA);
            break;
          case 'transpose':
            output = matrixTranspose(matA);
            break;
          case 'rank':
            output = matrixRank(matA);
            break;
          case 'lu':
            output = matrixLU(matA);
            break;
          case 'qr':
            output = matrixQR(matA);
            break;
          default:
            throw new Error(`Operación matemática no soportada: ${op}`);
        }
        return {
          response: {
            operation: output.operation,
            formula: output.formula,
            resultLabel: output.resultLabel,
            result: output.result,
            verification: output.verification,
          },
          trace: {
            tool: toolName,
            status: 'ok',
            argsSummary: `${op}(${matA.length}×${matA[0].length})`,
            resultSummary:
              typeof output.result === 'number'
                ? `${output.resultLabel} = ${Number.isInteger(output.result) ? output.result : output.result.toFixed(4)}`
                : output.resultLabel,
            durationMs: Number((performance.now() - t0).toFixed(2)),
          },
        };
      }

      case 'inspect_studio_workspace': {
        const focus = String(rawArgs.focus ?? 'all');
        const payload = {
          focus,
          activeModule: workspace.activeModule ?? 'desconocido',
          digitsValAccuracy:
            typeof workspace.digitsValAccuracy === 'number'
              ? Number((workspace.digitsValAccuracy * 100).toFixed(2))
              : null,
          lettersValAccuracy:
            typeof workspace.lettersValAccuracy === 'number'
              ? Number((workspace.lettersValAccuracy * 100).toFixed(2))
              : null,
          alphanumericTrained: Boolean(workspace.alphanumericTrained),
          alphanumericValAccuracy:
            typeof workspace.alphanumericValAccuracy === 'number'
              ? Number((workspace.alphanumericValAccuracy * 100).toFixed(2))
              : null,
          lastPrediction: workspace.lastPrediction ?? null,
          mnist784Result: workspace.mnist784Result ?? null,
          smartIrrigationSummary: workspace.smartIrrigationSummary ?? null,
          lastMathOperation: workspace.lastMathOperation ?? null,
        };
        return {
          response: payload,
          trace: {
            tool: toolName,
            status: 'ok',
            argsSummary: `focus=${focus}`,
            resultSummary: `módulo=${payload.activeModule}, alfanum=${payload.alphanumericTrained ? 'entrenado' : 'sin entrenar'}`,
            durationMs: Number((performance.now() - t0).toFixed(2)),
          },
        };
      }

      case 'explain_model_architecture': {
        const modelId = String(rawArgs.modelId ?? 'mlp-16x16').trim().toLowerCase();
        const specs: Record<string, Record<string, unknown>> = {
          'mlp-16x16': {
            name: 'MLP 16×16 VectorIA',
            architecture: '256 → 32 (ReLU) → 24 (ReLU) → K (Softmax)',
            classes: '10 (Dígitos 0-9), 26 (Letras A-Z) o 36 (Alfanumérico)',
            optimizer: 'SGD con momento (η=0.005, μ=0.85)',
            loss: 'Cross-Entropy',
            datasetOrigin: 'Glifos sintéticos rasterizados 16×16',
          },
          'mnist-784': {
            name: 'Clasificador Numérico 784–128–10',
            architecture: '784 (28×28) → 128 (ReLU) → 10 (Softmax)',
            parameterCount: 101770,
            datasetOrigin: 'Pesos entrenados sobre dígito sintético 28×28 (no MNIST oficial de LeCun)',
          },
          'smart-irrigation': {
            name: 'Red Neuronal de Riego Inteligente',
            architecture: '2 (Humedad %, Luz Solar W/m²) → 4 (ReLU) → 1 (Sigmoide)',
            parameterCount: 17,
            loss: 'Binary Cross-Entropy',
            isolated: true,
            datasetOrigin: 'Conjunto sintético educativo de 16 muestras de entrenamiento y 8 de validación',
          },
          'didactic-232': {
            name: 'Simulador Didáctico 2–3–2',
            architecture: '2 → 3 (ReLU) → 2 (Softmax)',
            purpose: 'Verificación analítica de gradientes vs diferencias finitas numéricas',
          },
        };
        const spec = specs[modelId] ?? { error: `Arquitectura no catalogada: ${modelId}` };
        return {
          response: spec,
          trace: {
            tool: toolName,
            status: 'error' in spec ? 'error' : 'ok',
            argsSummary: `modelId=${modelId}`,
            resultSummary: 'error' in spec ? String(spec.error) : String(spec.architecture),
            durationMs: Number((performance.now() - t0).toFixed(2)),
          },
        };
      }

      case 'compare_models': {
        const includeUntrained = rawArgs.includeUntrained !== false;
        const rows = [
          {
            model: 'Dígitos 0–9 (16×16)',
            trained: typeof workspace.digitsValAccuracy === 'number',
            valAccuracyPct:
              typeof workspace.digitsValAccuracy === 'number'
                ? Number((workspace.digitsValAccuracy * 100).toFixed(2))
                : null,
          },
          {
            model: 'Letras A–Z (16×16)',
            trained: typeof workspace.lettersValAccuracy === 'number',
            valAccuracyPct:
              typeof workspace.lettersValAccuracy === 'number'
                ? Number((workspace.lettersValAccuracy * 100).toFixed(2))
                : null,
          },
          {
            model: 'Alfanumérico 36 clases (16×16)',
            trained: Boolean(workspace.alphanumericTrained),
            valAccuracyPct:
              typeof workspace.alphanumericValAccuracy === 'number'
                ? Number((workspace.alphanumericValAccuracy * 100).toFixed(2))
                : null,
          },
          {
            model: 'Riego Inteligente (2–4–1)',
            trained: Boolean(workspace.smartIrrigationSummary?.epochsTrained),
            valAccuracyPct:
              typeof workspace.smartIrrigationSummary?.valAccuracy === 'number'
                ? Number((workspace.smartIrrigationSummary.valAccuracy * 100).toFixed(2))
                : null,
          },
        ].filter((r) => includeUntrained || r.trained);

        return {
          response: { comparison: rows },
          trace: {
            tool: toolName,
            status: 'ok',
            argsSummary: `includeUntrained=${includeUntrained}`,
            resultSummary: `${rows.length} modelos comparados`,
            durationMs: Number((performance.now() - t0).toFixed(2)),
          },
        };
      }

      default:
        return {
          response: { error: `Herramienta desconocida: ${toolName}` },
          trace: {
            tool: toolName,
            status: 'error',
            argsSummary: '-',
            resultSummary: 'No implementada',
            durationMs: Number((performance.now() - t0).toFixed(2)),
          },
        };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error ejecutando herramienta';
    return {
      response: { error: msg },
      trace: {
        tool: toolName,
        status: 'error',
        argsSummary: Object.keys(rawArgs).join(',') || '-',
        resultSummary: msg,
        durationMs: Number((performance.now() - t0).toFixed(2)),
      },
    };
  }
}
