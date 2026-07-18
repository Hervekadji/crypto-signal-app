// utils/higherTimeframe.js
// Détermine la tendance sur un timeframe supérieur (SMA 9 vs SMA 21 uniquement,
// pas la confluence complète) pour servir de garde-fou : un signal ACHAT pris
// à contre-tendance du grand timeframe est bloqué, et inversement pour VENTE.

import { sma } from './indicators.js';

/** Associe chaque intervalle à un timeframe supérieur cohérent pour le filtre. */
export const HIGHER_TIMEFRAME_MAP = {
  '1m': '15m',
  '5m': '1h',
  '15m': '4h',
  '1h': '4h',
  '4h': '1d'
};

/**
 * @param {number[]} closes clôtures du timeframe SUPÉRIEUR
 * @returns {'haussier'|'baissier'|'neutre'|null}
 */
export function higherTimeframeTrend(closes) {
  const sma9 = sma(closes, 9);
  const sma21 = sma(closes, 21);
  if (sma9 === null || sma21 === null) return null;
  if (sma9 > sma21) return 'haussier';
  if (sma9 < sma21) return 'baissier';
  return 'neutre';
}

/**
 * Applique le filtre : un signal ACHAT est annulé (ramené à NEUTRE) si la
 * tendance du timeframe supérieur est baissière, et inversement pour VENTE.
 * Si la tendance supérieure est neutre ou inconnue, le signal passe tel quel.
 */
export function applyHigherTimeframeFilter(signal, higherTrend) {
  if (!higherTrend || higherTrend === 'neutre') return { signal, blocked: false };
  if (signal === 'ACHAT' && higherTrend === 'baissier') return { signal: 'NEUTRE', blocked: true };
  if (signal === 'VENTE' && higherTrend === 'haussier') return { signal: 'NEUTRE', blocked: true };
  return { signal, blocked: false };
}
