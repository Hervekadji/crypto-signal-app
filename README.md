# Signal Board — Alertes crypto (React)

App React qui surveille BTC/USDT et ETH/USDT via l'API publique Binance et
affiche un signal ACHAT / VENTE / NEUTRE basé sur la confluence de 3
indicateurs (aucun ordre n'est jamais passé — c'est un outil d'alerte).

## Logique du signal

Chaque indicateur "vote" +1 (haussier), -1 (baissier) ou 0 (neutre) :

- **SMA 9/21** : croisement de moyennes mobiles
- **RSI (14)** : survente < 30 (haussier), surachat > 70 (baissier)
- **MACD (12,26,9)** : histogramme positif (haussier) / négatif (baissier)

Score final = somme des votes.
- score ≥ +2 → **ACHAT**
- score ≤ -2 → **VENTE**
- sinon → **NEUTRE**

Une alerte n'est journalisée que lors d'un **changement** de signal, pas à
chaque rafraîchissement, pour éviter le bruit.

## Installation

```bash
npm install
npm run dev
```

L'app est servie sur http://localhost:5173

## Personnalisation rapide

- **Ajouter une paire** : modifier le tableau `PAIRS` dans `src/App.jsx`.
- **Changer les seuils de confluence** : `computeSignal()` dans
  `src/utils/indicators.js` (actuellement |score| ≥ 2).
- **Fréquence de rafraîchissement** : paramètre `pollMs` du hook
  `useCryptoSignals` (30 000 ms par défaut). Attention à ne pas descendre
  trop bas — l'API Binance publique a des limites de taux par IP.
- **Notifications navigateur** : le tableau `alerts` dans `useCryptoSignals`
  contient déjà tout ce qu'il faut ; il suffit de brancher l'API
  `Notification` du navigateur sur l'apparition d'une nouvelle entrée.

## Déploiement

Ce projet se déploie comme n'importe quelle app Vite statique
(`npm run build` puis dossier `dist/`) — Vercel, Netlify, GitHub Pages, ou
Streamlit si tu préfères garder tout dans le même écosystème que ton bot
existant en le servant en iframe.

## Limite importante

Les signaux sont purement indicatifs, à but d'apprentissage technique.
Aucune stratégie basée sur SMA/RSI/MACD ne garantit un résultat sur les
marchés crypto, qui sont très volatils.
