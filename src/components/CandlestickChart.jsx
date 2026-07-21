import React from 'react';
import { useCandleSeries } from '../hooks/useCandleSeries.js';

const CHART_HEIGHT = 220;
const CHART_WIDTH = 600; // viewBox interne, le SVG est ensuite responsive via width="100%"
const PADDING_TOP = 12;
const PADDING_BOTTOM = 24;
const PADDING_LEFT = 4;
const PADDING_RIGHT = 4;

function formatPrice(p) {
  return p.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export default function CandlestickChart({ symbol, interval, limit = 60 }) {
  const { candles, status, errorMessage } = useCandleSeries(symbol, interval, limit);

  if (status === 'error') {
    return <div className="error-banner">Erreur graphique : {errorMessage}</div>;
  }

  if (candles.length === 0) {
    return <div className="muted-note">Chargement du graphique…</div>;
  }

  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const priceMax = Math.max(...highs);
  const priceMin = Math.min(...lows);
  const priceRange = priceMax - priceMin || 1;

  const plotHeight = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const plotWidth = CHART_WIDTH - PADDING_LEFT - PADDING_RIGHT;
  const candleSlot = plotWidth / candles.length;
  const candleBodyWidth = Math.max(candleSlot * 0.55, 1.5);

  const scaleY = (price) => PADDING_TOP + (1 - (price - priceMin) / priceRange) * plotHeight;

  const lastCandle = candles[candles.length - 1];
  const firstTime = candles[0].time;
  const midTime = candles[Math.floor(candles.length / 2)].time;
  const lastTime = lastCandle.time;

  return (
    <div className="candlestick-wrap">
      <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} width="100%" height={CHART_HEIGHT} preserveAspectRatio="none">
        {/* Repères de prix horizontaux */}
        {[priceMax, (priceMax + priceMin) / 2, priceMin].map((p, i) => (
          <g key={i}>
            <line
              x1={PADDING_LEFT}
              x2={CHART_WIDTH - PADDING_RIGHT}
              y1={scaleY(p)}
              y2={scaleY(p)}
              stroke="#223049"
              strokeDasharray="3 3"
              strokeWidth={1}
            />
            <text x={CHART_WIDTH - PADDING_RIGHT} y={scaleY(p) - 3} fill="#7c8aa5" fontSize="9" textAnchor="end">
              {formatPrice(p)}
            </text>
          </g>
        ))}

        {/* Chandeliers */}
        {candles.map((c, i) => {
          const x = PADDING_LEFT + i * candleSlot + candleSlot / 2;
          const isBullish = c.close >= c.open;
          const color = isBullish ? '#34d399' : '#f87171';
          const bodyTop = scaleY(Math.max(c.open, c.close));
          const bodyBottom = scaleY(Math.min(c.open, c.close));
          const bodyHeight = Math.max(bodyBottom - bodyTop, 1);

          return (
            <g key={c.time}>
              <line x1={x} x2={x} y1={scaleY(c.high)} y2={scaleY(c.low)} stroke={color} strokeWidth={1} />
              <rect
                x={x - candleBodyWidth / 2}
                y={bodyTop}
                width={candleBodyWidth}
                height={bodyHeight}
                fill={color}
              />
            </g>
          );
        })}

        {/* Repères de temps */}
        <text x={PADDING_LEFT} y={CHART_HEIGHT - 6} fill="#7c8aa5" fontSize="9">
          {formatTime(firstTime)}
        </text>
        <text x={CHART_WIDTH / 2} y={CHART_HEIGHT - 6} fill="#7c8aa5" fontSize="9" textAnchor="middle">
          {formatTime(midTime)}
        </text>
        <text x={CHART_WIDTH - PADDING_RIGHT} y={CHART_HEIGHT - 6} fill="#7c8aa5" fontSize="9" textAnchor="end">
          {formatTime(lastTime)}
        </text>
      </svg>
    </div>
  );
}
