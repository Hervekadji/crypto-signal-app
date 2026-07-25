import React from 'react';
import { useJournal } from '../hooks/useJournal.js';

const STRATEGY_LABELS = { confluence: 'Confluence', scalping: 'Scalping (retournement)' };

function formatPrice(p) {
  if (p === null || p === undefined) return '—';
  return p.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPct(v) {
  if (v === null || v === undefined) return '—';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}%`;
}

function formatElapsed(entryTime) {
  const diffMs = Date.now() - entryTime;
  const hours = Math.floor(diffMs / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);
  if (hours > 0) return `il y a ${hours} h ${minutes} min`;
  return `il y a ${minutes} min`;
}

export default function JournalPanel() {
  const { entries, clear } = useJournal();

  const withResult = entries.filter((e) => e.changePct !== null);
  const winCount = withResult.filter((e) => e.changePct > 0).length;
  const winRate = withResult.length > 0 ? (winCount / withResult.length) * 100 : null;
  const avgChange =
    withResult.length > 0 ? withResult.reduce((a, e) => a + e.changePct, 0) / withResult.length : null;

  return (
    <div className="panel journal-panel">
      <div className="panel-header">
        <div>
          <div className="eyebrow">Journal</div>
          <h2>Suivi des signaux réels</h2>
        </div>
        {entries.length > 0 && (
          <button className="refresh-btn" onClick={clear} title="Vider le journal">
            🗑
          </button>
        )}
      </div>

      <p className="muted-note">
        Chaque signal ACHAT/VENTE réellement émis par l'app est enregistré ici automatiquement, avec son
        prix d'entrée. Le résultat affiché compare ce prix au prix actuel — la vraie preuve en conditions
        réelles, pas un backtest sur données passées.
      </p>

      {withResult.length > 0 && (
        <div className="backtest-stats">
          <div className="stat">
            <span className="stat-label">Signaux suivis</span>
            <span className="stat-value">{withResult.length}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Taux positif actuel</span>
            <span className="stat-value" style={{ color: winRate >= 50 ? '#34d399' : '#f87171' }}>
              {winRate.toFixed(1)}%
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Variation moyenne</span>
            <span className="stat-value" style={{ color: avgChange >= 0 ? '#34d399' : '#f87171' }}>
              {formatPct(avgChange)}
            </span>
          </div>
        </div>
      )}

      <div className="journal-list">
        {entries.length === 0 && (
          <div className="muted-note">
            Aucun signal enregistré pour l'instant — dès qu'un vrai ACHAT/VENTE apparaît sur le Tableau de
            bord ou le Scalping, il apparaîtra ici automatiquement.
          </div>
        )}

        {entries.map((entry) => (
          <div className="journal-item" key={entry.id}>
            <div className="journal-item-header">
              <span className="journal-symbol">{entry.symbol}</span>
              <span className="journal-strategy">{STRATEGY_LABELS[entry.strategy] || entry.strategy}</span>
              <span
                className="journal-direction"
                style={{ color: entry.direction === 'ACHAT' ? 'var(--buy)' : 'var(--sell)' }}
              >
                {entry.direction}
              </span>
            </div>
            <div className="journal-item-body">
              <span className="journal-detail">
                Entrée {formatPrice(entry.entryPrice)} · {formatElapsed(entry.entryTime)}
              </span>
              <span
                className="journal-change"
                style={{ color: entry.changePct === null ? 'var(--muted)' : entry.changePct >= 0 ? 'var(--buy)' : 'var(--sell)' }}
              >
                {entry.changePct === null ? 'chargement…' : formatPct(entry.changePct)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
