import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { campaignsApi } from '../api/campaigns.api.js';

const BADGE = { SENT: 'bg-emerald-50 text-emerald-700', FAILED: 'bg-red-50 text-red-600', PENDING: 'bg-gray-100 text-gray-600' };

export default function RecipientsModal({ campaign, onClose }) {
  const [data, setData] = useState({ items: [], total: 0, page: 0, pages: 1 });
  const [loading, setLoading] = useState(true);

  const load = async (page) => {
    setLoading(true);
    try {
      const r = await campaignsApi.recipients(campaign.id, page);
      setData((d) => ({ ...r, items: page === 1 ? r.items : [...d.items, ...r.items] }));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(1); }, []); // eslint-disable-line

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="min-w-0"><h3 className="truncate font-semibold">{campaign.name}</h3><p className="text-xs text-gray-500">{data.total} recipients</p></div>
          <button onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr><th className="px-5 py-2">Email</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Note</th></tr>
            </thead>
            <tbody className="divide-y">
              {data.items.map((r) => (
                <tr key={r.id}>
                  <td className="px-5 py-2">{r.email}</td>
                  <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE[r.status]}`}>{r.status.toLowerCase()}</span></td>
                  <td className="max-w-[200px] truncate px-3 py-2 text-xs text-gray-400" title={r.error || ''}>{r.error || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && <div className="flex justify-center p-4"><Loader2 className="animate-spin text-gray-400" /></div>}
          {!loading && data.page < data.pages && (
            <div className="p-4 text-center"><button onClick={() => load(data.page + 1)} className="rounded-lg border px-4 py-1.5 text-sm hover:bg-gray-50">Load more</button></div>
          )}
        </div>
      </div>
    </div>
  );
}
