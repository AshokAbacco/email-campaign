import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { asyncHandler, HttpError } from '../utils/http.js';
import { providerFor } from '../services/providers/index.js';
import { sendMail } from '../services/mailer.js';
import { syncAccount } from '../services/sync.js';

const TYPE = { inbox: 'INBOX', sent: 'SENT', drafts: 'DRAFTS', spam: 'SPAM', trash: 'TRASH' };
const KEY = { INBOX: 'inbox', SENT: 'sent', DRAFTS: 'drafts', SPAM: 'spam', TRASH: 'trash' };
const HIDDEN = { notIn: ['TRASH', 'SPAM'] };

export const getFolders = asyncHandler(async (req, res) => {
  const [accountFolders, accounts] = await Promise.all([
    prisma.accountFolder.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, color: true },
    }),
    prisma.emailAccount.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, provider: true, displayName: true, email: true, status: true, lastError: true, lastSyncAt: true, accountFolderId: true },
    }),
  ]);
  const rows = await prisma.emailMessage.groupBy({
    by: ['accountId', 'folderType'],
    where: { isRead: false, accountId: { in: accounts.map((a) => a.id) } },
    _count: { _all: true },
  });

  const blank = () => ({ inbox: 0, sent: 0, drafts: 0, spam: 0, trash: 0 });
  const counts = blank();
  const per = {};
  for (const r of rows) {
    const k = KEY[r.folderType];
    if (!k) continue;
    counts[k] += r._count._all;
    (per[r.accountId] ||= blank())[k] += r._count._all;
  }

  const outAccounts = accounts.map((a) => {
    const c = per[a.id] || blank();
    return { ...a, counts: c, unread: c.inbox };
  });
  res.json({
    counts,
    accountFolders: accountFolders.map((f) => ({
      ...f,
      accountCount: outAccounts.filter((a) => a.accountFolderId === f.id).length,
    })),
    accounts: outAccounts,
  });
});

