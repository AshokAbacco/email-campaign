import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { config } from '../config/env.js';
import { encrypt } from '../utils/crypto.js';
import { asyncHandler, HttpError } from '../utils/http.js';
import { MAX_ACCOUNTS_PER_FOLDER } from '../utils/limits.js';
import { syncAccount } from '../services/sync.js';
import { verifyImap } from '../services/providers/imap.js';
import { verifySmtp } from '../services/mailer.js';
import * as googleAuth from '../services/providers/gmail.js';
import * as yahooAuth from '../services/providers/yahoo-oauth.js';

const SAFE = {
  id: true, provider: true, displayName: true, email: true, status: true, lastError: true,
  lastSyncAt: true, createdAt: true, accountFolderId: true,
};

const imapSchema = z.object({
  provider: z.enum(['GMAIL', 'GSUITE', 'YAHOO', 'IMAP']),
  accountFolderId: z.string().min(1, 'Choose a folder first'),
  displayName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().toLowerCase(),
  imapHost: z.string().trim().min(1),
  imapPort: z.number().int().min(1).max(65535),
  imapSecure: z.boolean(),
  smtpHost: z.string().trim().min(1),
  smtpPort: z.number().int().min(1).max(65535),
  smtpSecure: z.boolean(),
  username: z.string().trim().optional(),
  password: z.string().min(1),
});

// The folder must belong to the user and have room for one more account
async function assertFolderRoom(userId, folderId, email) {
  const folder = await prisma.accountFolder.findFirst({ where: { id: folderId, userId }, select: { id: true, name: true } });
  if (!folder) throw new HttpError(400, 'Choose a valid folder first');
  const used = await prisma.emailAccount.count({ where: { userId, accountFolderId: folderId, NOT: { email } } });
  if (used >= MAX_ACCOUNTS_PER_FOLDER) {
    throw new HttpError(400, `Folder "${folder.name}" is full: up to ${MAX_ACCOUNTS_PER_FOLDER} accounts per folder`);
  }
}

async function saveAccount(userId, input) {
  const data = { ...input, email: input.email.toLowerCase() };
  await assertFolderRoom(userId, data.accountFolderId, data.email);
  const account = await prisma.emailAccount.upsert({
    where: { userId_email: { userId, email: data.email } },
    update: { ...data, status: 'ACTIVE', lastError: null },
    create: { userId, ...data },
    select: SAFE,
  });
  syncAccount(account.id).catch((e) => console.error('Initial sync failed:', e.message)); // background
  return account;
}

export const listAccounts = asyncHandler(async (req, res) => {
  res.json({
    accounts: await prisma.emailAccount.findMany({ where: { userId: req.userId }, select: SAFE, orderBy: { createdAt: 'asc' } }),
  });
});

export const connectImap = asyncHandler(async (req, res) => {
  const d = imapSchema.parse(req.body);
  await assertFolderRoom(req.userId, d.accountFolderId, d.email); // fail fast before opening any connection
  const { password, ...rest } = d;
  const candidate = { ...rest, username: d.username || d.email, encryptedSecret: encrypt({ password }) };
  try {
    await verifyImap(candidate);
    await verifySmtp(candidate);
  } catch (e) {
    throw new HttpError(400, `Could not connect: ${e.responseText || e.message}`);
  }
  res.status(201).json({ account: await saveAccount(req.userId, candidate) });
});

// Move an account to another folder
export const moveAccount = asyncHandler(async (req, res) => {
  const { accountFolderId } = z.object({ accountFolderId: z.string().min(1) }).parse(req.body);
  const acc = await prisma.emailAccount.findFirst({ where: { id: req.params.id, userId: req.userId }, select: { id: true, email: true } });
  if (!acc) throw new HttpError(404, 'Account not found');
  await assertFolderRoom(req.userId, accountFolderId, acc.email);
  await prisma.emailAccount.update({ where: { id: acc.id }, data: { accountFolderId } });
  res.json({ ok: true });
});

export const disconnect = asyncHandler(async (req, res) => {
  const { count } = await prisma.emailAccount.deleteMany({ where: { id: req.params.id, userId: req.userId } });
  if (!count) throw new HttpError(404, 'Account not found');
  res.json({ ok: true });
});

export const syncNow = asyncHandler(async (req, res) => {
  const account = await prisma.emailAccount.findFirst({ where: { id: req.params.id, userId: req.userId }, select: { id: true } });
  if (!account) throw new HttpError(404, 'Account not found');
  const older = z.object({ older: z.boolean().optional() }).parse(req.body || {}).older;
  try {
    res.json(await syncAccount(account.id, { older }));
  } catch (e) {
    throw new HttpError(502, `Sync failed: ${e.message}`);
  }
});

// ---------- OAuth ----------
const OAUTH = { gmail: 'GMAIL', gsuite: 'GSUITE', yahoo: 'YAHOO' };

export const oauthStart = asyncHandler(async (req, res) => {
  const provider = OAUTH[req.params.provider];
  if (!provider) throw new HttpError(400, 'Unknown provider');
  const folderId = z.string().min(1, 'Choose a folder first').parse(req.query.folderId);
  const isGoogle = provider !== 'YAHOO';
  const cfg = isGoogle ? config.google : config.yahoo;
  if (!cfg.clientId || !cfg.clientSecret) throw new HttpError(501, `${isGoogle ? 'Google' : 'Yahoo'} OAuth is not configured on the server`);
  const folder = await prisma.accountFolder.findFirst({ where: { id: folderId, userId: req.userId }, select: { id: true } });
  if (!folder) throw new HttpError(400, 'Choose a valid folder first');
  const state = jwt.sign({ sub: req.userId, p: provider, f: folder.id }, config.jwtSecret, { expiresIn: '10m' });
  res.json({ url: isGoogle ? googleAuth.authUrl(state) : yahooAuth.authUrl(state) });
});

export const oauthCallback = async (req, res) => {
  const back = (qs) => res.redirect(`${config.frontendUrl}/inbox?${qs}`);
  try {
    const { code, state, error } = req.query;
    if (error) throw new Error(String(error));
    const { sub: userId, p, f: accountFolderId } = jwt.verify(String(state), config.jwtSecret);
    if (p === 'YAHOO') {
      const { email, name, tokens } = await yahooAuth.exchangeCode(String(code));
      await saveAccount(userId, {
        provider: 'YAHOO', accountFolderId, email, displayName: name || email, username: email,
        imapHost: 'imap.mail.yahoo.com', imapPort: 993, imapSecure: true,
        smtpHost: 'smtp.mail.yahoo.com', smtpPort: 465, smtpSecure: true,
        encryptedSecret: encrypt(tokens),
      });
    } else {
      const { email, refreshToken } = await googleAuth.exchangeCode(String(code));
      if (!refreshToken) throw new Error('Google did not return a refresh token. Remove the app from your Google account permissions and retry.');
      await saveAccount(userId, { provider: p, accountFolderId, email, displayName: email, encryptedSecret: encrypt({ refreshToken }) });
    }
    back('connected=1');
  } catch (e) {
    back(`oauth_error=${encodeURIComponent(e.message)}`);
  }
};