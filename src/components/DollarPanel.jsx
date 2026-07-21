import React from 'react';
import { useDollarIndex } from '../hooks/useDollarIndex.js';

const CURRENCY_LABELS = { EUR: 'Euro', JPY: 'Yen', GBP: 'Livre', CAD: 'Dollar CA', CHF: 'Franc CH' };

function directionColor(direction) {
  if (direction === 'hausse') return 'var(--gold)'; // volontairement ni rouge ni vert : le dollar n'est ni "achat" ni "vente"
  if (direction === 'baisse') return '#60a5fa';
  return 'var(--muted)';
}

function formatPct(v) {
  if (v === null || v === undefined) return '—';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(3)}%`;
}

function formatTime(d) {
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export default function DollarPanel({ notifsEnabled }) {
  const { result, alerts, status, errorMessage, refresh } = useDollarIndex(15 * 60 * 1000, notifsEnabled);

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <div className="eyebrow">Devise</div>
          <h2>Dollar US (panier pondéré)</h2>
        </div>
        <button className="refresh-btn" onClick={refresh} title="Rafraîchir maintenant">
          ↻
        </button>
      </div>

      {status === 'error' && <div className="error-banner">Erreur : {errorMessage}</div>}
      {status === 'loading' && !result && <div className="muted-note">Chargement des taux de change…</div>}

      {result && (
        <>
          <div className="price-block">
            <span className="price-value" style={{ color: directionColor(result.direction) }}>
              {formatPct(result.compositeChangePct)}
            </span>
            <span className="price-currency">vs hier</span>
          </div>

          <div
            className="signal-badge"
            style={{ borderColor: directionColor(result.direction), color: directionColor(result.direction) }}
          >
            {result.direction === 'hausse' ? 'HAUSSE' : result.direction === 'baisse' ? 'BAISSE' : 'STABLE'}
          </div>

          <p className="climax-reason">
            Corrélation historique inverse avec le Bitcoin — un dollar fort coïncide souvent avec une
            pression baissière sur les cryptos, et inversement. Ce n'est pas systématique, juste une
            tendance statistique à surveiller.
          </p>

          <div className="indicators">
            {Object.entries(result.byCurrency).map(([ccy, change]) => (
              <div className="indicator-row" key={ccy}>
                <span className="indicator-label">USD/{ccy} ({CURRENCY_LABELS[ccy]})</span>
                <span className="indicator-value">{formatPct(change)}</span>
              </div>
            ))}
          </div>

          <p className="muted-note">
            Approximation façon DXY (EUR/JPY/GBP/CAD/CHF pondérés), basée sur les taux de référence
            quotidiens de la Banque Centrale Européenne — pas l'indice ICE officiel, et mis à jour une
            fois par jour ouvré, pas en continu.
          </p>
        </>
      )}

      <div className="alerts-log">
        <div className="eyebrow">Journal des changements de direction</div>
        {alerts.length === 0 && <div className="muted-note">Aucun changement pour l'instant.</div>}
        <ul>
          {alerts.map((a) => (
            <li key={a.id}>
              <span className="alert-time">{formatTime(a.time)}</span>
              <span className="alert-signal" style={{ color: directionColor(a.direction) }}>
                {a.direction.toUpperCase()}
              </span>
              <span className="alert-price">{formatPct(a.changePct)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
