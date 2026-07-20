import React from 'react';
import { useVolumeClimax } from '../hooks/useVolumeClimax.js';

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

function ClimaxPanel({ label, price, result, alerts, status, errorMessage, refresh }) {
  const d = result?.details;

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

      {status === 'error' && <div className="error-banner">Erreur : {errorMessage}</div>}
      {status === 'loading' && !result && <div className="muted-note">Chargement des données…</div>}

      {result && (
        <>
          <div
            className="signal-badge"
            style={{ borderColor: signalColor(result.signal), color: signalColor(result.signal) }}
          >
            {result.signal}
          </div>

          {result.reason && <p className="climax-reason">{result.reason}</p>}

          {d && (
            <div className="indicators">
              <div className="indicator-row">
                <span className="indicator-label">Volume vs moyenne</span>
                <span className="indicator-value">x{d.volumeRatio.toFixed(2)}</span>
                <span className="indicator-vote" style={{ color: d.isVolumeSpike ? 'var(--gold)' : 'var(--muted)' }}>
                  {d.isVolumeSpike ? 'pic détecté' : 'normal'}
                </span>
              </div>
              <div className="indicator-row">
                <span className="indicator-label">Position dans le range</span>
                <span className="indicator-value">
                  {d.isNearLow ? 'bas de range' : d.isNearHigh ? 'haut de range' : 'milieu'}
                </span>
              </div>
              <div className="indicator-row">
                <span className="indicator-label">RSI (14)</span>
                <span className="indicator-value">{d.rsi !== null ? d.rsi.toFixed(1) : '—'}</span>
              </div>
            </div>
          )}
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

export default function ScalpTab({ interval, notifsEnabled }) {
  const btc = useVolumeClimax('BTCUSDT', interval, 20000, notifsEnabled);
  const eth = useVolumeClimax('ETHUSDT', interval, 20000, notifsEnabled);
  const gold = useVolumeClimax('PAXGUSDT', interval, 20000, notifsEnabled);

  return (
    <main className="grid">
      <ClimaxPanel label="BTC/USDT" {...btc} />
      <ClimaxPanel label="ETH/USDT" {...eth} />
      <ClimaxPanel label="Or (PAXG/USDT)" {...gold} />
    </main>
  );
}
