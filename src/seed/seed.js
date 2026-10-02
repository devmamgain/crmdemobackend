import mongoose from 'mongoose';
import { env } from '../config/env.js';
import Salesperson from '../models/Salesperson.js';
import Lead from '../models/Lead.js';
import Deal from '../models/Deal.js';
import MarketValue from '../models/MarketValue.js';
import FMVAnalysis from '../models/FMVAnalysis.js';
import { MARKET_SEED, SEED_ANALYSES } from './marketData.js';
import { buildItems } from '../services/fmvService.js';
import { summarizeItems } from '../services/fmvCalc.js';
import { buildFallbackInsights } from '../services/fallbackAnalysis.js';
import { SERVICE_TYPES } from '../utils/validate.js';
import { median, round2, DEFAULT_CONDITION_ADJUSTMENTS } from '../services/fmvCalc.js';
import { normalizeModel } from '../utils/text.js';

// Deterministic PRNG so every seed run produces the same demo data.
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261002);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (a, b) => a + Math.floor(rand() * (b - a + 1));
const weighted = (pairs) => {
  const total = pairs.reduce((n, [, w]) => n + w, 0);
  let r = rand() * total;
  for (const [v, w] of pairs) if ((r -= w) <= 0) return v;
  return pairs[0][0];
};
const daysAgo = (d) => new Date(Date.now() - d * 86400000);
const daysAhead = (d) => new Date(Date.now() + d * 86400000);

const PEOPLE = [
  ['Alex Morgan', 'Senior Account Executive', 'Enterprise ITAD'],
  ['Sarah Chen', 'Account Executive', 'Healthcare & Education'],
  ['Michael Reed', 'Business Development Rep', 'Public Sector'],
  ['Priya Sharma', 'Senior Account Executive', 'Data Center & Channel'],
  ['Daniel Wilson', 'Remarketing & Accounts Manager', 'Financial Services'],
];
const FIRST = ['Aarav', 'Emma', 'Liam', 'Sofia', 'Noah', 'Meera', 'Oliver', 'Zara', 'Ethan', 'Isha', 'Lucas', 'Chloe', 'Rohan', 'Mia', 'Arjun', 'Grace', 'Kabir', 'Hannah', 'Owen', 'Anaya'];
const LAST = ['Patel', 'Nguyen', 'Brown', 'Singh', 'Garcia', 'Kapoor', 'Miller', 'Khan', 'Davis', 'Verma', 'Taylor', 'Mehta', 'Clark', 'Reddy', 'Walker', 'Joshi'];
const CO_A = ['Northbridge', 'Summit', 'Harborview', 'Lakeshore', 'Pinecrest', 'Meridian', 'Westfield', 'Cobalt', 'Redwood', 'Evergreen', 'Ironwood', 'Clearwater', 'Bayside', 'Granite', 'Silverline', 'Oakmont'];
// Fictional demo clients grouped by industry.
const INDUSTRIES = {
  Healthcare: ['Health Network', 'Medical Group', 'Regional Hospital', 'Family Clinics'],
  'Financial Services': ['Credit Union', 'Bancorp', 'Financial Group', 'Insurance'],
  Education: ['School District', 'University', 'Community College', 'Academy'],
  Manufacturing: ['Manufacturing', 'Industries', 'Components', 'Foods'],
  Government: ['County', 'City Government', 'Transit Authority', 'Public Utilities'],
  Technology: ['Technologies', 'Managed Services', 'Data Centers', 'Systems'],
  Retail: ['Retail Group', 'Stores', 'Logistics', 'Hospitality'],
  'Professional Services': ['Law Group', 'Advisory', 'Consulting', 'Partners'],
};
const INDUSTRY_WEIGHTS = [['Healthcare', 20], ['Financial Services', 16], ['Education', 16], ['Manufacturing', 12], ['Government', 12], ['Technology', 12], ['Retail', 6], ['Professional Services', 6]];
const SOURCES = ['Website', 'Referral', 'LinkedIn', 'Trade show', 'Cold outreach', 'Partner', 'AI Suggestion'];
const LEAD_STATUS = [['New', 30], ['Contacted', 28], ['Qualified', 24], ['Unqualified', 8], ['Converted', 14], ['Lost', 10]];
const LEAD_NOTES = [
  'Refreshing laptops this quarter; needs certified data sanitization.',
  'Data center consolidation planned; servers and switches to retire.',
  'Lease return coming up; wants a value-recovery estimate.',
  'Asked about chain-of-custody documentation and reporting.',
  'Evaluating two ITAD vendors; price and turnaround matter.',
  '',
];
const OWNER_WEIGHTS = [[0, 30], [1, 26], [2, 18], [3, 26], [4, 24]];

