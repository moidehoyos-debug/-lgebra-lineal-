import React, { useState } from 'react';
import {
  BarChart3,
  BookmarkPlus,
  Eye,
  EyeOff,
  Layout,
  Palette,
  Sliders,
  Trash2,
  Type,
} from 'lucide-react';
import {
  BuilderBlock,
  BuilderChartConfig,
  BuilderChartKind,
  BuilderDataSourceKey,
  BuilderPage,
  BuilderSection,
  PreparedModuleSpec,
} from '../../types/builder';
import { ModuleId } from '../../types/vectoria';

interface BuilderPropertyInspectorProps {
  selectedBlock: BuilderBlock | null;
  selectedSection: BuilderSection | null;
  pages: BuilderPage[];
  modules: PreparedModuleSpec[];
  readOnly: boolean;
  onUpdateBlock: (patch: Partial<BuilderBlock>) => void;
  onUpdateSection: (patch: Partial<BuilderSection>) => void;
  onDeleteBlock: (blockId: string) => void;
  onSaveAsTemplate: (block: BuilderBlock, templateName: string) => void;
}

const CHART_KIND_OPTIONS: Array<{ value: BuilderChartKind; label: string }> = [
  { value: 'bar', label: 'Barras Verticales' },
  { value: 'horizontal-bar', label: 'Barras Horizontales' },
  { value: 'line', label: 'Líneas' },
  { value: 'area', label: 'Área' },
  { value: 'scatter', label: 'Dispersión' },
  { value: 'histogram', label: 'Histograma' },
  { value: 'heatmap', label: 'Mapa de Calor' },
  { value: 'confusion-matrix', label: 'Matriz de Confusión' },
];

const DATA_SOURCE_OPTIONS: Array<{ value: BuilderDataSourceKey; label: string }> = [
  { value: 'models-comparison', label: 'Comparativa de Modelos (0–9, A–Z, 36, 784)' },
  { value: 'training-alphanumeric', label: 'Curva Combinado 36 Clases' },
  { value: 'training-digits', label: 'Curva Dígitos 0–9' },
  { value: 'training-letters', label: 'Curva Letras A–Z' },
  { value: 'softmax-last', label: 'Última Predicción Softmax' },
  { value: 'prediction-timeline', label: 'Historial de Inferencias' },
  { value: 'confusion-matrix', label: 'Matriz de Confusión Real' },
  { value: 'simulation-history', label: 'Historial de Simulation Lab' },
  { value: 'eigen-spectrum', label: 'Distribución / Mapa de Calor Modelos' },
];

const SERIES_DEFAULTS_BY_SOURCE: Record<
  BuilderDataSourceKey,
  Array<{ key: string; label: string; color: string; visible: boolean }>
> = {
  'models-comparison': [
    { key: 'valPct', label: 'Validación (%)', color: 'var(--chart-1)', visible: true },
    { key: 'trainPct', label: 'Entrenamiento (%)', color: 'var(--chart-2)', visible: true },
  ],
  'training-digits': [
    { key: 'valAccuracyPct', label: 'Val (%)', color: 'var(--chart-3)', visible: true },
    { key: 'accuracyPct', label: 'Train (%)', color: 'var(--chart-2)', visible: true },
  ],
  'training-letters': [
    { key: 'valAccuracyPct', label: 'Val (%)', color: 'var(--chart-3)', visible: true },
    { key: 'accuracyPct', label: 'Train (%)', color: 'var(--chart-2)', visible: true },
  ],
  'training-alphanumeric': [
    { key: 'valAccuracyPct', label: 'Val (%)', color: 'var(--chart-3)', visible: true },
    { key: 'accuracyPct', label: 'Train (%)', color: 'var(--chart-2)', visible: true },
  ],
  'softmax-last': [
    { key: 'probPct', label: 'Probabilidad (%)', color: 'var(--chart-2)', visible: true },
  ],
  'prediction-timeline': [
    { key: 'confidencePct', label: 'Confianza (%)', color: 'var(--chart-1)', visible: true },
    { key: 'entropy', label: 'Entropía H(p)', color: 'var(--chart-3)', visible: true },
  ],
  'confusion-matrix': [
    { key: 'aciertos', label: 'Aciertos', color: 'var(--chart-3)', visible: true },
    { key: 'total', label: 'Muestras', color: 'var(--chart-1)', visible: true },
  ],
  'simulation-history': [
    { key: 'durationMs', label: 'Duración (ms)', color: 'var(--chart-2)', visible: true },
    { key: 'noisePct', label: 'Ruido (%)', color: 'var(--chart-4)', visible: true },
  ],
  'eigen-spectrum': [
    { key: 'frecuencia', label: 'Épocas', color: 'var(--chart-1)', visible: true },
  ],
};