const listQuery = z.object({
  folder: z.string().default('inbox'),
  accountId: z.string().optional(),
  folderId: z.string().optional(),
  q: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const listMessages = asyncHandler(async (req, res) => {
  const { folder, accountId, folderId, q, page, limit } = listQuery.parse(req.query);
  const where = { account: { userId: req.userId } };
  if (accountId) where.accountId = accountId;
  if (folderId) where.folderId = folderId;
  else if (TYPE[folder]) where.folderType = TYPE[folder];
  else if (folder === 'starred') Object.assign(where, { isStarred: true, folderType: HIDDEN });
  else where.folderType = HIDDEN;
  if (q) {
    const c = { contains: q, mode: 'insensitive' };
    where.OR = [{ subject: c }, { fromName: c }, { fromEmail: c }, { snippet: c }, { bodyText: c }];
  }
  const [total, items] = await Promise.all([
    prisma.emailMessage.count({ where }),
    prisma.emailMessage.findMany({
      where,
      orderBy: { date: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true, accountId: true, folderId: true, folderType: true, fromName: true, fromEmail: true, subject: true,
        snippet: true, date: true, isRead: true, isStarred: true, hasAttachments: true,
        account: { select: { email: true, displayName: true } },
      },
    }),
  ]);
  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
});

async function owned(req, include = {}) {
  const m = await prisma.emailMessage.findFirst({
    where: { id: req.params.id, account: { userId: req.userId } },
    include: { account: true, ...include },
  });
  if (!m) throw new HttpError(404, 'Message not found');
  return m;
}

const remote = async (fn) => {
  try {
    return await fn();
  } catch (e) {
    throw new HttpError(502, `Provider error: ${e.message}`);
  }
};

export const getMessage = asyncHandler(async (req, res) => {
  const { account, ...m } = await owned(req, { attachments: true });
  res.json({ message: { ...m, account: { id: account.id, email: account.email, displayName: account.displayName } } });
});

export const updateFlags = asyncHandler(async (req, res) => {
  const body = z.object({ isRead: z.boolean().optional(), isStarred: z.boolean().optional() }).parse(req.body);
  const m = await owned(req);
  const p = providerFor(m.account);
  const data = {};
  if (body.isRead !== undefined && body.isRead !== m.isRead) {
    await remote(() => p.setFlag(m.account, m, 'read', body.isRead));
    data.isRead = body.isRead;
  }
  if (body.isStarred !== undefined && body.isStarred !== m.isStarred) {
    await remote(() => p.setFlag(m.account, m, 'star', body.isStarred));
    data.isStarred = body.isStarred;
  }
  if (Object.keys(data).length) await prisma.emailMessage.update({ where: { id: m.id }, data });
  res.json({ ok: true, ...data });
});

const moveTo = (type) =>
  asyncHandler(async (req, res) => {
    const m = await owned(req);
    if (m.folderType === type) return res.json({ ok: true });
    const dest = await prisma.emailFolder.findFirst({ where: { accountId: m.accountId, type } });
    if (!dest) throw new HttpError(400, `This account has no ${type.toLowerCase()} folder`);
    const r = await remote(() => providerFor(m.account).move(m.account, m, dest));
    await prisma.emailMessage.update({
      where: { id: m.id },
      data: { folderId: dest.id, folderType: type, remoteId: r?.remoteId || m.remoteId },
    });
    res.json({ ok: true });
  });

export const archive = moveTo('ARCHIVE'); // kept so the existing route still loads
export const trash = moveTo('TRASH');

export const downloadAttachment = asyncHandler(async (req, res) => {
  const m = await owned(req);
  const att = await prisma.emailAttachment.findFirst({ where: { id: req.params.attId, messageId: m.id } });
  if (!att) throw new HttpError(404, 'Attachment not found');
  const buf = await remote(() => providerFor(m.account).getAttachment(m.account, m, att));
  res.setHeader('Content-Type', att.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(att.filename)}`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(buf);
});

const list = z.array(z.string().email()).default([]);
const sendSchema = z.object({
  accountId: z.string(),
  to: list.refine((a) => a.length > 0, 'At least one recipient is required'),
  cc: list,
  bcc: list,
  subject: z.string().max(998),
  text: z.string().max(500_000),
  html: z.string().max(5_000_000).optional(),
  inReplyToId: z.string().optional(),
  forwardOfId: z.string().optional(),
});

export const send = asyncHandler(async (req, res) => {
  const d = sendSchema.parse(req.body);
  const account = await prisma.emailAccount.findFirst({ where: { id: d.accountId, userId: req.userId } });
  if (!account) throw new HttpError(404, 'Account not found');

  const mail = { to: d.to, cc: d.cc, bcc: d.bcc, subject: d.subject, text: d.text };
  if (d.html) mail.html = d.html;

  // Reply: thread it with the original
  if (d.inReplyToId) {
    const orig = await prisma.emailMessage.findFirst({
      where: { id: d.inReplyToId, account: { userId: req.userId } },
      select: { messageIdHeader: true },
    });
    if (orig?.messageIdHeader) Object.assign(mail, { inReplyTo: orig.messageIdHeader, references: orig.messageIdHeader });
  }

  // Forward: re-attach the original files
  if (d.forwardOfId) {
    const orig = await prisma.emailMessage.findFirst({
      where: { id: d.forwardOfId, account: { userId: req.userId } },
      include: { account: true, attachments: true },
    });
    if (orig?.attachments.length) {
      const total = orig.attachments.reduce((s, a) => s + a.size, 0);
      if (total > 20 * 1024 * 1024) throw new HttpError(400, 'Attachments are larger than 20 MB and cannot be forwarded');
      mail.attachments = await remote(async () => {
        const out = [];
        for (const a of orig.attachments) {
          const content = await providerFor(orig.account).getAttachment(orig.account, orig, a);
          const cid = a.contentId?.replace(/[<>]/g, '');
          out.push({ filename: a.filename, contentType: a.mimeType, content, ...(cid ? { cid, contentDisposition: 'inline' } : {}) });
        }
        return out;
      });
    }
  }

  await remote(() => sendMail(account, mail));
  syncAccount(account.id).catch(() => {});
  res.json({ ok: true });
});