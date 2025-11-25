
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

const LiquidationChart: React.FC<LiquidationChartProps> = React.memo(({ 
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
  const [isDrawingsLocked, setIsDrawingsLocked] = useState<boolean>(false);
  
  // Refs for RAF loop access
  const drawingsStateRef = useRef(drawings);
  const currentDrawingStateRef = useRef(currentDrawing);

  useEffect(() => { drawingsStateRef.current = drawings; }, [drawings]);
  useEffect(() => { currentDrawingStateRef.current = currentDrawing; }, [currentDrawing]);
  
  // Dragging State for Move Tool
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragStartPos = useRef<{ x: number, y: number } | null>(null);
  const dragStartDrawingRef = useRef<Drawing | null>(null);
  const drawingRefs = useRef<Map<string, SVGGElement>>(new Map());

  // Resizing State
  const resizingHandleIndexRef = useRef<number | null>(null);

  // High-performance Brush Refs
  const activeBrushRef = useRef<SVGPolylineElement>(null);
  const activeBrushPointsRef = useRef<ChartPoint[]>([]);
  
  // Track mouse button state for dragging/brushing
  const isMouseDown = useRef(false);

  // --- DRAWING STYLING ---
  const [toolStyle, setToolStyle] = useState<DrawingStyle>({
      color: '#3b82f6',
      lineWidth: 2,
      lineStyle: 'solid',
      fillOpacity: 0.2
  });

  // Calculate style to pass to toolbar (Selection > Default)
  const selectedDrawing = drawings.find(d => d.id === selectedDrawingId);
  const effectiveStyle = selectedDrawing ? selectedDrawing.style : toolStyle;
  const effectiveToolType = selectedDrawing ? selectedDrawing.type : activeTool;

  const handleStyleChange = (newStyle: DrawingStyle) => {
      // 1. Always update the global tool style preference
      setToolStyle(newStyle);

      // 2. If a drawing is selected, update that specific drawing's style immediately
      if (selectedDrawingId) {
          setDrawings(prev => prev.map(d => 
              d.id === selectedDrawingId ? { ...d, style: newStyle } : d
          ));
      }
  };

  // --- LOCK TOGGLE HANDLER ---
  const toggleLock = useCallback(() => {
    setIsDrawingsLocked(prev => {
        const nextState = !prev;
        if (nextState) {
            // If locking, deselect everything immediately
            setSelectedDrawingId(null);
            setDraggingId(null);
            setCurrentDrawing(null);
            resizingHandleIndexRef.current = null;
        }
        return nextState;
    });
  }, []);

  // --- KEYBOARD SHORTCUTS & DELETION ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        // Prevent shortcuts if user is typing in an input
        const activeTag = document.activeElement?.tagName.toLowerCase();
        if (activeTag === 'input' || activeTag === 'textarea') return;

        // Deletion
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (selectedDrawingId && !isDrawingsLocked) {
                setDrawings(prev => prev.filter(d => d.id !== selectedDrawingId));
                setSelectedDrawingId(null);
            }
            return;
        }

        // Tool Shortcuts
        const key = e.key.toLowerCase();
        if (key === 'escape') {
            setActiveTool('cursor');
            setCurrentDrawing(null);
            setSelectedDrawingId(null);
            resizingHandleIndexRef.current = null;
        }
        else if (key === 'q') setActiveTool('ruler');
        else if (key === 'e') setActiveTool('brush');
        else if (key === 'r') setActiveTool('fib');
        else if (key === 't') setActiveTool('trend');
        else if (key === 'f') setActiveTool('horizontal');
        else if (key === 'l') setActiveTool('long');
        else if (key === 's') setActiveTool('short');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDrawingId, isDrawingsLocked]);

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
      });
    });

    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, []);

  // Toggle Chart interactions based on tool
  useEffect(() => {
    if (chartRef.current) {
        const isBrush = activeTool === 'brush';
        // When dragging a drawing, we also want to disable chart scrolling
        const isDragging = draggingId !== null;
        // When resizing, we also want to disable chart scrolling
        const isResizing = resizingHandleIndexRef.current !== null;
        
        chartRef.current.applyOptions({
            handleScroll: {
                pressedMouseMove: !isBrush && !isDragging && !isResizing,
                horzTouchDrag: !isBrush && !isDragging && !isResizing,
                vertTouchDrag: !isBrush && !isDragging && !isResizing,
                mouseWheel: true
            }
        });
    }
  }, [activeTool, draggingId]);

  // --- TOOL CHANGE CLEANUP ---
  useEffect(() => {
    // Unselect any drawing when switching tools
    setSelectedDrawingId(null);
    // Cancel any pending drawing
    setCurrentDrawing(null);
    // Reset dragging state just in case
    setDraggingId(null);
    dragStartPos.current = null;
    dragStartDrawingRef.current = null;
    resizingHandleIndexRef.current = null;

    // Reset Brush
    activeBrushPointsRef.current = [];
    if (activeBrushRef.current) {
        activeBrushRef.current.setAttribute('points', '');
    }
  }, [activeTool]);

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
    }
  }, [candles]);

  // --- HELPER: Coordinate to Time/Price ---
  const getChartDataFromXY = useCallback((x: number, y: number) => {
      if (!chartRef.current || !candlestickSeriesRef.current || candles.length === 0) return null;

      const series = candlestickSeriesRef.current;
      const timeScale = chartRef.current.timeScale();
      
      const price = series.coordinateToPrice(y);
      if (price === null) return null;

      const logical = timeScale.coordinateToLogical(x);
      if (logical === null) return null;

      const lastCandle = candles[candles.length - 1];
      const lastTime = lastCandle.time;
      const lastIndex = candles.length - 1; 
      const interval = getIntervalSeconds(timeframe);
      const diffIndex = Math.round(logical) - lastIndex;
      const time = lastTime + (diffIndex * interval);

      return { time, price };
  }, [candles, timeframe]);

  const getChartTime = useCallback((param: MouseEventParams): number | null => {
      if (param.time) return param.time as number;
      if (param.point && chartRef.current && candles.length > 0) {
          const res = getChartDataFromXY(param.point.x, param.point.y);
          return res ? res.time : null;
      }
      return null;
  }, [getChartDataFromXY]);

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

  // Handle Mouse Down on Container (Required for Brush & Global Event Listener for Dragging)
  const handleContainerMouseDown = (e: React.MouseEvent) => {
      isMouseDown.current = true;
      const rect = chartContainerRef.current?.getBoundingClientRect();
      if(rect) {
          dragStartPos.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      }

      if (activeTool === 'brush' && !isDrawingsLocked) {
          // Initialize new brush path
          activeBrushPointsRef.current = [];
          if (activeBrushRef.current) {
              activeBrushRef.current.setAttribute('points', '');
          }
      } 
  };

  const handleContainerMouseMove = (e: React.MouseEvent) => {
      if (!chartContainerRef.current) return;
      const rect = chartContainerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // --- RESIZING LOGIC (High Performance) ---
      if (resizingHandleIndexRef.current !== null && selectedDrawingId && !isDrawingsLocked) {
          // 1. Calculate new point data
          const newData = getChartDataFromXY(x, y);
          if (newData) {
              // 2. Mutate REF for immediate RAF update (bypass React state)
              const drawingIndex = drawingsStateRef.current.findIndex(d => d.id === selectedDrawingId);
              if (drawingIndex !== -1) {
                  const drawing = drawingsStateRef.current[drawingIndex];
                  const newPoints = [...drawing.points];
                  
                  newPoints[resizingHandleIndexRef.current] = newData;
                  
                  // --- SPECIAL CONSTRAINTS FOR LONG/SHORT ---
                  if (drawing.type === 'long' || drawing.type === 'short') {
                      // Handle 0: Entry (Start Time, Entry Price)
                      // Handle 1: Stop (End Time, Stop Price)
                      // Handle 2: Target (End Time, Target Price)
                      
                      // Constraint: P1 and P2 share the same Time (End Time)
                      if (resizingHandleIndexRef.current === 1 && newPoints[2]) {
                          // Resizing Stop -> Sync Target Time
                          newPoints[2] = { ...newPoints[2], time: newData.time };
                      } else if (resizingHandleIndexRef.current === 2 && newPoints[1]) {
                          // Resizing Target -> Sync Stop Time
                          newPoints[1] = { ...newPoints[1], time: newData.time };
                      }
                      // Handle 0 (Entry) changes start time, independent.
                  }

                  // Update the drawing in the ref directly
                  drawingsStateRef.current[drawingIndex] = {
                      ...drawing,
                      points: newPoints
                  };
              }
          }
          return; // Skip dragging logic if resizing
      }

      // --- OPTIMIZED DRAGGING LOGIC (Visual Only) ---
      if (activeTool === 'cursor' && draggingId && dragStartPos.current && !isDrawingsLocked) {
          // Calculate pixel delta
          const dx = x - dragStartPos.current.x;
          const dy = y - dragStartPos.current.y;
          
          // Apply CSS Transform for High Performance 60FPS Drag
          const el = drawingRefs.current.get(draggingId);
          if (el) {
              el.style.transform = `translate(${dx}px, ${dy}px)`;
          }
      }
  };

  const handleContainerMouseUp = (e: React.MouseEvent) => {
      isMouseDown.current = false;

      // --- RESIZING COMMIT ---
      if (resizingHandleIndexRef.current !== null && selectedDrawingId && !isDrawingsLocked) {
          // The drawingsStateRef was mutated during drag. 
          // We now commit that state to React to persist it and sync everything.
          setDrawings([...drawingsStateRef.current]);
          resizingHandleIndexRef.current = null;
          return;
      }
      
      // --- DRAG COMMIT LOGIC ---
      const draggedDrawing = dragStartDrawingRef.current; // Capture ref locally to avoid null access
      
      if (draggingId && dragStartPos.current && draggedDrawing && !isDrawingsLocked) {
           const rect = chartContainerRef.current?.getBoundingClientRect();
           if(rect) {
                const currentX = e.clientX - rect.left;
                const currentY = e.clientY - rect.top;
                const startX = dragStartPos.current.x;
                const startY = dragStartPos.current.y;
                
                const startData = getChartDataFromXY(startX, startY);
                const endData = getChartDataFromXY(currentX, currentY);

                if (startData && endData) {
                    const dt = endData.time - startData.time;
                    const dp = endData.price - startData.price;
                    
                    // Commit final coordinates to React State
                    setDrawings(prev => prev.map(d => {
                        if (d.id !== draggingId) return d;
                        return {
                            ...d,
                            points: draggedDrawing.points.map(p => ({
                                time: p.time + dt,
                                price: p.price + dp
                            }))
                        };
                    }));
                }
           }
           
           // Clean up Visual Transform
           const el = drawingRefs.current.get(draggingId);
           if (el) el.style.transform = '';
      }

      setDraggingId(null);
      dragStartPos.current = null;
      dragStartDrawingRef.current = null;
      
      // --- BRUSH COMMIT LOGIC ---
      if (activeTool === 'brush' && activeBrushPointsRef.current.length > 0 && !isDrawingsLocked) {
           const finalDrawing: Drawing = {
                id: Math.random().toString(36).substr(2, 9),
                type: 'brush',
                points: [...activeBrushPointsRef.current],
                style: { ...toolStyle }
            };
            setDrawings(prev => [...prev, finalDrawing]);
            
            // Clear current brush buffer
            activeBrushPointsRef.current = [];
            if (activeBrushRef.current) {
                activeBrushRef.current.setAttribute('points', '');
            }
      } else if (activeTool === 'brush') {
           // Cleanup empty clicks
           activeBrushPointsRef.current = [];
      }
  };

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const handleClick = (param: MouseEventParams) => {
        if (!param.point) return;
        
        if (activeTool === 'cursor' && !resizingHandleIndexRef.current && !draggingId) {
             setSelectedDrawingId(null);
        }

        if (activeTool === 'brush' || isDrawingsLocked) return;
        if (activeTool === 'cursor') return; // Creation disabled in cursor mode

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
                let finalPoints = [currentDrawing.points[0], { time, price }];
                
                // For Long/Short, we initialize with 3 points: Entry, Stop, Target
                if (activeTool === 'long' || activeTool === 'short') {
                    const p1 = finalPoints[0];
                    const p2 = finalPoints[1];
                    const risk = Math.abs(p1.price - p2.price);
                    const reward = risk * 1.5;
                    const targetPrice = activeTool === 'long' ? p1.price + reward : p1.price - reward;
                    // Add calculated target point
                    finalPoints.push({ time: p2.time, price: targetPrice });
                }

                const finalDrawing: Drawing = {
                    ...currentDrawing,
                    id: Math.random().toString(36).substr(2, 9),
                    points: finalPoints
                };
                setDrawings(prev => [...prev, finalDrawing]);
                setCurrentDrawing(null);
            }
        }
    };

    chart.subscribeClick(handleClick);
    return () => chart.unsubscribeClick(handleClick);
  }, [activeTool, currentDrawing, getChartTime, toolStyle, isDrawingsLocked, draggingId]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const handleMove = (param: MouseEventParams) => {
        if (onCrosshairMove) handleCrosshairMoveLegacy(param);

        if (param.point && !isDrawingsLocked) {
            const series = candlestickSeriesRef.current;
            if (!series) return;
            const price = series.coordinateToPrice(param.point.y);
            const time = getChartTime(param);

            if (price !== null && time !== null) {
                // High Performance Brush Logic (Direct DOM manipulation)
                if (activeTool === 'brush' && isMouseDown.current) {
                    const newPoint = { time, price };
                    
                    // Simple Dedup
                    const lastP = activeBrushPointsRef.current[activeBrushPointsRef.current.length - 1];
                    if (!lastP || (lastP.time !== time || lastP.price !== price)) {
                        activeBrushPointsRef.current.push(newPoint);
                        
                        const pointsStr = activeBrushPointsRef.current.map(p => {
                            const c = pointToCoordinate(p);
                            return (c.x !== null && c.y !== null) ? `${c.x},${c.y}` : '';
                        }).join(' ');

                        if (activeBrushRef.current) {
                            activeBrushRef.current.setAttribute('points', pointsStr);
                        }
                    }
                } 
                // Standard 2-Point Tool Logic (Preview State)
                else if (currentDrawing && activeTool !== 'brush') {
                    setCurrentDrawing(prev => prev ? ({
                        ...prev,
                        points: [prev.points[0], { time, price }]
                    }) : null);
                }
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
  }, [currentDrawing, heatmapData, globalMaxDensity, onCrosshairMove, getChartTime, activeTool, toolStyle, pointToCoordinate, isDrawingsLocked]);

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
        const line = priceLinesRef.current.get(d.id);
        const options = {
            price: d.points[0].price,
            color: d.style.color,
            lineWidth: d.style.lineWidth as 1|2|3|4,
            lineStyle: d.style.lineStyle === 'dashed' ? 2 : d.style.lineStyle === 'dotted' ? 3 : 0,
            axisLabelVisible: true,
            title: 'H-Line',
        };
        
        if (!line) {
            const newLine = series.createPriceLine(options);
            priceLinesRef.current.set(d.id, newLine);
        } else {
            line.applyOptions(options);
        }
    });
  }, [drawings]);

  // --- IMPERATIVE DRAWING UPDATE (Runs in RAF Loop) ---
  const updateDrawingsDOM = useCallback(() => {
    const all = [...drawingsStateRef.current];
    if (currentDrawingStateRef.current) all.push(currentDrawingStateRef.current);
    const { width, height } = dimensionsRef.current;
    const series = candlestickSeriesRef.current;

    all.forEach(d => {
        const groupEl = drawingRefs.current.get(d.id);
        if (!groupEl) return;

        // Skip horizontal lines (handled natively)
        if (d.type === 'horizontal') return;

        // Brush
        if (d.type === 'brush') {
             const pointsStr = d.points.map(p => {
                const { x, y } = pointToCoordinate(p);
                return (x !== null && y !== null) ? `${x},${y}` : '';
            }).filter(s => s).join(' ');
            const poly = groupEl.querySelector('polyline');
            if (poly) poly.setAttribute('points', pointsStr);
            return;
        }

        const p1 = d.points[0];
        const { x: x1, y: y1 } = pointToCoordinate(p1);

        // --- UPDATE HANDLES (Anchor Points) ---
        // If this drawing is selected, we need to update the circle positions
        if (d.id === selectedDrawingId) {
             d.points.forEach((p, idx) => {
                 const handle = groupEl.querySelector(`.handle-${idx}`);
                 if (handle) {
                     const coords = pointToCoordinate(p);
                     if (coords.x !== null && coords.y !== null) {
                        handle.setAttribute('cx', String(coords.x));
                        handle.setAttribute('cy', String(coords.y));
                     }
                 }
             });
        }

        if (d.type === 'vertical') {
             const line = groupEl.children[0]; 
             if(line && x1 !== null) {
                 line.setAttribute('x1', String(x1));
                 line.setAttribute('x2', String(x1));
                 line.setAttribute('y2', String(height));
             }
             return;
        }

        if (d.points.length < 2) return;
        const p2 = d.points[1];
        const { x: x2, y: y2 } = pointToCoordinate(p2);
        
        if (x1 === null || y1 === null || x2 === null || y2 === null) return;

        if (d.type === 'trend') {
            const hit = groupEl.children[0];
            const vis = groupEl.children[1];
            [hit, vis].forEach(el => {
                if(el) {
                    el.setAttribute('x1', String(x1));
                    el.setAttribute('y1', String(y1));
                    el.setAttribute('x2', String(x2));
                    el.setAttribute('y2', String(y2));
                }
            });
        }
        else if (d.type === 'ray') {
            let xExt = x2, yExt = y2;
            if (x2 !== x1) {
                const slope = (y2 - y1) / (x2 - x1);
                xExt = x2 > x1 ? width : 0;
                yExt = y1 + slope * (xExt - x1);
            }
             const hit = groupEl.children[0];
             const vis = groupEl.children[1];
             [hit, vis].forEach(el => {
                if(el) {
                    el.setAttribute('x1', String(x1));
                    el.setAttribute('y1', String(y1));
                    el.setAttribute('x2', String(xExt));
                    el.setAttribute('y2', String(yExt));
                }
             });
        }
        else if (d.type === 'arrow') {
             const hitLine = groupEl.children[1];
             const visLine = groupEl.children[2];
             [hitLine, visLine].forEach(el => {
                 if(el) {
                    el.setAttribute('x1', String(x1));
                    el.setAttribute('y1', String(y1));
                    el.setAttribute('x2', String(x2));
                    el.setAttribute('y2', String(y2));
                 }
             });
        }
        else if (d.type === 'rectangle') {
            const rect = groupEl.children[0];
            if(rect) {
                const w = Math.abs(x2 - x1);
                const h = Math.abs(y2 - y1);
                rect.setAttribute('x', String(Math.min(x1, x2)));
                rect.setAttribute('y', String(Math.min(y1, y2)));
                rect.setAttribute('width', String(w));
                rect.setAttribute('height', String(h));
            }
        }
        else if (d.type === 'circle') {
             const ellipse = groupEl.children[0];
             if(ellipse) {
                 const cx = (x1 + x2) / 2;
                 const cy = (y1 + y2) / 2;
                 const rx = Math.abs(x2 - x1) / 2;
                 const ry = Math.abs(y2 - y1) / 2;
                 ellipse.setAttribute('cx', String(cx));
                 ellipse.setAttribute('cy', String(cy));
                 ellipse.setAttribute('rx', String(rx));
                 ellipse.setAttribute('ry', String(ry));
             }
        }
        else if (d.type === 'fib') {
            const dy = y2 - y1;
            const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
            
            const diag = groupEl.children[0];
            if(diag) {
                 diag.setAttribute('x1', String(x1));
                 diag.setAttribute('y1', String(y1));
                 diag.setAttribute('x2', String(x2));
                 diag.setAttribute('y2', String(y2));
            }

            let childIdx = 1;
            levels.forEach(lvl => {
                const yLvl = y1 + dy * lvl;
                const line = groupEl.children[childIdx];
                const text = groupEl.children[childIdx + 1];
                
                if(line) {
                    line.setAttribute('x1', String(Math.min(x1, x2)));
                    line.setAttribute('x2', String(Math.max(x1, x2)));
                    line.setAttribute('y1', String(yLvl));
                    line.setAttribute('y2', String(yLvl));
                }
                if(text) {
                    text.setAttribute('x', String(Math.min(x1, x2)));
                    text.setAttribute('y', String(yLvl - 2));
                }
                childIdx += 2;
            });
            
            const hitRect = groupEl.children[childIdx];
             if(hitRect) {
                 const w = Math.abs(x2 - x1);
                 const h = Math.abs(y2 - y1);
                 hitRect.setAttribute('x', String(Math.min(x1, x2)));
                 hitRect.setAttribute('y', String(Math.min(y1, y2)));
                 hitRect.setAttribute('width', String(w));
                 hitRect.setAttribute('height', String(h));
            }
        }
        else if (d.type === 'ruler') {
             const priceDiff = p2.price - p1.price;
             const percent = (priceDiff / p1.price) * 100;
             const isPositive = percent >= 0;
             const sign = isPositive ? '+' : '';
             
             const text = `${sign}${percent.toFixed(2)}% (${priceDiff.toFixed(2)})`;
             const rulerColor = isPositive ? '#10b981' : '#ef4444';
             const bg = isPositive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';
             const border = isPositive ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)';

             const boxRect = groupEl.children[0];
             if(boxRect) {
                 const w = Math.abs(x2 - x1);
                 const h = Math.abs(y2 - y1);
                 boxRect.setAttribute('x', String(Math.min(x1, x2)));
                 boxRect.setAttribute('y', String(Math.min(y1, y2)));
                 boxRect.setAttribute('width', String(w));
                 boxRect.setAttribute('height', String(h));
                 boxRect.setAttribute('fill', bg);
                 boxRect.setAttribute('stroke', border);
             }

             const labelGroup = groupEl.children[1];
             if(labelGroup) {
                 const midX = (x1 + x2) / 2;
                 const midY = (y1 + y2) / 2;
                 labelGroup.setAttribute('transform', `translate(${midX}, ${midY})`);

                 const labelBg = labelGroup.querySelector('rect');
                 if(labelBg) labelBg.setAttribute('stroke', border);
                 
                 const labelText = labelGroup.querySelector('text');
                 if(labelText) {
                     labelText.textContent = text;
                     labelText.setAttribute('fill', rulerColor);
                 }
             }
        }
        else if (d.type === 'long' || d.type === 'short') {
            const isLong = d.type === 'long';
            const p3 = d.points[2]; // Target Point
            
            // Default calculation if P3 not set (creation phase)
            let targetPrice = p3 ? p3.price : (isLong ? p1.price + Math.abs(p1.price - p2.price) * 1.5 : p1.price - Math.abs(p1.price - p2.price) * 1.5);
            let targetY = series?.priceToCoordinate(targetPrice) ?? 0;
            
            // If P3 exists, use its Y coordinate from chart (handles scroll/zoom)
            if (p3) {
                const c3 = pointToCoordinate(p3);
                if (c3.y !== null) targetY = c3.y;
            }

            const xLeft = Math.min(x1, x2);
            const w = Math.abs(x2 - x1);
            
            // Calculate Boxes
            const profitY = Math.min(y1, targetY);
            const profitH = Math.abs(y1 - targetY);
            
            const lossY = Math.min(y1, y2);
            const lossH = Math.abs(y1 - y2);

            // Update Rects
            const profitRect = groupEl.children[0];
            if (profitRect) {
                 profitRect.setAttribute('x', String(xLeft));
                 profitRect.setAttribute('y', String(profitY));
                 profitRect.setAttribute('width', String(w));
                 profitRect.setAttribute('height', String(profitH));
            }
            
            const lossRect = groupEl.children[1];
             if (lossRect) {
                 lossRect.setAttribute('x', String(xLeft));
                 lossRect.setAttribute('y', String(lossY));
                 lossRect.setAttribute('width', String(w));
                 lossRect.setAttribute('height', String(lossH));
            }
            
            const entryLine = groupEl.children[2];
            if (entryLine) {
                entryLine.setAttribute('x1', String(xLeft));
                entryLine.setAttribute('y1', String(y1));
                entryLine.setAttribute('x2', String(xLeft + w));
                entryLine.setAttribute('y2', String(y1));
            }

            // Calculations
            const entry = p1.price;
            const stop = p2.price;
            const target = targetPrice;
            const risk = Math.abs(entry - stop);
            const reward = Math.abs(target - entry);
            const rr = risk > 0 ? (reward / risk).toFixed(2) : '0.00';
            
            // Label 1: R:R (Center)
            const labelGroup = groupEl.children[3] as SVGElement;
            if(labelGroup) {
                 const tx = xLeft + w/2;
                 labelGroup.setAttribute('transform', `translate(${tx}, ${y1})`);
                 const textEl = labelGroup.querySelector('text');
                 if (textEl) textEl.textContent = `Ratio: ${rr}`;
            }

            // Label 2: Target Stats (Green)
            const targetText = groupEl.children[4] as SVGElement;
            if(targetText) {
                const diff = target - entry;
                const pct = ((diff / entry) * 100).toFixed(2);
                const sign = diff >= 0 ? '+' : '';
                targetText.textContent = `Target: ${target.toFixed(2)} (${sign}${pct}%) ${sign}${diff.toFixed(2)}`;
                
                targetText.setAttribute('x', String(xLeft + w/2));
                targetText.setAttribute('y', String(targetY + (isLong ? -6 : 14))); // Position outside box slightly
            }

            // Label 3: Stop Stats (Red)
            const stopText = groupEl.children[5] as SVGElement;
            if(stopText) {
                const diff = stop - entry;
                const pct = ((diff / entry) * 100).toFixed(2);
                const sign = diff >= 0 ? '+' : '';
                stopText.textContent = `Stop: ${stop.toFixed(2)} (${sign}${pct}%) ${sign}${diff.toFixed(2)}`;
                
                stopText.setAttribute('x', String(xLeft + w/2));
                stopText.setAttribute('y', String(y2 + (isLong ? 14 : -6))); // Position outside box slightly
            }
        }
    });
  }, [pointToCoordinate, selectedDrawingId]); // Added selectedDrawingId dependency for handles

  // --- RENDER LOOP (Heatmap + Drawings Update) ---
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
    
    // 2. Synchronous Drawing DOM Update
    updateDrawingsDOM();

  }, [heatmapData, globalMaxDensity, noiseFilter, sensitivity, theme, cloudMode, localNormalization, bucketSize, colorLUT, updateDrawingsDOM]);

  useEffect(() => {
    let animationFrameId: number;
    const render = () => {
        drawHeatmap();
        animationFrameId = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [drawHeatmap]);

  // --- SVG ELEMENT GENERATION (Structure Only) ---
  const svgElements = useMemo(() => {
    const elements: React.ReactNode[] = [];
    
    // Check required refs but don't crash if they aren't ready
    if (!chartRef.current || !candlestickSeriesRef.current) return elements;

    const allDrawings = [...drawings, ...(currentDrawing ? [currentDrawing] : [])];

    allDrawings.forEach(d => {
        if (d.type === 'horizontal') return; 

        const isSelected = d.id === selectedDrawingId;
        const isCurrent = d.id === 'temp' || d.id === currentDrawing?.id;
        
        const groupProps = {
            key: d.id,
            ref: (el: SVGGElement | null) => {
                if (el) drawingRefs.current.set(d.id, el);
                else drawingRefs.current.delete(d.id);
            },
            onMouseDown: (e: React.MouseEvent) => {
                if (activeTool === 'cursor' && !isCurrent && !isDrawingsLocked) {
                    e.stopPropagation(); 
                    setSelectedDrawingId(d.id);
                    setDraggingId(d.id);
                    dragStartDrawingRef.current = d; 
                    
                    const rect = chartContainerRef.current?.getBoundingClientRect();
                    if(rect) {
                        dragStartPos.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
                    }
                }
            },
            style: { 
                cursor: activeTool === 'cursor' ? 'move' : 'crosshair',
                pointerEvents: (activeTool === 'cursor' && !isCurrent && !isDrawingsLocked) ? 'visiblePainted' : 'none',
                filter: isSelected ? 'drop-shadow(0 0 3px white)' : 'none',
                transition: 'filter 0.2s ease',
                display: 'block' // Default visible
            } as React.CSSProperties
        };

        const { color, lineWidth, lineStyle, fillOpacity } = d.style;
        const dashArray = lineStyle === 'dashed' ? '6 6' : lineStyle === 'dotted' ? '2 4' : 'none';

        // Initial rendering can use 0 coords, they will be updated instantly by RAF
        const x1=0, y1=0, x2=0, y2=0;
        
        // --- RESIZE HANDLES (Circles) ---
        // We render these circles only if selected. They are positioned by RAF.
        // We exclude Brush because it has too many points.
        const handles = isSelected && d.type !== 'brush' && d.type !== 'horizontal' ? (
            <g>
                {d.points.map((_, idx) => (
                    <circle
                        key={idx}
                        className={`handle-${idx}`}
                        r={5}
                        fill="white"
                        stroke="#050505"
                        strokeWidth={2}
                        cx={0} 
                        cy={0}
                        style={{ cursor: 'pointer', pointerEvents: 'all' }}
                        onMouseDown={(e) => {
                            if (!isDrawingsLocked) {
                                e.stopPropagation();
                                resizingHandleIndexRef.current = idx;
                            }
                        }}
                    />
                ))}
            </g>
        ) : null;

        if (d.type === 'brush') {
            const pointsStr = ""; // Filled by RAF
            elements.push(
                <g {...groupProps}>
                    <polyline points={pointsStr} fill="none" stroke={color} strokeWidth={lineWidth} strokeLinecap="round" strokeLinejoin="round" />
                </g>
            );
            return;
        }

        if (d.type === 'vertical') {
            elements.push(
                <g {...groupProps}>
                    <line x1={0} y1={0} x2={0} y2={0} stroke={color} strokeWidth={lineWidth} strokeDasharray={dashArray} />
                    {handles}
                </g>
            );
            return;
        }

        if (d.type === 'trend') {
            elements.push(
                <g {...groupProps}>
                    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={Math.max(10, lineWidth * 3)} />
                    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={lineWidth} strokeDasharray={dashArray} />
                    {handles}
                </g>
            );
        } 
        else if (d.type === 'ray') {
            elements.push(
                <g {...groupProps}>
                    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={Math.max(10, lineWidth * 3)} />
                    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={lineWidth} strokeDasharray={dashArray} />
                    {handles}
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
                     {handles}
                </g>
             );
        }
        else if (d.type === 'rectangle') {
            elements.push(
                <g {...groupProps}>
                    <rect x={0} y={0} width={0} height={0} fill={color} fillOpacity={fillOpacity} stroke={color} strokeWidth={lineWidth} strokeDasharray={dashArray} />
                    {handles}
                </g>
            );
        }
        else if (d.type === 'circle') {
             elements.push(
                <g {...groupProps}>
                     <ellipse cx={0} cy={0} rx={0} ry={0} fill={color} fillOpacity={fillOpacity} stroke={color} strokeWidth={lineWidth} strokeDasharray={dashArray} />
                     {handles}
                </g>
             );
        }
        else if (d.type === 'fib') {
            const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
            elements.push(
                <g {...groupProps}>
                    <line x1={0} y1={0} x2={0} y2={0} stroke={color} strokeDasharray="2 2" strokeOpacity={0.5} />
                    {levels.map(lvl => (
                        <React.Fragment key={lvl}>
                            <line x1={0} y1={0} x2={0} y2={0} stroke={color} strokeWidth={lineWidth} strokeDasharray={dashArray} />
                            <text x={0} y={0} fill={color} fontSize="10">{lvl}</text>
                        </React.Fragment>
                    ))}
                     <rect x={0} y={0} width={0} height={0} fill="transparent" />
                     {handles}
                </g>
            );
        }
        else if (d.type === 'ruler') {
             const p1 = d.points[0];
             const p2 = d.points[1] || p1;
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
                    <rect x={0} y={0} width={0} height={0} fill={bg} stroke={border} strokeDasharray="4 2" />
                    <g transform={`translate(0, 0)`}>
                        <rect x="-70" y="-12" width="140" height="24" rx="4" fill="#18181b" stroke={border} strokeWidth={1} />
                        <text x="0" y="4" textAnchor="middle" fill={rulerColor} fontSize="11" fontFamily="monospace" fontWeight="bold" style={{ pointerEvents: 'none' }}>{text}</text>
                    </g>
                    {handles}
                </g>
            );
        }
        else if (d.type === 'long' || d.type === 'short') {
            const isLong = d.type === 'long';
            const profitColor = '#10b981';
            const lossColor = '#ef4444';
            
            elements.push(
                <g {...groupProps}>
                    {/* 0: Profit Rect */}
                    <rect x="0" y="0" width="0" height="0" fill={profitColor} fillOpacity={fillOpacity} stroke={profitColor} strokeWidth={1} strokeOpacity={0.5} />
                    {/* 1: Loss Rect */}
                    <rect x="0" y="0" width="0" height="0" fill={lossColor} fillOpacity={fillOpacity} stroke={lossColor} strokeWidth={1} strokeOpacity={0.5} />
                    {/* 2: Entry Line */}
                    <line x1="0" y1="0" x2="0" y2="0" stroke="gray" strokeWidth={1} strokeDasharray="2 2" />
                    
                    {/* 3: R:R Label Group */}
                    <g transform="translate(0,0)" style={{ pointerEvents: 'none' }}>
                        <rect x="-30" y="-10" width="60" height="20" rx="4" fill="#18181b" fillOpacity="0.7" />
                        <text x="0" y="4" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">R:R</text>
                    </g>

                    {/* 4: Target Stats Text */}
                    <text x="0" y="0" textAnchor="middle" fill="#10b981" fontSize="10" fontWeight="normal" style={{ pointerEvents: 'none', textShadow: '0 1px 2px black' }}>Target</text>
                    
                    {/* 5: Stop Stats Text */}
                    <text x="0" y="0" textAnchor="middle" fill="#ef4444" fontSize="10" fontWeight="normal" style={{ pointerEvents: 'none', textShadow: '0 1px 2px black' }}>Stop</text>

                    {handles}
                </g>
            );
        }
    });

    return elements;
  }, [drawings, currentDrawing, activeTool, selectedDrawingId, draggingId, isDrawingsLocked]);

  return (
    <div 
        ref={chartContainerRef} 
        className={`relative w-full h-full ${activeTool !== 'cursor' ? 'cursor-crosshair' : (draggingId ? 'cursor-move' : 'cursor-default')}`}
        onMouseDown={handleContainerMouseDown}
        onMouseUp={(e) => handleContainerMouseUp(e)}
        onMouseLeave={(e) => handleContainerMouseUp(e)}
        onMouseMove={handleContainerMouseMove}
    >
      <canvas ref={canvasRef} className="absolute inset-0 z-10 pointer-events-none" />
      <svg ref={svgRef} className="absolute inset-0 z-20 pointer-events-none overflow-visible">
         {svgElements}
         {/* Dedicated high-performance layer for active brush stroke */}
         <polyline 
            ref={activeBrushRef} 
            fill="none" 
            stroke={toolStyle.color} 
            strokeWidth={toolStyle.lineWidth} 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            style={{ pointerEvents: 'none', filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.5))' }}
         />
      </svg>
      <DrawingToolbar 
         activeTool={activeTool}
         setTool={setActiveTool}
         onClear={() => setDrawings([])}
         hasDrawings={drawings.length > 0}
         currentStyle={effectiveStyle}
         setStyle={handleStyleChange}
         isDrawingSelected={!!selectedDrawingId}
         effectiveToolType={effectiveToolType}
         isLocked={isDrawingsLocked}
         onToggleLock={toggleLock}
      />
    </div>
  );
});

export default LiquidationChart;
