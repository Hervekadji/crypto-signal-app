// utils/backtest.js
// Moteur de simulation générique : rejoue N'IMPORTE QUELLE fonction de
// signal sur un historique de prix, simule les trades qui en auraient
// résulté, et calcule des statistiques réelles de performance.
// Utilisé à la fois par la stratégie de confluence (tendance) et par la
// stratégie de retournement par volume (scalping).
// Supporte un stop-loss optionnel, vérifié bougie par bougie via les plus
// hauts/plus bas réels (pas seulement les clôtures) — pour refléter ce
// qu'un vrai stop-loss aurait déclenché intra-bougie.

import { computeSignal } from './indicators.js';
import { computeVolumeClimaxSignal } from './volumeClimax.js';

const CONFLUENCE_WARMUP = 35; // nb de bougies nécessaires avant que MACD/SMA21 soient calculables
const CLIMAX_WARMUP = 30;

/**
 * @param {number[]} times
 * @param {number[]} closes
 * @param {(i:number) => {signal:string}|null} computeSignalAt
 * @param {number} warmup
 * @param {object} [options]
 * @param {number[]} [options.highs] nécessaire si stopLossPct est défini
 * @param {number[]} [options.lows] nécessaire si stopLossPct est défini
 * @param {number} [options.stopLossPct] ex: 2 pour un stop à -2% du prix d'entrée
 */
function simulateStrategy(times, closes, computeSignalAt, warmup, options = {}) {
  const { highs = null, lows = null, stopLossPct = null } = options;

  if (closes.length < warmup + 10) {
    return { trades: [], equityCurve: [], stats: null, error: 'Pas assez de données pour ce backtest.' };
  }

  const trades = [];
  let position = null;
  let lastSignal = 'NEUTRE';

  for (let i = warmup; i < closes.length; i++) {
    const time = times[i];

    // 1) Vérifier d'abord si le stop-loss est touché sur cette bougie,
    //    AVANT de recalculer le signal — un stop est une sortie de risque,
    //    pas une décision stratégique.
    if (position && stopLossPct && highs && lows) {
      const stopPrice =
        position.direction === 'ACHAT'
          ? position.entryPrice * (1 - stopLossPct / 100)
          : position.entryPrice * (1 + stopLossPct / 100);

      const hitStop =
        position.direction === 'ACHAT' ? lows[i] <= stopPrice : highs[i] >= stopPrice;

      if (hitStop) {
        trades.push(closeTrade(position, stopPrice, time, 'stop-loss'));
        position = null;
        lastSignal = 'NEUTRE'; // on se remet en état neutre, prêt à réagir au prochain vrai signal
        continue; // on ne rouvre pas de position sur la même bougie que le stop
      }
    }

    const result = computeSignalAt(i);
    if (!result) continue;

    const { signal } = result;
    const price = closes[i];

    if (signal === 'ACHAT' && signal !== lastSignal) {
      if (position && position.direction === 'VENTE') {
        trades.push(closeTrade(position, price, time, 'signal'));
        position = null;
      }
      if (!position) {
        position = { direction: 'ACHAT', entryPrice: price, entryTime: time };
      }
    }

    if (signal === 'VENTE' && signal !== lastSignal) {
      if (position && position.direction === 'ACHAT') {
        trades.push(closeTrade(position, price, time, 'signal'));
        position = null;
      }
    }

    lastSignal = signal;
  }

  if (position) {
    trades.push(closeTrade(position, closes[closes.length - 1], times[times.length - 1], 'fin-periode'));
  }

  const equityCurve = buildEquityCurve(trades, times[warmup]);
  const stats = computeStats(trades, equityCurve);

  return { trades, equityCurve, stats };
}

/**
 * Backtest de la stratégie de confluence (tendance) : SMA/RSI/MACD, avec
 * Volume et Pivots optionnels (activés par défaut, désactivables pour
 * comparer directement les deux versions — utile car Volume/Pivots sont
 * des indicateurs plus réactifs qui peuvent générer plus de faux signaux
 * sur de grands timeframes comme 1 jour).
 * @param {number[]} closes
 * @param {number[]} times
 * @param {number[]} [volumes]
 * @param {number[]} [highs]
 * @param {number[]} [lows]
 * @param {number} [stopLossPct] optionnel, ex: 2 pour -2%
 * @param {boolean} [useExtendedVotes=true] si false, ignore Volume/Pivots (3 votes seulement)
 */
export function runBacktest(closes, times, volumes = null, highs = null, lows = null, stopLossPct = null, useExtendedVotes = true) {
  const effectiveVolumes = useExtendedVotes ? volumes : null;
  const effectiveHighs = useExtendedVotes ? highs : null;
  const effectiveLows = useExtendedVotes ? lows : null;

  return simulateStrategy(
    times,
    closes,
    (i) => {
      const windowCloses = closes.slice(0, i + 1);
      const windowVolumes = effectiveVolumes ? effectiveVolumes.slice(0, i + 1) : null;
      const windowHighs = effectiveHighs ? effectiveHighs.slice(0, i + 1) : null;
      const windowLows = effectiveLows ? effectiveLows.slice(0, i + 1) : null;
      return computeSignal(windowCloses, windowVolumes, windowHighs, windowLows);
    },
    CONFLUENCE_WARMUP,
    { highs, lows, stopLossPct }
  );
}

