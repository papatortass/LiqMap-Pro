
export interface Candle {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type Timeframe = '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '2h' | '4h' | '6h' | '8h' | '12h' | '1d' | '3d' | '1w' | '1M';

export enum Leverage {
  SPOT = 1,
  SAFE = 2,
  LOW = 5,
  MODERATE = 10,
  STANDARD = 20,
  HIGH = 50,
  AGGRESSIVE = 75,
  DEGEN = 100,
  MAX = 125,
}

export interface LiquidationLevel {
  price: number;
  volume: number; // Represents the strength of the level (based on candle volume)
  type: 'long' | 'short';
  creationTime: number;
}

export interface HeatmapBucket {
  price: number; // Midpoint of bucket
  density: number; // Aggregated strength
}

export interface HeatmapSnapshot {
  time: number;
  buckets: HeatmapBucket[];
}

export interface HeatmapCalculationResult {
  snapshots: HeatmapSnapshot[];
  globalMaxDensity: number;
}

export interface ChartDimensions {
  width: number;
  height: number;
}

export interface HeatmapTheme {
  low: string;
  medium: string;
  high: string;
  extreme: string;
}

export interface CrosshairData {
  price: number;
  density: number;
  normalizedDensity: number;
}

// --- Drawing Tools Types ---

export type DrawingToolType = 
    | 'cursor' 
    | 'trend' 
    | 'ray'
    | 'arrow'
    | 'ruler'
    | 'long'
    | 'short'
    | 'horizontal' 
    | 'vertical' 
    | 'fib' 
    | 'rectangle'
    | 'circle'
    | 'brush';

export interface ChartPoint {
    time: number; // Unix timestamp
    price: number;
}

export interface DrawingStyle {
    color: string;
    lineWidth: number;
    lineStyle: 'solid' | 'dashed' | 'dotted';
    fillOpacity: number; // 0 to 1
}

export interface Drawing {
    id: string;
    type: DrawingToolType;
    points: ChartPoint[]; 
    style: DrawingStyle;
}