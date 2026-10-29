// client/src/pages/pitches/components/PitchPicker.jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronDown, ChevronUp, ExternalLink, Loader2, Presentation, RefreshCw, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { pitchesApi, pitchType } from '../api/pitches.api.js';
import { htmlToText } from '../../../utils/format.js';

// Selectable list of the user's pitches.
// type: 'FRESH' (New Campaign) | 'FOLLOW_UP' (Follow-ups) | undefined = all (Inbox compose)
// collapsible: show a closed "Select a pitch" bar that opens the list on click and closes after a pick
// readable one-line preview: keep a space between paragraphs / lines
const snippet = (html) => htmlToText(html.replace(/<\/(p|div|li|h\d)>|<br\s*\/?>/gi, ' $&')).replace(/\s+/g, ' ').trim();

export default function PitchPicker({ value, onSelect, type, maxHeight = 260, collapsible = false }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  const load = () => {
    setLoading(true);
    pitchesApi.list({ type }).then((r) => setItems(r.items)).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  };
  useEffect(load, [type]); // eslint-disable-line

  const term = q.trim().toLowerCase();
  const shown = term ? items.filter((p) => p.name.toLowerCase().includes(term)) : items;
  const kind = type ? `${pitchType(type).label} ` : '';

  if (loading && !items.length) {
    return <div className="flex items-center gap-2 rounded-xl border border-sky-100 bg-sky-50/50 px-4 py-3 text-sm text-gray-500"><Loader2 size={15} className="animate-spin" /> Loading pitches…</div>;
  }

  if (!items.length) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-sky-200 bg-sky-50/40 px-4 py-3 text-sm">
        <span className="text-gray-600">No {kind}pitches yet. Create one to reuse its content here.</span>
        <div className="flex items-center gap-3">
          <button type="button" onClick={load} className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-blue-600"><RefreshCw size={13} /> Refresh</button>
          <Link to="/pitches" target="_blank" className="flex items-center gap-1 font-semibold text-blue-600 hover:underline">Create pitch <ExternalLink size={13} /></Link>
        </div>
      </div>
    );
  }

  const current = items.find((p) => p.id === value);
  const pick = (p) => { onSelect(p); if (collapsible && p) setOpen(false); };

  const list = (
    <div className={collapsible ? 'rounded-b-xl border border-t-0 border-sky-200 bg-white' : 'rounded-xl border border-sky-100 bg-white'}>
      <div className="flex items-center gap-2 border-b border-sky-100 px-3 py-2">
        <Search size={15} className="text-gray-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${items.length} ${kind}pitch${items.length === 1 ? '' : 'es'}…`}
          className="min-w-0 flex-1 bg-transparent py-1 text-sm outline-none" />
        {value && (
          <button type="button" onClick={() => pick(null)} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100">
            <X size={13} /> Clear
          </button>
        )}
        <button type="button" onClick={load} title="Reload pitches" className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"><RefreshCw size={13} className={loading ? 'animate-spin' : ''} /></button>
        <Link to="/pitches" target="_blank" title="Manage pitches" className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"><ExternalLink size={13} /></Link>
      </div>
      <div className="scroll-thin divide-y overflow-y-auto" style={{ maxHeight }}>
        {shown.map((p) => {
          const active = p.id === value;
          return (
            <button key={p.id} type="button" onClick={() => pick(active ? null : p)}
              className={`flex w-full items-start gap-3 px-4 py-3 text-left transition ${active ? 'bg-blue-50' : 'hover:bg-sky-50/60'}`}>
              <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${active ? 'border-blue-600 bg-blue-600 text-white' : 'border-sky-200'}`}>
                {active && <Check size={12} strokeWidth={3} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <Presentation size={14} className="shrink-0 text-sky-600" />
                  <span className={`truncate text-sm font-semibold ${active ? 'text-blue-700' : 'text-gray-800'}`}>{p.name}</span>
                </span>
                {!type && <span className={`mt-1 inline-block rounded-full border px-2 py-0 text-[11px] font-semibold ${pitchType(p.type).badge}`}>{pitchType(p.type).label}</span>}
                <span className="mt-0.5 block truncate text-xs text-gray-400">{snippet(p.bodyHtml).slice(0, 160)}</span>
              </span>
            </button>
          );
        })}
        {!shown.length && <p className="px-4 py-6 text-center text-sm text-gray-400">No pitches match “{q}”.</p>}
      </div>
    </div>
  );

  if (!collapsible) return list;

  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className={`flex w-full items-center justify-between gap-3 border border-sky-200 bg-white px-4 py-3 text-left text-sm transition hover:border-blue-400 ${open ? 'rounded-t-xl border-b-sky-100' : 'rounded-xl'}`}>
        <span className="flex min-w-0 items-center gap-2">
          <Presentation size={15} className="shrink-0 text-sky-600" />
          {current
            ? <span className="truncate font-semibold text-blue-700">{current.name}</span>
            : <span className="font-medium text-gray-600">Select {type ? `a ${pitchType(type).label}` : 'a'} pitch <span className="font-normal text-gray-400">({items.length} available)</span></span>}
        </span>
        {open ? <ChevronUp size={18} className="shrink-0 text-blue-600" /> : <ChevronDown size={18} className="shrink-0 text-blue-600" />}
      </button>
      {open && list}
    </div>
  );
}