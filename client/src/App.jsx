import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import AppLayout from './components/AppLayout.jsx';
import Login from './pages/login/Login.jsx';
import Inbox from './pages/inbox/Inbox.jsx';
import Campaigns from './pages/campaigns/Campaigns.jsx';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid h-full place-items-center text-gray-500">Loading…</div>;
  return user ? children : <Navigate to="/login" replace />;
}

// Replaced by the real pages in the next phases
const Soon = ({ title }) => (
  <div className="grid h-full place-items-center text-center">
    <div>
      <h2 className="text-lg font-semibold text-gray-700">{title}</h2>
      <p className="text-sm text-gray-400">Coming in the next phase.</p>
    </div>
  </div>
);

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Protected><AppLayout /></Protected>}>
        <Route path="/inbox" element={<Inbox />} />
        <Route path="/campaigns" element={<Campaigns />} />
        <Route path="/pitches" element={<Soon title="Pitches" />} />
      </Route>
      <Route path="*" element={<Navigate to="/inbox" replace />} />
     
    </Routes>
  );
}