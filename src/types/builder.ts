import type { ClassifierMode, ModuleId, ThemeId } from './vectoria.ts';

export type BuilderRole = 'admin' | 'editor' | 'viewer';

export interface BuilderAuthSession {
  token: string;
  role: BuilderRole;
  displayName: string;
  expiresAt: string;
}

export type BuilderComponentCategory =
  | 'estructura'
  | 'contenido'
  | 'diseno'
  | 'graficas'
  | 'indicadores'
  | 'matematicas'
  | 'ia'
  | 'herramientas'
  | 'modulos';

export type BuilderBlockType =
  | 'section'
  | 'container'
  | 'card'
  | 'panel'
  | 'text'
  | 'image'
  | 'button'
  | 'table'
  | 'kpi'
  | 'chart'
  | 'diagram'
  | 'callout'
  | 'divider'
  | 'nav-menu'
  | 'stats-panel'
  | 'math-tool'
  | 'ai-module'
  | 'module-adapter';

export type BuilderChartKind =
  | 'bar'
  | 'horizontal-bar'
  | 'line'
  | 'area'
  | 'scatter'
  | 'histogram'
  | 'heatmap'
  | 'confusion-matrix';

export type BuilderDataSourceKey =
  | 'models-comparison'
  | 'training-digits'
  | 'training-letters'
  | 'training-alphanumeric'
  | 'softmax-last'
  | 'prediction-timeline'
  | 'confusion-matrix'
  | 'simulation-history'
  | 'eigen-spectrum';

export interface BuilderChartSeriesConfig {
  key: string;
  label: string;
  color: string;
  visible: boolean;
}

export interface BuilderChartConfig {
  chartKind: BuilderChartKind;
  dataSource: BuilderDataSourceKey;
  title: string;
  subtitle: string;
  xAxisLabel: string;
  yAxisLabel: string;
  showLegend: boolean;
  showGrid: boolean;
  scaleMode: 'auto' | 'percentage' | 'unit';
  heightPx: number;
  series: BuilderChartSeriesConfig[];
}

export interface BuilderBlockStyles {
  colSpan: 3 | 4 | 6 | 8 | 12;
  paddingPx: number;
  marginBottomPx: number;
  borderRadiusPx: number;
  borderWidthPx: number;
  borderColor: string;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  fontSizePx: number;
  fontWeight: '400' | '500' | '600' | '700';
  fontFamily: 'sans' | 'mono';
  textAlign: 'left' | 'center' | 'right';
  shadow: 'none' | 'subtle' | 'elevated';
}

export interface BuilderBlockContent {
  title?: string;
  subtitle?: string;
  body?: string;
  imageUrl?: string;
  imageAlt?: string;
  buttonLabel?: string;
  buttonAction?: 'navigate-module' | 'navigate-page' | 'open-url';
  buttonTarget?: string;
  buttonVariant?: 'primary' | 'secondary' | 'outline';
  kpiValueSource?:
    | 'alphanumeric-acc'
    | 'digits-acc'
    | 'letters-acc'
    | 'predictions-count'
    | 'simulations-count'
    | 'reports-count'
    | 'manual';
  kpiManualValue?: string;
  kpiUnit?: string;
  tableColumns?: string[];
  tableRows?: Array<Array<string | number>>;
  diagramKind?: 'mlp-architecture' | 'linear-transform-flow' | 'pipeline-backprop';
  calloutTone?: 'info' | 'ok' | 'warn';
  linkedModuleId?: ModuleId;
  classifierModePreset?: ClassifierMode;
  mathOperationPreset?: 'determinant' | 'inverse' | 'eigen' | 'lu' | 'qr';
  connectedSourceModuleId?: string;
  connectedInputPort?: string;
  chartConfig?: BuilderChartConfig;
}

export interface BuilderBlock {
  id: string;
  type: BuilderBlockType;
  category: BuilderComponentCategory;
  name: string;
  visible: boolean;
  styles: BuilderBlockStyles;
  content: BuilderBlockContent;
}

export interface BuilderSection {
  id: string;
  title: string;
  description: string;
  visible: boolean;
  columns: 1 | 2 | 3;
  gapPx: number;
  blocks: BuilderBlock[];
}

export interface BuilderPage {
  id: string;
  slug: string;
  title: string;
  description: string;
  visible: boolean;
  showInSidebar: boolean;
  order: number;
  isSystemPage: boolean;
  linkedSystemModuleId?: ModuleId;
  updatedAt: string;
  sections: BuilderSection[];
}

export interface BuilderThemePreset {
  id: string;
  name: string;
  baseTheme: ThemeId;
  primaryColor: string;
  secondaryColor: string;
  canvasBg: string;
  surfaceBg: string;
  fontFamily: 'Plus Jakarta Sans' | 'JetBrains Mono' | 'system-ui';
  borderRadiusPx: number;
  spacingScale: 'compact' | 'balanced' | 'airy';
  cardAppearance: 'bordered' | 'glass' | 'flat';
  buttonStyle: 'rounded' | 'sharp' | 'soft';
  density: 'compact' | 'standard' | 'comfortable';
  panelLayout: 'sidebar-standard' | 'wide-canvas';
}

export interface BuilderComponentTemplate {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  block: Omit<BuilderBlock, 'id'>;
}

export interface PreparedModuleSpec {
  id: string;
  name: string;
  category: 'math' | 'ai' | 'visualization' | 'analytics' | 'system';
  description: string;
  dependencies: string[];
  inputPorts: string[];
  outputPorts: string[];
  linkedRoute: ModuleId;
  enabled: boolean;
  builtIn: boolean;
}

export interface ModuleConnection {
  id: string;
  sourceModuleId: string;
  sourcePort: string;
  targetPageId: string;
  targetBlockId: string;
  targetPort: string;
  enabled: boolean;
}

export interface BuilderStateDocument {
  schemaVersion: number;
  appVersion: string;
  pages: BuilderPage[];
  activeThemePresetId: string | null;
  themePresets: BuilderThemePreset[];
  templates: BuilderComponentTemplate[];
  modules: PreparedModuleSpec[];
  connections: ModuleConnection[];
  sidebarOrder: string[];
  hiddenSystemModules: ModuleId[];
}

export interface BuilderVersionEntry {
  id: string;
  timestamp: string;
  authorRole: BuilderRole;
  description: string;
  changedItems: string[];
  publishState: 'draft' | 'published';
  previousSummary: string;
  nextSummary: string;
  snapshot: BuilderStateDocument;
}

export interface BuilderAuditEntry {
  id: string;
  timestamp: string;
  role: BuilderRole;
  action: string;
  detail: string;
}

export interface BuilderRemoteBundle {
  initialized: boolean;
  draft: BuilderStateDocument;
  published: BuilderStateDocument;
  hasUnpublishedChanges: boolean;
  versions: BuilderVersionEntry[];
  auditLog: BuilderAuditEntry[];
  updatedAt: string;
  publishedAt: string | null;
}
