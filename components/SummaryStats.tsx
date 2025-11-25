import React from 'react';
import { SimulationResult, AppState } from '../types';

interface SummaryStatsProps {
  result: SimulationResult;
  state: AppState;
}

const StatCard = ({ label, value, subtext, color = "text-white" }: { label: string, value: string, subtext?: string, color?: string }) => (
  <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">{label}</p>
    <p className={`text-xl font-bold font-mono ${color}`}>{value}</p>
    {subtext && <p className="text-xs text-slate-500 mt-1">{subtext}</p>}
  </div>
);

const SummaryStats: React.FC<SummaryStatsProps> = ({ result, state }) => {
  // Calculate current amounts formatted
  const formatUSD = (num: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
  const formatNum = (num: number, d = 4) => new Intl.NumberFormat('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }).format(num);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <StatCard 
        label="Position Value" 
        value={formatUSD(result.currentValue)}
        subtext="Initial Deposit"
      />
      
      {state.apr > 0 ? (
         <StatCard 
            label="Risk Payoff Time" 
            value={result.maxRisk > 0 ? `${result.daysToBreakeven.toFixed(1)} Days` : "Risk Free"}
            subtext={`To cover ${formatUSD(result.maxRisk)} loss`}
            color="text-amber-400"
          />
      ) : (
        <StatCard 
          label="Asset Distribution" 
          value={`${formatNum(result.amountX, 2)} Base`}
          subtext={`+ ${formatNum(result.amountY, 2)} Quote`}
          color="text-blue-400"
        />
      )}
      
      {state.isHedgeEnabled ? (
        <>
           <StatCard 
            label="Hedge Short Size" 
            value={formatNum(result.hedgeShortAmount, 4)}
            subtext="Base Asset Units"
            color="text-emerald-400"
          />
          <StatCard 
            label="Required Capital" 
            value={formatUSD(result.hedgeCapitalRequired)}
            subtext="To open short at entry"
            color="text-emerald-400"
          />
        </>
      ) : (
         <>
         {/* If APR is active, we shifted asset distribution out. If not, we show Hedge Status. 
             If APR is active and Hedge is inactive, we need to fill the slot.
             Let's just show Asset Distribution in slot 3 if APR took slot 2. */}
         {state.apr > 0 ? (
             <StatCard 
                label="Asset Distribution" 
                value={`${formatNum(result.amountX, 2)} Base`}
                subtext={`+ ${formatNum(result.amountY, 2)} Quote`}
                color="text-blue-400"
             />
         ) : (
             <StatCard 
                label="Hedge Status" 
                value="Inactive"
                subtext="Enable to see reqs"
                color="text-slate-500"
            />
         )}
         
         {/* Slot 4 filling if needed */}
         {state.apr > 0 && !state.isHedgeEnabled && (
            <StatCard 
                label="Hedge Status" 
                value="Inactive"
                subtext="Enable to see reqs"
                color="text-slate-500"
            />
         )}
         </>
      )}
    </div>
  );
};

export default SummaryStats;