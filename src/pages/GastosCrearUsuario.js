import React, { useState } from 'react';
import api from '../api';

export default function GastosCrearUsuario() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole]       = useState('user');
  const [busy, setBusy]       = useState(false);
  const [msg, setMsg]         = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg('');
    try {
      // requiere cabecera Authorization: Bearer <token> (se setea en App.js)
      const resp = await api.post('/auth/register', { username, password, role });
      const data = resp?.data ?? resp;
      setMsg(`Usuario creado: ${data?.username} (${data?.role})`);
      setUsername('');
      setPassword('');
      setRole('user');
    } catch (err) {
      console.error('[crear usuario] error:', err);
      setMsg('No se pudo crear el usuario (verifica permisos y datos).');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white border rounded-xl shadow p-5">
      <h3 className="text-lg font-semibold mb-4">Crear usuario</h3>

      {msg && (
        <div className="mb-3 text-sm bg-gray-50 border rounded px-3 py-2">{msg}</div>
      )}

      <form className="grid gap-3 max-w-md" onSubmit={submit}>
        <label className="text-sm">
          <span className="block text-gray-600 mb-1">Usuario</span>
          <input
            className="w-full border rounded px-3 py-2"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            placeholder="usuario01"
          />
        </label>

        <label className="text-sm">
          <span className="block text-gray-600 mb-1">Contraseña</span>
          <input
            type="password"
            className="w-full border rounded px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
          />
        </label>

        <label className="text-sm">
          <span className="block text-gray-600 mb-1">Rol</span>
          <select
            className="w-full border rounded px-3 py-2"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="user">Usuario</option>
            <option value="admin">Administrador</option>
          </select>
        </label>

        <div className="pt-2">
          <button
            type="submit"
            disabled={busy}
            className="px-5 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {busy ? 'Creando…' : 'Crear'}
          </button>
        </div>
      </form>
    </div>
  );
}
