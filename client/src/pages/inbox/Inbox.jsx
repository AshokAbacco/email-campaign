import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { inboxApi as api } from './api/inbox.api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import Sidebar from './components/Sidebar.jsx';
import MessageList from './components/MessageList.jsx';
import MessagePreview from './components/MessagePreview.jsx';
import FolderManagerModal from './components/FolderManagerModal.jsx';
import AddAccountModal from './components/AddAccountModal.jsx';
import ComposeModal from './components/ComposeModal.jsx';
import { buildReply, buildForward } from './utils/composeHtml.js';

const TITLES = { inbox: 'Inbox', sent: 'Sent', drafts: 'Drafts', spam: 'Spam', trash: 'Trash' };
const EMPTY = { items: [], total: 0, page: 1, pages: 1 };

export default function Inbox() {
  const { user, logout } = useAuth();
  const [params, setParams] = useSearchParams();
  const [nav, setNav] = useState({ folder: 'inbox', accountId: null, folderId: null });
  const [meta, setMeta] = useState({ counts: {}, accounts: [], accountFolders: [] });
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  const [list, setList] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selId, setSelId] = useState(null);
  const [pane, setPane] = useState('list'); // mobile/tablet: sidebar | list | preview
  const [folderModal, setFolderModal] = useState(null); // { mode: 'add' | 'move', account? }
  const [addTo, setAddTo] = useState(null);             // folder chosen for the Add Account form
  const [compose, setCompose] = useState(null);
  const [syncingId, setSyncingId] = useState(null);
  const reqId = useRef(0);

  const loadMeta = useCallback(() => api.folders().then(setMeta).catch((e) => toast.error(e.message)), []);

  const loadList = useCallback(async (page = 1, append = false) => {
    const id = ++reqId.current;
    append ? setLoadingMore(true) : setLoading(true);
    try {
      const r = await api.messages({ folder: nav.folder, accountId: nav.accountId, q: dq, page });
      if (id !== reqId.current) return;
      setList((prev) => (append ? { ...r, items: [...prev.items, ...r.items] } : r));
    } catch (e) {
      toast.error(e.message);
    } finally {
      if (id === reqId.current) { setLoading(false); setLoadingMore(false); }
    }
  }, [nav, dq]);

  useEffect(() => { const t = setTimeout(() => setDq(q), 350); return () => clearTimeout(t); }, [q]);
  useEffect(() => { loadList(1); }, [loadList]);
  useEffect(() => { loadMeta(); }, [loadMeta]);

  // OAuth redirect result
  useEffect(() => {
    if (params.get('connected')) toast.success('Account connected. Syncing your mail…');
    if (params.get('oauth_error')) toast.error(params.get('oauth_error'), { duration: 8000 });
    if (params.toString()) setParams({}, { replace: true });
  }, []); // eslint-disable-line

  // Poll while a newly added account is still doing its first sync
  useEffect(() => {
    if (!meta.accounts.some((a) => !a.lastSyncAt && a.status === 'ACTIVE')) return;
    const t = setInterval(() => { loadMeta(); loadList(1); }, 4000);
    return () => clearInterval(t);
  }, [meta, loadMeta, loadList]);

  const patchLocal = (id, data) => {
    setList((l) => ({ ...l, items: l.items.map((m) => (m.id === id ? { ...m, ...data } : m)) }));
    setDetail((d) => (d?.id === id ? { ...d, ...data } : d));
  };
  const removeLocal = (id) => {
    setList((l) => ({ ...l, total: l.total - 1, items: l.items.filter((m) => m.id !== id) }));
    if (selId === id) { setSelId(null); setDetail(null); setPane('list'); }
  };

  const select = async (m) => {
    setSelId(m.id);
    setPane('preview');
    setDetailLoading(true);
    try {
      const { message } = await api.message(m.id);
      setDetail(message);
      if (!message.isRead) {
        patchLocal(m.id, { isRead: true });
        api.patch(m.id, { isRead: true }).then(loadMeta).catch((e) => { patchLocal(m.id, { isRead: false }); toast.error(e.message); });
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const act = async (id, body, okMsg) => {
    const prev = list.items.find((m) => m.id === id) || detail;
    patchLocal(id, body);
    try {
      await api.patch(id, body);
      if (okMsg) toast.success(okMsg);
      loadMeta();
    } catch (e) {
      patchLocal(id, { isRead: prev.isRead, isStarred: prev.isStarred });
      toast.error(e.message);
    }
  };

  const trash = async (id) => {
    try {
      await api.trash(id);
      removeLocal(id);
      toast.success('Moved to Trash');
      loadMeta();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const syncAccounts = async (ids, older = false) => {
    for (const id of ids) {
      setSyncingId(id);
      try { await api.sync(id, older); } catch (e) { toast.error(e.message); }
    }
    setSyncingId(null);
    await Promise.all([loadMeta(), loadList(1)]);
    toast.success(older ? 'Older mail fetched' : 'Sync complete');
  };
  const syncCurrent = (older) => syncAccounts(nav.accountId ? [nav.accountId] : meta.accounts.map((a) => a.id), older);

  const removeAccount = async (a) => {
    if (!window.confirm(`Disconnect ${a.email}? Its synced mail will be removed from this app.`)) return;
    try {
      await api.disconnect(a.id);
      toast.success('Account disconnected');
      if (nav.accountId === a.id) setNav({ folder: nav.folder, accountId: null, folderId: null });
      loadMeta(); loadList(1);
    } catch (e) { toast.error(e.message); }
  };

  // Folder page → pick a folder → Add Account form (or move an existing account)
  const pickFolder = async (folder) => {
    if (folderModal?.mode === 'move') {
      try {
        await api.moveAccount(folderModal.account.id, folder.id);
        toast.success(`Moved to "${folder.name}"`);
        setFolderModal(null);
        loadMeta();
      } catch (e) { toast.error(e.message); }
      return;
    }
    setFolderModal(null);
    setAddTo(folder);
  };

  const quote = (m) =>
    `\n\nOn ${formatDate(m.date, true)}, ${m.fromName || m.fromEmail} wrote:\n` +
    (m.bodyText || htmlToText(m.bodyHtml)).split('\n').map((l) => `> ${l}`).join('\n');

  const openCompose = (kind) => {
    const m = detail;
    const fromLabel = `${m.account.displayName} <${m.account.email}>`;
    // replying to a message you sent yourself goes to its original recipients
    const mine = m.fromEmail.toLowerCase() === m.account.email.toLowerCase();
    const replyTo = mine ? (m.toList || []).map((p) => p.address).join(', ') : m.fromEmail;

    setCompose(
      kind === 'reply'
        ? {
            title: 'Reply', accountId: m.account.id, fromLabel, to: replyTo,
            subject: /^re:/i.test(m.subject) ? m.subject : `Re: ${m.subject}`,
            html: buildReply(m), inReplyToId: m.id,
          }
        : {
            title: 'Forward', accountId: m.account.id, fromLabel, to: '',
            subject: /^fwd?:/i.test(m.subject) ? m.subject : `Fwd: ${m.subject}`,
            html: buildForward(m), forwardOfId: m.id, attachments: m.attachments || [],
          }
    );
  };

  const acct = meta.accounts.find((a) => a.id === nav.accountId);
  const title = TITLES[nav.folder] + (acct ? ` · ${acct.email}` : '');

  return (
    <div className="flex h-full overflow-hidden bg-white">
      <Sidebar
        className={`${pane === 'sidebar' ? 'flex' : 'hidden'} w-full md:flex md:w-72 md:shrink-0`}
        meta={meta} nav={nav} user={user} onLogout={logout} syncingId={syncingId}
        onNav={(n) => { setNav(n); setSelId(null); setDetail(null); setPane('list'); }}
        onAdd={() => setFolderModal({ mode: 'add' })}
        onMove={(a) => setFolderModal({ mode: 'move', account: a })}
        onSyncAccount={(id) => syncAccounts([id])} onRemove={removeAccount}
      />
      <MessageList
        className={`${pane === 'list' ? 'flex' : pane === 'preview' ? 'hidden lg:flex' : 'hidden md:flex'} w-full md:w-80 md:shrink-0 lg:w-96`}
        title={title} list={list} loading={loading} loadingMore={loadingMore} selectedId={selId}
        q={q} onQ={setQ} onSelect={select} onStar={(m) => act(m.id, { isStarred: !m.isStarred })}
        onMore={() => loadList(list.page + 1, true)} onSync={() => syncCurrent(false)} syncing={!!syncingId}
        onOlder={() => syncCurrent(true)} onMenu={() => setPane('sidebar')}
      />
      <MessagePreview
        className={`${pane === 'preview' ? 'flex' : 'hidden lg:flex'} min-w-0 flex-1`}
        msg={detail} loading={detailLoading} onBack={() => setPane('list')}
        onStar={() => act(detail.id, { isStarred: !detail.isStarred })}
        onUnread={() => { act(detail.id, { isRead: false }, 'Marked as unread'); setPane('list'); }}
        onTrash={() => trash(detail.id)}
        onReply={() => openCompose('reply')} onForward={() => openCompose('forward')}
        onDownload={(a) => api.download(detail.id, a).catch((e) => toast.error(e.message))}
      />

      {folderModal && (
        <FolderManagerModal
          mode={folderModal.mode}
          accountEmail={folderModal.account?.email}
          folders={meta.accountFolders}
          onPick={pickFolder}
          onChanged={loadMeta}
          onClose={() => setFolderModal(null)}
        />
      )}
      {addTo && (
        <AddAccountModal
          folder={addTo}
          accounts={meta.accounts}
          onBack={() => { setAddTo(null); setFolderModal({ mode: 'add' }); }}
          onClose={() => setAddTo(null)}
          onConnected={() => { setAddTo(null); loadMeta(); }}
        />
      )}
      {compose && <ComposeModal init={compose} onClose={() => setCompose(null)} />}
    </div>
  );
}