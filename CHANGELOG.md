# Changelog

## [2.3.0] - 2026-11-16
### Added & Changed
- **Sistema Profesional de Exportación ZIP (`EXPORTAR PROYECTO (.ZIP)`)**:
  - Motor backend `server/projectExporter.ts` con `jszip` y tres modalidades: **ZIP Completo del Proyecto (`full`)**, **ZIP de Distribución (`distribution`)** y **ZIP de Respaldo (`backup`)**.
  - Validación de integridad previa a descarga (`JSZip.loadAsync`), detección de archivos esenciales, escaneo anti-credenciales, exclusión de `node_modules/`, `.git/`, `.env`, cachés y symlinks, saneado de `adminHash`/`editorHash`/`signingSecret` en respaldos y limpieza automática de temporales.
  - Endpoints protegidos por rol `admin` (`POST /api/builder/export-zip`, `GET /api/builder/export-zip/:jobId/status`, `GET /api/builder/export-zip/:jobId/download`) y modal premium `ZipExportModal.tsx` compatible con los 6 temas.
- **Infraestructura Modular de Visual Builder**: Creados `src/components/builder/types.ts`, `builderContext.ts`, `BuilderLayout.tsx` e `index.ts` conectados mediante `BuilderModificationProvider` en `src/App.tsx`.
- **Documentación y Guía de Restauración**: Actualizados `README.md`, `AGENTS.md`, `PRD.md`, `DESIGN.md`, `BITACORA.md`, `ARCHITECTURE.md`, `docs/ARCHITECTURE.md` y `ROADMAP.md`.

## [2.2.0] - 2026-11-16
### Added & Changed
- **VectorIA Visual Builder (Nivel 1 — Visual Editor)**: Interfaz administrativa de 4 áreas cargada bajo demanda (`VisualBuilderView`) con barra superior (Deshacer/Rehacer, vista previa Escritorio/Tablet/Móvil, Borrador/Publicado con confirmación, Exportar/Importar JSON), paleta de 9 categorías y plantillas guardadas, lienzo interactivo de 12 columnas con arrastrar y soltar, e inspector completo de contenido, estilos y gráficas.
- **18 Tipos de Bloques y Editor de Gráficas Conectado a Datos Reales**: Soporte para gráficas de barras, líneas, áreas, dispersión, histograma, mapa de calor y matriz de confusión conectadas en tiempo real a `StudioContext` (`builderChartData.ts`), además de calculadora matricial, widget Softmax MLP y monitor `/api/diagnostics`.
- **Gestión de Páginas, Menú Lateral y Temas No Destructivos**: Creación y publicación de páginas visibles en el menú lateral (`PublishedPageView`), ocultación controlada de módulos secundarios y overrides de tema compatibles con los 6 temas globales.
- **VectorIA Visual Builder (Nivel 2 — Advanced Builder)**: Catálogo de 8 módulos preparados conectados al núcleo existente, validación automática de dependencias y detección de ciclos DFS (`validateModuleDependencies`), activación/desactivación y conexión Entrada/Salida hacia componentes.
- **Seguridad RBAC, Sanitización y Persistencia en Servidor**: Autenticación con `scrypt` + `timingSafeEqual` + tokens HMAC-SHA256 revocables (`/api/builder/auth/*`), roles `admin`/`editor`/`viewer`, sanitización XSS/URL (`builderSecurity.ts`), separación Borrador vs Publicado, historial de 30 versiones en `data/vectoria-builder.json` y bitácora de auditoría.
- **Exportación Global Cifrada (`AES-256-GCM`)**: Respaldo e importación segura del estado completo (configuración, pesos de modelos, historial) desde `AccountView` con verificación de versión y estructura.
- **Documentación del Proyecto**: Creación y actualización integral de `AGENTS.md`, `PRD.md`, `DESIGN.md`, `BITACORA.md`, `ARCHITECTURE.md`, `ROADMAP.md` y `README.md`.

## [2.1.0] - 2026-11-16
### Added & Changed
- **Despliegue Cloud Run Node 22 ESM**: Separación explícita de `import type` y extensiones `.ts` en `server.ts` y `src/engines/linearAlgebra.ts` para arranque nativo sin errores con `node server.ts`.
- **Tema Neural Cyberpunk y Cambio Instantáneo**: Sexto tema global (`html[data-theme="neural-cyberpunk"]`) con actualización síncrona de DOM (`theme-instant`) y soporte completo en gráficas científicas.
- **Especificación Unificada Alfanumérico Combinado**: Nuevo módulo `src/utils/alphanumericTraining.ts` con tensores `x_glyph_16x16` ($\mathbb{R}^{256}$), one-hot de 36 clases (`0–9` + `A–Z`), requisitos de datos estratificados y entrenamiento real convergente ($\eta = 0.005$, $\mu = 0.85$).
- **Sistema Global de Visualización Científica**: Renovación integral de gráficas 2D/3D, mapas de calor, matrices de confusión, curvas Softmax/entrenamiento con exportación PNG, tabla de datos y adaptación dinámica a los 6 temas.
- **Seguridad Defensiva y Estabilidad**: Headers CSP/seguridad, allowlist CORS en API, rate limiter por IP, validación matricial acotada (`<= 12×12`, finitud), redacción de secretos, `ModuleErrorBoundary` por laboratorio y sanitización de entradas.
- **Optimización y Monitoreo en Tiempo Real**: División de paquetes Vite (`manualChunks`), `rawMatMul` y `forwardProbsOnly` optimizados, caché determinístico LRU en `/api/verify-math`, endpoint `GET /api/diagnostics` y suite ampliada de verificación + benchmark rAF de 10 frames.
- **Respaldo Multiranura y Privacidad**: Buffer circular de 5 instantáneas en `localStorage`, exportación/importación `.json` validada, inventario de almacenamiento y botón de eliminación de datos experimentales con respaldo previo automático.

## [2.0.0] - 2026-11-15
### Added
- **Identidad VectorIA Studio**: Isotipo geométrico V + nodos neuronales (`VectorIALogo`) con variantes clara, oscura, monocromática y `public/favicon.svg`.
- **Quinto Tema Global**: Tema `Black & Gold` (`html[data-theme="black-gold"]`) integrado en todo el sistema visual.
- **Dashboard Inteligente y Guía Interactiva**: Paneles personalizables, centro de notificaciones/eventos y tour guiado de 4 pasos.
- **Álgebra Lineal Avanzada**: Transpuesta, Rango y Nulidad, Descomposición $PA=LU$ y Factorización Ortogonal $A=QR$.
- **Geometría Matemática 2D/3D, XAI y Centro de Evaluación**: Módulos interactivos completos y pruebas de verificación.

## [1.0.0] - 2026-11-14
### Added
- Arquitectura inicial React 19 + Vite + Express + Tailwind v4 con 4 temas dinámicos, Álgebra Lineal, Clasificador Alfanumérico, Topología Neuronal, Simulation Lab y Omni Bot híbrido.
