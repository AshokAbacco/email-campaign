import DOMPurify from 'dompurify';
import { formatDate } from '../../../utils/format.js';

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const who = (name, email) => (name ? `${esc(name)} &lt;${esc(email)}&gt;` : esc(email));
const people = (list = []) => list.map((p) => who(p.name, p.address)).join(', ');

// Original message body as safe HTML (scripts/styles/forms removed so nothing leaks into the app)
function originalHtml(m) {
  if (m.bodyHtml) {
    return DOMPurify.sanitize(m.bodyHtml, { FORBID_TAGS: ['style', 'link', 'meta', 'form', 'iframe', 'object', 'embed'] });
  }
  return `<div style="white-space:pre-wrap">${esc(m.bodyText || '')}</div>`;
}

const gap = '<p><br></p><p><br></p>';

export function buildReply(m) {
  return (
    gap +
    `<div style="color:#555">On ${esc(formatDate(m.date, true))}, ${who(m.fromName, m.fromEmail)} wrote:</div>` +
    `<blockquote style="margin:12px 0 0 0;padding-left:14px;border-left:3px solid #d1d5db;color:#444">${originalHtml(m)}</blockquote>`
  );
}

export function buildForward(m) {
  const row = (label, value) => `<b>${label}:</b> ${value}<br>`;
  return (
    gap +
    `<div style="color:#444;line-height:1.8">---------- Forwarded message ----------<br>` +
    row('From', who(m.fromName, m.fromEmail)) +
    row('Date', esc(formatDate(m.date, true))) +
    row('Subject', esc(m.subject)) +
    row('To', people(m.toList)) +
    (m.ccList?.length ? row('Cc', people(m.ccList)) : '') +
    `</div><br>${originalHtml(m)}`
  );
}