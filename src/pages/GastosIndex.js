// src/pages/GastosIndex.jsx
import React, { useEffect, useState } from 'react';
import GastosCrearUsuario from './GastosCrearUsuario';
import GastosPanel from './GastosPanel';
import { API_URL } from '../api';
import LoginGastos from './LoginGastos';

export default function GastosIndex({ setVista }) {
  const [mode, setMode] = useState(null); // 'create' | 'panel' | null
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);

  // Lee sesión desde localStorage al montar
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('token'));

  const isLogged = Boolean(token && user);
  const isAdmin = user?.role === 'admin';

  // (Admin) cargar lista de usuarios
  useEffect(() => {
    if (!isAdmin || !token) return;
    let alive = true;
    (async () => {
      setLoadingUsers(true);
      try {
        const res = await fetch(`${API_URL}/auth/users`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();
        if (alive) setUsers(Array.isArray(data) ? data : []);
      } catch {
        if (alive) setUsers([]);
      } finally {
        if (alive) setLoadingUsers(false);
      }
    })();
    return () => { alive = false; };
  }, [isAdmin, token]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setVista?.('home');
  };

  // Si NO hay sesión, mostramos el login aquí mismo
  if (!isLogged) {
    return (
      <LoginGastos
        onLoggedIn={(u, t) => {
          setUser(u || null);
          setToken(t || null);
          setMode(null);
        }}
        onBack={() => setVista('home')}
      />

    );
  }

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      {/* Header */}
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setVista('home')}
            className="px-4 py-2 bg-white border rounded shadow-sm hover:bg-gray-100"
          >
            ← Volver
          </button>
          <h2 className="text-2xl font-semibold">
            Hola {user?.username}! — <span className="font-normal">sesión iniciada</span>
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">Rol:</span>
          <span className="px-2 py-1 rounded bg-gray-200 text-gray-800 text-sm capitalize">
            {user?.role || 'user'}
          </span>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-900"
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      {/* Bloque principal */}
      <div className="bg-white border rounded-xl shadow p-5 mb-6">
        <div className="text-lg font-semibold mb-2">Bienvenido a gastos</div>

        {isAdmin ? (
          <>
            <div className="flex flex-wrap gap-3 mb-5">
              <button
                onClick={() => setMode('create')}
                className="px-5 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
              >
                Crear usuario
              </button>

              <button
                onClick={() => {
                  setSelectedUserId(user.id);
                  setMode('panel');
                }}
                className="px-5 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700"
              >
                Ver gastos (míos)
              </button>
            </div>

            <div>
              <div className="text-md font-semibold mb-2">Usuarios disponibles</div>
              {loadingUsers ? (
                <div className="text-sm text-gray-600">Cargando usuarios…</div>
              ) : users.length === 0 ? (
                <div className="text-sm text-gray-600">No hay usuarios aún.</div>
              ) : (
                <div className="overflow-auto border rounded">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="p-2">ID</th>
                        <th className="p-2">Usuario</th>
                        <th className="p-2">Rol</th>
                        <th className="p-2">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id} className="border-t">
                          <td className="p-2">{u.id}</td>
                          <td className="p-2">{u.username}</td>
                          <td className="p-2 capitalize">{u.role}</td>
                          <td className="p-2">
                            <button
                              onClick={() => {
                                setSelectedUserId(u.id);
                                setMode('panel');
                              }}
                              className="px-3 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700"
                            >
                              Ver gastos
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : (
          <div>
            <div className="mb-3 text-gray-700">
              Usa “Ver mis gastos” para revisar y agregar desde el panel.
            </div>
            <div className="mt-2">
              <button
                onClick={() => {
                  setSelectedUserId(user.id);
                  setMode('panel');
                }}
                className="px-5 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700"
              >
                Ver mis gastos
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Contenido según el modo */}
      {mode === 'create' && isAdmin && <GastosCrearUsuario />}

      {mode === 'panel' && (
        <GastosPanel userId={selectedUserId ?? user.id} />
      )}
    </div>
  );
}
