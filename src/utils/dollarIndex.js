// utils/dollarIndex.js
//
// Le véritable indice DXY pondère USD contre EUR (57,6%), JPY (13,6%),
// GBP (11,9%), CAD (9,1%), SEK (4,2%), CHF (3,6%). SEK n'étant pas toujours
// disponible facilement, on l'omet et on renormalise les 5 autres devises
// à 100% — une approximation, pas l'indice officiel ICE, mais qui capture
// l'essentiel du mouvement (EUR + JPY + GBP représentent déjà ~82% du panier réel).

const RAW_WEIGHTS = { EUR: 0.576, JPY: 0.136, GBP: 0.119, CAD: 0.091, CHF: 0.036 };
const WEIGHT_SUM = Object.values(RAW_WEIGHTS).reduce((a, b) => a + b, 0);
export const DOLLAR_BASKET_WEIGHTS = Object.fromEntries(
  Object.entries(RAW_WEIGHTS).map(([ccy, w]) => [ccy, w / WEIGHT_SUM])
);

export const DOLLAR_BASKET_CURRENCIES = Object.keys(DOLLAR_BASKET_WEIGHTS);

/**
 * @param {Record<string, number>} ratesToday USD->CCY du jour (ex: { EUR: 0.87, GBP: 0.75, ... })
 * @param {Record<string, number>} ratesYesterday USD->CCY de la veille, mêmes devises
 * @returns {{ compositeChangePct: number, byCurrency: Record<string, number>, direction: 'hausse'|'baisse'|'stable' }}
 */
export function computeDollarIndexChange(ratesToday, ratesYesterday) {
  const byCurrency = {};
  let compositeChangePct = 0;

  for (const ccy of DOLLAR_BASKET_CURRENCIES) {
    const today = ratesToday[ccy];
    const yesterday = ratesYesterday[ccy];
    if (!today || !yesterday) continue;

    // USD->CCY qui augmente = le dollar achète plus de devise étrangère = dollar plus fort
    const changePct = ((today - yesterday) / yesterday) * 100;
    byCurrency[ccy] = changePct;
    compositeChangePct += changePct * DOLLAR_BASKET_WEIGHTS[ccy];
  }

  let direction = 'stable';
  if (compositeChangePct > 0.05) direction = 'hausse';
  else if (compositeChangePct < -0.05) direction = 'baisse';

  return { compositeChangePct, byCurrency, direction };
}
