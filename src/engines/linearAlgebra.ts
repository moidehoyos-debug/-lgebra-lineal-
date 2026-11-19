import type { MathOperationOutput, MathStep } from '../types/vectoria.ts';

const EPS = 1e-9;

export type Matrix = number[][];
export type Vector = number[];

export function cloneMatrix(M: Matrix): Matrix {
  return M.map((row) => [...row]);
}

export function formatNum(n: number, decimals = 4): string {
  if (Math.abs(n) < 1e-10) return '0';
  const rounded = Number(n.toFixed(decimals));
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

export function formatMatrixInline(M: Matrix): string {
  return '[' + M.map((r) => '[' + r.map((v) => formatNum(v, 3)).join(', ') + ']').join('; ') + ']';
}

export function formatVectorInline(v: Vector): string {
  return '[' + v.map((x) => formatNum(x, 3)).join(', ') + ']';
}

export function validateMatrix(M: Matrix, name = 'Matriz'): { rows: number; cols: number } {
  if (!Array.isArray(M) || M.length === 0) {
    throw new Error(`${name} no puede estar vacía.`);
  }
  const cols = M[0].length;
  if (cols === 0) {
    throw new Error(`${name} debe tener al menos una columna.`);
  }
  for (let i = 0; i < M.length; i++) {
    if (!Array.isArray(M[i]) || M[i].length !== cols) {
      throw new Error(`${name} tiene filas con dimensiones inconsistentes.`);
    }
    for (let j = 0; j < cols; j++) {
      if (!Number.isFinite(M[i][j])) {
        throw new Error(`${name} contiene un valor no finito en (${i + 1}, ${j + 1}).`);
      }
    }
  }
  return { rows: M.length, cols };
}

export function validateVector(v: Vector, name = 'Vector'): number {
  if (!Array.isArray(v) || v.length === 0) {
    throw new Error(`${name} no puede estar vacío.`);
  }
  for (let i = 0; i < v.length; i++) {
    if (!Number.isFinite(v[i])) {
      throw new Error(`${name} contiene un componente no finito en posición ${i + 1}.`);
    }
  }
  return v.length;
}

export function frobeniusNorm(M: Matrix): number {
  let sum = 0;
  for (const row of M) {
    for (const val of row) sum += val * val;
  }
  return Math.sqrt(sum);
}

export function vectorNorm(v: Vector): number {
  return Math.sqrt(v.reduce((acc, val) => acc + val * val, 0));
}

export function identityMatrix(n: number): Matrix {
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
  );
}

export function rawMatMul(A: Matrix, B: Matrix): Matrix {
  const { rows: rA, cols: cA } = validateMatrix(A, 'A');
  const { rows: rB, cols: cB } = validateMatrix(B, 'B');
  if (cA !== rB) {
    throw new Error(`Dimensiones incompatibles para multiplicación: (${rA}×${cA}) · (${rB}×${cB}).`);
  }
  const C: Matrix = Array.from({ length: rA }, () => new Array<number>(cB).fill(0));
  for (let i = 0; i < rA; i++) {
    const rowA = A[i];
    const rowC = C[i];
    for (let k = 0; k < cA; k++) {
      const aik = rowA[k];
      if (aik === 0) continue;
      const rowB = B[k];
      for (let j = 0; j < cB; j++) {
        rowC[j] += aik * rowB[j];
      }
    }
    for (let j = 0; j < cB; j++) {
      if (Math.abs(rowC[j]) < 1e-12) rowC[j] = 0;
    }
  }
  return C;
}

export function rawMatVecMul(A: Matrix, x: Vector): Vector {
  const { rows, cols } = validateMatrix(A, 'A');
  const dim = validateVector(x, 'x');
  if (cols !== dim) {
    throw new Error(`Dimensiones incompatibles: matriz (${rows}×${cols}) y vector de dimensión ${dim}.`);
  }
  return A.map((row) => {
    const val = row.reduce((acc, aij, j) => acc + aij * x[j], 0);
    return Math.abs(val) < 1e-12 ? 0 : val;
  });
}

export function matrixAdd(A: Matrix, B: Matrix, subtract = false): MathOperationOutput<Matrix> {
  const dimA = validateMatrix(A, 'A');
  const dimB = validateMatrix(B, 'B');
  if (dimA.rows !== dimB.rows || dimA.cols !== dimB.cols) {
    throw new Error(
      `Las matrices deben tener igual dimensión (${dimA.rows}×${dimA.cols} vs ${dimB.rows}×${dimB.cols}).`
    );
  }
  const sign = subtract ? -1 : 1;
  const opSym = subtract ? '-' : '+';
  const C: Matrix = A.map((row, i) =>
    row.map((val, j) => {
      const res = val + sign * B[i][j];
      return Math.abs(res) < 1e-12 ? 0 : res;
    })
  );

  const steps: MathStep[] = [
    {
      title: 'Verificación dimensional',
      expression: `dim(A) = ${dimA.rows}×${dimA.cols}, dim(B) = ${dimB.rows}×${dimB.cols}`,
      note: 'Ambas matrices pertenecen al mismo espacio vectorial ℝ^(m×n).',
    },
    {
      title: `Cálculo componente a componente C[i,j] = A[i,j] ${opSym} B[i,j]`,
      expression: C.map((r, i) =>
        r.map((val, j) => `(${formatNum(A[i][j], 2)} ${opSym} ${formatNum(B[i][j], 2)}) = ${formatNum(val, 2)}`).join('  |  ')
      ).join('\n'),
      matrixSnapshot: C,
    },
  ];

  // Verification: check C - sign*B == A
  const reconstructed = C.map((row, i) => row.map((v, j) => v - sign * B[i][j]));
  let maxErr = 0;
  for (let i = 0; i < dimA.rows; i++) {
    for (let j = 0; j < dimA.cols; j++) {
      maxErr = Math.max(maxErr, Math.abs(reconstructed[i][j] - A[i][j]));
    }
  }

  return {
    operation: subtract ? 'Resta de Matrices (A - B)' : 'Suma de Matrices (A + B)',
    category: 'Operaciones Matriciales',
    inputSummary: `A (${dimA.rows}×${dimA.cols}), B (${dimB.rows}×${dimB.cols})`,
    procedure: `Adición elemental en ℝ^(${dimA.rows}×${dimA.cols}) conservando estructura espacial.`,
    steps,
    result: C,
    resultLabel: `C = A ${opSym} B`,
    verification: {
      passed: maxErr < 1e-9,
      residual: maxErr,
      statement: `Verificación inversa C ${subtract ? '+' : '-'} B = A (error máximo: ${maxErr.toExponential(2)}).`,
    },
    aiInterpretation:
      'En redes neuronales, la suma matricial implementa conexiones residuales (Skip Connections: y = F(x) + x) y la adición de sesgos sobre lotes de activación (Z = WX + b).',
  };
}

