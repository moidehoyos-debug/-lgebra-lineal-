# VectorIA Studio (v2.3.0)

Plataforma académica y técnica de **Álgebra Lineal e Ingeniería de Redes Neuronales** construida con React 19, TypeScript, Vite 8, Express 4, Tailwind CSS v4, Recharts, D3, Vitest, JSZip, integración híbrida de IA en servidor, **VectorIA Visual Builder** y **Sistema Profesional de Exportación ZIP**.

---

## Características principales

- **Identidad visual y 6 temas globales sin parpadeos**: Dark Purple, Light Yellow, Classic Mono, Holographic, Black & Gold y **Neural Cyberpunk** persistidos en `localStorage`, con aplicación síncrona previa al primer pintado y logotipo geométrico en versiones clara, oscura y monocromática.
- **Sistema Profesional de Exportación ZIP (`EXPORTAR PROYECTO (.ZIP)`)**:
  - Integrado en el panel de administración (**Visual Builder**, rol `admin`) mediante backend protegido (`/api/builder/export-zip*`) con **JSZip**.
  - Tres modalidades: **A. ZIP Completo del Proyecto**, **B. ZIP de Distribución** y **C. ZIP de Respaldo** (con `data/vectoria-builder.sanitized.json` sin hashes ni claves).
  - Progreso asíncrono sin bloquear la interfaz (*Preparando archivos → Comprimiendo proyecto → Validando ZIP → Archivo listo*), validación de integridad, verificación de archivos esenciales, escaneo anti-credenciales, exclusión de `node_modules/`, `.git/`, `.env` y cachés, y limpieza automática de temporales.
- **VectorIA Visual Builder (Nivel 1 + Nivel 2)**:
  - **Nivel 1 (Visual Editor)**: Editor visual de 4 áreas, 18 tipos de bloques, editor de gráficas conectado a datos reales del estudio, gestión de páginas en el menú lateral, personalización no destructiva sobre los 6 temas, flujo Borrador/Publicado e historial con restauración de hasta 30 versiones, además de `BuilderLayout` / `builderContext.ts` para edición no destructiva de componentes existentes.
  - **Nivel 2 (Advanced Builder)**: Catálogo de 8 módulos preparados conectados al núcleo matemático/neuronal, validación de dependencias y ciclos, activación controlada y cableado Entrada/Salida.
  - **RBAC y Persistencia**: Acceso protegido mediante `scrypt` + `timingSafeEqual` + HMAC-SHA256 en `/api/builder/*` (`admin`, `editor`, `viewer`) y almacenamiento atómico en `data/vectoria-builder.json`.
- **Dashboard Inteligente y Guía de Inicio Rápido**: Paneles reordenables y ocultables, modal persistente de Guía de Inicio Rápido en el primer acceso (`localStorage`), notificaciones de sesión y métricas reales.
- **Sistema Global de Visualización Científica**: Gráficas interactivas adaptadas automáticamente a los 6 temas con tooltips de precisión, cuadrículas finas, exportación PNG y consulta numérica.
- **Laboratorio de Álgebra Lineal y Geometría 2D/3D**: Suma/Resta, Multiplicación optimizada, Transpuesta, Determinante, Inversa (Gauss-Jordan), Rango y Nulidad, Descomposición $PA=LU$, Factorización Ortogonal $A=QR$, Sistemas lineales, Vectores, Independencia, Transformaciones 2D/3D interactivas y Eigenanálisis.
- **Clasificador Alfanumérico (0–9, A–Z, 36 clases) y MNIST 784–128–10**:
  - Especificación unificada en `src/utils/alphanumericTraining.ts` (`x_glyph_16x16` $\in \mathbb{R}^{256}$, `[0,1]`, one-hot de 36 clases `0–9` + `A–Z`, $\eta = 0.005$, momento $\mu = 0.85$).
  - Modelo combinado de 36 clases entrenado de forma real junto a Dígitos (10), Letras (26) y red sintética 784–128–10 (101,770 parámetros).
