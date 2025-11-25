import { SimulationResult, ChartDataPoint } from '../types';

/**
 * Calculates the liquidity (L) for a V3 position given amounts and price range.
 * However, since we start with a "Deposit Amount" in USD (Value), we first need to 
 * determine the L that results in that total value at P_entry.
 */
export const calculateSimulation = (
  deposit: number,
  P_entry: number,
  P_min: number,
  P_max: number,
  hedgeEnabled: boolean,
  hedgePercent: number,
  apr: number
): SimulationResult => {
  // Safeguards against division by zero or invalid ranges
  const safePMin = Math.max(0.000001, P_min);
  const safePMax = Math.max(safePMin + 0.000001, P_max);
  const safePEntry = Math.max(0.000001, P_entry);

  // 1. Calculate Unit Liquidity Value at Entry
  // We calculate how much value 1 unit of Liquidity (L=1) has at P_entry
  const sqrtP = Math.sqrt(safePEntry);
  const sqrtPa = Math.sqrt(safePMin);
  const safeSqrtPb = Math.sqrt(safePMax);

  // Calculate amounts for L=1
  let x0 = 0;
  let y0 = 0;

  if (safePEntry < safePMin) {
    // Price below range: Position consists 100% of Asset X
    // x = L * (1/sqrt(Pa) - 1/sqrt(Pb))
    x0 = (1 / sqrtPa) - (1 / safeSqrtPb);
    y0 = 0;
  } else if (safePEntry >= safePMax) {
    // Price above range: Position consists 100% of Asset Y
    // y = L * (sqrt(Pb) - sqrt(Pa))
    x0 = 0;
    y0 = safeSqrtPb - sqrtPa;
  } else {
    // Price in range
    // x = L * (1/sqrt(P) - 1/sqrt(Pb))
    x0 = (1 / sqrtP) - (1 / safeSqrtPb);
    // y = L * (sqrt(P) - sqrt(Pa))
    y0 = sqrtP - sqrtPa;
  }

  const valuePerLiquidity = (x0 * safePEntry) + y0;
  
  // 2. Calculate Actual Liquidity L corresponding to Deposit Amount
  const L = deposit / valuePerLiquidity;

  // 3. Calculate Actual Initial Token Amounts
  const initialAmountX = x0 * L;
  const initialAmountY = y0 * L;
  const initialHoldValue = deposit; // Value if we just held the tokens

  // 4. Calculate Hedge Requirements
  // Logic: "At 100% hedge, the user is break-even at the bottom of the range."
  // Break-even means Total PnL = 0.
  // Total PnL = (LP_Value(P_min) - Deposit) + Hedge_PnL(P_min)
  // LP_Value(P_min) -> At P_min, we hold specific amounts.
  // Actually, let's compute the LP Value at P_min first.
  
  // Value of LP at P_min:
  // At P_min, we are at the bottom boundary.
  // x_min = L * (1/sqrt(Pa) - 1/sqrt(Pb))
  // y_min = 0
  // Value_min = x_min * P_min + 0
  
  const xAtMin = L * ((1 / Math.sqrt(safePMin)) - (1 / Math.sqrt(safePMax)));
  const valueAtMin = xAtMin * safePMin;
  
  const lossAtMin = deposit - valueAtMin; // This is positive if we lost money (Value < Deposit)
  
  // Hedge Payoff: Short Position.
  // Short PnL = ShortSizeAmount * (EntryPrice - CurrentPrice)
  // We need: ShortSizeAmount * (EntryPrice - MinPrice) = LossAtMin
  // ShortSizeAmount = LossAtMin / (EntryPrice - MinPrice)
  
  let fullHedgeShortAmount = 0;
  if (safePEntry > safePMin) {
    fullHedgeShortAmount = lossAtMin / (safePEntry - safePMin);
  }
  
  // Apply user hedge percentage
  const actualShortAmount = fullHedgeShortAmount * (hedgePercent / 100);
  const hedgeCapital = actualShortAmount * safePEntry;

  // 5. Generate Chart Data
  // We span the selected range plus a small buffer (15% of range width)
  const rangeSpan = safePMax - safePMin;
  const padding = rangeSpan * 0.15;
  
  const plotMin = Math.max(0, safePMin - padding);
  const plotMax = safePMax + padding;
  
  // Increase resolution and include critical points
  const steps = 500;
  const stepSize = (plotMax - plotMin) / steps;
  
  const pricesSet = new Set<number>();
  
  // Generate grid points
  for (let i = 0; i <= steps; i++) {
    pricesSet.add(plotMin + (i * stepSize));
  }
  
  // Explicitly include critical prices for accurate tooltip/hovering
  pricesSet.add(safePMin);
  pricesSet.add(safePMax);
  pricesSet.add(safePEntry);

  // Sort prices for correct line rendering
  const sortedPrices = Array.from(pricesSet).sort((a, b) => a - b);

  const data: ChartDataPoint[] = [];

  for (const p of sortedPrices) {
    const sp = Math.sqrt(p);

    // Calculate LP Value at p
    let lx = 0;
    let ly = 0;

    if (p < safePMin) {
      lx = L * ((1 / sqrtPa) - (1 / safeSqrtPb));
      ly = 0;
    } else if (p >= safePMax) {
      lx = 0;
      ly = L * (safeSqrtPb - sqrtPa);
    } else {
      lx = L * ((1 / sp) - (1 / safeSqrtPb));
      ly = L * (sp - sqrtPa);
    }

    const lpValue = (lx * p) + ly;

    // Calculate HODL Value (Value if we just held initial X and Y)
    const holdValue = (initialAmountX * p) + initialAmountY;

    // Impermanent Loss
    const il = lpValue - holdValue;
    const ilPercent = holdValue !== 0 ? (il / holdValue) * 100 : 0;

    // LP PnL (vs Deposit)
    const lpPnL = lpValue - deposit;

    // Hedge PnL
    // Short pays off if Price < Entry
    let hPnL = 0;
    if (hedgeEnabled) {
      hPnL = actualShortAmount * (safePEntry - p);
    }
    
    const totalPnL = lpPnL + hPnL;
    const totalPnLPercent = (totalPnL / deposit) * 100;

    data.push({
      price: p,
      value: lpValue,
      holdValue: holdValue,
      pnl: lpPnL,
      pnlPercent: (lpPnL / deposit) * 100,
      impermanentLoss: il,
      impermanentLossPercent: ilPercent,
      hedgePnL: hPnL,
      totalPnL: totalPnL,
      totalPnLPercent: totalPnLPercent
    });
  }

  // 6. Calculate Risk and Time to Pay Off
  // Risk is defined as the worst PnL at the boundaries (Min or Max price)
  // We can look up the exact points in our data array since we added them to the set.
  // Using a small epsilon for float comparison safety
  const minPoint = data.find(d => Math.abs(d.price - safePMin) < 0.00001);
  const maxPoint = data.find(d => Math.abs(d.price - safePMax) < 0.00001);

  const pnlAtMin = minPoint ? minPoint.totalPnL : 0;
  const pnlAtMax = maxPoint ? maxPoint.totalPnL : 0;

  // "Lower" PnL implies the worst loss (most negative number)
  const worstPnL = Math.min(pnlAtMin, pnlAtMax);
  
  // MaxRisk is the absolute magnitude of that loss. If PnL is positive, Risk is 0.
  const maxRisk = worstPnL < 0 ? Math.abs(worstPnL) : 0;

  let daysToBreakeven = 0;
  if (apr > 0 && maxRisk > 0) {
    const dailyRevenue = deposit * (apr / 100) / 365;
    daysToBreakeven = maxRisk / dailyRevenue;
  }

  return {
    currentValue: deposit,
    liquidity: L,
    amountX: initialAmountX,
    amountY: initialAmountY,
    hedgeShortAmount: actualShortAmount,
    hedgeCapitalRequired: hedgeCapital,
    data,
    maxRisk,
    daysToBreakeven
  };
};

