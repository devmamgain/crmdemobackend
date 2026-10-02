/** "Lenovo ThinkPad-T14" -> "lenovo thinkpad t14" */
export const normalizeModel = (s = '') =>
  String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const fmtUSD = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);
