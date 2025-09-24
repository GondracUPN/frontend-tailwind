import React, { useState } from 'react';
import api from '../api';

export default function LoginGastos({ onLoggedIn, onBack }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;

    setBusy(true);
    setError('');
    try {
      const resp = await api.post('/auth/login', {
        username: username.trim(),
        password,
      });

      const data = resp?.data ?? resp;
      const token = data?.token ?? data?.access_token;
      const user = data?.user;

      if (!token || !user) throw new Error('Respuesta inválida');

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));

      onLoggedIn?.(user, token);
    } catch (err) {
      console.error('[login] error:', err);
      setError('Usuario o contraseña incorrectos.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-sm bg-white border rounded-xl shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={() => (onBack ? onBack() : window.history.back())}
            className="px-3 py-1.5 bg-gray-100 border rounded hover:bg-gray-200"
          >
            ← Volver
          </button>
          <h1 className="text-xl font-semibold">Iniciar sesión</h1>
        </div>

        {error ? (
          <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </div>
        ) : null}

        <form className="space-y-3" onSubmit={submit}>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Usuario</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              placeholder="admin"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Contraseña</label>
            <input
              type="password"
              className="w-full border rounded px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-60"
          >
            {busy ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}
