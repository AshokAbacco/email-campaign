import { useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, FileText, Folder, FolderInput, Inbox, Mail, Plus, RefreshCw, Send, Trash2, TriangleAlert, X } from 'lucide-react';
import { FOLDER_COLORS, MAX_ACCOUNTS_PER_FOLDER } from '../utils/groups.js';

const MAIL_FOLDERS = [
  { k: 'inbox', label: 'Inbox', icon: Inbox, color: 'text-sky-500' },
  { k: 'sent', label: 'Sent', icon: Send, color: 'text-emerald-500' },
  { k: 'spam', label: 'Spam', icon: AlertCircle, color: 'text-orange-500' },
  { k: 'drafts', label: 'Drafts', icon: FileText, color: 'text-blue-500' },
  { k: 'trash', label: 'Trash', icon: Trash2, color: 'text-red-500' },
];

const AVATARS = ['bg-blue-600', 'bg-emerald-600', 'bg-violet-600', 'bg-orange-500', 'bg-rose-500', 'bg-teal-600', 'bg-indigo-600', 'bg-amber-600'];
const avatarColor = (s) => AVATARS[[...s].reduce((n, c) => n + c.charCodeAt(0), 0) % AVATARS.length];

export default function Sidebar({
  meta = { counts: {}, accounts: [], accountFolders: [] },
  nav, onNav, onAdd, onSyncAccount, onRemove, onMove, syncingId, className = '', user, onLogout,
}) {
  const [closedGroups, setClosedGroups] = useState({});
  const [closedAccounts, setClosedAccounts] = useState({});

  const groups = [
    ...meta.accountFolders.map((f) => ({ id: f.id, name: f.name, color: FOLDER_COLORS[f.color] || FOLDER_COLORS.emerald, limit: true })),
  ];
  const unassigned = meta.accounts.filter((a) => !a.accountFolderId);
  if (unassigned.length) groups.push({ id: '__none', name: 'No folder', color: 'bg-gray-400', limit: false });

  const renderAccount = (a) => {
    const open = !closedAccounts[a.id];
    const accountActive = nav.accountId === a.id;
    return (
      <div key={a.id}>
        <div className={`group flex items-center gap-2 rounded-xl px-2 py-2 ${accountActive ? 'bg-teal-50/70' : 'hover:bg-gray-50'}`}>
          <button
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
            onClick={() => setClosedAccounts({ ...closedAccounts, [a.id]: open })}
            title={a.email}
          >
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-semibold text-white ${avatarColor(a.email)}`}>
              {(a.displayName || a.email)[0].toUpperCase()}
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1 text-sm font-medium text-gray-800">
                <span className="truncate">{a.email}</span>
                {a.status !== 'ACTIVE' && <TriangleAlert size={13} className="shrink-0 text-amber-500" title={a.lastError || 'Needs attention'} />}
              </span>
              <span className="block text-xs font-medium text-blue-600">{a.unread || 0} unread</span>
            </span>
          </button>
          <span className="hidden items-center gap-1.5 text-gray-400 group-hover:flex">
            <button onClick={() => onSyncAccount(a.id)} title="Sync"><RefreshCw size={13} className={syncingId === a.id ? 'animate-spin' : ''} /></button>
            <button onClick={() => onMove(a)} title="Move to folder"><FolderInput size={13} /></button>
            <button onClick={() => onRemove(a)} title="Disconnect"><X size={13} /></button>
          </span>
          <button onClick={() => setClosedAccounts({ ...closedAccounts, [a.id]: open })} className="text-gray-400" aria-label="Toggle folders">
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {open && (
          <div className="ml-3 space-y-0.5 pb-1">
            {MAIL_FOLDERS.map(({ k, label, icon: Icon, color }) => {
              const active = accountActive && nav.folder === k;
              const n = a.counts?.[k] || 0;
              return (
                <button
                  key={k}
                  onClick={() => onNav({ folder: k, accountId: a.id, folderId: null })}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    active ? 'bg-teal-100/70 font-semibold text-teal-800' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon size={16} className={color} /> {label}
                  {n > 0 && <span className="ml-auto rounded-full bg-blue-600 px-1.5 text-xs font-medium text-white">{n > 99 ? '99+' : n}</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className={`flex-col border-r bg-white ${className}`}>
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-600 text-white"><Mail size={17} /></div>
        <span className="font-semibold text-blue-600">Mail</span>
        <button onClick={onAdd} className="ml-auto flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700">
          <Plus size={15} /> Add
        </button>
      </div>

      <div className="scroll-thin flex-1 space-y-3 overflow-y-auto px-3 pb-3">
        {groups.length === 0 && (
          <p className="px-2 pt-2 text-sm text-gray-400">No folders yet. Click “Add” to create a folder and connect your first mailbox.</p>
        )}

        {groups.map((g) => {
          const list = meta.accounts.filter((a) => (g.id === '__none' ? !a.accountFolderId : a.accountFolderId === g.id));
          const unread = list.reduce((s, a) => s + (a.unread || 0), 0);
          const open = !closedGroups[g.id];
          return (
            <div key={g.id}>
              <button
                onClick={() => setClosedGroups({ ...closedGroups, [g.id]: open })}
                className="flex w-full items-center gap-3 rounded-xl bg-teal-50 px-3 py-2.5 hover:bg-teal-100/70"
              >
                <span className={`grid h-8 w-8 place-items-center rounded-lg text-white ${g.color}`}><Folder size={16} /></span>
                <span className="truncate text-sm font-semibold text-gray-800">{g.name}</span>
                {unread > 0 && <span className="ml-auto rounded-full bg-sky-500 px-2 text-xs font-medium text-white">{unread}</span>}
                <span className={`${unread > 0 ? '' : 'ml-auto'} shrink-0 text-xs text-gray-500`}>
                  {list.length}{g.limit ? `/${MAX_ACCOUNTS_PER_FOLDER}` : ''}
                </span>
                {open ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
              </button>

              {open && (
                <div className="mt-1 space-y-1 border-l-2 border-teal-100 pl-2">
                  {list.length === 0 && <p className="px-2 py-2 text-xs text-gray-400">No accounts yet. Use “Add” to connect one.</p>}
                  {list.map(renderAccount)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2 border-t px-4 py-3 text-xs text-gray-500">
        <span className="truncate">{user?.email}</span>
        <button onClick={onLogout} className="ml-auto text-blue-600 hover:underline">Sign out</button>
      </div>
    </aside>
  );
}