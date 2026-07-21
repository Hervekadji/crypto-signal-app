import { useCallback, useEffect, useRef, useState } from 'react';
import { computeDollarIndexChange, DOLLAR_BASKET_CURRENCIES } from '../utils/dollarIndex.js';

const FRANKFURTER = 'https://api.frankfurter.app';

function formatDate(d) {
  return d.toISOString().split('T')[0];
}

/**
 * Récupère les taux de change USD->panier (EUR, JPY, GBP, CAD, CHF) du jour
 * et de la veille (données ECB via Frankfurter, mises à jour ~16h CET les
 * jours ouvrés), calcule un indice dollar composite pondéré, et notifie sur
 * changement de direction (hausse/baisse) si activé.
 *
 * @param {number} pollMs
 * @param {boolean} notifsEnabled
 */
export function useDollarIndex(pollMs = 15 * 60 * 1000, notifsEnabled = false) {
  const [result, setResult] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState(null);
  const lastDirectionRef = useRef(null);
  const notifsEnabledRef = useRef(notifsEnabled);
  notifsEnabledRef.current = notifsEnabled;

  const fetchAndCompute = useCallback(async () => {
    try {
      setStatus('loading');

      const symbols = DOLLAR_BASKET_CURRENCIES.join(',');
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = formatDate(yesterday);

      const [todayRes, yesterdayRes] = await Promise.all([
        fetch(`${FRANKFURTER}/latest?from=USD&to=${symbols}`),
        fetch(`${FRANKFURTER}/${yesterdayStr}?from=USD&to=${symbols}`)
      ]);

      if (!todayRes.ok || !yesterdayRes.ok) throw new Error('Frankfurter API indisponible');

      const todayData = await todayRes.json();
      const yesterdayData = await yesterdayRes.json();

      const computed = computeDollarIndexChange(todayData.rates, yesterdayData.rates);

      setResult(computed);
      setStatus('ok');
      setErrorMessage(null);

      if (
        lastDirectionRef.current &&
        computed.direction !== lastDirectionRef.current &&
        computed.direction !== 'stable' &&
        notifsEnabledRef.current &&
        typeof window !== 'undefined' &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        new Notification(`Dollar en ${computed.direction}`, {
          body: `Variation composite : ${computed.compositeChangePct > 0 ? '+' : ''}${computed.compositeChangePct.toFixed(2)}%`,
          tag: 'dollar-index'
        });
      }

      if (computed.direction !== lastDirectionRef.current) {
        setAlerts((prev) =>
          [
            {
              id: `${Date.now()}-dxy`,
              direction: computed.direction,
              changePct: computed.compositeChangePct,
              time: new Date()
            },
            ...prev
          ].slice(0, 50)
        );
        lastDirectionRef.current = computed.direction;
      }
    } catch (err) {
      setStatus('error');
      setErrorMessage(err.message || 'Erreur réseau');
    }
  }, []);

  useEffect(() => {
    lastDirectionRef.current = null;
    fetchAndCompute();
    const id = setInterval(fetchAndCompute, pollMs);
    return () => clearInterval(id);
  }, [fetchAndCompute, pollMs]);

  return { result, alerts, status, errorMessage, refresh: fetchAndCompute };
}
