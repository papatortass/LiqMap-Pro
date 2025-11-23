
import React from 'react';
import { Timeframe, HeatmapTheme } from '../types';
import { Activity, Zap, Coins, Cloud, CloudOff, TrendingUp, Palette, Sliders, Clock, Maximize, Minimize } from 'lucide-react';

interface ControlsProps {
  timeframe: Timeframe;
  setTimeframe: (t: Timeframe) => void;
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
}

const Controls: React.FC<ControlsProps> = ({
  timeframe,
  setTimeframe,
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
  isCalculating
}) => {
  // Full list of supported timeframes
  const timeframes: Timeframe[] = [
    '1m', '3m', '5m', '15m', '30m', 
    '1h', '2h', '4h', '6h', '8h', '12h', 
    '1d', '3d', '1w', '1M'
  ];
  
  const assets = [
    { value: 'BTCUSDT', label: 'BTC' },
    { value: 'ETHUSDT', label: 'ETH' },
    { value: 'SOLUSDT', label: 'SOL' },
    { value: 'BNBUSDT', label: 'BNB' },
    { value: 'XRPUSDT', label: 'XRP' },
    { value: 'DOGEUSDT', label: 'DOGE' },
    { value: 'AVAXUSDT', label: 'AVAX' },
    { value: 'PEPEUSDT', label: 'PEPE' },
    { value: 'WIFUSDT', label: 'WIF' },
  ];

  const colorKeys: (keyof HeatmapTheme)[] = ['low', 'medium', 'high', 'extreme'];

  return (
    <div className="w-full h-16 bg-[#050505]/90 backdrop-blur-xl border-b border-white/5 px-4 xl:px-6 flex items-center justify-between z-50 shadow-2xl">
      
      {/* Left Group: Identity & Data Controls (Asset, Time, Lev) */}
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
            {/* Asset Selector */}
            <div className="relative group">
                <Coins size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none group-hover:text-blue-400 transition-colors" />
                <select 
                    value={symbol} 
                    onChange={(e) => setSymbol(e.target.value)}
                    className="pl-9 pr-8 py-1.5 bg-white/5 border border-white/5 hover:border-white/10 hover:bg-white/10 text-sm text-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all cursor-pointer font-mono uppercase w-32"
                >
                    {assets.map(asset => (
                        <option key={asset.value} value={asset.value}>{asset.label}</option>
                    ))}
                </select>
            </div>

            {/* Timeframe Selector (Compact) */}
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

             {/* Leverage Selector */}
             <div className="relative group hidden md:block">
                <TrendingUp size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none group-hover:text-blue-400 transition-colors" />
                <select 
                    value={leverage} 
                    onChange={(e) => setLeverage(Number(e.target.value))}
                    className="pl-9 pr-8 py-1.5 bg-white/5 border border-white/5 hover:border-white/10 hover:bg-white/10 text-sm text-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all cursor-pointer font-mono w-28"
                >
                    <option value={1}>1x Spot</option>
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

        {/* Pulse Indicator */}
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
