// src/pages/GastosIndex.jsx
import React, { useEffect, useState } from 'react';
import GastosCrearUsuario from './GastosCrearUsuario';
import GastosPanel from './GastosPanel';
import { API_URL } from '../api';
import LoginGastos from './LoginGastos';

export default function GastosIndex({ setVista }) {
  const [mode, setMode] = useState(null); // 'create' | null
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [showUsersModal, setShowUsersModal] = useState(false);

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
    return () => {
      alive = false;
    };
  }, [isAdmin, token]);

  // Seleccionar por defecto el usuario logueado al entrar
  useEffect(() => {
    if (isLogged && user?.id) {
      setSelectedUserId(user.id);
    }
  }, [isLogged, user?.id]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setMode(null);
    setSelectedUserId(null);
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
          <button
            onClick={() => setVista('home')}
            className="px-4 py-2 bg-white border rounded shadow-sm hover:bg-gray-100"
          >
            ← Volver
          </button>
        </div>
      </header>

      {/* Bloque de acciones */}
      <div className="bg-white border rounded-xl shadow p-5 mb-6">
        <div className="text-lg font-semibold mb-3">Bienvenido a gastos</div>

        <div className="flex flex-wrap gap-3 mb-3">
          {isAdmin && (
            <>
              <button
                onClick={() => setMode(mode === 'create' ? null : 'create')}
                className="px-5 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
              >
                {mode === 'create' ? 'Cerrar creación' : 'Crear usuario'}
              </button>
              <button
                onClick={() => setShowUsersModal(true)}
                className="px-5 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700"
              >
                Usuarios
              </button>
            </>
          )}
        </div>

        {mode === 'create' && isAdmin && <GastosCrearUsuario />}
      </div>

      {/* Panel siempre visible para el usuario seleccionado */}
      <GastosPanel userId={selectedUserId ?? user.id} setVista={setVista} />

      {/* Modal de usuarios (solo admin) */}
      {showUsersModal && isAdmin && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-5 w-full max-w-3xl max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">Usuarios disponibles</h3>
              <button
                onClick={() => setShowUsersModal(false)}
                className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300"
              >
                Cerrar
              </button>
            </div>
            {loadingUsers ? (
              <div className="text-sm text-gray-600">Cargando usuarios...</div>
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
                    {users.map((u) => {
                      const isViewing = u.id === (selectedUserId ?? user.id);
                      return (
                        <tr key={u.id} className="border-t">
                          <td className="p-2">{u.id}</td>
                          <td className="p-2">{u.username}</td>
                          <td className="p-2 capitalize">{u.role}</td>
                          <td className="p-2">
                            <button
                              disabled={isViewing}
                              onClick={() => {
                                setSelectedUserId(u.id);
                                setShowUsersModal(false);
                                setMode(null);
                              }}
                              className={`px-3 py-1 rounded ${
                                isViewing
                                  ? 'bg-gray-200 text-gray-600 cursor-not-allowed'
                                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
                              }`}
                            >
                              {isViewing ? 'Viendo' : 'Ver gastos'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
