// utils/indicators.js
// Fonctions pures de calcul d'indicateurs techniques à partir d'un tableau
// de prix de clôture (closes), du plus ancien au plus récent.

/** Moyenne mobile simple sur les `period` dernières valeurs. */
export function sma(closes, period) {
  if (closes.length < period) return null;
  const slice = closes.slice(closes.length - period);
  const sum = slice.reduce((a, b) => a + b, 0);
  return sum / period;
}

/** Moyenne mobile exponentielle complète (retourne un tableau aligné sur closes). */
export function emaSeries(closes, period) {
  if (closes.length < period) return [];
  const k = 2 / (period + 1);
  const out = [];
  let prevEma = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = prevEma;
  for (let i = period; i < closes.length; i++) {
    const value = closes[i] * k + prevEma * (1 - k);
    out[i] = value;
    prevEma = value;
  }
  return out;
}

/** RSI (Relative Strength Index) sur `period` périodes (14 par défaut). */
export function rsi(closes, period = 14) {
  if (closes.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/** MACD (12,26,9) : renvoie { macd, signal, histogram } sur la dernière bougie. */
export function macd(closes, fast = 12, slow = 26, signalPeriod = 9) {
  if (closes.length < slow + signalPeriod) return null;

  const emaFast = emaSeries(closes, fast);
  const emaSlow = emaSeries(closes, slow);

  const macdLine = [];
  for (let i = 0; i < closes.length; i++) {
    if (emaFast[i] !== undefined && emaSlow[i] !== undefined) {
      macdLine[i] = emaFast[i] - emaSlow[i];
    }
  }

  const macdValues = macdLine.filter((v) => v !== undefined);
  if (macdValues.length < signalPeriod) return null;

  const signalSeries = emaSeries(macdValues, signalPeriod);
  const lastMacd = macdValues[macdValues.length - 1];
  const lastSignal = signalSeries[signalSeries.length - 1];

  if (lastSignal === undefined) return null;

  return {
    macd: lastMacd,
    signal: lastSignal,
    histogram: lastMacd - lastSignal
  };
}

/**
 * Logique de confluence multi-indicateurs.
 * Chaque indicateur "vote" haussier (+1), baissier (-1) ou neutre (0).
 * Un signal ACHAT/VENTE n'est déclenché qu'à partir d'un score |score| >= 2,
 * pour éviter les faux signaux d'un seul indicateur isolé.
 */
export function computeSignal(closes) {
  const sma9 = sma(closes, 9);
  const sma21 = sma(closes, 21);
  const rsiValue = rsi(closes, 14);
  const macdValue = macd(closes);

  if (sma9 === null || sma21 === null || rsiValue === null || macdValue === null) {
    return null;
  }

  let score = 0;
  const votes = {};

  // Croisement de moyennes mobiles
  if (sma9 > sma21) {
    score += 1;
    votes.sma = 'haussier';
  } else if (sma9 < sma21) {
    score -= 1;
    votes.sma = 'baissier';
  } else {
    votes.sma = 'neutre';
  }

  // RSI : zones de surachat / survente
  if (rsiValue < 30) {
    score += 1;
    votes.rsi = 'survente (haussier)';
  } else if (rsiValue > 70) {
    score -= 1;
    votes.rsi = 'surachat (baissier)';
  } else {
    votes.rsi = 'neutre';
  }

  // MACD : ligne MACD vs ligne de signal
  if (macdValue.histogram > 0) {
    score += 1;
    votes.macd = 'haussier';
  } else if (macdValue.histogram < 0) {
    score -= 1;
    votes.macd = 'baissier';
  } else {
    votes.macd = 'neutre';
  }

  let signal = 'NEUTRE';
  if (score >= 2) signal = 'ACHAT';
  else if (score <= -2) signal = 'VENTE';

  return {
    signal,
    score,
    votes,
    details: {
      sma9,
      sma21,
      rsi: rsiValue,
      macd: macdValue.macd,
      macdSignal: macdValue.signal,
      histogram: macdValue.histogram
    }
  };
}
