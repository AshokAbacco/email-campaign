// client/src/pages/pitches/components/PitchFormModal.jsx
import { useEffect, useRef, useState } from 'react';
import { Eye, FileText, Layers, Loader2, Save, X } from 'lucide-react';
import { PITCH_TYPES } from '../api/pitches.api.js';
import toast from 'react-hot-toast';
import { pitchesApi } from '../api/pitches.api.js';
import RichEditor from '../../campaigns/components/RichEditor.jsx';
import PreviewModal, { cleanHtml } from '../../campaigns/components/PreviewModal.jsx';
import { toEmailHtml } from '../../../utils/emailHtml.js';

const isEmpty = (html) => !html.replace(/<[^>]*>|&nbsp;/g, '').trim() && !/<img/i.test(html);
const label = 'mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-blue-700';
const field = 'w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

// Create (pitch = null) or edit an existing pitch
export default function PitchFormModal({ pitch, defaultType = 'FRESH', onSaved, onClose }) {
  const [name, setName] = useState(pitch?.name || '');
  const [type, setType] = useState(pitch?.type || defaultType);
  const [html, setHtml] = useState(pitch?.bodyHtml || '');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const editor = useRef(null);

  // the editor is uncontrolled: fill it once with the saved content
  useEffect(() => {
    if (editor.current) editor.current.innerHTML = pitch?.bodyHtml || '';
  }, []); // eslint-disable-line

  const save = async () => {
    if (!name.trim()) return toast.error('Enter a pitch name');
    if (isEmpty(html)) return toast.error('Write the pitch email content');
    setBusy(true);
    try {
      const body = { name: name.trim(), type, bodyHtml: cleanHtml(toEmailHtml(editor.current)) };
      const r = pitch ? await pitchesApi.update(pitch.id, body) : await pitchesApi.create(body);
      toast.success(pitch ? 'Pitch updated' : 'Pitch created');
      onSaved(r.pitch);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="flex max-h-[94vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h3 className="text-lg font-semibold text-blue-700">{pitch ? 'Edit Pitch' : 'New Pitch'}</h3>
          <button onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div className="scroll-thin min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div>
            <p className={label}><FileText size={15} /> Pitch name</p>
            <input className={field} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="Association Partnership Intro" autoFocus />
            <p className="mt-1 text-xs text-gray-400">Only you see this name. It helps you find the pitch when creating campaigns.</p>
          </div>
          <div>
            <p className={label}><Layers size={15} /> Pitch type</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {PITCH_TYPES.map((t) => {
                const on = type === t.id;
                return (
                  <button key={t.id} type="button" onClick={() => setType(t.id)}
                    className={`flex items-start gap-3 rounded-xl border-2 px-4 py-3 text-left transition ${on ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-sky-300 hover:bg-sky-50/50'}`}>
                    <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${on ? 'border-blue-600' : 'border-gray-300'}`}>
                      {on && <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />}
                    </span>
                    <span>
                      <span className={`flex items-center gap-1.5 text-sm font-semibold ${on ? 'text-blue-700' : 'text-gray-800'}`}><t.icon size={15} /> {t.label}</span>
                      <span className="block text-xs text-gray-500">{t.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <RichEditor editorRef={editor} onChange={setHtml} minHeight={240} />
        </div>

        <div className="flex items-center justify-between gap-2 border-t px-6 py-3">
          <button type="button" onClick={() => (isEmpty(html) ? toast.error('Write the content first') : setPreview(toEmailHtml(editor.current)))}
            className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-sky-50"><Eye size={16} /> Preview</button>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">Cancel</button>
            <button onClick={save} disabled={busy}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-sky-600 to-blue-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {pitch ? 'Save Changes' : 'Create Pitch'}
            </button>
          </div>
        </div>
      </div>
      {preview && <PreviewModal html={preview} subject={name || 'Pitch preview'} onClose={() => setPreview(false)} />}
    </div>
  );
}