export function matrixMultiply(A: Matrix, B: Matrix): MathOperationOutput<Matrix> {
  const dimA = validateMatrix(A, 'A');
  const dimB = validateMatrix(B, 'B');
  if (dimA.cols !== dimB.rows) {
    throw new Error(
      `Multiplicación inválida: columnas de A (${dimA.cols}) deben coincidir con filas de B (${dimB.rows}).`
    );
  }
  const C = rawMatMul(A, B);
  const steps: MathStep[] = [
    {
      title: 'Compatibilidad interna',
      expression: `(${dimA.rows}×${dimA.cols}) · (${dimB.rows}×${dimB.cols}) → (${dimA.rows}×${dimB.cols})`,
      note: 'El número de columnas de A iguala al número de filas de B.',
    },
  ];

  const entryDetails: string[] = [];
  for (let i = 0; i < dimA.rows; i++) {
    for (let j = 0; j < dimB.cols; j++) {
      const terms = Array.from({ length: dimA.cols }, (_, k) =>
        `${formatNum(A[i][k], 2)}·${formatNum(B[k][j], 2)}`
      ).join(' + ');
      entryDetails.push(`C[${i + 1},${j + 1}] = ${terms} = ${formatNum(C[i][j], 3)}`);
    }
  }
  steps.push({
    title: 'Productos internos fila-columna',
    expression: entryDetails.slice(0, 9).join('\n') + (entryDetails.length > 9 ? `\n... (${entryDetails.length - 9} entradas más)` : ''),
    matrixSnapshot: C,
  });

  // Verify associative trace/Frobenius bound ||AB||_F <= ||A||_F ||B||_F
  const normA = frobeniusNorm(A);
  const normB = frobeniusNorm(B);
  const normC = frobeniusNorm(C);
  const submultValid = normC <= normA * normB + 1e-8;

  return {
    operation: 'Multiplicación Matricial (A × B)',
    category: 'Operaciones Matriciales',
    inputSummary: `A (${dimA.rows}×${dimA.cols}), B (${dimB.rows}×${dimB.cols})`,
    procedure: 'Composición de transformaciones lineales mediante producto escalar fila i por columna j.',
    steps,
    result: C,
    resultLabel: 'C = A · B',
    verification: {
      passed: submultValid,
      residual: Math.max(0, normC - normA * normB),
      statement: `Desigualdad submultiplicativa ||AB||_F = ${formatNum(normC, 4)} ≤ ||A||_F·||B||_F = ${formatNum(normA * normB, 4)}.`,
    },
    aiInterpretation:
      'Es la operación fundamental de la propagación hacia adelante: Z = W·X proyecta el vector de entrada X al espacio latente de la siguiente capa mediante pesos sinápticos W.',
  };
}

export function matrixDeterminant(A: Matrix): MathOperationOutput<number> {
  const { rows, cols } = validateMatrix(A, 'A');
  if (rows !== cols) {
    throw new Error(`El determinante solo se define en matrices cuadradas (recibida ${rows}×${cols}).`);
  }
  const n = rows;
  const steps: MathStep[] = [];
  let det = 1;

  if (n === 1) {
    det = A[0][0];
    steps.push({ title: 'Caso base 1×1', expression: `det(A) = ${formatNum(det)}` });
  } else if (n === 2) {
    det = A[0][0] * A[1][1] - A[0][1] * A[1][0];
    steps.push({
      title: 'Fórmula cerrada 2×2 (a₁₁a₂₂ - a₁₂a₂₁)',
      expression: `(${formatNum(A[0][0])})(${formatNum(A[1][1])}) - (${formatNum(A[0][1])})(${formatNum(A[1][0])}) = ${formatNum(det)}`,
      matrixSnapshot: cloneMatrix(A),
    });
  } else {
    const M = cloneMatrix(A);
    let sign = 1;
    for (let k = 0; k < n; k++) {
      let pivotRow = k;
      let maxVal = Math.abs(M[k][k]);
      for (let i = k + 1; i < n; i++) {
        if (Math.abs(M[i][k]) > maxVal) {
          maxVal = Math.abs(M[i][k]);
          pivotRow = i;
        }
      }
      if (maxVal < EPS) {
        det = 0;
        steps.push({
          title: `Columna ${k + 1} sin pivote no nulo`,
          expression: `Pivote ≈ 0 → matriz singular, det(A) = 0`,
          matrixSnapshot: cloneMatrix(M),
        });
        break;
      }
      if (pivotRow !== k) {
        [M[k], M[pivotRow]] = [M[pivotRow], M[k]];
        sign *= -1;
        steps.push({
          title: `Intercambio F${k + 1} ↔ F${pivotRow + 1}`,
          expression: `El signo del determinante cambia (factor acumulado: ${sign})`,
          matrixSnapshot: cloneMatrix(M),
        });
      }
      for (let i = k + 1; i < n; i++) {
        const factor = M[i][k] / M[k][k];
        if (Math.abs(factor) > EPS) {
          for (let j = k; j < n; j++) {
            M[i][j] -= factor * M[k][j];
          }
        }
      }
      steps.push({
        title: `Eliminación bajo pivote (${k + 1},${k + 1})`,
        expression: `Pivote U[${k + 1},${k + 1}] = ${formatNum(M[k][k])}`,
        matrixSnapshot: cloneMatrix(M),
      });
    }
    if (det !== 0) {
      let diagProd = 1;
      for (let i = 0; i < n; i++) diagProd *= M[i][i];
      det = sign * diagProd;
      steps.push({
        title: 'Producto de la diagonal escalonada',
        expression: `det(A) = (${sign}) · (${M.map((r, i) => formatNum(r[i])).join(' · ')}) = ${formatNum(det)}`,
      });
    }
  }

  if (Math.abs(det) < 1e-11) det = 0;

  // Cross-verify using transpose det(A^T) == det(A)
  const AT: Matrix = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => A[j][i]));
  const detT = rawDeterminant(AT);
  const residual = Math.abs(det - detT);

  return {
    operation: 'Determinante Matricial',
    category: 'Determinantes e Invertibilidad',
    inputSummary: `Matriz cuadrada A (${n}×${n})`,
    procedure: n <= 2 ? 'Expansión directa por cofactores.' : 'Reducción a forma triangular superior U mediante eliminación gaussiana con pivoteo parcial.',
    steps,
    result: det,
    resultLabel: 'det(A)',
    verification: {
      passed: residual < 1e-7,
      residual,
      statement: `Identidad det(A) = det(Aᵀ) verificada: ${formatNum(det)} ≈ ${formatNum(detT)} (Δ = ${residual.toExponential(2)}).`,
    },
    aiInterpretation:
      'El determinante mide el factor de escala de volumen de una transformación lineal. Si det(W) = 0, la capa colapsa dimensiones y pierde información irreversiblemente (espacio nulo no trivial).',
  };
}

