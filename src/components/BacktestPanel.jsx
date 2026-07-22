import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { runBacktest, runVolumeClimaxBacktest, runChecklistBacktest } from '../utils/backtest.js';
import { fetchHistoricalKlines } from '../utils/binanceHistory.js';

const BACKTEST_PAIRS = [
  { symbol: 'BTCUSDT', label: 'BTC/USDT' },
  { symbol: 'ETHUSDT', label: 'ETH/USDT' },
  { symbol: 'PAXGUSDT', label: 'Or (PAXG/USDT)' }
];

const STRATEGIES = [
  { value: 'confluence', label: 'Confluence (tendance)' },
  { value: 'climax', label: 'Retournement volume (scalping)' },
  { value: 'checklist', label: 'Check-list (volume+RSI+confirmation)' }
];

// `requests` = nombre de requêtes de 1000 bougies enchaînées (pagination)
// pour dépasser la limite Binance sur les petits timeframes.
const BACKTEST_INTERVALS = {
  confluence: [
    { value: '1m', label: '1 min (~7 jours)', requests: 10 },
    { value: '5m', label: '5 min (~35 jours)', requests: 10 },
    { value: '15m', label: '15 min (~104 jours)', requests: 10 },
    { value: '1h', label: '1 h (~41 jours)', requests: 1 },
    { value: '4h', label: '4 h (~166 jours)', requests: 1 },
    { value: '1d', label: '1 jour (~2,7 ans)', requests: 1 }
  ],
  climax: [
    { value: '1m', label: '1 min (~3,5 jours)', requests: 5 },
    { value: '5m', label: '5 min (~17 jours)', requests: 5 },
    { value: '15m', label: '15 min (~52 jours)', requests: 5 }
  ],
  checklist: [
    { value: '1m', label: '1 min (~3,5 jours)', requests: 5 },
    { value: '5m', label: '5 min (~17 jours)', requests: 5 },
    { value: '15m', label: '15 min (~52 jours)', requests: 5 }
  ]
};

const STOP_LOSS_OPTIONS = [
  { value: null, label: 'Aucun' },
  { value: 1, label: '-1%' },
  { value: 2, label: '-2%' },
  { value: 3, label: '-3%' },
  { value: 5, label: '-5%' }
];

const RSI_PRESETS = [
  { value: 'strict', label: 'RSI 75/20 (strict)', overbought: 75, oversold: 20 },
  { value: 'loose', label: 'RSI 70/30 (+ de trades)', overbought: 70, oversold: 30 }
];

