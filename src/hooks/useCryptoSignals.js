import { useEffect, useRef, useState, useCallback } from 'react';
import { computeSignal } from '../utils/indicators.js';

const BINANCE_KLINES = 'https://api.binance.com/api/v3/klines';

/**
 * Récupère les bougies pour une paire donnée, calcule le signal de
 * confluence, et journalise une alerte à chaque CHANGEMENT de signal
 * (pas à chaque poll, pour éviter le bruit).
 *
 * @param {string} symbol ex: "BTCUSDT"
 * @param {string} interval ex: "5m"
 * @param {number} pollMs intervalle de rafraîchissement en ms
 */
export function useCryptoSignals(symbol, interval = '5m', pollMs = 30000) {
  const [price, setPrice] = useState(null);
  const [result, setResult] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | loading | ok | error
  const [errorMessage, setErrorMessage] = useState(null);
  const lastSignalRef = useRef('NEUTRE');

  const fetchAndCompute = useCallback(async () => {
    try {
      setStatus('loading');
      const url = `${BINANCE_KLINES}?symbol=${symbol}&interval=${interval}&limit=150`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Binance a répondu ${res.status}`);
      const raw = await res.json();

      // Format kline Binance : [openTime, open, high, low, close, volume, ...]
      const closes = raw.map((k) => parseFloat(k[4]));
      const lastClose = closes[closes.length - 1];

      setPrice(lastClose);

      const signalResult = computeSignal(closes);
      setResult(signalResult);
      setStatus('ok');
      setErrorMessage(null);

      if (signalResult && signalResult.signal !== lastSignalRef.current) {
        // Un changement de signal réel : on journalise, y compris le retour à NEUTRE
        setAlerts((prev) => [
          {
            id: `${Date.now()}-${symbol}`,
            symbol,
            signal: signalResult.signal,
            price: lastClose,
            score: signalResult.score,
            time: new Date()
          },
          ...prev
        ].slice(0, 50));
        lastSignalRef.current = signalResult.signal;
      }
    } catch (err) {
      setStatus('error');
      setErrorMessage(err.message || 'Erreur réseau');
    }
  }, [symbol, interval]);

  useEffect(() => {
    lastSignalRef.current = 'NEUTRE';
    fetchAndCompute();
    const id = setInterval(fetchAndCompute, pollMs);
    return () => clearInterval(id);
  }, [fetchAndCompute, pollMs]);

  return { price, result, alerts, status, errorMessage, refresh: fetchAndCompute };
}