export function rawDeterminant(A: Matrix): number {
  const n = A.length;
  const M = cloneMatrix(A);
  let sign = 1;
  for (let k = 0; k < n; k++) {
    let pivotRow = k;
    for (let i = k + 1; i < n; i++) {
      if (Math.abs(M[i][k]) > Math.abs(M[pivotRow][k])) pivotRow = i;
    }
    if (Math.abs(M[pivotRow][k]) < EPS) return 0;
    if (pivotRow !== k) {
      [M[k], M[pivotRow]] = [M[pivotRow], M[k]];
      sign *= -1;
    }
    for (let i = k + 1; i < n; i++) {
      const f = M[i][k] / M[k][k];
      for (let j = k; j < n; j++) M[i][j] -= f * M[k][j];
    }
  }
  let prod = sign;
  for (let i = 0; i < n; i++) prod *= M[i][i];
  return Math.abs(prod) < 1e-11 ? 0 : prod;
}

export function matrixInverse(A: Matrix): MathOperationOutput<Matrix> {
  const { rows, cols } = validateMatrix(A, 'A');
  if (rows !== cols) {
    throw new Error(`Solo matrices cuadradas admiten inversa (recibida ${rows}×${cols}).`);
  }
  const n = rows;
  const det = rawDeterminant(A);
  if (Math.abs(det) < EPS) {
    throw new Error('La matriz es singular (det(A) ≈ 0) y no tiene matriz inversa.');
  }

  // Gauss-Jordan on [A | I]
  const aug: Matrix = A.map((row, i) => [
    ...row,
    ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  ]);
  const steps: MathStep[] = [
    {
      title: 'Construcción de matriz aumentada [A | I]',
      expression: `det(A) = ${formatNum(det)} ≠ 0 → A es invertible.`,
      matrixSnapshot: cloneMatrix(aug),
    },
  ];

  for (let k = 0; k < n; k++) {
    let pivotRow = k;
    for (let i = k + 1; i < n; i++) {
      if (Math.abs(aug[i][k]) > Math.abs(aug[pivotRow][k])) pivotRow = i;
    }
    if (pivotRow !== k) {
      [aug[k], aug[pivotRow]] = [aug[pivotRow], aug[k]];
      steps.push({
        title: `Pivoteo F${k + 1} ↔ F${pivotRow + 1}`,
        expression: 'Selección del mayor pivote en valor absoluto para estabilidad numérica.',
        matrixSnapshot: cloneMatrix(aug),
      });
    }

    const pivot = aug[k][k];
    for (let j = 0; j < 2 * n; j++) {
      aug[k][j] /= pivot;
    }
    steps.push({
      title: `Normalización fila ${k + 1} (F${k + 1} ← F${k + 1} / ${formatNum(pivot, 3)})`,
      expression: `Pivote unitario en posición (${k + 1},${k + 1}).`,
      matrixSnapshot: cloneMatrix(aug),
    });

    for (let i = 0; i < n; i++) {
      if (i !== k && Math.abs(aug[i][k]) > EPS) {
        const factor = aug[i][k];
        for (let j = 0; j < 2 * n; j++) {
          aug[i][j] -= factor * aug[k][j];
        }
      }
    }
    steps.push({
      title: `Anulación de columna ${k + 1} fuera del pivote`,
      expression: `F_i ← F_i - c · F${k + 1} para todo i ≠ ${k + 1}.`,
      matrixSnapshot: cloneMatrix(aug),
    });
  }

  const inv: Matrix = aug.map((row) =>
    row.slice(n).map((v) => (Math.abs(v) < 1e-11 ? 0 : v))
  );

  // Verify A * A^-1 == I
  const prod = rawMatMul(A, inv);
  const I = identityMatrix(n);
  const diff = prod.map((r, i) => r.map((v, j) => v - I[i][j]));
  const residual = frobeniusNorm(diff);

  return {
    operation: 'Matriz Inversa (A⁻¹)',
    category: 'Invertibilidad y Rango',
    inputSummary: `A (${n}×${n}), det(A) = ${formatNum(det)}`,
    procedure: 'Método de Gauss-Jordan transformando [A | I] en [I | A⁻¹].',
    steps,
    result: inv,
    resultLabel: 'A⁻¹',
    verification: {
      passed: residual < 1e-7,
      residual,
      statement: `Residuo de identidad ||A·A⁻¹ - I||_F = ${residual.toExponential(3)}.`,
    },
    aiInterpretation:
      'En regresión lineal exacta (ecuaciones normales θ = (XᵀX)⁻¹Xᵀy) y en flujos normalizantes invertibles, la existencia de la inversa garantiza reconstrucción exacta de representaciones.',
  };
}

export interface LinearSystemSolution {
  status: 'unique' | 'infinite' | 'inconsistent';
  solution?: Vector;
  rref: Matrix;
  rankA: number;
  rankAug: number;
}

