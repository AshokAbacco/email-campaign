// client/src/pages/pitches/Pitches.jsx
import { useCallback, useEffect, useState } from 'react';
import { Eye, Loader2, Pencil, Plus, Presentation, Search, Send, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { pitchesApi, PITCH_TYPES, pitchType } from './api/pitches.api.js';
import PitchFormModal from './components/PitchFormModal.jsx';
import PreviewModal from '../campaigns/components/PreviewModal.jsx';
import { formatDate, htmlToText } from '../../utils/format.js';

// readable one-line preview: keep a space between paragraphs / lines
const snippet = (html) => htmlToText(html.replace(/<\/(p|div|li|h\d)>|<br\s*\/?>/gi, ' $&')).replace(/\s+/g, ' ').trim();

export default function Pitches() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [type, setType] = useState(''); // '' = all, FRESH, FOLLOW_UP
  const [counts, setCounts] = useState({ FRESH: 0, FOLLOW_UP: 0 });
  const [editing, setEditing] = useState(null); // null = closed, {} = new, pitch = edit
  const [viewing, setViewing] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    pitchesApi.list({ q: q.trim(), type }).then((r) => { setItems(r.items); setCounts(r.counts); }).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  }, [q, type]);

  useEffect(() => {
    const t = setTimeout(load, 250); // debounce search
    return () => clearTimeout(t);
  }, [load]);

  const remove = async (p) => {
    const used = p.campaignsCount ? ` It was used by ${p.campaignsCount} campaign(s); those keep the content they were sent with.` : '';
    if (!window.confirm(`Delete the pitch "${p.name}"?${used}`)) return;
    try {
      await pitchesApi.remove(p.id);
      setItems((list) => list.filter((x) => x.id !== p.id));
      setCounts((c) => ({ ...c, [p.type]: Math.max(0, c[p.type] - 1) }));
      toast.success('Pitch deleted');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const saved = () => { setEditing(null); load(); };

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-b from-blue-50/70 to-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-600 text-white shadow"><Presentation size={22} /></span>
            <div><h1 className="text-3xl font-bold text-blue-700">Pitches</h1><p className="text-sm text-gray-600">Reusable email content for your fresh campaigns and follow-ups</p></div>
          </div>
          <button onClick={() => setEditing({})}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 px-5 py-3 text-sm font-semibold text-white shadow hover:opacity-95">
            <Plus size={18} /> New Pitch
          </button>
        </div>

        <div className="mt-6 flex gap-1 border-b border-sky-100">
          {[{ id: '', label: 'All Pitches', icon: Presentation, n: counts.FRESH + counts.FOLLOW_UP }, ...PITCH_TYPES.map((t) => ({ ...t, n: counts[t.id] }))].map((t) => (
            <button key={t.id || 'all'} onClick={() => setType(t.id)}
              className={`-mb-px flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-medium transition ${type === t.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-600 hover:text-blue-600'}`}>
              <t.icon size={16} /> {t.label}
              <span className={`rounded-full px-2 py-0.5 text-xs ${type === t.id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>{t.n}</span>
            </button>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search pitches by name…"
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
          </div>
          <span className="text-sm text-gray-500">{items.length} pitch{items.length === 1 ? '' : 'es'}</span>
        </div>

        <div className="py-6">
          {loading && !items.length ? (
            <div className="grid place-items-center py-20 text-gray-400"><Loader2 className="animate-spin" /></div>
          ) : !items.length ? (
            <div className="rounded-2xl border border-dashed border-sky-200 bg-white py-16 text-center">
              <Presentation size={32} className="mx-auto text-sky-300" />
              <p className="mt-3 font-semibold text-gray-700">{q ? 'No pitches match your search' : type ? `No ${pitchType(type).label} pitches yet` : 'No pitches yet'}</p>
              <p className="text-sm text-gray-500">Fresh Mail pitches appear in New Campaign, Follow-up pitches in Follow-ups.</p>
              {!q && <button onClick={() => setEditing({})} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Create your first pitch</button>}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((p) => (
                <div key={p.id} className="flex flex-col rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="line-clamp-1 font-semibold text-gray-900" title={p.name}>{p.name}</h3>
                    {p.campaignsCount > 0 && (
                      <span className="flex shrink-0 items-center gap-1 rounded-full border border-sky-100 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
                        <Send size={11} /> {p.campaignsCount}
                      </span>
                    )}
                  </div>
                  {(() => { const t = pitchType(p.type); return (
                    <span className={`mt-2 flex w-fit items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${t.badge}`}><t.icon size={12} /> {t.label}</span>
                  ); })()}
                  <p className="mt-3 line-clamp-3 flex-1 text-sm text-gray-500">{snippet(p.bodyHtml).slice(0, 300) || '—'}</p>
                  <div className="mt-4 flex items-center justify-between border-t pt-3">
                    <span className="text-xs text-gray-400">Updated {formatDate(p.updatedAt)}</span>
                    <div className="flex gap-1">
                      <button onClick={() => setViewing(p)} title="Preview" className="rounded-lg p-2 text-gray-600 hover:bg-sky-50 hover:text-blue-700"><Eye size={16} /></button>
                      <button onClick={() => setEditing(p)} title="Edit" className="rounded-lg p-2 text-gray-600 hover:bg-sky-50 hover:text-blue-700"><Pencil size={16} /></button>
                      <button onClick={() => remove(p)} title="Delete" className="rounded-lg p-2 text-gray-600 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {editing && <PitchFormModal pitch={editing.id ? editing : null} defaultType={type || 'FRESH'} onSaved={saved} onClose={() => setEditing(null)} />}
      {viewing && <PreviewModal html={viewing.bodyHtml} subject={viewing.name} onClose={() => setViewing(null)} />}
    </div>
  );
}