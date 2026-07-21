// utils/newsKeywords.js
//
// Détection HEURISTIQUE par mots-clés — pas une analyse de sentiment par IA.
// Catégories construites pour couvrir les facteurs fondamentaux détectables
// par du texte d'actualité (Fed, régulation, géopolitique, élections,
// croissance...). Les facteurs qui demandent de vraies données chiffrées
// (liquidité M2 précise, offre/demande on-chain, sentiment quantifié type
// indice Fear & Greed) ne sont couverts qu'approximativement ici — une vraie
// mesure demanderait de connecter des API de données, pas juste du texte.
//
// Une actualité peut correspondre à plusieurs catégories à la fois.

export const NEWS_CATEGORIES = {
  politique_monetaire: {
    label: 'Politique monétaire',
    color: '#a78bfa', // violet
    keywords: [
      'fed', 'fomc', 'interest rate', 'rate cut', 'rate hike', 'central bank',
      'ecb', 'boj', 'quantitative easing', 'balance sheet', 'money supply',
      'liquidity', 'powell', 'lagarde', 'monetary policy'
    ]
  },
  dedollarisation: {
    label: 'Dollar & dé-dollarisation',
    color: '#38bdf8', // bleu clair
    keywords: [
      'dedollarization', 'de-dollarization', 'dollar index', 'dxy',
      'gold reserves', 'central bank buying', 'yuan', 'brics',
      'reserve currency', 'dollar weakness', 'dollar strength'
    ]
  },
  inflation_deficits: {
    label: 'Inflation & déficits',
    color: '#d4a24c', // doré
    keywords: [
      'inflation', 'cpi', 'ppi', 'deficit', 'national debt', 'treasury yield',
      'bond yield', 'fiscal deficit', 'debt ceiling'
    ]
  },
  geopolitique: {
    label: 'Géopolitique & énergie',
    color: '#fb923c', // orange
    keywords: [
      'war', 'conflict', 'sanctions', 'oil price', 'opec', 'middle east',
      'geopolitical', 'tariff', 'trade war', 'ukraine', 'ceasefire'
    ]
  },
  reglementation: {
    label: 'Réglementation',
    color: '#c084fc', // violet clair
    keywords: [
      'sec', 'regulation', 'regulatory', 'clarity act', 'mica', 'lawsuit',
      'court', 'ban', 'legal', 'compliance', 'cftc', 'law'
    ]
  },
  institutionnel: {
    label: 'Institutionnel / ETF',
    color: '#0ea5e9', // bleu ciel — distinct du vert ACHAT
    keywords: [
      'etf', 'institutional', 'blackrock', 'fidelity', 'adoption', 'ipo',
      'corporate treasury', 'pension fund', 'fund inflow'
    ]
  },
  cycle_narrative: {
    label: 'Cycle & narrative',
    color: '#f472b6', // rose
    keywords: [
      'halving', 'digital gold', 'store of value', 'risk-on', 'risk asset',
      'correlation', 'nasdaq', 'decoupling'
    ]
  },
  politique_fiscale: {
    label: 'Politique fiscale & élections',
    color: '#818cf8', // indigo
    keywords: [
      'midterm', 'midterms', 'election', 'congress', 'senate',
      'house of representatives', 'fiscal policy', 'tax reform',
      'government shutdown'
    ]
  },
  croissance_recession: {
    label: 'Croissance & récession',
    color: '#94a3b8', // gris-bleu
    keywords: [
      'gdp', 'recession', 'soft landing', 'hard landing', 'pmi',
      'unemployment', 'jobs report', 'economic growth', 'payrolls'
    ]
  },
  sentiment_marche: {
    label: 'Sentiment de marché',
    color: '#facc15', // jaune
    keywords: [
      'risk-off', 'risk aversion', 'volatility', 'vix', 'flight to safety',
      'panic selling', 'fear and greed', 'market sentiment'
    ]
  },
  securite: {
    label: 'Sécurité',
    color: '#fb7185', // rose-rouge, distinct du rouge VENTE
    keywords: [
      'hack', 'exploit', 'breach', 'stolen', 'vulnerability', 'scam',
      'rug pull', 'phishing'
    ]
  },
  offre_demande: {
    label: 'Offre / demande on-chain',
    color: '#2dd4bf', // teal
    keywords: [
      'miner', 'mining', 'exchange reserves', 'supply shock', 'whale',
      'accumulation', 'outflow', 'inflow', 'exchange balance'
    ]
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
