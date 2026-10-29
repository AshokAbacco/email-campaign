// client/src/pages/campaigns/components/NewCampaignTab.jsx
import { useEffect, useRef, useState } from 'react';
import { Calendar, Eye, Loader2, Mail, Presentation, RotateCcw, Send, Sparkles, Target, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { campaignsApi } from '../api/campaigns.api.js';
import AccountPicker from './AccountPicker.jsx';
import RecipientsInput from './RecipientsInput.jsx';
import RichEditor from './RichEditor.jsx';
import PreviewModal, { cleanHtml } from './PreviewModal.jsx';
import PitchPicker from '../../pitches/components/PitchPicker.jsx';
import { DEFAULT_HOURLY, durationLabel, limitValid, limitValue } from '../utils/sendingRate.js';
import { toEmailHtml } from '../../../utils/emailHtml.js';

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
  const [pitch, setPitch] = useState(null);        // selected pitch
  const [pitchBase, setPitchBase] = useState('');  // editor HTML right after the pitch was loaded
  const [signature, setSignature] = useState('');
  const [folders, setFolders] = useState([]);
  const [limits, setLimits] = useState({}); // hourly limit per account: { [id]: { mode, custom } }
  const [usage, setUsage] = useState({ usage: {}, defaults: DEFAULT_HOURLY });
  const editor = useRef(null);

  useEffect(() => {
    campaignsApi.accounts().then((r) => setAccounts(r.accounts.filter((a) => a.status === 'ACTIVE'))).catch((e) => toast.error(e.message));
    campaignsApi.folders().then((r) => setFolders(r.accountFolders || [])).catch(() => {});
    campaignsApi.accountUsage().then(setUsage).catch(() => {});
  }, []);

  const subjects = subjectsText.split('\n').map((s) => s.trim()).filter(Boolean);
  const sender = accounts.find((a) => a.id === accountIds[0]);

  // "Regards, <Sender Name> – <title>" is added under every email by the server; show it here too
  useEffect(() => {
    if (!accountIds[0]) return setSignature('');
    campaignsApi.signature(accountIds[0]).then((r) => setSignature(cleanHtml(r.signatureHtml))).catch(() => setSignature(''));
  }, [accountIds[0]]); // eslint-disable-line
  const edited = pitch && html !== pitchBase;

  // load the selected pitch into the Email Content Editor
  const fillEditor = (p) => {
    const el = editor.current;
    el.innerHTML = p.bodyHtml;
    setHtml(el.innerHTML);
    setPitchBase(el.innerHTML);
  };

  const choosePitch = (p) => {
    if (!p) return setPitch(null); // keep whatever is in the editor
    if (!isEmpty(html) && html !== pitchBase && !window.confirm(`Replace the current email content with the pitch "${p.name}"?`)) return;
    fillEditor(p);
    setPitch(p);
  };

  const submit = async () => {
    if (!name.trim()) return toast.error('Enter a campaign name');
    if (!accountIds.length) return toast.error('Select at least one From email');
    if (!subjects.length) return toast.error('Add at least one subject line');
    if (isEmpty(html)) return toast.error('Write your email message');
    if (!emails.length) return toast.error('Add at least one recipient');
    const chosen = accounts.filter((a) => accountIds.includes(a.id));
    const perHour = (a) => limitValue(limits[a.id], a.provider, usage.defaults);
    const bad = chosen.find((a) => !limitValid(perHour(a)));
    if (bad) return toast.error(`Enter a valid hourly limit for ${bad.email}`);
    const capacity = chosen.reduce((s, a) => s + perHour(a), 0);
    if (kind === 'scheduled' && (!when || new Date(when) <= new Date())) return toast.error('Pick a future date and time');
    const speed = `\n\n${chosen.map((a) => `• ${a.email}: ${perHour(a)}/hr`).join('\n')}\nTotal ~${capacity}/hr · ${durationLabel(emails.length, capacity)}`;
    if (!window.confirm((kind === 'scheduled' ? `Schedule this campaign for ${emails.length} recipients?` : `Start this campaign for ${emails.length} recipients?`) + speed)) return;

    setBusy(true);
    try {
      const r = await campaignsApi.create({
        name, accountIds, subjects, recipients: emails, bodyHtml: cleanHtml(toEmailHtml(editor.current)), ...(pitch ? { pitchId: pitch.id } : {}),
        accountLimits: Object.fromEntries(chosen.map((a) => [a.id, perHour(a)])),
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
              <AccountPicker accounts={accounts} folders={folders} value={accountIds} onChange={setAccountIds}
                limits={limits} onLimitsChange={setLimits} usage={usage.usage} defaults={usage.defaults} recipients={emails.length} />
              {accountIds.length > 1 && <p className="mt-2 text-xs text-gray-500">Emails are shared across the {accountIds.length} accounts in rotation; each account sends at its own hourly limit, one email at a time.</p>}
            </div>
            <div>
              <p className={label}>Subject lines (one per line)</p>
              <textarea className={`${field} h-28 resize-y`} value={subjectsText} onChange={(e) => setSubjectsText(e.target.value)}
                placeholder={'Enter multiple subject lines…\nOne per line\nRandom selection'} />
              <div className="mt-2 rounded-xl border border-sky-100 bg-sky-50/60 px-4 py-2.5 text-sm"><b>Total Subject Lines:</b> <span className="ml-1 text-lg font-semibold text-blue-600">{subjects.length}</span></div>
            </div>
            <div>
              <p className={label}><Presentation size={15} /> Fresh Mail Pitch</p>
              {subjects.length || pitch ? (
                <>
                  <PitchPicker type="FRESH" value={pitch?.id} onSelect={choosePitch} collapsible />
                  {pitch && (
                    <div className="mt-2 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-2.5 text-sm">
                      Using <b className="text-blue-700">{pitch.name}</b> <span className="text-gray-500">· loaded into the Email Content Editor below</span>
                    </div>
                  )}
                </>
              ) : (
                <p className="rounded-xl border border-dashed border-sky-200 bg-sky-50/40 px-4 py-3 text-sm text-gray-500">Enter a subject line above to choose from your pitches.</p>
              )}
            </div>
            {kind === 'scheduled' && (
              <div>
                <p className={label}><Calendar size={15} /> Send at</p>
                <input type="datetime-local" className={field} value={when} onChange={(e) => setWhen(e.target.value)} />
              </div>
            )}
          </div>

          <RichEditor editorRef={editor} onChange={setHtml} signature={signature}
            signatureNote={accountIds.length > 1 ? 'each email is signed by its sending account' : ''}
            footer={<>
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>Sender: {sender ? <b className="text-blue-600">{sender.displayName || sender.email}</b> : <b className="text-blue-600">Not Set</b>}{accountIds.length > 1 && <span className="text-gray-400"> +{accountIds.length - 1} more</span>}</span>
                {pitch && (
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Presentation size={13} className="text-sky-600" /> {pitch.name}{edited && <span className="text-amber-600"> (edited)</span>}
                    {edited && <button type="button" onClick={() => fillEditor(pitch)} title="Reset to the pitch content" className="ml-1 flex items-center gap-1 font-medium text-blue-600 hover:underline"><RotateCcw size={12} /> Reset</button>}
                  </span>
                )}
              </span>
              <button type="button" onClick={() => (isEmpty(html) ? toast.error('Write your message first') : setPreview(toEmailHtml(editor.current) + signature))}
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
      {preview && <PreviewModal html={preview} subject={subjects[0]} onClose={() => setPreview(false)} />}
    </div>
  );
}