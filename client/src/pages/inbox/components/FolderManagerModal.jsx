import { useState } from 'react';
import { ArrowRight, Check, Folder, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { inboxApi as api } from '../api/inbox.api.js';
import { FOLDER_COLORS, MAX_ACCOUNTS_PER_FOLDER } from '../utils/groups.js';

export default function FolderManagerModal({ folders = [], mode = 'add', accountEmail, onPick, onChanged, onClose }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('emerald');
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);

  const reset = () => { setName(''); setColor('emerald'); setEditingId(null); };

  const save = async (e) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Enter a folder name');
    setBusy(true);
    try {
      if (editingId) await api.updateFolder(editingId, { name, color });
      else await api.createFolder({ name, color });
      toast.success(editingId ? 'Folder updated' : 'Folder created');
      reset();
      await onChanged();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const edit = (f) => { setEditingId(f.id); setName(f.name); setColor(f.color); };

  const remove = async (f) => {
    if (!window.confirm(`Delete folder "${f.name}"?`)) return;
    try {
      await api.deleteFolder(f.id);
      toast.success('Folder deleted');
      if (editingId === f.id) reset();
      await onChanged();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const pickLabel = mode === 'move' ? 'Move here' : 'Add account';

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h3 className="font-semibold">{mode === 'move' ? 'Move account to a folder' : 'Folders'}</h3>
            <p className="text-xs text-gray-500">
              {mode === 'move' ? accountEmail : `Create a folder, then add up to ${MAX_ACCOUNTS_PER_FOLDER} mail accounts to it.`}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <form onSubmit={save} className="space-y-3 border-b bg-gray-50 px-5 py-4">
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              placeholder={editingId ? 'Rename folder' : 'New folder name (e.g. Sales Team)'}
              className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            <button disabled={busy} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
              {busy ? <Loader2 size={15} className="animate-spin" /> : editingId ? <Check size={15} /> : <Plus size={15} />}
              {editingId ? 'Save' : 'Create'}
            </button>
            {editingId && <button type="button" onClick={reset} className="rounded-lg border px-3 py-2 text-sm hover:bg-white">Cancel</button>}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Color</span>
            {Object.entries(FOLDER_COLORS).map(([key, cls]) => (
              <button
                type="button"
                key={key}
                onClick={() => setColor(key)}
                aria-label={key}
                className={`h-5 w-5 rounded-full ${cls} ${color === key ? 'ring-2 ring-offset-2 ring-gray-700' : ''}`}
              />
            ))}
          </div>
        </form>

        <div className="scroll-thin min-h-0 flex-1 space-y-2 overflow-y-auto p-5">
          {folders.length === 0 && (
            <div className="py-8 text-center text-sm text-gray-400">
              <Folder size={32} className="mx-auto mb-2" />
              No folders yet. Create your first folder above to start adding mail accounts.
            </div>
          )}
          {folders.map((f) => {
            const full = f.accountCount >= MAX_ACCOUNTS_PER_FOLDER;
            return (
              <div key={f.id} className="flex items-center gap-3 rounded-xl border px-3 py-2.5">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white ${FOLDER_COLORS[f.color] || FOLDER_COLORS.emerald}`}><Folder size={17} /></span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{f.name}</div>
                  <div className={`text-xs ${full ? 'text-red-500' : 'text-gray-400'}`}>
                    {f.accountCount}/{MAX_ACCOUNTS_PER_FOLDER} accounts{full ? ' · full' : ''}
                  </div>
                </div>
                <button onClick={() => edit(f)} title="Edit" className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"><Pencil size={15} /></button>
                <button onClick={() => remove(f)} title="Delete" className="rounded-md p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
                <button
                  onClick={() => onPick(f)}
                  disabled={full}
                  className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {pickLabel} <ArrowRight size={13} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}