import { useEffect, useRef, useState } from 'react';
import { Calendar, Eye, Loader2, Mail, Send, Sparkles, Target, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { campaignsApi } from '../api/campaigns.api.js';
import AccountPicker from './AccountPicker.jsx';
import RecipientsInput from './RecipientsInput.jsx';
import RichEditor from './RichEditor.jsx';
import PreviewModal, { cleanHtml } from './PreviewModal.jsx';

const isEmpty = (html) => !html.replace(/<[^>]*>|&nbsp;/g, '').trim() && !/<img/i.test(html);
const label = 'mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-blue-700';
const field = 'w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

export default function NewCampaignTab({ onCreated }) {
  const [kind, setKind] = useState('immediate');
  const [name, setName] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [accountIds, setAccountIds] = useState([]);
  const [subjectsText, setSubjectsText] = useState('');
  const [emails, setEmails] = useState([]);
  const [html, setHtml] = useState('');
  const [when, setWhen] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const editor = useRef(null);

  useEffect(() => {
    campaignsApi.accounts().then((r) => setAccounts(r.accounts.filter((a) => a.status === 'ACTIVE'))).catch((e) => toast.error(e.message));
  }, []);

  const subjects = subjectsText.split('\n').map((s) => s.trim()).filter(Boolean);
  const sender = accounts.find((a) => a.id === accountIds[0]);

  const submit = async () => {
    if (!name.trim()) return toast.error('Enter a campaign name');
    if (!accountIds.length) return toast.error('Select at least one From email');
    if (!subjects.length) return toast.error('Add at least one subject line');
    if (isEmpty(html)) return toast.error('Write your email message');
    if (!emails.length) return toast.error('Add at least one recipient');
    if (kind === 'scheduled' && (!when || new Date(when) <= new Date())) return toast.error('Pick a future date and time');
    if (!window.confirm(kind === 'scheduled' ? `Schedule this campaign for ${emails.length} recipients?` : `Send this campaign to ${emails.length} recipients now?`)) return;

    setBusy(true);
    try {
      const r = await campaignsApi.create({
        name, accountIds, subjects, recipients: emails, bodyHtml: cleanHtml(html),
        ...(kind === 'scheduled' ? { scheduledAt: new Date(when).toISOString() } : {}),
      });
      toast.success(kind === 'scheduled' ? 'Campaign scheduled' : `Campaign started for ${r.recipients} recipients`);
      onCreated();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const tab = (id, Icon, text) => (
    <button onClick={() => setKind(id)} className={`flex items-center gap-2 rounded-xl border px-5 py-3 text-sm font-semibold transition ${kind === id ? 'border-transparent bg-gradient-to-r from-blue-600 to-sky-500 text-white shadow' : 'bg-white text-blue-700 hover:bg-sky-50'}`}>
      <Icon size={16} /> {text}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-blue-600 text-white shadow"><Sparkles size={26} /></span>
        <div><h2 className="text-3xl font-bold text-blue-700">Create Campaign</h2><p className="text-sm text-sky-700">Send immediate or scheduled email campaigns (continuous sending)</p></div>
      </div>
      <div className="flex flex-wrap gap-3">{tab('immediate', Zap, 'Immediate Campaign')}{tab('scheduled', Calendar, 'Scheduled Campaign')}</div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="space-y-5 rounded-2xl border bg-white p-6 shadow-sm">
            <div>
              <p className={label}><Target size={15} /> Campaign name</p>
              <input className={field} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="Association Name Outreach" />
            </div>
            <div>
              <p className={label}><Mail size={15} /> From email accounts</p>
              <AccountPicker accounts={accounts} value={accountIds} onChange={setAccountIds} />
              {accountIds.length > 1 && <p className="mt-2 text-xs text-gray-500">Emails are shared across the {accountIds.length} accounts in rotation.</p>}
            </div>
            <div>
              <p className={label}>Subject lines (one per line)</p>
              <textarea className={`${field} h-28 resize-y`} value={subjectsText} onChange={(e) => setSubjectsText(e.target.value)}
                placeholder={'Enter multiple subject lines…\nOne per line\nRandom selection'} />
              <div className="mt-2 rounded-xl border border-sky-100 bg-sky-50/60 px-4 py-2.5 text-sm"><b>Total Subject Lines:</b> <span className="ml-1 text-lg font-semibold text-blue-600">{subjects.length}</span></div>
            </div>
            {kind === 'scheduled' && (
              <div>
                <p className={label}><Calendar size={15} /> Send at</p>
                <input type="datetime-local" className={field} value={when} onChange={(e) => setWhen(e.target.value)} />
              </div>
            )}
          </div>

          <RichEditor editorRef={editor} onChange={setHtml}
            footer={<>
              <span>Sender: {sender ? <b className="text-blue-600">{sender.displayName || sender.email}</b> : <b className="text-blue-600">Not Set</b>}{accountIds.length > 1 && <span className="text-gray-400"> +{accountIds.length - 1} more</span>}</span>
              <button type="button" onClick={() => (isEmpty(html) ? toast.error('Write your message first') : setPreview(true))}
                className="flex items-center gap-2 rounded-lg border px-4 py-2 font-semibold text-blue-700 hover:bg-sky-50"><Eye size={16} /> Show Preview</button>
            </>} />
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border bg-white p-6 shadow-sm"><RecipientsInput value={emails} onChange={setEmails} /></div>
          <button onClick={submit} disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 py-4 text-base font-semibold text-white shadow hover:opacity-95 disabled:opacity-60">
            {busy ? <Loader2 size={18} className="animate-spin" /> : kind === 'scheduled' ? <Calendar size={18} /> : <Send size={18} />}
            {kind === 'scheduled' ? 'Schedule Campaign' : 'Send Campaign Now'}
          </button>
        </div>
      </div>
      {preview && <PreviewModal html={html} subject={subjects[0]} onClose={() => setPreview(false)} />}
    </div>
  );
}