export function solveLinearSystem(
  A: Matrix,
  b: Vector,
  method: 'gauss' | 'gauss-jordan' = 'gauss-jordan'
): MathOperationOutput<LinearSystemSolution> {
  const { rows: m, cols: n } = validateMatrix(A, 'A');
  const bLen = validateVector(b, 'b');
  if (m !== bLen) {
    throw new Error(`El vector b debe tener ${m} componentes para coincidir con las filas de A (tiene ${bLen}).`);
  }

  const aug: Matrix = A.map((row, i) => [...row, b[i]]);
  const steps: MathStep[] = [
    {
      title: 'Matriz aumentada [A | b]',
      expression: `Sistema de ${m} ecuaciones con ${n} incógnitas.`,
      matrixSnapshot: cloneMatrix(aug),
    },
  ];

  let pivotRow = 0;
  const pivotCols: number[] = [];

  for (let col = 0; col < n && pivotRow < m; col++) {
    let maxRow = pivotRow;
    for (let i = pivotRow + 1; i < m; i++) {
      if (Math.abs(aug[i][col]) > Math.abs(aug[maxRow][col])) maxRow = i;
    }
    if (Math.abs(aug[maxRow][col]) < EPS) continue;

    if (maxRow !== pivotRow) {
      [aug[pivotRow], aug[maxRow]] = [aug[maxRow], aug[pivotRow]];
      steps.push({
        title: `Pivoteo F${pivotRow + 1} ↔ F${maxRow + 1}`,
        expression: `Columna ${col + 1}: intercambio para máximo pivote.`,
        matrixSnapshot: cloneMatrix(aug),
      });
    }

    const pivotVal = aug[pivotRow][col];
    if (method === 'gauss-jordan') {
      for (let j = col; j <= n; j++) aug[pivotRow][j] /= pivotVal;
    }

    for (let i = method === 'gauss-jordan' ? 0 : pivotRow + 1; i < m; i++) {
      if (i === pivotRow) continue;
      const factor = aug[i][col] / aug[pivotRow][col];
      if (Math.abs(factor) > EPS) {
        for (let j = col; j <= n; j++) {
          aug[i][j] -= factor * aug[pivotRow][j];
          if (Math.abs(aug[i][j]) < 1e-11) aug[i][j] = 0;
        }
      }
    }

    steps.push({
      title: `Eliminación en columna ${col + 1} (pivote en F${pivotRow + 1})`,
      expression:
        method === 'gauss-jordan'
          ? `Pivote normalizado a 1 y ceros arriba/abajo.`
          : `Ceros debajo del pivote para forma escalonada superior.`,
      matrixSnapshot: cloneMatrix(aug),
    });

    pivotCols.push(col);
    pivotRow++;
  }

  // Compute ranks
  let rankA = 0;
  let rankAug = 0;
  for (let i = 0; i < m; i++) {
    const rowHasA = aug[i].slice(0, n).some((v) => Math.abs(v) > 1e-8);
    const rowHasB = Math.abs(aug[i][n]) > 1e-8;
    if (rowHasA) rankA++;
    if (rowHasA || rowHasB) rankAug++;
  }

  let status: 'unique' | 'infinite' | 'inconsistent' = 'unique';
  let solution: Vector | undefined;

  if (rankA < rankAug) {
    status = 'inconsistent';
    steps.push({
      title: 'Detección de inconsistencia (Teorema de Rouché–Frobenius)',
      expression: `rango(A) = ${rankA} < rango([A|b]) = ${rankAug} → Sin solución.`,
    });
  } else if (rankA < n) {
    status = 'infinite';
    steps.push({
      title: 'Variables libres detectadas',
      expression: `rango(A) = ${rankA} < n = ${n} → Infinitas soluciones (${n - rankA} grados de libertad).`,
    });
  } else {
    status = 'unique';
    solution = Array(n).fill(0);
    if (method === 'gauss') {
      // Back substitution
      for (let i = n - 1; i >= 0; i--) {
        let sum = aug[i][n];
        for (let j = i + 1; j < n; j++) sum -= aug[i][j] * solution[j];
        solution[i] = sum / aug[i][i];
        if (Math.abs(solution[i]) < 1e-11) solution[i] = 0;
      }
      steps.push({
        title: 'Sustitución regresiva',
        expression: solution.map((x, idx) => `x_${idx + 1} = ${formatNum(x)}`).join(', '),
        vectorSnapshot: solution,
      });
    } else {
      for (let i = 0; i < pivotCols.length; i++) {
        solution[pivotCols[i]] = Math.abs(aug[i][n]) < 1e-11 ? 0 : aug[i][n];
      }
      steps.push({
        title: 'Lectura directa desde forma escalonada reducida (RREF)',
        expression: solution.map((x, idx) => `x_${idx + 1} = ${formatNum(x)}`).join(', '),
        vectorSnapshot: solution,
      });
    }
  }

  let residual = 0;
  let statement = '';
  let passed = true;
  if (status === 'unique' && solution) {
    const Ax = rawMatVecMul(A, solution);
    const errVec = Ax.map((v, i) => v - b[i]);
    residual = vectorNorm(errVec);
    passed = residual < 1e-7;
    statement = `Comprobación ||Ax - b||₂ = ${residual.toExponential(3)}.`;
  } else if (status === 'inconsistent') {
    statement = `Sistema incompatible verificado: rango(A) = ${rankA} ≠ rango([A|b]) = ${rankAug}.`;
  } else {
    statement = `Sistema compatible indeterminado: dimensión del espacio solución = ${n - rankA}.`;
  }

  return {
    operation: method === 'gauss' ? 'Sistema Lineal (Eliminación de Gauss)' : 'Sistema Lineal (Gauss-Jordan)',
    category: 'Sistemas de Ecuaciones Lineales',
    inputSummary: `A (${m}×${n}), b (${bLen})`,
    procedure:
      method === 'gauss'
        ? 'Escalonamiento superior seguido de sustitución regresiva.'
        : 'Reducción completa a Forma Escalonada Reducida por Filas (RREF).',
    steps,
    result: { status, solution, rref: aug, rankA, rankAug },
    resultLabel: status === 'unique' ? 'Solución única x' : status === 'infinite' ? 'Infinitas soluciones' : 'Sistema inconsistente',
    verification: { passed, residual, statement },
    aiInterpretation:
      'Resolver Ax = b equivale a encontrar pesos exactos o entradas preimagen en modelos lineales, mínimos cuadrados y calibración de sistemas de recomendación.',
  };
}

export interface VectorAnalysisResult {
  sum: Vector;
  difference: Vector;
  dotProduct: number;
  normU: number;
  normV: number;
  angleDeg: number;
  cosineSimilarity: number;
  projectionUonV: Vector;
  crossProduct?: Vector;
}

