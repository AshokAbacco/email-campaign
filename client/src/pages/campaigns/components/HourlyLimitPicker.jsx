// client/src/pages/campaigns/components/HourlyLimitPicker.jsx
import { Clock } from 'lucide-react';
import { HOURLY_PRESETS, MAX_HOURLY, MIN_HOURLY, durationLabel, intervalLabel } from '../utils/sendingRate.js';

// value: { mode: '10' | '20' | ... | 'custom', custom: '' }  ->  emails per hour = hourlyValue(value)
export const hourlyValue = (v) => (v.mode === 'custom' ? Number(v.custom) : Number(v.mode));
export const hourlyValid = (v) => {
  const n = hourlyValue(v);
  return Number.isInteger(n) && n >= MIN_HOURLY && n <= MAX_HOURLY;
};

// The limit applies PER SENDING ACCOUNT: every selected account sends 1 email per interval.
export default function HourlyLimitPicker({ value, onChange, recipients = 0, accounts = 1 }) {
  const n = hourlyValue(value);
  const ok = hourlyValid(value);
  const box = 'rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

  return (
    <div>
      <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-blue-700"><Clock size={15} /> Hourly sending limit <span className="normal-case tracking-normal text-gray-400">(per account)</span></p>
      <div className="flex flex-wrap gap-3">
        <select className={`${box} min-w-[200px]`} value={value.mode} onChange={(e) => onChange({ ...value, mode: e.target.value })}>
          {HOURLY_PRESETS.map((p) => <option key={p} value={String(p)}>{p} emails/hour per account</option>)}
          <option value="custom">Custom</option>
        </select>
        {value.mode === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="number" min={MIN_HOURLY} max={MAX_HOURLY} step={1} inputMode="numeric" className={`${box} w-32`}
              value={value.custom} onChange={(e) => onChange({ ...value, custom: e.target.value })} placeholder="e.g. 25" autoFocus />
            <span className="text-sm text-gray-500">emails/hour per account</span>
          </div>
        )}
      </div>
      {ok ? (
        <div className="mt-2 rounded-xl border border-sky-100 bg-sky-50/60 px-4 py-2.5 text-sm text-gray-700">
          {accounts > 1 ? 'Each selected account sends' : 'Sends'} <b className="text-blue-700">1 email every {intervalLabel(n)}</b>, one at a time ({n}/hour{accounts > 1 ? ' per account' : ''}).
          {accounts > 1 && <span> With {accounts} accounts: <b className="text-blue-700">{n * accounts} emails/hour</b> in total.</span>}
          {recipients > 1 && <span className="text-gray-500"> {recipients} recipients take {durationLabel(recipients, n * Math.max(accounts, 1))}.</span>}
        </div>
      ) : (
        value.mode === 'custom' && <p className="mt-2 text-xs text-red-600">Enter a whole number from {MIN_HOURLY} to {MAX_HOURLY}.</p>
      )}
    </div>
  );
}