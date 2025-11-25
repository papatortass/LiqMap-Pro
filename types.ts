export interface AppState {
  minPrice: number;
  maxPrice: number;
  entryPrice: number;
  depositAmount: number;
  isHedgeEnabled: boolean;
  hedgePercentage: number; // 0 to 100
  apr: number; // Annual Percentage Rate
}

export interface ChartDataPoint {
  price: number;
  value: number;
  holdValue: number;
  pnl: number;
  pnlPercent: number;
  impermanentLoss: number;
  impermanentLossPercent: number;
  hedgePnL: number;
  totalPnL: number;
  totalPnLPercent: number;
}

export interface SimulationResult {
  currentValue: number; // Value at entry price (should match deposit)
  liquidity: number;
  amountX: number; // At entry
  amountY: number; // At entry
  hedgeShortAmount: number; // In units of asset X
  hedgeCapitalRequired: number; // In USD (shortAmount * entryPrice)
  data: ChartDataPoint[];
  maxRisk: number; // Absolute dollar value of worst PnL at boundaries
  daysToBreakeven: number; // Days to cover maxRisk with APR
}