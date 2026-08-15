import React, { useEffect, useState } from 'react';
import api from '../api';
import { createExpenseWithDuplicateCheck, ExpenseDuplicateCancelledError } from '../utils/createExpense';
import { notifyGastosChanged } from '../utils/gastosSync';

const normalizeSeller = (value) =>
  value == null ? '' : String(value).trim().toLowerCase();

const formatSeller = (value) => {
  const slug = normalizeSeller(value);
  if (slug === 'gonzalo') return 'Gonzalo';
  if (slug === 'renato') return 'Renato';
  if (slug === 'ambos') return 'Ambos';
  const pedidoMatch = String(value || '').trim().match(/^gonzalo\s*\(([^)]+)\)$/i);
  if (pedidoMatch?.[1]) return `Gonzalo (${pedidoMatch[1].trim()})`;
  return '';
};

const PEDIDO_CLIENTS = ['Jorge', 'Rodrigo', 'Miguel', 'Carlos', 'Kenny', 'Sebastian', 'Williams'];
const titleCaseName = (value) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : ''))
    .join(' ');
const pedidoSeller = (client) => {
  const name = titleCaseName(client);
  return name ? `Gonzalo (${name})` : '';
};
const pedidoClientFromSeller = (seller) => {
  const match = String(seller || '').trim().match(/^gonzalo\s*\(([^)]+)\)$/i);
  return match?.[1] ? match[1].trim() : '';
};

const saleExpenseOwner = (seller) => {
  const value = String(seller || '').trim().toLowerCase();
  if (value === 'renato') return 'renato';
  if (value === 'gonzalo' || value.startsWith('gonzalo (')) return 'gonzalo';
  return '';
};

const saleIncomeReference = (productId, saleId, accessory = false) =>
  accessory && saleId ? `__SALE_INCOME__:${productId}:${saleId}` : `__SALE_INCOME__:${productId}`;
const isSaleIncomeForProduct = (row, productId) => {
  const notes = String(row?.notas || '').trim();
  return String(row?.concepto || '').trim().toLowerCase() === 'ingreso'
    && String(row?.metodoPago || '').trim().toLowerCase() === 'debito'
    && (notes === saleIncomeReference(productId) || notes === String(productId));
};

