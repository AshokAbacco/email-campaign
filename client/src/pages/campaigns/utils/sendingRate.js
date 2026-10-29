// client/src/pages/campaigns/utils/sendingRate.js
// Hourly sending limit helpers, chosen per sending account (must match server/src/utils/limits.js)
export const HOURLY_PRESETS = [5, 10, 20, 30, 40, 50, 60, 70, 80, 100, 150];
export const MIN_HOURLY = 1;
export const MAX_HOURLY = 500;
// "Default" option per provider (the server sends the same values with /campaigns/account-usage)
export const DEFAULT_HOURLY = { GMAIL: 20, GSUITE: 30, YAHOO: 10, IMAP: 20 };
export const PROVIDER_LABEL = { GMAIL: 'Gmail', GSUITE: 'Google Workspace', YAHOO: 'Yahoo', IMAP: 'IMAP / SMTP' };

const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

// Sending interval = 60 minutes ÷ emails per hour -> "6 minutes", "1.5 minutes", "8 min 34 sec", "45 seconds"
export function intervalLabel(perHour) {
  if (!perHour || perHour < 1) return '';
  const sec = 3600 / perHour;
  if (sec < 60) return plural(Math.round(sec * 10) / 10, 'second');
  const min = sec / 60;
  if (Number.isInteger(min)) return plural(min, 'minute');
  if (Number.isInteger(Math.round(min * 100) / 10)) return `${Math.round(min * 10) / 10} minutes`;
  return `${Math.floor(min)} min ${Math.round(sec % 60)} sec`;
}

// Short form for the dropdown: "every 6 min", "every 1.5 min", "every 51 sec"
export function intervalShort(perHour) {
  const sec = 3600 / perHour;
  if (sec < 60 || (!Number.isInteger(sec / 60) && !Number.isInteger(Math.round(sec / 6)))) return `every ${Math.round(sec)} sec`;
  return `every ${Math.round((sec / 60) * 10) / 10} min`;
}

// Rough time to send n emails at a total speed of perHour: "about 3 h 20 min"
export function durationLabel(n, perHour) {
  if (!n || !perHour) return '';
  const totalMin = Math.round(((n - 1) * 60) / perHour);
  if (totalMin < 1) return 'less than a minute';
  const h = Math.floor(totalMin / 60), m = totalMin % 60;
  return `about ${h ? `${h} h ` : ''}${m ? `${m} min` : ''}`.trim();
}

// Per-account choice { mode: 'default' | '10' | … | 'custom', custom: '' } -> emails per hour
export const limitValue = (choice, provider, defaults = DEFAULT_HOURLY) => {
  const c = choice || { mode: 'default' };
  if (c.mode === 'default') return defaults[provider] || 20;
  return Number(c.mode === 'custom' ? c.custom : c.mode);
};
export const limitValid = (n) => Number.isInteger(n) && n >= MIN_HOURLY && n <= MAX_HOURLY;