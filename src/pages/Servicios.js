import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import api from '../api';
import LoginGastos from './LoginGastos';
import { EXPENSE_CATEGORY_OPTIONS } from '../utils/expenseConcepts';

const ModalProducto = lazy(() => import('../components/ModalProducto'));

function UsuariosAdmin() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ username: '', password: '', role: 'user' });

  const load = useCallback(async () => {
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
  }, []);

  useEffect(() => { load(); }, [load]);

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
  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api.get('/productos/catalog-pending');
      const list = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
      setProductos(list);
    } catch (e) {
      setError('No se pudo cargar inventario');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
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

  const upsertProducto = useCallback((saved, tracking) => {
    if (!saved?.id) {
      load();
      return;
    }
    const withTracking = tracking
      ? {
          ...saved,
          tracking: [
            ...(Array.isArray(saved.tracking) ? saved.tracking : []),
            { ...tracking, productoId: saved.id },
          ],
        }
      : saved;
    setProductos((prev) => {
      const exists = prev.some((p) => p.id === saved.id);
      return exists
        ? prev.map((p) => (p.id === saved.id ? { ...p, ...withTracking } : p))
        : [withTracking, ...prev];
    });
    setVentasMap((prev) => ({ ...prev, [saved.id]: prev[saved.id] ?? null }));
    setOpenModal(false);
  }, [load]);

  const enviarDisponiblesAlCatalogo = async () => {
    try {
      setLoading(true);
      const res = await api.post('/productos/catalog-sync', {});
      const r = res?.data ?? res;
      const errs = Array.isArray(r?.errores) ? r.errores.length : 0;
      alert(`Procesados: ${r.marcados ?? r.enviados ?? 0} / ${r.total ?? visibles.length}. Enviados nuevos: ${r.enviados ?? 0}. Errores: ${errs}`);
      await load();
    } catch (e) {
      alert('No se pudo sincronizar con el catálogo');
    } finally {
      setLoading(false);
    }
  };

  // Derivar lista visible: solo 'Disponible'
  const visibles = React.useMemo(() => {
    return (productos || []).filter((p) => getVentaStatus(p).label === 'Disponible' && !p.catalogoEnviado);
  }, [productos, getVentaStatus]);

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
        <Suspense fallback={null}>
          <ModalProducto
            onClose={() => setOpenModal(false)}
            onSaved={upsertProducto}
          />
        </Suspense>
      )}
    </div>
  );
}

const catalogCsvHint = 'Separado por comas';
const readCatalogPayload = (data) => ({
  productOptions: Array.isArray(data?.productOptions)
    ? data.productOptions
    : (Array.isArray(data?.products) ? data.products : []),
  expenseConcepts: Array.isArray(data?.expenseConcepts)
    ? data.expenseConcepts
    : (Array.isArray(data?.expenses) ? data.expenses : []),
});
const sortProductOptions = (items) => [...items].sort((a, b) => (
  String(a.productType || '').localeCompare(String(b.productType || '')) ||
  String(a.family || '').localeCompare(String(b.family || '')) ||
  String(a.value || '').localeCompare(String(b.value || '')) ||
  Number(a.id || 0) - Number(b.id || 0)
));
const sortExpenseConcepts = (items) => [...items].sort((a, b) => (
  String(a.label || '').localeCompare(String(b.label || '')) ||
  Number(a.id || 0) - Number(b.id || 0)
));
const upsertCatalogItem = (items, item, sorter) => {
  if (!item?.id) return items;
  const next = items.some((current) => current.id === item.id)
    ? items.map((current) => (current.id === item.id ? item : current))
    : [...items, item];
  return sorter(next);
};

const invalidateGastosPanelCache = () => {
  Object.keys(localStorage)
    .filter((key) => key.startsWith('gastos-panel-cache:'))
    .forEach((key) => localStorage.removeItem(key));
};

