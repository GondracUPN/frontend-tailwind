// src/pages/Calculadora.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";

/* =========================
   Constantes de negocio
   ========================= */
const TARIFAS = [
  { maxKg: 0.5,  precio: 30.60 }, { maxKg: 1.0,  precio: 55.00 },
  { maxKg: 1.5,  precio: 74.00 }, { maxKg: 2.0,  precio: 90.00 },
  { maxKg: 2.5,  precio: 110.00 },{ maxKg: 3.0,  precio: 120.00 },
  { maxKg: 3.5,  precio: 130.00 },{ maxKg: 4.0,  precio: 140.00 },
  { maxKg: 4.5,  precio: 150.00 },{ maxKg: 5.0,  precio: 160.00 },
  { maxKg: 5.5,  precio: 170.00 },{ maxKg: 6.0,  precio: 180.00 },
  { maxKg: 6.5,  precio: 190.00 },{ maxKg: 7.0,  precio: 200.00 },
  { maxKg: 7.5,  precio: 210.00 },{ maxKg: 8.0,  precio: 220.00 },
  { maxKg: 8.5,  precio: 230.00 },{ maxKg: 9.0,  precio: 240.00 },
  { maxKg: 9.5,  precio: 250.00 },{ maxKg: 10.0, precio: 260.00 },
];
const ADICIONAL_05KG = 10;   // S/ por cada 0.5 kg > 10 kg
const TC_KENNY = 3.64;       // TC fijo Kenny
const TC_JORGE_DEFAULT = 3.8;

/* =========================
   Utilidades
   ========================= */
const num = (v) =>
  v == null || v === "" || isNaN(v) ? 0 : parseFloat(String(v).replace(",", "."));
const fmtSoles = (v) => (isNaN(v) ? "—" : `S/ ${v.toFixed(2)}`);

// Redondeos
const ceil10 = (v) => Math.ceil((Number(v) || 0) / 10) * 10;
const round10HalfUp = (v) => {
  const n = Number(v) || 0, down = Math.floor(n / 10) * 10, up = down + 10;
  return (n - down) >= 5 ? up : down;
};
const round5HalfUp = (v) => {
  const n = Number(v) || 0, down = Math.floor(n / 5) * 5, up = down + 5;
  return (n - down) >= 2.5 ? up : down;
};
// Peso: centésimas .05 hacia abajo, .06–.09 hacia arriba ⇒ a décima
const roundTenth05Down = (kg) => {
  const v = Number(String(kg).replace(",", ".")) || 0;
  if (v <= 0) return 0;
  const centi = Math.round(v * 100);
  const tens = Math.floor(centi / 10);
  const rem  = centi - tens * 10;
  return (rem <= 5 ? tens : tens + 1) / 10;
};

// Envío eShopex (interpolación lineal)
const tarifaEshopexInterpolada = (pesoKg) => {
  if (!pesoKg || pesoKg <= 0) return 0;
  const P = TARIFAS;
  if (pesoKg <= P[0].maxKg) return (P[0].precio * pesoKg) / P[0].maxKg;
  for (let i = 1; i < P.length; i++) {
    const a = P[i - 1], b = P[i];
    if (pesoKg <= b.maxKg) {
      const t = (pesoKg - a.maxKg) / (b.maxKg - a.maxKg);
      return a.precio + t * (b.precio - a.precio);
    }
  }
  const extraKg = pesoKg - 10;
  return P[P.length - 1].precio + (extraKg / 0.5) * ADICIONAL_05KG;
};
const tarifaHasta3Kg = (pesoKg) =>
  tarifaEshopexInterpolada(Math.min(Math.max(pesoKg || 0, 0), 3));

// Honorarios / Seguro según DEC (USD)
const honorariosPorDEC = (dec) => (dec <= 100 ? 16.30 : dec <= 200 ? 25.28 : dec <= 1000 ? 39.76 : 60.16);
const seguroPorDEC     = (dec) => (dec <= 100 ? 8.86  : dec <= 200 ? 15.98 : 21.10);

/* =========================
   Componentes base (memo)
   ========================= */
const Input = React.memo(function Input({ label, value, onChange, type = "text", placeholder }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input
        type={type}
        inputMode="decimal"
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onChange={onChange}
        className="w-full border rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-400"
      />
    </div>
  );
});

const Card = React.memo(function Card({ title, children }) {
  return (
    <div className="bg-white rounded-2xl shadow p-5">
      <h3 className="text-lg font-semibold mb-3">{title}</h3>
      {children}
    </div>
  );
});

/* =========================
   Página principal
   ========================= */
