import { useCallback, useEffect, useRef, useState } from 'react';
import { computeDollarIndexChange, DOLLAR_BASKET_CURRENCIES } from '../utils/dollarIndex.js';
import { showNotification } from '../utils/notify.js';

// Servi via jsDelivr, un CDN public conçu pour être appelé directement
// depuis un navigateur (CORS ouvert par nature) — plus fiable que les API
// "classiques" qui peuvent bloquer les requêtes cross-origin.
const CURRENCY_API = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json';
// Miroir de secours si jsDelivr est indisponible dans certaines régions.
const CURRENCY_API_FALLBACK = 'https://latest.currency-api.pages.dev/v1/currencies/usd.json';

/**
 * Récupère les taux USD->panier ACTUELS (une seule requête) et compare
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

  const fetchRates = useCallback(async () => {
    let res;
    try {
      res = await fetch(CURRENCY_API);
      if (!res.ok) throw new Error('primary failed');
    } catch {
      res = await fetch(CURRENCY_API_FALLBACK);
    }
    if (!res.ok) throw new Error(`Source de données indisponible (${res.status})`);
    const data = await res.json();
    if (!data.usd) throw new Error('Réponse inattendue');

    // Les codes devises reviennent en minuscules dans cette API.
    const rates = {};
    for (const ccy of DOLLAR_BASKET_CURRENCIES) {
      rates[ccy] = data.usd[ccy.toLowerCase()];
    }
    return rates;
  }, []);

  const fetchAndCompute = useCallback(async () => {
    try {
      setStatus('loading');
      const rates = await fetchRates();

      if (!previousRatesRef.current) {
        previousRatesRef.current = rates;
        setResult({ compositeChangePct: 0, byCurrency: {}, direction: 'stable', rates });
        setStatus('ok');
        setErrorMessage(null);
        return;
      }

      const computed = computeDollarIndexChange(rates, previousRatesRef.current);
      setResult({ ...computed, rates });
      setStatus('ok');
      setErrorMessage(null);

      if (
        lastDirectionRef.current &&
        computed.direction !== lastDirectionRef.current &&
        computed.direction !== 'stable' &&
        notifsEnabledRef.current
      ) {
        showNotification(`Dollar en ${computed.direction}`, {
          body: `Variation composite : ${computed.compositeChangePct > 0 ? '+' : ''}${computed.compositeChangePct.toFixed(3)}%`,
          tag: 'dollar-index'
        });
      }

      if (computed.direction !== lastDirectionRef.current) {
        setAlerts((prev) =>
          [
            { id: `${Date.now()}-dxy`, direction: computed.direction, changePct: computed.compositeChangePct, time: new Date() },
            ...prev
          ].slice(0, 50)
        );
        lastDirectionRef.current = computed.direction;
      }

      previousRatesRef.current = rates;
    } catch (err) {
      setStatus('error');
      setErrorMessage(err.message || 'Erreur réseau');
    }
  }, [fetchRates]);

  useEffect(() => {
    previousRatesRef.current = null;
    lastDirectionRef.current = null;
    fetchAndCompute();
    const id = setInterval(fetchAndCompute, pollMs);
    return () => clearInterval(id);
  }, [fetchAndCompute, pollMs]);

  return { result, alerts, status, errorMessage, refresh: fetchAndCompute };
}
