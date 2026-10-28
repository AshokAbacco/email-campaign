import { useMemo } from 'react';
import DOMPurify from 'dompurify';
import { Archive, ArrowLeft, Download, Forward, Inbox, MailOpen, Paperclip, Reply, Star, Trash2 } from 'lucide-react';
import { formatDate, formatSize, person } from '../../../utils/format.js';

const Btn = ({ icon: Icon, label, onClick, active }) => (
  <button onClick={onClick} title={label} className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-gray-600 hover:bg-gray-100">
    <Icon size={16} className={active ? 'fill-amber-400 text-amber-400' : ''} /> <span className="hidden xl:inline">{label}</span>
  </button>
);

function Body({ msg }) {
  const doc = useMemo(() => {
    if (!msg.bodyHtml) return null;
    // Sanitized, then rendered in a sandboxed iframe (no scripts, no same-origin access)
    const clean = DOMPurify.sanitize(msg.bodyHtml, { FORBID_TAGS: ['form', 'iframe', 'object', 'embed'] });
    return `<base target="_blank"><style>body{font-family:system-ui,sans-serif;font-size:14px;line-height:1.5;margin:16px;word-wrap:break-word;color:#111}img{max-width:100%;height:auto}</style>${clean}`;
  }, [msg.bodyHtml]);

  if (doc) return <iframe title="Email body" sandbox="allow-popups allow-popups-to-escape-sandbox" srcDoc={doc} className="h-full min-h-[420px] w-full border-0 bg-white" />;
  return <pre className="whitespace-pre-wrap break-words p-5 font-sans text-sm">{msg.bodyText || '(No content)'}</pre>;
}

export default function MessagePreview({ msg, loading, onBack, onStar, onArchive, onTrash, onUnread, onReply, onForward, onDownload, className = '' }) {
  if (!msg && !loading) {
    return <section className={`flex-col items-center justify-center bg-gray-50 text-gray-400 ${className}`}><Inbox size={40} /><p className="mt-2 text-sm">Select an email to read it</p></section>;
  }
  if (loading || !msg) {
    return (
      <section className={`flex-col bg-white ${className}`}>
        <div className="animate-pulse space-y-3 p-6"><div className="h-6 w-2/3 rounded bg-gray-200" /><div className="h-4 w-1/3 rounded bg-gray-200" /><div className="h-40 rounded bg-gray-100" /></div>
      </section>
    );
  }
  const row = (label, list) => list?.length > 0 && (
    <div className="text-xs text-gray-500"><span className="mr-1 font-medium">{label}:</span>{list.map(person).join(', ')}</div>
  );

  return (
    <section className={`flex-col bg-white ${className}`}>
      <div className="flex flex-wrap items-center gap-1 border-b px-3 py-2">
        <button onClick={onBack} className="mr-1 rounded-md p-1.5 hover:bg-gray-100 lg:hidden" aria-label="Back"><ArrowLeft size={18} /></button>
        <Btn icon={Reply} label="Reply" onClick={onReply} />
        <Btn icon={Forward} label="Forward" onClick={onForward} />
        <Btn icon={Star} label={msg.isStarred ? 'Unstar' : 'Star'} onClick={onStar} active={msg.isStarred} />
        {msg.folderType === 'INBOX' && <Btn icon={Archive} label="Archive" onClick={onArchive} />}
        <Btn icon={MailOpen} label="Mark unread" onClick={onUnread} />
        <Btn icon={Trash2} label="Delete" onClick={onTrash} />
      </div>
      <div className="space-y-1 border-b px-5 py-4">
        <h1 className="text-lg font-semibold">{msg.subject}</h1>
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium">{msg.fromName || msg.fromEmail}</span>
          <span className="text-xs text-gray-500">&lt;{msg.fromEmail}&gt;</span>
          <span className="ml-auto shrink-0 text-xs text-gray-400">{formatDate(msg.date, true)}</span>
        </div>
        {row('To', msg.toList)}{row('Cc', msg.ccList)}{row('Bcc', msg.bccList)}
        <div className="text-xs text-gray-400">via {msg.account.email}</div>
      </div>
      {msg.attachments?.length > 0 && (
        <div className="flex flex-wrap gap-2 border-b px-5 py-3">
          {msg.attachments.map((a) => (
            <button key={a.id} onClick={() => onDownload(a)} className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs hover:bg-gray-50">
              <Paperclip size={13} /> <span className="max-w-[180px] truncate">{a.filename}</span>
              <span className="text-gray-400">{formatSize(a.size)}</span> <Download size={13} className="text-blue-600" />
            </button>
          ))}
        </div>
      )}
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto"><Body msg={msg} /></div>
    </section>
  );
}
