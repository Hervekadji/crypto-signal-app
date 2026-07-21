import { useCallback, useEffect, useRef, useState } from 'react';
import { computeDollarIndexChange, DOLLAR_BASKET_CURRENCIES } from '../utils/dollarIndex.js';

const FRANKFURTER = 'https://api.frankfurter.app';

/**
 * Récupère uniquement les taux USD->panier ACTUELS (une seule requête, pas
 * de date historique — plus robuste, moins de surface d'échec) et compare
 * chaque nouvelle lecture à la précédente pour déterminer la direction.
 * La toute première lecture sert de référence, sans direction affichée
 * tant qu'on n'a pas un deuxième point de comparaison.
 *
 * @param {number} pollMs
 * @param {boolean} notifsEnabled
 */
export function useDollarIndex(pollMs = 15 * 60 * 1000, notifsEnabled = false) {
  const [result, setResult] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState(null);
  const previousRatesRef = useRef(null);
  const lastDirectionRef = useRef(null);
  const notifsEnabledRef = useRef(notifsEnabled);
  notifsEnabledRef.current = notifsEnabled;

  const fetchAndCompute = useCallback(async () => {
    try {
      setStatus('loading');

      const symbols = DOLLAR_BASKET_CURRENCIES.join(',');
      const res = await fetch(`${FRANKFURTER}/latest?from=USD&to=${symbols}`);
      if (!res.ok) throw new Error(`Frankfurter a répondu ${res.status}`);
      const data = await res.json();

      if (!data.rates) throw new Error('Réponse inattendue de Frankfurter');

      if (!previousRatesRef.current) {
        // Première lecture : on la garde comme référence, pas encore de direction.
        previousRatesRef.current = data.rates;
        setResult({ compositeChangePct: 0, byCurrency: {}, direction: 'stable', rates: data.rates });
        setStatus('ok');
        setErrorMessage(null);
        return;
      }

      const computed = computeDollarIndexChange(data.rates, previousRatesRef.current);
      setResult({ ...computed, rates: data.rates });
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
          body: `Variation composite : ${computed.compositeChangePct > 0 ? '+' : ''}${computed.compositeChangePct.toFixed(3)}%`,
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

      // On garde toujours la lecture la plus récente comme prochaine référence.
      previousRatesRef.current = data.rates;
    } catch (err) {
      setStatus('error');
      setErrorMessage(err.message || 'Erreur réseau');
    }
  }, []);

  useEffect(() => {
    previousRatesRef.current = null;
    lastDirectionRef.current = null;
    fetchAndCompute();
    const id = setInterval(fetchAndCompute, pollMs);
    return () => clearInterval(id);
  }, [fetchAndCompute, pollMs]);

  return { result, alerts, status, errorMessage, refresh: fetchAndCompute };
}
