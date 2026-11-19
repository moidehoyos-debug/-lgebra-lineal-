import { useMemo } from 'react';
import { useTheme } from '../../context/ThemeContext';

export interface ChartThemePalette {
  bgCanvas: string;
  bgSurface: string;
  bgElevated: string;
  borderHairline: string;
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accentPrimary: string;
  accentSecondary: string;
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
  statusOk: string;
  statusWarn: string;
  statusErr: string;
  isDark: boolean;
}

const FALLBACK_PALETTE: ChartThemePalette = {
  bgCanvas: '#07070b',
  bgSurface: '#101018',
  bgElevated: '#171724',
  borderHairline: 'rgba(167, 139, 250, 0.16)',
  borderStrong: 'rgba(167, 139, 250, 0.34)',
  textPrimary: '#f4f4f8',
  textSecondary: '#c4c4d8',
  textMuted: '#8a8aa6',
  accentPrimary: '#8b5cf6',
  accentSecondary: '#22d3ee',
  chart1: '#8b5cf6',
  chart2: '#22d3ee',
  chart3: '#34d399',
  chart4: '#f59e0b',
  chart5: '#f472b6',
  statusOk: '#34d399',
  statusWarn: '#fbbf24',
  statusErr: '#f87171',
  isDark: true,
};

export function readChartPalette(isDark = true): ChartThemePalette {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { ...FALLBACK_PALETTE, isDark };
  }
  const s = window.getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => s.getPropertyValue(name).trim() || fallback;
  return {
    bgCanvas: v('--bg-canvas', FALLBACK_PALETTE.bgCanvas),
    bgSurface: v('--bg-surface', FALLBACK_PALETTE.bgSurface),
    bgElevated: v('--bg-elevated', FALLBACK_PALETTE.bgElevated),
    borderHairline: v('--border-hairline', FALLBACK_PALETTE.borderHairline),
    borderStrong: v('--border-strong', FALLBACK_PALETTE.borderStrong),
    textPrimary: v('--text-primary', FALLBACK_PALETTE.textPrimary),
    textSecondary: v('--text-secondary', FALLBACK_PALETTE.textSecondary),
    textMuted: v('--text-muted', FALLBACK_PALETTE.textMuted),
    accentPrimary: v('--accent-primary', FALLBACK_PALETTE.accentPrimary),
    accentSecondary: v('--accent-secondary', FALLBACK_PALETTE.accentSecondary),
    chart1: v('--chart-1', FALLBACK_PALETTE.chart1),
    chart2: v('--chart-2', FALLBACK_PALETTE.chart2),
    chart3: v('--chart-3', FALLBACK_PALETTE.chart3),
    chart4: v('--chart-4', FALLBACK_PALETTE.chart4),
    chart5: v('--chart-5', FALLBACK_PALETTE.chart5),
    statusOk: v('--status-ok', FALLBACK_PALETTE.statusOk),
    statusWarn: v('--status-warn', FALLBACK_PALETTE.statusWarn),
    statusErr: v('--status-err', FALLBACK_PALETTE.statusErr),
    isDark,
  };
}

export function useChartPalette(): ChartThemePalette {
  const { theme, themeMeta } = useTheme();
  return useMemo(() => readChartPalette(themeMeta.isDark), [theme, themeMeta.isDark]);
}

function resolveCssVarsInString(raw: string, styles: CSSStyleDeclaration): string {
  return raw.replace(/var\((--[a-zA-Z0-9-]+)\)/g, (_, varName: string) => {
    return styles.getPropertyValue(varName).trim() || '#888888';
  });
}

function triggerDownload(dataUrl: string, filename: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename.endsWith('.png') ? filename : `${filename}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Exports either a <canvas> or an <svg> (including Recharts SVG wrappers) inside `container`
 * as a crisp 2x PNG using the active theme's resolved CSS custom properties.
 */
export async function exportContainerAsPng(
  container: HTMLElement | null,
  filename: string,
  title?: string
): Promise<boolean> {
  if (!container || typeof document === 'undefined') return false;
  const styles = window.getComputedStyle(document.documentElement);
  const bg = styles.getPropertyValue('--bg-canvas').trim() || '#0b0d12';
  const textCol = styles.getPropertyValue('--text-primary').trim() || '#f4f4f8';
  const mutedCol = styles.getPropertyValue('--text-muted').trim() || '#8a8aa6';

  const canvasEl = container.querySelector('canvas');
  if (canvasEl && canvasEl.width > 0 && canvasEl.height > 0) {
    const padTop = title ? 40 : 16;
    const pad = 16;
    const out = document.createElement('canvas');
    out.width = canvasEl.width + pad * 2;
    out.height = canvasEl.height + padTop + pad;
    const ctx = out.getContext('2d');
    if (!ctx) return false;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, out.width, out.height);
    if (title) {
      ctx.fillStyle = textCol;
      ctx.font = '600 15px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(title, pad, 24);
      ctx.fillStyle = mutedCol;
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.fillText('VectorIA Studio', out.width - pad - 110, 24);
    }
    ctx.drawImage(canvasEl, pad, padTop);
    triggerDownload(out.toDataURL('image/png'), filename);
    return true;
  }

  const svgEl = container.querySelector('svg');
  if (!svgEl) return false;

  const rect = svgEl.getBoundingClientRect();
  const w = Math.max(320, Math.round(rect.width || Number(svgEl.getAttribute('width')) || 640));
  const h = Math.max(200, Math.round(rect.height || Number(svgEl.getAttribute('height')) || 360));

  const cloned = svgEl.cloneNode(true) as SVGSVGElement;
  cloned.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  cloned.setAttribute('width', String(w));
  cloned.setAttribute('height', String(h));

  // Resolve CSS custom properties across attributes and inline styles
  const allNodes = [cloned, ...Array.from(cloned.querySelectorAll('*'))];
  for (const node of allNodes) {
    for (const attr of ['fill', 'stroke', 'stop-color', 'color']) {
      const val = node.getAttribute(attr);
      if (val && val.includes('var(')) {
        node.setAttribute(attr, resolveCssVarsInString(val, styles));
      }
    }
    const styleAttr = node.getAttribute('style');
    if (styleAttr && styleAttr.includes('var(')) {
      node.setAttribute('style', resolveCssVarsInString(styleAttr, styles));
    }
  }

  const serialized = resolveCssVarsInString(new XMLSerializer().serializeToString(cloned), styles);
  const blob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  return new Promise<boolean>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const dpr = 2;
      const pad = 20;
      const headerH = title ? 36 : 12;
      const out = document.createElement('canvas');
      out.width = (w + pad * 2) * dpr;
      out.height = (h + headerH + pad) * dpr;
      const ctx = out.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        resolve(false);
        return;
      }
      ctx.scale(dpr, dpr);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w + pad * 2, h + headerH + pad);
      if (title) {
        ctx.fillStyle = textCol;
        ctx.font = '600 13px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(title, pad, 24);
        ctx.fillStyle = mutedCol;
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.textAlign = 'right';
        ctx.fillText('VectorIA Studio', w + pad, 24);
        ctx.textAlign = 'left';
      }
      ctx.drawImage(img, pad, headerH, w, h);
      URL.revokeObjectURL(url);
      triggerDownload(out.toDataURL('image/png'), filename);
      resolve(true);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(false);
    };
    img.src = url;
  });
}