export const BuilderPropertyInspector: React.FC<BuilderPropertyInspectorProps> = ({
  selectedBlock,
  selectedSection,
  pages,
  modules,
  readOnly,
  onUpdateBlock,
  onUpdateSection,
  onDeleteBlock,
  onSaveAsTemplate,
}) => {
  const [tab, setTab] = useState<'content' | 'style' | 'chart' | 'advanced'>('content');
  const [templateName, setTemplateName] = useState('');

  if (!selectedBlock && !selectedSection) {
    return (
      <div className="p-4 text-xs text-[var(--text-muted)] space-y-2">
        <div className="font-semibold text-[var(--text-primary)]">Propiedades</div>
        <p>Selecciona un componente o sección en el lienzo central para editar su contenido, estilo o gráfica.</p>
      </div>
    );
  }

  if (!selectedBlock && selectedSection) {
    return (
      <div className="p-4 space-y-4 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-[var(--text-primary)]">Sección seleccionada</span>
          <button
            type="button"
            disabled={readOnly}
            onClick={() => onUpdateSection({ visible: !selectedSection.visible })}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[var(--border-hairline)] surface-elevated cursor-pointer"
          >
            {selectedSection.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            {selectedSection.visible ? 'Visible' : 'Oculta'}
          </button>
        </div>
        <label className="block space-y-1">
          <span className="text-[var(--text-muted)]">Título de la sección</span>
          <input
            type="text"
            disabled={readOnly}
            value={selectedSection.title}
            onChange={(e) => onUpdateSection({ title: e.target.value })}
            className="w-full px-3 py-1.5 rounded-lg surface-elevated border border-[var(--border-hairline)] text-[var(--text-primary)]"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-[var(--text-muted)]">Descripción</span>
          <textarea
            rows={3}
            disabled={readOnly}
            value={selectedSection.description}
            onChange={(e) => onUpdateSection({ description: e.target.value })}
            className="w-full px-3 py-1.5 rounded-lg surface-elevated border border-[var(--border-hairline)] text-[var(--text-primary)]"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-[var(--text-muted)]">Espaciado interno (gap px)</span>
          <input
            type="range"
            min={8}
            max={36}
            disabled={readOnly}
            value={selectedSection.gapPx}
            onChange={(e) => onUpdateSection({ gapPx: Number(e.target.value) })}
            className="w-full accent-[var(--accent-primary)]"
          />
        </label>
      </div>
    );
  }

  const block = selectedBlock!;
  const patchContent = (cPatch: Partial<BuilderBlock['content']>) => {
    onUpdateBlock({ content: { ...block.content, ...cPatch } });
  };
  const patchStyles = (sPatch: Partial<BuilderBlock['styles']>) => {
    onUpdateBlock({ styles: { ...block.styles, ...sPatch } });
  };
  const patchChart = (chPatch: Partial<BuilderChartConfig>) => {
    if (!block.content.chartConfig) return;
    patchContent({ chartConfig: { ...block.content.chartConfig, ...chPatch } });
  };

  return (
    <div className="flex flex-col h-full text-xs">
      <div className="p-3 border-b border-[var(--border-hairline)] space-y-2">
        <div className="flex items-center justify-between gap-2">
          <input
            type="text"
            disabled={readOnly}
            value={block.name}
            onChange={(e) => onUpdateBlock({ name: e.target.value })}
            className="font-semibold text-[var(--text-primary)] bg-transparent border-b border-transparent focus:border-[var(--accent-primary)] outline-none min-w-0 flex-1"
          />
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              disabled={readOnly}
              onClick={() => onUpdateBlock({ visible: !block.visible })}
              title={block.visible ? 'Ocultar componente' : 'Mostrar componente'}
              className="p-1.5 rounded-lg surface-elevated border border-[var(--border-hairline)] cursor-pointer"
            >
              {block.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              disabled={readOnly}
              onClick={() => onDeleteBlock(block.id)}
              title="Eliminar componente"
              className="p-1.5 rounded-lg surface-elevated border border-[var(--border-hairline)] text-[var(--status-err)] cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1 p-1 rounded-lg bg-[var(--bg-elevated)]">
          {[
            { id: 'content' as const, label: 'Texto', icon: Type },
            { id: 'style' as const, label: 'Estilo', icon: Palette },
            { id: 'chart' as const, label: 'Gráfica', icon: BarChart3 },
            { id: 'advanced' as const, label: 'Extra', icon: Sliders },
          ].map((t) => {
            const Icon = t.icon;
            if (t.id === 'chart' && block.type !== 'chart') {
              return (
                <button
                  key={t.id}
                  type="button"
                  disabled
                  className="py-1 px-1.5 rounded-md text-[11px] opacity-35 flex items-center justify-center gap-1"
                >
                  <Icon className="w-3 h-3" />
                  <span>{t.label}</span>
                </button>
              );
            }
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`py-1 px-1.5 rounded-md text-[11px] font-medium flex items-center justify-center gap-1 cursor-pointer ${
                  tab === t.id
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon className="w-3 h-3" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
        {tab === 'content' && (
          <>
            {block.type !== 'chart' && block.type !== 'divider' && (
              <>
                <label className="block space-y-1">
                  <span className="text-[var(--text-muted)]">Título</span>
                  <input
                    type="text"
                    disabled={readOnly}
                    value={block.content.title ?? ''}
                    onChange={(e) => patchContent({ title: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg surface-elevated border border-[var(--border-hairline)] text-[var(--text-primary)]"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[var(--text-muted)]">Subtítulo</span>
                  <input
                    type="text"
                    disabled={readOnly}
                    value={block.content.subtitle ?? ''}
                    onChange={(e) => patchContent({ subtitle: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg surface-elevated border border-[var(--border-hairline)] text-[var(--text-primary)]"
                  />
                </label>
              </>
            )}

            {(block.type === 'text' ||
              block.type === 'card' ||
              block.type === 'panel' ||
              block.type === 'container' ||
              block.type === 'callout') && (
              <label className="block space-y-1">
                <span className="text-[var(--text-muted)]">Contenido</span>
                <textarea
                  rows={4}
                  disabled={readOnly}
                  value={block.content.body ?? ''}
                  onChange={(e) => patchContent({ body: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg surface-elevated border border-[var(--border-hairline)] text-[var(--text-primary)]"
                />
              </label>
            )}

            {block.type === 'callout' && (
              <label className="block space-y-1">
                <span className="text-[var(--text-muted)]">Nivel informativo</span>
                <select
                  disabled={readOnly}
                  value={block.content.calloutTone ?? 'info'}
                  onChange={(e) =>
                    patchContent({ calloutTone: e.target.value as 'info' | 'ok' | 'warn' })
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg surface-elevated border border-[var(--border-hairline)] text-[var(--text-primary)]"
                >
                  <option value="info">Informativo</option>
                  <option value="ok">Validado</option>
                  <option value="warn">Advertencia</option>
                </select>
              </label>
            )}

            {block.type === 'image' && (
              <>
                <label className="block space-y-1">
                  <span className="text-[var(--text-muted)]">URL segura de imagen (/ruta o https://)</span>
                  <input
                    type="text"
                    disabled={readOnly}
                    value={block.content.imageUrl ?? ''}
                    onChange={(e) => patchContent({ imageUrl: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg surface-elevated border border-[var(--border-hairline)] text-[var(--text-primary)] font-mono"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[var(--text-muted)]">Texto alternativo (accesibilidad)</span>
                  <input
                    type="text"
                    disabled={readOnly}
                    value={block.content.imageAlt ?? ''}
                    onChange={(e) => patchContent({ imageAlt: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg surface-elevated border border-[var(--border-hairline)] text-[var(--text-primary)]"
                  />
                </label>
              </>
            )}

            {(block.type === 'button' || block.type === 'card') && (
              <div className="space-y-2 pt-2 border-t border-[var(--border-hairline)]">
                <div className="font-semibold text-[var(--text-primary)]">Botón y Navegación</div>
                <label className="block space-y-1">
                  <span className="text-[var(--text-muted)]">Etiqueta del botón</span>
                  <input
                    type="text"
                    disabled={readOnly}
                    value={block.content.buttonLabel ?? ''}
                    onChange={(e) => patchContent({ buttonLabel: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg surface-elevated border border-[var(--border-hairline)] text-[var(--text-primary)]"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[var(--text-muted)]">Acción</span>
                  <select
                    disabled={readOnly}
                    value={block.content.buttonAction ?? 'navigate-module'}
                    onChange={(e) =>
                      patchContent({
                        buttonAction: e.target.value as 'navigate-module' | 'navigate-page' | 'open-url',
                      })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg surface-elevated border border-[var(--border-hairline)] text-[var(--text-primary)]"
                  >
                    <option value="navigate-module">Abrir módulo de VectorIA</option>
                    <option value="navigate-page">Abrir página del Builder</option>
                    <option value="open-url">Enlace HTTPS externo</option>
                  </select>
                </label>
                {block.content.buttonAction === 'navigate-page' ? (
                  <select
                    disabled={readOnly}
                    value={block.content.buttonTarget ?? ''}
                    onChange={(e) => patchContent({ buttonTarget: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg surface-elevated border border-[var(--border-hairline)] text-[var(--text-primary)]"
                  >
                    <option value="">Seleccionar página...</option>
                    {pages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    disabled={readOnly}
                    value={block.content.buttonTarget ?? ''}
                    onChange={(e) => patchContent({ buttonTarget: e.target.value })}
                    placeholder={
                      block.content.buttonAction === 'open-url' ? 'https://...' : 'classifier | linear-algebra'
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg surface-elevated border border-[var(--border-hairline)] text-[var(--text-primary)] font-mono"
                  />
                )}
              </div>
            )}

            {block.type === 'kpi' && (
              <div className="space-y-2 pt-2 border-t border-[var(--border-hairline)]">
                <label className="block space-y-1">
                  <span className="text-[var(--text-muted)]">Fuente de dato real</span>
                  <select
                    disabled={readOnly}
                    value={block.content.kpiValueSource ?? 'alphanumeric-acc'}
                    onChange={(e) =>
                      patchContent({
                        kpiValueSource: e.target.value as NonNullable<
                          BuilderBlock['content']['kpiValueSource']
                        >,
                      })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg surface-elevated border border-[var(--border-hairline)] text-[var(--text-primary)]"
                  >
                    <option value="alphanumeric-acc">Exactitud Combinado 36 (%)</option>
                    <option value="digits-acc">Exactitud Dígitos 0–9 (%)</option>
                    <option value="letters-acc">Exactitud Letras A–Z (%)</option>
                    <option value="predictions-count">Total Inferencias Sesión</option>
                    <option value="simulations-count">Total Simulaciones</option>
                    <option value="reports-count">Informes Técnicos</option>
                    <option value="manual">Valor manual</option>
                  </select>
                </label>
                {block.content.kpiValueSource === 'manual' && (
                  <input
                    type="text"
                    disabled={readOnly}
                    value={block.content.kpiManualValue ?? ''}
                    onChange={(e) => patchContent({ kpiManualValue: e.target.value })}
                    placeholder="Valor manual"
                    className="w-full px-2.5 py-1.5 rounded-lg surface-elevated border border-[var(--border-hairline)] text-[var(--text-primary)] font-mono"
                  />
                )}
              </div>
            )}

            {block.type === 'table' && (
              <div className="space-y-2 pt-2 border-t border-[var(--border-hairline)]">
                <div className="text-[var(--text-muted)]">
                  Columnas (separadas por coma)
                </div>
                <input
                  type="text"
                  disabled={readOnly}
                  value={(block.content.tableColumns ?? []).join(', ')}
                  onChange={(e) =>
                    patchContent({
                      tableColumns: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg surface-elevated border border-[var(--border-hairline)] text-[var(--text-primary)]"
                />
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() =>
                    patchContent({
                      tableRows: [
                        ...(block.content.tableRows ?? []),
                        (block.content.tableColumns ?? ['A', 'B']).map((_, i) =>
                          i === 0 ? 'Nueva fila' : '0'
                        ),
                      ],
                    })
                  }
                  className="w-full py-1.5 rounded-lg surface-elevated border border-[var(--border-hairline)] hover:border-[var(--accent-primary)] text-[var(--text-primary)] cursor-pointer"
                >
                  + Agregar fila de tabla
                </button>
              </div>
            )}

            {block.type === 'diagram' && (
              <label className="block space-y-1">
                <span className="text-[var(--text-muted)]">Tipo de diagrama</span>
                <select
                  disabled={readOnly}
                  value={block.content.diagramKind ?? 'mlp-architecture'}
                  onChange={(e) =>
                    patchContent({
                      diagramKind: e.target.value as
                        | 'mlp-architecture'
                        | 'linear-transform-flow'
                        | 'pipeline-backprop',
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg surface-elevated border border-[var(--border-hairline)] text-[var(--text-primary)]"
                >
                  <option value="mlp-architecture">Flujo Tensorial MLP</option>
                  <option value="linear-transform-flow">Pipeline Álgebra Lineal</option>
                  <option value="pipeline-backprop">Ciclo Backpropagation</option>
                </select>
              </label>
            )}
          </>
        )}

        {tab === 'style' && (
          <>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
                <Layout className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>Dimensiones y Espaciado</span>
              </div>
              <label className="block space-y-1">
                <span className="text-[var(--text-muted)]">Ancho en rejilla (12 columnas)</span>
                <select
                  disabled={readOnly}
                  value={block.styles.colSpan}
                  onChange={(e) =>
                    patchStyles({ colSpan: Number(e.target.value) as 3 | 4 | 6 | 8 | 12 })
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg surface-elevated border border-[var(--border-hairline)] text-[var(--text-primary)]"
                >
                  <option value={3}>25% (3 cols)</option>
                  <option value={4}>33% (4 cols)</option>
                  <option value={6}>50% (6 cols)</option>
                  <option value={8}>66% (8 cols)</option>
                  <option value={12}>100% (12 cols)</option>
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-[var(--text-muted)]">
                  Relleno interno: {block.styles.paddingPx}px
                </span>
                <input
                  type="range"
                  min={8}
                  max={36}
                  disabled={readOnly}
                  value={block.styles.paddingPx}
                  onChange={(e) => patchStyles({ paddingPx: Number(e.target.value) })}
                  className="w-full accent-[var(--accent-primary)]"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[var(--text-muted)]">
                  Radio de borde: {block.styles.borderRadiusPx}px
                </span>
                <input
                  type="range"
                  min={0}
                  max={28}
                  disabled={readOnly}
                  value={block.styles.borderRadiusPx}
                  onChange={(e) => patchStyles({ borderRadiusPx: Number(e.target.value) })}
                  className="w-full accent-[var(--accent-primary)]"
                />
              </label>
            </div>

            <div className="space-y-2 pt-2 border-t border-[var(--border-hairline)]">
              <div className="font-semibold text-[var(--text-primary)]">Tipografía</div>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="text-[var(--text-muted)]">Fuente</span>
                  <select
                    disabled={readOnly}
                    value={block.styles.fontFamily}
                    onChange={(e) => patchStyles({ fontFamily: e.target.value as 'sans' | 'mono' })}
                    className="w-full px-2 py-1.5 rounded-lg surface-elevated border border-[var(--border-hairline)]"
                  >
                    <option value="sans">Jakarta Sans</option>
                    <option value="mono">JetBrains Mono</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-[var(--text-muted)]">Alineación</span>
                  <select
                    disabled={readOnly}
                    value={block.styles.textAlign}
                    onChange={(e) =>
                      patchStyles({ textAlign: e.target.value as 'left' | 'center' | 'right' })
                    }
                    className="w-full px-2 py-1.5 rounded-lg surface-elevated border border-[var(--border-hairline)]"
                  >
                    <option value="left">Izquierda</option>
                    <option value="center">Centro</option>
                    <option value="right">Derecha</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-[var(--border-hairline)]">
              <div className="font-semibold text-[var(--text-primary)]">Colores (opcional sobre tema)</div>
              <div className="grid grid-cols-3 gap-2">
                <label className="space-y-1 text-center">
                  <span className="text-[10px] text-[var(--text-muted)] block">Fondo</span>
                  <input
                    type="color"
                    disabled={readOnly}
                    value={block.styles.backgroundColor || '#101018'}
                    onChange={(e) => patchStyles({ backgroundColor: e.target.value })}
                    className="w-full h-8 rounded cursor-pointer"
                  />
                </label>
                <label className="space-y-1 text-center">
                  <span className="text-[10px] text-[var(--text-muted)] block">Texto</span>
                  <input
                    type="color"
                    disabled={readOnly}
                    value={block.styles.textColor || '#f4f4f8'}
                    onChange={(e) => patchStyles({ textColor: e.target.value })}
                    className="w-full h-8 rounded cursor-pointer"
                  />
                </label>
                <label className="space-y-1 text-center">
                  <span className="text-[10px] text-[var(--text-muted)] block">Borde</span>
                  <input
                    type="color"
                    disabled={readOnly}
                    value={block.styles.borderColor || '#8b5cf6'}
                    onChange={(e) => patchStyles({ borderColor: e.target.value })}
                    className="w-full h-8 rounded cursor-pointer"
                  />
                </label>
              </div>
              <button
                type="button"
                disabled={readOnly}
                onClick={() =>
                  patchStyles({ backgroundColor: '', textColor: '', borderColor: '' })
                }
                className="w-full py-1 rounded-lg surface-elevated border border-[var(--border-hairline)] text-[11px] text-[var(--text-muted)] cursor-pointer"
              >
                Restaurar colores del tema activo
              </button>
            </div>
          </>
        )}

        {tab === 'chart' && block.type === 'chart' && block.content.chartConfig && (
          <div className="space-y-3">
            <label className="block space-y-1">
              <span className="text-[var(--text-muted)]">Tipo de gráfica</span>
              <select
                disabled={readOnly}
                value={block.content.chartConfig.chartKind}
                onChange={(e) =>
                  patchChart({ chartKind: e.target.value as BuilderChartKind })
                }
                className="w-full px-2.5 py-1.5 rounded-lg surface-elevated border border-[var(--border-hairline)] text-[var(--text-primary)]"
              >
                {CHART_KIND_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1">
              <span className="text-[var(--text-muted)]">Fuente de datos reales</span>
              <select
                disabled={readOnly}
                value={block.content.chartConfig.dataSource}
                onChange={(e) => {
                  const ds = e.target.value as BuilderDataSourceKey;
                  patchChart({
                    dataSource: ds,
                    series: SERIES_DEFAULTS_BY_SOURCE[ds],
                  });
                }}
                className="w-full px-2.5 py-1.5 rounded-lg surface-elevated border border-[var(--border-hairline)] text-[var(--text-primary)]"
              >
                {DATA_SOURCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1">
              <span className="text-[var(--text-muted)]">Título de gráfica</span>
              <input
                type="text"
                disabled={readOnly}
                value={block.content.chartConfig.title}
                onChange={(e) => patchChart({ title: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded-lg surface-elevated border border-[var(--border-hairline)] text-[var(--text-primary)]"
              />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="text-[var(--text-muted)]">Eje X</span>
                <input
                  type="text"
                  disabled={readOnly}
                  value={block.content.chartConfig.xAxisLabel}
                  onChange={(e) => patchChart({ xAxisLabel: e.target.value })}
                  className="w-full px-2 py-1 rounded-lg surface-elevated border border-[var(--border-hairline)]"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[var(--text-muted)]">Escala Y</span>
                <select
                  disabled={readOnly}
                  value={block.content.chartConfig.scaleMode}
                  onChange={(e) =>
                    patchChart({
                      scaleMode: e.target.value as 'auto' | 'percentage' | 'unit',
                    })
                  }
                  className="w-full px-2 py-1 rounded-lg surface-elevated border border-[var(--border-hairline)]"
                >
                  <option value="auto">Automática</option>
                  <option value="percentage">0–100%</option>
                  <option value="unit">Unitaria</option>
                </select>
              </label>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={readOnly}
                  checked={block.content.chartConfig.showGrid}
                  onChange={(e) => patchChart({ showGrid: e.target.checked })}
                />
                <span>Cuadrícula</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={readOnly}
                  checked={block.content.chartConfig.showLegend}
                  onChange={(e) => patchChart({ showLegend: e.target.checked })}
                />
                <span>Leyenda</span>
              </label>
            </div>

            <div className="space-y-2 pt-2 border-t border-[var(--border-hairline)]">
              <div className="font-semibold text-[var(--text-primary)]">Series y colores</div>
              {block.content.chartConfig.series.map((ser, sIdx) => (
                <div
                  key={ser.key}
                  className="flex items-center justify-between gap-2 surface-elevated rounded-lg px-2.5 py-1.5"
                >
                  <label className="inline-flex items-center gap-1.5 min-w-0">
                    <input
                      type="checkbox"
                      disabled={readOnly}
                      checked={ser.visible}
                      onChange={(e) => {
                        const next = [...block.content.chartConfig!.series];
                        next[sIdx] = { ...ser, visible: e.target.checked };
                        patchChart({ series: next });
                      }}
                    />
                    <span className="truncate">{ser.label}</span>
                  </label>
                  <input
                    type="color"
                    disabled={readOnly}
                    value={ser.color.startsWith('#') ? ser.color : '#8b5cf6'}
                    onChange={(e) => {
                      const next = [...block.content.chartConfig!.series];
                      next[sIdx] = { ...ser, color: e.target.value };
                      patchChart({ series: next });
                    }}
                    className="w-7 h-6 rounded cursor-pointer shrink-0"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'advanced' && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="font-semibold text-[var(--text-primary)]">
                Conexión con Módulo Nivel 2
              </div>
              <select
                disabled={readOnly}
                value={block.content.connectedSourceModuleId ?? ''}
                onChange={(e) =>
                  patchContent({ connectedSourceModuleId: e.target.value || undefined })
                }
                className="w-full px-2.5 py-1.5 rounded-lg surface-elevated border border-[var(--border-hairline)] text-[var(--text-primary)]"
              >
                <option value="">Sin vinculación explícita</option>
                {modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.enabled ? '' : '(Deshabilitado)'}
                  </option>
                ))}
              </select>
            </div>

            {block.type === 'module-adapter' && (
              <label className="block space-y-1">
                <span className="text-[var(--text-muted)]">Módulo nativo destino</span>
                <select
                  disabled={readOnly}
                  value={block.content.linkedModuleId ?? 'verification'}
                  onChange={(e) =>
                    patchContent({ linkedModuleId: e.target.value as ModuleId })
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg surface-elevated border border-[var(--border-hairline)] text-[var(--text-primary)]"
                >
                  <option value="verification">Calidad y Seguridad</option>
                  <option value="api-console">Consola API (/api/diagnostics)</option>
                  <option value="classifier">Clasificador Alfanumérico</option>
                  <option value="xai">IA Explicable (XAI)</option>
                  <option value="robustness">Robustez</option>
                  <option value="sources">Fuentes Académicas</option>
                  <option value="omni-bot">Omni Bot</option>
                </select>
              </label>
            )}

            <div className="space-y-2 pt-2 border-t border-[var(--border-hairline)]">
              <div className="font-semibold text-[var(--text-primary)]">
                Guardar como Plantilla Reutilizable
              </div>
              <input
                type="text"
                disabled={readOnly}
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Nombre de la plantilla..."
                className="w-full px-2.5 py-1.5 rounded-lg surface-elevated border border-[var(--border-hairline)] text-[var(--text-primary)]"
              />
              <button
                type="button"
                disabled={readOnly || !templateName.trim()}
                onClick={() => {
                  onSaveAsTemplate(block, templateName.trim());
                  setTemplateName('');
                }}
                className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-[var(--accent-primary)] text-[var(--accent-contrast)] font-semibold cursor-pointer disabled:opacity-50"
              >
                <BookmarkPlus className="w-3.5 h-3.5" />
                Guardar Plantilla
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