- **Seguridad por Capas, Monitoreo y Respaldos Cifrados**:
  - Encabezados CSP, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, lista blanca CORS en API, rate limiting deslizante por IP, validación matricial acotada ($12\times 12$), redacción de secretos y exportación global cifrada `AES-256-GCM + PBKDF2-SHA256` en *Configuración y Usuario*.

---

## Requisitos del sistema

- **Node.js**: `v22.x` o superior (compatible con ejecución ESM nativa `node server.ts`).
- **Gestor de paquetes**: `npm` (`>= 10`) o `bun` (`bun.lock` incluido en el proyecto).
- **Navegador moderno**: Chrome, Edge, Firefox o Safari actualizado (con WebCrypto API para cifrado local y descarga Blob).

---

## Instalación y dependencias

1. Descarga o descomprime el código fuente del proyecto y sitúate en la carpeta raíz `VectorIA-Studio/`.
2. Instala todas las dependencias declaradas en `package.json`:
   ```bash
   npm install
   ```
   *(Opcional si usas Bun: `bun install`.)*

---

## Configuración del entorno y variables necesarias

Crea un archivo `.env` a partir de `.env.example` (**nunca subas `.env` a repositorios ni a paquetes ZIP**):

```bash
cp .env.example .env
```

Variables disponibles:
- `GEMINI_API_KEY`: Clave del servidor para consultas externas en Omni Bot (`/api/omni/chat`). Si se omite o conserva el placeholder, Omni Bot opera con su motor local determinístico sin errores.
- `APP_URL`: URL pública donde se hospeda el servicio (usada para la lista blanca CORS en producción).
- `VECTORIA_ADMIN_PASSCODE`: *(Opcional)* Contraseña inicial de administrador (`>= 8` caracteres) para el Visual Builder y la exportación ZIP. Si se omite, el administrador configura la contraseña en el primer acceso mediante `scrypt`.
- `PORT`: Puerto HTTP del servidor Express (por defecto `3000`).

---

## Comandos para ejecutar y verificar

- **Modo desarrollo** (Express 4 + Vite middleware en `http://localhost:3000`):
  ```bash
  npm run dev
  ```
- **Verificación de tipos TypeScript**:
  ```bash
  npm run lint
  ```
- **Suite completa de pruebas automatizadas (Vitest)**:
  ```bash
  npm test
  ```
- **Compilación de producción**:
  ```bash
  npm run build
  ```
- **Arranque en producción (Node.js 22 ESM nativo / Cloud Run)**:
  ```bash
  NODE_ENV=production npm start
  ```

---

## Procedimiento de restauración desde un archivo ZIP exportado

> **Advertencia de seguridad**: Nunca descomprimas un respaldo directamente encima de un proyecto en ejecución ni sobrescribas automáticamente archivos activos sin verificar primero un directorio limpio.

1. **Crear un directorio destino limpio** (por ejemplo `VectorIA-Studio-Restaurado/`):
   ```bash
   mkdir -p VectorIA-Studio-Restaurado
   unzip VectorIA-Studio-full-YYYY-MM-DD.zip -d VectorIA-Studio-Restaurado
   cd VectorIA-Studio-Restaurado/VectorIA-Studio
   ```
2. **Instalar dependencias en el entorno restaurado**:
   ```bash
   npm install
   ```
3. **Configurar variables de entorno nuevas**:
   ```bash
   cp .env.example .env
   ```
   Completa `GEMINI_API_KEY` (si utilizarás Omni Bot en la nube) y `VECTORIA_ADMIN_PASSCODE` si deseas precargar una clave administrativa.
