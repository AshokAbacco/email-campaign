import { useEffect, useState } from 'react';
import { Mail, Zap } from 'lucide-react';
import { campaignsApi } from '../api/campaigns.api.js';

export default function QuotaCard({ refreshKey }) {
  const [q, setQ] = useState(null);

  useEffect(() => {
    const load = () => campaignsApi.quota().then(setQ).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [refreshKey]);

  const pct = q ? Math.min(100, (q.sent / q.limit) * 100) : 0;
  return (
    <div className="w-full max-w-xs rounded-2xl border bg-white/80 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-blue-700"><Mail size={15} /> Daily Email Quota</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${q && q.left === 0 ? 'bg-red-50 text-red-600' : 'bg-sky-50 text-sky-600'}`}>
          {q && q.left === 0 ? 'Limit reached' : 'Window open'}
        </span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="font-semibold text-gray-700">{q ? q.sent.toLocaleString() : '–'} / {q ? q.limit.toLocaleString() : '–'} sent</span>
        <span className="flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 font-medium text-sky-700"><Zap size={11} /> {q ? q.left.toLocaleString() : '–'} left</span>
      </div>
    </div>
  );
}
