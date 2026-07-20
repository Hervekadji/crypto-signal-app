// utils/backtest.js
// Moteur de simulation générique : rejoue N'IMPORTE QUELLE fonction de
// signal sur un historique de prix, simule les trades qui en auraient
// résulté, et calcule des statistiques réelles de performance.
// Utilisé à la fois par la stratégie de confluence (tendance) et par la
// stratégie de retournement par volume (scalping).

import { computeSignal } from './indicators.js';
import { computeVolumeClimaxSignal } from './volumeClimax.js';

const CONFLUENCE_WARMUP = 35; // nb de bougies nécessaires avant que MACD/SMA21 soient calculables
const CLIMAX_WARMUP = 30;

/**
 * Moteur générique : à chaque pas de temps, interroge `computeSignalAt(i)`
 * qui doit retourner { signal: 'ACHAT'|'VENTE'|'NEUTRE' } ou null.
 */
function simulateStrategy(times, closes, computeSignalAt, warmup) {
  if (closes.length < warmup + 10) {
    return { trades: [], equityCurve: [], stats: null, error: 'Pas assez de données pour ce backtest.' };
  }

  const trades = [];
  let position = null;
  let lastSignal = 'NEUTRE';

  for (let i = warmup; i < closes.length; i++) {
    const result = computeSignalAt(i);
    if (!result) continue;

    const { signal } = result;
    const price = closes[i];
    const time = times[i];

    if (signal === 'ACHAT' && signal !== lastSignal) {
      if (position && position.direction === 'VENTE') {
        trades.push(closeTrade(position, price, time));
        position = null;
      }
      if (!position) {
        position = { direction: 'ACHAT', entryPrice: price, entryTime: time };
      }
    }

    if (signal === 'VENTE' && signal !== lastSignal) {
      if (position && position.direction === 'ACHAT') {
        trades.push(closeTrade(position, price, time));
        position = null;
      }
    }

    lastSignal = signal;
  }

  if (position) {
    trades.push(closeTrade(position, closes[closes.length - 1], times[times.length - 1]));
  }

  const equityCurve = buildEquityCurve(trades, times[warmup]);
  const stats = computeStats(trades, equityCurve);

  return { trades, equityCurve, stats };
}

/**
 * Backtest de la stratégie de confluence (tendance) : SMA/RSI/MACD/Volume/Pivots.
 * @param {number[]} closes
 * @param {number[]} times
 * @param {number[]} [volumes]
 * @param {number[]} [highs]
 * @param {number[]} [lows]
 */
export function runBacktest(closes, times, volumes = null, highs = null, lows = null) {
  return simulateStrategy(
    times,
    closes,
    (i) => {
      const windowCloses = closes.slice(0, i + 1);
      const windowVolumes = volumes ? volumes.slice(0, i + 1) : null;
      const windowHighs = highs ? highs.slice(0, i + 1) : null;
      const windowLows = lows ? lows.slice(0, i + 1) : null;
      return computeSignal(windowCloses, windowVolumes, windowHighs, windowLows);
    },
    CONFLUENCE_WARMUP
  );
}

/**
 * Backtest de la stratégie de retournement par pic de volume (scalping).
 * @param {number[]} opens
 * @param {number[]} closes
 * @param {number[]} times
 * @param {number[]} volumes
 */
export function runVolumeClimaxBacktest(opens, closes, times, volumes) {
  return simulateStrategy(
    times,
    closes,
    (i) => {
      const windowOpens = opens.slice(0, i + 1);
      const windowCloses = closes.slice(0, i + 1);
      const windowVolumes = volumes.slice(0, i + 1);
      return computeVolumeClimaxSignal(windowOpens, windowCloses, windowVolumes);
    },
    CLIMAX_WARMUP
  );
}

function closeTrade(position, exitPrice, exitTime) {
  const returnPct = ((exitPrice - position.entryPrice) / position.entryPrice) * 100;
  return {
    direction: position.direction,
    entryTime: position.entryTime,
    entryPrice: position.entryPrice,
    exitTime,
    exitPrice,
    returnPct
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
      finalReturnPct: 0
    };
  }

  const wins = trades.filter((t) => t.returnPct > 0);
  const losses = trades.filter((t) => t.returnPct <= 0);

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
    finalReturnPct
  };
}
