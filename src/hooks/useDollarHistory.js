import { useEffect, useState } from 'react';
import { buildCompositeSeries, DOLLAR_BASKET_CURRENCIES } from '../utils/dollarIndex.js';

const CDN_BASE = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@';
const FALLBACK_BASE = 'https://';

function formatDate(d) {
  return d.toISOString().split('T')[0];
}

async function fetchRatesForDate(dateStr) {
  const primaryUrl = `${CDN_BASE}${dateStr}/v1/currencies/usd.json`;
  const fallbackUrl = `${FALLBACK_BASE}${dateStr}.currency-api.pages.dev/v1/currencies/usd.json`;

  let res;
  try {
    res = await fetch(primaryUrl);
    if (!res.ok) throw new Error('primary failed');
  } catch {
    res = await fetch(fallbackUrl);
  }
  if (!res.ok) return null;

  const data = await res.json();
  if (!data.usd) return null;

  const rates = {};
  for (const ccy of DOLLAR_BASKET_CURRENCIES) {
    rates[ccy] = data.usd[ccy.toLowerCase()];
  }
  return { date: dateStr, rates };
}

/**
 * Récupère l'indice dollar composite sur les `days` derniers jours, pour
 * afficher une courbe d'évolution plutôt qu'une seule lecture ponctuelle.
 * @param {number} days
 */
export function useDollarHistory(days = 21) {
  const [series, setSeries] = useState([]);
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setStatus('loading');
        const dates = Array.from({ length: days }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (days - 1 - i));
          return formatDate(d);
        });

        const results = await Promise.allSettled(dates.map(fetchRatesForDate));
        const valid = results
          .filter((r) => r.status === 'fulfilled' && r.value !== null)
          .map((r) => r.value);

        if (valid.length === 0) throw new Error('Aucune donnée historique disponible');

        const composite = buildCompositeSeries(valid);

        if (!cancelled) {
          setSeries(composite);
          setStatus('ok');
          setErrorMessage(null);
        }
      } catch (err) {
        if (!cancelled) {
          setStatus('error');
          setErrorMessage(err.message || 'Erreur réseau');
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [days]);

  return { series, status, errorMessage };
}
