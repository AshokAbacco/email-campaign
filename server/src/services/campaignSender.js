import { prisma } from '../config/prisma.js';
import { sendMail } from './mailer.js';

export const DAILY_LIMIT = 5000; // emails per user per day
const BATCH = 10;                // recipients handled per campaign per cycle
const GAP_MS = 1500;             // pause between two emails
const TICK_MS = 10_000;          // worker cycle

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const wrap = (html) => `<div style="font-family:Calibri,Arial,sans-serif;font-size:14px;line-height:1.5;color:#111">${html}</div>`;
const toText = (h) => h.replace(/<style[\s\S]*?<\/style>|<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

export async function sentToday(userId) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return prisma.campaignRecipient.count({ where: { status: 'SENT', sentAt: { gte: start }, campaign: { userId } } });
}

const complete = (id) =>
  prisma.campaign.updateMany({ where: { id, status: 'SENDING' }, data: { status: 'COMPLETED', completedAt: new Date() } });

async function processCampaign(c) {
  const pendingWhere = { campaignId: c.id, status: 'PENDING' };
  const remaining = await prisma.campaignRecipient.count({ where: pendingWhere });
  if (!remaining) return complete(c.id);

  const left = DAILY_LIMIT - (await sentToday(c.userId));
  if (left <= 0) return; // waits and continues automatically tomorrow

  const accounts = c.accounts.map((x) => x.account).filter((a) => a.status === 'ACTIVE');
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const total = await prisma.campaignRecipient.count({ where: { campaignId: c.id } });
  const batch = await prisma.campaignRecipient.findMany({ where: pendingWhere, orderBy: { id: 'asc' }, take: Math.min(BATCH, left) });
  let n = total - remaining;

  for (const r of batch) {
    // follow-ups reply from the same mailbox that sent the first email; others rotate
    const account = (r.accountId && byId.get(r.accountId)) || accounts[n++ % Math.max(accounts.length, 1)];
    if (!account) {
      await prisma.campaignRecipient.updateMany({ where: { id: r.id }, data: { status: 'FAILED', error: 'No active sending account' } });
      continue;
    }
    const subject = r.subject || c.subjects[Math.floor(Math.random() * c.subjects.length)];
    try {
      await sendMail(account, { to: r.email, subject, html: wrap(c.bodyHtml), text: toText(c.bodyHtml) });
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
    await sleep(GAP_MS);
  }
  if (!(await prisma.campaignRecipient.count({ where: pendingWhere }))) await complete(c.id);
}

let running = false;
async function tick() {
  if (running) return;
  running = true;
  try {
    await prisma.campaign.updateMany({ where: { status: 'SCHEDULED', scheduledAt: { lte: new Date() } }, data: { status: 'SENDING' } });
    const active = await prisma.campaign.findMany({
      where: { status: 'SENDING' },
      orderBy: { createdAt: 'asc' },
      take: 20,
      include: { accounts: { include: { account: true } } },
    });
    for (const c of active) await processCampaign(c);
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