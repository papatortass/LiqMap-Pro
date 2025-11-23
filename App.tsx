import React, { useState, useEffect } from 'react';
import { fetchCandles } from './services/binanceService';
import { calculateHeatmapData } from './utils/heatmapMath';
import { Candle, HeatmapSnapshot, Timeframe, HeatmapTheme, CrosshairData } from './types';
import LiquidationChart from './components/LiquidationChart';
import Controls from './components/Controls';
import { BarChart3, Activity } from 'lucide-react';

function App() {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [heatmapData, setHeatmapData] = useState<HeatmapSnapshot[]>([]);
  const [globalMaxDensity, setGlobalMaxDensity] = useState<number>(1);
  
  // UI State
  const [symbol, setSymbol] = useState<string>('BTCUSDT');
  // Default: 1D Timeframe, 3x Leverage as requested
  const [timeframe, setTimeframe] = useState<Timeframe>('1d');
  const [leverage, setLeverage] = useState<number>(3);
  
  // Visualization Settings
  const [noiseFilter, setNoiseFilter] = useState<number>(0.10); 
  const [sensitivity, setSensitivity] = useState<number>(1.5); 
  // Defaults: Cloud Mode ON, Local Normalization ON
  const [cloudMode, setCloudMode] = useState<boolean>(true); 
  const [localNormalization, setLocalNormalization] = useState<boolean>(true);
  
  // Hover State
  const [hoveredStats, setHoveredStats] = useState<CrosshairData | null>(null);

  // Theme matched to Mesh Reference (Dark Blue -> Green -> Orange -> Red)
  const [theme, setTheme] = useState<HeatmapTheme>({
      low: '#1e3a8a',     // Deep Blue
      medium: '#22c55e',  // Vibrant Green
      high: '#f97316',    // Orange
      extreme: '#dc2626'  // Deep Red
  });

  const [isCalculating, setIsCalculating] = useState<boolean>(false);

  useEffect(() => {
    const loadData = async () => {
      setIsCalculating(true);
      try {
        const isLongTimeframe = ['1d', '3d', '1w', '1M'].includes(timeframe);
        const limit = isLongTimeframe ? 500 : 1500;
        const data = await fetchCandles(symbol, timeframe, limit);
        setCandles(data);
      } catch (error) {
        console.error("Error loading market data", error);
      } finally {
        setIsCalculating(false);
      }
    };

    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, [timeframe, symbol]);

  // --- ASYNC CALCULATION (Time-Slicing Simulation) ---
  // Real web worker is hard in this env, using setTimeout to unblock main thread slightly
  useEffect(() => {
    if (candles.length === 0) return;

    setIsCalculating(true);
    
    // Short timeout allows UI to render "Calculating..." state first
    const timer = setTimeout(() => {
      const currentPrice = candles[candles.length - 1].close;
      const bucketSize = currentPrice * 0.0025; 

      const { snapshots, globalMaxDensity } = calculateHeatmapData(candles, leverage, bucketSize);
      
      setHeatmapData(snapshots);
      setGlobalMaxDensity(globalMaxDensity);
      setIsCalculating(false);
    }, 50);

    return () => clearTimeout(timer);
  }, [candles, leverage]);

  return (
    <div className="flex flex-col h-screen w-full bg-[#050505] text-gray-300 overflow-hidden selection:bg-blue-500/30">
      
      <Controls 
        timeframe={timeframe}
        setTimeframe={setTimeframe}
        leverage={leverage}
        setLeverage={setLeverage}
        noiseFilter={noiseFilter}
        setNoiseFilter={setNoiseFilter}
        sensitivity={sensitivity}
        setSensitivity={setSensitivity}
        theme={theme}
        setTheme={setTheme}
        symbol={symbol}
        setSymbol={setSymbol}
        cloudMode={cloudMode}
        setCloudMode={setCloudMode}
        localNormalization={localNormalization}
        setLocalNormalization={setLocalNormalization}
        isCalculating={isCalculating}
      />

      <div className="relative flex-1 w-full h-full">
          <LiquidationChart 
            candles={candles} 
            heatmapData={heatmapData}
            globalMaxDensity={globalMaxDensity}
            noiseFilter={noiseFilter}
            sensitivity={sensitivity}
            theme={theme}
            cloudMode={cloudMode}
            localNormalization={localNormalization}
            onCrosshairMove={setHoveredStats}
          />
          
          {/* HUD Legend & Stats - MOVED TO LEFT SIDE */}
          <div className="absolute top-6 left-6 z-20 pointer-events-none flex flex-col gap-4">
             
             {/* 1. Hover Stats Panel (Only visible when hovering data) */}
             {hoveredStats && (
                 <div className="bg-[#050505]/80 backdrop-blur-xl p-4 rounded border border-blue-500/20 shadow-[0_0_30px_rgba(37,99,235,0.1)] min-w-[180px] animate-in fade-in duration-200 slide-in-from-left-4">
                    <div className="flex items-center gap-2 mb-3 border-b border-white/10 pb-2">
                        <Activity size={12} className="text-blue-400" />
                        <span className="text-[10px] font-bold text-blue-100 uppercase tracking-widest">Target Info</span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <div className="flex justify-between text-xs">
                            <span className="text-gray-500">Price</span>
                            <span className="font-mono text-white">${hoveredStats.price.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-gray-500">Intensity</span>
                            <span className="font-mono text-blue-400">{hoveredStats.density.toFixed(1)}</span>
                        </div>
                        <div className="w-full h-1 bg-gray-800 rounded-full mt-1 overflow-hidden">
                            <div 
                                className="h-full bg-gradient-to-r from-blue-500 to-red-500" 
                                style={{ width: `${Math.min(100, hoveredStats.normalizedDensity * 100)}%` }}
                            />
                        </div>
                    </div>
                 </div>
             )}

             {/* 2. Density Legend */}
             <div className="bg-[#050505]/70 backdrop-blur-md p-4 rounded border border-white/5 shadow-2xl min-w-[180px]">
                <div className="flex items-center gap-2 mb-4 border-b border-white/5 pb-2">
                    <BarChart3 size={12} className="text-gray-500" />
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">
                        {localNormalization ? 'LOCAL DENSITY' : 'GLOBAL DENSITY'}
                    </span>
                </div>
                
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-600 font-mono">LOW</span>
                        <div className="w-16 h-1 rounded-sm" style={{ backgroundColor: theme.low, opacity: 0.8 }}></div>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-600 font-mono">MED</span>
                        <div className="w-16 h-1 rounded-sm" style={{ backgroundColor: theme.medium, opacity: 0.9 }}></div>
                    </div>
                     <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-600 font-mono">HIGH</span>
                        <div className="w-16 h-1 rounded-sm" style={{ backgroundColor: theme.high, opacity: 1 }}></div>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-600 font-mono text-red-400">MAX</span>
                        <div className="w-16 h-1 rounded-sm shadow-[0_0_8px_rgba(220,38,38,0.5)]" style={{ backgroundColor: theme.extreme }}></div>
                    </div>
                </div>
             </div>
          </div>

          {/* Watermark - Moved to Bottom Right */}
          <div className="absolute bottom-4 right-20 z-20 pointer-events-none opacity-30">
              <span className="text-[10px] font-mono text-gray-500">BINANCE FUTURES // PERPETUAL DATA</span>
          </div>
      </div>
    </div>
  );
}

export default App;