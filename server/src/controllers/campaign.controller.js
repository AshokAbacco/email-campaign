import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { asyncHandler, HttpError } from '../utils/http.js';
import { DAILY_LIMIT, sentToday } from '../services/campaignSender.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_RECIPIENTS = 5000;
const cleanEmails = (list) => [...new Set(list.map((e) => e.trim().toLowerCase()).filter((e) => EMAIL.test(e)))];

// ---------- quota ----------
export const quota = asyncHandler(async (req, res) => {
  const sent = await sentToday(req.userId);
  res.json({ limit: DAILY_LIMIT, sent, left: Math.max(0, DAILY_LIMIT - sent) });
});

// ---------- list + dashboard stats ----------
const listQuery = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  q: z.string().trim().max(100).optional(),
});

export const listCampaigns = asyncHandler(async (req, res) => {
  const { from, to, q } = listQuery.parse(req.query);
  const where = { userId: req.userId };
  if (from || to) where.createdAt = { ...(from && { gte: new Date(from) }), ...(to && { lt: new Date(to) }) };
  if (q) where.name = { contains: q, mode: 'insensitive' };

  const rows = await prisma.campaign.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true, name: true, status: true, followUpStep: true, parentId: true, scheduledAt: true, createdAt: true, subjects: true,
      accounts: { select: { account: { select: { email: true } } } },
    },
  });
  const groups = await prisma.campaignRecipient.groupBy({
    by: ['campaignId', 'status'],
    where: { campaignId: { in: rows.map((r) => r.id) } },
    _count: { _all: true },
  });
  const counts = {};
  for (const g of groups) {
    const c = (counts[g.campaignId] ||= { total: 0, sent: 0, failed: 0, pending: 0 });
    c.total += g._count._all;
    c[g.status.toLowerCase()] += g._count._all;
  }
  const items = rows.map(({ accounts, ...r }) => ({
    ...r,
    accounts: accounts.map((a) => a.account.email),
    counts: counts[r.id] || { total: 0, sent: 0, failed: 0, pending: 0 },
  }));

  const u = req.userId;
  const [campaigns, followUps, recipients, followUpEmails] = await Promise.all([
    prisma.campaign.count({ where: { userId: u, followUpStep: 0 } }),
    prisma.campaign.count({ where: { userId: u, followUpStep: { gt: 0 } } }),
    prisma.campaignRecipient.count({ where: { campaign: { userId: u, followUpStep: 0 } } }),
    prisma.campaignRecipient.count({ where: { campaign: { userId: u, followUpStep: { gt: 0 } } } }),
  ]);
  res.json({ items, stats: { campaigns, followUps, recipients, followUpEmails } });
});

export const listRecipients = asyncHandler(async (req, res) => {
  const page = z.coerce.number().int().min(1).default(1).parse(req.query.page);
  const where = { campaignId: req.params.id, campaign: { userId: req.userId } };
  const [total, items] = await Promise.all([
    prisma.campaignRecipient.count({ where }),
    prisma.campaignRecipient.findMany({
      where, orderBy: { id: 'asc' }, skip: (page - 1) * 100, take: 100,
      select: { id: true, email: true, status: true, subject: true, error: true, sentAt: true },
    }),
  ]);
  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / 100)) });
});

export const deleteCampaign = asyncHandler(async (req, res) => {
  const { count } = await prisma.campaign.deleteMany({ where: { id: req.params.id, userId: req.userId } });
  if (!count) throw new HttpError(404, 'Campaign not found');
  res.json({ ok: true });
});

// ---------- new campaign ----------
const createSchema = z.object({
  name: z.string().trim().min(1, 'Campaign name is required').max(120),
  accountIds: z.array(z.string()).min(1, 'Select at least one From email').max(20),
  subjects: z.array(z.string().trim().min(1).max(200)).min(1, 'Add at least one subject line').max(50),
  bodyHtml: z.string().min(1, 'Write your message').max(2_000_000),
  recipients: z.array(z.string()).min(1, 'Add at least one recipient').max(MAX_RECIPIENTS * 2),
  scheduledAt: z.string().datetime().optional(),
});

