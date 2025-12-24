// src/components/DetallesProductoModal.js
import React, { useState, useEffect } from 'react';
import FormProductoMacbook from './formParts/FormProductoMacbook';
import FormProductoIpad from './formParts/FormProductoIpad';
import FormProductoIphone from './formParts/FormProductoIphone';
import FormProductoWatch from './formParts/FormProductoWatch';
import FormProductoOtro from './formParts/FormProductoOtro';
import api from '../api';

export default function DetallesProductoModal({ producto, productosAll = [], onClose, onSaved, onSaveOutside }) {
  // ----- 1. Estado e inicialización -----
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    tipo: '',
    estado: '',
    accesorios: [],        // ['Caja','Cubo','Cable'] o ['Todos']
    detalle: {},           // dinámico según tipo
  });
  const [linkerOpen, setLinkerOpen] = useState(false);
  const [loadingLinker, setLoadingLinker] = useState(false);
  const [linkables, setLinkables] = useState([]);
  const [pendingLinkIds, setPendingLinkIds] = useState([]);
  const [vincularConList, setVincularConList] = useState([]);
  const [desvincularEnvio, setDesvincularEnvio] = useState(false);
  const [unlinkTargets, setUnlinkTargets] = useState([]);
  const [vinculados, setVinculados] = useState([]);

  // ----- 2. Cargar datos al montar / cambiar producto -----
  useEffect(() => {
    if (!producto) return;
    setForm({
      tipo: producto.tipo,
      estado: producto.estado,
      accesorios: Array.isArray(producto.accesorios) ? producto.accesorios : [],
      detalle: { ...producto.detalle }, // viene con 'id' -> se filtrará en handleSave
    });
    setIsEditing(false);
    setVincularConList([]);
    setPendingLinkIds([]);
    setUnlinkTargets([]);
    setDesvincularEnvio(false);
    setLinkerOpen(false);
    // Construir lista de vinculados con los datos más frescos disponibles
    const base = Array.isArray(productosAll)
      ? productosAll.filter((p) => p.envioGrupoId && p.envioGrupoId === producto.envioGrupoId && p.id !== producto.id)
      : [];
    setVinculados(base);
    // Si no tenemos otros datos y hay grupo, intentar refrescar
    if ((!base.length || base.length === 1) && producto.envioGrupoId) {
      api.get('/productos').then((res) => {
        const data = res?.data || res || [];
        if (Array.isArray(data)) {
          const newer = data.filter((p) => p.envioGrupoId && p.envioGrupoId === producto.envioGrupoId && p.id !== producto.id);
          if (newer.length) setVinculados(newer);
        }
      }).catch(() => {});
    }
  }, [producto, productosAll]);

  // ----- 3. Handlers genéricos -----
  const handleMainChange = (field, value) =>
    setForm(f => ({ ...f, [field]: value }));

  const handleDetalleChange = (field, value) =>
    setForm(f => ({ ...f, detalle: { ...f.detalle, [field]: value } }));

  // ----- 4. Guardar cambios (PATCH) -----
  const handleSave = async () => {
    // Normaliza accesorios para backend
    let accesorios = Array.isArray(form.accesorios) ? [...form.accesorios] : [];
    const hasTodos = accesorios.includes('Todos');
    const isNuevo = String(form.estado || '').toLowerCase() === 'nuevo';
    if (hasTodos || isNuevo) accesorios = ['Caja','Cubo','Cable'];

    // Lista blanca de campos permitidos en 'detalle' (sin 'id')
    const cleanDetalle = Object.fromEntries(
      Object.entries(form.detalle || {}).filter(([k]) => k !== 'id')
    );
    // payload completo con todos los campos editables (sin 'detalle.id')
    const payload = { tipo: form.tipo, estado: form.estado, accesorios, detalle: cleanDetalle };
    const primaryLink = Array.isArray(vincularConList) ? vincularConList[0] : null;
    const extraLinks = Array.isArray(vincularConList) ? vincularConList.slice(1) : [];
    const unlinkList = Array.isArray(unlinkTargets) ? unlinkTargets : [];
    if (primaryLink) payload.vincularCon = Number(primaryLink);
    if (desvincularEnvio) payload.desvincularEnvio = true;

    try {
      const runExtraOps = async (baseId) => {
        if (baseId && extraLinks.length) {
          const ops = extraLinks.map((id) => api.patch(`/productos/${id}`, { vincularCon: baseId }).catch(() => {}));
          await Promise.allSettled(ops);
        }
        if (unlinkList.length) {
          const opsUnlink = unlinkList.map((id) => api.patch(`/productos/${id}`, { desvincularEnvio: true }).catch(() => {}));
          await Promise.allSettled(opsUnlink);
        }
      };

      if (onSaveOutside) {
        onSaveOutside(producto.id, payload); // Guardado gestionado por el padre para cerrar rapido el modal
        await runExtraOps(producto.id);
        onClose?.();
        return;
      }
    
      const res = await api.patch('/productos/' + producto.id, payload);
      const updated = res?.data ?? res;
      await runExtraOps(updated?.id || producto.id);
      onSaved(updated);
      setIsEditing(false);
    } catch (e) {
      console.error('[DetallesProductoModal] Error al guardar:', e);
      alert('No se pudo actualizar el producto.');
    }
  };

  // ----- 5. Renderizado -----
  if (!producto) return null;
  const getLastTrackingEstado = (p) => {
    const trk = Array.isArray(p?.tracking) ? [...p.tracking] : [];
    if (!trk.length) return '';
    trk.sort((a, b) => {
      if (a.createdAt && b.createdAt) {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return (b.id || 0) - (a.id || 0);
    });
    return String(trk[0]?.estado || '').toLowerCase();
  };

  const getCasilleroActual = () => {
    const trk = Array.isArray(producto?.tracking) ? [...producto.tracking] : [];
    if (!trk.length) return '';
    trk.sort((a, b) => {
      if (a.createdAt && b.createdAt) {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return (b.id || 0) - (a.id || 0);
    });
    return trk[0]?.casillero || '';
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white w-full sm:max-w-3xl rounded-xl shadow-lg p-6 relative mx-4 max-h-[90vh] overflow-y-auto">
        {/* Cerrar modal */}
        <button
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"
          onClick={onClose}
        >✖</button>

        {!isEditing ? (
          <>
            {/* --- Vista solo lectura --- */}
            <h2 className="text-2xl font-semibold mb-4">{producto.tipo}</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <section>
                <h3 className="font-medium mb-2">Especificaciones</h3>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  {Object.entries(producto.detalle)
                    .filter(([k, v]) => k !== 'id' && v) // no mostrar 'id'
                    .map(([k, v]) => (
                      <li key={k}>
                        <span className="capitalize">
                          {k.replace(/([A-Z])/g, ' $1')}:
                        </span>{' '}
                        {v}
                      </li>
                    ))}
                </ul>
              </section>

              <section className="md:border-l md:pl-4">
                <h3 className="font-medium mb-2">Envío compartido</h3>
                {producto.envioGrupoId ? (
                  <>
                    <p className="text-sm text-gray-700">En grupo con {vinculados.length} producto(s)</p>
                    {vinculados.length > 0 ? (
                      <ul className="list-disc list-inside text-gray-700 space-y-2 mt-2">
                        {vinculados.map((v) => {
                          const d = v.detalle || {};
                          const accesorios = Array.isArray(v.accesorios) ? v.accesorios.join(', ') : 'N/A';
                          const specs = [d.gama, d.procesador, d.tamano, d.almacenamiento, d.ram, d.conexion]
                            .filter(Boolean)
                            .join(' · ');
                          return (
                            <li key={v.id}>
                              <div className="text-sm font-medium">#{v.id} · {v.tipo}</div>
                              <div className="text-xs text-gray-600">{specs || 'Sin especificaciones'}</div>
                              <div className="text-xs text-gray-600">Accesorios: {accesorios || 'N/A'}</div>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-500 mt-1">Solo este producto está en el grupo.</p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-gray-500">Sin grupo de envío.</p>
                )}
              </section>
            </div>

            <div className="flex justify-end space-x-2">
              <button
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                onClick={() => setIsEditing(true)}
              >
                Editar
              </button>
              <button
                className="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400"
                onClick={onClose}
              >
                Cerrar
              </button>
            </div>
          </>
        ) : (
          <>
            {/* --- Vista edición --- */}
            <h2 className="text-2xl font-semibold mb-4">Editar Producto</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Columna 1: tipo, detalle, estado, accesorios */}
              <div className="space-y-4">
                <div>
                  <label className="block font-medium">Tipo</label>
                  <select
                    className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={form.tipo}
                    onChange={e => handleMainChange('tipo', e.target.value)}
                  >
                    <option value="">Selecciona</option>
                    <option value="macbook">Macbook</option>
                    <option value="ipad">iPad</option>
                    <option value="iphone">iPhone</option>
                    <option value="watch">Apple Watch</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>

                {form.tipo === 'macbook' && (
                  <FormProductoMacbook detalle={form.detalle} onChange={handleDetalleChange} />
                )}
                {form.tipo === 'ipad' && (
                  <FormProductoIpad detalle={form.detalle} onChange={handleDetalleChange} />
                )}
                {form.tipo === 'iphone' && (
                  <FormProductoIphone detalle={form.detalle} onChange={handleDetalleChange} />
                )}
                {form.tipo === 'watch' && (
                  <FormProductoWatch detalle={form.detalle} onChange={handleDetalleChange} />
                )}
                {form.tipo === 'otro' && (
                  <FormProductoOtro onChange={v => handleDetalleChange('descripcionOtro', v)} />
                )}

                <div>
                  <label className="block font-medium">Estado</label>
                  <select
                    className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={form.estado}
                    onChange={e => handleMainChange('estado', e.target.value)}
                  >
                    <option value="">Selecciona</option>
                    <option value="nuevo">Nuevo</option>
                    <option value="usado">Usado</option>
                    <option value="roto">Roto</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium mb-1">Accesorios</label>
                  {(() => {
                    const isNuevo = String(form.estado || '').toLowerCase() === 'nuevo';
                    const todos = Array.isArray(form.accesorios) && form.accesorios.includes('Todos');
                    const disabledGroup = isNuevo || todos;
                    return (
                      <div className={`grid grid-cols-2 sm:grid-cols-4 gap-2 ${disabledGroup ? 'opacity-60' : ''}`}>
                        {['Caja','Cubo','Cable','Todos'].map(opt => (
                          <label key={opt} className={`flex items-center gap-2 border rounded px-3 py-2 cursor-pointer ${isNuevo ? 'pointer-events-none' : ''}`}>
                            <input
                              type="checkbox"
                              className="accent-indigo-600"
                              checked={isNuevo ? true : (opt==='Todos' ? todos : (todos ? true : (form.accesorios||[]).includes(opt)))}
                              disabled={opt!=='Todos' && (isNuevo || todos)}
                              onChange={e => {
                                const checked = e.target.checked;
                                setForm(f => {
                                  let next = Array.isArray(f.accesorios) ? [...f.accesorios] : [];
                                  if (opt==='Todos') {
                                    // toggle 'Todos' únicamente; el resto se muestra marcado visualmente
                                    return { ...f, accesorios: checked ? Array.from(new Set([...next,'Todos'])) : next.filter(x=>x!=='Todos') };
                                  }
                                  if (checked) next = Array.from(new Set([...next, opt])); else next = next.filter(x=>x!==opt);
                                  return { ...f, accesorios: next };
                                });
                              }}
                            />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    );
                  })()}
                  {String(form.estado || '').toLowerCase() === 'nuevo' && (
                    <p className="text-sm text-gray-500 mt-1">Estado "Nuevo" fuerza Todos (Caja, Cubo y Cable).</p>
                  )}
                </div>
              </div>

              {/* Columna 2: Vinculación */}
              <div className="space-y-4">
                <div className="border rounded-lg p-3 bg-gray-50/70 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="font-medium">Vincular envío (mismo casillero)</span>
                      {producto?.envioGrupoId && (
                        <span className="text-xs text-gray-600">Grupo: {producto.envioGrupoId}</span>
                      )}
                      {vinculados.length > 0 && (
                        <span className="text-xs text-gray-600">
                          Vinculado con: {vinculados.map((v) => `#${v.id}`).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="px-3 py-2 rounded border text-sm bg-white hover:bg-gray-100"
                      onClick={async () => {
                        if (!linkerOpen) {
                          try {
                            setLoadingLinker(true);
                            const res = await api.get('/productos');
                            const data = res?.data || res || [];
                            const allowed = new Set(['comprado_sin_tracking','comprado_en_camino','en_eshopex']);
                            const casActual = getCasilleroActual();
                            const filtered = (Array.isArray(data) ? data : []).filter((p) => {
                              if (!allowed.has(getLastTrackingEstado(p))) return false;
                              const casP = Array.isArray(p?.tracking) && p.tracking[0]?.casillero ? p.tracking[0].casillero : '';
                              if (casActual && casP && casActual !== casP) return false;
                              if (p.id === producto.id) return false;
                              return true;
                            });
                            setLinkables(filtered);
                          } catch (err) {
                            console.error('No se pudieron cargar productos para vincular', err);
                            alert('No se pudieron cargar productos elegibles para vincular.');
                          } finally {
                            setLoadingLinker(false);
                          }
                        }
                        setLinkerOpen((v) => !v);
                      }}
                    >
                      {linkerOpen ? 'Cerrar lista' : (producto?.envioGrupoId ? 'Agregar vinculo' : 'Vincular producto')}
                    </button>
                    {producto?.envioGrupoId && (
                      <button
                        type="button"
                        className="px-3 py-2 rounded border text-sm bg-white hover:bg-gray-100 text-red-600 border-red-200"
                        onClick={() => {
                          setDesvincularEnvio(true);
                          setVincularConList([]);
                          setPendingLinkIds([]);
                          setUnlinkTargets(vinculados.map((v) => v.id));
                          setLinkerOpen(false);
                        }}
                      >
                        Desvincular
                      </button>
                    )}
                    {Array.isArray(vincularConList) && vincularConList.length > 0 && !desvincularEnvio && (
                      <div className="flex flex-wrap gap-1">
                        {vincularConList.map((id) => (
                          <span key={id} className="text-xs bg-indigo-50 border border-indigo-200 text-indigo-700 px-2 py-1 rounded">
                            Seleccionado: #{id}
                          </span>
                        ))}
                      </div>
                    )}
                    {desvincularEnvio && (
                      <span className="text-sm text-amber-600">Se desvinculará al guardar.</span>
                    )}
                  </div>
                  {desvincularEnvio && vinculados.length > 0 && (
                    <div className="mt-2 space-y-2">
                      <p className="text-xs text-gray-600">Productos vinculados (X para marcar desvincular al guardar):</p>
                      <div className="flex flex-wrap gap-2">
                        {vinculados.map((v) => {
                          const marked = unlinkTargets.includes(v.id);
                          return (
                            <button
                              key={`unlink-${v.id}`}
                              type="button"
                              className={`flex items-center gap-1 px-3 py-1.5 rounded border text-xs ${marked ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white border-gray-200 text-gray-700'}`}
                              onClick={() => {
                                setUnlinkTargets((prev) =>
                                  prev.includes(v.id) ? prev.filter((id) => id !== v.id) : [...prev, v.id]
                                );
                              }}
                            >
                              <span>#{v.id} ú {v.tipo}</span>
                              <span className="text-lg leading-none">×</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {linkerOpen && (
                    <div className="mt-2 border rounded bg-white p-2 space-y-2 max-h-56 overflow-auto">
                      {loadingLinker && <div className="text-sm text-gray-500">Cargando opciones…</div>}
                      {!loadingLinker && linkables.length === 0 && (
                        <div className="text-sm text-gray-500">No hay productos elegibles.</div>
                      )}
                      {!loadingLinker && linkables.map((p) => {
                        const d = p.detalle || {};
                        const checked = pendingLinkIds.includes(p.id);
                        const locked = producto?.envioGrupoId ? (p.envioGrupoId && p.envioGrupoId !== producto.envioGrupoId) : false;
                        const inCurrentGroup = producto?.envioGrupoId && p.envioGrupoId === producto.envioGrupoId;
                        const disabled = locked || inCurrentGroup;
                        return (
                          <label
                            key={`link-${p.id}`}
                            className={`flex flex-col gap-0.5 border rounded p-2 cursor-pointer ${checked ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-200'} ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''}`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="font-medium text-sm">#{p.id} · {p.tipo}</div>
                              <input
                                type="checkbox"
                                name="link-product"
                                checked={checked}
                                disabled={disabled}
                                onChange={() => {
                                  if (disabled) return;
                                  setPendingLinkIds((prev) =>
                                    prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                                  );
                                }}
                              />
                            </div>
                            <div className="text-xs text-gray-600">
                              {[d.gama, d.procesador, d.tamano, p.estado].filter(Boolean).join(' · ')}
                            </div>
                            <div className="text-xs text-gray-500">
                              Casillero: {p.tracking?.[0]?.casillero || 'N/A'} · Tracking: {getLastTrackingEstado(p) || 'N/A'}
                              {inCurrentGroup && <span className="ml-1 text-gray-600">(Vinculado actual)</span>}{locked && <span className="ml-1 text-amber-600">(Ya en grupo)</span>}
                            </div>
                          </label>
                        );
                      })}
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="px-3 py-1.5 rounded border text-sm bg-white hover:bg-gray-100"
                          onClick={() => { setLinkerOpen(false); setPendingLinkIds([]); }}
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          className="px-3 py-1.5 rounded text-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                          disabled={!pendingLinkIds.length}
                          onClick={() => {
                            setVincularConList(pendingLinkIds);
                            setDesvincularEnvio(false);
                            setLinkerOpen(false);
                          }}
                        >
                          Aceptar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="text-right mt-6 space-x-2">
              <button
                className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
                onClick={handleSave}
              >
                Guardar cambios
              </button>
              <button
                className="bg-gray-300 text-gray-800 px-6 py-2 rounded hover:bg-gray-400"
                onClick={() => setIsEditing(false)}
              >
                Cancelar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}


