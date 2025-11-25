import React, { useState, useEffect, useRef } from 'react';
import { fetchCandles, fetchExchangeSymbols } from './services/binanceService';
import { calculateHeatmapData } from './utils/heatmapMath';
import { Candle, HeatmapSnapshot, Timeframe, HeatmapTheme, CrosshairData } from './types';
import LiquidationChart from './components/LiquidationChart';
import Controls from './components/Controls';
import { BarChart3, Activity } from 'lucide-react';

function App() {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [heatmapData, setHeatmapData] = useState<HeatmapSnapshot[]>([]);
  const [globalMaxDensity, setGlobalMaxDensity] = useState<number>(1);
  const [bucketSize, setBucketSize] = useState<number>(10);
  
  // UI State
  const [symbol, setSymbol] = useState<string>('BTCUSDT');
  const [allSymbols, setAllSymbols] = useState<string[]>([]);
  const [timeframe, setTimeframe] = useState<Timeframe>('1d');
  const [history, setHistory] = useState<string>('1y'); 
  const [leverage, setLeverage] = useState<number>(3);
  
  // Visualization Settings
  const [noiseFilter, setNoiseFilter] = useState<number>(0.10); 
  const [sensitivity, setSensitivity] = useState<number>(1.5); 
  const [cloudMode, setCloudMode] = useState<boolean>(true); 
  const [localNormalization, setLocalNormalization] = useState<boolean>(true);
  
  // Hover State
  const [hoveredStats, setHoveredStats] = useState<CrosshairData | null>(null);

  // Theme matched to Mesh Reference
  const [theme, setTheme] = useState<HeatmapTheme>({
      low: '#1e3a8a',
      medium: '#22c55e',
      high: '#f97316',
      extreme: '#dc2626'
  });

  const [isCalculating, setIsCalculating] = useState<boolean>(false);

  // --- DYNAMIC LIMIT CALCULATION ---
  const getMinutesFromTimeframe = (tf: Timeframe): number => {
      const mapping: {[key: string]: number} = {
          '1m': 1, '3m': 3, '5m': 5, '15m': 15, '30m': 30,
          '1h': 60, '2h': 120, '4h': 240, '6h': 360, '8h': 480, '12h': 720,
          '1d': 1440, '3d': 4320, '1w': 10080, '1M': 43200
      };
      return mapping[tf] || 1440;
  };

  const getMinutesFromHistory = (hist: string): number => {
      if (hist === 'max') return 20 * 365 * 24 * 60; 

      const mapping: {[key: string]: number} = {
          '12h': 720,
          '1d': 1440, '3d': 4320, '1w': 10080,
          '1M': 43200, '3M': 129600, '6M': 259200,
          '1y': 525600, '2y': 1051200, '3y': 1576800, '5y': 2628000
      };
      return mapping[hist] || 525600;
  };

  // Load available symbols on mount
  useEffect(() => {
    const loadSymbols = async () => {
        const symbols = await fetchExchangeSymbols();
        if (symbols && symbols.length > 0) {
            setAllSymbols(symbols);
        }
    };
    loadSymbols();
  }, []);

  useEffect(() => {
    let isMounted = true;
    let timeoutId: number;

    const loadData = async () => {
      if (!isMounted) return;
      setIsCalculating(true);
      
      try {
        const tfMins = getMinutesFromTimeframe(timeframe);
        const histMins = getMinutesFromHistory(history);
        let requiredCandles = Math.ceil(histMins / tfMins);
        const limit = Math.max(20, requiredCandles);
        
        const data = await fetchCandles(symbol, timeframe, limit);
        
        if (isMounted) {
            setCandles(data);
        }
      } catch (error) {
        console.error("Error loading market data", error);
      } finally {
        if (isMounted) {
            setIsCalculating(false);
            timeoutId = window.setTimeout(loadData, 60000);
        }
      }
    };

    loadData();

    return () => {
        isMounted = false;
        window.clearTimeout(timeoutId);
    };
  }, [timeframe, symbol, history]); 

  // Heatmap Calculation Effect
  useEffect(() => {
    if (candles.length === 0) return;

    setIsCalculating(true);
    
    const timer = setTimeout(() => {
      const currentPrice = candles[candles.length - 1].close;
      const calcBucketSize = currentPrice * 0.0025; 
      setBucketSize(calcBucketSize);

      const { snapshots, globalMaxDensity } = calculateHeatmapData(candles, leverage, calcBucketSize);
      
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
        history={history}
        setHistory={setHistory}
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
        allSymbols={allSymbols}
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
            timeframe={timeframe}
            bucketSize={bucketSize}
            onCrosshairMove={setHoveredStats}
          />
          
          <div className="absolute bottom-10 right-24 z-20 pointer-events-none flex flex-col gap-4 items-end">
             
             {hoveredStats && (
                 <div className="bg-[#050505]/80 backdrop-blur-xl p-4 rounded border border-blue-500/20 shadow-[0_0_30px_rgba(37,99,235,0.1)] min-w-[180px] animate-in fade-in duration-200 slide-in-from-right-4">
                    <div className="flex items-center gap-2 mb-3 border-b border-white/10 pb-2 justify-end">
                        <span className="text-[10px] font-bold text-blue-100 uppercase tracking-widest">Target Info</span>
                        <Activity size={12} className="text-blue-400" />
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

             <div className="bg-[#050505]/70 backdrop-blur-md p-4 rounded border border-white/5 shadow-2xl min-w-[180px]">
                <div className="flex items-center gap-2 mb-4 border-b border-white/5 pb-2 justify-end">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">
                        {localNormalization ? 'LOCAL DENSITY' : 'GLOBAL DENSITY'}
                    </span>
                    <BarChart3 size={12} className="text-gray-500" />
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

          <div className="absolute bottom-4 left-6 z-20 pointer-events-none opacity-30">
              <span className="text-[10px] font-mono text-gray-500">BINANCE FUTURES // PERPETUAL DATA</span>
          </div>
      </div>
    </div>
  );
}

export default App;