import React from 'react';
import { useCandleSeries } from '../hooks/useCandleSeries.js';

const CHART_WIDTH = 600; // viewBox interne, le SVG est ensuite responsive via width="100%"
const PRICE_HEIGHT = 190;
const VOLUME_HEIGHT = 60;
const SECTION_GAP = 6;
const BOTTOM_LABELS_HEIGHT = 20;
const TOTAL_HEIGHT = PRICE_HEIGHT + SECTION_GAP + VOLUME_HEIGHT + BOTTOM_LABELS_HEIGHT;

const PADDING_TOP = 12;
const PADDING_LEFT = 4;
const PADDING_RIGHT = 4;

function formatPrice(p) {
  return p.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatVolume(v) {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return v.toFixed(1);
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
  const volumes = candles.map((c) => c.volume || 0);
  const priceMax = Math.max(...highs);
  const priceMin = Math.min(...lows);
  const priceRange = priceMax - priceMin || 1;
  const volumeMax = Math.max(...volumes) || 1;

  const pricePlotHeight = PRICE_HEIGHT - PADDING_TOP;
  const plotWidth = CHART_WIDTH - PADDING_LEFT - PADDING_RIGHT;
  const candleSlot = plotWidth / candles.length;
  const candleBodyWidth = Math.max(candleSlot * 0.55, 1.5);

  const scaleY = (price) => PADDING_TOP + (1 - (price - priceMin) / priceRange) * pricePlotHeight;

  const volumeTop = PRICE_HEIGHT + SECTION_GAP;
  const scaleVolumeHeight = (vol) => (vol / volumeMax) * VOLUME_HEIGHT;
  const labelsY = volumeTop + VOLUME_HEIGHT + 14;

  const firstTime = candles[0].time;
  const midTime = candles[Math.floor(candles.length / 2)].time;
  const lastTime = candles[candles.length - 1].time;

  return (
    <div className="candlestick-wrap">
      <svg viewBox={`0 0 ${CHART_WIDTH} ${TOTAL_HEIGHT}`} width="100%" height={TOTAL_HEIGHT} preserveAspectRatio="none">
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
              <rect x={x - candleBodyWidth / 2} y={bodyTop} width={candleBodyWidth} height={bodyHeight} fill={color} />
            </g>
          );
        })}

        {/* Séparateur entre prix et volume */}
        <line
          x1={PADDING_LEFT}
          x2={CHART_WIDTH - PADDING_RIGHT}
          y1={PRICE_HEIGHT}
          y2={PRICE_HEIGHT}
          stroke="#223049"
          strokeWidth={1}
        />

        <text x={CHART_WIDTH - PADDING_RIGHT} y={volumeTop + 8} fill="#7c8aa5" fontSize="9" textAnchor="end">
          {formatVolume(volumeMax)}
        </text>

        {/* Barres de volume */}
        {candles.map((c, i) => {
          const x = PADDING_LEFT + i * candleSlot + candleSlot / 2;
          const isBullish = c.close >= c.open;
          const color = isBullish ? '#34d399' : '#f87171';
          const barHeight = Math.max(scaleVolumeHeight(c.volume || 0), 1);

          return (
            <rect
              key={c.time}
              x={x - candleBodyWidth / 2}
              y={volumeTop + VOLUME_HEIGHT - barHeight}
              width={candleBodyWidth}
              height={barHeight}
              fill={color}
              opacity={0.65}
            />
          );
        })}

        {/* Repères de temps */}
        <text x={PADDING_LEFT} y={labelsY} fill="#7c8aa5" fontSize="9">
          {formatTime(firstTime)}
        </text>
        <text x={CHART_WIDTH / 2} y={labelsY} fill="#7c8aa5" fontSize="9" textAnchor="middle">
          {formatTime(midTime)}
        </text>
        <text x={CHART_WIDTH - PADDING_RIGHT} y={labelsY} fill="#7c8aa5" fontSize="9" textAnchor="end">
          {formatTime(lastTime)}
        </text>
      </svg>
    </div>
  );
}
