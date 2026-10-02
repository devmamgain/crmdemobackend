import MarketValue from '../models/MarketValue.js';
import { ApiError } from '../utils/ApiError.js';
import { normalizeModel } from '../utils/text.js';
import { median, round2, DEFAULT_CONDITION_ADJUSTMENTS } from './fmvCalc.js';

/**
 * Market-data access layer. Today it reads the seeded MarketValue collection;
 * replace the internals of these functions to plug in a real market-data provider.
 */
export async function loadMarketIndex() {
  return MarketValue.find().lean();
}

/**
 * Exact normalized match first. Otherwise a conservative fuzzy match: every token of the uploaded
 * model must appear in exactly one best catalogue entry (e.g. "ThinkPad T14" -> "Lenovo ThinkPad T14").
 * Ambiguous matches return null so we never silently price the wrong device.
 */
export function findMatch(index, rawModel) {
  const q = normalizeModel(rawModel);
  if (!q) return null;
  const exact = index.find((d) => d.normalizedModel === q);
  if (exact) return { doc: exact, matchType: 'exact' };

  const qTokens = q.split(' ');
  if (qTokens.length < 2) return null;
  let best = null;
  let tie = false;
  for (const d of index) {
    const dTokens = new Set(d.normalizedModel.split(' '));
    if (!qTokens.every((t) => dTokens.has(t))) continue;
    const extra = dTokens.size - qTokens.length;
    if (!best || extra < best.extra) {
      best = { doc: d, extra };
      tie = false;
    } else if (extra === best.extra) tie = true;
  }
  return best && !tie ? { doc: best.doc, matchType: 'fuzzy' } : null;
}

export async function listMarketData() {
  return MarketValue.find().sort({ category: 1, model: 1 }).lean();
}

export async function upsertMarketValue({ model, category, brand, prices }) {
  const name = String(model ?? '').trim();
  if (!name) throw new ApiError(400, 'Model is required');
  const list = (Array.isArray(prices) ? prices : String(prices ?? '').split(/[,\s;]+/))
    .map((p) => Number(p))
    .filter((p) => Number.isFinite(p));
  if (!list.length || list.some((p) => p <= 0)) {
    throw new ApiError(400, 'Provide at least one historical sale price greater than 0 (comma separated)');
  }
  const normalizedModel = normalizeModel(name);
  return MarketValue.findOneAndUpdate(
    { normalizedModel },
    {
      $set: {
        model: name,
        category: String(category || 'Other').trim(),
        brand: String(brand || name.split(/\s+/)[0]).trim(),
        marketPrices: list,
        currentFMV: round2(median(list)),
        lastUpdated: new Date(),
        sourceType: 'user_supplied',
      },
      $setOnInsert: { currency: 'USD', conditionAdjustments: DEFAULT_CONDITION_ADJUSTMENTS },
    },
    { upsert: true, new: true, runValidators: true }
  ).lean();
}
