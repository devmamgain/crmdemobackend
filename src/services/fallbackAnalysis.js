import { fmtUSD } from '../utils/text.js';

/**
 * Deterministic, template-based analysis used when no LLM key is configured or the LLM call fails.
 * Uses only numbers already computed by the backend.
 */
export function buildFallbackInsights({ summary, items }) {
  const valued = items.filter((i) => i.status === 'valued');
  const unmatched = items.filter((i) => i.status !== 'valued');
  const buyPct = Math.round(summary.buyRatio * 100);
  const resalePct = Math.round(summary.resaleRatio * 100);

  if (!valued.length) {
    return {
      summary: 'None of the uploaded assets matched the comparable-transaction dataset, so no valuation could be produced.',
      keyInsights: [],
      opportunities: [],
      risks: [`${unmatched.length} line(s) have no market data. Add comparable sale prices for them and re-run the analysis.`],
      recommendation: 'Add market data for the unmatched models, then re-run the analysis before quoting the client.',
    };
  }

  const byValue = [...valued].sort((a, b) => b.totalFMV - a.totalFMV);
  const byMargin = [...valued].sort((a, b) => b.potentialMargin - a.potentialMargin);
  const top = byValue[0];
  const topShare = Math.round((top.totalFMV / summary.estimatedMarketValue) * 100);

  // Category concentration (by recovery value)
  const byCat = {};
  for (const i of valued) byCat[i.category || 'Other'] = (byCat[i.category || 'Other'] || 0) + i.totalFMV;
  const [topCat, topCatVal] = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];

  const keyInsights = [
    'Unit FMV is the median of the comparable historical transactions stored for each model, adjusted for the stated condition grade.',
    `${top.matchedModel} is the largest line at ${fmtUSD(top.totalFMV)} (${topShare}% of total recovery value); ${topCat} assets account for ${Math.round((topCatVal / summary.estimatedMarketValue) * 100)}% of recovery value.`,
    `Buying at ${buyPct}% of FMV and reselling at an expected ${resalePct}% of FMV gives the same ${summary.marginPct}% margin on every valued line, so lines differ by absolute margin, not margin rate.`,
  ];
  const premium = valued.filter((i) => i.conditionFactor > 1).length;
  const discount = valued.filter((i) => i.conditionFactor < 1).length;
  if (premium || discount) {
    keyInsights.push(`Condition grading raises ${premium} line(s) and reduces ${discount} line(s) relative to the "Good" baseline.`);
  }

  const opportunities = byMargin
    .slice(0, 3)
    .map((i) => `${i.matchedModel}: ${fmtUSD(i.potentialMargin)} estimated margin on ${i.quantity} unit(s) at ${fmtUSD(i.fmvPerUnit)} FMV per unit.`);

  const risks = [];
  for (const i of valued) {
    const s = i.priceStats;
    if (s.sampleCount < 5) risks.push(`${i.matchedModel}: only ${s.sampleCount} comparable transaction(s), so the median is less reliable.`);
    else if (s.spreadPct > 12) risks.push(`${i.matchedModel}: comparable prices range ${fmtUSD(s.min)}–${fmtUSD(s.max)} (${s.spreadPct}% of median), so valuation uncertainty is higher.`);
    if (i.matchType === 'fuzzy') risks.push(`"${i.model}" was approximately matched to ${i.matchedModel}; confirm the exact model and configuration with the client.`);
    if (i.conditionAssumed) risks.push(`"${i.model}": condition grade was missing or unrecognised and was assumed to be Good; confirm on inspection.`);
  }
  if (unmatched.length) {
    risks.push(`${unmatched.length} line(s) have no comparable data and are excluded from totals: ${unmatched.map((i) => i.model).join(', ')}.`);
  }
  risks.push('Comparable transactions are a seeded demo/historical dataset, not live market pricing.');

  return {
    summary: `Across ${valued.length} valued asset line(s) (${summary.totalQuantity} units uploaded), the demo comparable-transaction dataset gives a total recovery value of ${fmtUSD(summary.estimatedMarketValue)}. At a recommended buy price of ${fmtUSD(summary.recommendedBuyValue)} (${buyPct}% of FMV) and an estimated resale value of ${fmtUSD(summary.estimatedResaleValue)}, the estimated margin is ${fmtUSD(summary.estimatedPotentialMargin)} (${summary.marginPct}% of resale value).`,
    keyInsights,
    opportunities,
    risks: risks.slice(0, 8),
    recommendation: `Lead the client conversation with ${byMargin[0].matchedModel} (largest estimated margin), verify the flagged assets and condition grades before committing, and treat the buy price as a ceiling until comparables are confirmed against current market data.`,
  };
}

const LEAD_TEMPLATES = [
  { segment: 'enterprises on a 3–4 year laptop and desktop refresh cycle', angle: 'Offer a value-recovery estimate on retiring fleets, credited against the new-hardware refresh.' },
  { segment: 'data center and colocation operators decommissioning servers and network gear', angle: 'Lead with decommissioning logistics plus an upfront buy price on servers and switches.' },
  { segment: 'healthcare systems and clinics with compliance-driven data destruction needs', angle: 'Lead with certified data sanitization and chain-of-custody reporting, then value recovery.' },
  { segment: 'financial institutions and credit unions retiring branch equipment', angle: 'Position secure, auditable asset disposition with a recovery payment on resaleable equipment.' },
  { segment: 'school districts and universities cycling lab and staff devices', angle: 'Propose a scheduled pickup program with a per-device buyback estimate.' },
  { segment: 'equipment lessors and managed-service providers handling lease returns', angle: 'Offer remarketing of off-lease inventory with transparent valuation per model and condition.' },
];

export function buildFallbackLeads({ industry, region, product }) {
  return LEAD_TEMPLATES.map((t, i) => ({
    name: `${region} ${t.segment}`,
    industry,
    location: region,
    reason: `This segment typically retires IT equipment in volume, which fits ${product}. (Template-based suggestion; no live data was used.)`,
    fitScore: 85 - i * 5,
    outreachAngle: t.angle,
    kind: 'prospect_type',
  }));
}
