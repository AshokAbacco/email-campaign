import { google } from 'googleapis';
import addressparser from 'nodemailer/lib/addressparser/index.js';
import { config } from '../../config/env.js';
import { decrypt } from '../../utils/crypto.js';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
];

const FOLDERS = [
  { path: 'INBOX', name: 'Inbox', type: 'INBOX', label: 'INBOX' },
  { path: 'SENT', name: 'Sent', type: 'SENT', label: 'SENT' },
  { path: 'DRAFT', name: 'Drafts', type: 'DRAFTS', label: 'DRAFT' },
  { path: 'SPAM', name: 'Spam', type: 'SPAM', label: 'SPAM' },
  { path: 'TRASH', name: 'Trash', type: 'TRASH', label: 'TRASH' },
  // Gmail has no archive folder: archived = not in inbox/sent/drafts/spam/trash
  // { path: 'ARCHIVE', name: 'Archive', type: 'ARCHIVE', q: '-in:inbox -in:sent -in:drafts -in:spam -in:trash -in:chats' },
];

const oauthClient = () => new google.auth.OAuth2(config.google.clientId, config.google.clientSecret, config.google.redirectUri);

export const authUrl = (state) =>
  oauthClient().generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: SCOPES, state });

export async function exchangeCode(code) {
  const c = oauthClient();
  const { tokens } = await c.getToken(code);
  c.setCredentials(tokens);
  const { data } = await google.gmail({ version: 'v1', auth: c }).users.getProfile({ userId: 'me' });
  return { email: data.emailAddress, refreshToken: tokens.refresh_token };
}

export const gmailClient = (account) => {
  const c = oauthClient();
  c.setCredentials({ refresh_token: decrypt(account.encryptedSecret).refreshToken });
  return google.gmail({ version: 'v1', auth: c });
};

const decode = (d) => Buffer.from(d || '', 'base64url').toString('utf8');
const addrs = (v) => addressparser(v || '').filter((a) => a.address).map((a) => ({ name: a.name || '', address: a.address }));

function walk(part, out) {
  const hdr = (n) => part.headers?.find((h) => h.name.toLowerCase() === n)?.value;
  if (part.filename && part.body?.attachmentId) {
    out.attachments.push({
      filename: part.filename,
      mimeType: part.mimeType || 'application/octet-stream',
      size: part.body.size || 0,
      remoteId: part.body.attachmentId,
      contentId: hdr('content-id') || null,
    });
  } else if (part.mimeType === 'text/plain' && part.body?.data) out.text += decode(part.body.data);
  else if (part.mimeType === 'text/html' && part.body?.data) out.html += decode(part.body.data);
  (part.parts || []).forEach((p) => walk(p, out));
}

function normalize(msg) {
  const h = (n) => msg.payload.headers.find((x) => x.name.toLowerCase() === n)?.value || '';
  const out = { text: '', html: '', attachments: [] };
  walk(msg.payload, out);
  const [from] = addrs(h('from'));
  const labels = msg.labelIds || [];
  return {
    remoteId: msg.id,
    threadId: msg.threadId,
    messageIdHeader: h('message-id') || null,
    fromName: from?.name || '',
    fromEmail: from?.address || '',
    toList: addrs(h('to')),
    ccList: addrs(h('cc')),
    bccList: addrs(h('bcc')),
    subject: h('subject') || '(no subject)',
    snippet: msg.snippet || '',
    bodyText: out.text || null,
    bodyHtml: out.html || null,
    date: new Date(Number(msg.internalDate)),
    isRead: !labels.includes('UNREAD'),
    isStarred: labels.includes('STARRED'),
    hasAttachments: out.attachments.length > 0,
    attachments: out.attachments,
  };
}

export const gmail = {
  async listFolders() {
    return FOLDERS.map(({ path, name, type }) => ({ path, name, type }));
  },

  async syncFolder(account, folder, state, { known, older, limit }) {
    const def = FOLDERS.find((f) => f.path === folder.path);
    if (!def) return { messages: [], state: {} };
    if (older && state.cursor === 'DONE') return { messages: [], state: {} };
    const g = gmailClient(account);
    const params = { userId: 'me', maxResults: limit, includeSpamTrash: true };
    if (def.label) params.labelIds = [def.label];
    if (def.q) params.q = def.q;
    if (older && state.cursor) params.pageToken = state.cursor;
    const { data } = await g.users.messages.list(params);

    // Only fetch messages we don't have (or that moved folders)
    const ids = (data.messages || []).map((m) => m.id).filter((id) => known.get(id) !== folder.id);
    const messages = [];
    for (let i = 0; i < ids.length; i += 5) {
      const chunk = await Promise.all(ids.slice(i, i + 5).map((id) => g.users.messages.get({ userId: 'me', id, format: 'full' })));
      chunk.forEach((r) => messages.push(normalize(r.data)));
    }
    const next = data.nextPageToken || 'DONE';
    return { messages, state: { cursor: older ? next : state.cursor ?? next } };
  },

  async setFlag(account, m, kind, value) {
    const label = kind === 'read' ? 'UNREAD' : 'STARRED';
    const add = kind === 'read' ? !value : value;
    await gmailClient(account).users.messages.modify({
      userId: 'me',
      id: m.remoteId,
      requestBody: add ? { addLabelIds: [label] } : { removeLabelIds: [label] },
    });
  },

  async move(account, m, dest) {
    const g = gmailClient(account);
    if (dest.type === 'TRASH') await g.users.messages.trash({ userId: 'me', id: m.remoteId });
    else if (dest.type === 'ARCHIVE') await g.users.messages.modify({ userId: 'me', id: m.remoteId, requestBody: { removeLabelIds: ['INBOX'] } });
    return {};
  },

  async getAttachment(account, m, att) {
    const { data } = await gmailClient(account).users.messages.attachments.get({ userId: 'me', messageId: m.remoteId, id: att.remoteId });
    return Buffer.from(data.data, 'base64url');
  },
};
