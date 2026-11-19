# ROADMAP.md — Hoja de Ruta de VectorIA Studio

## Fases Completadas

### Fase 1 — Núcleo Matemático y Neuronal (`v1.0.0`)
- [x] Motores `linearAlgebra.ts`, `neuralEngine.ts`, `mnist784Engine.ts`, `simulationEngine.ts` y `omniLocalEngine.ts`.
- [x] Clasificador alfanumérico interactivo 16×16, Simulation Lab, Topología Neuronal y Laboratorio de Álgebra Lineal.
- [x] Temas iniciales (`dark-purple`, `light-yellow`, `classic-mono`, `holographic`).

### Fase 2 — Identidad, Álgebra Avanzada y Geometría (`v2.0.0`)
- [x] Identidad visual VectorIA Studio (`VectorIALogo`, `favicon.svg`) y quinto tema `black-gold`.
- [x] Transpuesta, Rango/Nulidad, descomposición $PA=LU$ y factorización $A=QR$.
- [x] Geometría matemática 2D/3D, XAI (mapas de saliencia), Centro de Evaluación y Dashboard personalizable.

### Fase 3 — Visualización Científica, Seguridad, Estabilidad y Alfanumérico Combinado (`v2.1.0`)
- [x] Sistema Global de Visualización Científica adaptado a los 6 temas (incluyendo `neural-cyberpunk` sin parpadeos).
- [x] Entrenamiento real convergente del modo Alfanumérico Combinado (36 clases `0–9` + `A–Z`) y especificación `src/utils/alphanumericTraining.ts`.
- [x] Seguridad por capas (CSP, CORS allowlist, rate limiter, `ModuleErrorBoundary`, validación JSON y respaldos multiranura).
- [x] Despliegue compatible con Cloud Run Node.js 22 ESM nativo (`server.ts`).
- [x] Exportación e importación global cifrada `AES-256-GCM + PBKDF2-SHA256` en `AccountView`.

### Fase 4 — VectorIA Visual Builder: Niveles 1 y 2 (`v2.2.0`)
- [x] **Nivel 1 (Visual Editor)**: Interfaz de 4 áreas (barra superior, paleta de 9 categorías + plantillas, lienzo de 12 columnas con arrastrar/soltar y vista previa Escritorio/Tablet/Móvil, inspector de propiedades).
- [x] Biblioteca de 18 tipos de componentes y Editor Visual de Gráficas conectado a datos reales de `StudioContext`.
- [x] Gestor de páginas y navegación dinámica, personalización no destructiva sobre los 6 temas, flujo Borrador/Publicado e historial de hasta 30 versiones con restauración.
- [x] **Nivel 2 (Advanced Builder)**: Catálogo de 8 módulos preparados, validación de dependencias/ciclos, activación controlada y cableado de puertos Entrada/Salida hacia bloques visuales.
- [x] Autenticación administrativa RBAC en backend (`scrypt` + `timingSafeEqual` + Bearer HMAC-SHA256 revocable) y persistencia atómica en `data/vectoria-builder.json`.
- [x] Infraestructura modular inicial (`src/components/builder/types.ts`, `builderContext.ts`, `BuilderLayout.tsx`, `index.ts`) para edición visual no destructiva de componentes existentes.

### Fase 5 — Sistema Profesional de Exportación ZIP (`v2.3.0`)
- [x] Motor backend `ProjectExporter` (`server/projectExporter.ts`) con `jszip` y 3 modalidades (`full`, `distribution`, `backup`).
- [x] Validación previa a descarga (apertura real `JSZip`, estructura `VectorIA-Studio/`, archivos esenciales, exclusión de `node_modules/`, `.git/`, `.env`, cachés y secretos, y saneado de hashes en respaldos).
- [x] Endpoints protegidos (`admin` RBAC) `/api/builder/export-zip*` con progreso asíncrono, descarga Blob autenticada y limpieza de temporales.
- [x] Ventana premium `ZipExportModal.tsx` compatible con los 6 temas y botón `EXPORTAR PROYECTO (.ZIP)` en el panel administrativo.
- [x] Guía documentada de restauración limpia y solución de problemas en `README.md`.

### Fase 6 — Seguridad Crítica, Estabilización Gemini/Omni, Modo Jarvis, Topología 3D y Riego Inteligente (`v2.4.0`)
- [x] **Seguridad Visual Builder y RBAC**: Contraseña obligatoria en todos los roles (incluido `viewer`), token único de arranque en inicialización (`VECTORIA_SETUP_TOKEN`), endpoint `POST /api/builder/auth/roles` con revocación inmediata (`tokenVersion`), filtrado de estado por rol y pruebas automatizadas en `tests/securityAndOmni.test.ts`.
- [x] **Gemini Estabilizado y Herramientas Reales en Omni Bot**: `gemini-4-hydrogen` + respaldo `gemini-3.1-flash-lite`, reintentos acotados, `thoughtSignature`/`functionResponse.id`, herramientas verificadas (`run_linear_algebra_op`, `inspect_studio_workspace`, `explain_model_architecture`, `compare_models`) y `toolTrace` visible en UI.
- [x] **Modo Jarvis Guiado**: Reproductor visual paso a paso (`JarvisDemoPlayer.tsx` + `jarvisDemoEngine.ts`) calculado desde motores reales con narración opcional y exportación WebM.
- [x] **Topología Neuronal 3D (`Three.js`)**: Conmutador 2D/3D WebGL interactivo cargado perezosamente y aislado mediante `ModuleErrorBoundary`.
- [x] **Laboratorio Aislado de Riego Inteligente (2–4–1)**: Red educativa independiente (17 parámetros) con retropropagación por paso, entrenamiento por épocas y mapa 7×7 de frontera de decisión.
- [x] **Endurecimiento CSP/CORS/Diagnósticos y Estabilidad Vite/React (73/73)**: Script externo `public/theme-init.js` + CSP de producción `script-src 'self'`, CORS acotado para AI Studio `.run.app`, `/api/diagnostics` filtrado por rol `admin`, protección `404 JSON` en `/api`, deduplicación de React en `vite.config.ts` y validación integral de 73/73 pruebas (`npx vitest run --no-file-parallelism`), `npm run lint` y `npm run build`.

---

## Backlog y Mejoras Pendientes (Fases Futuras)

- [ ] **Adaptador de base de datos relacional/documental opcional** (Cloud SQL o Firestore) como alternativa a `data/vectoria-builder.json` para despliegues multi-réplica sin volumen compartido.
- [ ] **Registro declarativo de plantillas de página completas** (por ejemplo, plantillas académicas de clase, examen o informe técnico prearmadas con 1 clic).
- [ ] **Roles multi-cuenta individuales** con gestión de usuarios múltiples y caducidad diferenciada por sesión, sustituyendo el passcode único por rol.
- [ ] **Pruebas E2E con navegador headless (Chromium/Playwright)** en entorno con binario de navegador disponible para automatizar la verificación visual de clic/arrastre, WebGL y captura PNG en los 6 temas.
