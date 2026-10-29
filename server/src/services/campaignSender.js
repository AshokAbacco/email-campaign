// server/src/services/campaignSender.js
//
// Background worker that sends campaign and follow-up emails. Everything it needs (recipients, status,
// next send time) is stored in the database, so sending keeps going when the browser is closed or the
// user's PC is off, and resumes by itself after a server restart / redeploy.
//
// Hourly sending limit (PER ACCOUNT): each selected mailbox has its own limit N (chosen next to the account
// in New Campaign) and sends ONE email every (60 / N) minutes, e.g. 30/hour -> one email every 2 minutes.
// Accounts send side by side (10/hour + 30/hour = 40/hour in total). Emails go out one at a time, never as a burst. The pacing is stored on the account, so a
// mailbox stays within N per hour even when several campaigns / follow-ups use it at the same time.
// When running campaigns with different limits share a mailbox, the mailbox follows the LOWEST of them
// (so no selected limit is ever exceeded) and those campaigns take turns on it.
// Follow-ups carry their original campaign's N.
import { prisma } from '../config/prisma.js';
import { sendMail } from './mailer.js';
import { emailSafeHtml, htmlToText } from '../utils/emailHtml.js';
import { followUpQuotes } from './followUpQuote.js';
import { withSignature } from '../utils/signature.js';
import { intervalMs } from '../utils/limits.js';

export const DAILY_LIMIT = 5000; // emails per user per day
const BATCH = 10;                // campaigns without an hourly limit (created before it existed): recipients per cycle
const GAP_MS = 1500;             // ...and the pause between two of those emails
const TICK_MS = 5_000;           // worker cycle (the interval is respected to within a few seconds)
const HOUR_MS = 3_600_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// same base font, size and line spacing as the Email Content Editor, so the email looks like the editor
const wrap = (html) => `<div style="font-family:Calibri,Arial,sans-serif;font-size:14px;line-height:1.6;color:#111827">${html}</div>`;

export async function sentToday(userId) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return prisma.campaignRecipient.count({ where: { status: 'SENT', sentAt: { gte: start }, campaign: { userId } } });
}

const complete = (id) =>
  prisma.campaign.updateMany({ where: { id, status: 'SENDING' }, data: { status: 'COMPLETED', completedAt: new Date() } });

// Sends one recipient's email and records the result
async function sendOne(c, r, account, bodyHtml, quotes) {
  if (!account) {
    await prisma.campaignRecipient.updateMany({ where: { id: r.id }, data: { status: 'FAILED', error: 'No active sending account' } });
    return;
  }
  const subject = r.subject || c.subjects[Math.floor(Math.random() * c.subjects.length)];
  try {
    // pitch + signature of the sending mailbox (+ the quoted earlier email for follow-ups)
    const full = withSignature(bodyHtml, account) + (quotes.get(r.email) || '');
    await sendMail(account, { to: r.email, subject, html: wrap(full), text: htmlToText(full) });
    await prisma.campaignRecipient.updateMany({
      where: { id: r.id },
      data: { status: 'SENT', sentAt: new Date(), accountId: account.id, subject, error: null },
    });
  } catch (e) {
    await prisma.campaignRecipient.updateMany({
      where: { id: r.id },
      data: { status: 'FAILED', accountId: account.id, subject, error: String(e.responseText || e.message).slice(0, 300) },
    });
  }
}

// Reserves the next sending slot of a mailbox. Returns false while the account is still waiting for its
// interval (the conditional update also stops two server instances from using the same slot).
async function claimAccountSlot(account, hourlyLimit, now) {
  const step = intervalMs(hourlyLimit);
  const prev = account.nextCampaignSendAt ? new Date(account.nextCampaignSendAt).getTime() : null;
  if (prev && prev > now) return false;
  // keep a steady rhythm (prev + interval); after a pause (daily limit, restart, idle) start again from now
  const next = new Date(prev && now - prev < step ? prev + step : now + step);
  const { count } = await prisma.emailAccount.updateMany({
    where: { id: account.id, OR: [{ nextCampaignSendAt: null }, { nextCampaignSendAt: { lte: new Date(now) } }] },
    data: { nextCampaignSendAt: next },
  });
  if (count === 1) account.nextCampaignSendAt = next;
  return count === 1;
}

// Emails this mailbox sent (any campaign) in the last 60 minutes
const sentLastHour = (accountId, now) =>
  prisma.campaignRecipient.count({ where: { accountId, status: 'SENT', sentAt: { gt: new Date(now - HOUR_MS) } } });

