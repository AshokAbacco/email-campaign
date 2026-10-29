// client/src/pages/campaigns/components/DashboardTab.jsx
import { Fragment, useCallback, useEffect, useState } from 'react';
import { Award, Calendar, ChevronDown, Mail, RefreshCw, Search, Send, Target, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { campaignsApi } from '../api/campaigns.api.js';
import { formatDate } from '../../../utils/format.js';
import { intervalLabel } from '../utils/sendingRate.js';
import RecipientsModal from './RecipientsModal.jsx';

const STATUS = {
  COMPLETED: ['Completed', 'bg-sky-50 text-sky-700 border-sky-200'],
  SENDING: ['Sending', 'bg-amber-50 text-amber-700 border-amber-200'],
  SCHEDULED: ['Scheduled', 'bg-violet-50 text-violet-700 border-violet-200'],
};

function bounds(range, date) {
  if (date) {
    const from = new Date(`${date}T00:00:00`);
    const to = new Date(from);
    to.setDate(to.getDate() + 1);
    return { from: from.toISOString(), to: to.toISOString() };
  }
  const days = { today: 0, week: 7, month: 30 }[range];
  if (days === undefined) return {};
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return { from: d.toISOString() };
}

const StatCard = ({ icon: Icon, label, value }) => (
  <div className="rounded-2xl border bg-white p-6 shadow-sm">
    <span className="grid h-12 w-12 place-items-center rounded-xl bg-sky-50 text-blue-600"><Icon size={22} /></span>
    <p className="mt-5 font-semibold text-sky-700">{label}</p>
    <p className="mt-1 text-3xl font-bold">{value}</p>
  </div>
);

export default function DashboardTab({ refreshKey }) {
  const [range, setRange] = useState('all');
  const [date, setDate] = useState('');
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  const [data, setData] = useState({ items: [], stats: { campaigns: 0, followUps: 0, recipients: 0, followUpEmails: 0 } });
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(null);
  const [viewing, setViewing] = useState(null);

  useEffect(() => { const t = setTimeout(() => setDq(q), 300); return () => clearTimeout(t); }, [q]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      setData(await campaignsApi.list({ ...bounds(range, date), q: dq }));
    } catch (e) {
      if (!silent) toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [range, date, dq]);

  useEffect(() => { load(); }, [load, refreshKey]);

  // live progress while anything is sending or scheduled
  const live = data.items.some((c) => c.status !== 'COMPLETED');
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => load(true), 5000);
    return () => clearInterval(t);
  }, [live, load]);

  const remove = async (c) => {
    if (!window.confirm(`Delete "${c.name}"${c.status === 'SENDING' ? ' (sending will stop)' : ''}? Its follow-ups are deleted too.`)) return;
    try {
      await campaignsApi.remove(c.id);
      toast.success('Campaign deleted');
      load();
    } catch (e) { toast.error(e.message); }
  };

  const { stats } = data;
  const chip = (id, label) => (
    <button onClick={() => { setRange(id); setDate(''); }}
      className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${range === id && !date ? 'border-blue-600 bg-blue-600 text-white shadow' : 'bg-white text-sky-700 hover:bg-sky-50'}`}>{label}</button>
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Send} label="Total Campaigns" value={stats.campaigns} />
        <StatCard icon={Users} label="Total Recipients" value={stats.recipients} />
        <StatCard icon={Target} label="Follow-up Campaigns" value={stats.followUps} />
        <StatCard icon={Award} label="Follow-up Emails" value={stats.followUpEmails} />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-white p-4 shadow-sm">
        {chip('all', 'All')}{chip('today', 'Today')}{chip('week', 'Week')}{chip('month', 'Month')}
        <label className="flex items-center gap-2 rounded-xl border bg-white px-3 py-1.5 text-sm text-gray-600">
          <Calendar size={16} className="text-sky-600" />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-transparent outline-none" />
        </label>
        <div className="ml-auto flex w-full items-center gap-2 sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search size={16} className="absolute left-3 top-3 text-sky-500" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search campaigns…"
              className="w-full rounded-xl border-2 border-sky-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500" />
          </div>
          <button onClick={() => load()} title="Refresh" className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white hover:bg-blue-700"><RefreshCw size={17} className={loading ? 'animate-spin' : ''} /></button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-sky-100 text-left text-xs font-semibold uppercase tracking-wide text-sky-700">
              <th className="px-6 py-4">Campaign</th><th className="px-3 py-4">Type</th><th className="px-3 py-4">Recipients</th><th className="px-3 py-4">Date</th><th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {!loading && data.items.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-16 text-center text-gray-400">No campaigns found. Create one from the Campaign tab.</td></tr>
            )}
            {data.items.map((c) => {
              const [label, cls] = STATUS[c.status];
              const { total, sent, failed } = c.counts;
              return (
                <Fragment key={c.id}>
                  <tr className="hover:bg-gray-50/60">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-sky-100 bg-sky-50 text-sky-600"><Mail size={18} /></span>
                        <span className="font-semibold">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${cls}`}>
                        {c.status === 'SENDING' ? `Sending ${sent + failed}/${total}` : label}
                      </span>
                    </td>
                    <td className="px-3 py-4">
                      <span className="font-semibold">{total}</span> <span className="text-gray-500">recipients</span>
                      {failed > 0 && <span className="ml-2 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700">{failed} failed / bounced</span>}
                      <button onClick={() => setViewing(c)} className="ml-3 text-xs font-medium text-blue-600 hover:underline">View</button>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-gray-700">{formatDate(c.scheduledAt && c.status === 'SCHEDULED' ? c.scheduledAt : c.createdAt, true)}</td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setOpen(open === c.id ? null : c.id)} className="flex items-center gap-1 rounded-lg bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-100">
                          <ChevronDown size={14} className={open === c.id ? 'rotate-180' : ''} /> Details</button>
                        <button onClick={() => remove(c)} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700">Delete</button>
                      </div>
                    </td>
                  </tr>
                  {open === c.id && (
                    <tr className="bg-sky-50/40">
                      <td colSpan={5} className="px-6 py-4 text-sm">
                        <div className="grid gap-4 sm:grid-cols-3">
                          <div><p className="mb-1 text-xs font-semibold uppercase text-sky-700">From accounts</p>{c.accounts.map((a) => <p key={a} className="truncate">{a}</p>)}</div>
                          <div><p className="mb-1 text-xs font-semibold uppercase text-sky-700">Subject lines</p>{c.subjects.slice(0, 5).map((s) => <p key={s} className="truncate">{s}</p>)}{c.subjects.length > 5 && <p className="text-gray-400">+{c.subjects.length - 5} more</p>}
                            {c.pitchName && <><p className="mb-1 mt-3 text-xs font-semibold uppercase text-sky-700">Pitch</p><p className="truncate">{c.pitchName}</p></>}</div>
                          <div><p className="mb-1 text-xs font-semibold uppercase text-sky-700">Progress</p><p>Sent: <b>{sent}</b></p><p>Failed: <b>{failed}</b></p><p>Pending: <b>{c.counts.pending}</b></p>
                            {c.hourlyLimit && <div className="mt-1"><p className="text-xs font-semibold uppercase text-sky-700">Hourly limits</p>{c.accountLimits.map((l) => <p key={l.email} className="truncate"><b>{l.hourlyLimit}/hr</b> <span className="text-gray-500">· 1 every {intervalLabel(l.hourlyLimit)} · {l.email}</span></p>)}</div>}
                            {c.followUpStep > 0 && <p className="mt-1 text-xs text-violet-600">Follow-up #{c.followUpStep}</p>}</div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {viewing && <RecipientsModal campaign={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}