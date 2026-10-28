import { NavLink } from 'react-router-dom';
import { Inbox, LogOut, Mail, Megaphone, Presentation } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const LINKS = [
  { to: '/inbox', label: 'Inbox', icon: Inbox },
  { to: '/campaigns', label: 'Campaigns', icon: Megaphone },
  { to: '/pitches', label: 'Pitches', icon: Presentation },
];

export default function AppHeader() {
  const { user, logout } = useAuth();

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-white px-3 sm:px-5">
      <div className="flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-blue-600 text-white"><Mail size={16} /></div>
        <span className="hidden font-semibold sm:inline">Email Campaign</span>
      </div>

      <nav className="ml-2 flex items-center gap-1 sm:ml-6">
        {LINKS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
              }`
            }
          >
            <Icon size={16} /> <span className="hidden sm:inline">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-3">
        <div className="hidden items-center gap-2 md:flex">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-blue-600 text-sm font-semibold text-white">
            {(user?.name || user?.email || '?')[0].toUpperCase()}
          </span>
          <span className="max-w-[180px] truncate text-sm text-gray-600">{user?.email}</span>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          title="Logout"
        >
          <LogOut size={16} /> <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}