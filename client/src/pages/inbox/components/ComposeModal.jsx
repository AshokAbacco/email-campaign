// client/src/pages/inbox/components/ComposeModal.jsx
import { useEffect, useRef, useState } from 'react';
import { Loader2, Paperclip, Presentation, Send, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { inboxApi as api } from '../api/inbox.api.js';
import { formatSize } from '../../../utils/format.js';
import PitchPicker from '../../pitches/components/PitchPicker.jsx';
import { cleanHtml } from '../../campaigns/components/PreviewModal.jsx';
import { toEmailHtml } from '../../../utils/emailHtml.js';

const split = (s) => s.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);
const isEmail = (s) => /^\S+@\S+\.\S+$/.test(s);

export default function ComposeModal({ init, onClose }) {
  const [f, setF] = useState({ to: init.to || '', cc: '', subject: init.subject || '' });
  const [busy, setBusy] = useState(false);
  const [pickPitch, setPickPitch] = useState(false);
  const [pitchId, setPitchId] = useState(null);
  const editor = useRef(null);
  const pitchBlock = useRef(null);

  // Put the pitch at the top of the message (above any quoted reply); choosing another pitch replaces it
  const insertPitch = (p) => {
    setPickPitch(false);
    if (!p) return setPitchId(null); // clearing keeps the text already in the message
    const el = editor.current;
    const block = document.createElement('div');
    block.setAttribute('data-pitch', p.id);
    block.innerHTML = cleanHtml(p.bodyHtml);
    const old = pitchBlock.current && el.contains(pitchBlock.current) ? pitchBlock.current : null;
    if (old) old.replaceWith(block);
    else if (el.textContent.trim() || el.querySelector('img')) el.prepend(block);
    else { el.innerHTML = ''; el.appendChild(block); }
    pitchBlock.current = block;
    setPitchId(p.id);
    el.focus();
  };

  // Fill the editor once with the formatted original message, cursor on top
  useEffect(() => {
    const el = editor.current;
    el.innerHTML = init.html || '<p><br></p>';
    el.focus();
    const range = document.createRange();
    range.setStart(el, 0);
    range.collapse(true);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    el.scrollTop = 0;
  }, []); // eslint-disable-line

  const send = async () => {
    const to = split(f.to);
    const cc = split(f.cc);
    if (!to.length) return toast.error('Add at least one recipient');
    const bad = [...to, ...cc].find((x) => !isEmail(x));
    if (bad) return toast.error(`"${bad}" is not a valid email address`);

    const body = editor.current;
    // inserted pitches go out exactly as they look in the editor (bold, spacing)
    body.querySelectorAll('[data-pitch]').forEach((b) => { b.outerHTML = `<div>${toEmailHtml(b)}</div>`; });
    pitchBlock.current = null;
    const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#111">${body.innerHTML}</div>`;
    setBusy(true);
    try {
      await api.send({
        accountId: init.accountId, to, cc, subject: f.subject,
        text: body.innerText, html,
        inReplyToId: init.inReplyToId, forwardOfId: init.forwardOfId,
      });
      toast.success(init.forwardOfId ? 'Message forwarded' : 'Message sent');
      onClose();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const line = 'w-full border-b border-gray-200 px-1 py-2.5 text-sm outline-none focus:border-blue-500';

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h3 className="font-semibold">{init.title}</h3>
          <button onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div className="space-y-1 px-5 pt-3">
          <p className="text-xs text-gray-400">From: {init.fromLabel}</p>
          <input className={line} placeholder="To (comma separated)" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
          <input className={line} placeholder="Cc" value={f.cc} onChange={(e) => setF({ ...f, cc: e.target.value })} />
          <input className={line} placeholder="Subject" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} />
        </div>

        {init.attachments?.length > 0 && (
          <div className="flex flex-wrap gap-2 px-5 pt-3">
            {init.attachments.map((a) => (
              <span key={a.id} className="flex items-center gap-1.5 rounded-lg border bg-gray-50 px-2.5 py-1 text-xs text-gray-600">
                <Paperclip size={12} /> <span className="max-w-[160px] truncate">{a.filename}</span>
                <span className="text-gray-400">{formatSize(a.size)}</span>
              </span>
            ))}
          </div>
        )}

        <div className="px-5 pt-3">
          <button type="button" onClick={() => setPickPitch((v) => !v)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold ${pickPitch ? 'border-blue-200 bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}>
            <Presentation size={14} /> {pitchId ? 'Change pitch' : 'Insert pitch'}
          </button>
          {pickPitch && <div className="mt-2"><PitchPicker value={pitchId} onSelect={insertPitch} maxHeight={200} /></div>}
        </div>

        <div
          ref={editor}
          contentEditable
          suppressContentEditableWarning
          spellCheck
          className="compose-body scroll-thin mx-5 my-3 min-h-[260px] flex-1 overflow-y-auto"
        />

        <div className="flex justify-end gap-2 border-t px-5 py-3">
          <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">Cancel</button>
          <button
            onClick={send}
            disabled={busy}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Send
          </button>
        </div>
      </div>
    </div>
  );
}