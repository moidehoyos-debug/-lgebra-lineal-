export const OMNI_COMMAND_HISTORY_KEY = 'vectoria-omni-command-history-v1';
export const MAX_OMNI_COMMAND_HISTORY = 10;

export interface OmniCommandHistoryEntry {
  id: string;
  query: string;
  timestamp: string;
}

function sanitizeQueryText(raw: string): string {
  return raw.replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, 600);
}

/**
 * Registra una consulta en el historial de comandos de Omni Bot,
 * manteniendo entradas únicas más recientes arriba hasta un máximo de 10.
 */
export function recordOmniCommand(
  current: OmniCommandHistoryEntry[],
  rawQuery: string,
  maxItems = MAX_OMNI_COMMAND_HISTORY,
  nowIso = new Date().toISOString()
): OmniCommandHistoryEntry[] {
  const query = sanitizeQueryText(rawQuery);
  if (!query) return current;

  const filtered = current.filter((item) => item.query !== query);
  const nextEntry: OmniCommandHistoryEntry = {
    id: `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    query,
    timestamp: nowIso,
  };

  return [nextEntry, ...filtered].slice(0, Math.max(1, maxItems));
}

export function loadOmniCommandHistory(
  storage?: Pick<Storage, 'getItem'> | null
): OmniCommandHistoryEntry[] {
  try {
    const store = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    if (!store) return [];
    const raw = store.getItem(OMNI_COMMAND_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is OmniCommandHistoryEntry =>
          Boolean(item) &&
          typeof item.id === 'string' &&
          typeof item.query === 'string' &&
          typeof item.timestamp === 'string' &&
          item.query.trim().length > 0
      )
      .slice(0, MAX_OMNI_COMMAND_HISTORY);
  } catch {
    return [];
  }
}

export function saveOmniCommandHistory(
  entries: OmniCommandHistoryEntry[],
  storage?: Pick<Storage, 'setItem'> | null
): void {
  try {
    const store = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    if (!store) return;
    store.setItem(
      OMNI_COMMAND_HISTORY_KEY,
      JSON.stringify(entries.slice(0, MAX_OMNI_COMMAND_HISTORY))
    );
  } catch {
    // Ignore restricted storage environments
  }
}

export function clearOmniCommandHistoryStorage(
  storage?: Pick<Storage, 'removeItem'> | null
): void {
  try {
    const store = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    if (!store) return;
    store.removeItem(OMNI_COMMAND_HISTORY_KEY);
  } catch {
    // Ignore storage errors
  }
}