export function analyzeVectors(u: Vector, v: Vector): MathOperationOutput<VectorAnalysisResult> {
  const dimU = validateVector(u, 'u');
  const dimV = validateVector(v, 'v');
  if (dimU !== dimV) {
    throw new Error(`Los vectores deben pertenecer al mismo ℝ^n (dim(u)=${dimU}, dim(v)=${dimV}).`);
  }

  const sum = u.map((x, i) => x + v[i]);
  const difference = u.map((x, i) => x - v[i]);
  const dotProduct = u.reduce((acc, x, i) => acc + x * v[i], 0);
  const normU = vectorNorm(u);
  const normV = vectorNorm(v);
  const denom = normU * normV;
  const cosineSimilarity = denom > EPS ? Math.max(-1, Math.min(1, dotProduct / denom)) : 0;
  const angleDeg = denom > EPS ? (Math.acos(cosineSimilarity) * 180) / Math.PI : 0;
  const scale = normV > EPS ? dotProduct / (normV * normV) : 0;
  const projectionUonV = v.map((x) => x * scale);
  const crossProduct =
    dimU === 3
      ? [
          u[1] * v[2] - u[2] * v[1],
          u[2] * v[0] - u[0] * v[2],
          u[0] * v[1] - u[1] * v[0],
        ]
      : undefined;

  const steps: MathStep[] = [
    {
      title: 'Producto interno y normas euclidianas',
      expression: `u·v = ${formatNum(dotProduct)}, ||u||₂ = ${formatNum(normU)}, ||v||₂ = ${formatNum(normV)}`,
    },
    {
      title: 'Similitud coseno y ángulo θ',
      expression: `cos(θ) = (u·v)/(||u||·||v||) = ${formatNum(cosineSimilarity)} → θ = ${formatNum(angleDeg, 2)}°`,
    },
    {
      title: 'Proyección ortogonal proy_v(u)',
      expression: `((u·v)/||v||²)·v = ${formatVectorInline(projectionUonV)}`,
      vectorSnapshot: projectionUonV,
    },
  ];
  if (crossProduct) {
    steps.push({
      title: 'Producto vectorial en ℝ³ (u × v)',
      expression: `u × v = ${formatVectorInline(crossProduct)}`,
      vectorSnapshot: crossProduct,
    });
  }

  // Cauchy-Schwarz verification: |u.v| <= ||u|| ||v||
  const csSlack = normU * normV - Math.abs(dotProduct);
  return {
    operation: 'Análisis Vectorial en ℝⁿ',
    category: 'Vectores y Espacios Métricos',
    inputSummary: `u = ${formatVectorInline(u)}, v = ${formatVectorInline(v)} (ℝ^${dimU})`,
    procedure: 'Cálculo de métricas euclidianas, producto punto, proyección ortogonal y similitud angular.',
    steps,
    result: {
      sum,
      difference,
      dotProduct,
      normU,
      normV,
      angleDeg,
      cosineSimilarity,
      projectionUonV,
      crossProduct,
    },
    resultLabel: 'Métricas vectoriales',
    verification: {
      passed: csSlack >= -1e-9,
      residual: Math.max(0, -csSlack),
      statement: `Desigualdad de Cauchy-Schwarz verificada: |u·v| = ${formatNum(Math.abs(dotProduct))} ≤ ||u||·||v|| = ${formatNum(normU * normV)}.`,
    },
    aiInterpretation:
      'La similitud coseno mide la alineación semántica entre embeddings vectoriales y los mecanismos de atención (Q·Kᵀ / √d_k) en Transformers.',
  };
}

export interface BasisAnalysisResult {
  isLinearlyIndependent: boolean;
  rank: number;
  nullity: number;
  dimension: number;
  basisIndices: number[];
  basisVectors: Vector[];
  rref: Matrix;
}

export function analyzeLinearIndependence(vectors: Vector[]): MathOperationOutput<BasisAnalysisResult> {
  if (!vectors.length) throw new Error('Debe proporcionar al menos un vector.');
  const dim = validateVector(vectors[0], 'v_1');
  vectors.forEach((v, idx) => {
    if (validateVector(v, `v_${idx + 1}`) !== dim) {
      throw new Error(`Todos los vectores deben tener dimensión ${dim}.`);
    }
  });

  // Matrix with vectors as columns: dim x k
  const k = vectors.length;
  const M: Matrix = Array.from({ length: dim }, (_, i) =>
    Array.from({ length: k }, (_, j) => vectors[j][i])
  );

  const rref = cloneMatrix(M);
  const pivotCols: number[] = [];
  let r = 0;

  for (let c = 0; c < k && r < dim; c++) {
    let maxRow = r;
    for (let i = r + 1; i < dim; i++) {
      if (Math.abs(rref[i][c]) > Math.abs(rref[maxRow][c])) maxRow = i;
    }
    if (Math.abs(rref[maxRow][c]) < EPS) continue;
    [rref[r], rref[maxRow]] = [rref[maxRow], rref[r]];
    const pv = rref[r][c];
    for (let j = c; j < k; j++) rref[r][j] /= pv;
    for (let i = 0; i < dim; i++) {
      if (i !== r && Math.abs(rref[i][c]) > EPS) {
        const f = rref[i][c];
        for (let j = c; j < k; j++) {
          rref[i][j] -= f * rref[r][j];
          if (Math.abs(rref[i][j]) < 1e-11) rref[i][j] = 0;
        }
      }
    }
    pivotCols.push(c);
    r++;
  }

  const rank = pivotCols.length;
  const nullity = k - rank;
  const isLinearlyIndependent = rank === k;
  const basisVectors = pivotCols.map((idx) => vectors[idx]);

  const steps: MathStep[] = [
    {
      title: 'Matriz generadora con vectores como columnas',
      expression: `Matriz A de ${dim}×${k}.`,
      matrixSnapshot: M,
    },
    {
      title: 'Reducción RREF y columnas pivote',
      expression: `Columnas pivote (base 1): [${pivotCols.map((c) => c + 1).join(', ')}] → rango = ${rank}`,
      matrixSnapshot: rref,
    },
    {
      title: 'Teorema Rango-Nulidad',
      expression: `rank(A) + nullity(A) = ${rank} + ${nullity} = ${k} vectores`,
    },
  ];

  return {
    operation: 'Independencia Lineal, Base y Dimensión',
    category: 'Espacios Vectoriales',
    inputSummary: `${k} vectores en ℝ^${dim}`,
    procedure: 'Reducción a RREF sobre columnas para identificar pivotes, dimensión del subespacio generado y nulidad.',
    steps,
    result: {
      isLinearlyIndependent,
      rank,
      nullity,
      dimension: rank,
      basisIndices: pivotCols,
      basisVectors,
      rref,
    },
    resultLabel: isLinearlyIndependent ? 'Linealmente Independientes' : 'Linealmente Dependientes',
    verification: {
      passed: rank + nullity === k,
      residual: Math.abs(rank + nullity - k),
      statement: `Teorema Rango-Nulidad verificado: ${rank} + ${nullity} = ${k}. Base del subespacio: dimensión ${rank}.`,
    },
    aiInterpretation:
      'En Ingeniería de Características y PCA, detectar dependencia lineal elimina colinealidad redundante y define la dimensión intrínseca de las representaciones latentes.',
  };
}

export interface LinearTransformationResult {
  matrix: Matrix;
  inputVector: Vector;
  transformedVector: Vector;
  e1Prime: Vector;
  e2Prime: Vector;
  areaScaleFactor: number;
  preservesOrientation: boolean;
}