async function run() {
  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 8000 });
  await Promise.all([Salesperson, Lead, Deal, MarketValue, FMVAnalysis].map((m) => m.deleteMany({})));

  const people = await Salesperson.insertMany(
    PEOPLE.map(([name, role, team]) => ({
      name, role, team,
      email: `${name.toLowerCase().replace(/\s+/g, '.')}@marketflow.example`,
      avatar: name.split(' ').map((p) => p[0]).join(''),
    }))
  );
  const owner = () => people[weighted(OWNER_WEIGHTS)]._id;

  const leads = Array.from({ length: 124 }, () => {
    const industry = weighted(INDUSTRY_WEIGHTS);
    const company = `${pick(CO_A)} ${pick(INDUSTRIES[industry])}`;
    const first = pick(FIRST);
    const last = pick(LAST);
    const assetVolume = between(25, 2500);
    return {
      name: `${first} ${last}`,
      company,
      industry,
      email: `${first}.${last}@${company.toLowerCase().replace(/[^a-z]+/g, '')}.example`.toLowerCase(),
      phone: `+1 555 01${between(10, 99)}`,
      source: pick(SOURCES),
      status: weighted(LEAD_STATUS),
      serviceInterest: pick(SERVICE_TYPES),
      assetVolume,
      estimatedValue: Math.round((assetVolume * between(40, 140)) / 100) * 100,
      salespersonId: owner(),
      notes: pick(LEAD_NOTES),
      createdAt: daysAgo(between(0, 120)),
    };
  });
  await Lead.insertMany(leads);

  // 32 active deals + 10 won + 6 lost
  const plan = { New: 9, Qualified: 9, Proposal: 7, Negotiation: 7, Won: 10, Lost: 6 };
  const deals = [];
  for (const [stage, n] of Object.entries(plan)) {
    for (let i = 0; i < n; i++) {
      const lead = pick(leads);
      const serviceType = pick(SERVICE_TYPES);
      const assetCount = between(40, 1200);
      const closed = stage === 'Won' || stage === 'Lost';
      const closedAt = closed ? daysAgo(between(2, 170)) : null;
      deals.push({
        title: `${lead.company} – ${serviceType}`,
        company: lead.company,
        serviceType,
        assetCount,
        value: Math.round((assetCount * between(55, 150)) / 100) * 100,
        stage,
        salespersonId: owner(),
        priority: weighted([['High', 25], ['Medium', 50], ['Low', 25]]),
        expectedCloseDate: closed ? closedAt : daysAhead(between(5, 75)),
        description: 'Demo opportunity generated by the seed script.',
        closedAt,
        createdAt: daysAgo(between(1, 200)),
      });
    }
  }
  await Deal.insertMany(deals);

  const marketDocs = await MarketValue.insertMany(
    MARKET_SEED.map((m) => ({
      model: m.model,
      normalizedModel: normalizeModel(m.model),
      category: m.category,
      brand: m.brand,
      marketPrices: m.prices,
      currentFMV: round2(median(m.prices)),
      currency: 'USD',
      conditionAdjustments: DEFAULT_CONDITION_ADJUSTMENTS,
      sourceType: 'demo_historical_sales',
    }))
  );

  // Pre-seeded demo valuations (computed with the same deterministic engine used for uploads).
  const index = marketDocs.map((d) => d.toObject({ flattenMaps: true }));
  const ratios = { buyRatio: env.fmv.buyRatio, resaleRatio: env.fmv.resaleRatio };
  for (const a of SEED_ANALYSES) {
    const lines = a.rows.map(([model, quantity, conditionRaw]) => ({ model, quantity, conditionRaw, category: '' }));
    const items = buildItems(lines, index, ratios);
    const summary = { ...summarizeItems(items), rowsParsed: lines.length, ...ratios };
    await FMVAnalysis.create({
      salespersonId: people[0]._id,
      filename: a.filename,
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
      aiInsights: { ...buildFallbackInsights({ summary, items }), source: 'fallback', note: 'Seeded demo analysis.' },
      createdAt: daysAgo(a.daysAgo),
    });
  }

  console.log(`Seeded: ${people.length} salespeople, ${leads.length} leads, ${deals.length} deals, ${MARKET_SEED.length} market records, ${SEED_ANALYSES.length} saved valuations.`);
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error(`Seed failed: ${err.message}`);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
