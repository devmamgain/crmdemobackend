import mongoose from 'mongoose';
import Lead from '../models/Lead.js';
import Deal from '../models/Deal.js';
import Salesperson from '../models/Salesperson.js';
import FMVAnalysis from '../models/FMVAnalysis.js';
import { ACTIVE_STAGES, DEAL_STAGES, LEAD_STATUSES } from '../utils/validate.js';

const oid = (id) => new mongoose.Types.ObjectId(id);
const isActive = { $in: ['$stage', ACTIVE_STAGES] };
const sumIf = (cond, field) => ({ $sum: { $cond: [cond, field, 0] } });
const countIf = (cond) => ({ $sum: { $cond: [cond, 1, 0] } });

/** Per-stage {count,value}, always returning every stage in pipeline order. */
export async function stageBreakdown(match = {}) {
  const rows = await Deal.aggregate([
    { $match: match },
    { $group: { _id: '$stage', count: { $sum: 1 }, value: { $sum: '$value' } } },
  ]);
  const byStage = Object.fromEntries(rows.map((r) => [r._id, r]));
  return DEAL_STAGES.map((stage) => ({ stage, count: byStage[stage]?.count ?? 0, value: byStage[stage]?.value ?? 0 }));
}

export async function getDashboard() {
  const [totalLeads, dealTotals, pipeline, people, dealAgg, leadAgg, recentLeads, recentDeals, valuationAgg] = await Promise.all([
    Lead.countDocuments(),
    Deal.aggregate([
      {
        $group: {
          _id: null,
          activeDeals: countIf(isActive),
          pipelineValue: sumIf(isActive, '$value'),
          wonRevenue: sumIf({ $eq: ['$stage', 'Won'] }, '$value'),
        },
      },
    ]),
    stageBreakdown(),
    Salesperson.find({ active: true }).sort({ name: 1 }).lean(),
    Deal.aggregate([
      {
        $group: {
          _id: '$salespersonId',
          activeDeals: countIf(isActive),
          wonDeals: countIf({ $eq: ['$stage', 'Won'] }),
          pipelineValue: sumIf(isActive, '$value'),
          wonRevenue: sumIf({ $eq: ['$stage', 'Won'] }, '$value'),
        },
      },
    ]),
    Lead.aggregate([{ $group: { _id: '$salespersonId', leads: { $sum: 1 } } }]),
    Lead.find().sort({ createdAt: -1 }).limit(6).populate('salespersonId', 'name avatar').lean(),
    Deal.find().sort({ createdAt: -1 }).limit(6).populate('salespersonId', 'name avatar').lean(),
    FMVAnalysis.aggregate([
      {
        $group: {
          _id: null,
          analyses: { $sum: 1 },
          assets: { $sum: '$totalQuantity' },
          recoveryValue: { $sum: '$estimatedMarketValue' },
          buyValue: { $sum: '$recommendedBuyValue' },
          resaleValue: { $sum: { $ifNull: ['$estimatedResaleValue', '$estimatedMarketValue'] } },
          margin: { $sum: '$potentialMargin' },
        },
      },
    ]),
  ]);

  const totals = dealTotals[0] || {};
  const dealsBy = new Map(dealAgg.map((d) => [String(d._id), d]));
  const leadsBy = new Map(leadAgg.map((d) => [String(d._id), d.leads]));

  return {
    kpis: {
      totalLeads,
      activeDeals: totals.activeDeals ?? 0,
      pipelineValue: totals.pipelineValue ?? 0,
      wonRevenue: totals.wonRevenue ?? 0,
    },
    pipeline,
    salesPerformance: people.map((p) => {
      const d = dealsBy.get(String(p._id)) || {};
      return {
        salespersonId: p._id,
        name: p.name,
        avatar: p.avatar,
        leads: leadsBy.get(String(p._id)) ?? 0,
        activeDeals: d.activeDeals ?? 0,
        wonDeals: d.wonDeals ?? 0,
        pipelineValue: d.pipelineValue ?? 0,
        wonRevenue: d.wonRevenue ?? 0,
      };
    }),
    recentLeads,
    recentDeals,
    valuation: valuationAgg[0] || { analyses: 0, assets: 0, recoveryValue: 0, buyValue: 0, resaleValue: 0, margin: 0 },
  };
}

function lastMonths(n) {
  const out = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    out.push(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)).toISOString().slice(0, 7));
  }
  return out;
}

/**
 * Report for the whole team (salespersonId = null) or one salesperson.
 * Conversion rate = won deals / closed deals (won + lost), as a percentage.
 */
export async function getReport(salespersonId = null) {
  const match = salespersonId ? { salespersonId: oid(salespersonId) } : {};

  const [totalLeads, leadsByStatusRows, dealsByStage, revenueRows, salesperson] = await Promise.all([
    Lead.countDocuments(match),
    Lead.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    stageBreakdown(match),
    Deal.aggregate([
      { $match: { ...match, stage: 'Won' } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: { $ifNull: ['$closedAt', '$updatedAt'] } } },
          revenue: { $sum: '$value' },
          deals: { $sum: 1 },
        },
      },
    ]),
    salespersonId ? Salesperson.findById(salespersonId).lean() : null,
  ]);

  const stage = Object.fromEntries(dealsByStage.map((s) => [s.stage, s]));
  const activeDeals = ACTIVE_STAGES.reduce((n, s) => n + stage[s].count, 0);
  const pipelineValue = ACTIVE_STAGES.reduce((n, s) => n + stage[s].value, 0);
  const wonDeals = stage.Won.count;
  const lostDeals = stage.Lost.count;
  const wonRevenue = stage.Won.value;
  const closed = wonDeals + lostDeals;

  const revBy = Object.fromEntries(revenueRows.map((r) => [r._id, r]));
  const leadStatus = Object.fromEntries(leadsByStatusRows.map((r) => [r._id, r.count]));

  return {
    salesperson,
    metrics: {
      totalLeads,
      activeDeals,
      wonDeals,
      lostDeals,
      pipelineValue,
      wonRevenue,
      averageDealValue: wonDeals ? Math.round(wonRevenue / wonDeals) : 0,
      conversionRate: closed ? Math.round((wonDeals / closed) * 1000) / 10 : 0,
    },
    dealsByStage,
    leadsByStatus: LEAD_STATUSES.map((status) => ({ status, count: leadStatus[status] ?? 0 })),
    revenueOverTime: lastMonths(6).map((month) => ({
      month,
      revenue: revBy[month]?.revenue ?? 0,
      deals: revBy[month]?.deals ?? 0,
    })),
  };
}