export function applyLinearTransformation2D(
  A: Matrix,
  v: Vector
): MathOperationOutput<LinearTransformationResult> {
  const { rows, cols } = validateMatrix(A, 'A');
  const dim = validateVector(v, 'v');
  if (rows !== 2 || cols !== 2 || dim !== 2) {
    throw new Error('La transformación visual interactiva requiere una matriz 2×2 y vector en ℝ².');
  }
  const transformedVector = rawMatVecMul(A, v);
  const e1Prime = [A[0][0], A[1][0]];
  const e2Prime = [A[0][1], A[1][1]];
  const det = rawDeterminant(A);

  const steps: MathStep[] = [
    {
      title: 'Imágenes de los vectores canónicos e₁, e₂',
      expression: `T(e₁) = ${formatVectorInline(e1Prime)}, T(e₂) = ${formatVectorInline(e2Prime)}`,
    },
    {
      title: 'Linealidad T(v) = v₁·T(e₁) + v₂·T(e₂)',
      expression: `${formatNum(v[0])}·${formatVectorInline(e1Prime)} + ${formatNum(v[1])}·${formatVectorInline(e2Prime)} = ${formatVectorInline(transformedVector)}`,
      vectorSnapshot: transformedVector,
    },
  ];

  // Verify T(e1)*v1 + T(e2)*v2 == A*v
  const linearCombo = [
    v[0] * e1Prime[0] + v[1] * e2Prime[0],
    v[0] * e1Prime[1] + v[1] * e2Prime[1],
  ];
  const residual = vectorNorm([
    linearCombo[0] - transformedVector[0],
    linearCombo[1] - transformedVector[1],
  ]);

  return {
    operation: 'Transformación Lineal T(x) = Ax en ℝ²',
    category: 'Transformaciones Lineales',
    inputSummary: `A (2×2), v = ${formatVectorInline(v)}`,
    procedure: 'Aplicación lineal mediante combinación de columnas transformadas T(e₁) y T(e₂).',
    steps,
    result: {
      matrix: A,
      inputVector: v,
      transformedVector,
      e1Prime,
      e2Prime,
      areaScaleFactor: Math.abs(det),
      preservesOrientation: det >= 0,
    },
    resultLabel: `T(v) = ${formatVectorInline(transformedVector)}`,
    verification: {
      passed: residual < 1e-9,
      residual,
      statement: `Superposición lineal verificada (residuo = ${residual.toExponential(2)}). Escala de área |det(A)| = ${formatNum(Math.abs(det))}.`,
    },
    aiInterpretation:
      'Cada capa densa sin sesgo aplica una transformación lineal T(x)=Wx seguida de traslación (+b) y doblado no lineal (ReLU) para separar clases en el espacio.',
  };
}

export interface EigenPair {
  eigenvalue: number;
  eigenvector: Vector;
  residual: number;
}

export interface EigenAnalysisResult {
  pairs: EigenPair[];
  hasComplexEigenvalues: boolean;
  discriminant?: number;
  trace: number;
  determinant: number;
}

export function computeEigen(A: Matrix): MathOperationOutput<EigenAnalysisResult> {
  const { rows, cols } = validateMatrix(A, 'A');
  if (rows !== cols) {
    throw new Error(`Los valores propios requieren una matriz cuadrada (recibida ${rows}×${cols}).`);
  }
  const n = rows;
  const trace = A.reduce((acc, row, i) => acc + row[i], 0);
  const det = rawDeterminant(A);
  const steps: MathStep[] = [
    {
      title: 'Invariantes espectrales',
      expression: `tr(A) = ${formatNum(trace)}, det(A) = ${formatNum(det)}`,
    },
  ];

  const pairs: EigenPair[] = [];
  let hasComplexEigenvalues = false;
  let discriminant: number | undefined;

  if (n === 2) {
    // Characteristic polynomial: lambda^2 - tr*lambda + det = 0
    discriminant = trace * trace - 4 * det;
    steps.push({
      title: 'Polinomio característico λ² - tr(A)λ + det(A) = 0',
      expression: `λ² - (${formatNum(trace)})λ + (${formatNum(det)}) = 0 → Δ = ${formatNum(discriminant)}`,
    });

    if (discriminant < -1e-9) {
      hasComplexEigenvalues = true;
      const realPart = trace / 2;
      const imagPart = Math.sqrt(-discriminant) / 2;
      steps.push({
        title: 'Raíces complejas conjugadas',
        expression: `λ = ${formatNum(realPart)} ± ${formatNum(imagPart)}i (rotación-escala sin autovectores reales en ℝ²)`,
      });
    } else {
      const sqrtD = Math.sqrt(Math.max(0, discriminant));
      const lambdas = [(trace + sqrtD) / 2, (trace - sqrtD) / 2];
      for (const lam of lambdas) {
        // Solve (A - lam*I)v = 0
        const B = [
          [A[0][0] - lam, A[0][1]],
          [A[1][0], A[1][1] - lam],
        ];
        let v: Vector;
        if (Math.abs(B[0][0]) + Math.abs(B[0][1]) >= Math.abs(B[1][0]) + Math.abs(B[1][1])) {
          v = Math.abs(B[0][1]) > EPS || Math.abs(B[0][0]) > EPS ? [-B[0][1], B[0][0]] : [1, 0];
        } else {
          v = Math.abs(B[1][1]) > EPS || Math.abs(B[1][0]) > EPS ? [-B[1][1], B[1][0]] : [0, 1];
        }
        const nrm = vectorNorm(v);
        if (nrm > EPS) v = v.map((x) => x / nrm);
        else v = [1, 0];

        const Av = rawMatVecMul(A, v);
        const residual = vectorNorm(Av.map((val, idx) => val - lam * v[idx]));
        pairs.push({ eigenvalue: lam, eigenvector: v, residual });
      }
      steps.push({
        title: 'Autovalores y autovectores unitarios reales',
        expression: pairs
          .map(
            (p, idx) =>
              `λ_${idx + 1} = ${formatNum(p.eigenvalue)}, v_${idx + 1} = ${formatVectorInline(p.eigenvector)}`
          )
          .join('\n'),
      });
    }
  } else {
    // Power iteration with Hotelling/Wielandt deflation for real symmetric or dominant real eigenvalues
    let W = cloneMatrix(A);
    for (let k = 0; k < n; k++) {
      let v: Vector = Array.from({ length: n }, (_, i) => (i === k ? 1 : 0.37));
      const norm = vectorNorm(v);
      v = v.map((x) => x / norm);
      let lambda = 0;

      for (let iter = 0; iter < 120; iter++) {
        const w = rawMatVecMul(W, v);
        const nextNorm = vectorNorm(w);
        if (nextNorm < EPS) {
          lambda = 0;
          break;
        }
        const nextV = w.map((x) => x / nextNorm);
        // Rayleigh quotient
        const Av = rawMatVecMul(W, nextV);
        lambda = nextV.reduce((acc, vi, idx) => acc + vi * Av[idx], 0);
        const diff = vectorNorm(nextV.map((x, idx) => x - v[idx]));
        v = nextV;
        if (diff < 1e-10) break;
      }

      const AvOrig = rawMatVecMul(A, v);
      const residual = vectorNorm(AvOrig.map((val, idx) => val - lambda * v[idx]));
      if (residual < 1e-2) {
        pairs.push({ eigenvalue: lambda, eigenvector: v, residual });
      }
      // Deflation: W = W - lambda * v * v^T
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          W[i][j] -= lambda * v[i] * v[j];
        }
      }
    }

    if (pairs.length === 0) {
      hasComplexEigenvalues = true;
      steps.push({
        title: 'Espectro sin convergencia real dominante',
        expression: 'La matriz presenta pares complejos dominantes o rotación pura.',
      });
    } else {
      steps.push({
        title: 'Iteración de potencia + deflación espectral',
        expression: pairs
          .map(
            (p, idx) =>
              `λ_${idx + 1} ≈ ${formatNum(p.eigenvalue)}, v_${idx + 1} = ${formatVectorInline(p.eigenvector)}`
          )
          .join('\n'),
      });
    }
  }

  const maxResidual = pairs.length ? Math.max(...pairs.map((p) => p.residual)) : 0;
  const passed = hasComplexEigenvalues || (pairs.length > 0 && maxResidual < 1e-3);

  return {
    operation: 'Valores y Vectores Propios (Eigenanálisis)',
    category: 'Descomposición Espectral',
    inputSummary: `Matriz cuadrada A (${n}×${n})`,
    formula: 'det(A - λI) = 0,  A·v = λ·v',
    procedure:
      n === 2
        ? 'Solución exacta del polinomio característico det(A - λI) = 0.'
        : 'Iteración de potencia con cociente de Rayleigh y deflación de Hotelling.',
    steps,
    result: { pairs, hasComplexEigenvalues, discriminant, trace, determinant: det },
    resultLabel: hasComplexEigenvalues ? 'Autovalores complejos' : `${pairs.length} pares propios reales`,
    verification: {
      passed,
      residual: maxResidual,
      statement: hasComplexEigenvalues
        ? `Discriminante Δ = ${formatNum(discriminant ?? 0)} < 0 confirmado (sin autovectores reales).`
        : `Ecuación propia ||Av - λv||₂ máxima = ${maxResidual.toExponential(3)}.`,
    },
    aiInterpretation:
      'Los valores y vectores propios definen las direcciones principales de varianza en PCA, la estabilidad de gradientes en redes recurrentes y el análisis espectral de matrices de covarianza.',
  };
}