const CONFIRMATION_OPTIONS = [
  { value: 1, label: '1 bougie (immédiat)' },
  { value: 2, label: '2 bougies' },
  { value: 3, label: '3 bougies (check-list)' }
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
  const [strategy, setStrategy] = useState('confluence');
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [interval, setIntervalValue] = useState('4h');
  const [status, setStatus] = useState('idle'); // idle | loading | done | error
  const [errorMessage, setErrorMessage] = useState(null);
  const [output, setOutput] = useState(null); // { trades, equityCurve, stats }
  const [stopLossPct, setStopLossPct] = useState(null);
  const [rsiPreset, setRsiPreset] = useState('strict');
  const [confirmationCandles, setConfirmationCandles] = useState(3);
  const [useTimeFilter, setUseTimeFilter] = useState(true);
  const [useExtendedVotes, setUseExtendedVotes] = useState(true);

  const selectStrategy = (value) => {
    setStrategy(value);
    setIntervalValue(BACKTEST_INTERVALS[value][0].value);
    setOutput(null);
    setStatus('idle');
  };

  const runTest = async () => {
    try {
      setStatus('loading');
      setErrorMessage(null);

      const intervalConfig = BACKTEST_INTERVALS[strategy].find((it) => it.value === interval);
      const requests = intervalConfig?.requests || 1;

      const raw = await fetchHistoricalKlines(symbol, interval, requests);

      const times = raw.map((k) => k[0]);
      const opens = raw.map((k) => parseFloat(k[1]));
      const highs = raw.map((k) => parseFloat(k[2]));
      const lows = raw.map((k) => parseFloat(k[3]));
      const closes = raw.map((k) => parseFloat(k[4]));
      const volumes = raw.map((k) => parseFloat(k[5]));

      let result;
      if (strategy === 'climax') {
        result = runVolumeClimaxBacktest(opens, closes, times, volumes, highs, lows, stopLossPct);
      } else if (strategy === 'checklist') {
        const preset = RSI_PRESETS.find((p) => p.value === rsiPreset);
        result = runChecklistBacktest(opens, closes, times, volumes, {
          rsiOversold: preset.oversold,
          rsiOverbought: preset.overbought,
          confirmationCandles,
          useTimeFilter,
          highs,
          lows,
          stopLossPct
        });
      } else {
        result = runBacktest(closes, times, volumes, highs, lows, stopLossPct, useExtendedVotes);
      }

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
        Rejoue une stratégie sur des données Binance passées et calcule le résultat réel qu'elle aurait
        donné — pas une estimation.
      </p>

      <div className="backtest-controls">
        <div className="backtest-field">
          <span className="eyebrow">Stratégie</span>
          <div className="interval-buttons">
            {STRATEGIES.map((s) => (
              <button key={s.value} className={s.value === strategy ? 'active' : ''} onClick={() => selectStrategy(s.value)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

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
            {BACKTEST_INTERVALS[strategy].map((it) => (
              <button key={it.value} className={it.value === interval ? 'active' : ''} onClick={() => setIntervalValue(it.value)}>
                {it.label}
              </button>
            ))}
          </div>
        </div>

        {strategy === 'confluence' && (
          <div className="backtest-field">
            <span className="eyebrow">Indicateurs</span>
            <div className="interval-buttons">
              <button className={useExtendedVotes ? 'active' : ''} onClick={() => setUseExtendedVotes(true)}>
                5 votes (+ Volume + Pivots)
              </button>
              <button className={!useExtendedVotes ? 'active' : ''} onClick={() => setUseExtendedVotes(false)}>
                3 votes (SMA/RSI/MACD)
              </button>
            </div>
          </div>
        )}

        {strategy === 'checklist' && (
          <>
            <div className="backtest-field">
              <span className="eyebrow">Seuils RSI</span>
              <div className="interval-buttons">
                {RSI_PRESETS.map((p) => (
                  <button key={p.value} className={p.value === rsiPreset ? 'active' : ''} onClick={() => setRsiPreset(p.value)}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="backtest-field">
              <span className="eyebrow">Confirmation</span>
              <div className="interval-buttons">
                {CONFIRMATION_OPTIONS.map((c) => (
                  <button
                    key={c.value}
                    className={c.value === confirmationCandles ? 'active' : ''}
                    onClick={() => setConfirmationCandles(c.value)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="backtest-field">
              <span className="eyebrow">Filtre horaire</span>
              <div className="interval-buttons">
                <button className={useTimeFilter ? 'active' : ''} onClick={() => setUseTimeFilter(true)}>
                  8h-22h Yaoundé
                </button>
                <button className={!useTimeFilter ? 'active' : ''} onClick={() => setUseTimeFilter(false)}>
                  24h/24
                </button>
              </div>
            </div>
          </>
        )}

        <div className="backtest-field">
          <span className="eyebrow">Stop-loss</span>
          <div className="interval-buttons">
            {STOP_LOSS_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                className={opt.value === stopLossPct ? 'active' : ''}
                onClick={() => setStopLossPct(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <button className="run-backtest-btn" onClick={runTest} disabled={status === 'loading'}>
          {status === 'loading' ? 'Récupération de l\'historique…' : 'Lancer le backtest'}
        </button>
      </div>

      {status === 'loading' && (
        <p className="muted-note">
          Les petits timeframes nécessitent plusieurs requêtes enchaînées pour couvrir assez
          d'historique — ça peut prendre quelques secondes de plus.
        </p>
      )}

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
            {stopLossPct && (
              <div className="stat">
                <span className="stat-label">Trades stoppés (-{stopLossPct}%)</span>
                <span className="stat-value">{stats.stoppedOutCount} / {stats.totalTrades}</span>
              </div>
            )}
            {stats.totalTrades > 0 && (
              <div className="stat">
                <span className="stat-label">Profit Factor</span>
                <span className="stat-value">
                  {(() => {
                    const grossWin = stats.avgWinPct * stats.totalTrades * (stats.winRate / 100);
                    const grossLoss = Math.abs(stats.avgLossPct) * stats.totalTrades * (1 - stats.winRate / 100);
                    const pf = grossLoss > 0 ? grossWin / grossLoss : null;
                    return pf ? pf.toFixed(2) : '—';
                  })()}
                </span>
              </div>
            )}
          </div>

          {stats.totalTrades === 0 && (
            <div className="muted-note">
              Aucun signal ACHAT/VENTE déclenché sur cette période — essaie un autre intervalle, ou
              relâche les seuils RSI/la confirmation si tu es sur la check-list.
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
                stratégie choisie. Sert à visualiser la régularité, pas à prédire l'avenir.
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
