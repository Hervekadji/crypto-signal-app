// utils/volumeClimax.js
//
// Stratégie de RETOURNEMENT (contrarian), pensée pour le scalping sur
// timeframes courts (1m/5m/15m). Logique différente de la confluence
// "tendance" de indicators.js : ici, un pic de volume anormal sur une
// bougie baissière proche d'un plus bas récent suggère un épuisement des
// vendeurs (capitulation) → signal ACHAT à contre-courant du mouvement.
// Symétriquement pour un signal VENTE en haut de range.

import { rsi } from './indicators.js';

/**
 * Version "pure" : Volume + RSI seuls, SANS la condition de position dans
 * le range (contrairement à computeVolumeClimaxSignal). Sert à mesurer
 * objectivement, par backtest, si Volume+RSI seuls suffisent ou si la
 * position dans le range apporte vraiment quelque chose.
 */
export function computeVolumeRsiOnlySignal(closes, volumes, options = {}) {
  const { lookback = 10, volumeMultiplier = 2, rsiOversold = 20, rsiOverbought = 75 } = options;

  if (closes.length < lookback + 15) return null;

  const n = closes.length - 1;
  const lastVolume = volumes[n];
  const recentVolumes = volumes.slice(n - lookback, n);
  const avgVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
  const isVolumeSpike = lastVolume > avgVolume * volumeMultiplier;

  const rsiValue = rsi(closes, 14);

  let signal = 'NEUTRE';
  let reason = null;

  if (isVolumeSpike && rsiValue !== null && rsiValue < rsiOversold) {
    signal = 'ACHAT';
    reason = 'Pic de volume + RSI survendu (sans filtre de position dans le range)';
  } else if (isVolumeSpike && rsiValue !== null && rsiValue > rsiOverbought) {
    signal = 'VENTE';
    reason = 'Pic de volume + RSI suracheté (sans filtre de position dans le range)';
  }

  return {
    signal,
    reason,
    details: { lastVolume, avgVolume, volumeRatio: avgVolume > 0 ? lastVolume / avgVolume : 0, isVolumeSpike, rsi: rsiValue }
  };
}

/**
 * Détection de retournement par pic de volume (volume climax) — stratégie scalping distincte de la confluence
 */
export function computeVolumeClimaxSignal(opens, closes, volumes, options = {}) {
  const { lookback = 10, volumeMultiplier = 2, rsiOversold = 25, rsiOverbought = 75 } = options;

  if (closes.length < lookback + 15) return null; // +15 pour laisser assez de marge au calcul du RSI

  const n = closes.length - 1;
  const lastOpen = opens[n];
  const lastClose = closes[n];
  const lastVolume = volumes[n];

  const recentCloses = closes.slice(n - lookback, n); // exclut la bougie courante
  const recentVolumes = volumes.slice(n - lookback, n);

  const localLow = Math.min(...recentCloses);
  const localHigh = Math.max(...recentCloses);
  const avgVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;

  const isBearishCandle = lastClose < lastOpen;
  const isBullishCandle = lastClose > lastOpen;
  const isVolumeSpike = lastVolume > avgVolume * volumeMultiplier;
  const isNearLow = lastClose <= localLow * 1.001;
  const isNearHigh = lastClose >= localHigh * 0.999;

  const rsiValue = rsi(closes, 14);

  let signal = 'NEUTRE';
  let reason = null;

  if (isVolumeSpike && isBearishCandle && isNearLow && rsiValue !== null && rsiValue < rsiOversold) {
    signal = 'ACHAT';
    reason = 'Pic de volume sur bougie baissière en zone de bas de range + RSI survendu';
  } else if (isVolumeSpike && isBullishCandle && isNearHigh && rsiValue !== null && rsiValue > rsiOverbought) {
    signal = 'VENTE';
    reason = 'Pic de volume sur bougie haussière en zone de haut de range + RSI suracheté';
  }

  return {
    signal,
    reason,
    details: {
      lastVolume,
      avgVolume,
      volumeRatio: avgVolume > 0 ? lastVolume / avgVolume : 0,
      isVolumeSpike,
      isBearishCandle,
      isBullishCandle,
      isNearLow,
      isNearHigh,
      rsi: rsiValue,
      localLow,
      localHigh
    }
  };
}
