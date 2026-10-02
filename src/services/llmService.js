import { env } from '../config/env.js';
import { buildFallbackInsights, buildFallbackLeads } from './fallbackAnalysis.js';

export const isLlmConfigured = () => Boolean(env.llm.apiKey);

/** Minimal OpenAI-compatible chat call. Provider details live only in this file. */
async function chatJSON(system, user) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), env.llm.timeoutMs);
  try {
    const res = await fetch(`${env.llm.baseUrl}/chat/completions`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.llm.apiKey}` },
      body: JSON.stringify({
        model: env.llm.model,
        temperature: 0.2,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!res.ok) throw new Error(`LLM API responded ${res.status}`);
    const json = await res.json();
    const text = json?.choices?.[0]?.message?.content ?? '';
    const match = text.match(/\{[\s\S]*\}/); // tolerate ```json fences or stray prose
    if (!match) throw new Error('LLM returned no JSON');
    return JSON.parse(match[0]);
  } finally {
    clearTimeout(timer);
  }
}

const strList = (v, max = 8) =>
  Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim()).slice(0, max) : [];

function validateInsights(raw) {
  const out = {
    summary: typeof raw?.summary === 'string' ? raw.summary.trim() : '',
    keyInsights: strList(raw?.keyInsights),
    opportunities: strList(raw?.opportunities),
    risks: strList(raw?.risks),
    recommendation: typeof raw?.recommendation === 'string' ? raw.recommendation.trim() : '',
  };
  if (!out.summary || !out.recommendation) throw new Error('LLM JSON failed validation');
  return out;
}

const FMV_SYSTEM = `You are a market analysis assistant for an IT asset recovery (ITAD) and remarketing business.
You are given deterministic valuation results for a client's IT asset inventory. The comparable transactions are a demo/historical dataset, not live market data.
Do not invent prices.
Do not change numerical values.
Do not introduce external market claims that are not present in the provided data.
Explain:
1. Why the estimated FMV (median of comparable transactions, adjusted for condition) appears reasonable.
2. Whether the recommended buy price versus the estimated resale value gives a reasonable margin.
3. Which asset lines (and categories) appear most attractive for recovery and resale.
4. Which lines carry valuation uncertainty (few comparables, wide price spread, approximate model match, assumed condition, no market data).
5. Concise recommendations for the sales team's next steps with the client.
Return ONLY JSON: {"summary": "...", "keyInsights": [], "opportunities": [], "risks": [], "recommendation": "..."}`;

export async function generateFmvInsights({ summary, items }) {
  const fallback = (note) => ({ ...buildFallbackInsights({ summary, items }), source: 'fallback', note });
  if (!isLlmConfigured()) return fallback('No LLM API key configured; showing template-based analysis.');

  // Only backend-computed numbers are sent; the model is told not to alter them.
  const payload = {
    dataset: 'Demo comparable-transaction dataset (not live market data)',
    buyRatio: summary.buyRatio,
    resaleRatio: summary.resaleRatio,
    totals: summary,
    items: items.map((i) => ({
      model: i.model,
      matchedModel: i.matchedModel,
      condition: i.condition,
      quantity: i.quantity,
      status: i.status,
      matchType: i.matchType,
      fmvPerUnit: i.fmvPerUnit,
      totalFMV: i.totalFMV,
      recommendedBuy: i.recommendedBuy,
      estimatedResale: i.estimatedResale,
      category: i.category,
      potentialMargin: i.potentialMargin,
      priceStats: i.priceStats,
    })),
  };
  try {
    const raw = await chatJSON(FMV_SYSTEM, JSON.stringify(payload));
    return { ...validateInsights(raw), source: 'llm', model: env.llm.model };
  } catch (err) {
    console.warn(`[llm] FMV insights failed: ${err.message}`);
    return fallback('The LLM was unavailable; showing template-based analysis.');
  }
}

const LEADS_SYSTEM = `You are a B2B sales prospecting assistant for an IT asset recovery / ITAD company (equipment buyback, remarketing, data center decommissioning, secure data destruction). You have NO web access and no verified company data.
Given a target profile, suggest 5-6 prospect TYPES or segments (name real companies only if they are very well known, and never invent contact details, emails, phone numbers or facts about specific companies).
Return ONLY JSON: {"suggestions":[{"name":"","industry":"","location":"","reason":"","fitScore":0-100,"outreachAngle":"","kind":"prospect_type"|"example_company"}]}`;

export async function generateLeadSuggestions(criteria) {
  const fallback = (note) => ({ suggestions: buildFallbackLeads(criteria), source: 'fallback', note });
  if (!isLlmConfigured()) return fallback('No LLM API key configured; showing template-based suggestions.');
  try {
    const raw = await chatJSON(LEADS_SYSTEM, JSON.stringify(criteria));
    const suggestions = (Array.isArray(raw?.suggestions) ? raw.suggestions : [])
      .filter((s) => s && typeof s.name === 'string' && s.name.trim())
      .slice(0, 8)
      .map((s) => ({
        name: s.name.trim(),
        industry: String(s.industry || criteria.industry),
        location: String(s.location || criteria.region),
        reason: String(s.reason || ''),
        fitScore: Math.max(0, Math.min(100, Math.round(Number(s.fitScore) || 0))),
        outreachAngle: String(s.outreachAngle || ''),
        kind: s.kind === 'example_company' ? 'example_company' : 'prospect_type',
      }));
    if (!suggestions.length) throw new Error('no valid suggestions');
    return { suggestions, source: 'llm', model: env.llm.model };
  } catch (err) {
    console.warn(`[llm] lead suggestions failed: ${err.message}`);
    return fallback('The LLM was unavailable; showing template-based suggestions.');
  }
}
