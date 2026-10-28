import { useEffect, useRef, useState } from 'react';
import { Eye, Loader2, Mail, Target, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { campaignsApi } from '../api/campaigns.api.js';
import { formatDate } from '../../../utils/format.js';
import RichEditor from './RichEditor.jsx';
import PreviewModal, { cleanHtml } from './PreviewModal.jsx';

const ORD = ['1st', '2nd', '3rd', '4th'];
const isEmpty = (html) => !html.replace(/<[^>]*>|&nbsp;/g, '').trim();

const Box = ({ icon: Icon, title, children }) => (
  <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-4">
    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase text-sky-700">{Icon && <Icon size={13} />} {title}</p>
    <div className="mt-1 text-2xl font-bold">{children}</div>
  </div>
);

export default function FollowUpTab({ onCreated }) {
  const [step, setStep] = useState(1);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selId, setSelId] = useState('');
  const [html, setHtml] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const editor = useRef(null);

  useEffect(() => {
    setLoading(true);
    setSelId('');
    campaignsApi.eligible(step).then((r) => setItems(r.items)).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  }, [step]);

  const sel = items.find((i) => i.id === selId);

  const create = async () => {
    if (!sel) return toast.error('Select a campaign');
    if (!sel.eligible) return toast.error('Everyone in this campaign has already replied');
    if (isEmpty(html)) return toast.error('Write your follow-up message');
    if (!window.confirm(`Send the ${ORD[step - 1]} follow-up to ${sel.eligible} recipients now?`)) return;
    setBusy(true);
    try {
      const r = await campaignsApi.createFollowUp({ parentId: sel.id, bodyHtml: cleanHtml(html) });
      toast.success(`Follow-up started for ${r.recipients} recipients`);
      onCreated();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const select = 'w-full rounded-xl border-2 border-sky-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500';

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-4xl font-bold text-blue-600">Follow-up Campaign</h2>
        <p className="mt-2 text-sky-700">Create powerful follow-up messages to re-engage your audience</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-lg font-semibold text-sky-700"><Target size={18} /> Select Campaign</p>
              <div className="flex gap-2">
                {ORD.map((o, i) => (
                  <button key={o} onClick={() => setStep(i + 1)}
                    className={`rounded-xl border-2 px-3.5 py-1.5 text-xs font-bold ${step === i + 1 ? 'border-blue-600 bg-blue-600 text-white' : 'border-sky-200 bg-white text-sky-700 hover:bg-sky-50'}`}>{o}</button>
                ))}
              </div>
            </div>
            <select className={select} value={selId} onChange={(e) => setSelId(e.target.value)} disabled={loading}>
              <option value="">{loading ? 'Loading…' : items.length ? '-- Select a campaign --' : '-- No eligible campaigns --'}</option>
              {items.map((i) => <option key={i.id} value={i.id}>{i.name} · {formatDate(i.createdAt)} · {i.eligible} to follow up</option>)}
            </select>
            {step > 1 && <p className="mt-2 text-xs text-gray-500">Only campaigns that already have their {ORD[step - 2]} follow-up sent are listed.</p>}
          </div>

          <div>
            <p className="mb-2 flex items-center gap-2 text-lg font-semibold text-sky-700"><Mail size={18} /> Write your follow-up</p>
            <RichEditor editorRef={editor} onChange={setHtml} minHeight={240}
              footer={<>
                <span className="text-xs text-gray-500">Sent from the same mailbox as the first email, with a “Re:” subject.</span>
                <div className="flex gap-3">
                  <button type="button" onClick={() => (isEmpty(html) ? toast.error('Write your message first') : setPreview(true))}
                    className="flex items-center gap-2 rounded-lg border-2 border-sky-200 px-4 py-2 font-semibold text-sky-700 hover:bg-sky-50"><Eye size={16} /> Preview</button>
                  <button type="button" onClick={create} disabled={busy || !sel}
                    className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-sky-600 to-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-50">
                    {busy ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />} Create Follow-up</button>
                </div>
              </>} />
          </div>
        </div>

        <div className="h-fit space-y-3 rounded-2xl border bg-white p-6 shadow-sm">
          <p className="flex items-center gap-2 text-lg font-semibold text-sky-700"><Target size={18} /> Summary</p>
          <Box title="Campaign"><span className="block truncate text-base">{sel ? sel.name : 'Not selected'}</span></Box>
          <Box icon={Mail} title="From mail accounts">{sel ? sel.accountsCount : 0}</Box>
          <Box title="Subjects">{sel ? sel.subjectsCount : 0}</Box>
          <Box title="Recipients">{sel ? sel.eligible : 0}</Box>
          {sel && sel.replied > 0 && <p className="text-xs text-gray-500">{sel.replied} of {sel.sent} already replied and are skipped.</p>}
        </div>
      </div>
      {preview && <PreviewModal html={html} subject={sel ? `Re: ${sel.name}` : 'Follow-up'} onClose={() => setPreview(false)} />}
    </div>
  );
}
