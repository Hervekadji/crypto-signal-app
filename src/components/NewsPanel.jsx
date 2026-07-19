import React, { useState } from 'react';
import { useMarketNews } from '../hooks/useMarketNews.js';
import { NEWS_CATEGORIES } from '../utils/newsKeywords.js';
import NotificationToggle from './NotificationToggle.jsx';

function formatTime(d) {
  return d.toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function NewsPanel() {
  const [notifsEnabled, setNotifsEnabled] = useState(false);
  const { items, status, errorMessage, refresh } = useMarketNews(5 * 60 * 1000, notifsEnabled);
  const [onlyImpact, setOnlyImpact] = useState(false);

  const visibleItems = onlyImpact ? items.filter((n) => n.categories.length > 0) : items;

  return (
    <div className="panel news-panel">
      <div className="panel-header">
        <div>
          <div className="eyebrow">Actualités</div>
          <h2>Ce qui pourrait bouger le marché</h2>
        </div>
        <button className="refresh-btn" onClick={refresh} title="Rafraîchir maintenant">
          ↻
        </button>
      </div>

      <NotificationToggle
        enabled={notifsEnabled}
        onToggle={setNotifsEnabled}
        labelOn="Alertes actualités activées ✓"
        labelOff="Alerter sur les actualités à impact"
      />

      <p className="muted-note">
        Détection automatique par mots-clés (régulation, ETF, sécurité, macroéconomie…) — pas une
        analyse de sentiment par IA. Vérifie toujours la source avant de tirer une conclusion.
      </p>
      <p className="muted-note news-color-note">
        Les couleurs des badges identifient uniquement la <strong>catégorie</strong> de l'actualité —
        elles ne signifient pas "haussier" ou "baissier".
      </p>

      <label className="news-filter-toggle">
        <input type="checkbox" checked={onlyImpact} onChange={(e) => setOnlyImpact(e.target.checked)} />
        N'afficher que les actualités à impact potentiel détecté
      </label>

      {status === 'error' && <div className="error-banner">Erreur : {errorMessage}</div>}
      {status === 'loading' && items.length === 0 && <div className="muted-note">Chargement des actualités…</div>}

      <div className="news-list">
        {visibleItems.map((item) => (
          <a className="news-item" href={item.link} target="_blank" rel="noopener noreferrer" key={item.id}>
            <div className="news-item-header">
              <span className="news-source">{item.source}</span>
              <span className="news-time">{formatTime(item.publishedAt)}</span>
            </div>
            <p className="news-title">{item.title}</p>
            {item.description && <p className="news-description">{item.description}…</p>}
            {item.categories.length > 0 && (
              <div className="news-badges">
                {item.categories.map((cat) => (
                  <span
                    key={cat}
                    className="news-badge"
                    style={{ color: NEWS_CATEGORIES[cat].color, borderColor: NEWS_CATEGORIES[cat].color }}
                  >
                    {NEWS_CATEGORIES[cat].label}
                  </span>
                ))}
              </div>
            )}
          </a>
        ))}

        {status === 'ok' && visibleItems.length === 0 && (
          <div className="muted-note">Aucune actualité à impact détecté pour le moment.</div>
        )}
      </div>
    </div>
  );
}
