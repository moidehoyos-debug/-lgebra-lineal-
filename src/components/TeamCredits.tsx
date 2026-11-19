import React from 'react';
import { OFFICIAL_TEAM_MEMBERS, type OfficialTeamMember } from '../config/team';

export interface TeamCreditsProps {
  members?: readonly OfficialTeamMember[];
  className?: string;
}

export const TeamCredits: React.FC<TeamCreditsProps> = ({
  members = OFFICIAL_TEAM_MEMBERS,
  className = '',
}) => {
  return (
    <div
      data-component="team-credits"
      className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${className}`.trim()}
    >
      {members.map((member) => (
        <article
          key={member.id}
          className="surface-elevated rounded-xl p-5 border border-[var(--border-hairline)] hover:border-[var(--border-strong)] transition-colors flex flex-col justify-between gap-4"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono tabular-nums text-xs font-semibold tracking-wider text-[var(--accent-primary)]">
              {member.orderNumber}
            </span>

            <svg
              width="26"
              height="26"
              viewBox="0 0 28 28"
              fill="none"
              aria-hidden="true"
              className="shrink-0 opacity-85"
            >
              <path
                d="M5 7L14 22L23 7"
                stroke="var(--accent-primary)"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <line
                x1="5"
                y1="7"
                x2="23"
                y2="7"
                stroke="var(--accent-secondary)"
                strokeOpacity="0.45"
                strokeWidth="1"
              />
              <circle cx="5" cy="7" r="2" fill="var(--accent-secondary)" />
              <circle cx="23" cy="7" r="2" fill="var(--accent-secondary)" />
              <circle cx="14" cy="22" r="2.2" fill="var(--accent-primary)" />
            </svg>
          </div>

          <div className="h-px w-full bg-[var(--border-hairline)]" aria-hidden="true" />

          <div className="space-y-1">
            <h3 className="text-base font-semibold tracking-tight text-[var(--text-primary)]">
              {member.name}
            </h3>
            {member.role && (
              <p className="text-xs text-[var(--text-secondary)]">{member.role}</p>
            )}
          </div>
        </article>
      ))}
    </div>
  );
};

export default TeamCredits;
