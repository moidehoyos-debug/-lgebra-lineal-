# Arquitectura de VectorIA Studio (v2.4.0)

> Documento sincronizado con `/ARCHITECTURE.md`.

## 1. Visión General

VectorIA Studio sigue una arquitectura modular cliente-servidor ejecutada sobre Node 22 ESM + Vite 8 + React 19:

- **Frontend (`src/`)**:
  - `src/config/team.ts` & `src/components/TeamCredits.tsx`: Créditos editables del equipo oficial (`01 Moisés de Hoyos`, `02 Isaías Alvarado`, `03 Rivaldo Calvo`).
  - `src/context/ThemeContext.tsx`: Gestiona los 6 temas globales de forma síncrona sin parpadeos.
  - `src/context/StudioContext.tsx`: Orquesta modelos MLP, red sintética 784–128–10, simulaciones aisladas, métricas históricas, eventos y respaldos.
  - `src/context/BuilderContext.tsx`: Sincroniza el estado publicado de **VectorIA Visual Builder**, gestiona autenticación por contraseña para `admin`, `editor` y `viewer`, token de arranque `setupToken` e inyección segura de páginas personalizadas en `src/App.tsx`.
  - `src/components/NeuralTopologyView.tsx` & `src/components/NeuralTopology3DCanvas.tsx`: Conmutación `Vista 2D (Canvas)` / `Vista 3D (WebGL)` con `Three.js` cargado bajo demanda dentro de `ModuleErrorBoundary`.
  - `src/components/SmartIrrigationLabView.tsx`: Laboratorio neuronal `2–4–1` aislado con conjunto sintético educativo.
  - `src/components/OmniBotView.tsx` & `src/components/JarvisDemoPlayer.tsx`: Comandos Rápidos, historial MRU, indicador explícito de proveedor (`Gemini` vs `Motor Local`) y Modo Jarvis sincronizado con narración opcional y exportación WebM.
  - `src/components/GlobalSearchBar.tsx`: Navegación rápida desde barra superior entre módulos y páginas publicadas.

- **Motores Matemáticos y Neuronales (`src/engines/`)**:
  - `linearAlgebra.ts`, `neuralEngine.ts`, `mnist784Engine.ts`, `simulationEngine.ts`, `omniLocalEngine.ts`, `smartIrrigationEngine.ts`, `jarvisDemoEngine.ts`.

- **Backend (`server.ts`, `server/`)**:
  - `server/builderStore.ts`: RBAC estricto (`admin`, `editor`, `viewer`) con contraseña obligatoria para todos los roles, token único de arranque (`setupToken`), revocación por `tokenVersion`, separación estricta de visibilidad (`getBundleForRole`) y escritura atómica.
  - `server/geminiService.ts` & `server/omniTools.ts`: Cliente `@google/genai` centralizado (`gemini-4-hydrogen` + respaldo `gemini-3.1-flash-lite`), reintentos acotados ante `429/500/502/503`/timeouts y herramientas autorizadas con `toolTrace` real.
  - `server/projectExporter.ts` & `server/backupScheduler.ts`: Exportación ZIP validada excluyendo secretos, hashes y `data/`.
