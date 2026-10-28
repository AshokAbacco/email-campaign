export function formatDate(d, full = false) {
  const date = new Date(d);
  if (full) return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (date.getFullYear() === now.getFullYear()) return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
export const formatSize = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n > 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`);
export const person = (p) => (p.name ? `${p.name} <${p.address}>` : p.address);
export const htmlToText = (html) => new DOMParser().parseFromString(html || '', 'text/html').body.textContent || '';