/**
 * Calculates the Hedge Percentage required to make PnL at Min Price equal to PnL at Max Price.
 * 
 * Logic:
 * TotalPnL(min) = Val(min) - Deposit + Short * (Entry - Min)
 * TotalPnL(max) = Val(max) - Deposit + Short * (Entry - Max)
 * 
 * Set equal and solve for Short:
 * Short = (Val(max) - Val(min)) / (Max - Min)
 * 
 * Then convert Short to Percentage based on the "Full Hedge" (Break-even at Min) definition.
 */
export const calculateEvenHedgePercentage = (
  deposit: number,
  P_entry: number,
  P_min: number,
  P_max: number
): number => {
  const safePMin = Math.max(0.000001, P_min);
  const safePMax = Math.max(safePMin + 0.000001, P_max);
  const safePEntry = Math.max(0.000001, P_entry);

  // 1. Calculate Liquidity L
  const sqrtP = Math.sqrt(safePEntry);
  const sqrtPa = Math.sqrt(safePMin);
  const safeSqrtPb = Math.sqrt(safePMax);

  let x0 = 0;
  let y0 = 0;

  if (safePEntry < safePMin) {
    x0 = (1 / sqrtPa) - (1 / safeSqrtPb);
    y0 = 0;
  } else if (safePEntry >= safePMax) {
    x0 = 0;
    y0 = safeSqrtPb - sqrtPa;
  } else {
    x0 = (1 / sqrtP) - (1 / safeSqrtPb);
    y0 = sqrtP - sqrtPa;
  }

  const valuePerLiquidity = (x0 * safePEntry) + y0;
  const L = deposit / valuePerLiquidity;

  // 2. Calculate Value at Min Price
  // At min, we hold all X. x = L * (1/sqrt(Pa) - 1/sqrt(Pb))
  const xAtMin = L * ((1 / Math.sqrt(safePMin)) - (1 / Math.sqrt(safePMax)));
  const valueAtMin = xAtMin * safePMin;

  // 3. Calculate Value at Max Price
  // At max, we hold all Y. y = L * (sqrt(Pb) - sqrt(Pa))
  const yAtMax = L * (Math.sqrt(safePMax) - Math.sqrt(safePMin));
  const valueAtMax = yAtMax;

  // 4. Calculate Required Short (Units of X) for Even PnL
  // S * (P_max - P_min) = Val(max) - Val(min)
  const requiredShortAmount = (valueAtMax - valueAtMin) / (safePMax - safePMin);

  // 5. Calculate Reference "100% Hedge" Short Amount (Break-even at Min)
  // Short100 = LossAtMin / (Entry - Min)
  const lossAtMin = deposit - valueAtMin;
  let fullHedgeShortAmount = 0;
  if (safePEntry > safePMin) {
    fullHedgeShortAmount = lossAtMin / (safePEntry - safePMin);
  }

  // 6. Convert to Percentage
  if (fullHedgeShortAmount <= 0) return 0;
  
  const percentage = (requiredShortAmount / fullHedgeShortAmount) * 100;
  return Math.max(0, percentage);
};