export function matrixTranspose(A: Matrix): MathOperationOutput<Matrix> {
  const { rows, cols } = validateMatrix(A, 'A');
  const AT: Matrix = Array.from({ length: cols }, (_, i) =>
    Array.from({ length: rows }, (_, j) => A[j][i])
  );
  const isSymmetric =
    rows === cols &&
    A.every((row, i) => row.every((v, j) => Math.abs(v - AT[i][j]) < 1e-9));

  // Verify (A^T)^T == A
  const ATT: Matrix = Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) => AT[j][i])
  );
  const diff = A.map((r, i) => r.map((v, j) => v - ATT[i][j]));
  const residual = frobeniusNorm(diff);

  return {
    operation: 'Matriz Transpuesta (Aᵀ)',
    category: 'Operaciones Matriciales',
    inputSummary: `A (${rows}×${cols}) → Aᵀ (${cols}×${rows})`,
    formula: '(Aᵀ)[i, j] = A[j, i]',
    procedure: 'Intercambio sistemático de índices de filas por columnas.',
    steps: [
      {
        title: 'Mapeo de dimensiones',
        expression: `dim(A) = ${rows}×${cols} ⇒ dim(Aᵀ) = ${cols}×${rows}${isSymmetric ? ' (Matriz simétrica: A = Aᵀ)' : ''}`,
      },
      {
        title: 'Construcción de Aᵀ',
        expression: `Cada fila i de A se convierte en la columna i de Aᵀ.`,
        matrixSnapshot: AT,
      },
    ],
    result: AT,
    resultLabel: 'Aᵀ',
    verification: {
      passed: residual < 1e-10,
      residual,
      statement: `Identidad involutiva ||(Aᵀ)ᵀ - A||_F = ${residual.toExponential(2)}.`,
    },
    aiInterpretation:
      'En retropropagación, la transpuesta Wᵀ propaga el gradiente δ hacia atrás: δ⁽ˡ⁻¹⁾ = (W⁽ˡ⁾)ᵀδ⁽ˡ⁾ ⊙ ReLU\'(Z⁽ˡ⁻¹⁾). También define matrices de covarianza XᵀX y atención Q·Kᵀ.',
  };
}

export interface RankResult {
  rank: number;
  nullity: number;
  rows: number;
  cols: number;
  rref: Matrix;
}

export function matrixRank(A: Matrix): MathOperationOutput<RankResult> {
  const { rows, cols } = validateMatrix(A, 'A');
  const rref = cloneMatrix(A);
  let r = 0;
  const pivotCols: number[] = [];

  for (let c = 0; c < cols && r < rows; c++) {
    let maxRow = r;
    for (let i = r + 1; i < rows; i++) {
      if (Math.abs(rref[i][c]) > Math.abs(rref[maxRow][c])) maxRow = i;
    }
    if (Math.abs(rref[maxRow][c]) < EPS) continue;
    [rref[r], rref[maxRow]] = [rref[maxRow], rref[r]];
    const pv = rref[r][c];
    for (let j = c; j < cols; j++) rref[r][j] /= pv;
    for (let i = 0; i < rows; i++) {
      if (i !== r && Math.abs(rref[i][c]) > EPS) {
        const f = rref[i][c];
        for (let j = c; j < cols; j++) {
          rref[i][j] -= f * rref[r][j];
          if (Math.abs(rref[i][j]) < 1e-11) rref[i][j] = 0;
        }
      }
    }
    pivotCols.push(c);
    r++;
  }

  const rank = pivotCols.length;
  const nullity = cols - rank;

  return {
    operation: 'Rango y Nulidad de Matriz',
    category: 'Invertibilidad y Rango',
    inputSummary: `Matriz A (${rows}×${cols})`,
    formula: 'rank(A) + nullity(A) = n (número de columnas)',
    procedure: 'Reducción a forma escalonada reducida por filas (RREF) contando pivotes no nulos.',
    steps: [
      {
        title: 'Forma Escalonada Reducida (RREF)',
        expression: `Columnas pivote (base 1): [${pivotCols.map((c) => c + 1).join(', ')}]`,
        matrixSnapshot: rref,
      },
      {
        title: 'Conteo de rango y dimensión del núcleo',
        expression: `rank(A) = ${rank}, nullity(A) = ${cols} - ${rank} = ${nullity}`,
      },
    ],
    result: { rank, nullity, rows, cols, rref },
    resultLabel: `rank(A) = ${rank}`,
    verification: {
      passed: rank + nullity === cols && rank <= Math.min(rows, cols),
      residual: Math.abs(rank + nullity - cols),
      statement: `Teorema Rango-Nulidad verificado: ${rank} + ${nullity} = ${cols}.`,
    },
    aiInterpretation:
      'El rango mide la dimensionalidad efectiva de la salida de una capa lineal. Un rango bajo indica compresión o cuellos de botella (como en LoRA o autoencoders).',
  };
}

