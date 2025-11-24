import React, { useState, useEffect, useMemo } from 'react';
import { Timeframe, HeatmapTheme } from '../types';
import { Activity, Zap, Coins, Cloud, CloudOff, TrendingUp, Sliders, Clock, Maximize, Minimize, CalendarClock } from 'lucide-react';

interface ControlsProps {
  timeframe: Timeframe;
  setTimeframe: (t: Timeframe) => void;
  history: string;
  setHistory: (h: string) => void;
  leverage: number;
  setLeverage: (l: number) => void;
  noiseFilter: number;
  setNoiseFilter: (s: number) => void;
  sensitivity: number;
  setSensitivity: (s: number) => void;
  theme: HeatmapTheme;
  setTheme: (t: HeatmapTheme) => void;
  symbol: string;
  setSymbol: (s: string) => void;
  cloudMode: boolean;
  setCloudMode: (b: boolean) => void;
  localNormalization: boolean;
  setLocalNormalization: (b: boolean) => void;
  isCalculating: boolean;
  allSymbols?: string[];
}

const POPULAR_PAIRS = [
    "BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", 
    "DOGEUSDT", "ADAUSDT", "AVAXUSDT", "LINKUSDT", "WIFUSDT",
    "PEPEUSDT", "SHIBUSDT", "NEARUSDT", "FETUSDT", "RNDRUSDT",
    "ARBUSDT", "OPUSDT", "SUIUSDT", "APTUSDT", "INJUSDT", 
    "TIAUSDT", "SEIUSDT", "ORDIUSDT", "BONKUSDT", "LTCUSDT",
    "MATICUSDT", "DOTUSDT", "TRXUSDT", "UNIUSDT", "ATOMUSDT",
    "FILUSDT", "JUPUSDT", "PYTHUSDT", "IMXUSDT", "STXUSDT"
];

