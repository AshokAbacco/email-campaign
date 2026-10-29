import { useMemo } from 'react';
import DOMPurify from 'dompurify';
import { X } from 'lucide-react';

export const cleanHtml = (html) => DOMPurify.sanitize(html, { FORBID_TAGS: ['style', 'form', 'iframe', 'object', 'embed'] });

export default function PreviewModal({ html, subject, onClose }) {
  const doc = useMemo(
    () => `<base target="_blank"><style>body{font-family:Calibri,Arial,sans-serif;font-size:14px;line-height:1.6;margin:16px;color:#111827}p{margin:0 0 .9em}img{max-width:100%}</style>${cleanHtml(html)}`,
    [html]
  );
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <div className="min-w-0">
            <p className="text-xs text-gray-400">Preview</p>
            <h3 className="truncate font-semibold">{subject || '(no subject)'}</h3>
          </div>
          <button onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <iframe title="Preview" sandbox="allow-popups" srcDoc={doc} className="h-[60vh] w-full border-0" />
      </div>
    </div>
  );
}