import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { median, valueLine, summarizeItems, normalizeCondition, priceStats } from '../src/services/fmvCalc.js';
import { findMatch } from '../src/services/marketDataService.js';
import { buildItems } from '../src/services/fmvService.js';
import { MARKET_SEED } from '../src/seed/marketData.js';
import { normalizeModel } from '../src/utils/text.js';
import { parseInventory } from '../src/services/fmvService.js';
import { buildFallbackInsights } from '../src/services/fallbackAnalysis.js';

const ADJ = { Excellent: 1.1, Good: 1.0, Fair: 0.85, Poor: 0.65 };
const R = { buyRatio: 0.8, resaleRatio: 0.95 };

test('median handles odd and even sets', () => {
  assert.equal(median([380, 410, 425, 395, 420]), 410);
  assert.equal(median([560, 590, 610, 575, 600, 585]), 587.5);
  assert.equal(median([]), null);
});

test('spec example: Dell Latitude 5420 x10 Good', () => {
  const r = valueLine({ prices: [380, 410, 425, 395, 420], condition: 'Good', quantity: 10, adjustments: ADJ }, R);
  assert.equal(r.fmvPerUnit, 410);
  assert.equal(r.totalFMV, 4100);
  assert.equal(r.recommendedBuy, 3280);
  assert.equal(r.estimatedResale, 3895); // 4100 x 0.95
  assert.equal(r.potentialMargin, 615);  // resale - buy
});

test('condition adjustments apply', () => {
  const ex = valueLine({ prices: [100], condition: 'Excellent', quantity: 2, adjustments: ADJ }, R);
  const fair = valueLine({ prices: [100], condition: 'Fair', quantity: 2, adjustments: ADJ }, R);
  assert.equal(ex.fmvPerUnit, 110);
  assert.equal(fair.totalFMV, 170);
});

test('no prices and no fallback returns null', () => {
  assert.equal(valueLine({ prices: [], condition: 'Good', quantity: 1, adjustments: ADJ }, 0.8), null);
});

test('condition normalization', () => {
  assert.deepEqual(normalizeCondition('like new'), { condition: 'Excellent', assumed: false });
  assert.deepEqual(normalizeCondition(''), { condition: 'Good', assumed: true });
  assert.equal(priceStats([100, 120]).spreadPct, 18.18);
});

test('model matching: exact, fuzzy, ambiguous, unknown', () => {
  const idx = [
    { normalizedModel: 'lenovo thinkpad t14', model: 'Lenovo ThinkPad T14' },
    { normalizedModel: 'iphone 14', model: 'iPhone 14' },
    { normalizedModel: 'dell latitude 5420', model: 'Dell Latitude 5420' },
  ];
  assert.equal(findMatch(idx, 'iPhone-14').matchType, 'exact');
  assert.equal(findMatch(idx, 'ThinkPad T14').matchType, 'fuzzy');
  assert.equal(findMatch(idx, 'Surface Pro 8'), null);
  assert.equal(findMatch(idx, 'Latitude'), null);
});

test('ambiguous partial model (EliteBook 840 -> G7 or G8) is not guessed', () => {
  const idx = [
    { normalizedModel: 'hp elitebook 840 g7', model: 'HP EliteBook 840 G7' },
    { normalizedModel: 'hp elitebook 840 g8', model: 'HP EliteBook 840 G8' },
  ];
  assert.equal(findMatch(idx, 'HP EliteBook 840'), null);
  assert.equal(findMatch(idx, 'HP Elitebook 840 G8').doc.model, 'HP EliteBook 840 G8');
});

test('summary excludes unmatched lines', () => {
  const items = [
    { status: 'valued', quantity: 10, totalFMV: 4100, recommendedBuy: 3280, estimatedResale: 3895, potentialMargin: 615 },
    { status: 'no_market_data', quantity: 4 },
  ];
  const s = summarizeItems(items);
  assert.equal(s.estimatedMarketValue, 4100);
  assert.equal(s.unmatchedCount, 1);
  assert.equal(s.estimatedResaleValue, 3895);
  assert.equal(s.marginPct, 15.79);
  assert.equal(s.totalQuantity, 14);
});

test('spreadsheet parsing: header aliases, bad rows, missing columns', () => {
  const toBuf = (aoa) => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'S');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  };
  const ok = parseInventory(toBuf([['SKU', 'Qty'], ['Dell Latitude 5420', 3], ['Bad', 'x'], ['', ''], ['iPhone 13', 2]]));
  assert.equal(ok.lines.length, 2);
  assert.equal(ok.warnings.length, 1);
  assert.throws(() => parseInventory(toBuf([['Foo', 'Bar'], [1, 2]])), /Missing required column/);
  assert.throws(() => parseInventory(Buffer.from('not a spreadsheet \u0000\u0001')), /./);
});

test('fallback insights use only provided numbers', () => {
  const r = valueLine({ prices: [380, 410, 425, 395, 420], condition: 'Good', quantity: 10, adjustments: ADJ }, R);
  const items = [{ model: 'Dell Latitude 5420', matchedModel: 'Dell Latitude 5420', quantity: 10, condition: 'Good', status: 'valued', matchType: 'exact', conditionFactor: 1, ...r }];
  const out = buildFallbackInsights({ summary: { ...summarizeItems(items), ...R }, items });
  assert.match(out.summary, /\$4,100/);
  assert.match(out.summary, /\$615/);
});

test('buildItems: normalization, match types and unknown handling over the ITAD seed', () => {
  const idx = MARKET_SEED.map((m) => ({ ...m, normalizedModel: normalizeModel(m.model), marketPrices: m.prices, conditionAdjustments: ADJ }));
  const lines = [
    { model: 'Dell Latitude 5420', quantity: 10, conditionRaw: 'Good', category: '' },
    { model: 'Dell Latitude-5430', quantity: 2, conditionRaw: '', category: '' },
    { model: 'PowerEdge R740', quantity: 1, conditionRaw: 'Good', category: '' },
    { model: 'Fortinet FortiGate 100F', quantity: 3, conditionRaw: 'Good', category: '' },
  ];
  const items = buildItems(lines, idx, R);
  assert.deepEqual(items.map((i) => i.matchType), ['exact', 'normalized', 'fuzzy', null]);
  assert.equal(items[1].conditionAssumed, true);
  assert.equal(items[2].category, 'Server');
  assert.equal(items[3].status, 'no_market_data');
  assert.equal(items[0].totalFMV, 4100);
});
