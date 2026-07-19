// utils/newsKeywords.js
//
// Détection HEURISTIQUE par mots-clés — pas une analyse de sentiment par IA.
// Chaque catégorie regroupe des mots-clés (anglais, langue des flux sources)
// dont la présence dans un titre/résumé suggère qu'une actualité peut avoir
// un impact fondamental sur le marché. Une actualité peut correspondre à
// plusieurs catégories à la fois.

export const NEWS_CATEGORIES = {
  reglementation: {
    label: 'Réglementation',
    color: '#a78bfa', // violet — neutre, sans lien avec le rouge VENTE
    keywords: ['sec', 'regulation', 'regulatory', 'lawsuit', 'court', 'ban', 'legal', 'fine', 'compliance', 'law']
  },
  institutionnel: {
    label: 'Institutionnel / ETF',
    color: '#38bdf8', // bleu clair — neutre, sans lien avec le vert ACHAT
    keywords: ['etf', 'institutional', 'blackrock', 'adoption', 'ipo', 'fund', 'investment firm', 'pension']
  },
  securite: {
    label: 'Sécurité',
    color: '#fb923c', // orange
    keywords: ['hack', 'exploit', 'breach', 'stolen', 'vulnerability', 'scam', 'rug pull', 'phishing']
  },
  macro: {
    label: 'Macroéconomie',
    color: '#d4a24c', // doré, cohérent avec l'identité visuelle générale
    keywords: ['fed', 'interest rate', 'inflation', 'cpi', 'powell', 'recession', 'rate cut', 'rate hike', 'gdp']
  },
  reseau: {
    label: 'Réseau / Technique',
    color: '#94a3b8', // gris-bleu
    keywords: ['upgrade', 'hard fork', 'mainnet', 'halving', 'network outage', 'protocol update']
  }
};

/**
 * Classe une actualité selon les catégories dont au moins un mot-clé
 * apparaît dans le titre ou le résumé (recherche insensible à la casse).
 * @returns {string[]} liste des clés de catégories correspondantes (peut être vide)
 */
export function classifyNews(title = '', description = '') {
  const text = `${title} ${description}`.toLowerCase();
  const matches = [];
  for (const [key, category] of Object.entries(NEWS_CATEGORIES)) {
    if (category.keywords.some((kw) => text.includes(kw))) {
      matches.push(key);
    }
  }
  return matches;
}
