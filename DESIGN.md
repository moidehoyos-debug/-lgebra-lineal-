# DESIGN.md — Sistema de Diseño y Experiencia Visual (v2.4.0)

## 1. Sistema de 6 Temas Globales y Créditos Institucionales
VectorIA Studio mantiene 6 temas completos definidos mediante variables CSS semánticas en `src/index.css` con aplicación síncrona sin parpadeos (`ThemeContext.tsx` + script estático `/public/theme-init.js` cargado en `index.html` compatible con CSP estricta):
1. **Dark Purple**, 2. **Light Yellow**, 3. **Classic Mono**, 4. **Holographic**, 5. **Black & Gold**, 6. **Neural Cyberpunk**.

La sección **Equipo de desarrollo** (`src/components/TeamCredits.tsx` alimentado por `src/config/team.ts`) presenta 3 tarjetas equilibradas y responsivas adaptadas a los 6 temas, numeradas del `01` al `03` en orden estricto (`01 Moisés de Hoyos`, `02 Isaías Alvarado`, `03 Rivaldo Calvo`), accesible discretamente desde `AccountView` sin recargar el encabezado principal.

## 2. Experiencia Visual de Nuevos Módulos e Interacción
- **Búsqueda Global en Barra Superior (`GlobalSearchBar`)**: Acceso rápido mediante buscador o atajo de teclado hacia laboratorios, herramientas y páginas personalizadas publicadas.
- **Neural Topology 2D / 3D (`NeuralTopologyView` + `NeuralTopology3DCanvas`)**: Conmutador limpio entre `Vista 2D (Canvas)` y `Vista 3D (WebGL)` con órbita/zoom, raycasting sobre neuronas, pulsos sinápticos animados respetando `prefers-reduced-motion` y degradación automática de calidad en renderizadores WebGL por software.
- **Modo Jarvis en Omni Bot (`JarvisDemoPlayer`)**: Reproductor didáctico incrustado con diagrama neuronal en `<canvas>`, curva de aprendizaje en tiempo real, controles `0.5x / 1x / 1.5x`, paso anterior/siguiente, modo explicativo `Básico` / `Avanzado`, subtítulos en vivo, narración opcional por voz y grabación WebM del lienzo.
- **Laboratorio de Riego Inteligente (`SmartIrrigationLabView`)**: Controles deslizantes de humedad (0–100%) y luz solar (0–1000 W/m²), aviso explícito de aislamiento y datos sintéticos, curva de pérdida/exactitud (`LossAccuracyChart`) y matriz térmica 7×7 de frontera de decisión.

## 3. Arquitectura Visual del Visual Builder y Exportación ZIP
- **Estudio en 4 Zonas + Compuerta de Seguridad**: Formulario de inicialización inicial protegido con campo `Token de arranque del servidor` y contraseñas diferenciadas por rol; inicio de sesión con contraseña obligatoria también para el rol `viewer`.
- **Ventana Premium `ZipExportModal`**: 3 tarjetas seleccionables (*ZIP Completo*, *ZIP de Distribución*, *ZIP de Respaldo*) con telemetría `tabular-nums`, controles de validación de seguridad y descarga autenticada.
