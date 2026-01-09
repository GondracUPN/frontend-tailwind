// src/components/ModalProducto.js
import React, { useState, useEffect, useRef } from 'react';
import FormProductoMacbook from './formParts/FormProductoMacbook';
import FormProductoIpad from './formParts/FormProductoIpad';
import FormProductoIphone from './formParts/FormProductoIphone';
import FormProductoWatch from './formParts/FormProductoWatch';
import FormProductoOtro from './formParts/FormProductoOtro';
import api from '../api';

export default function ModalProducto({ producto, onClose, onSaved }) {
  const isEdit = Boolean(producto);
  const [saving, setSaving] = useState(false);
  const mountedRef = useRef(true);
  const [linkerOpen, setLinkerOpen] = useState(false);
  const [loadingLinker, setLoadingLinker] = useState(false);
  const [linkables, setLinkables] = useState([]);
  const [pendingLinkIds, setPendingLinkIds] = useState([]);
  const [vincularConList, setVincularConList] = useState([]);
  const [desvincularEnvio, setDesvincularEnvio] = useState(false);
  const [currentGroup, setCurrentGroup] = useState([]);

  const [form, setForm] = useState({
    tipo: '',
    estado: '',
    accesorios: [],
    casillero: '',
    detalle: {
      gama: '', procesador: '', generacion: '',
      modelo: '', tamano: '',
      almacenamiento: '', ram: '',
      conexion: '', descripcionOtro: '',
    },
    valor: {
      valorProducto: '', valorDec: '',
      peso: '', fechaCompra: '',
    },
  });

  const getLastTrackingEstado = (p) => {
    const trk = Array.isArray(p?.tracking) ? [...p.tracking] : [];
    if (!trk.length) return '';
    trk.sort((a, b) => {
      if (a.createdAt && b.createdAt) return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return (b.id || 0) - (a.id || 0);
    });
    return String(trk[0]?.estado || '').toLowerCase();
  };

  const getCasilleroActual = () => {
    if (form.casillero) return form.casillero;
    const trk = Array.isArray(producto?.tracking) ? [...producto.tracking] : [];
    if (!trk.length) return '';
    trk.sort((a, b) => {
      if (a.createdAt && b.createdAt) return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return (b.id || 0) - (a.id || 0);
    });
    return trk[0]?.casillero || '';
  };

  useEffect(() => {
    if (!isEdit) return;
    const detalle = { ...(producto.detalle || {}) };
    if (detalle.tamano && !detalle.tamano) {
      detalle.tamano = detalle.tamano;
    }
    if (detalle.tamanio && !detalle.tamano) {
      detalle.tamano = detalle.tamanio;
      delete detalle.tamanio;
    }
    setForm({
      tipo: producto.tipo || '',
      estado: producto.estado || '',
      accesorios: Array.isArray(producto.accesorios) ? producto.accesorios : [],
      casillero: producto.tracking?.[0]?.casillero || '',
      detalle,
      valor: {
        valorProducto: producto.valor?.valorProducto || '',
        valorDec: producto.valor?.valorDec || '',
        peso: producto.valor?.peso || '',
        fechaCompra: producto.valor?.fechaCompra || '',
      },
    });
    setVincularConList([]);
    setPendingLinkIds([]);
    setDesvincularEnvio(false);
    setLinkerOpen(false);
  }, [isEdit, producto]);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!producto?.envioGrupoId) {
      setCurrentGroup([]);
      return;
    }
    api.get('/productos').then((res) => {
      const data = res?.data || res || [];
      const group = (Array.isArray(data) ? data : []).filter(
        (p) => p.envioGrupoId && p.envioGrupoId === producto.envioGrupoId && p.id !== producto.id
      );
      setCurrentGroup(group);
    }).catch(() => {});
  }, [producto?.envioGrupoId, producto?.id]);

  const onChange = (section, field, value) => {
    if (section === 'main') {
      setForm((f) => ({ ...f, [field]: value }));
    } else {
      setForm((f) => ({ ...f, [section]: { ...f[section], [field]: value } }));
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (saving) return;
    setSaving(true);

    const url = isEdit ? `/productos/${producto.id}` : '/productos';
    const method = isEdit ? 'patch' : 'post';

    let accesorios = Array.isArray(form.accesorios) ? [...form.accesorios] : [];
    const hasTodos = accesorios.includes('Todos');
    const isNuevo = String(form.estado || '').toLowerCase() === 'nuevo';
    if (hasTodos || isNuevo) accesorios = ['Caja', 'Cubo', 'Cable'];

    const base = { tipo: form.tipo, estado: form.estado, accesorios };
    const allowedDetalle = ['gama', 'procesador', 'generacion', 'numero', 'modelo', 'tamano', 'almacenamiento', 'ram', 'conexion', 'descripcionOtro'];
    const cleanDetalle = Object.fromEntries(
      Object.entries(form.detalle || {}).filter(([k]) => allowedDetalle.includes(k))
    );

    const payload = { ...base, detalle: cleanDetalle, valor: form.valor };
    const primaryLink = Array.isArray(vincularConList) ? vincularConList[0] : null;
    if (primaryLink) payload.vincularCon = Number(primaryLink);
    if (desvincularEnvio) payload.desvincularEnvio = true;

    if (!isEdit) onClose();

    try {
      const res = await api[method](url, payload);
      const saved = res?.data ?? res;

      const extras = Array.isArray(vincularConList) ? vincularConList.slice(1) : [];
      if (saved?.id && extras.length) {
        const ops = extras.map((id) => api.patch(`/productos/${id}`, { vincularCon: saved.id }).catch(() => {}));
        await Promise.allSettled(ops);
      }

      if (form.casillero) {
        const optimisticTracking = { casillero: form.casillero, estado: 'comprado_sin_tracking' };
        onSaved(saved, optimisticTracking);
        api.put(`/tracking/producto/${saved.id}`, {
          casillero: form.casillero,
          estado: 'comprado_sin_tracking',
        }).then((trk) => {
          if (trk) onSaved(saved, trk);
        }).catch((err) => console.error('Error al asignar casillero:', err));
      } else {
        onSaved(saved);
      }

      if (isEdit) onClose();
    } catch (err) {
      console.error('Error al guardar:', err);
      alert('No se pudo guardar el producto.');
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white w-full sm:max-w-5xl rounded-xl shadow-lg p-6 relative mx-4 max-h-[90vh] overflow-y-auto">
        <button
          className={`absolute top-3 right-3 w-10 h-10 flex items-center justify-center text-2xl font-bold rounded-full hover:bg-gray-100 ${
            saving ? 'opacity-50 cursor-not-allowed text-gray-400' : 'text-gray-600 hover:text-gray-900'
          }`}
          onClick={saving ? undefined : onClose}
          disabled={saving}
          aria-disabled={saving}
          aria-label="Cerrar"
        >
          ×
        </button>

        <h2 className="text-2xl font-semibold mb-4">
          {isEdit ? 'Editar Producto' : 'Agregar Producto'}
        </h2>

        <form onSubmit={handleSubmit}>
          <fieldset disabled={saving} className={saving ? 'opacity-60 pointer-events-none' : ''}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block font-medium">Tipo de Producto</label>
                  <select
                    className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={form.tipo}
                    onChange={e => onChange('main', 'tipo', e.target.value)}
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
                  <FormProductoMacbook
                    detalle={form.detalle}
                    onChange={(f, v) => onChange('detalle', f, v)}
                  />
                )}
                {form.tipo === 'ipad' && (
                  <FormProductoIpad
                    detalle={form.detalle}
                    onChange={(f, v) => onChange('detalle', f, v)}
                  />
                )}
                {form.tipo === 'iphone' && (
                  <FormProductoIphone
                    detalle={form.detalle}
                    onChange={(f, v) => onChange('detalle', f, v)}
                  />
                )}
                {form.tipo === 'watch' && (
                  <FormProductoWatch
                    detalle={form.detalle}
                    onChange={(f, v) => onChange('detalle', f, v)}
                  />
                )}
                {form.tipo === 'otro' && (
                  <FormProductoOtro
                    value={form.detalle?.descripcionOtro || ''}
                    onChange={v => onChange('detalle', 'descripcionOtro', v)}
                  />
                )}

                <div>
                  <label className="block font-medium">Estado</label>
                  <select
                    className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={form.estado}
                    onChange={e => onChange('main', 'estado', e.target.value)}
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
                        {['Caja', 'Cubo', 'Cable', 'Todos'].map(opt => (
                          <label key={opt} className={`flex items-center gap-2 border rounded px-3 py-2 cursor-pointer ${isNuevo ? 'pointer-events-none' : ''}`}>
                            <input
                              type="checkbox"
                              className="accent-indigo-600"
                              checked={isNuevo ? true : (opt === 'Todos' ? todos : (todos ? true : (form.accesorios || []).includes(opt)))}
                              disabled={opt !== 'Todos' && (isNuevo || todos)}
                              onChange={e => {
                                const checked = e.target.checked;
                                setForm(f => {
                                  let next = Array.isArray(f.accesorios) ? [...f.accesorios] : [];
                                  if (opt === 'Todos') {
                                    return { ...f, accesorios: checked ? Array.from(new Set([...next, 'Todos'])) : next.filter(x => x !== 'Todos') };
                                  }
                                  if (checked) next = Array.from(new Set([...next, opt])); else next = next.filter(x => x !== opt);
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

                <div>
                  <label className="block font-medium">Casillero</label>
                  <select
                    className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={form.casillero}
                    onChange={e => onChange('main', 'casillero', e.target.value)}
                  >
                    <option value="">Selecciona</option>
                    <option value="Walter">Walter</option>
                    <option value="Renato">Renato</option>
                    <option value="Christian">Christian</option>
                    <option value="Alex">Alex</option>
                    <option value="MamaRen">MamaRen</option>
                    <option value="Jorge">Jorge</option>
                    <option value="Kenny">Kenny</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                {['valorProducto', 'valorDec', 'peso', 'fechaCompra'].map(field => (
                  <div key={field}>
                    <label className="block font-medium mb-1">
                      {{
                        valorProducto: 'Valor Producto ($)',
                        valorDec: 'Valor DEC ($)',
                        peso: 'Peso (kg)',
                        fechaCompra: 'Fecha de Compra'
                      }[field]}
                    </label>
                    <input
                      type={field === 'fechaCompra' ? 'date' : 'number'}
                      className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={form.valor[field]}
                      onChange={e => onChange('valor', field, e.target.value)}
                    />
                  </div>
                ))}

                <div className="border rounded-lg p-3 space-y-3 bg-gray-50/60">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-gray-900">Vincular envio</span>
                      {producto?.envioGrupoId && (
                        <span className="text-xs text-gray-600">Grupo: {producto.envioGrupoId}</span>
                      )}
                    </div>
                  </div>
                  {producto?.envioGrupoId && !linkerOpen && !desvincularEnvio && (
                    <p className="text-sm text-gray-600">Este producto ya esta vinculado. Usa "Agregar vinculo" solo si necesitas moverlo o desvincular.</p>
                  )}
                  <div className="flex flex-wrap gap-3 items-center">
                    <button
                      type="button"
                      className="px-4 py-2 rounded-md border text-sm bg-white hover:bg-gray-100 shadow-sm"
                      onClick={async () => {
                        if (!linkerOpen) {
                          try {
                            setLoadingLinker(true);
                            const res = await api.get('/productos');
                            const data = res?.data || res || [];
                            const allowed = new Set(['comprado_sin_tracking', 'comprado_en_camino', 'en_eshopex']);
                            const casActual = getCasilleroActual();
                            const filtered = (Array.isArray(data) ? data : []).filter((p) => {
                              if (!allowed.has(getLastTrackingEstado(p))) return false;
                              const casP = Array.isArray(p?.tracking) && p.tracking[0]?.casillero ? p.tracking[0].casillero : '';
                              if (casActual && casP && casActual !== casP) return false;
                              if (isEdit && p.id === producto.id) return false;
                              return true;
                            });
                            setLinkables(filtered);
                            if (producto?.envioGrupoId) {
                              setCurrentGroup(filtered.filter((p) => p.envioGrupoId === producto.envioGrupoId));
                            }
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
                        className="px-4 py-2 rounded-md border text-sm bg-white hover:bg-gray-100 text-red-600 border-red-200 shadow-sm"
                        onClick={() => {
                          setDesvincularEnvio(true);
                          setVincularConList([]);
                          setPendingLinkIds([]);
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
                      <span className="text-sm text-amber-600">Se desvinculara al guardar.</span>
                    )}
                  </div>

                  {linkerOpen && (
                    <div className="mt-3 border border-gray-200 rounded-xl bg-white p-3 space-y-3 max-h-56 overflow-auto shadow-sm">
                      {loadingLinker && <div className="text-sm text-gray-500">Cargando opciones...</div>}
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
                            className={`flex flex-col gap-1 border rounded-lg p-3 cursor-pointer transition shadow-sm ${checked ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-200'} ${disabled ? 'opacity-60 cursor-not-allowed bg-gray-50' : ''}`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="font-medium text-sm text-gray-900">#{p.id} — {p.tipo}</div>
                              <input
                                type="checkbox"
                                name="link-product"
                                className="h-4 w-4"
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
                            <div className="text-xs text-gray-700">
                              {[d.gama, d.procesador, d.tamano, p.estado].filter(Boolean).join(' — ')}
                            </div>
                            <div className="text-xs text-gray-600">
                              Casillero: {p.tracking?.[0]?.casillero || 'N/A'} — Tracking: {getLastTrackingEstado(p) || 'N/A'}
                              {inCurrentGroup && <span className="ml-1 text-gray-600">(Vinculado actual)</span>}
                              {locked && <span className="ml-1 text-amber-600">(Ya en grupo)</span>}
                            </div>
                          </label>
                        );
                      })}
                      <div className="flex justify-end gap-3 pt-1">
                        <button
                          type="button"
                          className="px-3 py-1.5 rounded-md border text-sm bg-white hover:bg-gray-100"
                          onClick={() => { setLinkerOpen(false); setPendingLinkIds([]); }}
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          className="px-4 py-1.5 rounded-md text-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
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
          </fieldset>

          <div className="text-right mt-6">
            <button
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              type="submit"
              disabled={saving}
              aria-busy={saving}
            >
              {saving ? 'Guardando...' : (isEdit ? 'Guardar cambios' : 'Guardar')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

