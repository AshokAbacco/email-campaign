import { useEffect, useRef, useState } from 'react';
import { Check, CheckCircle2, ChevronDown, X } from 'lucide-react';

export default function AccountPicker({ accounts, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  const chosen = accounts.filter((a) => value.includes(a.id));

  return (
    <div ref={ref} className="relative">
      <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700">
        <CheckCircle2 size={12} /> {accounts.length} Available
      </span>
      <button type="button" onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-sm hover:border-blue-400">
        <span className={chosen.length ? 'text-gray-900' : 'text-gray-500'}>{chosen.length ? `${chosen.length} selected` : 'Select From Emails'}</span>
        <ChevronDown size={16} className="text-blue-500" />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border bg-white p-1 shadow-lg">
          {accounts.length === 0 && <p className="px-3 py-3 text-sm text-gray-400">No connected accounts. Add one in the Inbox first.</p>}
          {accounts.length > 1 && (
            <button type="button" onClick={() => onChange(value.length === accounts.length ? [] : accounts.map((a) => a.id))}
              className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-blue-600 hover:bg-blue-50">
              {value.length === accounts.length ? 'Clear all' : 'Select all'}
            </button>
          )}
          {accounts.map((a) => (
            <button type="button" key={a.id} onClick={() => toggle(a.id)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-50">
              <span className={`grid h-4 w-4 place-items-center rounded border ${value.includes(a.id) ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300'}`}>
                {value.includes(a.id) && <Check size={11} />}
              </span>
              <span className="min-w-0"><span className="block truncate">{a.email}</span>
                {a.displayName && a.displayName !== a.email && <span className="block truncate text-xs text-gray-400">{a.displayName}</span>}</span>
            </button>
          ))}
        </div>
      )}

      {chosen.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {chosen.map((a) => (
            <span key={a.id} className="flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-700">
              {a.email}<button type="button" onClick={() => toggle(a.id)} aria-label="Remove"><X size={12} /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
