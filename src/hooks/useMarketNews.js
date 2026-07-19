import { useCallback, useEffect, useState } from 'react';
import { classifyNews } from '../utils/newsKeywords.js';

// Conversion RSS → JSON gratuite, pensée pour un usage côté navigateur (CORS ouvert).
const RSS2JSON = 'https://api.rss2json.com/v1/api.json?rss_url=';

const FEEDS = [
  { source: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/' },
  { source: 'Cointelegraph', url: 'https://cointelegraph.com/rss' }
];

/**
 * Récupère les actualités crypto depuis plusieurs flux RSS, les fusionne,
 * les trie par date, et les classe par catégorie via détection de mots-clés
 * (pas une vraie analyse de sentiment IA — voir utils/newsKeywords.js).
 *
 * @param {number} pollMs intervalle de rafraîchissement (les news bougent
 *   moins vite que les prix, donc un intervalle plus long convient)
 */
export function useMarketNews(pollMs = 5 * 60 * 1000) {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | loading | ok | error
  const [errorMessage, setErrorMessage] = useState(null);

  const fetchNews = useCallback(async () => {
    try {
      setStatus('loading');

      const results = await Promise.allSettled(
        FEEDS.map(async (feed) => {
          const res = await fetch(`${RSS2JSON}${encodeURIComponent(feed.url)}`);
          if (!res.ok) throw new Error(`${feed.source} : ${res.status}`);
          const data = await res.json();
          if (data.status !== 'ok') throw new Error(`${feed.source} : réponse invalide`);
          return data.items.map((item) => ({
            id: item.guid || item.link,
            source: feed.source,
            title: item.title,
            description: (item.description || '').replace(/<[^>]+>/g, '').slice(0, 220),
            link: item.link,
            publishedAt: new Date(item.pubDate),
            categories: classifyNews(item.title, item.description)
          }));
        })
      );

      const merged = results
        .filter((r) => r.status === 'fulfilled')
        .flatMap((r) => r.value)
        .sort((a, b) => b.publishedAt - a.publishedAt)
        .slice(0, 40);

      const allFailed = results.every((r) => r.status === 'rejected');
      if (allFailed) {
        throw new Error('Aucun flux d\'actualités accessible pour le moment.');
      }

      setItems(merged);
      setStatus('ok');
      setErrorMessage(null);
    } catch (err) {
      setStatus('error');
      setErrorMessage(err.message || 'Erreur réseau');
    }
  }, []);

  useEffect(() => {
    fetchNews();
    const id = setInterval(fetchNews, pollMs);
    return () => clearInterval(id);
  }, [fetchNews, pollMs]);

  return { items, status, errorMessage, refresh: fetchNews };
}
