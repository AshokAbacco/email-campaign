import { Loader2, Menu, Paperclip, RefreshCw, Search, Star, History } from 'lucide-react';
import { formatDate } from '../../../utils/format.js';

export const ListSkeleton = () => (
  <div className="divide-y">
    {Array.from({ length: 8 }).map((_, i) => (
      <div key={i} className="animate-pulse space-y-2 px-4 py-3">
        <div className="h-3 w-1/3 rounded bg-gray-200" /><div className="h-3 w-2/3 rounded bg-gray-200" /><div className="h-3 w-full rounded bg-gray-100" />
      </div>
    ))}
  </div>
);

export default function MessageList({ title, list, loading, loadingMore, selectedId, q, onQ, onSelect, onStar, onMore, onSync, syncing, onOlder, onMenu, className = '' }) {
  return (
    <section className={`flex-col border-r bg-white ${className}`}>
      <div className="space-y-3 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <button className="md:hidden" onClick={onMenu} aria-label="Folders"><Menu size={20} /></button>
          <h2 className="truncate text-base font-semibold">{title}</h2>
          <span className="text-xs text-gray-400">{list.total}</span>
          <button onClick={onSync} className="ml-auto flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-gray-600 hover:bg-gray-50" title="Sync now">
            <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} /> Sync
          </button>
        </div>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-2.5 text-gray-400" />
          <input value={q} onChange={(e) => onQ(e.target.value)} placeholder="Search sender, subject, keywords"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:bg-white" />
        </div>
      </div>

      <div className="scroll-thin flex-1 overflow-y-auto">
        {loading ? <ListSkeleton /> : list.items.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-gray-400">{q ? 'No messages match your search.' : 'No messages here yet.'}</div>
        ) : (
          <ul className="divide-y">
            {list.items.map((m) => (
              <li key={m.id}>
                <div onClick={() => onSelect(m)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onSelect(m)}
                  className={`flex cursor-pointer gap-3 px-4 py-3 transition-colors hover:bg-gray-50 ${selectedId === m.id ? 'bg-blue-50' : !m.isRead ? 'bg-blue-50/40' : ''}`}>
                  <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${m.isRead ? 'bg-transparent' : 'bg-blue-600'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className={`truncate text-sm ${m.isRead ? 'text-gray-700' : 'font-semibold text-gray-900'}`}>{m.fromName || m.fromEmail}</span>
                      <span className="ml-auto shrink-0 text-xs text-gray-400">{formatDate(m.date)}</span>
                    </div>
                    <div className="truncate text-xs text-gray-400">{m.fromEmail}</div>
                    <div className={`truncate text-sm ${m.isRead ? '' : 'font-medium'}`}>{m.subject}</div>
                    <div className="flex items-center gap-2">
                      <span className="truncate text-xs text-gray-500">{m.snippet}</span>
                      {m.hasAttachments && <Paperclip size={13} className="ml-auto shrink-0 text-gray-400" />}
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); onStar(m); }} aria-label="Star" className="self-start pt-1">
                    <Star size={16} className={m.isStarred ? 'fill-amber-400 text-amber-400' : 'text-gray-300 hover:text-gray-500'} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {!loading && list.items.length > 0 && (
          <div className="flex flex-col items-center gap-2 p-4">
            {list.page < list.pages && (
              <button onClick={onMore} disabled={loadingMore} className="flex items-center gap-2 rounded-lg border px-4 py-1.5 text-sm hover:bg-gray-50">
                {loadingMore && <Loader2 size={14} className="animate-spin" />} Load more
              </button>
            )}
            {!q && <button onClick={onOlder} className="flex items-center gap-1 text-xs text-blue-600 hover:underline"><History size={12} /> Fetch older mail from provider</button>}
          </div>
        )}
      </div>
    </section>
  );
}
