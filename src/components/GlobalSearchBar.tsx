import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CornerDownLeft, FileCode2, LayoutDashboard, Search, X } from 'lucide-react';
import type { ModuleId } from '../types/vectoria';
import {
  filterGlobalSearchEntries,
  type GlobalSearchEntry,
} from '../utils/globalSearch';

interface GlobalSearchBarProps {
  entries: readonly GlobalSearchEntry[];
  activeModule: ModuleId;
  activeCustomPageId: string | null;
  iconByModuleId: Partial<Record<ModuleId, React.FC<{ className?: string }>>>;
  onSelectModule: (id: ModuleId) => void;
  onSelectCustomPage: (pageId: string) => void;
}

export const GlobalSearchBar: React.FC<GlobalSearchBarProps> = ({
  entries,
  activeModule,
  activeCustomPageId,
  iconByModuleId,
  onSelectModule,
  onSelectCustomPage,
}) => {
  const [query, setQuery] = useState('');
  const [desktopOpen, setDesktopOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const desktopInputRef = useRef<HTMLInputElement | null>(null);
  const mobileInputRef = useRef<HTMLInputElement | null>(null);

  const results = useMemo(
    () => filterGlobalSearchEntries(entries, query, 10),
    [entries, query]
  );

  useEffect(() => {
    setHighlightedIndex(0);
  }, [query, desktopOpen, mobileOpen]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isModK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
      const target = e.target as HTMLElement | null;
      const isTypingTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        Boolean(target?.isContentEditable);

      if (isModK || (!isTypingTarget && e.key === '/')) {
        e.preventDefault();
        if (window.innerWidth < 768) {
          setMobileOpen(true);
          window.requestAnimationFrame(() => mobileInputRef.current?.focus());
        } else {
          setDesktopOpen(true);
          desktopInputRef.current?.focus();
          desktopInputRef.current?.select();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  useEffect(() => {
    if (!desktopOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDesktopOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [desktopOpen]);

  useEffect(() => {
    if (mobileOpen) {
      window.requestAnimationFrame(() => mobileInputRef.current?.focus());
    }
  }, [mobileOpen]);

  const navigateToEntry = (entry: GlobalSearchEntry) => {
    if (entry.kind === 'custom-page' && entry.customPageId) {
      onSelectCustomPage(entry.customPageId);
    } else if (entry.kind === 'module' && entry.moduleId) {
      onSelectModule(entry.moduleId);
    }
    setQuery('');
    setDesktopOpen(false);
    setMobileOpen(false);
    desktopInputRef.current?.blur();
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setDesktopOpen(false);
      setMobileOpen(false);
      desktopInputRef.current?.blur();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!desktopOpen && window.innerWidth >= 768) {
        setDesktopOpen(true);
      }
      setHighlightedIndex((prev) => (results.length === 0 ? 0 : (prev + 1) % results.length));
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        results.length === 0 ? 0 : (prev - 1 + results.length) % results.length
      );
      return;
    }

    if (e.key === 'Enter') {
      const picked = results[highlightedIndex] ?? results[0];
      if (picked) {
        e.preventDefault();
        navigateToEntry(picked);
      }
    }
  };

  const isEntryActive = (entry: GlobalSearchEntry) => {
    if (entry.kind === 'custom-page') {
      return activeCustomPageId !== null && activeCustomPageId === entry.customPageId;
    }
    return activeCustomPageId === null && entry.moduleId === activeModule;
  };

  const renderResultsList = () => {
    if (results.length === 0) {
      return (
        <div className="px-4 py-6 text-center text-xs text-[var(--text-muted)]">
          No se encontraron módulos, laboratorios ni páginas para &quot;{query}&quot;.
        </div>
      );
    }

    return (
      <div
        role="listbox"
        aria-label="Resultados de navegación global"
        className="max-h-80 overflow-y-auto py-1.5 divide-y divide-[var(--border-hairline)]/60"
      >
        {results.map((entry, idx) => {
          const Icon =
            entry.kind === 'custom-page'
              ? FileCode2
              : (entry.moduleId && iconByModuleId[entry.moduleId]) || LayoutDashboard;
          const isHighlighted = idx === highlightedIndex;
          const isActive = isEntryActive(entry);

          return (
            <button
              key={entry.key}
              type="button"
              role="option"
              aria-selected={isHighlighted}
              onMouseEnter={() => setHighlightedIndex(idx)}
              onClick={() => navigateToEntry(entry)}
              className={`w-full px-3.5 py-2.5 flex items-start justify-between gap-3 text-left transition-colors cursor-pointer ${
                isHighlighted
                  ? 'bg-[var(--accent-soft)]'
                  : 'hover:bg-[var(--bg-elevated)]'
              }`}
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <Icon
                  className={`w-4 h-4 mt-0.5 shrink-0 ${
                    isHighlighted || isActive
                      ? 'text-[var(--accent-primary)]'
                      : 'text-[var(--text-muted)]'
                  }`}
                />
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-[var(--text-primary)] truncate">
                      {entry.title}
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)] shrink-0">
                      · {entry.categoryLabel}
                    </span>
                    {isActive && (
                      <span className="text-[11px] font-medium text-[var(--accent-primary)] shrink-0">
                        · Activo
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)] truncate">
                    {entry.description}
                  </p>
                </div>
              </div>

              {isHighlighted && (
                <CornerDownLeft className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0 mt-1" />
              )}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <>
      {/* Desktop / Tablet Top Bar Search */}
      <div ref={containerRef} className="relative hidden md:block w-56 lg:w-72 xl:w-80">
        <div className="relative flex items-center">
          <Search
            className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 pointer-events-none"
            aria-hidden="true"
          />
          <input
            ref={desktopInputRef}
            type="search"
            value={query}
            onFocus={() => setDesktopOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!desktopOpen) setDesktopOpen(true);
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="Buscar laboratorios o módulos..."
            aria-label="Búsqueda global de laboratorios, módulos y páginas"
            aria-expanded={desktopOpen}
            aria-autocomplete="list"
            className="w-full h-9 pl-8 pr-14 rounded-lg text-xs surface-elevated border border-[var(--border-hairline)] focus:border-[var(--accent-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-colors"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                desktopInputRef.current?.focus();
              }}
              aria-label="Limpiar búsqueda"
              className="absolute right-2 p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute right-2.5 text-[10px] font-mono text-[var(--text-muted)]">
              Ctrl K
            </kbd>
          )}
        </div>

        {desktopOpen && (
          <div className="absolute right-0 mt-2 w-[24rem] max-w-[90vw] rounded-xl surface-card border border-[var(--border-strong)] shadow-2xl overflow-hidden z-50">
            <div className="px-3.5 py-2 border-b border-[var(--border-hairline)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
              <span>Navegación rápida ({results.length})</span>
              <span className="font-mono">↑↓ · Enter · Esc</span>
            </div>
            {renderResultsList()}
          </div>
        )}
      </div>

      {/* Mobile Compact Search Trigger */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Buscar laboratorios, módulos y páginas"
        className="md:hidden p-2 rounded-lg border border-[var(--border-hairline)] surface-elevated text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer shrink-0"
      >
        <Search className="w-4 h-4" />
      </button>

      {/* Mobile Search Modal */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden bg-black/55 p-4 pt-16 flex items-start justify-center"
          onClick={() => setMobileOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Búsqueda global"
            className="w-full max-w-md rounded-xl surface-card border border-[var(--border-strong)] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 border-b border-[var(--border-hairline)] flex items-center gap-2">
              <Search className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
              <input
                ref={mobileInputRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="Buscar laboratorios, módulos o páginas..."
                aria-label="Buscar en VectorIA Studio"
                className="flex-1 min-w-0 bg-transparent text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
              />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Cerrar búsqueda"
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {renderResultsList()}
          </div>
        </div>
      )}
    </>
  );
};
