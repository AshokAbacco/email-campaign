import { request, rawRequest, qs } from '../../../api/client.js';

export const inboxApi = {
  // account folders + accounts + unread counts
  folders: () => request('/folders'),
  createFolder: (b) => request('/account-folders', { method: 'POST', body: b }),
  updateFolder: (id, b) => request(`/account-folders/${id}`, { method: 'PATCH', body: b }),
  deleteFolder: (id) => request(`/account-folders/${id}`, { method: 'DELETE' }),

  // messages
  messages: (params) => request('/messages?' + qs(params)),
  message: (id) => request(`/messages/${id}`),
  patch: (id, body) => request(`/messages/${id}`, { method: 'PATCH', body }),
  archive: (id) => request(`/messages/${id}/archive`, { method: 'POST' }),
  trash: (id) => request(`/messages/${id}/trash`, { method: 'POST' }),
  send: (body) => request('/messages/send', { method: 'POST', body }),

  // mail accounts
  sync: (accountId, older = false) => request(`/accounts/${accountId}/sync`, { method: 'POST', body: { older } }),
  disconnect: (id) => request(`/accounts/${id}`, { method: 'DELETE' }),
  moveAccount: (id, accountFolderId) => request(`/accounts/${id}`, { method: 'PATCH', body: { accountFolderId } }),
  connectImap: (body) => request('/accounts/imap', { method: 'POST', body }),
  oauthUrl: (provider, folderId) => request(`/accounts/oauth/${provider}/start?folderId=${encodeURIComponent(folderId)}`),

  async download(messageId, att) {
    const res = await rawRequest(`/messages/${messageId}/attachments/${att.id}`);
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Download failed');
    const url = URL.createObjectURL(await res.blob());
    const a = Object.assign(document.createElement('a'), { href: url, download: att.filename });
    a.click();
    URL.revokeObjectURL(url);
  },
};