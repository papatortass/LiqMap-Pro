import { Candle, Timeframe } from '../types';

const BASE_URL = 'https://fapi.binance.com/fapi/v1';

export const fetchCandles = async (symbol: string, interval: Timeframe, limit: number = 500): Promise<Candle[]> => {
  try {
    const response = await fetch(`${BASE_URL}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
    
    if (!response.ok) {
      throw new Error(`Binance API Error: ${response.statusText}`);
    }

    const data = await response.json();

    // Binance returns [time, open, high, low, close, vol, closeTime, quoteVol, trades, ...]
    // We map to our Candle interface
    return data.map((d: any) => ({
      time: d[0] / 1000, // Convert ms to seconds for lightweight-charts
      open: parseFloat(d[1]),
      high: parseFloat(d[2]),
      low: parseFloat(d[3]),
      close: parseFloat(d[4]),
      volume: parseFloat(d[5]),
    }));
  } catch (error) {
    console.error("Failed to fetch candles:", error);
    throw error;
  }
};