function CatalogosAdmin() {
  const [productItems, setProductItems] = useState([]);
  const [expenseItems, setExpenseItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
  const [message, setMessage] = useState('');
  const [productForm, setProductForm] = useState({
    productType: 'macbook',
    family: 'Air',
    value: '',
    label: '',
    sizes: '',
    rams: '',
    storages: '',
    models: '',
  });
  const [expenseForm, setExpenseForm] = useState({
    label: '',
    appliesDebit: true,
    appliesCredit: false,
    defaultCurrency: 'PEN',
    category: 'life',
  });

  const load = useCallback(async ({ refresh = false } = {}) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setMessage('');
      let data;
      try {
        data = await api.get('/catalog');
      } catch {
        const [products, expenses] = await Promise.all([
          api.get('/catalog/product-options'),
          api.get('/catalog/expense-concepts'),
        ]);
        data = { productOptions: products, expenseConcepts: expenses };
      }
      const { productOptions, expenseConcepts } = readCatalogPayload(data);
      setProductItems(sortProductOptions(productOptions));
      setExpenseItems(sortExpenseConcepts(expenseConcepts));
    } catch {
      setMessage('No se pudieron cargar los catalogos.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveProduct = async (e) => {
    e.preventDefault();
    try {
      setSavingProduct(true);
      const created = await api.post('/catalog/product-options', productForm);
      setProductItems((prev) => upsertCatalogItem(prev, created?.data ?? created, sortProductOptions));
      setProductForm((prev) => ({ ...prev, value: '', label: '', sizes: '', rams: '', storages: '', models: '' }));
      setMessage('Opcion de producto agregada.');
    } catch (err) {
      setMessage(String(err?.message || 'No se pudo guardar la opcion de producto.'));
    } finally {
      setSavingProduct(false);
    }
  };

  const saveExpense = async (e) => {
    e.preventDefault();
    try {
      setSavingExpense(true);
      const created = await api.post('/catalog/expense-concepts', expenseForm);
      setExpenseItems((prev) => upsertCatalogItem(prev, created?.data ?? created, sortExpenseConcepts));
      invalidateGastosPanelCache();
      setExpenseForm({ label: '', appliesDebit: true, appliesCredit: false, defaultCurrency: 'PEN', category: 'life' });
      setMessage('Concepto de gasto agregado.');
    } catch (err) {
      setMessage(String(err?.message || 'No se pudo guardar el concepto.'));
    } finally {
      setSavingExpense(false);
    }
  };

  const disableItem = async (id) => {
    try {
      await api.del(`/catalog/items/${id}`);
      setProductItems((prev) => prev.filter((item) => item.id !== id));
      setExpenseItems((prev) => prev.filter((item) => item.id !== id));
      invalidateGastosPanelCache();
    } catch {
      setMessage('No se pudo desactivar el item.');
    }
  };

  const baseProductFamilyOptions = productForm.productType === 'macbook'
    ? ['Air', 'Pro', 'Neo']
    : productForm.productType === 'ipad'
      ? ['Normal', 'Mini', 'Air', 'Pro']
      : ['17', '18'];
  const productFamilyOptions = Array.from(new Set([
    ...baseProductFamilyOptions,
    ...productItems
      .filter((item) => item.productType === productForm.productType)
      .map((item) => item.family)
      .filter(Boolean),
  ]));
  const productFamilySelectValue = productFamilyOptions.includes(productForm.family)
    ? productForm.family
    : '__custom__';
  const productValueLabel = productForm.productType === 'iphone'
    ? 'Numero'
    : productForm.productType === 'ipad' && ['Normal', 'Mini'].includes(productForm.family)
      ? 'Generacion'
      : 'Procesador';

  return (
    <div className="md:col-span-2 rounded-2xl bg-white p-4 shadow">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Catalogos editables</h2>
          <p className="text-sm text-gray-500">Agrega nuevos modelos de producto y conceptos de gasto sin tocar codigo.</p>
        </div>
        <button onClick={() => load({ refresh: true })} disabled={loading || refreshing} className="rounded bg-gray-200 px-3 py-2 text-sm hover:bg-gray-300 disabled:opacity-60">{refreshing ? 'Refrescando...' : 'Refrescar'}</button>
      </div>

      {message && <div className="mb-4 rounded border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm text-indigo-800">{message}</div>}

      <div className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={saveProduct} className="rounded-2xl border border-gray-200 p-4">
          <h3 className="mb-3 font-semibold">Nuevo modelo / opcion de producto</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-gray-600">Producto</span>
              <select
                className="w-full rounded border px-3 py-2"
                value={productForm.productType}
                onChange={(e) => setProductForm((prev) => ({ ...prev, productType: e.target.value, family: e.target.value === 'iphone' ? '18' : 'Air', value: '' }))}
              >
                <option value="macbook">MacBook</option>
                <option value="ipad">iPad</option>
                <option value="iphone">iPhone</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-gray-600">{productForm.productType === 'iphone' ? 'Numero' : 'Linea / gama'}</span>
              <select
                className="w-full rounded border px-3 py-2"
                value={productFamilySelectValue}
                onChange={(e) => {
                  const next = e.target.value;
                  setProductForm((prev) => ({
                    ...prev,
                    family: next === '__custom__' ? '' : next,
                    value: '',
                  }));
                }}
              >
                {productFamilyOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
                <option value="__custom__">Nueva gama / linea</option>
              </select>
              {productFamilySelectValue === '__custom__' && (
                <input
                  className="mt-2 w-full rounded border px-3 py-2"
                  value={productForm.family}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, family: e.target.value }))}
                  placeholder={productForm.productType === 'iphone' ? 'Ej. 18' : 'Ej. Ultra'}
                  required
                />
              )}
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-gray-600">{productValueLabel}</span>
              <input
                className="w-full rounded border px-3 py-2"
                value={productForm.value}
                onChange={(e) => setProductForm((prev) => ({ ...prev, value: e.target.value }))}
                placeholder={productForm.productType === 'iphone' ? productForm.family : 'M6'}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-gray-600">Etiqueta opcional</span>
              <input className="w-full rounded border px-3 py-2" value={productForm.label} onChange={(e) => setProductForm((prev) => ({ ...prev, label: e.target.value }))} placeholder="MacBook Air M6" />
            </label>
            {productForm.productType === 'iphone' && (
              <label className="text-sm sm:col-span-2">
                <span className="mb-1 block text-gray-600">Modelos permitidos ({catalogCsvHint})</span>
                <input className="w-full rounded border px-3 py-2" value={productForm.models} onChange={(e) => setProductForm((prev) => ({ ...prev, models: e.target.value }))} placeholder="Normal, Plus, Pro, Pro Max, Air" />
              </label>
            )}
            {productForm.productType !== 'iphone' && (
              <>
                <label className="text-sm">
                  <span className="mb-1 block text-gray-600">Pantallas ({catalogCsvHint})</span>
                  <input className="w-full rounded border px-3 py-2" value={productForm.sizes} onChange={(e) => setProductForm((prev) => ({ ...prev, sizes: e.target.value }))} placeholder="13, 15" />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-gray-600">RAM ({catalogCsvHint})</span>
                  <input className="w-full rounded border px-3 py-2" value={productForm.rams} onChange={(e) => setProductForm((prev) => ({ ...prev, rams: e.target.value }))} placeholder="16, 24, 32" />
                </label>
              </>
            )}
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block text-gray-600">Almacenamiento ({catalogCsvHint})</span>
              <input className="w-full rounded border px-3 py-2" value={productForm.storages} onChange={(e) => setProductForm((prev) => ({ ...prev, storages: e.target.value }))} placeholder="256, 512, 1TB, 2TB" />
            </label>
          </div>
          <button disabled={loading || savingProduct} className="mt-3 rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{savingProduct ? 'Guardando...' : 'Agregar opcion'}</button>
        </form>

        <form onSubmit={saveExpense} className="rounded-2xl border border-gray-200 p-4">
          <h3 className="mb-3 font-semibold">Nuevo concepto de gasto</h3>
          <div className="grid gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-gray-600">Concepto</span>
              <input className="w-full rounded border px-3 py-2" value={expenseForm.label} onChange={(e) => setExpenseForm((prev) => ({ ...prev, label: e.target.value }))} placeholder="Servicios" required />
            </label>
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm">
                <input type="checkbox" checked={expenseForm.appliesDebit} onChange={(e) => setExpenseForm((prev) => ({ ...prev, appliesDebit: e.target.checked }))} />
                Debito
              </label>
              <label className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm">
                <input type="checkbox" checked={expenseForm.appliesCredit} onChange={(e) => setExpenseForm((prev) => ({ ...prev, appliesCredit: e.target.checked }))} />
                Credito
              </label>
              <select className="rounded border px-3 py-2 text-sm" value={expenseForm.defaultCurrency} onChange={(e) => setExpenseForm((prev) => ({ ...prev, defaultCurrency: e.target.value }))}>
                <option value="PEN">Soles</option>
                <option value="USD">Dolares</option>
              </select>
            </div>
            <label className="text-sm">
              <span className="mb-1 block text-gray-600">Apartado</span>
              <select className="w-full rounded border px-3 py-2" value={expenseForm.category} onChange={(e) => setExpenseForm((prev) => ({ ...prev, category: e.target.value }))}>
                {EXPENSE_CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>
          <button disabled={loading || savingExpense} className="mt-3 rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">{savingExpense ? 'Guardando...' : 'Agregar concepto'}</button>
        </form>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 p-4">
          <h3 className="mb-3 font-semibold">Opciones agregadas</h3>
          <div className="max-h-72 overflow-auto text-sm">
            {productItems.length === 0 ? <p className="text-gray-500">Sin opciones personalizadas.</p> : productItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 border-t py-2">
                <span>{item.productType} · {item.family} · {item.value}</span>
                <button onClick={() => disableItem(item.id)} className="text-red-600 hover:underline">Quitar</button>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-gray-200 p-4">
          <h3 className="mb-3 font-semibold">Conceptos agregados</h3>
          <div className="max-h-72 overflow-auto text-sm">
            {expenseItems.length === 0 ? <p className="text-gray-500">Sin conceptos personalizados.</p> : expenseItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 border-t py-2">
                <span>{item.label} · {[item.appliesDebit ? 'Debito' : '', item.appliesCredit ? 'Credito' : ''].filter(Boolean).join(' / ')}</span>
                <button onClick={() => disableItem(item.id)} className="text-red-600 hover:underline">Quitar</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Servicios({ setVista }) {
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

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  if (!isLogged) {
    return (
      <LoginGastos
        onLoggedIn={(u, t) => {
          setUser(u || null);
          setToken(t || null);
        }}
        onBack={() => setVista('home')}
      />
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen p-6 bg-gray-50 flex items-center justify-center">
        <div className="bg-white border rounded-xl shadow p-6 w-full max-w-lg">
          <h1 className="text-xl font-semibold mb-2">Acceso restringido</h1>
          <p className="text-sm text-gray-600 mb-4">
            Necesitas permisos de administrador para entrar a Servicios.
          </p>
          <div className="flex flex-wrap gap-3">
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
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Servicios (Admin)</h1>
          <span className="text-sm text-gray-500">{user?.username}</span>
        </div>
        <div className="flex items-center gap-3">
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
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <UsuariosAdmin />
        <InventarioAdmin onIrProductos={() => setVista('productos')} />
        <CatalogosAdmin />
      </div>
    </div>
  );
}


