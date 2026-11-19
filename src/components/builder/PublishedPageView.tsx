import React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { useBuilder } from '../../context/BuilderContext';
import { useStudio } from '../../context/StudioContext';
import { BuilderPage } from '../../types/builder';
import { BuilderBlockRenderer } from './BuilderBlockRenderer';

interface PublishedPageViewProps {
  page: BuilderPage;
}

export const PublishedPageView: React.FC<PublishedPageViewProps> = ({ page }) => {
  const { published, setActiveCustomPageId } = useBuilder();
  const { setActiveModule } = useStudio();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{page.title}</h1>
          {page.description && (
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{page.description}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setActiveCustomPageId(null);
            setActiveModule('visual-builder');
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[var(--border-hairline)] surface-elevated hover:border-[var(--accent-primary)] text-xs font-semibold text-[var(--text-primary)] cursor-pointer self-start whitespace-nowrap"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
          Editar en Visual Builder
        </button>
      </div>

      {page.sections
        .filter((s) => s.visible)
        .map((section) => (
          <section key={section.id} className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">{section.title}</h2>
              {section.description && (
                <p className="text-xs text-[var(--text-muted)]">{section.description}</p>
              )}
            </div>
            <div
              className="grid grid-cols-12"
              style={{ gap: `${section.gapPx}px` }}
            >
              {section.blocks
                .filter((b) => b.visible)
                .map((block) => {
                  const spanCls =
                    block.styles.colSpan === 12
                      ? 'col-span-12'
                      : block.styles.colSpan === 8
                        ? 'col-span-12 lg:col-span-8'
                        : block.styles.colSpan === 4
                          ? 'col-span-12 sm:col-span-6 lg:col-span-4'
                          : block.styles.colSpan === 3
                            ? 'col-span-12 sm:col-span-6 lg:col-span-3'
                            : 'col-span-12 lg:col-span-6';
                  return (
                    <div key={block.id} className={spanCls}>
                      <BuilderBlockRenderer
                        block={block}
                        modules={published.modules}
                        connections={published.connections}
                        onNavigateCustomPage={(pid) => setActiveCustomPageId(pid)}
                      />
                    </div>
                  );
                })}
            </div>
          </section>
        ))}
    </div>
  );
};
