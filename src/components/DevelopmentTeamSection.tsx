import React, { useEffect, useRef, useState } from 'react';
import { PencilLine, RotateCcw, Save, Users, X } from 'lucide-react';
import {
  DEVELOPMENT_TEAM_METADATA,
  DevelopmentTeamMember,
  loadDevelopmentTeam,
  resetDevelopmentTeam,
  saveDevelopmentTeam,
} from '../config/developmentTeam';
import { OFFICIAL_TEAM_MEMBERS } from '../config/team';
import { TeamCredits } from './TeamCredits';

export const DEVELOPMENT_TEAM_SCROLL_KEY = 'vectoria-scroll-target';

interface DevelopmentTeamSectionProps {
  id?: string;
}

export const DevelopmentTeamSection: React.FC<DevelopmentTeamSectionProps> = ({
  id = 'equipo-desarrollo',
}) => {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [members, setMembers] = useState<DevelopmentTeamMember[]>(() => {
    const loaded = loadDevelopmentTeam();
    return loaded.length === OFFICIAL_TEAM_MEMBERS.length
      ? loaded
      : OFFICIAL_TEAM_MEMBERS.map((m) => ({ ...m }));
  });
  const [isEditing, setIsEditing] = useState(false);
  const [draftMembers, setDraftMembers] = useState<DevelopmentTeamMember[]>(() =>
    loadDevelopmentTeam()
  );

  useEffect(() => {
    try {
      const target = window.sessionStorage.getItem(DEVELOPMENT_TEAM_SCROLL_KEY);
      if (target === id) {
        window.sessionStorage.removeItem(DEVELOPMENT_TEAM_SCROLL_KEY);
        window.requestAnimationFrame(() => {
          sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    } catch {
      // Ignore storage access errors
    }
  }, [id]);

  const handleStartEdit = () => {
    setDraftMembers(members.map((m) => ({ ...m })));
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setDraftMembers(members.map((m) => ({ ...m })));
    setIsEditing(false);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    const saved = saveDevelopmentTeam(draftMembers);
    setMembers(saved);
    setDraftMembers(saved);
    setIsEditing(false);
  };

  const handleResetOfficial = () => {
    const restored = resetDevelopmentTeam();
    setMembers(restored);
    setDraftMembers(restored);
    setIsEditing(false);
  };

  return (
    <section
      ref={sectionRef}
      id={id}
      aria-labelledby={`${id}-heading`}
      className="surface-card rounded-2xl p-5 sm:p-6 space-y-5 scroll-mt-20"
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-[11px] font-medium text-[var(--text-muted)]">
            {DEVELOPMENT_TEAM_METADATA.institutionalLabel}
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
            <h2
              id={`${id}-heading`}
              className="text-base font-semibold tracking-tight text-[var(--text-primary)]"
            >
              {DEVELOPMENT_TEAM_METADATA.sectionTitle}
            </h2>
          </div>
          <p className="text-xs text-[var(--text-muted)] max-w-2xl">
            {DEVELOPMENT_TEAM_METADATA.description}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start">
          {!isEditing ? (
            <button
              type="button"
              onClick={handleStartEdit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border-hairline)] surface-elevated text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition-colors cursor-pointer whitespace-nowrap"
            >
              <PencilLine className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              Editar integrantes
            </button>
          ) : (
            <button
              type="button"
              onClick={handleResetOfficial}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border-hairline)] surface-elevated text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
              Restaurar oficiales
            </button>
          )}
        </div>
      </div>

      {!isEditing ? (
        <TeamCredits members={members} />
      ) : (
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {draftMembers.map((member, index) => (
              <div
                key={member.id}
                className="surface-elevated rounded-xl p-4 border border-[var(--border-strong)] space-y-3"
              >
                <div className="font-mono tabular-nums text-xs font-semibold text-[var(--accent-primary)]">
                  Integrante {member.orderNumber}
                </div>
                <label className="block space-y-1 text-xs">
                  <span className="text-[var(--text-secondary)] font-medium">Nombre completo</span>
                  <input
                    type="text"
                    required
                    maxLength={80}
                    value={member.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDraftMembers((prev) =>
                        prev.map((item, idx) => (idx === index ? { ...item, name: val } : item))
                      );
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-xs text-[var(--text-primary)]"
                  />
                </label>
                <label className="block space-y-1 text-xs">
                  <span className="text-[var(--text-muted)]">Rol (opcional, definido por el equipo)</span>
                  <input
                    type="text"
                    maxLength={80}
                    value={member.role ?? ''}
                    placeholder="Sin asignar"
                    onChange={(e) => {
                      const val = e.target.value;
                      setDraftMembers((prev) =>
                        prev.map((item, idx) => (idx === index ? { ...item, role: val } : item))
                      );
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-xs text-[var(--text-primary)]"
                  />
                </label>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-contrast)] cursor-pointer whitespace-nowrap"
            >
              <Save className="w-3.5 h-3.5" />
              Guardar cambios
            </button>
            <button
              type="button"
              onClick={handleCancelEdit}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium border border-[var(--border-hairline)] surface-elevated text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer whitespace-nowrap"
            >
              <X className="w-3.5 h-3.5" />
              Cancelar
            </button>
          </div>
        </form>
      )}
    </section>
  );
};
