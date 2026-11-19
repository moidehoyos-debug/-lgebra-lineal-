# PRD.md — Documento de Requisitos de Producto (VectorIA Studio v2.4.0)

## 1. Visión del Producto
VectorIA Studio combina laboratorios matemáticos y neuronales verificables con capacidades educativas visuales interactivas (Topología 3D WebGL, Modo Jarvis paso a paso en Omni Bot y Laboratorio Aislado de Riego Inteligente), un entorno seguro de administración visual (**VectorIA Visual Builder**) y un **Sistema Profesional de Exportación ZIP**.

## 2. Módulos Principales Existentes (Preservados)
- **Panel Principal y Dashboard**: Métricas en vivo, gráfico histórico de entrenamiento del Clasificador Alfanumérico (Recharts), búsqueda global en barra superior, tarjetas reordenables y tutorial guiado.
- **Simulation Lab**: Perturbaciones reproducibles por semilla, red didáctica 3–2–2 y comparación A/B aislada.
- **Clasificador Alfanumérico + MNIST 784**: Modelos reales 16×16 (0–9, A–Z, 36 clases combinadas) y 784–128–10 (101,770 parámetros).
- **IA Explicable (XAI), Topología Neuronal 2D/3D, Ingeniería Neuronal y Robustez**: Mapas de saliencia, conmutador `Vista 2D (Canvas)` / `Vista 3D (WebGL)` con `Three.js`, retropropagación 2–3–2 y evaluación Precision/Recall/F1.
- **Riego Inteligente (MLP 2–4–1 Aislado)**: Laboratorio neuronal educativo interactivo (humedad del suelo %, luz solar W/m²) con entrenamiento por épocas, paso individual de retropropagación SGD y mapa de frontera de decisión 7×7.
- **Álgebra Lineal y Geometría 2D/3D**: Matrices, determinantes, Gauss-Jordan, rango, $PA=LU$, $A=QR$, eigenanálisis y visualización vectorial 3D.
- **Omni Bot Híbrido + Modo Jarvis**: Integración centralizada con Gemini (`gemini-4-hydrogen` + respaldo automático `gemini-3.1-flash-lite`), llamadas a herramientas autorizadas del servidor (`run_linear_algebra_op`, `inspect_studio_workspace`, `explain_model_architecture`, `compare_models`), motor local verificable, Comandos Rápidos, historial de 10 comandos y **Modo Jarvis** con demostraciones visuales sincronizadas, narración opcional `SpeechSynthesis` y grabación WebM del lienzo.
- **Fuentes, Informes, Consola API, Calidad/Seguridad y Cuenta**: Incluyendo exportación segura SHA-256, cifrada AES-256-GCM, respaldo programado, exportación PDF y sección oficial **Equipo de desarrollo** (`01 Moisés de Hoyos`, `02 Isaías Alvarado`, `03 Rivaldo Calvo`).

## 3. Seguridad y RBAC en VectorIA Visual Builder
- **Autenticación obligatoria por contraseña para todos los roles** (`admin`, `editor`, `viewer`), sin acceso sin contraseña para visualizadores.
- **Inicialización protegida (`initialized: false`)**: Requiere token único de arranque (`VECTORIA_SETUP_TOKEN` o token efímero impreso en consola del servidor) o configuración previa de `VECTORIA_ADMIN_PASSCODE` en entorno.
- **Rotación y revocación de sesiones (`POST /api/builder/auth/roles`)**: Permite al administrador actualizar credenciales por rol y revocar sesiones activas inmediatamente mediante incremento de `tokenVersion` y lista persistida de revocación.
- **Alcance por rol en servidor (`getBundleForRole`)**: Los visitantes no autenticados no acceden a borradores, versiones ni estado interno; `viewer` solo visualiza estado publicado; `editor` no accede al `auditLog` ni a rutas de publicación/exportación ZIP.

## 4. Sistema Profesional de Exportación ZIP (`EXPORTAR PROYECTO (.ZIP)`)
- **Acceso exclusivo `admin`**: Conectado a `/api/builder/export-zip*` en modalidades `full`, `distribution` y `backup`.
- **Validación e integridad**: Apertura con `JSZip.loadAsync()`, bloqueo de symlinks/path traversal, exclusión de `node_modules/`, `.git/`, `.env`, `data/`, claves privadas y hashes (`adminHash`, `editorHash`, `viewerHash`, `signingSecret`).

## 5. Limitaciones Conocidas y Criterios Fuera de Alcance
- La escritura persistente de `data/vectoria-builder.json` y bóvedas de respaldo requiere sistema de archivos escribible; en contenedores efímeros sin volumen persistente opera con respaldo en memoria y exportación/importación `.json`/`.zip`.
- La síntesis de voz (`window.speechSynthesis`) y grabación `MediaRecorder` del Modo Jarvis dependen del soporte del navegador del usuario en tiempo de ejecución.
