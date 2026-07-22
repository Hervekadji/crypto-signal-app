import { useEffect, useRef, useState, useCallback } from 'react';
import { computeSignal } from '../utils/indicators.js';
import { HIGHER_TIMEFRAME_MAP, higherTimeframeTrend, applyHigherTimeframeFilter } from '../utils/higherTimeframe.js';
import { showNotification } from '../utils/notify.js';

const BINANCE_KLINES = 'https://api.binance.com/api/v3/klines';

/**
 * Récupère les bougies pour une paire donnée, calcule le signal de
 * confluence à 5 votes (SMA, RSI, MACD, Volume, Pivots), applique le filtre
 * de tendance du timeframe supérieur, et journalise une alerte à chaque
 * CHANGEMENT de signal (pas à chaque poll, pour éviter le bruit).
 *
 * @param {string} symbol ex: "BTCUSDT"
 * @param {string} interval ex: "5m"
 * @param {number} pollMs intervalle de rafraîchissement en ms
 * @param {boolean} notifsEnabled si true, déclenche une notification navigateur
 *   à chaque nouveau signal ACHAT/VENTE (pas sur un retour à NEUTRE)
 */
export function useCryptoSignals(symbol, interval = '5m', pollMs = 30000, notifsEnabled = false) {
  const [price, setPrice] = useState(null);
  const [result, setResult] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | loading | ok | error
  const [errorMessage, setErrorMessage] = useState(null);
  const lastSignalRef = useRef('NEUTRE');
  const notifsEnabledRef = useRef(notifsEnabled);
  notifsEnabledRef.current = notifsEnabled;

  const fetchAndCompute = useCallback(async () => {
    try {
      setStatus('loading');

      const higherInterval = HIGHER_TIMEFRAME_MAP[interval] || interval;

      // Deux requêtes en parallèle : le timeframe courant (signal complet) et
      // le timeframe supérieur (juste pour le filtre de tendance).
      const [res, higherRes] = await Promise.all([
        fetch(`${BINANCE_KLINES}?symbol=${symbol}&interval=${interval}&limit=150`),
        fetch(`${BINANCE_KLINES}?symbol=${symbol}&interval=${higherInterval}&limit=50`)
      ]);
      if (!res.ok) throw new Error(`Binance a répondu ${res.status}`);
      const raw = await res.json();

      // Format kline Binance : [openTime, open, high, low, close, volume, ...]
      const closes = raw.map((k) => parseFloat(k[4]));
      const highs = raw.map((k) => parseFloat(k[2]));
      const lows = raw.map((k) => parseFloat(k[3]));
      const volumes = raw.map((k) => parseFloat(k[5]));
      const lastClose = closes[closes.length - 1];

      setPrice(lastClose);

      let higherTrend = null;
      if (higherRes.ok) {
        const higherRaw = await higherRes.json();
        const higherCloses = higherRaw.map((k) => parseFloat(k[4]));
        higherTrend = higherTimeframeTrend(higherCloses);
      }

      const rawSignalResult = computeSignal(closes, volumes, highs, lows);
      let signalResult = rawSignalResult;

      if (rawSignalResult) {
        const filtered = applyHigherTimeframeFilter(rawSignalResult.signal, higherTrend);
        signalResult = {
          ...rawSignalResult,
          signal: filtered.signal,
          blockedByHigherTimeframe: filtered.blocked,
          rawSignal: rawSignalResult.signal,
          higherTimeframe: higherInterval,
          higherTrend
        };
      }

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

        // Notification navigateur, seulement pour un vrai signal ACHAT/VENTE
        // (pas pour le retour à NEUTRE, pour ne pas spammer)
        if (notifsEnabledRef.current && signalResult.signal !== 'NEUTRE') {
          showNotification(`${signalResult.signal} — ${symbol}`, {
            body: `Prix : ${lastClose.toLocaleString('fr-FR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })} USDT · score ${signalResult.score}`,
            tag: symbol
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
