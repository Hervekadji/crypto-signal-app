import { useCallback, useEffect, useState } from 'react';

const BINANCE_KLINES = 'https://api.binance.com/api/v3/klines';

/**
 * Récupère les N dernières bougies OHLC pour un symbole/intervalle donné,
 * avec rafraîchissement périodique — pour l'affichage en chandelier japonais.
 *
 * @param {string} symbol
 * @param {string} interval
 * @param {number} limit nombre de bougies à afficher
 * @param {number} pollMs
 */
export function useCandleSeries(symbol, interval = '5m', limit = 60, pollMs = 30000) {
  const [candles, setCandles] = useState([]);
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState(null);

  const fetchCandles = useCallback(async () => {
    try {
      setStatus('loading');
      const url = `${BINANCE_KLINES}?symbol=${symbol}&interval=${interval}&limit=${limit}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Binance a répondu ${res.status}`);
      const raw = await res.json();

      const mapped = raw.map((k) => ({
        time: k[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5])
      }));

      setCandles(mapped);
      setStatus('ok');
      setErrorMessage(null);
    } catch (err) {
      setStatus('error');
      setErrorMessage(err.message || 'Erreur réseau');
    }
  }, [symbol, interval, limit]);

  useEffect(() => {
    fetchCandles();
    const id = setInterval(fetchCandles, pollMs);
    return () => clearInterval(id);
  }, [fetchCandles, pollMs]);

  return { candles, status, errorMessage, refresh: fetchCandles };
}
