export const MAX_PER_GROUP = 8;
export const GROUP_LABEL = { gmail: 'Gmail', gsuite: 'G Suite', yahoo: 'Yahoo', custom: 'Custom' };

export function groupOf(a) {
  if (a.provider === 'GMAIL') return 'gmail';
  if (a.provider === 'GSUITE') return 'gsuite';
  if (a.provider === 'YAHOO') return 'yahoo';
  if (/@(gmail|googlemail)\.com$/i.test(a.email)) return 'gmail';
  if (/@(yahoo|ymail|rocketmail)\./i.test(a.email)) return 'yahoo';
  return 'custom';
}