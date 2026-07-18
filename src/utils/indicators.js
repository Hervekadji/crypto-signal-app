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
 * Points pivots classiques (floor pivots), calculés sur la fenêtre PRÉCÉDENTE
 * de `period` bougies (pas la bougie en cours, pour ne pas se regarder soi-même).
 * PP = (H+L+C)/3 — une clôture au-dessus du pivot est lue comme un biais acheteur
 * contrôlé par les vendeurs. C'est mécanique : aucun choix de swing à faire.
 */
export function pivotPoint(highs, lows, closes, period = 20) {
  if (closes.length < period + 1) return null;
  const priorHighs = highs.slice(closes.length - period - 1, closes.length - 1);
  const priorLows = lows.slice(closes.length - period - 1, closes.length - 1);
  const priorClose = closes[closes.length - 2];

  const h = Math.max(...priorHighs);
  const l = Math.min(...priorLows);
  const pp = (h + l + priorClose) / 3;
  const r1 = 2 * pp - l;
  const s1 = 2 * pp - h;

  return { pp, r1, s1 };
}

/**
 * Confirmation par le volume : une bougie haussière/baissière n'est prise au
 * sérieux que si son volume dépasse nettement la moyenne des `period`
 * bougies précédentes (hors bougie courante, pour éviter le biais de recul).
 */
export function volumeConfirmation(closes, volumes, period = 20) {
  if (closes.length < period + 1 || volumes.length < period + 1) return null;
  const priorVolumes = volumes.slice(volumes.length - period - 1, volumes.length - 1);
  const avgVolume = priorVolumes.reduce((a, b) => a + b, 0) / priorVolumes.length;
  const lastVolume = volumes[volumes.length - 1];
  const priceChange = closes[closes.length - 1] - closes[closes.length - 2];

  const isSurge = lastVolume > avgVolume * 1.3;

  return { avgVolume, lastVolume, isSurge, priceChange, ratio: lastVolume / avgVolume };
}

/**
 * Logique de confluence multi-indicateurs (5 votes).
 * Chaque indicateur "vote" haussier (+1), baissier (-1) ou neutre (0).
 * Un signal ACHAT/VENTE n'est déclenché qu'à partir d'un score |score| >= 3
 * sur 5, pour éviter les faux signaux d'une minorité d'indicateurs.
 */
export function computeSignal(closes, volumes = null, highs = null, lows = null) {
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

  let volumeInfo = null;
  if (volumes) {
    volumeInfo = volumeConfirmation(closes, volumes);
    if (volumeInfo) {
      if (volumeInfo.isSurge && volumeInfo.priceChange > 0) {
        score += 1;
        votes.volume = 'volume fort (haussier)';
      } else if (volumeInfo.isSurge && volumeInfo.priceChange < 0) {
        score -= 1;
        votes.volume = 'volume fort (baissier)';
      } else {
        votes.volume = 'neutre';
      }
    }
  }

  let pivotInfo = null;
  if (highs && lows) {
    pivotInfo = pivotPoint(highs, lows, closes);
    if (pivotInfo) {
      const lastClose = closes[closes.length - 1];
      if (lastClose > pivotInfo.pp) {
        score += 1;
        votes.pivot = 'au-dessus du pivot (haussier)';
      } else if (lastClose < pivotInfo.pp) {
        score -= 1;
        votes.pivot = 'en dessous du pivot (baissier)';
      } else {
        votes.pivot = 'neutre';
      }
    }
  }

  const totalVotes = 3 + (volumeInfo ? 1 : 0) + (pivotInfo ? 1 : 0);
  const threshold = totalVotes >= 5 ? 3 : 2;

  let signal = 'NEUTRE';
  if (score >= threshold) signal = 'ACHAT';
  else if (score <= -threshold) signal = 'VENTE';

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
      histogram: macdValue.histogram,
      volume: volumeInfo,
      pivot: pivotInfo
    }
  };
}
