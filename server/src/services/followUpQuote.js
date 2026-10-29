// server/src/services/followUpQuote.js
//
// A follow-up is sent as a reply: the follow-up pitch on top and, below it, the earlier
// email(s) this recipient received, quoted like Gmail/Outlook do:
//
//   <follow-up text>
//   On Wed, Oct 29, 2026 at 2:29 PM Valeri Thomas <valeri@x.com> wrote:
//   | <original campaign email>
//
// A 2nd follow-up quotes the 1st follow-up, which itself quotes the original (full thread).
import { prisma } from '../config/prisma.js';
import { emailSafeHtml } from '../utils/emailHtml.js';
import { withSignature } from '../utils/signature.js';

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// "Wed, Oct 29, 2026 at 2:29 PM" (MAIL_TZ e.g. Asia/Kolkata, otherwise the server time zone)
function when(d) {
  const tz = process.env.MAIL_TZ || undefined;
  const date = new Date(d);
  const day = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: tz });
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz });
  return `${day} at ${time}`;
}

function quoteBlock(sentAt, account, innerHtml) {
  const who = account ? `${esc(account.displayName || account.email)} &lt;${esc(account.email)}&gt;` : 'I';
  return (
    `<div style="margin:16px 0 0 0">` +
    `<div style="margin:0 0 8px 0;color:#444444">On ${esc(when(sentAt))} ${who} wrote:</div>` +
    `<blockquote style="margin:0 0 0 6px;padding-left:12px;border-left:2px solid #cccccc;color:#444444">${innerHtml}</blockquote>` +
    `</div>`
  );
}

// Ancestors of a campaign, oldest first: [original, 1st follow-up, …, campaignId]
async function chainUpTo(campaignId) {
  const chain = [];
  let id = campaignId;
  while (id && chain.length < 6) {
    const c = await prisma.campaign.findUnique({ where: { id }, select: { id: true, parentId: true, bodyHtml: true } });
    if (!c) break;
    chain.unshift(c);
    id = c.parentId;
  }
  return chain;
}

/**
 * Quoted history to put under a follow-up of `parentId`, for each recipient email.
 * @returns Map<email, html>
 */
export async function followUpQuotes(parentId, emails) {
  const out = new Map();
  if (!parentId || !emails.length) return out;
  const chain = await chainUpTo(parentId);

  // what each recipient received in every step of the thread
  const rows = await prisma.campaignRecipient.findMany({
    where: { campaignId: { in: chain.map((c) => c.id) }, email: { in: emails }, status: 'SENT' },
    select: { campaignId: true, email: true, sentAt: true, accountId: true },
  });
  const accountIds = [...new Set(rows.map((r) => r.accountId).filter(Boolean))];
  const accounts = new Map(
    (await prisma.emailAccount.findMany({ where: { id: { in: accountIds } }, select: { id: true, email: true, displayName: true } })).map((a) => [a.id, a])
  );
  const sent = new Map(rows.map((r) => [`${r.campaignId}|${r.email}`, r]));
  const bodies = new Map(chain.map((c) => [c.id, emailSafeHtml(c.bodyHtml)]));

  for (const email of emails) {
    let quote = '';
    for (const c of chain) {
      const r = sent.get(`${c.id}|${email}`);
      if (!r) continue; // recipient was not part of that step
      const acc = accounts.get(r.accountId);
      // quoted exactly as it was sent: body + that mailbox's signature + its own quote
      quote = quoteBlock(r.sentAt, acc, withSignature(bodies.get(c.id), acc) + quote);
    }
    if (quote) out.set(email, quote);
  }
  return out;
}