const Controls: React.FC<ControlsProps> = ({
  timeframe,
  setTimeframe,
  history,
  setHistory,
  leverage,
  setLeverage,
  noiseFilter,
  setNoiseFilter,
  sensitivity,
  setSensitivity,
  theme,
  setTheme,
  symbol,
  setSymbol,
  cloudMode,
  setCloudMode,
  localNormalization,
  setLocalNormalization,
  isCalculating,
  allSymbols = []
}) => {
  const timeframes: Timeframe[] = [
    '1m', '3m', '5m', '15m', '30m', 
    '1h', '2h', '4h', '6h', '8h', '12h', 
    '1d', '3d', '1w', '1M'
  ];

  const historyOptions = [
    { label: '12H', value: '12h' },
    { label: '1D', value: '1d' },
    { label: '3D', value: '3d' },
    { label: '1W', value: '1w' },
    { label: '1M', value: '1M' },
    { label: '3M', value: '3M' },
    { label: '6M', value: '6M' },
    { label: '1Y', value: '1y' },
    { label: '2Y', value: '2y' },
    { label: '3Y', value: '3y' },
    { label: '5Y', value: '5y' },
    { label: 'Max', value: 'max' },
  ];
  
  const colorKeys: (keyof HeatmapTheme)[] = ['low', 'medium', 'high', 'extreme'];

  // Local state for input
  const [tickerInput, setTickerInput] = useState(symbol);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Sync if symbol changes externally
  useEffect(() => {
    setTickerInput(symbol);
  }, [symbol]);

  const suggestions = useMemo(() => {
    const input = tickerInput.toUpperCase().trim();
    // Use the comprehensive list if available, otherwise fallback to popular list
    const sourceList = allSymbols.length > 0 ? allSymbols : POPULAR_PAIRS;

    if (!input) {
        // Just show popular pairs as "Trending" default if no input
        return POPULAR_PAIRS.slice(0, 15);
    }
    
    // Filter and Sort
    const matches = sourceList.filter(p => p.includes(input));
    matches.sort((a, b) => {
        const aStarts = a.startsWith(input);
        const bStarts = b.startsWith(input);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        // Prefer shorter symbols (e.g. searching "ETH" -> "ETHUSDT" over "ETHBTC")
        return a.length - b.length || a.localeCompare(b);
    });

    return matches.slice(0, 50);
  }, [tickerInput, allSymbols]);

  const handleTickerSubmit = () => {
    if (tickerInput.trim()) {
        setSymbol(tickerInput.toUpperCase().trim());
        setShowSuggestions(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
        handleTickerSubmit();
        (e.currentTarget as HTMLInputElement).blur();
        setShowSuggestions(false);
    } else if (e.key === 'Escape') {
        setShowSuggestions(false);
        (e.currentTarget as HTMLInputElement).blur();
    }
  };

  return (
    <div className="w-full h-16 bg-[#050505]/90 backdrop-blur-xl border-b border-white/5 px-4 xl:px-6 flex items-center justify-between z-50 shadow-2xl">
      
      {/* Left Group: Identity & Data Controls */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600/10 rounded flex items-center justify-center border border-blue-500/20 shadow-[0_0_10px_rgba(37,99,235,0.2)]">
             <Activity size={16} className="text-blue-500" />
          </div>
          <div className="flex flex-col hidden sm:flex">
            <h1 className="text-sm font-bold text-gray-100 tracking-wider font-mono">LIQMAP<span className="text-blue-500">.PRO</span></h1>
          </div>
        </div>

        <div className="h-8 w-px bg-white/10 hidden sm:block"></div>

        <div className="flex items-center gap-2">
            {/* Asset Input (Search with Suggestions) */}
            <div className="relative group">
                <Coins size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none group-hover:text-blue-400 transition-colors z-10" />
                <input 
                  type="text"
                  value={tickerInput}
                  onChange={(e) => {
                    setTickerInput(e.target.value.toUpperCase());
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => {
                      // Small delay to allow click event to register on suggestions
                      setTimeout(() => {
                          handleTickerSubmit();
                          setShowSuggestions(false);
                      }, 200);
                  }}
                  onKeyDown={handleKeyDown}
                  className="pl-9 pr-4 py-1.5 bg-white/5 border border-white/5 hover:border-white/10 hover:bg-white/10 text-sm text-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all font-mono uppercase w-36 placeholder-gray-600"
                  placeholder="Search..."
                  autoComplete="off"
                />
                
                {/* Suggestions Dropdown */}
                {showSuggestions && (
                    <div className="absolute top-full left-0 w-48 mt-1 bg-[#0a0a0a] border border-white/10 rounded-md shadow-[0_10px_40px_rgba(0,0,0,0.5)] overflow-hidden z-[60] py-1 max-h-[300px] overflow-y-auto custom-scrollbar">
                        <div className="text-[10px] font-bold text-gray-500 px-3 py-1.5 uppercase tracking-wider bg-white/5 mb-1 sticky top-0 backdrop-blur-sm flex justify-between">
                            <span>{tickerInput ? 'Matches' : 'Popular'}</span>
                            {allSymbols.length > 0 && <span className="text-[9px] text-blue-500/80">API LINKED</span>}
                        </div>
                        {suggestions.length > 0 ? (
                             suggestions.map(s => (
                                <button 
                                    key={s}
                                    onMouseDown={(e) => {
                                        e.preventDefault(); // Prevent input blur
                                        setTickerInput(s);
                                        setSymbol(s);
                                        setShowSuggestions(false);
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-blue-500/10 hover:text-blue-200 transition-colors font-mono border-l-2 border-transparent hover:border-blue-500 flex items-center justify-between"
                                >
                                    <span>{s}</span>
                                    {/* Optional: Add small trend icon or similar if desired, keeping it simple for now */}
                                </button>
                            ))
                        ) : (
                            <div className="px-3 py-2 text-xs text-gray-600 italic text-center">No matches found</div>
                        )}
                    </div>
                )}
            </div>

            {/* Timeframe Selector */}
            <div className="relative group">
                <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none group-hover:text-blue-400 transition-colors" />
                <select 
                    value={timeframe} 
                    onChange={(e) => setTimeframe(e.target.value as Timeframe)}
                    className="pl-9 pr-8 py-1.5 bg-white/5 border border-white/5 hover:border-white/10 hover:bg-white/10 text-sm text-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all cursor-pointer font-mono uppercase w-24"
                >
                    {timeframes.map(tf => (
                        <option key={tf} value={tf}>{tf}</option>
                    ))}
                </select>
            </div>

            {/* History / Lookback Selector */}
            <div className="relative group">
                <CalendarClock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none group-hover:text-blue-400 transition-colors" />
                <select 
                    value={history} 
                    onChange={(e) => setHistory(e.target.value)}
                    className="pl-9 pr-8 py-1.5 bg-white/5 border border-white/5 hover:border-white/10 hover:bg-white/10 text-sm text-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all cursor-pointer font-mono uppercase w-24"
                >
                    {historyOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
            </div>

             {/* Leverage Selector */}
             <div className="relative group hidden md:block">
                <TrendingUp size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none group-hover:text-blue-400 transition-colors" />
                <select 
                    value={leverage} 
                    onChange={(e) => setLeverage(Number(e.target.value))}
                    className="pl-9 pr-8 py-1.5 bg-white/5 border border-white/5 hover:border-white/10 hover:bg-white/10 text-sm text-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all cursor-pointer font-mono w-28"
                >
                    <option value={2}>2x Safe</option>
                    <option value={3}>3x Low</option>
                    <option value={5}>5x Low</option>
                    <option value={10}>10x Mod</option>
                    <option value={20}>20x Std</option>
                    <option value={25}>25x High</option>
                    <option value={50}>50x Risk</option>
                    <option value={75}>75x Agg</option>
                    <option value={100}>100x Degen</option>
                    <option value={125}>125x Max</option>
                </select>
            </div>
        </div>
      </div>

      {/* Right Group: Visual Controls */}
      <div className="flex items-center gap-6">
         
         <div className="flex items-center gap-5 mr-4">
            {/* Filter Slider */}
            <div className="flex flex-col w-20 xl:w-24 gap-1.5 group">
                <div className="flex justify-between text-[9px] font-bold text-gray-500 uppercase tracking-widest group-hover:text-gray-300 transition-colors">
                    <span className="flex items-center gap-1"><Sliders size={8} /> Filter</span>
                    <span>{(noiseFilter * 100).toFixed(0)}%</span>
                </div>
                <input
                    type="range"
                    min="0"
                    max="0.8"
                    step="0.05"
                    value={noiseFilter}
                    onChange={(e) => setNoiseFilter(parseFloat(e.target.value))}
                    className="w-full h-5 cursor-pointer"
                />
            </div>

            {/* Sensitivity Slider */}
            <div className="flex flex-col w-20 xl:w-24 gap-1.5 group">
                <div className="flex justify-between text-[9px] font-bold text-gray-500 uppercase tracking-widest group-hover:text-blue-400 transition-colors">
                    <span className="flex items-center gap-1"><Zap size={8} /> Gain</span>
                    <span>{sensitivity.toFixed(1)}x</span>
                </div>
                <input
                    type="range"
                    min="0.5"
                    max="5.0"
                    step="0.1"
                    value={sensitivity}
                    onChange={(e) => setSensitivity(parseFloat(e.target.value))}
                    className="w-full h-5 cursor-pointer"
                />
            </div>
         </div>

         <div className="h-8 w-px bg-white/10 hidden lg:block"></div>
        
        <div className="flex items-center gap-2">
             <button 
                onClick={() => setCloudMode(!cloudMode)}
                className={`p-2 rounded border transition-all ${
                    cloudMode 
                    ? 'bg-blue-500/10 border-blue-500/40 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]' 
                    : 'bg-transparent border-transparent text-gray-600 hover:text-gray-300 hover:bg-white/5'
                }`}
                title="Toggle Cloud Mode"
            >
                {cloudMode ? <Cloud size={18} /> : <CloudOff size={18} />}
            </button>

             <button 
                onClick={() => setLocalNormalization(!localNormalization)}
                className={`p-2 rounded border transition-all ${
                    localNormalization 
                    ? 'bg-green-500/10 border-green-500/40 text-green-400 shadow-[0_0_15px_rgba(34,197,94,0.2)]' 
                    : 'bg-transparent border-transparent text-gray-600 hover:text-gray-300 hover:bg-white/5'
                }`}
                title="Toggle Local Normalization"
            >
                {localNormalization ? <Maximize size={18} /> : <Minimize size={18} />}
            </button>
        </div>
        
        {/* Color Pickers */}
        <div className="flex items-center gap-2">
            <div className="flex -space-x-1.5">
                {colorKeys.map((key) => (
                    <div key={key} className="relative w-6 h-6 rounded-full border-2 border-[#050505] shadow-sm hover:scale-110 hover:z-20 transition-transform cursor-pointer group">
                         <div className="absolute inset-0 w-full h-full rounded-full pointer-events-none" style={{ backgroundColor: theme[key] }}></div>
                         <input 
                            type="color" 
                            value={theme[key]} 
                            onChange={(e) => {
                                const newTheme = { ...theme, [key]: e.target.value };
                                setTheme(newTheme);
                            }}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 p-0 m-0"
                        />
                    </div>
                ))}
            </div>
        </div>

        <div className="flex items-center justify-center w-6">
            {isCalculating ? (
                 <div className="animate-spin text-yellow-500"><Zap size={14} /></div>
            ) : (
                 <div className="w-1.5 h-1.5 bg-green-500 rounded-full shadow-[0_0_8px_#22c55e] animate-pulse"></div>
            )}
        </div>

      </div>
    </div>
  );
};

export default Controls;