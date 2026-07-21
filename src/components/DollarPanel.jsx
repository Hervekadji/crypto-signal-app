import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useDollarIndex } from '../hooks/useDollarIndex.js';
import { useDollarHistory } from '../hooks/useDollarHistory.js';

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

function formatChartDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

export default function DollarPanel({ notifsEnabled }) {
  const { result, alerts, status, errorMessage, refresh } = useDollarIndex(15 * 60 * 1000, notifsEnabled);
  const { series, status: historyStatus, errorMessage: historyError } = useDollarHistory(21);

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
          {Object.keys(result.byCurrency).length === 0 ? (
            <div className="muted-note">
              Première lecture effectuée — la direction (hausse/baisse) apparaîtra au prochain
              rafraîchissement, une fois qu'il y a deux points à comparer.
            </div>
          ) : (
            <>
              <div className="price-block">
                <span className="price-value" style={{ color: directionColor(result.direction) }}>
                  {formatPct(result.compositeChangePct)}
                </span>
                <span className="price-currency">vs lecture précédente</span>
              </div>

              <div
                className="signal-badge"
                style={{ borderColor: directionColor(result.direction), color: directionColor(result.direction) }}
              >
                {result.direction === 'hausse' ? 'HAUSSE' : result.direction === 'baisse' ? 'BAISSE' : 'STABLE'}
              </div>
            </>
          )}

          <p className="climax-reason">
            Corrélation historique inverse avec le Bitcoin — un dollar fort coïncide souvent avec
            une pression baissière sur les cryptos, et inversement. Ce n'est pas systématique, juste
            une tendance statistique à surveiller.
          </p>

          {historyStatus === 'ok' && series.length > 1 && (
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={series} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="#223049" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatChartDate}
                    stroke="#7c8aa5"
                    fontSize={10}
                    tick={{ fill: '#7c8aa5' }}
                    minTickGap={30}
                  />
                  <YAxis stroke="#7c8aa5" fontSize={10} tick={{ fill: '#7c8aa5' }} domain={['auto', 'auto']} />
                  <Tooltip
                    contentStyle={{ background: '#121b2e', border: '1px solid #223049', borderRadius: 8 }}
                    labelFormatter={formatChartDate}
                    formatter={(value) => [value.toFixed(3), 'Indice (base 100)']}
                  />
                  <Line type="monotone" dataKey="composite" stroke="#d4a24c" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
              <p className="chart-caption">Indice composite sur ~21 jours, rebasé à 100 au premier jour disponible.</p>
            </div>
          )}
          {historyStatus === 'error' && (
            <div className="muted-note">Courbe historique indisponible : {historyError}</div>
          )}
          {historyStatus === 'loading' && <div className="muted-note">Chargement de la courbe historique…</div>}

          {Object.keys(result.byCurrency || {}).length > 0 && (
            <div className="indicators">
              {Object.entries(result.byCurrency).map(([ccy, change]) => (
                <div className="indicator-row" key={ccy}>
                  <span className="indicator-label">
                    USD/{ccy} ({CURRENCY_LABELS[ccy]})
                  </span>
                  <span className="indicator-value">{formatPct(change)}</span>
                </div>
              ))}
            </div>
          )}

          <p className="muted-note">
            Approximation façon DXY (EUR/JPY/GBP/CAD/CHF pondérés), mise à jour quotidiennement — pas
            un indice ICE officiel en temps réel.
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
