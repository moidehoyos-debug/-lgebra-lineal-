# ARCHITECTURE.md — Arquitectura Técnica de VectorIA Studio (v2.4.0)

## 1. Arquitectura General Cliente–Servidor

VectorIA Studio opera como una aplicación modular React 19 + TypeScript sobre Vite 8 y un backend Express 4 en Node.js 22 ESM (`server.ts`):

```text
Navegador (React 19 + Tailwind CSS v4 + Recharts + D3 + Three.js bajo demanda)
  ├── ThemeContext (6 temas globales síncronos + override no destructivo de Builder)
  ├── StudioContext (motores MLP, MNIST 784, simulaciones, respaldos AES-256-GCM / JSON)
  ├── BuilderContext (estado publicado dinámico, navegación personalizada, CSS variables)
  ├── BuilderModificationProvider (builderContext.ts — overrides no destructivos)
  └── Módulos cargados bajo demanda (React.lazy + ModuleErrorBoundary)
        ├── NeuralTopologyView (2D Canvas + 3D WebGL Three.js lazy)
        ├── SmartIrrigationLabView (MLP 2–4–1 aislado)
        ├── OmniBotView (Chat híbrido + Comandos Rápidos + JarvisDemoPlayer)
        └── VisualBuilderView (Nivel 1 + Nivel 2 + ZipExportModal)
              │  Bearer HMAC-SHA256 / JSON sanitizado / Stream ZIP validado
              ▼
Servidor Express 4 (server.ts — Puerto 3000, Node 22 ESM)
  ├── Seguridad por capas: CSP, CORS allowlist, Rate Limiting, scrypt + HMAC + setupToken
  ├── IA Backend: server/geminiService.ts + server/omniTools.ts (FunctionDeclarations)
  ├── Endpoints: /api/health, /api/diagnostics, /api/verify-math, /api/omni/chat
  └── Visual Builder, Exportador ZIP y Respaldos:
        server/builderStore.ts, server/projectExporter.ts, server/backupScheduler.ts
```

---

## 2. Capas del Frontend (`src/`)

### 2.1 Contextos y Configuración Global
- **`src/config/team.ts` & `src/components/TeamCredits.tsx`**: Configuración centralizada editable e interfaz de créditos del equipo oficial (`01 Moisés de Hoyos`, `02 Isaías Alvarado`, `03 Rivaldo Calvo`).
- **`src/context/ThemeContext.tsx`**: Gestiona los 6 temas globales con actualización síncrona y cero parpadeos.
- **`src/context/StudioContext.tsx`**: Administra los 3 modelos MLP (`16×16`), la red 784–128–10 en modo lectura, simulaciones aisladas, historial de entrenamiento/eventos y respaldos.
- **`src/context/BuilderContext.tsx`**: Sincroniza `/api/builder/published`, gestiona tokens Bearer HMAC-SHA256, `setupToken` de inicialización inicial y páginas personalizadas en `src/App.tsx`.

### 2.2 Motores Matemáticos, Neuronales y Didácticos (`src/engines/`)
- `linearAlgebra.ts`: Operaciones matriciales, Gauss-Jordan, rango, $PA=LU$, $A=QR$ y eigenanálisis verificados por residuo.
- `neuralEngine.ts` & `mnist784Engine.ts`: Clasificadores `16×16`, red `784–128–10` y simulador didáctico `2–3–2`.
- `smartIrrigationEngine.ts`: Red neuronal educativa `2 → 4 (ReLU) → 1 (Sigmoide)` completamente aislada (17 parámetros, BCE, gradientes analíticos verificados y dataset sintético 16+8).
- `jarvisDemoEngine.ts`: Secuencias sincronizadas por fotogramas calculadas en vivo sobre los motores reales (`neural-learning`, `smart-irrigation`, `matrix-multiply`, `prediction-explain`, `before-after`).
- `simulationEngine.ts` & `omniLocalEngine.ts`: Experimentos A/B aislados y motor matemático local determinístico.

