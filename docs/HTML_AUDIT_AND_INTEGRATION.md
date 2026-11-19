# Auditoría e Integración de `ABRIR_VECTORIA_PRO_SIN_INSTALAR.html` en VectorIA Studio

Este documento registra la auditoría técnica completa realizada sobre `public/assets/aistudio/ABRIR_VECTORIA_PRO_SIN_INSTALAR_e4a741b1.html` y su integración dentro de la arquitectura existente React + TypeScript + Vite + Express de **VectorIA Studio**.

---

## 1. Qué se conservó del HTML original

1. **Pesos reales de la red 784–128–10 (101,770 parámetros Float32)**:
   - Extraídos bit a bit desde `#offline-weights` hacia `src/engines/mnist784Data.ts` (`W1` de 784×128, `b1` de 128, `W2` de 128×10, `b2` de 10).
   - Se mantienen estrictamente de solo lectura para inferencia e inspección; ningún laboratorio altera sus pesos.
2. **Metadatos e informe histórico sintético (`#offline-meta`, `#offline-report`)**:
   - Curva de 10 épocas sintéticas (`loss` 1.8323 → 0.3796, `trainAccuracy` 0.4842 → 0.9425).
   - Matriz de confusión 10×10 evaluada sobre $N = 300$ muestras sintéticas (249 aciertos / 300 = **83.0%**, 51 errores).
   - Los 10 ejemplos sintéticos de dígitos `0–9` en resolución 28×28.
3. **Normalización MNIST sobre el lienzo 280×280**:
   - Recorte de caja envolvente (*bounding box*), ajuste proporcional a 20×20 y centrado en lienzo de 28×28 (`normalizeCanvasTo28x28`).
4. **Simulador didáctico independiente 2–3–2**:
   - Pesos iniciales exactos (`W1`, `b1`, `W2`, `b2`), activación ReLU oculta, Softmax de 2 clases, cálculo de $\delta_2, \delta_1$, gradientes analíticos y verificación numérica por diferencias finitas ($h = 10^{-5}$).

---

## 2. Qué se mejoró

1. **Lienzo manual 280×280 (`Mnist784LabPanel.tsx`)**:
   - Pila de **Deshacer** de hasta 10 pasos (`PointerEvent` compatible con mouse y pantallas táctiles).
   - Selector de modo **Pincel / Borrador** con grosor configurable (10–34 px) y botón **Limpiar**.
   - Comparación visual directa entre el trazo original 280×280 y el tensor procesado 28×28 interactivo, además de exportación CSV de probabilidades y logits `z2`.
2. **Inspector matemático profundo**:
   - Además de inspeccionar `x[i]`, `W₁[i,j]`, `xᵢ·Wᵢⱼ`, `b₁[j]`, `z₁[j]` y `a₁[j] = ReLU(z₁[j])`, ahora muestra los **8 píxeles más influyentes** sobre la neurona oculta seleccionada, las **10 proyecciones `a₁[j]·W₂[j,k]`** hacia cada logit de salida, una matriz interactiva 28×28 clicable y el vector plano $\mathbb{R}^{784}$.
3. **Laboratorio de perturbaciones ampliado (`Perturbation28x28Panel.tsx`)**:
   - Recupera desplazamiento X/Y y ruido del HTML original, y añade **rotación** ($\pm 30^\circ$), **escalamiento** ($0.65\times$ a $1.35\times$), **variación de grosor** (erosión/dilatación morfológica continua), **intensidad/contraste** y **distorsión sinusoidal**, con gráfica comparativa Softmax y tabla de diferencias antes/después.
4. **Simulador 2–3–2 editable (`Didactic232BackpropPanel.tsx`)**:
   - Ahora permite editar no solo `x₁, x₂`, objetivo y $\eta \in (0, 0.5]$, sino también **todos los pesos y sesgos** (`W₁`, `b₁`, `W₂`, `b₂`), ejecutar pasos individuales o lotes de +10 pasos con curva de pérdida, y verificar el error máximo por diferencias finitas en todas las matrices.

---

## 3. Qué se integró en React / TypeScript

- **`src/engines/mnist784Engine.ts` & `mnist784Data.ts`**: Motor determinístico tipado compatible con navegador y Node/Vitest.
- **`src/context/StudioContext.tsx`**: Estado compartido (`mnist784Pixels`, `mnist784Result`, `mnist784PerturbConfig`, `last232Step`) conectado transversalmente.
- **`AlphanumericClassifierView.tsx`**: Pestaña **`MNIST 784 (Original)`** junto a Dígitos (0–9), Letras (A–Z) y Alfanumérico (36 clases 16×16).
- **`RobustnessView.tsx` & `SimulationLabView.tsx`**: Acceso directo a las perturbaciones ampliadas 28×28 y al simulador 2–3–2 sin destruir el laboratorio 16×16 ni la red didáctica 3–2–2.
- **`NeuralEngineeringLabView.tsx`**: Modo **`Simulador 2–3–2 (HTML Original)`** aislado del entrenador MLP 16×16.
- **`NeuralTopologyView.tsx`**: Modo **`784–128–10 (Original)`** renderizando la topología y pesos reales $W_1, W_2$ sobre la entrada activa 28×28.
- **`AnalyticsView.tsx` & `EvaluationCenterView.tsx`**: Pestaña/comparativa **`784–128–10 (Sintético)`** con la matriz $N=300$ y las 10 épocas históricas.
- **`omniLocalEngine.ts` & `OmniBotView.tsx`**: Omni Bot inspecciona el estado 784–128–10, los pasos 2–3–2 y explica explícitamente que el 83.0% proviene de datos sintéticos y no de MNIST oficial.

---

## 4. Qué requiere un modelo adicional

- **Evaluación o reconocimiento sobre MNIST oficial manuscrito**:
  Los pesos incluidos en el HTML original (`101,770` parámetros) fueron entrenados únicamente con **1,200 imágenes sintéticas** y validados con **300 muestras sintéticas (83.0%)**. Para clasificar con precisión estándar sobre dígitos manuscritos reales de MNIST (60,000 entrenamiento / 10,000 prueba de Yann LeCun et al.) se necesita entrenar o cargar un conjunto adicional de pesos entrenado sobre el corpus MNIST oficial.

---

## 5. Qué pruebas se realizaron

- **Pruebas unitarias y de integración (`tests/vectoria.test.ts`)**:
  - Decodificación exacta de los 101,770 parámetros Float32 y verificación de finitud.
  - Verificación de invariancia de la matriz de confusión $N=300$ ($249/300 = 83.0\%$).
  - Inferencia determinística `infer784` ($\sum p_k = 1$) e inspector `inspectMnist784Neuron`.
  - Perturbaciones 28×28 puras sin mutar entrada ni pesos base (`id`, rotación, escala, grosor, intensidad, distorsión, ruido).
  - Verificación analítica vs diferencias finitas en el simulador 2–3–2 ($\text{error máx} < 10^{-5}$ y reducción de pérdida).
  - Validación de respuestas locales en Omni Bot sobre procedencia sintética vs MNIST oficial.
- **Compilación y análisis estático**: `npm test`, `compile_applet` (TypeScript + Vite build) y `lint_applet`.
