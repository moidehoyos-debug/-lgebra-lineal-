import React, { createContext, useContext, useLayoutEffect, useState } from 'react';
import { ThemeId, ThemeMeta } from '../types/vectoria';

export const THEME_OPTIONS: ThemeMeta[] = [
  {
    id: 'dark-purple',
    name: 'Dark Purple',
    subtitle: 'Fondo profundo con acentos violeta y cian',
    isDark: true,
    swatches: ['#07070b', '#8b5cf6', '#22d3ee'],
  },
  {
    id: 'light-yellow',
    name: 'Light Yellow',
    subtitle: 'Superficie clara corporativa con acentos dorados',
    isDark: false,
    swatches: ['#ffffff', '#ca8a04', '#eab308'],
  },
  {
    id: 'classic-mono',
    name: 'Classic Mono',
    subtitle: 'Alto contraste académico en blanco, negro y grises',
    isDark: false,
    swatches: ['#fafafa', '#18181b', '#71717a'],
  },
  {
    id: 'holographic',
    name: 'Holographic',
    subtitle: 'Gradientes iridiscentes y glassmorphism moderado',
    isDark: true,
    swatches: ['#080b14', '#38bdf8', '#e879f9'],
  },
  {
    id: 'black-gold',
    name: 'Black & Gold',
    subtitle: 'Negro profundo, dorado metálico y champagne',
    isDark: true,
    swatches: ['#060607', '#d4af37', '#f3e5ab'],
  },
  {
    id: 'neural-cyberpunk',
    name: 'Neural Cyberpunk',
    subtitle: 'Grafito, azul eléctrico, violeta/magenta y cian neural',
    isDark: true,
    swatches: ['#0b0d12', '#2f7cf6', '#22d3ee'],
  },
];

const STORAGE_KEY = 'vectoria-theme';

export function isValidThemeId(value: string | null): value is ThemeId {
  return (
    value === 'dark-purple' ||
    value === 'light-yellow' ||
    value === 'classic-mono' ||
    value === 'holographic' ||
    value === 'black-gold' ||
    value === 'neural-cyberpunk'
  );
}

export function getSavedTheme(): ThemeId {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return isValidThemeId(saved) ? saved : 'dark-purple';
  } catch {
    return 'dark-purple';
  }
}

export function applyThemeToDocument(themeId: ThemeId, suppressTransitions = false): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const meta = THEME_OPTIONS.find((t) => t.id === themeId) ?? THEME_OPTIONS[0];

  if (suppressTransitions) {
    root.classList.add('theme-instant');
  }

  root.setAttribute('data-theme', themeId);
  root.style.colorScheme = meta.isDark ? 'dark' : 'light';
  if (meta.isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  if (suppressTransitions) {
    // Force style recalculation synchronously while transitions are suppressed so colors/borders snap in 1 frame
    void root.offsetHeight;
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => {
        root.classList.remove('theme-instant');
      });
    } else {
      root.classList.remove('theme-instant');
    }
  }
}

interface ThemeContextValue {
  theme: ThemeId;
  themeMeta: ThemeMeta;
  setTheme: (next: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeId>(() => getSavedTheme());

  const setTheme = (next: ThemeId) => {
    if (!isValidThemeId(next)) return;
    applyThemeToDocument(next, true);
    setThemeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore storage quota errors in restricted environments
    }
  };

  useLayoutEffect(() => {
    applyThemeToDocument(theme, false);
  }, [theme]);

  const themeMeta = THEME_OPTIONS.find((t) => t.id === theme) ?? THEME_OPTIONS[0];

  return (
    <ThemeContext.Provider value={{ theme, themeMeta, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme debe usarse dentro de ThemeProvider');
  }
  return ctx;
}
