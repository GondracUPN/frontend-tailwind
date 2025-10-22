// src/components/CardsSummary.jsx
import React, { useEffect, useState } from 'react';
import { API_URL } from '../api';

const LABELS = {
  interbank: 'Interbank',
  bcp_amex: 'BCP Amex',
  bcp_visa: 'BCP Visa',
  bbva: 'BBVA',
  io: 'IO',
  saga: 'Saga',
};

const fmt = (n) => `S/ ${Number(n || 0).toFixed(2)}`;

export default function CardsSummary({ reloadKey }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/cards/summary`, {
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (alive) setRows(Array.isArray(data) ? data : []);
      } catch {
        if (alive) setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [reloadKey]);

  return (
    <div className="bg-white border rounded-xl shadow p-4">
      <div className="font-semibold mb-1">Tarjetas (línea / usado / disponible)</div>
      {loading ? (
        <div className="text-sm text-gray-600">Cargando…</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-gray-600">No tienes tarjetas.</div>
      ) : (
        <div className="grid gap-2">
          {rows.map(r => (
            <div key={r.id} className="flex items-center justify-between border rounded p-2">
              <div className="font-medium">{LABELS[r.tipo] || r.tipo}</div>
              <div className="text-sm">
                <span className="mr-3">Línea: <b>{fmt(r.creditLine)}</b></span>
                <span className="mr-3">Usado: <b>{fmt(r.used)}</b></span>
                <span>Disponible: <b>{fmt(r.available)}</b></span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


