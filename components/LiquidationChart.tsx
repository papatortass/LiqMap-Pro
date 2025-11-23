
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createChart, CandlestickSeries, IChartApi, ISeriesApi, Time, ColorType, CrosshairMode, MouseEventParams } from 'lightweight-charts';
import { Candle, HeatmapSnapshot, HeatmapTheme, CrosshairData } from '../types';

interface LiquidationChartProps {
  candles: Candle[];
  heatmapData: HeatmapSnapshot[];
  globalMaxDensity: number;
  noiseFilter: number;
  sensitivity: number;
  theme: HeatmapTheme;
  cloudMode: boolean; 
  localNormalization: boolean;
  onCrosshairMove?: (data: CrosshairData | null) => void;
}

const parseHexToRgb = (hex: string) => {
    hex = hex.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return { 
        r: isNaN(r) ? 0 : r, 
        g: isNaN(g) ? 0 : g, 
        b: isNaN(b) ? 0 : b 
    };
};

const LiquidationChart: React.FC<LiquidationChartProps> = ({ 
    candles, 
    heatmapData, 
    globalMaxDensity, 
    noiseFilter, 
    sensitivity, 
    theme,
    cloudMode,
    localNormalization,
    onCrosshairMove
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  
  const dimensionsRef = useRef({ width: 0, height: 0 });

  // --- OPTIMIZATION: COLOR LOOK-UP TABLE (LUT) ---
  const colorLUT = useMemo(() => {
    const lut: string[] = [];
    const steps = 100;

    const rgbLow = parseHexToRgb(theme.low);
    const rgbMed = parseHexToRgb(theme.medium);
    const rgbHigh = parseHexToRgb(theme.high);
    const rgbExt = parseHexToRgb(theme.extreme);

    for (let i = 0; i <= steps; i++) {
        const d = i / steps; // Normalized density 0-1
        
        let r=0, g=0, b=0, alpha=0;

        if (cloudMode) {
             // --- MESH / CLOUD MODE (Stepped/Banded Colors) ---
             // To look like the reference image, we need distinct "bands" of color.
             // We snap the density to specific tiers instead of interpolating smoothly.
             alpha = 0.85; // High opacity for vibrant, solid look

             if (d < 0.25) {
                 // Band 1: Low
                 r = rgbLow.r; g = rgbLow.g; b = rgbLow.b;
             } else if (d < 0.50) {
                 // Band 2: Medium
                 r = rgbMed.r; g = rgbMed.g; b = rgbMed.b;
             } else if (d < 0.75) {
                 // Band 3: High
                 r = rgbHigh.r; g = rgbHigh.g; b = rgbHigh.b;
             } else {
                 // Band 4: Extreme
                 r = rgbExt.r; g = rgbExt.g; b = rgbExt.b;
             }
        } else {
             // --- STANDARD MODE (Smooth Gradients) ---
             // Smooth transitions with variable opacity
             alpha = 0.2 + (d * 0.8);
             
             if (d < 0.33) {
                const factor = d / 0.33;
                r = rgbLow.r + (rgbMed.r - rgbLow.r) * factor;
                g = rgbLow.g + (rgbMed.g - rgbLow.g) * factor;
                b = rgbLow.b + (rgbMed.b - rgbLow.b) * factor;
            } else if (d < 0.66) {
                const factor = (d - 0.33) / 0.33;
                r = rgbMed.r + (rgbHigh.r - rgbMed.r) * factor;
                g = rgbMed.g + (rgbHigh.g - rgbMed.g) * factor;
                b = rgbMed.b + (rgbHigh.b - rgbMed.b) * factor;
            } else {
                const factor = (d - 0.66) / 0.34;
                r = rgbHigh.r + (rgbExt.r - rgbHigh.r) * factor;
                g = rgbHigh.g + (rgbExt.g - rgbHigh.g) * factor;
                b = rgbHigh.b + (rgbExt.b - rgbHigh.b) * factor;
            }
        }

        lut.push(`rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${alpha.toFixed(2)})`);
    }
    return lut;
  }, [theme, cloudMode]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#050505' }, 
        textColor: '#52525b', 
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.03)' }, 
        horzLines: { color: 'rgba(255, 255, 255, 0.03)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      timeScale: {
        borderColor: '#18181b',
        timeVisible: true,
      },
      rightPriceScale: {
        borderColor: '#18181b',
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#3f3f46', labelBackgroundColor: '#3f3f46' },
        horzLine: { color: '#3f3f46', labelBackgroundColor: '#3f3f46' }
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981', 
      downColor: '#ef4444', 
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    chartRef.current = chart;
    candlestickSeriesRef.current = series;

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      
      dimensionsRef.current = { width, height };

      if (chartRef.current) {
        chartRef.current.applyOptions({ width, height });
      }

      if (canvasRef.current) {
        const dpr = window.devicePixelRatio || 1;
        canvasRef.current.width = width * dpr;
        canvasRef.current.height = height * dpr;
        canvasRef.current.style.width = `${width}px`;
        canvasRef.current.style.height = `${height}px`;
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) ctx.scale(dpr, dpr);
      }
    });

    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, []);

  useEffect(() => {
    if (candlestickSeriesRef.current && candles.length > 0) {
      const formattedData = candles.map(c => ({
        time: c.time as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close
      }));
      candlestickSeriesRef.current.setData(formattedData);
    }
  }, [candles]);

  const drawHeatmap = useCallback(() => {
    const canvas = canvasRef.current;
    const chart = chartRef.current;
    const series = candlestickSeriesRef.current;
    const { width, height } = dimensionsRef.current;
    
    if (!canvas || !chart || !series || heatmapData.length === 0) return;
    if (width === 0 || height === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.filter = 'none';
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, width, height);

    const timeScale = chart.timeScale();
    const visibleRange = timeScale.getVisibleLogicalRange();
    
    if (!visibleRange) return;

    const maxVisPrice = series.coordinateToPrice(0);
    const minVisPrice = series.coordinateToPrice(height);

    if (minVisPrice === null || maxVisPrice === null) return;

    const startIndex = Math.max(0, Math.floor(visibleRange.from));
    const endIndex = Math.min(heatmapData.length - 1, Math.ceil(visibleRange.to));

    // Calculate Local Max if enabled
    let effectiveMaxDensity = globalMaxDensity;
    if (localNormalization) {
        let max = 0;
        for (let i = startIndex; i <= endIndex; i++) {
            const snapshot = heatmapData[i];
            if (!snapshot) continue;
            for(const b of snapshot.buckets) {
                // Only consider buckets visible in price range for true local scaling? 
                // Or just time column scaling? Time column scaling is faster and more stable.
                // But typically "auto-scale" means fitting the colors to what's visible.
                if (b.price >= minVisPrice && b.price <= maxVisPrice) {
                    if(b.density > max) max = b.density;
                }
            }
        }
        if (max > 0) effectiveMaxDensity = max;
    }

    const barWidth = timeScale.options().barSpacing;
    const rectWidth = Math.max(1, Math.ceil(barWidth)); 
    const canvasWidth = canvas.width;

    for (let i = startIndex; i <= endIndex; i++) {
      const snapshot = heatmapData[i];
      if (!snapshot) continue;

      const x = Math.round(timeScale.logicalToCoordinate(i) as number);
      if (x < -rectWidth || x > canvasWidth + rectWidth) continue;

      const buckets = snapshot.buckets;
      const bucketCount = buckets.length;

      for (let j = 0; j < bucketCount; j++) {
        const bucket = buckets[j];
        
        if (bucket.price < minVisPrice || bucket.price > maxVisPrice) continue;

        const rawNormalizedDensity = bucket.density / effectiveMaxDensity;
        
        if (rawNormalizedDensity < noiseFilter) continue;

        let effectiveDensity = rawNormalizedDensity * sensitivity;
        if (effectiveDensity > 1) effectiveDensity = 1;

        const lutIndex = Math.floor(effectiveDensity * 100);
        ctx.fillStyle = colorLUT[lutIndex];

        const y = Math.round(series.priceToCoordinate(bucket.price) as number);
        
        if (cloudMode) {
             // --- MESH GRID EFFECT ---
             const meshGap = 0.5; 
             const blockHeight = 4; 
             ctx.fillRect(x - rectWidth/2, y - blockHeight/2, rectWidth - meshGap, blockHeight - meshGap);
        } else {
             // Standard Mode
             ctx.fillRect(x - rectWidth / 2, y - 2, rectWidth, 4);
        }
      }
    }

  }, [heatmapData, globalMaxDensity, noiseFilter, sensitivity, theme, cloudMode, colorLUT, localNormalization]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    let animationFrameId: number;

    const renderLoop = () => {
        drawHeatmap();
        animationFrameId = requestAnimationFrame(renderLoop);
    };

    animationFrameId = requestAnimationFrame(renderLoop);
    
    // Crosshair Handler
    const handleCrosshairMove = (param: MouseEventParams) => {
        if (!onCrosshairMove) return;
        
        if (!param.point || !param.time || param.point.x < 0 || param.point.y < 0) {
            onCrosshairMove(null);
            return;
        }

        const logical = chart.timeScale().coordinateToLogical(param.point.x);
        if (logical === null) {
            onCrosshairMove(null);
            return;
        }

        const index = Math.round(logical);
        if (index < 0 || index >= heatmapData.length) {
            onCrosshairMove(null);
            return;
        }

        const snapshot = heatmapData[index];
        if (!snapshot) {
            onCrosshairMove(null);
            return;
        }

        const series = candlestickSeriesRef.current;
        if (!series) return;

        const price = series.coordinateToPrice(param.point.y);
        if (price === null) {
            onCrosshairMove(null);
            return;
        }

        // Find closest bucket
        let closestBucket = null;
        let minDiff = Infinity;

        for (const b of snapshot.buckets) {
            const diff = Math.abs(b.price - price);
            if (diff < minDiff) {
                minDiff = diff;
                closestBucket = b;
            }
        }

        if (closestBucket) {
             // Normalize based on global max for consistency in HUD unless local norm is extremely obvious?
             // App shows a gradient bar "normalizedDensity". 
             // If localNormalization is on, the view changes. The HUD should probably reflect that.
             // But re-calculating the exact local max used in the render loop is tricky here efficiently.
             // We will use Global Max for the HUD stats to keep it stable, or simple normalization.
             onCrosshairMove({
                 price: closestBucket.price,
                 density: closestBucket.density,
                 normalizedDensity: closestBucket.density / globalMaxDensity
             });
        } else {
             onCrosshairMove(null);
        }
    };

    chart.subscribeCrosshairMove(handleCrosshairMove);

    return () => {
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, [drawHeatmap, heatmapData, globalMaxDensity, onCrosshairMove]);

  return (
    <div className="relative w-full h-full flex-grow">
      <div ref={chartContainerRef} className="absolute inset-0 z-10" />
      <canvas ref={canvasRef} className="absolute inset-0 z-20 pointer-events-none" />
      
      {candles.length === 0 && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#050505]/80 backdrop-blur-sm text-white">
          <div className="flex flex-col items-center animate-pulse">
            <span className="text-xs font-mono tracking-[0.2em] text-blue-500">INITIALIZING TERMINAL...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiquidationChart;