4. **Si restauras desde la modalidad `backup` (ZIP de Respaldo)**:
   - El archivo `data/vectoria-builder.sanitized.json` contiene páginas, bloques, módulos Nivel 2 y presets de tema publicados **sin** credenciales (`adminHash`, `editorHash` ni `signingSecret`).
   - Para reactivar esa configuración visual en una instalación nueva, copia el archivo sanitizado a `data/vectoria-builder.json` **antes** de arrancar el servidor y define luego tu nueva contraseña maestra al abrir el Visual Builder:
     ```bash
     mkdir -p data
     cp data/vectoria-builder.sanitized.json data/vectoria-builder.json
     ```
   - Alternativamente, puedes importar la configuración desde el botón **Importar .json** dentro del Visual Builder sin tocar archivos en disco.
5. **Si restauras desde la modalidad `distribution` (ZIP de Distribución)**:
   - Si la carpeta `dist/` ya venía compilada en el ZIP, puedes ejecutar directamente `NODE_ENV=production npm start`.
   - Si `dist/` no se encontraba precompilada (indicado en las advertencias de validación del ZIP), ejecuta primero `npm run build` en un ZIP completo o recompila antes de arrancar.
6. **Validar la restauración antes de abrir tráfico**:
   ```bash
   npm run lint
   npm test
   npm run build
   npm run dev
   ```

---

## Solución de problemas frecuentes

- **`Error 401 / 403` al intentar exportar el ZIP**: Solo las sesiones autenticadas con rol **Administrador** (`admin`) pueden iniciar o descargar exportaciones `.zip`. Inicia sesión en el módulo **Visual Builder** con la contraseña administrativa.
- **Advertencia sobre `dist/` faltante en Modalidad B (Distribución)**: Si exportaste en modo distribución antes de ejecutar `npm run build`, el sistema emite un aviso claro en la tarjeta de validación para recordarte compilar antes del arranque en producción.
- **`npm audit` reporta `ENOLOCK`**: El entorno usa `bun.lock`. Si deseas auditoría estándar con npm, genera `package-lock.json` mediante `npm i --package-lock-only`.
- **Entorno efímero sin volumen persistente en disco**: Si el contenedor es de solo lectura, `data/vectoria-builder.json` opera con respaldo en memoria; utiliza **EXPORTAR PROYECTO (.ZIP)** o **Exportar .json** para resguardar tus cambios localmente.

---

## Documentación del Proyecto

- `AGENTS.md`: Reglas de ingeniería, seguridad y restricciones del Visual Builder y Exportador ZIP.
- `PRD.md`: Requisitos funcionales completos del estudio, Visual Builder y Exportador ZIP.
- `DESIGN.md`: Sistema de diseño, los 6 temas, Visual Builder y modal de exportación ZIP.
- `ARCHITECTURE.md` (y `docs/ARCHITECTURE.md`): Capas frontend, motores, RBAC, endpoints `/api/builder/*` y arquitectura de `ProjectExporter`.
- `BITACORA.md`: Registro cronológico de implementación, hallazgos y decisiones técnicas.
- `ROADMAP.md` y `CHANGELOG.md`: Hitos completados y mejoras futuras.

## Inventario de almacenamiento local (`localStorage`)

Ninguna clave almacena credenciales ni secretos:
- `vectoria-theme`: identificador del tema visual activo.
- `vectoria-dashboard-layout-v2`: orden y visibilidad de tarjetas del Dashboard.
- `vectoria-quickstart-dismissed-v1`: preferencia de ocultamiento de la Guía de Inicio Rápido.
- `vectoria-workspace-backups-v1`: hasta 5 instantáneas rotativas del espacio de trabajo.
- `vectoria-builder-overrides-v1`: ajustes visuales no destructivos registrados por `BuilderLayout`.

## Limitaciones conocidas

- La lectura de memoria JS Heap del cliente (`performance.memory`) solo está disponible en navegadores basados en Chromium.
- Los controles de seguridad implementados siguen buenas prácticas defensivas en aplicación y API, pero no constituyen una certificación formal externa.
- Las tarjetas de planes y certificación en *Configuración y Usuario* son demostrativas y no procesan pagos ni emiten credenciales oficiales.
