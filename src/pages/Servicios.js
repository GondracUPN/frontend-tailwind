import React, { useCallback, useEffect, useState } from 'react';
import api from '../api';
import ModalProducto from '../components/ModalProducto';

function UsuariosAdmin() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ username: '', password: '', role: 'user' });

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api.get('/auth/users');
      setUsers(Array.isArray(data) ? data : []);
    } catch (e) {
      setError('No se pudieron cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const createUser = async (e) => {
    e.preventDefault();
    try {
      await api.post('/auth/register', form);
      setForm({ username: '', password: '', role: 'user' });
      await load();
    } catch (e) {
      alert('No se pudo crear el usuario');
    }
  };

  const changeRole = async (id, role) => {
    try {
      await api.patch(`/auth/users/${id}`, { role });
      await load();
    } catch (e) {
      alert('No se pudo actualizar el rol');
    }
  };

  

  return (
    <div className="bg-white rounded-2xl p-4 shadow">
      <h2 className="text-xl font-semibold mb-3">Usuarios</h2>
      <form onSubmit={createUser} className="flex gap-2 flex-wrap items-end mb-4">
        <div>
          <label className="text-sm text-gray-600">Usuario</label>
          <input className="border rounded px-2 py-1" value={form.username} onChange={e=>setForm(f=>({...f, username:e.target.value}))} required />
        </div>
        <div>
          <label className="text-sm text-gray-600">Password</label>
          <input type="password" className="border rounded px-2 py-1" value={form.password} onChange={e=>setForm(f=>({...f, password:e.target.value}))} required minLength={6} />
        </div>
        <div>
          <label className="text-sm text-gray-600">Rol</label>
          <select className="border rounded px-2 py-1" value={form.role} onChange={e=>setForm(f=>({...f, role:e.target.value}))}>
            <option value="user">Cliente</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button className="bg-indigo-600 text-white px-3 py-2 rounded">Crear</button>
      </form>

      {loading ? (
        <p>Cargando...</p>
      ) : error ? (
        <p className="text-red-600">{error}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-600">
              <th className="p-2">ID</th>
              <th className="p-2">Usuario</th>
              <th className="p-2">Rol</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-t">
                <td className="p-2">{u.id}</td>
                <td className="p-2">{u.username}</td>
                <td className="p-2">
                  <select value={u.role} onChange={(e)=>changeRole(u.id, e.target.value)} className="border rounded px-2 py-1">
                    <option value="user">Cliente</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function InventarioAdmin({ onIrProductos }) {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [openModal, setOpenModal] = useState(false);
  const [ventasMap, setVentasMap] = useState({}); // { [productoId]: venta | null }

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api.get('/productos');
      const list = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
      setProductos(list);
    } catch (e) {
      setError('No se pudo cargar inventario');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  // Cargar estado de venta por producto (ultima venta) en batch
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!Array.isArray(productos) || productos.length === 0) {
        if (alive) setVentasMap({});
        return;
      }
      try {
        const ids = productos.map((p) => p.id).filter(Boolean);
        const query = ids.length ? `?ids=${ids.join(',')}` : '';
        const data = await api.get(`/ventas/ultimas${query}`);
        const arr = Array.isArray(data)
          ? data
          : (Array.isArray(data?.items) ? data.items
            : (Array.isArray(data?.data) ? data.data : []));
        const map = {};
        arr.forEach((v) => {
          if (v && v.productoId != null) map[v.productoId] = v;
        });
        ids.forEach((id) => { if (map[id] === undefined) map[id] = null; });
        if (alive) setVentasMap(map);
      } catch {
        if (alive) setVentasMap({});
      }
    })();
    return () => { alive = false; };
  }, [productos]);

  const lastTrackingById = React.useMemo(() => {
    const map = {};
    for (const p of productos || []) {
      const trk = Array.isArray(p.tracking) ? p.tracking : [];
      let best = null;
      for (const t of trk) {
        if (!t) continue;
        if (!best) { best = t; continue; }
        const ta = t.createdAt ? Date.parse(t.createdAt) : 0;
        const ba = best.createdAt ? Date.parse(best.createdAt) : 0;
        if (ta && ba) {
          if (ta > ba) best = t;
        } else if ((t.id || 0) > (best.id || 0)) {
          best = t;
        }
      }
      map[p.id] = best;
    }
    return map;
  }, [productos]);

  const statusById = React.useMemo(() => {
    const map = {};
    for (const p of productos || []) {
      const venta = ventasMap[p.id] || null;
      const last = lastTrackingById[p.id];
      if (venta) {
        map[p.id] = { label: 'Vendido', cls: 'bg-green-100 text-green-800 border border-green-300' };
      } else if ((last?.estado || '').toLowerCase() === 'recogido') {
        map[p.id] = { label: 'Disponible', cls: 'bg-yellow-100 text-yellow-800 border border-yellow-300' };
      } else {
        map[p.id] = { label: 'En espera', cls: 'bg-gray-100 text-gray-700 border border-gray-300' };
      }
    }
    return map;
  }, [productos, ventasMap, lastTrackingById]);

  const getVentaStatus = useCallback(
    (p) => statusById[p.id] || { label: 'En espera', cls: 'bg-gray-100 text-gray-700 border border-gray-300' },
    [statusById],
  );

  const enviarDisponiblesAlCatalogo = async () => {
    try {
      setLoading(true);
      const res = await api.post('/productos/catalog-sync', {});
      const r = res?.data ?? res;
      const errs = Array.isArray(r?.errores) ? r.errores.length : 0;
      alert(`Enviados: ${r.enviados ?? 0} / ${r.total ?? visibles.length}. Errores: ${errs}`);
    } catch (e) {
      alert('No se pudo sincronizar con el catálogo');
    } finally {
      setLoading(false);
    }
  };

  // Derivar lista visible: solo 'Disponible'
  const visibles = React.useMemo(() => {
    return (productos || []).filter((p) => getVentaStatus(p).label === 'Disponible');
  }, [productos, statusById, getVentaStatus]);

  return (
    <div className="bg-white rounded-2xl p-4 shadow">
      <h2 className="text-xl font-semibold mb-3">Inventario</h2>
      <div className="flex gap-2 mb-3 flex-wrap">
        <button onClick={()=>setOpenModal(true)} className="bg-green-600 text-white px-3 py-2 rounded">Agregar producto</button>
        <button onClick={load} className="bg-gray-200 px-3 py-2 rounded">Refrescar</button>
        <button onClick={onIrProductos} className="bg-indigo-600 text-white px-3 py-2 rounded">Ver en Productos</button>
        <button onClick={enviarDisponiblesAlCatalogo} className="bg-amber-500 text-white px-3 py-2 rounded">Enviar disponibles al catálogo</button>
      </div>
      {loading ? <p>Cargando...</p> : error ? <p className="text-red-600">{error}</p> : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-600">
              <th className="p-2">ID</th>
              <th className="p-2">Tipo</th>
              <th className="p-2">Estado</th>
              <th className="p-2">Estatus</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map(p => (
              <tr key={p.id} className="border-t">
                <td className="p-2">{p.id}</td>
                <td className="p-2">{p.tipo}</td>
                <td className="p-2">{p.estado}</td>
                <td className="p-2">
                  {(() => {
                    const s = getVentaStatus(p);
                    return <span className={`px-2 py-1 rounded text-xs ${s.cls}`}>{s.label}</span>;
                  })()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {openModal && (
        <ModalProducto
          onClose={() => setOpenModal(false)}
          onSaved={() => { setOpenModal(false); load(); }}
        />
      )}
    </div>
  );
}

export default function Servicios({ setVista }) {
  // Acceso directo: sin comprobación de sufijo especial en la URL
  return (
    <div className="min-h-screen p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Servicios (Admin)</h1>
        <button onClick={() => setVista('home')} className="px-4 py-2 bg-white border rounded shadow-sm hover:bg-gray-100">← Volver</button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <UsuariosAdmin />
        <InventarioAdmin onIrProductos={() => setVista('productos')} />
      </div>
    </div>
  );
}