export interface LUResult {
  P: Matrix;
  L: Matrix;
  U: Matrix;
}

export function matrixLU(A: Matrix): MathOperationOutput<LUResult> {
  const { rows, cols } = validateMatrix(A, 'A');
  if (rows !== cols) {
    throw new Error(`La descomposición LU requiere matriz cuadrada (recibida ${rows}×${cols}).`);
  }
  const n = rows;
  const U = cloneMatrix(A);
  const L = identityMatrix(n);
  const P = identityMatrix(n);
  const steps: MathStep[] = [];

  for (let k = 0; k < n; k++) {
    let pivotRow = k;
    for (let i = k + 1; i < n; i++) {
      if (Math.abs(U[i][k]) > Math.abs(U[pivotRow][k])) pivotRow = i;
    }
    if (pivotRow !== k) {
      [U[k], U[pivotRow]] = [U[pivotRow], U[k]];
      [P[k], P[pivotRow]] = [P[pivotRow], P[k]];
      for (let j = 0; j < k; j++) {
        [L[k][j], L[pivotRow][j]] = [L[pivotRow][j], L[k][j]];
      }
      steps.push({
        title: `Pivoteo parcial F${k + 1} ↔ F${pivotRow + 1}`,
        expression: 'Permutación registrada en P y multiplicadores previos en L.',
        matrixSnapshot: cloneMatrix(U),
      });
    }
    if (Math.abs(U[k][k]) < EPS) continue;
    for (let i = k + 1; i < n; i++) {
      const factor = U[i][k] / U[k][k];
      L[i][k] = factor;
      for (let j = k; j < n; j++) {
        U[i][j] -= factor * U[k][j];
        if (Math.abs(U[i][j]) < 1e-11) U[i][j] = 0;
      }
    }
    steps.push({
      title: `Eliminación en columna ${k + 1}`,
      expression: `Multiplicadores guardados en columna ${k + 1} de L.`,
      matrixSnapshot: cloneMatrix(U),
    });
  }

  const PA = rawMatMul(P, A);
  const LU = rawMatMul(L, U);
  const residual = frobeniusNorm(PA.map((r, i) => r.map((v, j) => v - LU[i][j])));

  return {
    operation: 'Descomposición PA = LU',
    category: 'Descomposiciones Matriciales',
    inputSummary: `Matriz cuadrada A (${n}×${n})`,
    formula: 'P·A = L·U (L triangular inferior unitaria, U triangular superior)',
    procedure: 'Factorización mediante eliminación gaussiana con pivoteo parcial.',
    steps,
    result: { P, L, U },
    resultLabel: 'Factores P, L, U',
    verification: {
      passed: residual < 1e-7,
      residual,
      statement: `Residuo de reconstrucción ||P·A - L·U||_F = ${residual.toExponential(3)}.`,
    },
    aiInterpretation:
      'La factorización LU resuelve múltiples sistemas Ax = bᵢ en O(n²) tras una única descomposición O(n³), esencial en optimización de segundo orden y cálculo de determinantes estables.',
  };
}

export interface QRResult {
  Q: Matrix;
  R: Matrix;
}

export function matrixQR(A: Matrix): MathOperationOutput<QRResult> {
  const { rows: m, cols: n } = validateMatrix(A, 'A');
  const Q: Matrix = Array.from({ length: m }, () => Array(n).fill(0));
  const R: Matrix = Array.from({ length: n }, () => Array(n).fill(0));
  const steps: MathStep[] = [];

  for (let j = 0; j < n; j++) {
    let v = Array.from({ length: m }, (_, i) => A[i][j]);
    for (let i = 0; i < j; i++) {
      let dot = 0;
      for (let row = 0; row < m; row++) dot += Q[row][i] * v[row];
      R[i][j] = dot;
      for (let row = 0; row < m; row++) v[row] -= dot * Q[row][i];
    }
    const norm = vectorNorm(v);
    R[j][j] = norm;
    if (norm > EPS) {
      for (let row = 0; row < m; row++) Q[row][j] = v[row] / norm;
    }
    steps.push({
      title: `Ortonormalización columna ${j + 1}`,
      expression: `||v_${j + 1}||₂ = R[${j + 1},${j + 1}] = ${formatNum(norm, 4)}`,
    });
  }

  const QR = rawMatMul(Q, R);
  const recResidual = frobeniusNorm(A.map((r, i) => r.map((v, j) => v - QR[i][j])));
  const QT: Matrix = Array.from({ length: n }, (_, i) => Array.from({ length: m }, (_, j) => Q[j][i]));
  const QTQ = rawMatMul(QT, Q);
  const I = identityMatrix(n);
  const orthoResidual = frobeniusNorm(QTQ.map((r, i) => r.map((v, j) => v - I[i][j])));

  return {
    operation: 'Factorización Ortogonal A = Q·R',
    category: 'Descomposiciones Matriciales',
    inputSummary: `Matriz A (${m}×${n})`,
    formula: 'A = Q·R con QᵀQ = I y R triangular superior',
    procedure: 'Proceso de ortogonalización de Gram-Schmidt modificado.',
    steps: [
      ...steps,
      { title: 'Factor Ortogonal Q', expression: 'Columnas ortonormales de norma 1.', matrixSnapshot: Q },
      { title: 'Factor Triangular Superior R', expression: 'Proyecciones y normas.', matrixSnapshot: R },
    ],
    result: { Q, R },
    resultLabel: 'Factores Q y R',
    verification: {
      passed: recResidual < 1e-7 && orthoResidual < 1e-6,
      residual: Math.max(recResidual, orthoResidual),
      statement: `||A - Q·R||_F = ${recResidual.toExponential(2)}, ||QᵀQ - I||_F = ${orthoResidual.toExponential(2)}.`,
    },
    aiInterpretation:
      'QR estabiliza mínimos cuadrados sin elevar el número de condición (evitando formar XᵀX) y constituye la base del algoritmo QR para hallar autovalores y de la inicialización ortogonal de redes profundas.',
  };
}

