import { prisma } from '../config/prisma.js';
import { providerFor } from './providers/index.js';
import { withRetry, isAuthError } from '../utils/http.js';

const running = new Set();

async function upsertMessage(accountId, folder, m) {
  const { attachments = [], ...data } = m;
  const existing = await prisma.emailMessage.findUnique({
    where: { accountId_remoteId: { accountId, remoteId: m.remoteId } },
    select: { id: true },
  });
  if (existing) {
    await prisma.emailMessage.update({ where: { id: existing.id }, data: { ...data, folderId: folder.id, folderType: folder.type } });
  } else {
    await prisma.emailMessage.create({
      data: { ...data, accountId, folderId: folder.id, folderType: folder.type, attachments: { create: attachments } },
    });
  }
}

export async function syncAccount(accountId, { older = false, limit = 50 } = {}) {
  if (running.has(accountId)) return { skipped: true };
  running.add(accountId);
  try {
    const account = await prisma.emailAccount.findUnique({ where: { id: accountId } });
    if (!account) return { skipped: true };
    const provider = providerFor(account);
    try {
           const remoteFolders = await withRetry(() => provider.listFolders(account));
      for (const f of remoteFolders) {
        await prisma.emailFolder.upsert({
          where: { accountId_path: { accountId, path: f.path } },
          update: { name: f.name, type: f.type },
          create: { accountId, ...f },
        });
      }
      // remove folders we no longer sync (labels, Important, Archive...) with their local messages
      await prisma.emailFolder.deleteMany({ where: { accountId, path: { notIn: remoteFolders.map((f) => f.path) } } });
      const folders = await prisma.emailFolder.findMany({ where: { accountId } });
      const rows = await prisma.emailMessage.findMany({ where: { accountId }, select: { remoteId: true, folderId: true } });
      const known = new Map(rows.map((r) => [r.remoteId, r.folderId]));
      let added = 0;

      for (const folder of folders) {
        const key = { accountId_folderId: { accountId, folderId: folder.id } };
        const st = await prisma.emailSyncState.upsert({
          where: key,
          update: { status: 'SYNCING' },
          create: { accountId, folderId: folder.id, status: 'SYNCING' },
        });
        try {
          const res = await withRetry(() => provider.syncFolder(account, folder, st, { known, older, limit }));
          for (const m of res.messages) {
            await upsertMessage(accountId, folder, m);
            known.set(m.remoteId, folder.id);
          }
          added += res.messages.length;
          for (const u of res.flagUpdates || []) {
            await prisma.emailMessage.updateMany({ where: { accountId, remoteId: u.remoteId }, data: { isRead: u.isRead, isStarred: u.isStarred } });
          }
          await prisma.emailSyncState.update({
            where: key,
            data: { ...res.state, status: 'IDLE', error: null, lastSyncAt: new Date() },
          });
        } catch (e) {
          await prisma.emailSyncState.update({ where: key, data: { status: 'ERROR', error: String(e.message).slice(0, 500) } });
          if (isAuthError(e)) throw e;
          console.error(`Sync failed for ${account.email}/${folder.path}:`, e.message);
        }
      }
      await prisma.emailAccount.update({ where: { id: accountId }, data: { status: 'ACTIVE', lastError: null, lastSyncAt: new Date() } });
      return { added };
    } catch (e) {
      await prisma.emailAccount.update({
        where: { id: accountId },
        data: { status: isAuthError(e) ? 'NEEDS_REAUTH' : 'ERROR', lastError: String(e.message).slice(0, 500) },
      });
      throw e;
    }
  } finally {
    running.delete(accountId);
  }
}
