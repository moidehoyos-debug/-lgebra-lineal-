# AGENTS.md — Guía Técnica y Operativa de VectorIA Studio

## 1. Propósito del Repositorio
**VectorIA Studio (v2.4.0)** es una plataforma modular de Álgebra Lineal, Redes Neuronales (MLP 16×16 de 10/26/36 clases, MNIST 784–128–10, Simulador Didáctico 2–3–2 y Laboratorio Aislado de Riego Inteligente 2–4–1), Simulación Científica, Topología Neuronal 2D/3D (Canvas + Three.js WebGL), Omni Bot Híbrido con Modo Jarvis, Visualización Adaptativa, **VectorIA Visual Builder** (Nivel 1 + Nivel 2 + `BuilderLayout`) y **Sistema Profesional de Exportación ZIP**.

## 2. Reglas Fundamentales de Ingeniería
1. **Integridad matemática y neuronal**: Nunca inventar métricas, porcentajes, predicciones ni datos de entrenamiento. Toda gráfica, KPI, demostración Jarvis o laboratorio lee directamente de `src/engines/`, `StudioContext` o `/api/diagnostics`.
2. **Aislamiento estricto de modelos**:
   - Los experimentos de `SimulationLab`, `SmartIrrigationModel` (2–4–1) y el simulador didáctico `2–3–2` operan aislados sin mutar los pesos de los clasificadores `16×16` ni `MNIST 784`.
3. **Preservación de identidad, UI y motores internos**:
   - Mantener intactos los 6 temas globales, el logotipo de barra lateral, la búsqueda global, el gráfico histórico de entrenamiento en Dashboard, los Comandos Rápidos e historial de Omni Bot y la sección oficial «Equipo de desarrollo» (`src/config/team.ts` + `src/components/TeamCredits.tsx`: `01 Moisés de Hoyos`, `02 Isaías Alvarado`, `03 Rivaldo Calvo` en orden estricto).
   - El Visual Builder únicamente adapta presentación, distribución de páginas, temas visuales no destructivos y conexiones por puertos declarados (`inputPorts` / `outputPorts`).
4. **Seguridad por capas y Exportación ZIP**:
   - Todo texto e imagen configurado en Visual Builder pasa por `sanitizeBuilderText` y `sanitizeBuilderUrl` (`src/utils/builderSecurity.ts`), bloqueando `<script>`, manejadores `on*=`, `javascript:` y `data:image/svg+xml`.
   - Ningún rol (incluido `viewer`) puede iniciar sesión sin contraseña verificada con `scrypt` + `timingSafeEqual` en `server/builderStore.ts`.
   - La inicialización administrativa cuando `initialized: false` exige el token único de arranque del servidor (`VECTORIA_SETUP_TOKEN` o token generado en memoria) o `VECTORIA_ADMIN_PASSCODE` definido en entorno.
   - `GET /api/builder/state` filtra datos según rol (`viewer` recibe solo publicado sin borradores/versiones/auditoría; `editor` no recibe `auditLog` ni estado del sistema de archivos).
   - `server/projectExporter.ts` excluye obligatoriamente `node_modules/`, `.git/`, `.env`, `data/` (bóvedas/respaldos), claves privadas, hashes (`adminHash`, `editorHash`, `viewerHash`, `signingSecret`) y cachés, bloquea symlinks/recorrido de directorios y valida cada ZIP con `JSZip.loadAsync()` antes de habilitar la descarga.
   - Las claves API (`GEMINI_API_KEY`) permanecen aisladas exclusivamente en el backend (`server.ts`, `server/geminiService.ts`).
5. **Rendimiento y aislamiento**:
   - Los laboratorios secundarios, `NeuralTopology3DCanvas` (Three.js), `VisualBuilderView` y `PublishedPageView` se cargan con `React.lazy` y están aislados mediante `ModuleErrorBoundary`.
6. **Validación obligatoria antes de entregar cambios**:
   - Ejecutar `npm run lint` (`tsc --noEmit`), `npm test` (`vitest run`) y `npm run build` (`vite build`).
