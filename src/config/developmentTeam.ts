import { sanitizeBuilderText } from '../utils/builderSecurity';
import {
  OFFICIAL_TEAM_MEMBERS,
  OFFICIAL_TEAM_NAMES,
  type OfficialTeamMember,
} from './team';

export { OFFICIAL_TEAM_MEMBERS, OFFICIAL_TEAM_NAMES };
export type { OfficialTeamMember };

export interface DevelopmentTeamMember {
  id: string;
  orderNumber: string;
  name: string;
  role?: string;
}

export const DEVELOPMENT_TEAM_STORAGE_KEY = 'vectoria-development-team-v1';

export const DEVELOPMENT_TEAM_METADATA = {
  sectionTitle: 'Equipo de desarrollo',
  institutionalLabel: 'VectorIA Studio · Créditos institucionales del proyecto',
  description:
    'Integrantes oficiales responsables de la ingeniería, arquitectura e identidad de VectorIA Studio.',
} as const;

/**
 * Configuración oficial centralizada y editable del equipo de desarrollo.
 * El orden y los nombres oficiales provienen estrictamente de `src/config/team.ts` (01–03).
 */
export const OFFICIAL_DEVELOPMENT_TEAM: readonly DevelopmentTeamMember[] = OFFICIAL_TEAM_MEMBERS;

interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem?: (key: string) => void;
}

function getDefaultStorage(): StorageLike | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function getDefaultDevelopmentTeam(): DevelopmentTeamMember[] {
  return OFFICIAL_DEVELOPMENT_TEAM.map((member) => ({ ...member }));
}

export function normalizeDevelopmentTeamMembers(
  candidates: Array<Partial<DevelopmentTeamMember>>
): DevelopmentTeamMember[] {
  return OFFICIAL_DEVELOPMENT_TEAM.map((official, index) => {
    const incoming = candidates[index];
    const cleanedName =
      typeof incoming?.name === 'string'
        ? sanitizeBuilderText(incoming.name, 80).trim()
        : '';
    const cleanedRole =
      typeof incoming?.role === 'string'
        ? sanitizeBuilderText(incoming.role, 80).trim()
        : '';

    return {
      id: official.id,
      orderNumber: String(index + 1).padStart(2, '0'),
      name: cleanedName.length > 0 ? cleanedName : official.name,
      ...(cleanedRole.length > 0 ? { role: cleanedRole } : {}),
    };
  });
}

export function loadDevelopmentTeam(storage?: StorageLike | null): DevelopmentTeamMember[] {
  const store = storage ?? getDefaultStorage();
  if (!store) return getDefaultDevelopmentTeam();
  try {
    const raw = store.getItem(DEVELOPMENT_TEAM_STORAGE_KEY);
    if (!raw) return getDefaultDevelopmentTeam();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length !== OFFICIAL_DEVELOPMENT_TEAM.length) {
      return getDefaultDevelopmentTeam();
    }
    return normalizeDevelopmentTeamMembers(parsed as Array<Partial<DevelopmentTeamMember>>);
  } catch {
    return getDefaultDevelopmentTeam();
  }
}

export function saveDevelopmentTeam(
  members: Array<Partial<DevelopmentTeamMember>>,
  storage?: StorageLike | null
): DevelopmentTeamMember[] {
  const normalized = normalizeDevelopmentTeamMembers(members);
  const store = storage ?? getDefaultStorage();
  if (store) {
    try {
      store.setItem(DEVELOPMENT_TEAM_STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      // Ignore storage quota errors
    }
  }
  return normalized;
}

export function resetDevelopmentTeam(storage?: StorageLike | null): DevelopmentTeamMember[] {
  const store = storage ?? getDefaultStorage();
  if (store?.removeItem) {
    try {
      store.removeItem(DEVELOPMENT_TEAM_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }
  return getDefaultDevelopmentTeam();
}
