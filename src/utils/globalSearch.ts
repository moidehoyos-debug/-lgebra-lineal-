import type { BuilderPage } from '../types/builder';
import type { ModuleId } from '../types/vectoria';

export type SearchEntryKind = 'module' | 'custom-page';

export interface SearchableModuleMeta {
  id: ModuleId;
  label: string;
  group: 'principal' | 'laboratorios' | 'analisis';
}

export interface GlobalSearchEntry {
  key: string;
  kind: SearchEntryKind;
  moduleId?: ModuleId;
  customPageId?: string;
  title: string;
  categoryLabel: string;
  description: string;
  keywords: string[];
}

const GROUP_LABELS: Record<SearchableModuleMeta['group'], string> = {
  laboratorios: 'Laboratorios',
  analisis: 'Analítica y Calidad',
  principal: 'Inicio y Sistema',
};

const MODULE_ENRICHMENT: Record<
  ModuleId,
  { description: string; keywords: string[] }
> = {
  dashboard: {
    description: 'Resumen de modelos, rendimiento computacional y métricas en tiempo real',
    keywords: ['inicio', 'panel', 'resumen', 'kpi', 'latencia', 'memoria', 'temas'],
  },
  'simulation-lab': {
    description: 'Perturbaciones aisladas, modelo didáctico 3-2-2, 2-3-2 y pruebas A/B',
    keywords: ['experimentos', 'ruido', 'shift', 'didactico', 'ab', 'aislado'],
  },
  classifier: {
    description: 'Lienzo 16x16 de 10/26/36 clases y modelo MNIST 784-128-10',
    keywords: ['dibujo', 'digitos', 'letras', 'alfanumerico', 'mnist', 'softmax', 'canvas'],
  },
  xai: {
    description: 'Mapas de saliencia por gradiente, neuronas ReLU activas y ambigüedades',
    keywords: ['explicabilidad', 'saliencia', 'interpretabilidad', 'gradiente', 'relu'],
  },
  topology: {
    description: 'Visualización interactiva de capas, pesos y propagación neuronal',
    keywords: ['red', 'arquitectura', 'capas', 'sinapsis', 'pesos', 'neuronas'],
  },
  'neural-lab': {
    description: 'Forward pass, retropropagación SGD y curvas reales de entrenamiento',
    keywords: ['backprop', 'entrenamiento', 'gradientes', 'loss', 'epocas', 'mlp'],
  },
  'smart-irrigation': {
    description: 'Laboratorio neuronal 2-4-1 aislado para decisión de riego agrícola',
    keywords: ['riego', 'humedad', 'luz solar', 'sensores', 'mlp', 'sigmoide', 'aislado', 'agricola'],
  },
  'linear-algebra': {
    description: 'Matrices, determinantes, inversa, LU, QR, rango y eigenvalores',
    keywords: ['matriz', 'determinante', 'gauss', 'jordan', 'eigen', 'vectores', 'inversa'],
  },
  geometry: {
    description: 'Transformaciones lineales en R2, vectores, rectas y planos 3D',
    keywords: ['r2', 'r3', '3d', '2d', 'vectores', 'planos', 'producto cruz', 'orbita'],
  },
  'omni-bot': {
    description: 'Asistente híbrido con motor matemático local, Gemini e historial',
    keywords: ['chat', 'asistente', 'ia', 'comandos', 'ejercicios', 'gemini'],
  },
  evaluation: {
    description: 'Precision, recall, F1-score, matriz de confusión y comparativa',
    keywords: ['f1', 'precision', 'recall', 'confusion', 'exactitud', 'benchmark'],
  },
  analytics: {
    description: 'Analítica de experimentos, distribuciones e historial de inferencias',
    keywords: ['graficas', 'estadisticas', 'metricas', 'recharts', 'historial'],
  },
  robustness: {
    description: 'Sensibilidad ante ruido, rotación, desplazamiento y perturbación 28x28',
    keywords: ['ruido', 'estres', 'rotacion', 'escala', 'perturbacion', 'tolerancia'],
  },
  verification: {
    description: 'Invariantes numéricos, chequeo de gradientes, seguridad y eventos',
    keywords: ['calidad', 'auditoria', 'invariantes', 'residuo', 'seguridad', 'logs'],
  },
  sources: {
    description: 'Bibliografía científica de álgebra lineal, deep learning y XAI',
    keywords: ['libros', 'bibliografia', 'strang', 'goodfellow', 'bishop', 'referencias'],
  },
  reports: {
    description: 'Editor de informes experimentales reproducibles y exportación PDF',
    keywords: ['informe', 'pdf', 'reporte', 'impresion', 'documentacion'],
  },
  'api-console': {
    description: 'Pruebas reales de endpoints Express y monitoreo de latencia HTTP',
    keywords: ['endpoints', 'http', 'health', 'diagnostics', 'verify-math', 'servidor'],
  },
  'visual-builder': {
    description: 'Editor visual de páginas personalizadas, temas y conexiones por puertos',
    keywords: ['editor', 'paginas', 'bloques', 'diseño', 'puertos', 'layout'],
  },
  account: {
    description: 'Perfil, 6 temas, kit de marca, equipo de desarrollo, respaldos y ZIP',
    keywords: ['perfil', 'respaldo', 'zip', 'equipo', 'creditos', 'temas', 'seguridad'],
  },
};