### 2.3 Visualización 2D/3D y Modo Jarvis
- `src/components/NeuralTopology3DCanvas.tsx`: Escena Three.js aislada con `OrbitControls`, raycasting de neuronas, pulsos sinápticos acotados, detección de renderizadores WebGL por software, soporte `prefers-reduced-motion` y limpieza completa de geometrías/materiales/WebGL al desmontar.
- `src/components/JarvisDemoPlayer.tsx`: Lienzo sincronizado adaptable a los 6 temas, control de velocidad (`0.5x/1x/1.5x`), narración básica/avanzada, síntesis de voz opcional (`SpeechSynthesis`) y captura WebM (`captureStream` + `MediaRecorder`).

---

## 3. Capa Backend, IA y Seguridad (`server.ts`, `server/`)

### 3.1 Autenticación, RBAC, Transporte y Diagnósticos (`server.ts`, `server/builderStore.ts`)
- **Passcodes y Roles**: `admin`, `editor` y `viewer` verificados obligatoriamente con `crypto.scryptSync` + `crypto.timingSafeEqual`. Se eliminó cualquier acceso sin contraseña y `POST /api/builder/auth/login` rechaza con `400 INVALID_ROLE` roles distintos de `admin | editor | viewer`.
- **Bootstrap Seguro**: Cuando `initialized === false`, `POST /api/builder/auth/setup` exige un token único de arranque (`VECTORIA_SETUP_TOKEN` o token aleatorio generado al iniciar el servidor).
- **Sesiones y Revocación**: Tokens Bearer HMAC-SHA256 con `tokenVersion` y lista persistida de tokens revocados; endpoint `POST /api/builder/auth/roles` exclusivo `admin` para rotar claves y revocar sesiones.
- **Filtrado de Datos por Rol y Diagnósticos**: `getBundleForRole` aísla borradores, historial de versiones, `auditLog` y `diskPersisted` según el privilegio autenticado. `GET /api/diagnostics` entrega `public-summary` (sin versión exacta de Node ni `recentErrors[]`) a visitantes y `admin-full` a sesiones `admin`.
- **CSP Estricta, CORS y Fallbacks Express 4**: En `NODE_ENV=production` aplica `script-src 'self'`, `object-src 'none'` y `base-uri 'self'` apoyado en `/public/theme-init.js` sin scripts inline; CORS acepta orígenes explícitos y `^https://ais-(?:dev|pre)-[a-z0-9-]+\.[a-z0-9-]+\.run\.app$`; `app.use('/api', ...)` garantiza `404 JSON` ante rutas API inexistentes.

### 3.2 Servicio Gemini y Herramientas Autorizadas (`server/geminiService.ts`, `server/omniTools.ts`)
- **Modelo y Respaldo**: Configurado en backend (`PRIMARY_GEMINI_MODEL = 'gemini-4-hydrogen'`, `FALLBACK_GEMINI_MODEL = 'gemini-3.1-flash-lite'`). Reintentos acotados ante `429`, `500`, `502`, `503` y timeouts (`18s`), preservación de `candidates[0].content` (`thoughtSignature`) en hasta 3 rondas de herramientas + ronda 4 de síntesis sin `tools`, y degradación controlada al motor local.
- **Lista Blanca de Herramientas (`OMNI_FUNCTION_DECLARATIONS`)**: `run_linear_algebra_op` (hasta 8×8), `inspect_studio_workspace`, `explain_model_architecture`, `compare_models`, retornando `toolTrace` real y auditado.

### 3.3 Exportación ZIP y Respaldos (`server/projectExporter.ts`, `server/backupScheduler.ts`)
- Validación `JSZip.loadAsync()`, bloqueo de symlinks/recorrido de directorios, exclusión de `node_modules/`, `.git/`, `.env`, `data/`, claves privadas y hashes (`adminHash`, `editorHash`, `viewerHash`, `signingSecret`, `revokedTokens`).