/**
 * Backtest de la stratégie de retournement par pic de volume (scalping).
 * @param {number[]} opens
 * @param {number[]} closes
 * @param {number[]} times
 * @param {number[]} volumes
 * @param {number[]} [highs]
 * @param {number[]} [lows]
 * @param {number} [stopLossPct]
 */
export function runVolumeClimaxBacktest(opens, closes, times, volumes, highs = null, lows = null, stopLossPct = null) {
  return simulateStrategy(
    times,
    closes,
    (i) => {
      const windowOpens = opens.slice(0, i + 1);
      const windowCloses = closes.slice(0, i + 1);
      const windowVolumes = volumes.slice(0, i + 1);
      return computeVolumeClimaxSignal(windowOpens, windowCloses, windowVolumes);
    },
    CLIMAX_WARMUP,
    { highs, lows, stopLossPct }
  );
}

/**
 * Convertit un timestamp UTC en heure locale de Yaoundé (UTC+1, sans heure d'été).
 */
function yaoundeHour(timestampMs) {
  return (new Date(timestampMs).getUTCHours() + 1) % 24;
}

/**
 * Backtest de la check-list de trading : retournement par volume, avec
 * confirmation sur plusieurs bougies consécutives et filtre horaire Yaoundé.
 * @param {number[]} opens
 * @param {number[]} closes
 * @param {number[]} times
 * @param {number[]} volumes
 * @param {object} [options]
 * @param {number} [options.rsiOversold=20]
 * @param {number} [options.rsiOverbought=75]
 * @param {number} [options.confirmationCandles=3]
 * @param {boolean} [options.useTimeFilter=true] limite les entrées à 8h-22h Yaoundé
 * @param {number[]} [options.highs]
 * @param {number[]} [options.lows]
 * @param {number} [options.stopLossPct]
 */
export function runChecklistBacktest(opens, closes, times, volumes, options = {}) {
  const {
    rsiOversold = 20,
    rsiOverbought = 75,
    confirmationCandles = 3,
    useTimeFilter = true,
    highs = null,
    lows = null,
    stopLossPct = null
  } = options;

  return simulateStrategy(
    times,
    closes,
    (i) => {
      if (useTimeFilter) {
        const hour = yaoundeHour(times[i]);
        if (hour < 8 || hour >= 22) return { signal: 'NEUTRE' };
      }

      if (i - confirmationCandles + 1 < CLIMAX_WARMUP) return { signal: 'NEUTRE' };

      let confirmedDirection = null;
      for (let k = i - confirmationCandles + 1; k <= i; k++) {
        const raw = computeVolumeClimaxSignal(
          opens.slice(0, k + 1),
          closes.slice(0, k + 1),
          volumes.slice(0, k + 1),
          { rsiOversold, rsiOverbought }
        );
        if (!raw || raw.signal === 'NEUTRE') return { signal: 'NEUTRE' };
        if (confirmedDirection === null) confirmedDirection = raw.signal;
        else if (raw.signal !== confirmedDirection) return { signal: 'NEUTRE' };
      }

      return { signal: confirmedDirection };
    },
    CLIMAX_WARMUP + confirmationCandles,
    { highs, lows, stopLossPct }
  );
}
function closeTrade(position, exitPrice, exitTime, reason = 'signal') {
  const returnPct = ((exitPrice - position.entryPrice) / position.entryPrice) * 100;
  return {
    direction: position.direction,
    entryTime: position.entryTime,
    entryPrice: position.entryPrice,
    exitTime,
    exitPrice,
    returnPct,
    reason
  };
}

function buildEquityCurve(trades, startTime) {
  let equity = 100;
  const curve = [{ time: startTime, equity }];
  for (const t of trades) {
    equity = equity * (1 + t.returnPct / 100);
    curve.push({ time: t.exitTime, equity });
  }
  return curve;
}

function computeStats(trades, equityCurve) {
  if (trades.length === 0) {
    return {
      totalTrades: 0,
      winRate: 0,
      avgReturnPct: 0,
      avgWinPct: 0,
      avgLossPct: 0,
      maxDrawdownPct: 0,
      finalReturnPct: 0,
      stoppedOutCount: 0
    };
  }

  const wins = trades.filter((t) => t.returnPct > 0);
  const losses = trades.filter((t) => t.returnPct <= 0);
  const stoppedOutCount = trades.filter((t) => t.reason === 'stop-loss').length;

  const avgReturnPct = trades.reduce((a, t) => a + t.returnPct, 0) / trades.length;
  const avgWinPct = wins.length ? wins.reduce((a, t) => a + t.returnPct, 0) / wins.length : 0;
  const avgLossPct = losses.length ? losses.reduce((a, t) => a + t.returnPct, 0) / losses.length : 0;

  let peak = equityCurve[0].equity;
  let maxDrawdownPct = 0;
  for (const point of equityCurve) {
    if (point.equity > peak) peak = point.equity;
    const drawdown = ((peak - point.equity) / peak) * 100;
    if (drawdown > maxDrawdownPct) maxDrawdownPct = drawdown;
  }

  const finalEquity = equityCurve[equityCurve.length - 1].equity;
  const finalReturnPct = finalEquity - 100;

  return {
    totalTrades: trades.length,
    winRate: (wins.length / trades.length) * 100,
    avgReturnPct,
    avgWinPct,
    avgLossPct,
    maxDrawdownPct,
    finalReturnPct,
    stoppedOutCount
  };
}