export default function ModalVenta({
  producto,
  venta,
  onClose,
  onSaved,
  allowVendedorOnCreate = false,
  presetVendedor = '',
  embedded = false,
}) {
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [incomeBank, setIncomeBank] = useState('bcp');
  const [accessorySummary, setAccessorySummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [form, setForm] = useState({
    tipoCambio: '',
    tipoCambioGonzalo: '',
    tipoCambioRenato: '',
    fechaVenta: '',
    precioVenta: '',
    vendedor: '',
    pedidoCliente: '',
    cantidad: '1',
    modalidad: 'unidad',
  });

  const sellerSlug = normalizeSeller(
    form.vendedor || venta?.vendedor || producto?.vendedor || presetVendedor || '',
  );
  const sellerLabel = formatSeller(form.vendedor || venta?.vendedor || producto?.vendedor || presetVendedor) || 'Sin vendedor asignado';
  const isReadOnly = Boolean(venta) && !editMode;
  const isSplitVenta = Boolean(
    venta &&
      (sellerSlug === 'ambos' ||
        venta?.tipoCambioGonzalo != null ||
        venta?.tipoCambioRenato != null),
  );
  const isSplitCreate = !venta && sellerSlug === 'ambos';
  const splitModeActive = venta ? isSplitVenta : isSplitCreate;
  const isAccessory = String(producto?.tipo || '').toLowerCase() === 'accesorios';
  const accessoryCreate = !venta && isAccessory;

  useEffect(() => {
    const initialSeller = venta?.vendedor || presetVendedor || producto?.vendedor || '';
    if (venta) {
      setForm({
        tipoCambio: venta.tipoCambio != null ? String(venta.tipoCambio) : '',
        tipoCambioGonzalo:
          venta.tipoCambioGonzalo != null ? String(venta.tipoCambioGonzalo) : '',
        tipoCambioRenato:
          venta.tipoCambioRenato != null ? String(venta.tipoCambioRenato) : '',
        fechaVenta: venta.fechaVenta ?? '',
        precioVenta: venta.precioVenta != null ? String(venta.precioVenta) : '',
        vendedor: initialSeller,
        pedidoCliente: pedidoClientFromSeller(initialSeller),
        cantidad: String(venta.cantidad || 1),
        modalidad: venta.modalidad || 'unidad',
      });
      return;
    }

    setForm({
      tipoCambio: '',
      tipoCambioGonzalo: '',
      tipoCambioRenato: '',
      fechaVenta: '',
      precioVenta: '',
      vendedor: initialSeller,
      pedidoCliente: pedidoClientFromSeller(initialSeller),
      cantidad: '1',
      modalidad: 'unidad',
    });
  }, [venta, producto?.id, producto?.vendedor, presetVendedor, allowVendedorOnCreate]);

  useEffect(() => {
    setEditMode(false);
  }, [producto?.id, venta?.id, venta]);

  useEffect(() => {
    if (!accessoryCreate || !producto?.id) {
      setAccessorySummary(null);
      return;
    }
    let active = true;
    setSummaryLoading(true);
    Promise.resolve(api.get(`/ventas/accesorio-resumen?productoId=${producto.id}`))
      .then((data) => { if (active) setAccessorySummary(data || null); })
      .catch(() => { if (active) setAccessorySummary(null); })
      .finally(() => { if (active) setSummaryLoading(false); });
    return () => { active = false; };
  }, [accessoryCreate, producto?.id]);

  if (!producto) return null;

  const onChange = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));
  const onSellerChange = (value) => {
    setForm((prev) => ({
      ...prev,
      vendedor: value,
      pedidoCliente: pedidoClientFromSeller(value),
    }));
  };
  const onPedidoClientChange = (value) => {
    setForm((prev) => ({
      ...prev,
      pedidoCliente: value,
      vendedor: value.trim() ? pedidoSeller(value) : '',
    }));
  };

  const validate = () => {
    if (String(producto?.tipo).toLowerCase() === 'accesorios') {
      const quantity = Number(form.cantidad);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > Number(producto.stockActual || 0)) {
        alert(`Ingresa una cantidad entre 1 y ${producto.stockActual || 0}.`);
        return false;
      }
    }
    if (splitModeActive) {
      if (
        !form.fechaVenta ||
        !form.precioVenta ||
        !form.tipoCambioGonzalo ||
        !form.tipoCambioRenato
      ) {
        alert('Completa Fecha de venta, Precio de venta y tipo de cambio para ambos.');
        return false;
      }
      return true;
    }
    if (!form.tipoCambio || !form.fechaVenta || !form.precioVenta) {
      alert('Completa Tipo de cambio, Fecha de venta y Precio de venta.');
      return false;
    }
    return true;
  };

  const resolveSaleUser = async (owner) => {
    if (!owner) return null;
    let currentUser = null;
    try {
      currentUser = JSON.parse(localStorage.getItem('user') || 'null');
    } catch {}
    const normalizeAuthUser = (candidate) => {
      if (!candidate) return null;
      const id = candidate.id ?? candidate.userId ?? candidate.sub;
      return id ? { ...candidate, id } : candidate;
    };
    currentUser = normalizeAuthUser(currentUser);

    if (!currentUser?.id || !currentUser?.role) {
      try {
        currentUser = normalizeAuthUser(await api.get('/auth/me'));
      } catch {}
    }

    let users = [];
    if (currentUser?.role === 'admin') {
      const response = await api.get('/auth/users');
      users = Array.isArray(response) ? response.map(normalizeAuthUser) : [];
    } else if (currentUser) {
      users = [currentUser];
    }
    const ownerAccount = users.find((candidate) => {
      const username = String(candidate?.username || '').trim().toLowerCase();
      return owner === 'gonzalo' ? username.includes('gonzalo') : username.includes('renato');
    });
    if (ownerAccount) return ownerAccount;

    // En esta instalación la cuenta Admin representa los gastos de Gonzalo.
    if (owner === 'gonzalo') {
      if (currentUser?.role === 'admin' && currentUser?.id) return currentUser;
      return users.find((candidate) => candidate?.role === 'admin') || null;
    }
    return null;
  };

  const getSaleIncomeRows = async (targetUserId) => {
    let currentUser = null;
    try {
      currentUser = JSON.parse(localStorage.getItem('user') || 'null');
    } catch {}
    const path = currentUser?.role === 'admin'
      ? `/gastos/all?userId=${encodeURIComponent(String(targetUserId))}`
      : '/gastos';
    const rows = await api.get(path);
    return Array.isArray(rows) ? rows : [];
  };

  const registerSaleIncome = async (savedVenta) => {
    const resolvedSeller = savedVenta?.vendedor || form.vendedor || producto?.vendedor || presetVendedor;
    const owner = saleExpenseOwner(resolvedSeller);
    if (!owner) return;

    const target = await resolveSaleUser(owner);
    if (!target?.id) throw new Error(`No se encontró el usuario ${owner}.`);

    const payload = {
      concepto: 'ingreso',
      metodoPago: 'debito',
      moneda: 'PEN',
      monto: Number(savedVenta?.precioVenta ?? form.precioVenta),
      fecha: savedVenta?.fechaVenta || form.fechaVenta,
      tarjeta: incomeBank,
      notas: saleIncomeReference(producto.id, savedVenta?.id, String(producto?.tipo).toLowerCase() === 'accesorios'),
    };

    // La venta puede reintentarse o existir desde el flujo anterior, que usaba
    // solamente el ID del producto en notas. En ese caso actualizamos el ingreso
    // encontrado en vez de intentar crear un duplicado y mostrar un error falso.
    const rows = await getSaleIncomeRows(target.id);
    const linkedIncome = rows.find((row) => isSaleIncomeForProduct(row, producto.id));
    if (linkedIncome?.id) {
      await api.patch(`/gastos/${linkedIncome.id}`, payload);
    } else {
      await createExpenseWithDuplicateCheck(payload, { userId: target.id });
    }
    try {
      localStorage.removeItem(`gastos-panel-cache:${target.id}`);
    } catch {}
  };

  const syncSaleIncomeAfterEdit = async (updatedVenta) => {
    const previousOwner = saleExpenseOwner(venta?.vendedor || producto?.vendedor || presetVendedor);
    const nextOwner = saleExpenseOwner(updatedVenta?.vendedor || form.vendedor || producto?.vendedor || presetVendedor);
    if (!previousOwner || !nextOwner) return;

    const previousUser = await resolveSaleUser(previousOwner);
    const nextUser = previousOwner === nextOwner ? previousUser : await resolveSaleUser(nextOwner);
    if (!previousUser?.id || !nextUser?.id) {
      throw new Error('No se encontró el propietario del ingreso asociado.');
    }

    let currentUser = null;
    try {
      currentUser = JSON.parse(localStorage.getItem('user') || 'null');
    } catch {}
    const rowsPath = currentUser?.role === 'admin'
      ? `/gastos/all?userId=${encodeURIComponent(String(previousUser.id))}`
      : '/gastos';
    const rows = await api.get(rowsPath);
    const linkedIncome = (Array.isArray(rows) ? rows : []).find((row) => (
      isSaleIncomeForProduct(row, producto.id)
    ));
    // Las ventas antiguas o registradas manualmente pueden no tener ingreso vinculado.
    if (!linkedIncome?.id) return;

    const payload = {
      concepto: 'ingreso',
      metodoPago: 'debito',
      moneda: 'PEN',
      monto: Number(updatedVenta?.precioVenta ?? form.precioVenta),
      fecha: updatedVenta?.fechaVenta || form.fechaVenta,
      tarjeta: linkedIncome.tarjeta || incomeBank,
      notas: saleIncomeReference(producto.id),
    };

    if (String(previousUser.id) === String(nextUser.id)) {
      await api.patch(`/gastos/${linkedIncome.id}`, payload);
    } else {
      // Crear primero evita perder el ingreso si falla el traslado de propietario.
      await createExpenseWithDuplicateCheck(payload, { userId: nextUser.id });
      await api.del(`/gastos/${linkedIncome.id}`);
    }

    try {
      localStorage.removeItem(`gastos-panel-cache:${previousUser.id}`);
      localStorage.removeItem(`gastos-panel-cache:${nextUser.id}`);
    } catch {}
  };

  const handleSaveCreate = async () => {
    if (saving || !validate()) return;

    setSaving(true);
    try {
      const body = {
        productoId: producto.id,
        fechaVenta: form.fechaVenta,
        precioVenta: Number(form.precioVenta),
        incomeBank,
      };
      if (isAccessory) {
        const cantidad = Number(form.cantidad);
        body.cantidad = cantidad;
        body.modalidad = cantidad > 1 ? 'mayor' : 'unidad';
      }

      if (splitModeActive) {
        const tcG = Number(form.tipoCambioGonzalo);
        const tcR = Number(form.tipoCambioRenato);
        const avg = (tcG + tcR) / 2;
        body.tipoCambio = Number(avg.toFixed(4));
        body.tipoCambioGonzalo = tcG;
        body.tipoCambioRenato = tcR;
        body.vendedor = 'ambos';
      } else {
        body.tipoCambio = Number(form.tipoCambio);
        if (form.vendedor?.trim()) body.vendedor = form.vendedor.trim();
      }

      const saved = await api.post('/ventas', body);
      if (localStorage.getItem('token')) {
        try {
          await registerSaleIncome(saved);
        } catch (incomeError) {
          if (!(incomeError instanceof ExpenseDuplicateCancelledError)) {
            console.error('[ModalVenta] Respaldo de ingreso no disponible:', incomeError);
          }
        }
      }
      notifyGastosChanged({ action: 'sale-income', ventaId: saved?.id, seller: saved?.vendedor || body.vendedor });
      onSaved?.(saved);
      onClose?.();
    } catch (e) {
      console.error('[ModalVenta] Error al guardar venta:', e);
      // Si se perdio la respuesta despues de guardar, confirmar antes de pedir repetir.
      if (String(producto?.tipo).toLowerCase() !== 'accesorios') try {
        const ventas = await api.get(`/ventas/producto/${producto.id}`);
        const existing = Array.isArray(ventas) ? ventas[0] : null;
        if (existing) {
          if (localStorage.getItem('token')) {
            try {
              await registerSaleIncome(existing);
            } catch (incomeError) {
              if (!(incomeError instanceof ExpenseDuplicateCancelledError)) {
                console.error('[ModalVenta] Respaldo de ingreso no disponible:', incomeError);
              }
            }
          }
          notifyGastosChanged({ action: 'sale-income', ventaId: existing?.id, seller: existing?.vendedor });
          onSaved?.(existing);
          onClose?.();
          return;
        }
      } catch (confirmError) {
        console.error('[ModalVenta] No se pudo confirmar la venta:', confirmError);
      }
      alert('No se pudo guardar la venta. Intenta nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!venta || saving || !validate()) return;

    setSaving(true);
    try {
      const payload = {
        fechaVenta: form.fechaVenta,
        precioVenta: Number(form.precioVenta),
        incomeBank,
      };

      if (splitModeActive) {
        const tcG = Number(form.tipoCambioGonzalo || form.tipoCambio || 0);
        const tcR = Number(form.tipoCambioRenato || form.tipoCambio || 0);
        const avg = (tcG + tcR) / 2;
        payload.tipoCambio = Number(avg.toFixed(4));
        payload.tipoCambioGonzalo = tcG;
        payload.tipoCambioRenato = tcR;
        payload.vendedor = 'ambos';
      } else {
        payload.tipoCambio = Number(form.tipoCambio);
        payload.vendedor = form.vendedor?.trim() || null;
      }

      const updated = await api.patch(`/ventas/${venta.id}`, payload);
      if (localStorage.getItem('token')) {
        try {
          await syncSaleIncomeAfterEdit(updated);
        } catch (incomeError) {
          if (!(incomeError instanceof ExpenseDuplicateCancelledError)) {
            console.error('[ModalVenta] Respaldo de sincronización no disponible:', incomeError);
          }
        }
      }
      notifyGastosChanged({ action: 'sale-income', ventaId: updated?.id, seller: updated?.vendedor || payload.vendedor });
      onSaved?.(updated);
      onClose?.();
    } catch (e) {
      console.error('[ModalVenta] Error al actualizar venta:', e);
      alert('No se pudo actualizar la venta.');
    } finally {
      setSaving(false);
    }
  };

  const valorUsd = Number(producto?.valor?.valorProducto ?? 0);
  const envioSoles = Number(
    producto?.valor?.costoEnvioProrrateado ?? producto?.valor?.costoEnvio ?? 0,
  );
  const ventaTotalSoles = Number(form.precioVenta || 0);
  const mitadVentaSoles = ventaTotalSoles ? ventaTotalSoles / 2 : 0;
  const toPositiveNumber = (value) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const baseTc =
    toPositiveNumber(form.tipoCambio) ?? toPositiveNumber(venta?.tipoCambio) ?? 0;
  const tcG =
    toPositiveNumber(form.tipoCambioGonzalo) ??
    toPositiveNumber(venta?.tipoCambioGonzalo) ??
    baseTc;
  const tcR =
    toPositiveNumber(form.tipoCambioRenato) ??
    toPositiveNumber(venta?.tipoCambioRenato) ??
    baseTc;

  const calcSplit = (tc) => {
    if (!tc) return null;
    const costo = (valorUsd / 2) * tc + envioSoles / 2;
    const ganancia = mitadVentaSoles - costo;
    const porcentaje = costo > 0 ? (ganancia / costo) * 100 : 0;
    return { costo, ganancia, porcentaje };
  };

  const splitG = calcSplit(tcG);
  const splitR = calcSplit(tcR);

  const fmtMoney = (n) =>
    Number.isFinite(n) ? Number(n).toFixed(2) : '--';
  const fmtPct = (n) =>
    Number.isFinite(n) ? `${Number(n).toFixed(2)}%` : '--';
  const fmtTc = (n) =>
    Number.isFinite(n) && n > 0 ? Number(n).toFixed(4) : '--';
  const accessoryQuantity = Number(form.cantidad || 0);
  const accessoryTotalPrice = Number(form.precioVenta || 0);
  const accessoryUnitPrice = accessoryQuantity > 0 && accessoryTotalPrice > 0
    ? accessoryTotalPrice / accessoryQuantity
    : null;

  const renderSplitFields = () => (
    <>
      {accessoryCreate && (
        <div>
          <label htmlFor="venta-cantidad" className="block font-medium mb-1">Cantidad</label>
          <input id="venta-cantidad" type="number" min="1" max={producto.stockActual || 0} step="1" className="w-full border p-2 rounded" value={form.cantidad} onChange={(e) => onChange('cantidad', e.target.value)} />
        </div>
      )}
      <div>
        <label htmlFor="venta-precio-compartido" className="block font-medium mb-1">{accessoryCreate ? 'Precio total de venta (S/)' : 'Precio de venta (S/)'}</label>
        <input
          id="venta-precio-compartido"
          type="number"
          step="0.01"
          className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          value={form.precioVenta}
          onChange={(e) => onChange('precioVenta', e.target.value)}
        />
      </div>
      {accessoryCreate && (
        <div className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-900">Precio por unidad: <strong>{accessoryUnitPrice == null ? 'S/ --' : `S/ ${accessoryUnitPrice.toFixed(2)}`}</strong></div>
      )}
      <div>
        <label className="block font-medium mb-1">Fecha de venta</label>
        <input
          type="date"
          className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          value={form.fechaVenta}
          onChange={(e) => onChange('fechaVenta', e.target.value)}
        />
      </div>
      <div className="border rounded-lg divide-y">
        <div className="p-3 space-y-2">
          <div className="font-semibold">Gonzalo</div>
          <div>
            <label className="block text-sm font-medium mb-1">Tipo de cambio</label>
            <input
              type="number"
              step="0.0001"
              className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              value={form.tipoCambioGonzalo}
              onChange={(e) => onChange('tipoCambioGonzalo', e.target.value)}
            />
          </div>
          <div className="text-xs text-gray-600">
            Costo: S/ {splitG ? fmtMoney(splitG.costo) : '--'} | Ganancia: S/ {splitG ? fmtMoney(splitG.ganancia) : '--'} | %: {splitG ? fmtPct(splitG.porcentaje) : '--'}
          </div>
        </div>
        <div className="p-3 space-y-2">
          <div className="font-semibold">Renato</div>
          <div>
            <label className="block text-sm font-medium mb-1">Tipo de cambio</label>
            <input
              type="number"
              step="0.0001"
              className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              value={form.tipoCambioRenato}
              onChange={(e) => onChange('tipoCambioRenato', e.target.value)}
            />
          </div>
          <div className="text-xs text-gray-600">
            Costo: S/ {splitR ? fmtMoney(splitR.costo) : '--'} | Ganancia: S/ {splitR ? fmtMoney(splitR.ganancia) : '--'} | %: {splitR ? fmtPct(splitR.porcentaje) : '--'}
          </div>
        </div>
      </div>
    </>
  );

  const renderSingleFields = () => (
    <>
      <div>
        <label htmlFor="venta-tipo-cambio" className="block font-medium mb-1">Tipo de cambio</label>
        <input
          id="venta-tipo-cambio"
          type="number"
          step="0.0001"
          className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          value={form.tipoCambio}
          onChange={(e) => onChange('tipoCambio', e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="venta-fecha" className="block font-medium mb-1">Fecha de venta</label>
        <input
          id="venta-fecha"
          type="date"
          className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          value={form.fechaVenta}
          onChange={(e) => onChange('fechaVenta', e.target.value)}
        />
      </div>
      {!accessoryCreate && <div>
        <label htmlFor="venta-precio" className="block font-medium mb-1">Precio de venta (S/)</label>
        <input
          id="venta-precio"
          type="number"
          step="0.01"
          className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          value={form.precioVenta}
          onChange={(e) => onChange('precioVenta', e.target.value)}
        />
      </div>}
      {accessoryCreate && (
        <div className="grid grid-cols-2 gap-3 rounded-lg border border-indigo-200 bg-indigo-50 p-3">
          <div><label htmlFor="venta-cantidad" className="block text-sm font-medium mb-1">Cantidad</label><input id="venta-cantidad" type="number" min="1" max={producto.stockActual || 0} step="1" className="w-full border p-2 rounded bg-white" value={form.cantidad} onChange={(e) => onChange('cantidad', e.target.value)} /></div>
          <div><label htmlFor="venta-precio" className="block text-sm font-medium mb-1">Precio total de venta (S/)</label><input id="venta-precio" type="number" min="0" step="0.01" className="w-full border p-2 rounded bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" value={form.precioVenta} onChange={(e) => onChange('precioVenta', e.target.value)} /></div>
          <div className="col-span-2 rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm text-indigo-900">Precio por unidad: <strong>{accessoryUnitPrice == null ? 'S/ --' : `S/ ${accessoryUnitPrice.toFixed(2)}`}</strong></div>
          <div className="col-span-2 text-xs text-indigo-800">Stock disponible: {producto.stockActual || 0}. El sistema descontarÃ¡ primero las unidades del lote mÃ¡s antiguo.</div>
        </div>
      )}
      {!venta && saleExpenseOwner(form.vendedor || producto?.vendedor || presetVendedor) && (
        <div>
          <label htmlFor="venta-banco-ingreso" className="block font-medium mb-1">Banco donde ingresó la venta</label>
          <select
            id="venta-banco-ingreso"
            className="w-full border p-2 rounded bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            value={incomeBank}
            onChange={(e) => setIncomeBank(e.target.value)}
          >
            <option value="bcp">BCP</option>
            <option value="interbank">Interbank</option>
            <option value="bbva">BBVA</option>
          </select>
          <div className="mt-1 text-xs text-gray-600">El ingreso automático se registrará en esta cuenta.</div>
        </div>
      )}
    </>
  );

  const sellerOptions = [
    { value: '', label: 'Sin vendedor' },
    { value: 'Gonzalo', label: 'Gonzalo' },
    { value: 'Renato', label: 'Renato' },
    { value: 'ambos', label: 'Ambos' },
    ...PEDIDO_CLIENTS.map((client) => ({
      value: pedidoSeller(client),
      label: pedidoSeller(client),
    })),
  ];
  const sellerSelectValue = sellerOptions.some((opt) => opt.value === form.vendedor)
    ? form.vendedor
    : '';
  const renderSellerField = () => (
    <div className="rounded-lg border p-3 bg-gray-50 space-y-3">
      <div>
        <label className="block font-medium mb-1">Vendedor</label>
        <select
          className="w-full border p-2 rounded bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          value={sellerSelectValue}
          onChange={(e) => onSellerChange(e.target.value)}
          disabled={isReadOnly}
        >
          {sellerOptions.map((opt) => (
            <option key={opt.label} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Otro cliente a pedido</label>
        <input
          type="text"
          className="w-full border p-2 rounded bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          value={form.pedidoCliente}
          onChange={(e) => onPedidoClientChange(e.target.value)}
          placeholder="Nombre del cliente"
          disabled={isReadOnly}
        />
      </div>
    </div>
  );

  const summaryMoney = (value) => `S/ ${Number(value || 0).toFixed(2)}`;
  const summaryPanel = accessoryCreate && (
    <aside className="rounded-xl border border-slate-200 bg-slate-50 p-4" aria-label="Resumen de ventas del accesorio">
      <h3 className="font-semibold text-slate-950">Ventas del accesorio</h3>
      {summaryLoading ? <p className="mt-3 text-sm text-slate-500">Cargando resumen...</p> : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg bg-white p-3"><span className="block text-xs text-slate-500">Unidades vendidas</span><strong>{accessorySummary?.unidadesVendidas || 0}</strong></div>
            <div className="rounded-lg bg-white p-3"><span className="block text-xs text-slate-500">Disponibles</span><strong>{accessorySummary?.unidadesDisponibles ?? producto.stockActual ?? 0}</strong></div>
            <div className="rounded-lg bg-white p-3"><span className="block text-xs text-slate-500">Venta bruta</span><strong>{summaryMoney(accessorySummary?.ventaBruta)}</strong></div>
            <div className="rounded-lg bg-white p-3"><span className="block text-xs text-slate-500">Costo vendido</span><strong>{summaryMoney(accessorySummary?.costoVendido)}</strong></div>
            <div className="col-span-2 rounded-lg bg-emerald-50 p-3 text-emerald-800"><span className="block text-xs">Ganancia neta</span><strong className="text-lg">{summaryMoney(accessorySummary?.gananciaNeta)}</strong></div>
          </div>
          <p className="mt-3 text-xs text-slate-600">Tipo de cambio promedio: <strong>{accessorySummary?.tipoCambioPromedio != null ? Number(accessorySummary.tipoCambioPromedio).toFixed(4) : '--'}</strong></p>
          <div className="mt-3 max-h-52 space-y-2 overflow-y-auto">
            {(accessorySummary?.ventas || []).map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                <div className="flex justify-between gap-2"><strong>{item.fechaVenta}</strong><span>{item.cantidad} und.</span></div>
                <div className="mt-1 flex justify-between gap-2"><span>Bruto {summaryMoney(item.ventaBruta)}</span><strong className={Number(item.gananciaNeta) >= 0 ? 'text-emerald-700' : 'text-red-600'}>Neto {summaryMoney(item.gananciaNeta)}</strong></div>
              </div>
            ))}
          </div>
        </>
      )}
    </aside>
  );

  const content = (
      <div className={`bg-white w-full p-4 sm:p-6 relative overflow-y-auto ${embedded ? 'h-full max-h-full' : `${accessoryCreate ? 'sm:max-w-5xl' : 'sm:max-w-lg'} rounded-xl shadow-lg mx-4 max-h-[90vh]`}`}>
        {!embedded && <button
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"
          onClick={onClose}
          aria-label="Cerrar modal"
        >
          x
        </button>}

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">
            {venta ? (isReadOnly ? 'Detalle de Venta' : 'Editar Venta') : 'Registrar Venta'}
          </h2>
        </div>

        <div className="rounded-lg border bg-gray-50 px-3 py-2 text-sm text-gray-700 mb-4">
          Vendedor del producto: <span className="font-medium">{sellerLabel}</span>
        </div>

        {!venta && !sellerSlug && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 mb-4">
            Este producto no tiene vendedor asignado. Puedes registrar la venta, pero no aparecerá en ganancias por vendedor hasta asignarlo en el producto.
          </div>
        )}

        {!venta && (
          <div className={accessoryCreate ? 'grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]' : ''}>
            <div className="space-y-4">
              {renderSellerField()}
              {splitModeActive ? renderSplitFields() : renderSingleFields()}
              <div className="text-right">
              <button
                className={`bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 ${saving ? 'opacity-60 cursor-not-allowed' : ''}`}
                onClick={handleSaveCreate}
                disabled={saving}
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
              </div>
            </div>
            {summaryPanel}
          </div>
        )}

        {venta && isReadOnly && (
          <div className="space-y-3">
            <div>
              <span className="font-medium">Fecha de venta: </span>
              <span className="text-gray-700">{venta.fechaVenta}</span>
            </div>

            {isSplitVenta ? (
              <>
                <div>
                  <span className="font-medium">Precio de venta total (S/): </span>
                  <span className="text-gray-700">{Number(venta.precioVenta).toFixed(2)}</span>
                </div>
                <div className="border rounded-lg divide-y">
                  <div className="p-3 space-y-1">
                    <div className="font-semibold">Gonzalo</div>
                    <div className="text-sm text-gray-700">Tipo de cambio: {fmtTc(tcG)}</div>
                    <div className="text-xs text-gray-600">Venta: S/ {fmtMoney(mitadVentaSoles)}</div>
                    <div className="text-xs text-gray-600">
                      Costo: S/ {splitG ? fmtMoney(splitG.costo) : '--'} | Ganancia: S/ {splitG ? fmtMoney(splitG.ganancia) : '--'} | %: {splitG ? fmtPct(splitG.porcentaje) : '--'}
                    </div>
                  </div>
                  <div className="p-3 space-y-1">
                    <div className="font-semibold">Renato</div>
                    <div className="text-sm text-gray-700">Tipo de cambio: {fmtTc(tcR)}</div>
                    <div className="text-xs text-gray-600">Venta: S/ {fmtMoney(mitadVentaSoles)}</div>
                    <div className="text-xs text-gray-600">
                      Costo: S/ {splitR ? fmtMoney(splitR.costo) : '--'} | Ganancia: S/ {splitR ? fmtMoney(splitR.ganancia) : '--'} | %: {splitR ? fmtPct(splitR.porcentaje) : '--'}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <span className="font-medium">Tipo de cambio: </span>
                  <span className="text-gray-700">{Number(venta.tipoCambio).toFixed(4)}</span>
                </div>
                <div>
                  <span className="font-medium">Precio de venta (S/): </span>
                  <span className="text-gray-700">{Number(venta.precioVenta).toFixed(2)}</span>
                </div>
                <div>
                  <span className="font-medium">% Ganancia: </span>
                  <span className="text-gray-700">{Number(venta.porcentajeGanancia).toFixed(3)}%</span>
                </div>
                <div>
                  <span className="font-medium">Ganancia neta (S/): </span>
                  <span className="text-gray-700">{Number(venta.ganancia).toFixed(2)}</span>
                </div>
              </>
            )}

            <div>
              <span className="font-medium">Vendedor: </span>
              <span className="text-gray-700">{sellerLabel}</span>
            </div>

            <div className="text-right pt-2 flex items-center justify-end gap-2">
              <button
                className="px-3 py-2 rounded bg-amber-500 text-white hover:bg-amber-600"
                onClick={() => setEditMode(true)}
              >
                Editar
              </button>
              <button
                className="bg-gray-300 text-gray-800 px-6 py-2 rounded hover:bg-gray-400"
                onClick={onClose}
              >
                Cerrar
              </button>
            </div>
          </div>
        )}

        {venta && !isReadOnly && (
          <div className="space-y-4">
            {renderSellerField()}
            {splitModeActive ? renderSplitFields() : renderSingleFields()}
            <div className="flex items-center justify-end gap-2">
              <button
                className="bg-gray-200 text-gray-800 px-6 py-2 rounded hover:bg-gray-300"
                onClick={() => setEditMode(false)}
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                className={`bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 ${saving ? 'opacity-60 cursor-not-allowed' : ''}`}
                onClick={handleSaveEdit}
                disabled={saving}
              >
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        )}
      </div>
  );

  if (embedded) return content;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      {content}
    </div>
  );
}
