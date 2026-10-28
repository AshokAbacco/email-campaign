import { Outlet } from 'react-router-dom';
import AppHeader from './AppHeader.jsx';

export default function AppLayout() {
  return (
    <div className="flex h-full flex-col bg-gray-50">
      <AppHeader />
      <main className="min-h-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}