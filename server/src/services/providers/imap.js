import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { credentialsFor } from './credentials.js';

async function connect(account) {
  const cred = await credentialsFor(account);
  const auth = cred.pass ? { user: cred.user, pass: cred.pass } : { user: cred.user, accessToken: cred.accessToken };
  const c = new ImapFlow({ host: account.imapHost, port: account.imapPort, secure: account.imapSecure, auth, logger: false });
  c.on('error', () => {});
  await c.connect();
  return c;
}

async function withClient(account, fn) {
  const c = await connect(account);
  try {
    return await fn(c);
  } finally {
    await c.logout().catch(() => {});
  }
}

export const verifyImap = (account) => withClient(account, async () => true);

function typeOf(f) {
  const su = f.specialUse || '';
  if (f.path.toUpperCase() === 'INBOX' || su === '\\Inbox') return 'INBOX';
  const map = { '\\Sent': 'SENT', '\\Drafts': 'DRAFTS', '\\Junk': 'SPAM', '\\Trash': 'TRASH' };
  if (map[su]) return map[su];
  if (su) return 'SKIP'; // All Mail, Important, Starred, Archive...
  const n = f.name.toLowerCase().trim();
  if (/^sent( items| mail| messages)?$/.test(n)) return 'SENT';
  if (/^drafts?$/.test(n)) return 'DRAFTS';
  if (/^(spam|junk|bulk)( mail| e-?mail)?$/.test(n)) return 'SPAM';
  if (/^(trash|bin|deleted( items| messages)?)$/.test(n)) return 'TRASH';
  return 'SKIP'; // custom labels/folders are not synced
}

const parseRemote = (remoteId) => {
  const i = remoteId.lastIndexOf(':');
  return { path: remoteId.slice(0, i), uid: Number(remoteId.slice(i + 1)) };
};

const addrs = (f) =>
  [].concat(f || []).flatMap((x) => x.value || []).filter((a) => a.address).map((a) => ({ name: a.name || '', address: a.address }));

function normalize(folder, uid, flags, p) {
  const [from] = addrs(p.from);
  const plain = p.text || (p.html || '').replace(/<style[\s\S]*?<\/style>|<[^>]+>/g, ' ');
  return {
    remoteId: `${folder.path}:${uid}`,
    messageIdHeader: p.messageId || null,
    fromName: from?.name || '',
    fromEmail: from?.address || '',
    toList: addrs(p.to),
    ccList: addrs(p.cc),
    bccList: addrs(p.bcc),
    subject: p.subject || '(no subject)',
    snippet: plain.replace(/\s+/g, ' ').trim().slice(0, 200),
    bodyText: p.text || null,
    bodyHtml: p.html || null,
    date: p.date || new Date(),
    isRead: flags.has('\\Seen'),
    isStarred: flags.has('\\Flagged'),
    hasAttachments: p.attachments.length > 0,
    attachments: p.attachments.map((a, i) => ({
      filename: a.filename || `attachment-${i + 1}`,
      mimeType: a.contentType || 'application/octet-stream',
      size: a.size || 0,
      remoteId: String(i),
      contentId: a.cid || null,
    })),
  };
}

export const imap = {
  listFolders: (account) =>
    withClient(account, async (c) => {
      const seen = new Set();
      return (await c.list())
        .filter((f) => !f.flags.has('\\Noselect') && !f.flags.has('\\NonExistent'))
        .map((f) => ({ path: f.path, name: f.path.toUpperCase() === 'INBOX' ? 'Inbox' : f.name, type: typeOf(f) }))
        .filter((f) => f.type !== 'SKIP' && !seen.has(f.type) && seen.add(f.type)); // one folder per type
    }),

  syncFolder: (account, folder, state, { older, limit }) =>
    withClient(account, async (c) => {
      const lock = await c.getMailboxLock(folder.path);
      try {
        const validity = String(c.mailbox.uidValidity);
        const st = state.uidValidity === validity ? state : { firstUid: null, lastUid: null };
        const all = ((await c.search({ all: true }, { uid: true })) || []).sort((a, b) => a - b);
        const pick = older ? all.filter((u) => st.firstUid && u < st.firstUid) : all.filter((u) => u > (st.lastUid || 0));
        const uids = pick.slice(-limit);

        const messages = [];
        if (uids.length) {
          for await (const m of c.fetch(uids.join(','), { uid: true, flags: true, source: true }, { uid: true })) {
            messages.push(normalize(folder, m.uid, m.flags, await simpleParser(m.source)));
          }
        }
        // refresh read/starred flags for recent known messages
        const flagUpdates = [];
        if (!older && st.lastUid && all.length) {
          const from = Math.max(1, st.lastUid - 500);
          for await (const m of c.fetch(`${from}:*`, { uid: true, flags: true }, { uid: true })) {
            flagUpdates.push({ remoteId: `${folder.path}:${m.uid}`, isRead: m.flags.has('\\Seen'), isStarred: m.flags.has('\\Flagged') });
          }
        }
        return {
          messages,
          flagUpdates,
          state: {
            uidValidity: validity,
            lastUid: uids.length ? Math.max(st.lastUid || 0, ...uids) : st.lastUid,
            firstUid: uids.length ? Math.min(st.firstUid || Infinity, ...uids) : st.firstUid,
          },
        };
      } finally {
        lock.release();
      }
    }),

  setFlag: (account, m, kind, value) =>
    withClient(account, async (c) => {
      const { path, uid } = parseRemote(m.remoteId);
      const lock = await c.getMailboxLock(path);
      try {
        const flag = kind === 'read' ? '\\Seen' : '\\Flagged';
        await (value ? c.messageFlagsAdd(String(uid), [flag], { uid: true }) : c.messageFlagsRemove(String(uid), [flag], { uid: true }));
      } finally {
        lock.release();
      }
    }),

  move: (account, m, dest) =>
    withClient(account, async (c) => {
      const { path, uid } = parseRemote(m.remoteId);
      const lock = await c.getMailboxLock(path);
      try {
        const r = await c.messageMove(String(uid), dest.path, { uid: true });
        const newUid = r?.uidMap?.get(uid);
        return newUid ? { remoteId: `${dest.path}:${newUid}` } : {};
      } finally {
        lock.release();
      }
    }),

  getAttachment: (account, m, att) =>
    withClient(account, async (c) => {
      const { path, uid } = parseRemote(m.remoteId);
      const lock = await c.getMailboxLock(path);
      try {
        const msg = await c.fetchOne(String(uid), { source: true }, { uid: true });
        const parsed = await simpleParser(msg.source);
        const a = parsed.attachments[Number(att.remoteId)];
        if (!a) throw new Error('Attachment not found');
        return a.content;
      } finally {
        lock.release();
      }
    }),
};
