import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext.jsx';

export default function Login() {
  const { user, login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/inbox" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await (mode === 'login' ? login({ email: f.email, password: f.password }) : register(f));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };
  const input = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

  return (
    <div className="grid h-full place-items-center bg-gray-50 p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-blue-600 text-white"><Mail size={18} /></div>
          <h1 className="text-lg font-semibold">Email Campaign</h1>
        </div>
        <p className="text-sm text-gray-500">{mode === 'login' ? 'Sign in to your workspace' : 'Create your account'}</p>
        {mode === 'register' && <input className={input} placeholder="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />}
        <input className={input} type="email" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
        <input className={input} type="password" placeholder="Password (min 8 characters)" minLength={mode === 'register' ? 8 : 1} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required />
        <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
          {busy && <Loader2 size={16} className="animate-spin" />} {mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
        <button type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')} className="w-full text-center text-sm text-blue-600 hover:underline">
          {mode === 'login' ? 'Need an account? Register' : 'Have an account? Sign in'}
        </button>
      </form>
    </div>
  );
}
