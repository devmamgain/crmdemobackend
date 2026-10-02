// Manual check (no DB): runs each sample file through the real parse -> match -> value pipeline.
import fs from 'node:fs';
import { parseInventory, buildItems } from '../src/services/fmvService.js';
import { MARKET_SEED } from '../src/seed/marketData.js';
import { normalizeModel } from '../src/utils/text.js';
import { summarizeItems, DEFAULT_CONDITION_ADJUSTMENTS } from '../src/services/fmvCalc.js';
import { env } from '../src/config/env.js';

const idx = MARKET_SEED.map((m) => ({ ...m, normalizedModel: normalizeModel(m.model), marketPrices: m.prices, conditionAdjustments: DEFAULT_CONDITION_ADJUSTMENTS }));
const ratios = { buyRatio: env.fmv.buyRatio, resaleRatio: env.fmv.resaleRatio };
for (const f of ['sample-inventory.xlsx', 'sample-datacenter-decommission.xlsx', 'sample-inventory-with-unknown.xlsx']) {
  const { lines } = parseInventory(fs.readFileSync(new URL('../sample-data/' + f, import.meta.url)));
  const items = buildItems(lines, idx, ratios);
  console.log('\n' + f, summarizeItems(items));
  console.table(items.map((i) => ({ uploaded: i.model, match: i.matchType, matched: i.matchedModel, qty: i.quantity, unit: i.fmvPerUnit, recovery: i.totalFMV, buy: i.recommendedBuy, resale: i.estimatedResale, margin: i.potentialMargin })));
}
