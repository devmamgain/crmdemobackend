import * as XLSX from 'xlsx';
import FMVAnalysis from '../models/FMVAnalysis.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { loadMarketIndex, findMatch } from './marketDataService.js';
import { normalizeCondition, valueLine, summarizeItems } from './fmvCalc.js';
import { normalizeModel } from '../utils/text.js';
import { generateFmvInsights } from './llmService.js';

const HEADER_ALIASES = {
  model: ['model', 'modelnumber', 'modelno', 'modelname', 'sku', 'product', 'productmodel', 'device', 'equipment', 'item'],
  quantity: ['quantity', 'qty', 'units', 'count'],
  condition: ['condition', 'state', 'grade'],
  category: ['category', 'type', 'devicetype'],
};

const squash = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

function mapHeaders(headers) {
  const map = {};
  for (const h of headers) {
    const key = squash(h);
    for (const [canonical, aliases] of Object.entries(HEADER_ALIASES)) {
      if (!map[canonical] && aliases.includes(key)) map[canonical] = h;
    }
  }
  return map;
}

/** Parses an uploaded .xlsx/.xls/.csv buffer into normalized rows. Never executes file content. */
export function parseInventory(buffer) {
  let rows;
  try {
    const wb = XLSX.read(buffer, { type: 'buffer', cellFormula: false, cellHTML: false });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) throw new Error('empty workbook');
    rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: true });
  } catch {
    throw new ApiError(400, 'Could not read the file. Upload a valid .xlsx, .xls or .csv spreadsheet.');
  }
  if (!rows.length) throw new ApiError(400, 'The spreadsheet has no data rows.');
  if (rows.length > env.fmv.maxRows) {
    throw new ApiError(400, `The spreadsheet has ${rows.length} rows; the demo limit is ${env.fmv.maxRows}.`);
  }

  const headers = Object.keys(rows[0]);
  const cols = mapHeaders(headers);
  if (!cols.model || !cols.quantity) {
    const missing = [!cols.model && '"Model Number"', !cols.quantity && '"Quantity"'].filter(Boolean).join(' and ');
    throw new ApiError(400, `Missing required column(s): ${missing}. Found columns: ${headers.join(', ')}.`);
  }

  const lines = [];
  const warnings = [];
  rows.forEach((row, i) => {
    const rowNo = i + 2; // spreadsheet row (header is row 1)
    const model = String(row[cols.model] ?? '').trim();
    const qtyRaw = row[cols.quantity];
    if (!model && (qtyRaw === '' || qtyRaw === undefined)) return; // blank row
    const quantity = Number(qtyRaw);
    if (!model) return warnings.push(`Row ${rowNo}: skipped (missing model).`);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return warnings.push(`Row ${rowNo} (${model}): skipped (quantity must be a whole number greater than 0).`);
    }
    lines.push({
      model,
      quantity,
      category: cols.category ? String(row[cols.category] ?? '').trim() : '',
      conditionRaw: cols.condition ? row[cols.condition] : '',
    });
  });
  if (!lines.length) throw new ApiError(400, `No valid rows found. ${warnings.slice(0, 3).join(' ')}`.trim());
  return { lines, warnings, rowsParsed: rows.length };
}

/**
 * Pipeline: parsed inventory lines -> asset normalization/matching -> comparable transactions
 * -> unit FMV -> recovery value -> buy price -> resale value -> margin. Pure (no I/O) so the seed can reuse it.
 */
/** Most recent comparable transaction (by transactionDate). Display-only; never feeds the FMV maths. */
export function latestSale(transactions = []) {
  let best = null;
  for (const t of transactions || []) {
    const time = new Date(t?.transactionDate).getTime();
    if (!Number.isFinite(time) || !Number.isFinite(t?.price)) continue;
    if (!best || time > best.time) best = { time, price: t.price };
  }
  return best
    ? { lastSoldPrice: best.price, lastSoldDate: new Date(best.time) }
    : { lastSoldPrice: null, lastSoldDate: null };
}

export function buildItems(lines, index, ratios) {
  return lines.map((line) => {
    const { condition, assumed } = normalizeCondition(line.conditionRaw);
    const base = {
      model: line.model, // as uploaded
      normalizedModel: normalizeModel(line.model),
      category: line.category,
      condition,
      conditionAssumed: assumed,
      quantity: line.quantity,
    };
    const match = findMatch(index, line.model);
    if (!match) return { ...base, status: 'no_market_data', matchType: null, matchedModel: null };

    const calc = valueLine(
      {
        prices: match.doc.marketPrices,
        fallbackFMV: match.doc.currentFMV,
        condition,
        quantity: line.quantity,
        adjustments: match.doc.conditionAdjustments,
      },
      ratios
    );
    if (!calc) return { ...base, status: 'no_market_data', matchType: null, matchedModel: match.doc.model };
    // exact = identical text; normalized = same after case/punctuation cleanup; fuzzy = partial-name match
    const matchType = match.matchType === 'fuzzy' ? 'fuzzy' : line.model.trim() === match.doc.model ? 'exact' : 'normalized';
    return {
      ...base,
      category: line.category || match.doc.category,
      status: 'valued',
      matchType,
      matchedModel: match.doc.model,
      sourceType: match.doc.sourceType,
      ...latestSale(match.doc.transactions),
      ...calc,
    };
  });
}

export async function analyzeInventory({ buffer, filename, salespersonId = null }) {
  const { lines, warnings, rowsParsed } = parseInventory(buffer);
  const index = await loadMarketIndex();
  const ratios = { buyRatio: env.fmv.buyRatio, resaleRatio: env.fmv.resaleRatio };

  const items = buildItems(lines, index, ratios);
  const summary = { ...summarizeItems(items), rowsParsed, ...ratios };
  const aiInsights = await generateFmvInsights({ summary, items });

  const doc = await FMVAnalysis.create({
    salespersonId,
    filename,
    itemsAnalyzed: summary.itemsAnalyzed,
    totalQuantity: summary.totalQuantity,
    unmatchedCount: summary.unmatchedCount,
    estimatedMarketValue: summary.estimatedMarketValue,
    recommendedBuyValue: summary.recommendedBuyValue,
    estimatedResaleValue: summary.estimatedResaleValue,
    potentialMargin: summary.estimatedPotentialMargin,
    buyRatio: ratios.buyRatio,
    resaleRatio: ratios.resaleRatio,
    items,
    warnings,
    aiInsights,
  });

  return { id: doc._id, filename, createdAt: doc.createdAt, summary, items, warnings, aiInsights };
}