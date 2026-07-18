// utils/backtest.js
// Rejoue la logique de confluence (SMA/RSI/MACD) sur un historique de prix,
// simule les trades qui en auraient résulté, et calcule des statistiques
// réelles de performance — pas une estimation.

import { computeSignal } from './indicators.js';

const WARMUP = 35; // nb de bougies nécessaires avant que MACD/SMA21 soient calculables

/**
 * @param {number[]} closes prix de clôture, du plus ancien au plus récent
 * @param {number[]} times timestamps (ms) alignés avec closes
 * @returns {{
 *   trades: Array<{entryTime:number, exitTime:number, entryPrice:number, exitPrice:number, returnPct:number, direction:string}>,
 *   equityCurve: Array<{time:number, equity:number}>,
 *   stats: {totalTrades:number, winRate:number, avgReturnPct:number, avgWinPct:number, avgLossPct:number, maxDrawdownPct:number, finalReturnPct:number}
 * }}
 */
/**
 * @param {number[]} closes prix de clôture, du plus ancien au plus récent
 * @param {number[]} times timestamps (ms) alignés avec closes
 * @param {number[]} [volumes] volumes alignés avec closes (active le vote Volume)
 * @param {number[]} [highs] plus hauts alignés avec closes (active le vote Pivots)
 * @param {number[]} [lows] plus bas alignés avec closes (active le vote Pivots)
 * @returns {{
 *   trades: Array<{entryTime:number, exitTime:number, entryPrice:number, exitPrice:number, returnPct:number, direction:string}>,
 *   equityCurve: Array<{time:number, equity:number}>,
 *   stats: {totalTrades:number, winRate:number, avgReturnPct:number, avgWinPct:number, avgLossPct:number, maxDrawdownPct:number, finalReturnPct:number}
 * }}
 */
export function runBacktest(closes, times, volumes = null, highs = null, lows = null) {
  if (closes.length < WARMUP + 10) {
    return { trades: [], equityCurve: [], stats: null, error: 'Pas assez de données pour ce backtest.' };
  }

  const trades = [];
  let position = null; // { direction: 'ACHAT', entryPrice, entryTime }
  let lastSignal = 'NEUTRE';

  for (let i = WARMUP; i < closes.length; i++) {
    const windowCloses = closes.slice(0, i + 1);
    const windowVolumes = volumes ? volumes.slice(0, i + 1) : null;
    const windowHighs = highs ? highs.slice(0, i + 1) : null;
    const windowLows = lows ? lows.slice(0, i + 1) : null;
    const result = computeSignal(windowCloses, windowVolumes, windowHighs, windowLows);
    if (!result) continue;

    const { signal } = result;
    const price = closes[i];
    const time = times[i];

    // Un signal ACHAT ouvre une position longue si on n'en a pas déjà une.
    if (signal === 'ACHAT' && signal !== lastSignal) {
      if (position && position.direction === 'VENTE') {
        // on clôture la position courte avant d'ouvrir la longue
        trades.push(closeTrade(position, price, time));
        position = null;
      }
      if (!position) {
        position = { direction: 'ACHAT', entryPrice: price, entryTime: time };
      }
    }

    // Un signal VENTE clôture une position longue (on ne simule pas le short ici,
    // on considère VENTE comme "sortir du marché").
    if (signal === 'VENTE' && signal !== lastSignal) {
      if (position && position.direction === 'ACHAT') {
        trades.push(closeTrade(position, price, time));
        position = null;
      }
    }

    lastSignal = signal;
  }

  // Position encore ouverte à la fin : on la clôture au dernier prix connu pour ne pas la perdre des stats
  if (position) {
    trades.push(closeTrade(position, closes[closes.length - 1], times[times.length - 1]));
  }

  const equityCurve = buildEquityCurve(trades, times[WARMUP]);
  const stats = computeStats(trades, equityCurve);

  return { trades, equityCurve, stats };
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
  let equity = 100; // base 100, en pourcentage cumulé
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

  // Max drawdown sur la courbe d'équité
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
