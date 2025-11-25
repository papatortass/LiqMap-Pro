import React, { useState, useMemo } from 'react';
import InputPanel from './components/InputPanel';
import SimulationChart from './components/Chart.tsx';
import SummaryStats from './components/SummaryStats';
import { AppState, SimulationResult } from './types';
import { calculateSimulation } from './utils/uniswapMath';

const App: React.FC = () => {
  // Default state based on a typical ETH/USDC scenario or similar
  const [state, setState] = useState<AppState>({
    minPrice: 1800,
    maxPrice: 2200,
    entryPrice: 2000,
    depositAmount: 10000,
    isHedgeEnabled: false,
    hedgePercentage: 100, // Default 100% hedge at lower bound
    apr: 0,
  });

  const handleStateChange = (newState: Partial<AppState>) => {
    setState((prev) => ({ ...prev, ...newState }));
  };

  // Memoize calculation to avoid re-running on every render if not needed
  // though React 18 batching makes this fast enough usually.
  const simulationResult: SimulationResult = useMemo(() => {
    return calculateSimulation(
      state.depositAmount,
      state.entryPrice,
      state.minPrice,
      state.maxPrice,
      state.isHedgeEnabled,
      state.hedgePercentage,
      state.apr
    );
  }, [state]);

  return (
    <div className="flex flex-col md:flex-row h-screen w-full overflow-hidden text-slate-200 font-sans">
      {/* Sidebar */}
      <InputPanel state={state} onChange={handleStateChange} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-950">
        {/* Header */}
        <header className="bg-slate-900/50 border-b border-slate-800 px-8 py-4 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                <span className="text-blue-500">Uni</span>V3 Analytics
              </h1>
              <p className="text-sm text-slate-400">Liquidity Provision & Hedge Simulator</p>
            </div>
            
            <div className="hidden md:block text-right text-xs text-slate-500">
              <p>Math Model: V3 Standard</p>
              <p>Hedge Model: Delta Short</p>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="p-4 md:p-8 max-w-7xl mx-auto w-full flex-1">
          
          <SummaryStats result={simulationResult} state={state} />

          <div className="space-y-6">
            <div className="bg-slate-900 rounded-xl p-1 shadow-2xl shadow-black/50">
              <SimulationChart data={simulationResult.data} state={state} />
            </div>

            {/* Educational / Math details block */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-6">
                <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  Impermanent Loss
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Impermanent loss occurs when the price of your deposited assets changes compared to when you deposited them. The larger the divergence, the more you lose compared to simply holding.
                  <br/><br/>
                  At current price <strong>${simulationResult.data.find(d => Math.abs(d.price - state.entryPrice) < 1)?.impermanentLoss.toFixed(2) || "0.00"}</strong> IL is incurred.
                </p>
              </div>

              <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-6">
                <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  Hedge Mechanics
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  The hedge simulates shorting the base asset. At 100% hedge setting, the short profit exactly offsets the LP Value loss at the range minimum ({state.minPrice}).
                  <br/><br/>
                  {state.isHedgeEnabled ? (
                    <span className="text-emerald-400">
                      Active: Shorting {simulationResult.hedgeShortAmount.toFixed(4)} units.
                    </span>
                  ) : (
                    <span className="text-slate-500">Hedge is currently disabled.</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;