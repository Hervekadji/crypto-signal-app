import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { runBacktest } from '../utils/backtest.js';

const BINANCE_KLINES = 'https://api.binance.com/api/v3/klines';

const BACKTEST_PAIRS = [
  { symbol: 'BTCUSDT', label: 'BTC/USDT' },
  { symbol: 'ETHUSDT', label: 'ETH/USDT' },
  { symbol: 'PAXGUSDT', label: 'Or (PAXG/USDT)' }
];

// Limite max d'une requête Binance : 1000 bougies.
// Avec 4h ça couvre ~166 jours, avec 1d ça couvre ~1000 jours (~2.7 ans).
const BACKTEST_INTERVALS = [
  { value: '1h', label: '1 h (~41 jours)' },
  { value: '4h', label: '4 h (~166 jours)' },
  { value: '1d', label: '1 jour (~2,7 ans)' }
];

function formatPct(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}%`;
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' });
}

export default function BacktestPanel() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [interval, setIntervalValue] = useState('4h');
  const [status, setStatus] = useState('idle'); // idle | loading | done | error
  const [errorMessage, setErrorMessage] = useState(null);
  const [output, setOutput] = useState(null); // { trades, equityCurve, stats }

  const runTest = async () => {
    try {
      setStatus('loading');
      setErrorMessage(null);
      const url = `${BINANCE_KLINES}?symbol=${symbol}&interval=${interval}&limit=1000`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Binance a répondu ${res.status}`);
      const raw = await res.json();

      const closes = raw.map((k) => parseFloat(k[4]));
      const times = raw.map((k) => k[0]);

      const result = runBacktest(closes, times);
      if (result.error) {
        setStatus('error');
        setErrorMessage(result.error);
        return;
      }
      setOutput(result);
      setStatus('done');
    } catch (err) {
      setStatus('error');
      setErrorMessage(err.message || 'Erreur réseau');
    }
  };

  const stats = output?.stats;
  const chartData = output?.equityCurve.map((p) => ({ time: p.time, equity: Number(p.equity.toFixed(2)) })) || [];

  return (
    <div className="panel backtest-panel">
      <div className="panel-header">
        <div>
          <div className="eyebrow">Backtest</div>
          <h2>Performance historique réelle</h2>
        </div>
      </div>

      <p className="muted-note">
        Rejoue la logique de confluence (SMA 9/21 · RSI 14 · MACD) sur des données Binance passées et
        calcule le résultat réel qu'elle aurait donné — pas une estimation.
      </p>

      <div className="backtest-controls">
        <div className="backtest-field">
          <span className="eyebrow">Actif</span>
          <div className="interval-buttons">
            {BACKTEST_PAIRS.map((p) => (
              <button key={p.symbol} className={p.symbol === symbol ? 'active' : ''} onClick={() => setSymbol(p.symbol)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="backtest-field">
          <span className="eyebrow">Intervalle</span>
          <div className="interval-buttons">
            {BACKTEST_INTERVALS.map((it) => (
              <button key={it.value} className={it.value === interval ? 'active' : ''} onClick={() => setIntervalValue(it.value)}>
                {it.label}
              </button>
            ))}
          </div>
        </div>

        <button className="run-backtest-btn" onClick={runTest} disabled={status === 'loading'}>
          {status === 'loading' ? 'Calcul en cours…' : 'Lancer le backtest'}
        </button>
      </div>

      {status === 'error' && <div className="error-banner">Erreur : {errorMessage}</div>}

      {stats && (
        <>
          <div className="backtest-stats">
            <div className="stat">
              <span className="stat-label">Trades simulés</span>
              <span className="stat-value">{stats.totalTrades}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Taux de réussite</span>
              <span className="stat-value" style={{ color: stats.winRate >= 50 ? '#34d399' : '#f87171' }}>
                {stats.totalTrades > 0 ? `${stats.winRate.toFixed(1)}%` : '—'}
              </span>
            </div>
            <div className="stat">
              <span className="stat-label">Gain moyen / trade</span>
              <span className="stat-value">{formatPct(stats.avgReturnPct)}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Pire chute (drawdown)</span>
              <span className="stat-value" style={{ color: '#f87171' }}>-{stats.maxDrawdownPct.toFixed(2)}%</span>
            </div>
            <div className="stat">
              <span className="stat-label">Résultat cumulé période</span>
              <span className="stat-value" style={{ color: stats.finalReturnPct >= 0 ? '#34d399' : '#f87171' }}>
                {formatPct(stats.finalReturnPct)}
              </span>
            </div>
          </div>

          {stats.totalTrades === 0 && (
            <div className="muted-note">
              Aucun signal ACHAT/VENTE déclenché sur cette période — essaie un autre intervalle.
            </div>
          )}

          {chartData.length > 1 && (
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="#223049" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="time"
                    tickFormatter={formatDate}
                    stroke="#7c8aa5"
                    fontSize={11}
                    tick={{ fill: '#7c8aa5' }}
                    minTickGap={40}
                  />
                  <YAxis stroke="#7c8aa5" fontSize={11} tick={{ fill: '#7c8aa5' }} domain={['auto', 'auto']} />
                  <Tooltip
                    contentStyle={{ background: '#121b2e', border: '1px solid #223049', borderRadius: 8 }}
                    labelFormatter={formatDate}
                    formatter={(value) => [`${value}`, 'Équité (base 100)']}
                  />
                  <Line type="monotone" dataKey="equity" stroke="#d4a24c" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
              <p className="chart-caption">
                Évolution d'un capital de départ fictif de 100, en suivant uniquement les signaux ACHAT/VENTE de la
                confluence. Sert à visualiser la régularité, pas à prédire l'avenir.
              </p>
            </div>
          )}

          <p className="disclaimer">
            Résultat basé sur {stats.totalTrades} trade{stats.totalTrades > 1 ? 's' : ''} passé
            {stats.totalTrades > 1 ? 's' : ''} sur la période choisie, sans frais de transaction ni slippage
            simulés. Les performances passées ne garantissent en rien les performances futures.
          </p>
        </>
      )}
    </div>
  );
}
