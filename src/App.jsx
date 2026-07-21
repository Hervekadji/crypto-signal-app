import React, { useState } from 'react';
import { useCryptoSignals } from './hooks/useCryptoSignals.js';
import BacktestPanel from './components/BacktestPanel.jsx';
import NewsPanel from './components/NewsPanel.jsx';
import NotificationToggle from './components/NotificationToggle.jsx';
import ScalpTab from './components/ScalpTab.jsx';
import DollarPanel from './components/DollarPanel.jsx';
import CandlestickChart from './components/CandlestickChart.jsx';

const INTERVALS = [
  { value: '1m', label: '1 min' },
  { value: '5m', label: '5 min' },
  { value: '15m', label: '15 min' },
  { value: '1h', label: '1 h' },
  { value: '4h', label: '4 h' }
];

const SCALP_INTERVALS = [
  { value: '1m', label: '1 min' },
  { value: '5m', label: '5 min' },
  { value: '15m', label: '15 min' }
];

function formatPrice(p) {
  if (p === null || p === undefined) return '—';
  return p.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatTime(d) {
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function signalColor(signal) {
  if (signal === 'ACHAT') return 'var(--buy)';
  if (signal === 'VENTE') return 'var(--sell)';
  return 'var(--muted)';
}

function TickerTape({ feeds }) {
  // Bande défilante façon panneau de bourse — l'élément signature de l'app.
  const items = [...feeds, ...feeds]; // dupliqué pour boucler visuellement
  return (
    <div className="ticker-tape">
      <div className="ticker-track">
        {items.map((f, i) => (
          <span className="ticker-item" key={i}>
            <span className="ticker-symbol">{f.label}</span>
            <span className="ticker-price">{formatPrice(f.price)}</span>
            <span className="ticker-signal" style={{ color: signalColor(f.signal) }}>
              {f.signal || '···'}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function IndicatorRow({ label, value, vote }) {
  return (
    <div className="indicator-row">
      <span className="indicator-label">{label}</span>
      <span className="indicator-value">{value}</span>
      <span
        className="indicator-vote"
        style={{
          color: vote?.includes('haussier')
            ? 'var(--buy)'
            : vote?.includes('baissier')
            ? 'var(--sell)'
            : 'var(--muted)'
        }}
      >
        {vote}
      </span>
    </div>
  );
}

function PairPanel({ label, symbol, interval, showChart, price, result, alerts, status, errorMessage, refresh }) {
  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <div className="eyebrow">Paire</div>
          <h2>{label}</h2>
        </div>
        <button className="refresh-btn" onClick={refresh} title="Rafraîchir maintenant">
          ↻
        </button>
      </div>

      <div className="price-block">
        <span className="price-value">{formatPrice(price)}</span>
        <span className="price-currency">USDT</span>
      </div>

      {showChart && <CandlestickChart symbol={symbol} interval={interval} />}

      {status === 'error' && <div className="error-banner">Erreur : {errorMessage}</div>}
      {status === 'loading' && !result && <div className="muted-note">Chargement des données…</div>}

      {result && (
        <>
          <div
            className="signal-badge"
            style={{
              borderColor: signalColor(result.signal),
              color: signalColor(result.signal)
            }}
          >
            {result.signal}
            <span className="signal-score">score {result.score > 0 ? `+${result.score}` : result.score}</span>
          </div>

          {result.blockedByHigherTimeframe && (
            <div className="filter-note">
              Signal {result.rawSignal} bloqué — tendance {result.higherTrend} sur le timeframe {result.higherTimeframe}
            </div>
          )}

          <div className="indicators">
            <IndicatorRow
              label="SMA 9 / 21"
              value={`${result.details.sma9.toFixed(2)} / ${result.details.sma21.toFixed(2)}`}
              vote={result.votes.sma}
            />
            <IndicatorRow label="RSI (14)" value={result.details.rsi.toFixed(1)} vote={result.votes.rsi} />
            <IndicatorRow
              label="MACD hist."
              value={result.details.histogram.toFixed(4)}
              vote={result.votes.macd}
            />
            {result.details.volume && (
              <IndicatorRow
                label="Volume"
                value={`x${result.details.volume.ratio.toFixed(2)} moy.`}
                vote={result.votes.volume}
              />
            )}
            {result.details.pivot && (
              <IndicatorRow
                label="Pivot (PP)"
                value={result.details.pivot.pp.toFixed(2)}
                vote={result.votes.pivot}
              />
            )}
          </div>
        </>
      )}

      <div className="alerts-log">
        <div className="eyebrow">Journal des alertes</div>
        {alerts.length === 0 && <div className="muted-note">Aucun changement de signal pour l'instant.</div>}
        <ul>
          {alerts.map((a) => (
            <li key={a.id}>
              <span className="alert-time">{formatTime(a.time)}</span>
              <span className="alert-signal" style={{ color: signalColor(a.signal) }}>
                {a.signal}
              </span>
              <span className="alert-price">{formatPrice(a.price)} USDT</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function App() {
  const [interval, setInterval_] = useState('5m');
  const [tab, setTab] = useState('live'); // 'live' | 'backtest' | 'news' | 'scalp'
  const [notifsEnabled, setNotifsEnabled] = useState(false);
  const [scalpInterval, setScalpInterval] = useState('5m');
  const [scalpNotifsEnabled, setScalpNotifsEnabled] = useState(false);
  const [showCandles, setShowCandles] = useState(false);

  // On instancie un hook indépendant par paire pour le bandeau défilant du haut.
  const btc = useCryptoSignals('BTCUSDT', interval, 30000, notifsEnabled);
  const eth = useCryptoSignals('ETHUSDT', interval, 30000, notifsEnabled);
  const gold = useCryptoSignals('PAXGUSDT', interval, 30000, notifsEnabled);

  const tickerFeeds = [
    { label: 'BTC/USDT', price: btc.price, signal: btc.result?.signal },
    { label: 'ETH/USDT', price: eth.price, signal: eth.result?.signal },
    { label: 'Or (PAXG)', price: gold.price, signal: gold.result?.signal }
  ];

  return (
    <div className="app">
      <TickerTape feeds={tickerFeeds} />

      <header className="app-header">
        <div>
          <div className="eyebrow">Signal Board</div>
          <h1>Alertes d'achat / vente</h1>
          <p className="subtitle">
            Confluence SMA 9/21 · RSI 14 · MACD 12/26/9 · Volume · Pivots + filtre timeframe supérieur —
            données publiques Binance
          </p>
        </div>

        <div className="header-controls">
          <div className="tab-buttons">
            <button className={tab === 'live' ? 'active' : ''} onClick={() => setTab('live')}>
              Tableau de bord
            </button>
            <button className={tab === 'backtest' ? 'active' : ''} onClick={() => setTab('backtest')}>
              Backtest
            </button>
            <button className={tab === 'news' ? 'active' : ''} onClick={() => setTab('news')}>
              Actualités
            </button>
            <button className={tab === 'scalp' ? 'active' : ''} onClick={() => setTab('scalp')}>
              Scalping
            </button>
          </div>

          {tab === 'live' && (
            <div className="interval-select">
              <span className="eyebrow">Intervalle</span>
              <div className="interval-buttons">
                {INTERVALS.map((it) => (
                  <button
                    key={it.value}
                    className={it.value === interval ? 'active' : ''}
                    onClick={() => setInterval_(it.value)}
                  >
                    {it.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === 'live' && <NotificationToggle enabled={notifsEnabled} onToggle={setNotifsEnabled} />}

          {tab === 'live' && (
            <button className="notif-btn" data-active={showCandles} onClick={() => setShowCandles(!showCandles)}>
              {showCandles ? 'Bougies japonaises ✓' : 'Afficher en bougies japonaises'}
            </button>
          )}

          {tab === 'scalp' && (
            <div className="interval-select">
              <span className="eyebrow">Intervalle</span>
              <div className="interval-buttons">
                {SCALP_INTERVALS.map((it) => (
                  <button
                    key={it.value}
                    className={it.value === scalpInterval ? 'active' : ''}
                    onClick={() => setScalpInterval(it.value)}
                  >
                    {it.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === 'scalp' && (
            <NotificationToggle
              enabled={scalpNotifsEnabled}
              onToggle={setScalpNotifsEnabled}
              labelOn="Alertes scalping activées ✓"
              labelOff="Alerter sur les retournements"
            />
          )}
        </div>
      </header>

      {tab === 'live' ? (
        <main className="grid">
          <PairPanel label="BTC/USDT" symbol="BTCUSDT" interval={interval} showChart={showCandles} {...btc} />
          <PairPanel label="ETH/USDT" symbol="ETHUSDT" interval={interval} showChart={showCandles} {...eth} />
          <PairPanel
            label="Or (PAXG/USDT)"
            symbol="PAXGUSDT"
            interval={interval}
            showChart={showCandles}
            {...gold}
          />
          <DollarPanel notifsEnabled={notifsEnabled} />
        </main>
      ) : tab === 'backtest' ? (
        <main className="grid grid-single">
          <BacktestPanel />
        </main>
      ) : tab === 'news' ? (
        <main className="grid grid-single">
          <NewsPanel />
        </main>
      ) : (
        <ScalpTab interval={scalpInterval} notifsEnabled={scalpNotifsEnabled} />
      )}

      <footer className="app-footer">
        Signaux à titre indicatif — ne constitue pas un conseil financier. Ce script observe
        le marché, il n'exécute aucun ordre.
      </footer>
    </div>
  );
}
