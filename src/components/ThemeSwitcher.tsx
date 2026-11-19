import React from 'react';
import { Check, Palette } from 'lucide-react';
import { THEME_OPTIONS, useTheme } from '../context/ThemeContext';

interface ThemeSwitcherProps {
  compact?: boolean;
}

export const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ compact = false }) => {
  const { theme, setTheme } = useTheme();

  if (compact) {
    return (
      <div className="flex items-center gap-1.5" role="group" aria-label="Selector de tema">
        {THEME_OPTIONS.map((opt) => {
          const active = opt.id === theme;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                if (!active) setTheme(opt.id);
              }}
              title={`${opt.name}: ${opt.subtitle}`}
              aria-pressed={active}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-transform active:scale-[0.98] cursor-pointer border ${
                active
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--text-primary)]'
                  : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/20"
                style={{
                  background: `linear-gradient(135deg, ${opt.swatches[1]}, ${opt.swatches[2]})`,
                }}
              />
              <span className="hidden xl:inline">{opt.name}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      {THEME_OPTIONS.map((opt) => {
        const active = opt.id === theme;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => {
              if (!active) setTheme(opt.id);
            }}
            aria-pressed={active}
            className={`text-left p-4 rounded-xl border transition-transform active:scale-[0.99] cursor-pointer ${
              active
                ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)]'
                : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)]'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
                <span className="text-sm font-semibold text-[var(--text-primary)] whitespace-nowrap">
                  {opt.name}
                </span>
              </div>
              {active && <Check className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />}
            </div>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed mb-3">
              {opt.subtitle}
            </p>
            <div className="flex items-center gap-1.5">
              {opt.swatches.map((hex, i) => (
                <span
                  key={i}
                  className="h-3 flex-1 rounded-sm border border-black/15"
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
};
