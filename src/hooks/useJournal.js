import { useCallback, useEffect, useState } from 'react';
import { loadJournal, clearJournal as clearJournalStorage } from '../utils/journalStorage.js';

const BINANCE_PRICE = 'https://api.binance.com/api/v3/ticker/price';

/**
 * Charge le journal des signaux depuis le stockage local, récupère les prix
 * actuels pour tous les symboles présents, et calcule le résultat théorique
 * (en %) de chaque signal depuis son émission — la vraie preuve en
 * conditions réelles, pas un backtest sur données passées.
 *
 * @param {number} pollMs
 */
export function useJournal(pollMs = 30000) {
  const [entries, setEntries] = useState([]);
  const [currentPrices, setCurrentPrices] = useState({});
  const [status, setStatus] = useState('idle');

  const refreshEntries = useCallback(() => {
    setEntries(loadJournal());
  }, []);

  const fetchPrices = useCallback(async (symbols) => {
    if (symbols.length === 0) return;
    try {
      setStatus('loading');
      const results = await Promise.allSettled(
        symbols.map(async (symbol) => {
          const res = await fetch(`${BINANCE_PRICE}?symbol=${symbol}`);
          if (!res.ok) throw new Error(`${symbol} indisponible`);
          const data = await res.json();
          return { symbol, price: parseFloat(data.price) };
        })
      );

      const prices = {};
      results.forEach((r) => {
        if (r.status === 'fulfilled') prices[r.value.symbol] = r.value.price;
      });

      setCurrentPrices((prev) => ({ ...prev, ...prices }));
      setStatus('ok');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    refreshEntries();
    const id = setInterval(refreshEntries, 5000); // détecte les nouvelles entrées ajoutées par les autres onglets/composants
    return () => clearInterval(id);
  }, [refreshEntries]);

  useEffect(() => {
    const symbols = [...new Set(entries.map((e) => e.symbol))];
    fetchPrices(symbols);
    const id = setInterval(() => fetchPrices(symbols), pollMs);
    return () => clearInterval(id);
  }, [entries, fetchPrices, pollMs]);

  const clear = useCallback(() => {
    setEntries(clearJournalStorage());
  }, []);

  const enriched = entries.map((entry) => {
    const currentPrice = currentPrices[entry.symbol];
    let changePct = null;
    if (currentPrice) {
      const rawChange = ((currentPrice - entry.entryPrice) / entry.entryPrice) * 100;
      // Pour un signal VENTE, on gagne quand le prix BAISSE — donc on inverse le signe.
      changePct = entry.direction === 'VENTE' ? -rawChange : rawChange;
    }
    return { ...entry, currentPrice, changePct };
  });

  return { entries: enriched, status, refresh: refreshEntries, clear };
}
