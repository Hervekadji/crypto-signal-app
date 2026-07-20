import { useEffect, useRef, useState, useCallback } from 'react';
import { computeVolumeClimaxSignal } from '../utils/volumeClimax.js';

const BINANCE_KLINES = 'https://api.binance.com/api/v3/klines';

/**
 * Même logique de polling que useCryptoSignals, mais pour la stratégie de
 * retournement par pic de volume (scalping), pensée pour les timeframes
 * courts (1m/5m/15m).
 *
 * @param {string} symbol
 * @param {string} interval
 * @param {number} pollMs
 * @param {boolean} notifsEnabled
 */
export function useVolumeClimax(symbol, interval = '5m', pollMs = 20000, notifsEnabled = false) {
  const [price, setPrice] = useState(null);
  const [result, setResult] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState(null);
  const lastSignalRef = useRef('NEUTRE');
  const notifsEnabledRef = useRef(notifsEnabled);
  notifsEnabledRef.current = notifsEnabled;

  const fetchAndCompute = useCallback(async () => {
    try {
      setStatus('loading');
      const url = `${BINANCE_KLINES}?symbol=${symbol}&interval=${interval}&limit=100`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Binance a répondu ${res.status}`);
      const raw = await res.json();

      // Format kline Binance : [openTime, open, high, low, close, volume, ...]
      const opens = raw.map((k) => parseFloat(k[1]));
      const closes = raw.map((k) => parseFloat(k[4]));
      const volumes = raw.map((k) => parseFloat(k[5]));
      const lastClose = closes[closes.length - 1];

      setPrice(lastClose);

      const signalResult = computeVolumeClimaxSignal(opens, closes, volumes);
      setResult(signalResult);
      setStatus('ok');
      setErrorMessage(null);

      if (signalResult && signalResult.signal !== lastSignalRef.current) {
        setAlerts((prev) => [
          {
            id: `${Date.now()}-${symbol}`,
            symbol,
            signal: signalResult.signal,
            price: lastClose,
            reason: signalResult.reason,
            time: new Date()
          },
          ...prev
        ].slice(0, 50));

        if (
          notifsEnabledRef.current &&
          signalResult.signal !== 'NEUTRE' &&
          typeof window !== 'undefined' &&
          'Notification' in window &&
          Notification.permission === 'granted'
        ) {
          new Notification(`Retournement — ${signalResult.signal} ${symbol}`, {
            body: signalResult.reason || '',
            tag: `climax-${symbol}`
          });
        }

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