async function processCampaign(c, accountLimits) {
  const pendingWhere = { campaignId: c.id, status: 'PENDING' };
  const remaining = await prisma.campaignRecipient.count({ where: pendingWhere });
  if (!remaining) return complete(c.id);

  const left = DAILY_LIMIT - (await sentToday(c.userId));
  if (left <= 0) return; // waits and continues automatically tomorrow

  const accounts = c.accounts.map((x) => x.account).filter((a) => a.status === 'ACTIVE');
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const total = await prisma.campaignRecipient.count({ where: { campaignId: c.id } });
  let n = total - remaining;
  // follow-ups reply from the same mailbox that sent the first email; others rotate through the selected accounts
  const pickAccount = (r) => (r.accountId && byId.get(r.accountId)) || accounts[n++ % Math.max(accounts.length, 1)];
  const bodyHtml = emailSafeHtml(c.bodyHtml);

  if (c.hourlyLimit) {
    // ---- hourly limit per account: each free mailbox sends one email, then waits its interval ----
    let budget = left;
    const activeIds = accounts.map((a) => a.id);
    // start with a different account each cycle so the accounts share the list evenly
    const order = accounts.map((_, i) => accounts[(i + n) % accounts.length]);
    for (const account of order) {
      if (budget <= 0) break;
      const now = Date.now();
      if (account.nextCampaignSendAt && new Date(account.nextCampaignSendAt).getTime() > now) continue; // still waiting
      const limit = accountLimits.get(account.id) || c.hourlyLimit; // lowest limit of the running campaigns on this mailbox
      if ((await sentLastHour(account.id, now)) >= limit) continue; // hard cap: never more than the limit in any 60 minutes
      // follow-ups: recipients first emailed from this mailbox (or whose mailbox is no longer active, as before);
      // new campaigns: simply the next recipient in the list
      const r = await prisma.campaignRecipient.findFirst({
        where: {
          ...pendingWhere,
          ...(c.parentId ? { OR: [{ accountId: account.id }, { accountId: null }, { accountId: { notIn: activeIds } }] } : {}),
        },
        orderBy: { id: 'asc' },
      });
      if (!r) continue;
      if (!(await claimAccountSlot(account, limit, now))) continue;
      const quotes = c.parentId ? await followUpQuotes(c.parentId, [r.email]) : new Map();
      await sendOne(c, r, account, bodyHtml, quotes);
      await prisma.campaign.updateMany({ where: { id: c.id }, data: { lastSendAt: new Date() } });
      budget--;
    }
    if (!accounts.length) {
      // no active mailbox left: same as before, the remaining emails are marked failed
      await prisma.campaignRecipient.updateMany({ where: pendingWhere, data: { status: 'FAILED', error: 'No active sending account' } });
    }
  } else {
    // ---- campaigns created before the hourly limit existed: unchanged batch sending ----
    const batch = await prisma.campaignRecipient.findMany({ where: pendingWhere, orderBy: { id: 'asc' }, take: Math.min(BATCH, left) });
    const quotes = c.parentId ? await followUpQuotes(c.parentId, batch.map((r) => r.email)) : new Map();
    for (const r of batch) {
      await sendOne(c, r, pickAccount(r), bodyHtml, quotes);
      await sleep(GAP_MS);
    }
  }
  if (!(await prisma.campaignRecipient.count({ where: pendingWhere }))) await complete(c.id);
}

let running = false;
async function tick() {
  if (running) return;
  running = true;
  try {
    const now = new Date();
    await prisma.campaign.updateMany({ where: { status: 'SCHEDULED', scheduledAt: { lte: now } }, data: { status: 'SENDING' } });
    // campaigns that sent least recently go first, so campaigns sharing a mailbox take turns
    const active = await prisma.campaign.findMany({
      where: { status: 'SENDING' },
      orderBy: [{ lastSendAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'asc' }],
      take: 200,
      include: { accounts: { include: { account: true } } },
    });
    // effective hourly limit of each mailbox = lowest limit among the running campaigns that use it
    const accountLimits = new Map();
    for (const c of active) {
      if (!c.hourlyLimit) continue;
      for (const { account, hourlyLimit } of c.accounts) {
        const own = hourlyLimit ?? c.hourlyLimit; // limit chosen for this account in this campaign
        accountLimits.set(account.id, Math.min(accountLimits.get(account.id) ?? Infinity, own));
      }
    }
    for (const c of active) {
      try {
        await processCampaign(c, accountLimits);
      } catch (e) {
        console.error(`Campaign ${c.id} error:`, e.message); // one failing campaign does not block the others
      }
    }
  } catch (e) {
    console.error('Campaign worker error:', e.message);
  } finally {
    running = false;
  }
}

// Campaigns live in the database, so sending resumes by itself after a server restart
export function startCampaignWorker() {
  setInterval(tick, TICK_MS);
  tick();
}