export default function Calculadora({ setVista }) {
  // Compras: TC editable (ahora se muestra dentro del formulario)
  const [tipoCambio, _setTipoCambio] = useState("3.75");
  const setTipoCambio = useCallback((e) => _setTipoCambio(e.target.value), []);

  // Jorge: TC y Extra editables
  const [tcJorge, _setTcJorge] = useState(String(TC_JORGE_DEFAULT));
  const setTcJorge = useCallback((e) => _setTcJorge(e.target.value), []);
  const [extraJInput, setExtraJInput] = useState("100");
  const [extraJ, setExtraJ] = useState(100); // aplicado (×10 half-up)

  const [tab, setTab] = useState("compras"); // 'compras' | 'kenny' | 'jorge'

  // Form (UI) y su versión debounced para cálculos
  const [form, setForm] = useState({ precioUsd: "", envioUsaUsd: "", decUsd: "", pesoKg: "" });
  const setField = useCallback((field) => (e) => {
    const v = e.target?.value ?? e;
    setForm((f) => ({ ...f, [field]: v }));
  }, []);
  const [debounced, setDebounced] = useState(form);
  useEffect(() => {
    const h = setTimeout(() => setDebounced(form), 300);
    return () => clearTimeout(h);
  }, [form]);

  const goHome = () => (typeof setVista === "function" ? setVista("home") : window.history.back());

  /* --------- COMPRAS --------- */
  const compras = useMemo(() => {
    const precioUsd   = num(debounced.precioUsd);
    const envioUsaUsd = num(debounced.envioUsaUsd);
    const decUsd      = num(debounced.decUsd);
    const pesoIn      = num(debounced.pesoKg);
    const pesoFacturable = roundTenth05Down(pesoIn);

    const precioSoles = (precioUsd + envioUsaUsd) * (num(tipoCambio) || 0);

    const transporteBruto    = tarifaEshopexInterpolada(pesoFacturable);
    const promoDescuento     = tarifaHasta3Kg(pesoFacturable) * 0.35;
    const transporteConPromo = Math.max(0, transporteBruto - promoDescuento);

    const honorarios = honorariosPorDEC(decUsd);
    const seguro     = seguroPorDEC(decUsd);
    const costoEnvio = transporteConPromo + honorarios + seguro;

    const costoTotal     = precioSoles + costoEnvio;
    const precioVentaMin = ceil10(costoTotal * 1.2);
    const ganancia       = precioVentaMin - costoTotal;

    return { precioSoles, pesoFacturable, transporteBruto, promoDescuento, transporteConPromo, honorarios, seguro, costoEnvio, costoTotal, precioVentaMin, ganancia };
  }, [debounced, tipoCambio]);

  /* --------- KENNY --------- */
  const kenny = useMemo(() => {
    const precioUsd   = num(debounced.precioUsd);
    const envioUsaUsd = num(debounced.envioUsaUsd);
    const decUsd      = num(debounced.decUsd);
    const pesoIn      = num(debounced.pesoKg);
    const pesoFacturable = roundTenth05Down(pesoIn);

    const precioSoles = (precioUsd + envioUsaUsd) * TC_KENNY;

    const transporteBruto    = tarifaEshopexInterpolada(pesoFacturable);
    const promoDescuento     = tarifaHasta3Kg(pesoFacturable) * 0.35;
    const transporteConPromo = Math.max(0, transporteBruto - promoDescuento);

    const honorarios = honorariosPorDEC(decUsd);
    const seguro     = seguroPorDEC(decUsd);
    const costoEnvio = transporteConPromo + honorarios + seguro;

    const extra = round10HalfUp(precioSoles * 0.13);
    const costoTotal = precioSoles + costoEnvio + extra;

    const pv10 = ceil10(costoTotal * 1.10);
    const pv20 = ceil10(costoTotal * 1.20);
    return {
      precioSoles, pesoFacturable, transporteBruto, promoDescuento, transporteConPromo,
      honorarios, seguro, costoEnvio, extra, costoTotal,
      pv10, pv20, ganancia10: pv10 - costoTotal, ganancia20: pv20 - costoTotal
    };
  }, [debounced]);

  /* --------- JORGE --------- */
  const jorge = useMemo(() => {
    const precioUsd   = num(debounced.precioUsd);
    const envioUsaUsd = num(debounced.envioUsaUsd);
    const decUsd      = num(debounced.decUsd);
    const pesoIn      = num(debounced.pesoKg);
    const pesoFacturable = roundTenth05Down(pesoIn);
    const tc = num(tcJorge);

    // Base en soles
    const baseSoles = (precioUsd + envioUsaUsd) * tc;

    const transporteBruto    = tarifaEshopexInterpolada(pesoFacturable);
    const promoDescuento     = tarifaHasta3Kg(pesoFacturable) * 0.35;
    const transporteConPromo = Math.max(0, transporteBruto - promoDescuento);

    const honorarios = honorariosPorDEC(decUsd);
    const seguro     = seguroPorDEC(decUsd);
    const costoEnvio = transporteConPromo + honorarios + seguro;

    // PB = (base + envío normal) * 1.07, luego PB redondeado ×5
    const pb  = (baseSoles + costoEnvio) * 1.07;
    const pbR = round5HalfUp(pb);

    const costoTotal = pbR + (Number(extraJ) || 0);

    const pv10 = ceil10(costoTotal * 1.10);
    const pv20 = ceil10(costoTotal * 1.20);

    return {
      pesoFacturable, baseSoles, transporteBruto, promoDescuento, transporteConPromo,
      honorarios, seguro, costoEnvio, pb, pbR, costoTotal,
      pv10, pv20, ganancia10: pv10 - costoTotal, ganancia20: pv20 - costoTotal
    };
  }, [debounced, tcJorge, extraJ]);

  /* =========================
     Render
     ========================= */
  return (
    <div className="min-h-screen p-6 md:p-10 bg-gray-100 text-gray-900">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Calculadora</h1>
          <p className="text-gray-600">Simula costos y precio de venta mínimo.</p>
        </div>
        <button onClick={goHome} className="px-4 py-2 rounded-lg bg-white border hover:bg-gray-100">
          ← Volver
        </button>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button onClick={() => setTab("compras")} className={`px-4 py-2 rounded-full ${tab === "compras" ? "bg-blue-600 text-white" : "bg-white border"}`}>Calculadora Compras</button>
        <button onClick={() => setTab("kenny")}   className={`px-4 py-2 rounded-full ${tab === "kenny"   ? "bg-blue-600 text-white" : "bg-white border"}`}>Calculadora Kenny</button>
        <button onClick={() => setTab("jorge")}   className={`px-4 py-2 rounded-full ${tab === "jorge"   ? "bg-blue-600 text-white" : "bg-white border"}`}>Calculadora Jorge</button>
      </div>

      {/* -------- COMPRAS -------- */}
      {tab === "compras" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card title="Datos de entrada">
            <div className="space-y-4">
              <Input label="Precio del Producto (USD)" value={form.precioUsd}   onChange={setField("precioUsd")}   placeholder="p.ej. 180" />
              <Input label="Envío USA (USD) — opcional" value={form.envioUsaUsd} onChange={setField("envioUsaUsd")} placeholder="p.ej. 12" />
              <Input label="Precio DEC (USD)"           value={form.decUsd}      onChange={setField("decUsd")}      placeholder="p.ej. 180" />
              <Input label="Peso estimado (Kg)"         value={form.pesoKg}      onChange={setField("pesoKg")}      placeholder="p.ej. 9.55" />
              {/* TC Compras dentro del formulario (editable) */}
              <Input label="TC Compras (S/ por USD)"    value={tipoCambio}       onChange={setTipoCambio}            placeholder="3.75" />
              <div className="text-sm text-gray-500">
                * Promo -35% solo hasta 3 Kg (transporte eShopex).<br />
                * &gt;10 Kg: S/ {ADICIONAL_05KG} por cada 0.5 Kg adicional.
              </div>
            </div>
          </Card>

          <Card title="Costo de Envío (desglose)">
            <ul className="space-y-2">
              <li className="flex justify-between"><span>Peso facturable (kg):</span><strong>{compras.pesoFacturable.toFixed(1)}</strong></li>
              <li className="flex justify-between"><span>Transporte (tabla eShopex):</span><strong>{fmtSoles(compras.transporteBruto)}</strong></li>
              <li className="flex justify-between"><span>Promo -35% (hasta 3 Kg):</span><strong>- {fmtSoles(compras.promoDescuento)}</strong></li>
              <li className="flex justify-between"><span>Transporte con promo:</span><strong>{fmtSoles(compras.transporteConPromo)}</strong></li>
              <li className="flex justify-between"><span>Honorarios:</span><strong>{fmtSoles(compras.honorarios)}</strong></li>
              <li className="flex justify-between"><span>Seguro:</span><strong>{fmtSoles(compras.seguro)}</strong></li>
              <hr className="my-2" />
              <li className="flex justify-between text-lg"><span>Total envío:</span><strong>{fmtSoles(compras.costoEnvio)}</strong></li>
            </ul>
          </Card>

          <Card title="Resultados">
            <ul className="space-y-2">
              <li className="flex justify-between"><span>Precio en Soles ((Prod + Envío USA) × {num(tipoCambio).toFixed(2)}):</span><strong>{fmtSoles(compras.precioSoles)}</strong></li>
              <li className="flex justify-between"><span>Costo total (S/):</span><strong>{fmtSoles(compras.costoTotal)}</strong></li>
              <li className="flex justify-between text-xl"><span>Precio de Venta Mínimo (+20%):</span><strong>{fmtSoles(compras.precioVentaMin)}</strong></li>
              <li className="flex justify-between"><span>Ganancia estimada:</span><strong>{fmtSoles(compras.ganancia)}</strong></li>
            </ul>
          </Card>
        </div>
      )}

      {/* -------- KENNY -------- */}
      {tab === "kenny" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card title="Datos de entrada (Kenny)">
            <div className="space-y-4">
              <Input label="Precio del Producto (USD)" value={form.precioUsd}   onChange={setField("precioUsd")}   placeholder="p.ej. 180" />
              <Input label="Envío USA (USD) — opcional" value={form.envioUsaUsd} onChange={setField("envioUsaUsd")} placeholder="p.ej. 12" />
              <Input label="Precio DEC (USD)"           value={form.decUsd}      onChange={setField("decUsd")}      placeholder="p.ej. 180" />
              <Input label="Peso estimado (Kg)"         value={form.pesoKg}      onChange={setField("pesoKg")}      placeholder="p.ej. 1.8" />
              <div className="text-sm text-gray-500">
                * TC fijo {TC_KENNY.toFixed(2)}.  * Promo -35% hasta 3 Kg.  * &gt;10 Kg: S/ {ADICIONAL_05KG} por cada 0.5 Kg adicional.
              </div>
            </div>
          </Card>

          <Card title="Costo de Envío Kenny (desglose)">
            <ul className="space-y-2">
              <li className="flex justify-between"><span>Peso facturable (kg):</span><strong>{kenny.pesoFacturable.toFixed(1)}</strong></li>
              <li className="flex justify-between"><span>Transporte (tabla eShopex):</span><strong>{fmtSoles(kenny.transporteBruto)}</strong></li>
              <li className="flex justify-between"><span>Promo -35% (hasta 3 Kg):</span><strong>- {fmtSoles(kenny.promoDescuento)}</strong></li>
              <li className="flex justify-between"><span>Transporte con promo:</span><strong>{fmtSoles(kenny.transporteConPromo)}</strong></li>
              <li className="flex justify-between"><span>Honorarios:</span><strong>{fmtSoles(kenny.honorarios)}</strong></li>
              <li className="flex justify-between"><span>Seguro:</span><strong>{fmtSoles(kenny.seguro)}</strong></li>
              <hr className="my-2" />
              <li className="flex justify-between text-lg"><span>Total envío:</span><strong>{fmtSoles(kenny.costoEnvio)}</strong></li>
              <li className="flex justify-between"><span>Extra (13% de Precio en Soles, redondeado ×10):</span><strong>{fmtSoles(kenny.extra)}</strong></li>
            </ul>
          </Card>

          <Card title="Resultados Kenny">
            <ul className="space-y-2">
              <li className="flex justify-between"><span>Precio en Soles ((Prod + Envío USA) × {TC_KENNY.toFixed(2)}):</span><strong>{fmtSoles(kenny.precioSoles)}</strong></li>
              <li className="flex justify-between"><span>Costo Total Kenny:</span><strong>{fmtSoles(kenny.costoTotal)}</strong></li>
              <hr className="my-2" />
              <li className="flex justify-between"><span>Precio de Venta +10% (redondeado ×10):</span><strong>{fmtSoles(kenny.pv10)}</strong></li>
              <li className="flex justify-between"><span>Ganancia con +10%:</span><strong>{fmtSoles(kenny.ganancia10)}</strong></li>
              <hr className="my-2" />
              <li className="flex justify-between"><span>Precio de Venta +20% (redondeado ×10):</span><strong>{fmtSoles(kenny.pv20)}</strong></li>
              <li className="flex justify-between"><span>Ganancia con +20%:</span><strong>{fmtSoles(kenny.ganancia20)}</strong></li>
            </ul>
          </Card>
        </div>
      )}

      {/* -------- JORGE -------- */}
      {tab === "jorge" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card title="Datos de entrada (Jorge)">
            <div className="space-y-4">
              <Input label="Precio del Producto (USD)" value={form.precioUsd}   onChange={setField("precioUsd")}   placeholder="p.ej. 470" />
              <Input label="Envío USA (USD) — opcional" value={form.envioUsaUsd} onChange={setField("envioUsaUsd")} placeholder="p.ej. 12" />
              <Input label="Precio DEC (USD)"           value={form.decUsd}      onChange={setField("decUsd")}      placeholder="p.ej. 115" />
              <Input label="Peso estimado (Kg)"         value={form.pesoKg}      onChange={setField("pesoKg")}      placeholder="p.ej. 3" />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">TC Jorge (S/ por USD)</label>
                  <input
                    type="text" inputMode="decimal"
                    className="w-full border rounded-lg p-2"
                    value={tcJorge} onChange={setTcJorge} placeholder={String(TC_JORGE_DEFAULT)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Extra (S/) — redondeado ×10</label>
                  <div className="flex gap-2">
                    <input
                      type="text" inputMode="decimal"
                      className="w-full border rounded-lg p-2"
                      value={extraJInput} onChange={(e) => setExtraJInput(e.target.value)} placeholder="100"
                    />
                    <button
                      onClick={() => setExtraJ(round10HalfUp(num(extraJInput)))}
                      className="px-3 rounded-lg bg-gray-800 text-white" title="Aplicar y redondear ×10 (.5 hacia arriba)"
                    >
                      OK
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Actual: {fmtSoles(extraJ)} (aplicado)</p>
                </div>
              </div>

              <div className="text-sm text-gray-500">
                * PB = (Base en soles + Envío normal) × <strong>1.07</strong>.<br />
                * PB redondeado a múltiplos de 5 (nearest).<br />
                * Costo Total Jorge = PB redondeado + Extra.
              </div>
            </div>
          </Card>

          <Card title="Costo de Envío Jorge (desglose)">
            <ul className="space-y-2">
              <li className="flex justify-between"><span>Peso facturable (kg):</span><strong>{jorge.pesoFacturable.toFixed(1)}</strong></li>
              <li className="flex justify-between"><span>Transporte (tabla eShopex):</span><strong>{fmtSoles(jorge.transporteBruto)}</strong></li>
              <li className="flex justify-between"><span>Promo -35% (hasta 3 Kg):</span><strong>- {fmtSoles(jorge.promoDescuento)}</strong></li>
              <li className="flex justify-between"><span>Transporte con promo:</span><strong>{fmtSoles(jorge.transporteConPromo)}</strong></li>
              <li className="flex justify-between"><span>Honorarios:</span><strong>{fmtSoles(jorge.honorarios)}</strong></li>
              <li className="flex justify-between"><span>Seguro:</span><strong>{fmtSoles(jorge.seguro)}</strong></li>
              <hr className="my-2" />
              <li className="flex justify-between text-lg"><span>Total envío (normal):</span><strong>{fmtSoles(jorge.costoEnvio)}</strong></li>
            </ul>
          </Card>

          <Card title="Resultados Jorge">
            <ul className="space-y-2">
              <li className="flex justify-between"><span>Base en soles ((Prod + Envío USA) × {num(tcJorge).toFixed(2)}):</span><strong>{fmtSoles(jorge.baseSoles)}</strong></li>
              <li className="flex justify-between"><span>Envío normal:</span><strong>{fmtSoles(jorge.costoEnvio)}</strong></li>
              <hr className="my-2" />
              <li className="flex justify-between"><span>PB = (Base + Envío) × 1.07:</span><strong>{fmtSoles(jorge.pb)}</strong></li>
              <li className="flex justify-between"><span>PB redondeado (×5):</span><strong>{fmtSoles(jorge.pbR)}</strong></li>
              <li className="flex justify-between"><span>Extra (aplicado, ×10):</span><strong>{fmtSoles(extraJ)}</strong></li>
              <li className="flex justify-between text-lg"><span>Costo Total Jorge (PB redondeado + Extra):</span><strong>{fmtSoles(jorge.costoTotal)}</strong></li>
              <hr className="my-2" />
              <li className="flex justify-between"><span>Precio de Venta +10% (redondeado ×10):</span><strong>{fmtSoles(jorge.pv10)}</strong></li>
              <li className="flex justify-between"><span>Ganancia con +10%:</span><strong>{fmtSoles(jorge.ganancia10)}</strong></li>
              <li className="flex justify-between"><span>Precio de Venta +20% (redondeado ×10):</span><strong>{fmtSoles(jorge.pv20)}</strong></li>
              <li className="flex justify-between"><span>Ganancia con +20%:</span><strong>{fmtSoles(jorge.ganancia20)}</strong></li>
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}
