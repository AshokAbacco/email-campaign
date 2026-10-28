import { useState } from 'react';
import { FileUp, Users, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { extractEmails } from '../utils/emails.js';

// Manual paste or CSV/TXT upload. Reports the final list of valid, unique emails through onChange.
export default function RecipientsInput({ value, onChange }) {
  const [mode, setMode] = useState('manual');
  const [text, setText] = useState('');
  const [file, setFile] = useState({ name: '', emails: [] });

  const switchMode = (m) => {
    setMode(m);
    onChange(m === 'manual' ? extractEmails(text) : file.emails);
  };

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!/\.(csv|txt|tsv)$/i.test(f.name)) return toast.error('Upload a .csv or .txt file (export Excel sheets as CSV first)');
    if (f.size > 5 * 1024 * 1024) return toast.error('File is larger than 5 MB');
    const emails = extractEmails(await f.text());
    if (!emails.length) toast.error('No email addresses found in that file');
    setFile({ name: f.name, emails });
    onChange(emails);
  };

  const radio = (id, label) => (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input type="radio" checked={mode === id} onChange={() => switchMode(id)} className="h-4 w-4 accent-blue-600" /> {label}
    </label>
  );

  return (
    <div>
      <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-blue-700"><Users size={15} /> Client mails</p>
      <div className="mb-3 flex gap-5">{radio('manual', 'Manual Entry')}{radio('upload', 'Upload CSV')}</div>

      {mode === 'manual' ? (
        <>
          <p className="mb-1.5 text-sm font-medium text-blue-700">Paste emails (comma or new line separated)</p>
          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); onChange(extractEmails(e.target.value)); }}
            placeholder={'client1@gmail.com\nclient2@gmail.com, client3@gmail.com'}
            className="h-40 w-full resize-y rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </>
      ) : (
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500 hover:border-blue-400">
          <FileUp size={26} className="text-blue-500" />
          {file.name ? <span className="font-medium text-gray-800">{file.name}</span> : 'Click to choose a .csv or .txt file'}
          <span className="text-xs text-gray-400">Every email address in the file is picked up automatically</span>
          <input type="file" accept=".csv,.txt,.tsv" onChange={onFile} className="hidden" />
        </label>
      )}
      {mode === 'upload' && file.name && (
        <button type="button" onClick={() => { setFile({ name: '', emails: [] }); onChange([]); }} className="mt-2 flex items-center gap-1 text-xs text-red-600 hover:underline"><X size={12} /> Remove file</button>
      )}

      <div className="mt-4 rounded-xl border border-sky-100 bg-sky-50/60 px-4 py-3 text-sm">
        <span className="font-semibold">Total Emails:</span> <span className="ml-1 text-lg font-semibold text-blue-600">{value.length}</span>
      </div>
    </div>
  );
}
