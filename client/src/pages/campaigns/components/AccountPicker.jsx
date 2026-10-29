// client/src/pages/campaigns/components/AccountPicker.jsx
//
// From-account list for New Campaign: a collapsible "Select From Emails" box (closed by default).
// When opened: accounts grouped by their Inbox folder, a checkbox per account and, on the same row,
// the hourly sending limit for that account (Default / 5–150 per hour / Custom).
import { useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, X } from 'lucide-react';
import { FOLDER_COLORS } from '../../inbox/utils/groups.js';
import {
  DEFAULT_HOURLY, HOURLY_PRESETS, MAX_HOURLY, MIN_HOURLY, PROVIDER_LABEL,
  durationLabel, intervalLabel, intervalShort, limitValid, limitValue,
} from '../utils/sendingRate.js';

export default function AccountPicker({
  accounts, folders = [], value, onChange, limits, onLimitsChange, usage = {}, defaults = DEFAULT_HOURLY, recipients = 0,
}) {
  const [open, setOpen] = useState(false);
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  const setChoice = (id, patch) => onLimitsChange({ ...limits, [id]: { ...(limits[id] || { mode: 'default', custom: '' }), ...patch } });
  const perHour = (a) => limitValue(limits[a.id], a.provider, defaults);

  // group by Inbox folder; accounts without a folder go last
  const groups = [
    ...folders.map((f) => ({ ...f, items: accounts.filter((a) => a.accountFolderId === f.id) })),
    { id: 'none', name: 'Other accounts', color: 'slate', items: accounts.filter((a) => !folders.some((f) => f.id === a.accountFolderId)) },
  ].filter((g) => g.items.length || g.id !== 'none');

  const selected = accounts.filter((a) => value.includes(a.id));
  const capacity = selected.reduce((s, a) => s + (limitValid(perHour(a)) ? perHour(a) : 0), 0);
  const allOn = accounts.length > 0 && selected.length === accounts.length;

  const selectGroup = (items) => {
    const ids = items.map((a) => a.id);
    const on = ids.every((id) => value.includes(id));
    onChange(on ? value.filter((id) => !ids.includes(id)) : [...new Set([...value, ...ids])]);
  };

  return (
    <div>
      <span className="mb-2 inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
        <CheckCircle2 size={12} /> {accounts.length} Available
      </span>

      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className={`flex w-full items-center justify-between gap-3 border border-sky-200 bg-white px-4 py-3 text-left text-sm transition hover:border-blue-400 ${open ? 'rounded-t-xl border-b-sky-100' : 'rounded-xl'}`}>
        <span className={selected.length ? 'font-medium text-gray-900' : 'font-medium text-gray-600'}>
          {selected.length ? <>{selected.length} selected <span className="font-normal text-gray-500">· total capacity <b className="text-blue-700">~{capacity}/hr</b></span></> : 'Select From Emails'}
        </span>
        {open ? <ChevronUp size={18} className="shrink-0 text-blue-600" /> : <ChevronDown size={18} className="shrink-0 text-blue-600" />}
      </button>

      {/* closed: selected accounts as chips with their limit */}
      {!open && selected.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selected.map((a) => (
            <span key={a.id} className="flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-700">
              {a.email} <b className="font-semibold">· {limitValid(perHour(a)) ? `${perHour(a)}/hr` : 'limit?'}</b>
              <button type="button" onClick={() => toggle(a.id)} aria-label={`Remove ${a.email}`}><X size={12} /></button>
            </span>
          ))}
        </div>
      )}

      {open && (
    <div className="overflow-hidden rounded-b-xl border border-t-0 border-sky-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-100 bg-sky-50/60 px-4 py-2.5">
        <span className="text-xs text-gray-600">
          {recipients > 1 && capacity > 0
            ? <>{recipients} recipients take <b className="text-blue-700">{durationLabel(recipients, capacity)}</b> at ~{capacity}/hr</>
            : 'Tick the accounts to send from and choose each one’s hourly limit'}
        </span>
        {accounts.length > 1 && (
          <button type="button" onClick={() => onChange(allOn ? [] : accounts.map((a) => a.id))} className="text-xs font-semibold text-blue-600 hover:underline">
            {allOn ? 'Clear all' : 'Select all'}
          </button>
        )}
      </div>

      <div className="scroll-thin max-h-[26rem] overflow-y-auto px-3 py-2">
        {accounts.length === 0 && <p className="px-2 py-4 text-sm text-gray-400">No active accounts. Add one in the Inbox first.</p>}
        {groups.map((g) => (
          <div key={g.id} className="py-1.5">
            <div className="flex items-center gap-2 px-1">
              <span className={`h-3.5 w-3.5 rounded ${FOLDER_COLORS[g.color] || 'bg-slate-500'}`} />
              <span className="text-sm font-semibold text-gray-800">{g.name}</span>
              <span className="text-xs text-gray-400">({g.items.length})</span>
            </div>
            {g.items.length > 0 ? (
              <button type="button" onClick={() => selectGroup(g.items)} className="mb-1 ml-1 mt-1 text-xs font-medium text-blue-600 hover:underline">
                {g.items.every((a) => value.includes(a.id)) ? 'Clear group' : 'Select all in group'}
              </button>
            ) : (
              <p className="mb-1 ml-1 mt-1 text-xs text-gray-400">No active accounts in this folder</p>
            )}

            <div className="ml-2 space-y-1.5 border-l-2 border-sky-100 pl-3">
              {g.items.map((a) => {
                const on = value.includes(a.id);
                const choice = limits[a.id] || { mode: 'default', custom: '' };
                const n = perHour(a);
                const ok = limitValid(n);
                const u = usage[a.id] || { today: 0, lastHour: 0 };
                const def = defaults[a.provider] || 20;
                return (
                  <div key={a.id} className={`flex flex-wrap items-center gap-3 rounded-xl px-3 py-2.5 transition ${on ? 'bg-sky-50 ring-1 ring-sky-200' : 'hover:bg-gray-50'}`}>
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                      <input type="checkbox" className="h-4 w-4 shrink-0 accent-blue-600" checked={on} onChange={() => toggle(a.id)} />
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-600 text-sm font-semibold text-white">
                        {(a.displayName || a.email)[0].toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-gray-900">{a.email}</span>
                        <span className={`block truncate text-xs font-medium ${ok ? 'text-sky-700' : 'text-red-600'}`}>
                          {(PROVIDER_LABEL[a.provider] || a.provider).toUpperCase()} • {ok ? `Limit: ${n}/hr (1 email every ${intervalLabel(n)})` : `Enter ${MIN_HOURLY}–${MAX_HOURLY} emails/hour`}
                        </span>
                        <span className="block truncate text-xs text-gray-500">
                          Today: {u.today} sent{u.lastHour ? ` • last hour: ${u.lastHour}` : ''}
                          {a.displayName && a.displayName !== a.email ? ` • ${a.displayName}` : ''}
                        </span>
                      </span>
                    </label>

                    <div className="flex items-center gap-2">
                      {choice.mode === 'custom' && (
                        <input type="number" min={MIN_HOURLY} max={MAX_HOURLY} step={1} value={choice.custom} placeholder="/hr"
                          onChange={(e) => setChoice(a.id, { custom: e.target.value })} onFocus={() => !on && toggle(a.id)}
                          className={`w-20 rounded-lg border px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-100 ${ok ? 'border-gray-300 focus:border-blue-500' : 'border-red-300'}`} />
                      )}
                      <select value={choice.mode}
                        onChange={(e) => { setChoice(a.id, { mode: e.target.value }); if (!on) toggle(a.id); }}
                        className="rounded-lg border-2 border-sky-300 bg-white px-2.5 py-1.5 text-sm font-medium text-gray-800 outline-none focus:border-blue-500">
                        <option value="default">Default ({def})</option>
                        {HOURLY_PRESETS.map((p) => <option key={p} value={String(p)}>{p}/hr · {intervalShort(p)}</option>)}
                        <option value="custom">Custom…</option>
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-end border-t border-sky-100 px-4 py-2">
        <button type="button" onClick={() => setOpen(false)} className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-sky-50">
          <ChevronUp size={14} /> Done
        </button>
      </div>
    </div>
      )}
    </div>
  );
}