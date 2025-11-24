import { Candle, Timeframe } from '../types';

const FAPI_URL = 'https://fapi.binance.com/fapi/v1';
const SPOT_URL = 'https://api.binance.com/api/v3';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to map Futures symbols to Spot symbols (e.g. 1000PEPEUSDT -> PEPEUSDT)
const mapToSpotSymbol = (symbol: string): string => {
  if (symbol.startsWith('1000')) {
    return symbol.replace('1000', '');
  }
  return symbol;
};

export const fetchCandles = async (symbol: string, interval: Timeframe, totalLimit: number = 500): Promise<Candle[]> => {
  // OPTIMIZATION: Store raw data arrays instead of objects to save memory during massive fetches
  const rawChunks: any[][] = [];
  let remaining = totalLimit;
  let endTime: number | undefined;
  
  const MAX_BATCHES = 100000; // Increased to 100k batches (approx 100m candles capacity)
  let batchCount = 0;
  
  // State to track if we have fallen back to Spot data
  let useSpot = false;

  // Rate Limit State
  let usedWeight1m = 0;

  try {
    while (remaining > 0 && batchCount < MAX_BATCHES) {
        // Futures max limit 1500, Spot max limit 1000
        const maxLimitPerReq = useSpot ? 1000 : 1500;
        const currentLimit = Math.min(remaining, maxLimitPerReq);
        
        const baseUrl = useSpot ? SPOT_URL : FAPI_URL;
        // Apply symbol mapping if using Spot (handle 1000PEPE -> PEPE)
        const currentSymbol = useSpot ? mapToSpotSymbol(symbol) : symbol;

        let url = `${baseUrl}/klines?symbol=${currentSymbol}&interval=${interval}&limit=${currentLimit}`;
        if (endTime) {
            url += `&endTime=${endTime}`;
        }

        // --- PROACTIVE RATE LIMITING ---
        // Spot limit ~1200, Futures ~2400.
        // We throttle if we get too close.
        const safetyThreshold = useSpot ? 800 : 1800;
        
        if (usedWeight1m > safetyThreshold) {
            // console.debug(`[Binance API] Weight ${usedWeight1m} > ${safetyThreshold}. Cooling down...`);
            await delay(2500); 
            usedWeight1m = 0; 
        }

        let response: Response | null = null;
        let attempts = 0;
        const maxAttempts = 15; 
        let success = false;
        let stopFetching = false;

        // Retry Loop
        while (attempts < maxAttempts && !success) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s Timeout

                response = await fetch(url, { signal: controller.signal });
                clearTimeout(timeoutId);
                
                // Update weight from headers
                const weightHeader = response.headers.get('x-mbx-used-weight-1m');
                if (weightHeader) {
                    usedWeight1m = parseInt(weightHeader, 10);
                }

                if (response.status === 429 || response.status === 418) {
                    const retryAfter = response.headers.get('Retry-After');
                    const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 5000 * Math.pow(2, attempts);
                    console.warn(`[Binance API] Rate limit hit (429). Pausing for ${waitTime}ms...`);
                    await delay(waitTime);
                    usedWeight1m = 0; // Reset local tracker after penalty
                    attempts++;
                    continue;
                }
                
                if (response.status === 400 || response.status === 404) {
                    // If Spot returns 400, it likely means the symbol doesn't exist or we went too far back
                    // console.warn(`[Binance API] Resource not found (Status ${response.status}). Stopping.`);
                    stopFetching = true;
                    break;
                }

                if (!response.ok) {
                    if (response.status >= 500) {
                        await delay(1000 * (attempts + 1));
                        attempts++;
                        continue;
                    }
                    attempts++;
                    await delay(1000);
                    continue;
                }

                success = true;
            } catch (error) {
                // console.warn(`[Binance API] Network attempt ${attempts + 1} failed:`, error);
                attempts++;
                if (attempts >= maxAttempts) throw error;
                await delay(2000 * attempts);
            }
        }
        
        if (stopFetching) {
            break;
        }

        if (!response || !success) {
             console.error("Failed to fetch batch after multiple attempts. Returning partial data.");
             break; 
        }

        // Use any to bypass strict type check on raw JSON array
        const data: any[] = await response.json();

        if (!Array.isArray(data) || data.length === 0) {
            if (!useSpot) {
                useSpot = true;
                usedWeight1m = 0; // Reset weight for new endpoint
                continue; 
            }
            break;
        }

        // Store RAW data to save memory (don't map to objects yet)
        rawChunks.push(data);
        
        // Prepare for next batch (fetch older)
        const oldestOpenTime = data[0][0]; // data[0] is the oldest candle in the batch
        endTime = oldestOpenTime - 1;
        
        remaining -= data.length;
        batchCount++;

        // Switch Logic
        if (data.length < currentLimit) {
            if (!useSpot) {
                // Futures history exhausted, switch to Spot
                useSpot = true;
                usedWeight1m = 0; // Reset weight counter for Spot
                // Loop continues, next iteration uses Spot URL with `endTime`
            } else {
                // Spot history also exhausted
                break;
            }
        }

        // Dynamic Throttling
        const throttle = usedWeight1m > (safetyThreshold * 0.6) ? 300 : 20; 
        await delay(throttle);
    }
    
    // Process all raw chunks at the end
    // Reverse chunks (Oldest -> Newest) and flatten
    const result: Candle[] = [];
    
    // Iterate backwards through chunks (since we pushed Newest -> Oldest in the loop)
    // Actually wait: We pushed [NewestBatch, OlderBatch...]
    // Inside each batch: [OldestCandle...NewestCandle]
    // So we want to process chunks from LAST to FIRST
    for (let i = rawChunks.length - 1; i >= 0; i--) {
        const chunk = rawChunks[i];
        for (let j = 0; j < chunk.length; j++) {
            const d = chunk[j];
            result.push({
                time: d[0] / 1000, 
                open: parseFloat(d[1]),
                high: parseFloat(d[2]),
                low: parseFloat(d[3]),
                close: parseFloat(d[4]),
                volume: parseFloat(d[5]),
            });
        }
    }

    return result;
  } catch (error) {
    console.error("Failed to fetch candles:", error);
    // Return partial data if available
    if (rawChunks.length > 0) {
        // Fallback processing
        const result: Candle[] = [];
        for (let i = rawChunks.length - 1; i >= 0; i--) {
             const chunk = rawChunks[i];
             for (let j = 0; j < chunk.length; j++) {
                const d = chunk[j];
                result.push({
                    time: d[0] / 1000, 
                    open: parseFloat(d[1]),
                    high: parseFloat(d[2]),
                    low: parseFloat(d[3]),
                    close: parseFloat(d[4]),
                    volume: parseFloat(d[5]),
                });
            }
        }
        return result;
    }
    throw error;
  }
};