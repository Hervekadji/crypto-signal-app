// utils/journalStorage.js
// Persistance simple via localStorage — pas de serveur nécessaire. Le
// journal survit aux rechargements de page tant que tu restes sur le même
// navigateur/appareil (il est effacé si tu vides les données du site).

const STORAGE_KEY = 'signal-journal-v1';
const MAX_ENTRIES = 200;

export function loadJournal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveJournal(entries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Stockage plein ou indisponible (navigation privée) — on abandonne
    // silencieusement plutôt que de casser le flux principal de l'app.
  }
}

/**
 * Enregistre un nouveau signal dans le journal.
 * @param {{ symbol: string, strategy: string, direction: 'ACHAT'|'VENTE', entryPrice: number }} entry
 */
export function addJournalEntry(entry) {
  const entries = loadJournal();
  const newEntry = {
    id: `${Date.now()}-${entry.symbol}-${entry.strategy}`,
    ...entry,
    entryTime: Date.now()
  };
  const updated = [newEntry, ...entries].slice(0, MAX_ENTRIES);
  saveJournal(updated);
  return updated;
}

export function clearJournal() {
  saveJournal([]);
  return [];
}
