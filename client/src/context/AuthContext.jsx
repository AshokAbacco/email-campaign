import { createContext, useContext, useEffect, useState } from 'react';
import { authApi } from '../api/auth.api.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!localStorage.getItem('token'));

  useEffect(() => {
    if (localStorage.getItem('token')) {
      authApi.me().then((r) => setUser(r.user)).catch(() => {}).finally(() => setLoading(false));
    }
    const out = () => setUser(null);
    window.addEventListener('auth:logout', out);
    return () => window.removeEventListener('auth:logout', out);
  }, []);

  const finish = ({ token, user }) => { localStorage.setItem('token', token); setUser(user); };
  const value = {
    user, loading,
    login: async (b) => finish(await authApi.login(b)),
    register: async (b) => finish(await authApi.register(b)),
    logout: () => { localStorage.removeItem('token'); setUser(null); },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}