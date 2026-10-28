import { useRef, useState } from 'react';
import { ChevronLeft, Folder, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { inboxApi as api } from '../api/inbox.api.js';
import { MAX_ACCOUNTS_PER_FOLDER } from '../utils/groups.js';

const PRESETS = {
  gmail: {
    label: 'Gmail', imapHost: 'imap.gmail.com', imapPort: 993, smtpHost: 'smtp.gmail.com', smtpPort: 587,
    hint: 'Gmail requires an App Password if 2FA is enabled.',
  },
  gsuite: {
    label: 'G Suite (Google Workspace)', imapHost: 'imap.gmail.com', imapPort: 993, smtpHost: 'smtp.gmail.com', smtpPort: 587,
    hint: 'Google Workspace requires an App Password if 2-Step Verification is enabled.',
  },
  yahoo: {
    label: 'Yahoo Mail', imapHost: 'imap.mail.yahoo.com', imapPort: 993, smtpHost: 'smtp.mail.yahoo.com', smtpPort: 465,
    hint: 'Yahoo requires an App Password generated from your Yahoo Account Security settings.',
  },
  imap: {
    label: 'Custom IMAP/SMTP', imapHost: '', imapPort: 993, smtpHost: '', smtpPort: 465,
    hint: 'Enter your mail server details. Many providers require an app password.',
  },
};
const OAUTH_LABEL = { gmail: 'Google OAuth', gsuite: 'Google OAuth', yahoo: 'Yahoo OAuth' };

const initial = (p) => ({
  email: '', displayName: '', password: '', imapUser: '', smtpUser: '',
  imapHost: PRESETS[p].imapHost, imapPort: PRESETS[p].imapPort,
  smtpHost: PRESETS[p].smtpHost, smtpPort: PRESETS[p].smtpPort,
  imapSec: 'ssl', smtpSec: PRESETS[p].smtpPort === 465 ? 'ssl' : 'starttls',
});

export default function AddAccountModal({ folder, accounts = [], onBack, onClose, onConnected }) {
  const [provider, setProvider] = useState('gmail');
  const [auth, setAuth] = useState('password'); // 'password' | 'oauth'
  const [f, setF] = useState(initial('gmail'));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const touched = useRef({ imapUser: false, smtpUser: false });

  const preset = PRESETS[provider];
  const custom = provider === 'imap';
  const used = accounts.filter((a) => a.accountFolderId === folder.id).length;
  const full = used >= MAX_ACCOUNTS_PER_FOLDER;
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const pickProvider = (p) => {
    setProvider(p);
    setAuth('password');
    setErrors({});
    setError('');
    setF((s) => ({
      ...initial(p),
      email: s.email, displayName: s.displayName, password: s.password, imapUser: s.imapUser, smtpUser: s.smtpUser,
    }));
  };

  const onEmail = (v) =>
    setF((s) => ({
      ...s,
      email: v,
      imapUser: touched.current.imapUser ? s.imapUser : v,
      smtpUser: touched.current.smtpUser ? s.smtpUser : v,
    }));

  const imapSecure = custom ? f.imapSec === 'ssl' : Number(f.imapPort) === 993;
  const smtpSecure = custom ? f.smtpSec === 'ssl' : Number(f.smtpPort) === 465;

  const oauth = async () => {
    if (full) { setError(`This folder is full (${MAX_ACCOUNTS_PER_FOLDER} accounts)`); return; }
    setBusy(true);
    setError('');
    try {
      window.location.href = (await api.oauthUrl(provider, folder.id)).url;
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  const validate = () => {
    const e = {};
    if (!/^\S+@\S+\.\S+$/.test(f.email)) e.email = 'Enter a valid email address';
    if (!f.imapHost.trim()) e.imapHost = 'Required';
    if (!f.smtpHost.trim()) e.smtpHost = 'Required';
    for (const k of ['imapPort', 'smtpPort']) if (!(Number(f[k]) > 0 && Number(f[k]) < 65536)) e[k] = 'Invalid port';
    if (!f.imapUser.trim()) e.imapUser = 'Required';
    if (f.smtpUser.trim() && f.smtpUser.trim() !== f.imapUser.trim()) e.smtpUser = 'Must match the IMAP username (one login is used for both)';
    if (!f.password) e.password = 'Required';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    if (full) { setError(`This folder is full (${MAX_ACCOUNTS_PER_FOLDER} accounts)`); return; }
    setBusy(true);
    setError('');
    try {
      await api.connectImap({
        provider: custom ? 'IMAP' : provider.toUpperCase(), // GMAIL | GSUITE | YAHOO | IMAP
        accountFolderId: folder.id,
        displayName: f.displayName.trim() || f.email,
        email: f.email.trim(),
        username: f.imapUser.trim(),
        password: f.password,
        imapHost: f.imapHost.trim(), imapPort: Number(f.imapPort), imapSecure,
        smtpHost: f.smtpHost.trim(), smtpPort: Number(f.smtpPort), smtpSecure,
      });
      toast.success(`Account added to "${folder.name}". Syncing your mail…`);
      onConnected();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const label = 'mb-1 block text-sm font-medium text-gray-700';
  const box = (k) =>
    `w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100 ${errors[k] ? 'border-red-400' : 'border-gray-300 focus:border-blue-500'}`;
  const err = (k) => errors[k] && <span className="text-xs text-red-500">{errors[k]}</span>;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center gap-2 border-b px-5 py-4">
          <button onClick={onBack} aria-label="Back to folders"><ChevronLeft size={18} /></button>
          <h3 className="font-semibold">Add Mail Account</h3>
          <button onClick={onClose} className="ml-auto" aria-label="Close"><X size={18} /></button>
        </div>

        <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="space-y-4 overflow-y-auto p-5">
            <div className="flex items-center gap-2 rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-800">
              <Folder size={16} /> Adding to folder: <b>{folder.name}</b>
              <span className={`ml-auto text-xs ${full ? 'text-red-600' : 'text-teal-700'}`}>{used}/{MAX_ACCOUNTS_PER_FOLDER} used</span>
            </div>

            {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

            <div>
              <label className={label}>Provider</label>
              <select className={box('')} value={provider} onChange={(e) => pickProvider(e.target.value)}>
                {Object.entries(PRESETS).map(([id, p]) => <option key={id} value={id}>{p.label}</option>)}
              </select>
            </div>

            <div>
              <label className={label}>Authentication</label>
              <select className={box('')} value={auth} onChange={(e) => setAuth(e.target.value)} disabled={custom}>
                <option value="password">App Password</option>
                {OAUTH_LABEL[provider] && <option value="oauth">{OAUTH_LABEL[provider]}</option>}
              </select>
            </div>

            {auth === 'oauth' ? (
              <div className="rounded-xl border bg-gray-50 p-5 text-center text-sm text-gray-600">
                <p className="mb-3">
                  You'll be redirected to {provider === 'yahoo' ? 'Yahoo' : 'Google'} to grant access. No password is stored.
                </p>
                <button
                  type="button"
                  onClick={oauth}
                  disabled={busy || full}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {busy && <Loader2 size={15} className="animate-spin" />} Continue with {provider === 'yahoo' ? 'Yahoo' : 'Google'}
                </button>
              </div>
            ) : (
              <>
                <div>
                  <label className={label}>Email Address</label>
                  <input type="email" className={box('email')} value={f.email} onChange={(e) => onEmail(e.target.value)} />
                  {err('email')}
                </div>

                <div>
                  <label className={label}>Sender Name</label>
                  <input className={box('displayName')} placeholder="Sender Name" value={f.displayName} onChange={(e) => set('displayName', e.target.value)} />
                  <p className="mt-1 text-xs text-gray-400">This name will appear in email templates and signatures</p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className={label}>IMAP Host</label>
                    <input className={box('imapHost')} placeholder="imap.example.com" value={f.imapHost} onChange={(e) => set('imapHost', e.target.value)} />
                    {err('imapHost')}
                  </div>
                  <div>
                    <label className={label}>IMAP Port</label>
                    <input type="number" className={box('imapPort')} value={f.imapPort} onChange={(e) => set('imapPort', e.target.value)} />
                    {err('imapPort')}
                  </div>
                </div>
                {custom && (
                  <div>
                    <label className={label}>IMAP Security</label>
                    <select
                      className={box('')}
                      value={f.imapSec}
                      onChange={(e) => setF({ ...f, imapSec: e.target.value, imapPort: e.target.value === 'ssl' ? 993 : 143 })}
                    >
                      <option value="ssl">SSL/TLS</option>
                      <option value="starttls">STARTTLS</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className={label}>IMAP Username</label>
                  <input
                    className={box('imapUser')}
                    value={f.imapUser}
                    onChange={(e) => { touched.current.imapUser = true; set('imapUser', e.target.value); }}
                  />
                  {err('imapUser')}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className={label}>SMTP Host</label>
                    <input className={box('smtpHost')} placeholder="smtp.example.com" value={f.smtpHost} onChange={(e) => set('smtpHost', e.target.value)} />
                    {err('smtpHost')}
                  </div>
                  <div>
                    <label className={label}>SMTP Port</label>
                    <input type="number" className={box('smtpPort')} value={f.smtpPort} onChange={(e) => set('smtpPort', e.target.value)} />
                    {err('smtpPort')}
                  </div>
                </div>
                {custom && (
                  <div>
                    <label className={label}>SMTP Security</label>
                    <select
                      className={box('')}
                      value={f.smtpSec}
                      onChange={(e) => setF({ ...f, smtpSec: e.target.value, smtpPort: e.target.value === 'ssl' ? 465 : 587 })}
                    >
                      <option value="ssl">SSL/TLS</option>
                      <option value="starttls">STARTTLS</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className={label}>SMTP Username</label>
                  <input
                    className={box('smtpUser')}
                    value={f.smtpUser}
                    onChange={(e) => { touched.current.smtpUser = true; set('smtpUser', e.target.value); }}
                  />
                  {err('smtpUser')}
                </div>

                <div>
                  <label className={label}>App Password</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    className={box('password')}
                    value={f.password}
                    onChange={(e) => set('password', e.target.value)}
                  />
                  {err('password')}
                  <p className="mt-1 text-xs text-gray-400">{preset.hint}</p>
                </div>
              </>
            )}
          </div>

          {auth === 'password' && (
            <div className="flex justify-end gap-2 border-t px-5 py-3">
              <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">Cancel</button>
              <button
                disabled={busy || full}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {busy && <Loader2 size={15} className="animate-spin" />} {busy ? 'Connecting…' : 'Add Account'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}