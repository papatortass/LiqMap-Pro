import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createChart, CandlestickSeries, IChartApi, ISeriesApi, Time, ColorType, CrosshairMode, MouseEventParams, IPriceLine, Logical } from 'lightweight-charts';
import { Candle, HeatmapSnapshot, HeatmapTheme, CrosshairData, DrawingToolType, Drawing, Timeframe, ChartPoint, DrawingStyle } from '../types';
import DrawingToolbar from './DrawingToolbar';

interface LiquidationChartProps {
  candles: Candle[];
  heatmapData: HeatmapSnapshot[];
  globalMaxDensity: number;
  noiseFilter: number;
  sensitivity: number;
  theme: HeatmapTheme;
  cloudMode: boolean; 
  localNormalization: boolean;
  timeframe: Timeframe;
  bucketSize: number;
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

const getIntervalSeconds = (tf: Timeframe): number => {
    const minute = 60;
    const hour = 60 * minute;
    const day = 24 * hour;
    
    switch(tf) {
        case '1m': return minute;
        case '3m': return 3 * minute;
        case '5m': return 5 * minute;
        case '15m': return 15 * minute;
        case '30m': return 30 * minute;
        case '1h': return hour;
        case '2h': return 2 * hour;
        case '4h': return 4 * hour;
        case '6h': return 6 * hour;
        case '8h': return 8 * hour;
        case '12h': return 12 * hour;
        case '1d': return day;
        case '3d': return 3 * day;
        case '1w': return 7 * day;
        case '1M': return 30 * day;
        default: return day;
    }
}

const LiquidationChart: React.FC<LiquidationChartProps> = ({ 
    candles, 
    heatmapData, 
    globalMaxDensity, 
    noiseFilter, 
    sensitivity, 
    theme,
    cloudMode,
    localNormalization,
    timeframe,
    bucketSize,
    onCrosshairMove
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null); 
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const priceLinesRef = useRef<Map<string, IPriceLine>>(new Map()); 

  const dimensionsRef = useRef({ width: 0, height: 0 });

  // --- DRAWING STATE ---
  const [activeTool, setActiveTool] = useState<DrawingToolType>('cursor');
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [currentDrawing, setCurrentDrawing] = useState<Drawing | null>(null); 
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  
  // This version increments whenever the chart scrolls/zooms, forcing a React re-render of SVG elements
  const [chartVersion, setChartVersion] = useState(0);

  // --- DRAWING STYLING ---
  const [toolStyle, setToolStyle] = useState<DrawingStyle>({
      color: '#3b82f6',
      lineWidth: 2,
      lineStyle: 'solid',
      fillOpacity: 0.2
  });

  // --- DELETE LISTENER ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (['Delete', 'Backspace'].includes(e.key)) {
            if (selectedDrawingId) {
                // Prevent deletion if user is typing in an input
                const activeTag = document.activeElement?.tagName.toLowerCase();
                if (activeTag === 'input' || activeTag === 'textarea') return;

                setDrawings(prev => prev.filter(d => d.id !== selectedDrawingId));
                setSelectedDrawingId(null);
            }
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDrawingId]);

  // --- COLOR LUT ---
  const colorLUT = useMemo(() => {
    const lut: string[] = [];
    const steps = 100;
    const rgbLow = parseHexToRgb(theme.low);
    const rgbMed = parseHexToRgb(theme.medium);
    const rgbHigh = parseHexToRgb(theme.high);
    const rgbExt = parseHexToRgb(theme.extreme);

    for (let i = 0; i <= steps; i++) {
        const d = i / steps; 
        let r=0, g=0, b=0, alpha=0;

        if (cloudMode) {
             alpha = 0.85; 
             if (d < 0.25) { r = rgbLow.r; g = rgbLow.g; b = rgbLow.b; }
             else if (d < 0.50) { r = rgbMed.r; g = rgbMed.g; b = rgbMed.b; }
             else if (d < 0.75) { r = rgbHigh.r; g = rgbHigh.g; b = rgbHigh.b; }
             else { r = rgbExt.r; g = rgbExt.g; b = rgbExt.b; }
        } else {
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

  // Init Chart
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
        barSpacing: 6, // Slightly wider default
      },
      rightPriceScale: {
        borderColor: '#18181b',
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#3f3f46', labelBackgroundColor: '#3f3f46' },
        horzLine: { color: '#3f3f46', labelBackgroundColor: '#3f3f46' }
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
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

    // Subscribe to chart updates to sync SVG layer
    chart.timeScale().subscribeVisibleTimeRangeChange(() => {
        setChartVersion(v => v + 1);
    });

    const resizeObserver = new ResizeObserver((entries) => {
      window.requestAnimationFrame(() => {
          if (!entries || entries.length === 0) return;
          if (!chartContainerRef.current) return;
          
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
          
          if (svgRef.current) {
              svgRef.current.setAttribute('width', width.toString());
              svgRef.current.setAttribute('height', height.toString());
          }
          setChartVersion(v => v + 1);
      });
    });

    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, []);

  // Update Candles
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
      setChartVersion(v => v + 1);
    }
  }, [candles]);

  // --- HELPERS ---
  const getChartTime = useCallback((param: MouseEventParams): number | null => {
      if (param.time) return param.time as number;
      if (param.point && chartRef.current && candles.length > 0) {
          const timeScale = chartRef.current.timeScale();
          const logical = timeScale.coordinateToLogical(param.point.x);
          if (logical !== null) {
              const lastCandle = candles[candles.length - 1];
              const lastTime = lastCandle.time;
              const lastIndex = candles.length - 1; 
              const interval = getIntervalSeconds(timeframe);
              const diffIndex = Math.round(logical) - lastIndex;
              return lastTime + (diffIndex * interval);
          }
      }
      return null;
  }, [timeframe, candles]);

  // Optimized to not depend on chartVersion directly, but uses refs
  const pointToCoordinate = useCallback((p: ChartPoint) => {
        const chart = chartRef.current;
        const series = candlestickSeriesRef.current;
        if (!chart || !series || candles.length === 0) return { x: null, y: null };

        const timeScale = chart.timeScale();
        const interval = getIntervalSeconds(timeframe);

        let x = timeScale.timeToCoordinate(p.time as Time);
        const y = series.priceToCoordinate(p.price);

        if (x === null) {
            // Handle future/whitespace logic
            const lastCandle = candles[candles.length - 1];
            const lastIndex = candles.length - 1; 
            const timeDiff = p.time - lastCandle.time;
            const steps = Math.round(timeDiff / interval);
            const targetLogical = (lastIndex + steps) as Logical;
            x = timeScale.logicalToCoordinate(targetLogical);
        }
        return { x: x as number | null, y: y as number | null };
  }, [candles, timeframe]);

  // --- INTERACTION ---
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const handleClick = (param: MouseEventParams) => {
        if (!param.point) return;
        
        // Handle deselection if in cursor mode and clicking background
        if (activeTool === 'cursor') {
            setSelectedDrawingId(null);
            return;
        }

        const series = candlestickSeriesRef.current;
        if (!series) return;
        
        const price = series.coordinateToPrice(param.point.y);
        const time = getChartTime(param);

        if (price === null || time === null) return;

        if (activeTool === 'horizontal' || activeTool === 'vertical') {
            const newDrawing: Drawing = {
                id: Math.random().toString(36).substr(2, 9),
                type: activeTool,
                points: [{ time, price }],
                style: { ...toolStyle }
            };
            setDrawings(prev => [...prev, newDrawing]);
        } 
        else {
            if (!currentDrawing) {
                setCurrentDrawing({
                    id: 'temp',
                    type: activeTool,
                    points: [{ time, price }, { time, price }], 
                    style: { ...toolStyle }
                });
            } else {
                const finalDrawing: Drawing = {
                    ...currentDrawing,
                    id: Math.random().toString(36).substr(2, 9),
                    points: [currentDrawing.points[0], { time, price }]
                };
                setDrawings(prev => [...prev, finalDrawing]);
                setCurrentDrawing(null);
            }
        }
    };

    chart.subscribeClick(handleClick);
    return () => chart.unsubscribeClick(handleClick);
  }, [activeTool, currentDrawing, getChartTime, toolStyle]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const handleMove = (param: MouseEventParams) => {
        if (onCrosshairMove) handleCrosshairMoveLegacy(param);

        if (currentDrawing && param.point) {
            const series = candlestickSeriesRef.current;
            if (!series) return;
            const price = series.coordinateToPrice(param.point.y);
            const time = getChartTime(param);
            if (price !== null && time !== null) {
                setCurrentDrawing(prev => prev ? ({
                    ...prev,
                    points: [prev.points[0], { time, price }]
                }) : null);
            }
        }
    };

    const handleCrosshairMoveLegacy = (param: MouseEventParams) => {
        if (!param.point || !param.time || param.point.x < 0 || param.point.y < 0) {
            if(onCrosshairMove) onCrosshairMove(null);
            return;
        }
        const logical = chart.timeScale().coordinateToLogical(param.point.x);
        if (logical === null) {
            if(onCrosshairMove) onCrosshairMove(null);
            return;
        }
        const index = Math.round(logical);
        if (index < 0 || index >= heatmapData.length) {
            if(onCrosshairMove) onCrosshairMove(null);
            return;
        }
        const snapshot = heatmapData[index];
        if (!snapshot) {
            if(onCrosshairMove) onCrosshairMove(null);
            return;
        }
        const series = candlestickSeriesRef.current;
        if (!series) return;
        const price = series.coordinateToPrice(param.point.y);
        if (price === null) {
            if(onCrosshairMove) onCrosshairMove(null);
            return;
        }
        
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
             if(onCrosshairMove) onCrosshairMove({
                 price: closestBucket.price,
                 density: closestBucket.density,
                 normalizedDensity: closestBucket.density / globalMaxDensity
             });
        } else {
             if(onCrosshairMove) onCrosshairMove(null);
        }
    };

    chart.subscribeCrosshairMove(handleMove);
    return () => chart.unsubscribeCrosshairMove(handleMove);
  }, [currentDrawing, heatmapData, globalMaxDensity, onCrosshairMove, getChartTime]);

  // Sync Horizontal Lines
  useEffect(() => {
    const series = candlestickSeriesRef.current;
    if (!series) return;
    const currentIds = new Set(drawings.filter(d => d.type === 'horizontal').map(d => d.id));
    for (const [id, line] of priceLinesRef.current.entries()) {
        if (!currentIds.has(id)) {
            series.removePriceLine(line);
            priceLinesRef.current.delete(id);
        }
    }
    drawings.filter(d => d.type === 'horizontal').forEach(d => {
        if (!priceLinesRef.current.has(d.id)) {
            const line = series.createPriceLine({
                price: d.points[0].price,
                color: d.style.color,
                lineWidth: d.style.lineWidth as 1|2|3|4,
                lineStyle: d.style.lineStyle === 'dashed' ? 2 : d.style.lineStyle === 'dotted' ? 3 : 0,
                axisLabelVisible: true,
                title: 'H-Line',
            });
            priceLinesRef.current.set(d.id, line);
        }
    });
  }, [drawings]);

  // --- RENDER LOOP (Heatmap) ---
  const drawHeatmap = useCallback(() => {
    const canvas = canvasRef.current;
    const chart = chartRef.current;
    const series = candlestickSeriesRef.current;
    const { width, height } = dimensionsRef.current;
    
    // 1. Heatmap Rendering
    if (canvas && chart && series && heatmapData.length > 0 && width > 0 && height > 0) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.filter = 'none';
            ctx.globalCompositeOperation = 'source-over';
            ctx.clearRect(0, 0, width, height);

            const timeScale = chart.timeScale();
            const visibleRange = timeScale.getVisibleLogicalRange();
            
            if (visibleRange) {
                const maxVisPrice = series.coordinateToPrice(0);
                const minVisPrice = series.coordinateToPrice(height);

                if (minVisPrice !== null && maxVisPrice !== null) {
                    const startIndex = Math.max(0, Math.floor(visibleRange.from));
                    const endIndex = Math.min(heatmapData.length - 1, Math.ceil(visibleRange.to));

                    let effectiveMaxDensity = globalMaxDensity;
                    if (localNormalization) {
                        let max = 0;
                        for (let i = startIndex; i <= endIndex; i++) {
                            const snapshot = heatmapData[i];
                            if (!snapshot) continue;
                            for(const b of snapshot.buckets) {
                                if (b.price >= minVisPrice && b.price <= maxVisPrice) {
                                    if(b.density > max) max = b.density;
                                }
                            }
                        }
                        if (max > 0) effectiveMaxDensity = max;
                    }

                    const barWidth = timeScale.options().barSpacing;
                    const rectWidth = Math.max(1, Math.ceil(barWidth)); 
                    const striding = rectWidth < 1 ? Math.ceil(1 / rectWidth) : 1;
                    
                    for (let i = startIndex; i <= endIndex; i += striding) {
                        const snapshot = heatmapData[i];
                        if (!snapshot) continue;

                        const x = Math.round(timeScale.logicalToCoordinate(i as Logical) as number);
                        if (x < -rectWidth || x > width + rectWidth) continue; 

                        const buckets = snapshot.buckets;
                        for (let j = 0; j < buckets.length; j++) {
                            const bucket = buckets[j];
                            if (bucket.price < minVisPrice || bucket.price > maxVisPrice) continue;
                            const rawNormalizedDensity = bucket.density / effectiveMaxDensity;
                            if (rawNormalizedDensity < noiseFilter) continue;

                            let effectiveDensity = rawNormalizedDensity * sensitivity;
                            if (effectiveDensity > 1) effectiveDensity = 1;

                            const lutIndex = Math.floor(effectiveDensity * 100);
                            ctx.fillStyle = colorLUT[lutIndex] || theme.low;

                            const yBottom = series.priceToCoordinate(bucket.price);
                            const yTop = series.priceToCoordinate(bucket.price + bucketSize);
                            
                            const h = (yBottom ?? 0) - (yTop ?? 0);
                            const y = yTop ?? 0;

                            if (yBottom !== null && yTop !== null) {
                                ctx.fillRect(x - rectWidth/2, y, rectWidth, Math.max(1, h));
                            }
                        }
                    }
                }
            }
        }
    }
  }, [heatmapData, globalMaxDensity, noiseFilter, sensitivity, theme, cloudMode, localNormalization, bucketSize, colorLUT]);

  useEffect(() => {
    let animationFrameId: number;
    const render = () => {
        drawHeatmap();
        animationFrameId = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [drawHeatmap]);

  // --- SVG ELEMENT GENERATION (Memoized, Synced with Render Pass) ---
  const svgElements = useMemo(() => {
    const elements: React.ReactNode[] = [];
    const { width, height } = dimensionsRef.current;
    
    // Check required refs but don't crash if they aren't ready
    if (!chartRef.current || !candlestickSeriesRef.current || width === 0) return elements;

    const allDrawings = [...drawings, ...(currentDrawing ? [currentDrawing] : [])];

    allDrawings.forEach(d => {
        if (d.type === 'horizontal') return; 

        const isSelected = d.id === selectedDrawingId;
        const isCurrent = d.id === 'temp' || d.id === currentDrawing?.id;
        
        const groupProps = {
            key: d.id,
            onClick: (e: React.MouseEvent) => {
                if (activeTool === 'cursor' && !isCurrent) {
                    e.stopPropagation();
                    setSelectedDrawingId(d.id);
                }
            },
            style: { 
                cursor: activeTool === 'cursor' ? 'pointer' : 'crosshair',
                pointerEvents: (activeTool === 'cursor' && !isCurrent) ? 'visiblePainted' : 'none',
                filter: isSelected ? 'drop-shadow(0 0 3px white)' : 'none',
                transition: 'filter 0.2s ease'
            } as React.CSSProperties
        };

        const p1 = d.points[0];
        const { x: x1, y: y1 } = pointToCoordinate(p1);
        const { color, lineWidth, lineStyle, fillOpacity } = d.style;
        const dashArray = lineStyle === 'dashed' ? '6 6' : lineStyle === 'dotted' ? '2 4' : 'none';

        if (d.type === 'vertical' && x1 !== null) {
            elements.push(
                <g {...groupProps}>
                    <line x1={x1} y1={0} x2={x1} y2={height} stroke={color} strokeWidth={lineWidth} strokeDasharray={dashArray} />
                </g>
            );
            return;
        }

        if (d.points.length < 2) return;
        const p2 = d.points[1];
        const { x: x2, y: y2 } = pointToCoordinate(p2);

        if (x1 === null || y1 === null || x2 === null || y2 === null) return;

        if (d.type === 'trend') {
            elements.push(
                <g {...groupProps}>
                    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={Math.max(10, lineWidth * 3)} />
                    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={lineWidth} strokeDasharray={dashArray} />
                </g>
            );
        } 
        else if (d.type === 'ray') {
            let xExt = x2, yExt = y2;
            if (x2 !== x1) {
                const slope = (y2 - y1) / (x2 - x1);
                xExt = x2 > x1 ? width : 0;
                yExt = y1 + slope * (xExt - x1);
            }
            elements.push(
                <g {...groupProps}>
                    <line x1={x1} y1={y1} x2={xExt} y2={yExt} stroke="transparent" strokeWidth={Math.max(10, lineWidth * 3)} />
                    <line x1={x1} y1={y1} x2={xExt} y2={yExt} stroke={color} strokeWidth={lineWidth} strokeDasharray={dashArray} />
                </g>
            );
        }
        else if (d.type === 'arrow') {
             elements.push(
                <g {...groupProps}>
                     <defs>
                        <marker id={`head-${d.id}`} markerWidth="4" markerHeight="4" refX="2" refY="2" orient="auto">
                            <path d="M0,0 L0,4 L4,2 z" fill={color} />
                        </marker>
                     </defs>
                     <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={Math.max(10, lineWidth * 3)} />
                     <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={lineWidth} strokeDasharray={dashArray} markerEnd={`url(#head-${d.id})`} />
                </g>
             );
        }
        else if (d.type === 'rectangle') {
            const w = Math.abs(x2 - x1);
            const h = Math.abs(y2 - y1);
            elements.push(
                <g {...groupProps}>
                    <rect x={Math.min(x1, x2)} y={Math.min(y1, y2)} width={w} height={h} fill={color} fillOpacity={fillOpacity} stroke={color} strokeWidth={lineWidth} strokeDasharray={dashArray} />
                </g>
            );
        }
        else if (d.type === 'circle') {
             const cx = (x1 + x2) / 2;
             const cy = (y1 + y2) / 2;
             const rx = Math.abs(x2 - x1) / 2;
             const ry = Math.abs(y2 - y1) / 2;
             elements.push(
                <g {...groupProps}>
                     <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={color} fillOpacity={fillOpacity} stroke={color} strokeWidth={lineWidth} strokeDasharray={dashArray} />
                </g>
             );
        }
        else if (d.type === 'fib') {
            const dy = y2 - y1;
            const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
            elements.push(
                <g {...groupProps}>
                    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeDasharray="2 2" strokeOpacity={0.5} />
                    {levels.map(lvl => {
                        const yLvl = y1 + dy * lvl;
                        return (
                            <React.Fragment key={lvl}>
                                <line x1={Math.min(x1, x2)} y1={yLvl} x2={Math.max(x1, x2)} y2={yLvl} stroke={color} strokeWidth={1} />
                                <text x={Math.min(x1, x2)} y={yLvl - 2} fill={color} fontSize="10">{lvl}</text>
                            </React.Fragment>
                        )
                    })}
                     <rect x={Math.min(x1, x2)} y={Math.min(y1, y2)} width={Math.abs(x2 - x1)} height={Math.abs(y2 - y1)} fill="transparent" />
                </g>
            );
        }
        else if (d.type === 'ruler') {
            const width = Math.abs(x2 - x1);
            const height = Math.abs(y2 - y1);
            const x = Math.min(x1, x2);
            const y = Math.min(y1, y2);
            
            const priceDiff = p2.price - p1.price;
            const percent = (priceDiff / p1.price) * 100;
            const isPositive = percent >= 0;
            const sign = isPositive ? '+' : '';
            const rulerColor = isPositive ? '#10b981' : '#ef4444';
            const bg = isPositive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';
            const border = isPositive ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)';

            const text = `${sign}${percent.toFixed(2)}% (${priceDiff.toFixed(2)})`;
            elements.push(
                <g {...groupProps}>
                    <rect x={x} y={y} width={width} height={height} fill={bg} stroke={border} strokeDasharray="4 2" />
                    <g transform={`translate(${x + width/2}, ${y + height/2})`}>
                        <rect x="-70" y="-12" width="140" height="24" rx="4" fill="#18181b" stroke={border} strokeWidth={1} />
                        <text x="0" y="4" textAnchor="middle" fill={rulerColor} fontSize="11" fontFamily="monospace" fontWeight="bold" style={{ pointerEvents: 'none' }}>{text}</text>
                    </g>
                </g>
            );
        }
    });

    return elements;
  }, [drawings, currentDrawing, chartVersion, pointToCoordinate, activeTool, selectedDrawingId]);

  return (
    <div ref={chartContainerRef} className="relative w-full h-full">
      <canvas ref={canvasRef} className="absolute inset-0 z-10 pointer-events-none" />
      <svg ref={svgRef} className="absolute inset-0 z-20 pointer-events-none overflow-visible">
         {svgElements}
      </svg>
      <DrawingToolbar 
         activeTool={activeTool}
         setTool={setActiveTool}
         onClear={() => setDrawings([])}
         hasDrawings={drawings.length > 0}
         currentStyle={toolStyle}
         setStyle={setToolStyle}
      />
    </div>
  );
};

export default LiquidationChart;