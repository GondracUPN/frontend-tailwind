// src/components/ModalVenta.jsx
import React, { useEffect, useState } from 'react';
import api from '../api'; // ← ajusta esta ruta si tu instancia está en otro lado

export default function ModalVenta({ producto, venta, onClose, onSaved }) {
    // si viene "venta", el modal está en modo lectura (mostrar detalles)
    const isReadOnly = Boolean(venta);

    const [form, setForm] = useState({
        tipoCambio: '',
        fechaVenta: '',
        precioVenta: '',
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (venta) {
            // modo lectura: precargamos para mostrar
            setForm({
                tipoCambio: String(venta.tipoCambio ?? ''),
                fechaVenta: venta.fechaVenta ?? '',
                precioVenta: String(venta.precioVenta ?? ''),
            });
        }
    }, [venta]);

    const onChange = (f, v) => setForm(prev => ({ ...prev, [f]: v }));

    const handleSave = async () => {
        if (saving) return;
        if (!form.tipoCambio || !form.fechaVenta || !form.precioVenta) {
            alert('Completa Tipo de cambio, Fecha de venta y Precio de venta.');
            return;
        }
        setSaving(true);
        try {
            const saved = await api.post(`/ventas`, {
                productoId: producto.id,
                tipoCambio: Number(form.tipoCambio),
                fechaVenta: form.fechaVenta,
                precioVenta: Number(form.precioVenta),
            });
            console.log('[ModalVenta] saved:', saved);
            onSaved(saved); // ← actualiza la UI en la página de productos
            onClose();
        } catch (e) {
            console.error('[ModalVenta] Error al guardar venta:', e);
            alert('No se pudo guardar la venta.');
        } finally {
            setSaving(false);
        }
    };

    if (!producto) return null;

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white w-full max-w-lg rounded-xl shadow-lg p-6 relative">
                {/* Cerrar */}
                <button
                    className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"
                    onClick={onClose}
                    aria-label="Cerrar modal"
                >
                    ✖
                </button>

                <h2 className="text-2xl font-semibold mb-4">
                    {isReadOnly ? 'Detalle de Venta' : 'Registrar Venta'}
                </h2>

                {!isReadOnly ? (
                    <div className="space-y-4">
                        <div>
                            <label className="block font-medium mb-1">Tipo de cambio</label>
                            <input
                                type="number"
                                step="0.0001"
                                className="w-full border p-2 rounded"
                                value={form.tipoCambio}
                                onChange={e => onChange('tipoCambio', e.target.value)}
                                placeholder="Ej. 3.85"
                            />
                        </div>
                        <div>
                            <label className="block font-medium mb-1">Fecha de venta</label>
                            <input
                                type="date"
                                className="w-full border p-2 rounded"
                                value={form.fechaVenta}
                                onChange={e => onChange('fechaVenta', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block font-medium mb-1">Precio de venta (S/)</label>
                            <input
                                type="number"
                                step="0.01"
                                className="w-full border p-2 rounded"
                                value={form.precioVenta}
                                onChange={e => onChange('precioVenta', e.target.value)}
                                placeholder="Ej. 2499.90"
                            />
                        </div>

                        <div className="text-right">
                            <button
                                className={`bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 ${saving ? 'opacity-60 cursor-not-allowed' : ''}`}
                                onClick={handleSave}
                                disabled={saving}
                            >
                                {saving ? 'Guardando…' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div>
                            <span className="font-medium">Fecha de venta: </span>
                            <span className="text-gray-700">{venta.fechaVenta}</span>
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

                        <div className="text-right pt-2">
                            <button
                                className="bg-gray-300 text-gray-800 px-6 py-2 rounded hover:bg-gray-400"
                                onClick={onClose}
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
