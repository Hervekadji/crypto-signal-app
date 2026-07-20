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
 * @param {number[]} opens
 * @param {number[]} closes
 * @param {number[]} volumes
 * @param {object} [options]
 * @param {number} [options.lookback=10] nombre de bougies pour définir le range local et le volume moyen
 * @param {number} [options.volumeMultiplier=2] seuil de pic de volume (x fois la moyenne)
 * @param {number} [options.rsiOversold=25]
 * @param {number} [options.rsiOverbought=75]
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
