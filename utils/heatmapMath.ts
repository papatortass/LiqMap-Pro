
import { Candle, HeatmapSnapshot, LiquidationLevel, HeatmapBucket, HeatmapCalculationResult } from '../types';

/**
 * Calculates historical liquidation heatmaps.
 */
export const calculateHeatmapData = (
  candles: Candle[], 
  leverage: number, 
  bucketSize: number = 20 
): HeatmapCalculationResult => {
  
  let activeLevels: LiquidationLevel[] = [];
  const snapshots: HeatmapSnapshot[] = [];
  let globalMaxDensity = 0;

  // Optimization: Pre-allocate roughly to avoid resizing if possible, though JS engine handles this well.
  
  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];
    const currentPrice = candle.close;
    
    // 1. Purge triggered liquidations and "stale/far" levels to optimize performance
    // If a level is > 50% away from current price, it's irrelevant for the heatmap visuals usually
    activeLevels = activeLevels.filter(lvl => {
      // Trigger check
      if (lvl.type === 'long' && candle.low <= lvl.price) return false;
      if (lvl.type === 'short' && candle.high >= lvl.price) return false;
      
      // Distance check (Optimization)
      const dist = Math.abs(lvl.price - currentPrice) / currentPrice;
      if (dist > 0.5) return false; 

      return true;
    });

    // 2. Add NEW positions
    const entryPrice = candle.close;
    // Log scale volume to dampen massive spikes
    const intensity = Math.log10(candle.volume + 10); 

    const longLiq = entryPrice * (1 - 1.0 / leverage);
    const shortLiq = entryPrice * (1 + 1.0 / leverage);

    activeLevels.push({
      price: longLiq,
      volume: intensity,
      type: 'long',
      creationTime: candle.time
    });

    activeLevels.push({
      price: shortLiq,
      volume: intensity,
      type: 'short',
      creationTime: candle.time
    });

    // 3. Create snapshot
    const bucketMap = new Map<number, number>();

    for(const lvl of activeLevels) {
      // Round to nearest bucketSize
      const bucketPrice = Math.floor(lvl.price / bucketSize) * bucketSize;
      const currentVal = bucketMap.get(bucketPrice) || 0;
      bucketMap.set(bucketPrice, currentVal + lvl.volume);
    }

    const buckets: HeatmapBucket[] = [];
    bucketMap.forEach((density, price) => {
      if (density > globalMaxDensity) globalMaxDensity = density;
      buckets.push({ price, density });
    });

    snapshots.push({
      time: candle.time,
      buckets: buckets
    });
  }

  return { snapshots, globalMaxDensity };
};
