// utils/binanceHistory.js
// Binance limite chaque requête à 1000 bougies. Pour couvrir plus
// d'historique sur les petits timeframes (1m/5m/15m), on enchaîne
// plusieurs requêtes en remontant dans le temps via `endTime`, puis on
// fusionne le tout dans l'ordre chronologique.

const BINANCE_KLINES = 'https://api.binance.com/api/v3/klines';

/**
 * @param {string} symbol ex: "BTCUSDT"
 * @param {string} interval ex: "1m"
 * @param {number} requests nombre de requêtes de 1000 bougies à enchaîner
 * @returns {Promise<Array>} tableau de klines brutes Binance, triées du plus ancien au plus récent
 */
export async function fetchHistoricalKlines(symbol, interval, requests = 1) {
  let endTime = undefined;
  const batches = [];

  for (let i = 0; i < requests; i++) {
    const url =
      `${BINANCE_KLINES}?symbol=${symbol}&interval=${interval}&limit=1000` +
      (endTime ? `&endTime=${endTime}` : '');
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Binance a répondu ${res.status}`);
    const batch = await res.json();

    if (batch.length === 0) break; // plus de données disponibles avant cette date

    batches.unshift(batch);
    endTime = batch[0][0] - 1; // requête suivante : juste avant la première bougie reçue
  }

  return batches.flat();
}
