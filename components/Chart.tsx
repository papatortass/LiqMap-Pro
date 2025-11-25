import React from 'react';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend
} from 'recharts';
import { ChartDataPoint, AppState } from '../types';

interface ChartProps {
  data: ChartDataPoint[];
  state: AppState;
}

const CustomTooltip = ({ active, payload, label, state }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as ChartDataPoint;
    const formatUSD = (num: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
    const formatPct = (num: number) => `${num > 0 ? '+' : ''}${num.toFixed(2)}%`;

    return (
      <div className="bg-slate-900 border border-slate-700 p-3 rounded shadow-xl text-sm z-50 min-w-[220px]">
        <p className="font-bold text-slate-200 mb-3 border-b border-slate-800 pb-2">Price: {formatUSD(data.price)}</p>
        
        <div className="space-y-2">
          <div className="flex justify-between items-center gap-4">
            <span className="text-blue-400">LP Value:</span>
            <span className="font-mono text-white">{formatUSD(data.value)}</span>
          </div>
          <div className="flex justify-between items-center gap-4">
            <span className="text-slate-400">HODL Value:</span>
            <span className="font-mono text-slate-300">{formatUSD(data.holdValue)}</span>
          </div>
          
          <div className="flex justify-between items-center gap-4 border-t border-slate-800 pt-2 mt-2">
            <span className="text-rose-400">Imperm. Loss:</span>
            <div className="text-right">
                <span className="font-mono text-rose-400 block">{formatUSD(data.impermanentLoss)}</span>
                <span className="font-mono text-rose-300/70 text-xs block">{formatPct(data.impermanentLossPercent)}</span>
            </div>
          </div>
          
          {state.isHedgeEnabled && (
            <div className="flex justify-between items-center gap-4">
              <span className="text-emerald-400">Hedge PnL:</span>
              <span className="font-mono text-emerald-400">{formatUSD(data.hedgePnL)}</span>
            </div>
          )}

          <div className="flex justify-between items-center gap-4 border-t border-slate-800 pt-2 mt-2 font-bold">
            <span className={state.isHedgeEnabled ? "text-purple-400" : "text-blue-400"}>
              Total PnL:
            </span>
            <div className="text-right">
                <span className={`font-mono block ${(state.isHedgeEnabled ? data.totalPnL : data.pnl) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatUSD(state.isHedgeEnabled ? data.totalPnL : data.pnl)}
                </span>
                <span className={`font-mono text-xs block ${(state.isHedgeEnabled ? data.totalPnLPercent : data.pnlPercent) >= 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>
                {formatPct(state.isHedgeEnabled ? data.totalPnLPercent : data.pnlPercent)}
                </span>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

const SimulationChart: React.FC<ChartProps> = ({ data, state }) => {
  // Calculate domain for Y-axis to make chart look good
  const allValues = data.flatMap(d => [d.value, d.holdValue, state.isHedgeEnabled ? (d.value + d.hedgePnL) : d.value]);
  const minVal = Math.min(...allValues) * 0.95;
  const maxVal = Math.max(...allValues) * 1.05;

  return (
    <div className="h-[500px] w-full bg-slate-900/50 border border-slate-800 rounded-lg p-4 relative">
      <div className="absolute top-4 right-4 flex gap-4 text-xs text-slate-400 z-10">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-500 rounded-sm"></div>
          <span>Unhedged PnL</span>
        </div>
        {state.isHedgeEnabled && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-emerald-500 rounded-sm"></div>
            <span>Total PnL (Hedged)</span>
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
          <XAxis 
            dataKey="price" 
            type="number" 
            domain={['dataMin', 'dataMax']} 
            tickFormatter={(val) => `$${val.toFixed(0)}`}
            stroke="#94a3b8"
            tick={{ fontSize: 12 }}
          />
          <YAxis 
            domain={[minVal, maxVal]}
            tickFormatter={(val) => `$${val.toFixed(0)}`}
            stroke="#94a3b8"
            tick={{ fontSize: 12 }}
            width={60}
          />
          <Tooltip content={<CustomTooltip state={state} />} />
          <Legend verticalAlign="top" height={36} content={() => null}/>
          
          {/* Range References */}
          <ReferenceLine x={state.minPrice} stroke="#64748b" strokeDasharray="3 3" label={{ value: "Min", fill: "#64748b", fontSize: 10 }} />
          <ReferenceLine x={state.maxPrice} stroke="#64748b" strokeDasharray="3 3" label={{ value: "Max", fill: "#64748b", fontSize: 10 }} />
          <ReferenceLine x={state.entryPrice} stroke="#fbbf24" strokeDasharray="3 3" label={{ value: "Entry", fill: "#fbbf24", fontSize: 10 }} />
          <ReferenceLine y={state.depositAmount} stroke="#ffffff" strokeOpacity={0.1} strokeDasharray="3 3" />

          {/* Unhedged LP Value - Render as Area to show "underwater" visually or just line */}
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke="#3b82f6" 
            strokeWidth={2} 
            dot={false} 
            activeDot={{ r: 6 }}
            name="LP Value"
          />

          {/* Hedged Value */}
          {state.isHedgeEnabled && (
            <Line 
              type="monotone" 
              dataKey={(d) => d.value + d.hedgePnL} 
              stroke="#10b981" 
              strokeWidth={3} 
              dot={false}
              name="Hedged Value"
            />
          )}
          
          {/* HODL Line (faint) for reference */}
          <Line 
            type="monotone" 
            dataKey="holdValue" 
            stroke="#64748b" 
            strokeWidth={1} 
            strokeDasharray="5 5"
            dot={false}
            opacity={0.5}
            name="HODL"
          />

        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SimulationChart;