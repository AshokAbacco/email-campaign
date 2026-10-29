// client/src/pages/campaigns/components/RichEditor.jsx
import { useRef } from 'react';
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Italic, Link2, List, ListOrdered, Strikethrough, Underline } from 'lucide-react';

const FONTS = ['Calibri', 'Arial', 'Georgia', 'Times New Roman', 'Verdana', 'Courier New'];
const SIZES = [['Small', '2'], ['Normal', '3'], ['Medium', '4'], ['Large', '5'], ['X-Large', '6']];

// signature: read-only HTML shown under the text (added automatically when the email is sent)
export default function RichEditor({ editorRef, onChange, footer, signature, signatureNote, minHeight = 260 }) {
  const saved = useRef(null);

  const remember = () => {
    const s = window.getSelection();
    if (s.rangeCount) saved.current = s.getRangeAt(0);
  };
  const restore = () => {
    if (!saved.current) return;
    const s = window.getSelection();
    s.removeAllRanges();
    s.addRange(saved.current);
  };
  const run = (cmd, val) => {
    editorRef.current.focus();
    restore();
    document.execCommand(cmd, false, val);
    onChange(editorRef.current.innerHTML);
  };

  const Btn = ({ icon: Icon, cmd, title }) => (
    <button type="button" title={title} onMouseDown={(e) => { e.preventDefault(); run(cmd); }}
      className="rounded-md p-2 text-gray-600 hover:bg-gray-100"><Icon size={16} /></button>
  );
  const Sep = () => <span className="mx-1 h-5 w-px bg-gray-200" />;
  const sel = 'rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm';

  const link = () => {
    const url = window.prompt('Link URL (https://…)');
    if (url && /^https?:\/\//i.test(url)) run('createLink', url);
    else if (url) window.alert('Links must start with http:// or https://');
  };

  return (
    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="border-b bg-blue-50/60 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-blue-700">Email content editor</div>
      <div className="flex flex-wrap items-center gap-1 border-b px-3 py-2">
        <select className={sel} defaultValue="Calibri" onChange={(e) => run('fontName', e.target.value)}>{FONTS.map((f) => <option key={f}>{f}</option>)}</select>
        <select className={sel} defaultValue="3" onChange={(e) => run('fontSize', e.target.value)}>{SIZES.map(([l, v]) => <option key={v} value={v}>{l}</option>)}</select>
        <Sep />
        <Btn icon={Bold} cmd="bold" title="Bold" /><Btn icon={Italic} cmd="italic" title="Italic" />
        <Btn icon={Underline} cmd="underline" title="Underline" /><Btn icon={Strikethrough} cmd="strikeThrough" title="Strikethrough" />
        <input type="color" defaultValue="#000000" title="Text color" onChange={(e) => run('foreColor', e.target.value)}
          className="h-8 w-8 cursor-pointer rounded border bg-white p-0.5" />
        <Sep />
        <Btn icon={AlignLeft} cmd="justifyLeft" title="Align left" /><Btn icon={AlignCenter} cmd="justifyCenter" title="Center" />
        <Btn icon={AlignRight} cmd="justifyRight" title="Align right" /><Btn icon={AlignJustify} cmd="justifyFull" title="Justify" />
        <Sep />
        <Btn icon={List} cmd="insertUnorderedList" title="Bullet list" /><Btn icon={ListOrdered} cmd="insertOrderedList" title="Numbered list" />
        <Sep />
        <button type="button" title="Insert link" onMouseDown={(e) => { e.preventDefault(); link(); }} className="rounded-md p-2 text-gray-600 hover:bg-gray-100"><Link2 size={16} /></button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        spellCheck
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
        onBlur={remember}
        onKeyUp={remember}
        onMouseUp={remember}
        className="compose-body px-5 py-4"
        style={{ minHeight, fontFamily: 'Calibri, Arial, sans-serif' }}
      />
      {signature && (
        <div className="border-t border-dashed px-5 pb-4 pt-2">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Signature · added automatically{signatureNote ? ` · ${signatureNote}` : ''}</p>
          <div className="compose-body select-none text-gray-700 [&>p]:!mt-0" style={{ fontFamily: 'Calibri, Arial, sans-serif' }} dangerouslySetInnerHTML={{ __html: signature }} />
        </div>
      )}
      {footer && <div className="flex items-center justify-between border-t px-4 py-3 text-sm">{footer}</div>}
    </div>
  );
}