export const createCampaign = asyncHandler(async (req, res) => {
  const d = createSchema.parse(req.body);
  const emails = cleanEmails(d.recipients);
  if (!emails.length) throw new HttpError(400, 'No valid email addresses found');
  if (emails.length > MAX_RECIPIENTS) throw new HttpError(400, `A campaign can have up to ${MAX_RECIPIENTS} recipients`);

  const accounts = await prisma.emailAccount.findMany({
    where: { id: { in: d.accountIds }, userId: req.userId, status: 'ACTIVE' },
    select: { id: true },
  });
  if (accounts.length !== new Set(d.accountIds).size) throw new HttpError(400, 'One or more selected From emails are not available');

  const later = d.scheduledAt && new Date(d.scheduledAt) > new Date();
  const campaign = await prisma.campaign.create({
    data: {
      userId: req.userId,
      name: d.name,
      subjects: d.subjects,
      bodyHtml: d.bodyHtml,
      status: later ? 'SCHEDULED' : 'SENDING',
      scheduledAt: later ? new Date(d.scheduledAt) : null,
      accounts: { create: accounts.map((a) => ({ accountId: a.id })) },
      recipients: { createMany: { data: emails.map((email) => ({ email })) } },
    },
    select: { id: true, status: true },
  });
  res.status(201).json({ campaign, recipients: emails.length });
});

// ---------- follow-ups ----------
// Recipients who already wrote back (found in the synced inbox) are excluded
async function repliedEmails(userId, emails, since) {
  if (!emails.length) return new Set();
  const rows = await prisma.$queryRaw(Prisma.sql`
    SELECT DISTINCT lower(m."fromEmail") AS e
    FROM "EmailMessage" m JOIN "EmailAccount" a ON a."id" = m."accountId"
    WHERE a."userId" = ${userId} AND m."date" >= ${since} AND lower(m."fromEmail") = ANY(${emails}::text[])`);
  return new Set(rows.map((r) => r.e));
}

export const eligibleFollowUps = asyncHandler(async (req, res) => {
  const step = z.coerce.number().int().min(1).max(4).parse(req.query.step);
  const parents = await prisma.campaign.findMany({
    where: { userId: req.userId, followUpStep: step - 1, status: 'COMPLETED', followUps: { none: { followUpStep: step } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { id: true, name: true, createdAt: true, subjects: true, _count: { select: { accounts: true } } },
  });
  const items = [];
  for (const p of parents) {
    const sent = (await prisma.campaignRecipient.findMany({ where: { campaignId: p.id, status: 'SENT' }, select: { email: true } })).map((s) => s.email);
    const replied = await repliedEmails(req.userId, sent, p.createdAt);
    items.push({
      id: p.id, name: p.name, createdAt: p.createdAt, sent: sent.length, replied: replied.size,
      eligible: sent.length - replied.size, accountsCount: p._count.accounts, subjectsCount: p.subjects.length,
    });
  }
  res.json({ items });
});

const followSchema = z.object({
  parentId: z.string(),
  bodyHtml: z.string().min(1, 'Write your follow-up message').max(2_000_000),
});
const reSubject = (s) => (/^re:/i.test(s) ? s : `Re: ${s}`);

export const createFollowUp = asyncHandler(async (req, res) => {
  const d = followSchema.parse(req.body);
  const parent = await prisma.campaign.findFirst({
    where: { id: d.parentId, userId: req.userId },
    include: { accounts: true, followUps: { select: { followUpStep: true } } },
  });
  if (!parent) throw new HttpError(404, 'Campaign not found');
  if (parent.status !== 'COMPLETED') throw new HttpError(400, 'The campaign must finish sending before a follow-up');
  const step = parent.followUpStep + 1;
  if (step > 4) throw new HttpError(400, 'A campaign can have up to 4 follow-ups');
  if (parent.followUps.some((f) => f.followUpStep === step)) throw new HttpError(409, 'This follow-up was already created');

  const sent = await prisma.campaignRecipient.findMany({ where: { campaignId: parent.id, status: 'SENT' }, select: { email: true, accountId: true, subject: true } });
  const replied = await repliedEmails(req.userId, sent.map((s) => s.email), parent.createdAt);
  const targets = sent.filter((s) => !replied.has(s.email.toLowerCase()));
  if (!targets.length) throw new HttpError(400, 'Everyone has already replied, so there is nobody to follow up with');

  const base = parent.name.replace(/ \(Followup( \d)?\)$/, '');
  const campaign = await prisma.campaign.create({
    data: {
      userId: req.userId,
      name: `${base} (Followup${step > 1 ? ` ${step}` : ''})`,
      parentId: parent.id,
      followUpStep: step,
      subjects: parent.subjects.map(reSubject),
      bodyHtml: d.bodyHtml,
      status: 'SENDING',
      accounts: { create: parent.accounts.map((a) => ({ accountId: a.accountId })) },
      recipients: {
        createMany: { data: targets.map((t) => ({ email: t.email, accountId: t.accountId, subject: t.subject ? reSubject(t.subject) : null })) },
      },
    },
    select: { id: true },
  });
  res.status(201).json({ campaign, recipients: targets.length, skippedReplied: replied.size });
});