export function normalizeSearchQuery(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export function buildGlobalSearchEntries(
  navItems: readonly SearchableModuleMeta[],
  hiddenSystemModules: readonly ModuleId[],
  publishedCustomPages: readonly BuilderPage[]
): GlobalSearchEntry[] {
  const hiddenSet = new Set<ModuleId>(hiddenSystemModules);

  const moduleEntries: GlobalSearchEntry[] = navItems
    .filter((item) => !hiddenSet.has(item.id))
    .map((item) => {
      const enrichment = MODULE_ENRICHMENT[item.id];
      return {
        key: `module:${item.id}`,
        kind: 'module',
        moduleId: item.id,
        title: item.label,
        categoryLabel: GROUP_LABELS[item.group],
        description: enrichment?.description ?? item.label,
        keywords: enrichment?.keywords ?? [],
      };
    });

  const customPageEntries: GlobalSearchEntry[] = publishedCustomPages
    .filter((page) => page.visible !== false)
    .map((page) => {
      const sectionKeywords = page.sections
        .filter((s) => s.visible !== false)
        .flatMap((s) => [
          s.title,
          ...s.blocks
            .filter((b) => b.visible !== false)
            .map((b) => b.content.title || b.name),
        ])
        .filter((v): v is string => Boolean(v && v.trim()));

      return {
        key: `page:${page.id}`,
        kind: 'custom-page',
        customPageId: page.id,
        title: page.title,
        categoryLabel: 'Página personalizada',
        description:
          page.description?.trim() || `Página publicada · /${page.slug || page.id}`,
        keywords: [page.slug, ...sectionKeywords],
      };
    });

  return [...moduleEntries, ...customPageEntries];
}

export function filterGlobalSearchEntries(
  entries: readonly GlobalSearchEntry[],
  rawQuery: string,
  limit = 12
): GlobalSearchEntry[] {
  const query = normalizeSearchQuery(rawQuery);
  if (!query) {
    return entries.slice(0, limit);
  }

  const tokens = query.split(' ').filter(Boolean);

  const scored = entries
    .map((entry, originalIndex) => {
      const normTitle = normalizeSearchQuery(entry.title);
      const normCategory = normalizeSearchQuery(entry.categoryLabel);
      const normDesc = normalizeSearchQuery(entry.description);
      const normKeywords = entry.keywords.map(normalizeSearchQuery);
      const haystack = `${normTitle} ${normCategory} ${normDesc} ${normKeywords.join(' ')}`;

      const matchesAllTokens = tokens.every((t) => haystack.includes(t));
      if (!matchesAllTokens) return null;

      let score = 0;
      if (normTitle === query) {
        score += 120;
      } else if (normTitle.startsWith(query)) {
        score += 90;
      } else if (normTitle.includes(query)) {
        score += 65;
      }

      if (normKeywords.some((k) => k === query)) {
        score += 55;
      } else if (normKeywords.some((k) => k.includes(query))) {
        score += 35;
      }

      if (normCategory.includes(query)) {
        score += 25;
      }
      if (normDesc.includes(query)) {
        score += 15;
      }

      if (entry.kind === 'custom-page') {
        score += 4;
      }

      return { entry, score, originalIndex };
    })
    .filter(
      (
        item
      ): item is { entry: GlobalSearchEntry; score: number; originalIndex: number } =>
        item !== null
    );

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.originalIndex - b.originalIndex;
  });

  return scored.slice(0, limit).map((item) => item.entry);
}
