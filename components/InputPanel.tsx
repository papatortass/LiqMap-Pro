import React from 'react';
import { AppState } from '../types';
import { calculateEvenHedgePercentage } from '../utils/uniswapMath';

interface InputPanelProps {
  state: AppState;
  onChange: (newState: Partial<AppState>) => void;
}

const InputPanel: React.FC<InputPanelProps> = ({ state, onChange }) => {
  const handleChange = (key: keyof AppState, value: string | boolean) => {
    if (typeof value === 'boolean') {
      onChange({ [key]: value });
    } else {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        onChange({ [key]: num });
      }
    }
  };

  const handleEvenHedge = () => {
    const pct = calculateEvenHedgePercentage(
      state.depositAmount,
      state.entryPrice,
      state.minPrice,
      state.maxPrice
    );
    onChange({ 
      isHedgeEnabled: true, 
      hedgePercentage: parseFloat(pct.toFixed(1)) 
    });
  };

  return (
    <div className="bg-slate-900 p-6 border-r border-slate-800 h-full overflow-y-auto w-full md:w-80 flex-shrink-0">
      <h2 className="text-xl font-bold mb-6 text-white tracking-tight">Configuration</h2>
      
      <div className="space-y-6">
        {/* Position Inputs */}
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Liquidity Position</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Deposit Amount ($)</label>
              <input 
                type="number" 
                value={state.depositAmount}
                onChange={(e) => handleChange('depositAmount', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Entry Price</label>
              <input 
                type="number" 
                value={state.entryPrice}
                onChange={(e) => handleChange('entryPrice', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none transition"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Min Price</label>
                <input 
                  type="number" 
                  value={state.minPrice}
                  onChange={(e) => handleChange('minPrice', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Max Price</label>
                <input 
                  type="number" 
                  value={state.maxPrice}
                  onChange={(e) => handleChange('maxPrice', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Estimated APR (%)</label>
              <input 
                type="number" 
                value={state.apr}
                onChange={(e) => handleChange('apr', e.target.value)}
                placeholder="0"
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none transition"
              />
            </div>
          </div>
        </div>

        <hr className="border-slate-800" />

        {/* Hedge Inputs */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Hedge Strategy</h3>
            <label className="inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={state.isHedgeEnabled} 
                onChange={(e) => handleChange('isHedgeEnabled', e.target.checked)}
                className="sr-only peer" 
              />
              <div className="relative w-9 h-5 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>
          
          <div className={`transition-all duration-300 ${state.isHedgeEnabled ? 'opacity-100 max-h-64' : 'opacity-50 max-h-64 pointer-events-none grayscale'}`}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-1">Hedge Ratio (%)</label>
              <div className="flex items-center gap-3">
                <input 
                  type="range" 
                  min="0" 
                  max="200" 
                  value={state.hedgePercentage}
                  onChange={(e) => handleChange('hedgePercentage', e.target.value)}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <span className="text-sm font-mono w-12 text-right text-emerald-400">{state.hedgePercentage}%</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                100% = Break-even at Min Price.
              </p>
            </div>

            <button 
               onClick={handleEvenHedge}
               className="w-full py-2 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-emerald-500/50 text-emerald-400 hover:text-emerald-300 text-xs font-bold rounded uppercase tracking-wider transition mb-2 flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2"/>
              </svg>
              Set Even PnL (Min/Max)
            </button>
            
          </div>
        </div>
        
        <div className="bg-slate-800/50 p-4 rounded border border-slate-800">
           <p className="text-xs text-slate-400 leading-relaxed">
             <strong>Tip:</strong> Input an APR to see how many days of yield are required to cover potential losses at the range boundaries.
           </p>
        </div>

      </div>
    </div>
  );
};

export default InputPanel;