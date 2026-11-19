import { THEME_LOGO_PALETTES, type VectorIALogoPalette } from '../components/VectorIALogo';
import type { ThemeId } from '../types/vectoria';

const LIGHT_THEMES: ReadonlySet<ThemeId> = new Set(['light-yellow', 'classic-mono']);

export interface ThemeFaviconDescriptor {
  themeId: ThemeId;
  variant: 'light' | 'dark';
  palette: VectorIALogoPalette;
  svg: string;
  dataUri: string;
  themeColor: string;
}

export function isLightFaviconTheme(themeId: ThemeId): boolean {
  return LIGHT_THEMES.has(themeId);
}

/**
 * Generates an inline SVG favicon matching VectorIA Studio's geometric V + neural nodes
 * brand identity, tuned specifically for crisp rendering at 16x16–32x32 in browser tabs
 * across all 6 light and dark themes.
 */
export function buildThemeFaviconSvg(themeId: ThemeId): string {
  const palette = THEME_LOGO_PALETTES[themeId] ?? THEME_LOGO_PALETTES['dark-purple'];
  const isLight = isLightFaviconTheme(themeId);
  const frameStroke = isLight ? palette.primary : palette.border;
  const frameStrokeOpacity = isLight ? '0.62' : '0.92';
  const synapticOpacity = isLight ? '0.56' : '0.48';

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" data-theme="${themeId}">`,
    `  <defs>`,
    `    <linearGradient id="vec-fav-bg-${themeId}" x1="4" y1="4" x2="60" y2="60" gradientUnits="userSpaceOnUse">`,
    `      <stop offset="0%" stop-color="${palette.bgSecondary}" />`,
    `      <stop offset="100%" stop-color="${palette.bg}" />`,
    `    </linearGradient>`,
    `    <linearGradient id="vec-fav-prim-${themeId}" x1="14" y1="16" x2="50" y2="50" gradientUnits="userSpaceOnUse">`,
    `      <stop offset="0%" stop-color="${palette.primary}" />`,
    `      <stop offset="58%" stop-color="${palette.secondary}" />`,
    `      <stop offset="100%" stop-color="${palette.tertiary}" />`,
    `    </linearGradient>`,
    `    <linearGradient id="vec-fav-inner-${themeId}" x1="20" y1="18" x2="44" y2="40" gradientUnits="userSpaceOnUse">`,
    `      <stop offset="0%" stop-color="${palette.secondary}" />`,
    `      <stop offset="100%" stop-color="${palette.primary}" />`,
    `    </linearGradient>`,
    `  </defs>`,
    `  <rect x="2" y="2" width="60" height="60" rx="15" fill="url(#vec-fav-bg-${themeId})" stroke="${frameStroke}" stroke-opacity="${frameStrokeOpacity}" stroke-width="2.6" />`,
    `  <path d="M12 16H17M47 16H52M12 48H17M47 48H52" stroke="${palette.secondary}" stroke-opacity="0.34" stroke-width="1.2" stroke-linecap="round" />`,
    `  <line x1="15" y1="17" x2="42" y2="21" stroke="${palette.secondary}" stroke-opacity="${synapticOpacity}" stroke-width="1.7" />`,
    `  <line x1="49" y1="17" x2="22" y2="21" stroke="${palette.secondary}" stroke-opacity="${synapticOpacity}" stroke-width="1.7" />`,
    `  <line x1="32" y1="37" x2="32" y2="49" stroke="${palette.primary}" stroke-opacity="${synapticOpacity}" stroke-width="1.5" />`,
    `  <path d="M15 17L32 49L49 17" stroke="url(#vec-fav-prim-${themeId})" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />`,
    `  <path d="M22 21L32 37L42 21" stroke="url(#vec-fav-inner-${themeId})" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" />`,
    `  <circle cx="15" cy="17" r="4" fill="${palette.secondary}" />`,
    `  <circle cx="49" cy="17" r="4" fill="${palette.secondary}" />`,
    `  <circle cx="22" cy="21" r="2.7" fill="${palette.primary}" />`,
    `  <circle cx="42" cy="21" r="2.7" fill="${palette.primary}" />`,
    `  <circle cx="32" cy="37" r="2.9" fill="${palette.nodeCenter}" />`,
    `  <circle cx="32" cy="49" r="4.4" fill="${palette.primary}" />`,
    `  <circle cx="32" cy="49" r="1.8" fill="${palette.nodeCenter}" />`,
    `</svg>`,
  ].join('\n');
}

export function buildThemeFaviconDataUri(themeId: ThemeId): string {
  const svg = buildThemeFaviconSvg(themeId);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function getThemeFaviconDescriptor(themeId: ThemeId): ThemeFaviconDescriptor {
  const palette = THEME_LOGO_PALETTES[themeId] ?? THEME_LOGO_PALETTES['dark-purple'];
  const svg = buildThemeFaviconSvg(themeId);
  return {
    themeId,
    variant: isLightFaviconTheme(themeId) ? 'light' : 'dark',
    palette,
    svg,
    dataUri: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    themeColor: palette.bg,
  };
}

/**
 * Updates `<link rel="icon">` (and `<meta name="theme-color">` / `<link rel="shortcut icon">` if present)
 * in the active browser document so every tab reflects the active VectorIA Studio theme.
 */
export function updateDocumentFavicon(
  themeId: ThemeId,
  doc?: Document | null
): ThemeFaviconDescriptor | null {
  const targetDoc = doc ?? (typeof document !== 'undefined' ? document : null);
  if (!targetDoc || !targetDoc.head) {
    return null;
  }

  const descriptor = getThemeFaviconDescriptor(themeId);

  let iconLink = targetDoc.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
  if (!iconLink) {
    iconLink = targetDoc.createElement('link');
    iconLink.rel = 'icon';
    targetDoc.head.appendChild(iconLink);
  }
  iconLink.type = 'image/svg+xml';
  iconLink.href = descriptor.dataUri;
  iconLink.setAttribute('data-theme', themeId);
  iconLink.setAttribute('data-variant', descriptor.variant);

  const shortcutLink = targetDoc.querySelector(
    'link[rel="shortcut icon"]'
  ) as HTMLLinkElement | null;
  if (shortcutLink) {
    shortcutLink.type = 'image/svg+xml';
    shortcutLink.href = descriptor.dataUri;
    shortcutLink.setAttribute('data-theme', themeId);
  }

  let themeMeta = targetDoc.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
  if (!themeMeta) {
    themeMeta = targetDoc.createElement('meta');
    themeMeta.name = 'theme-color';
    targetDoc.head.appendChild(themeMeta);
  }
  themeMeta.content = descriptor.themeColor;

  return descriptor;
}
