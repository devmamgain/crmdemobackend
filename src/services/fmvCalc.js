/**
 * Deterministic FMV maths. Pure functions, no I/O — this is the single source of truth for numbers.
 * The LLM never computes or alters any value produced here.
 *
 * Recovery pipeline per inventory line:
 *   comparable transactions -> median -> x condition factor = unit FMV
 *   total recovery value = unit FMV x quantity
 *   recommended buy price = recovery value x buyRatio
 *   estimated resale value = recovery value x resaleRatio
 *   estimated margin       = resale value - buy price
 */
export const CONDITIONS = ['Excellent', 'Good', 'Fair', 'Poor'];
export const DEFAULT_CONDITION_ADJUSTMENTS = { Excellent: 1.1, Good: 1.0, Fair: 0.85, Poor: 0.65 };

export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

export function median(nums) {
  const a = nums.filter((n) => Number.isFinite(n)).sort((x, y) => x - y);
  if (!a.length) return null;
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

const CONDITION_ALIASES = {
  excellent: 'Excellent', 'like new': 'Excellent', new: 'Excellent', a: 'Excellent', 'grade a': 'Excellent', mint: 'Excellent',
  good: 'Good', b: 'Good', 'grade b': 'Good', used: 'Good', working: 'Good',
  fair: 'Fair', c: 'Fair', 'grade c': 'Fair', average: 'Fair', 'minor damage': 'Fair',
  poor: 'Poor', d: 'Poor', 'grade d': 'Poor', damaged: 'Poor', broken: 'Poor', 'for parts': 'Poor',
};

/** Returns a canonical condition; `assumed` is true when we had to default to Good. */
export function normalizeCondition(raw) {
  const key = String(raw ?? '').trim().toLowerCase();
  if (!key) return { condition: 'Good', assumed: true };
  const hit = CONDITION_ALIASES[key];
  return hit ? { condition: hit, assumed: false } : { condition: 'Good', assumed: true };
}

export function priceStats(prices = []) {
  const clean = prices.filter((p) => Number.isFinite(p) && p > 0);
  if (!clean.length) return { sampleCount: 0, min: null, max: null, median: null, spreadPct: null };
  const med = median(clean);
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  return { sampleCount: clean.length, min, max, median: med, spreadPct: round2(((max - min) / med) * 100) };
}

export function conditionFactor(adjustments, condition) {
  const f = adjustments?.[condition];
  return Number.isFinite(f) && f > 0 ? f : DEFAULT_CONDITION_ADJUSTMENTS[condition] ?? 1;
}

/** Values one inventory line. `ratios` = { buyRatio, resaleRatio }. */
export function valueLine({ prices, fallbackFMV, condition, quantity, adjustments }, { buyRatio, resaleRatio }) {
  const stats = priceStats(prices);
  const base = stats.median ?? (Number.isFinite(fallbackFMV) && fallbackFMV > 0 ? fallbackFMV : null);
  if (base === null) return null;
  const factor = conditionFactor(adjustments, condition);
  const fmvPerUnit = round2(base * factor);
  const totalFMV = round2(fmvPerUnit * quantity);
  const recommendedBuy = round2(totalFMV * buyRatio);
  const estimatedResale = round2(totalFMV * resaleRatio);
  return {
    baseFMV: round2(base),
    conditionFactor: factor,
    fmvPerUnit,
    totalFMV, // = total recovery value for the line
    recommendedBuyPerUnit: round2(fmvPerUnit * buyRatio),
    recommendedBuy,
    estimatedResale,
    potentialMargin: round2(estimatedResale - recommendedBuy),
    priceStats: stats,
  };
}

/** Totals over valued lines only (lines without market data are excluded from sums). */
export function summarizeItems(items) {
  const valued = items.filter((i) => i.status === 'valued');
  const sum = (key) => round2(valued.reduce((acc, i) => acc + i[key], 0));
  const estimatedResaleValue = sum('estimatedResale');
  const estimatedPotentialMargin = sum('potentialMargin');
  return {
    itemsAnalyzed: items.length,
    itemsValued: valued.length,
    unmatchedCount: items.length - valued.length,
    totalQuantity: items.reduce((acc, i) => acc + i.quantity, 0),
    estimatedMarketValue: sum('totalFMV'), // total recovery value
    recommendedBuyValue: sum('recommendedBuy'),
    estimatedResaleValue,
    estimatedPotentialMargin,
    marginPct: estimatedResaleValue ? round2((estimatedPotentialMargin / estimatedResaleValue) * 100) : 0,
  };
}
