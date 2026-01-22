// src/components/ModalDec.js
import React, { useMemo, useState, useEffect } from "react";
import api from "../api";
import { FaDice } from "react-icons/fa";

/** Casilleros exactos (para el HTML final) */
const CASILLEROS = {
  Walter: "Walter Gonzalo GARCIA LOPEZ PEZ95950",
  Renato: "Renato Alfonso Carbajal Cachay PEZ97722",
  MamaRen: "Maria Estilita Cachay PEZ102472",
  Christian: "Christian Morales Huachallanqui PEZ96817",
  Jorge: "JORGE SAHID GARCIA SANCHEZ PEZ103361",
  Kenny: "KENNY MIYAGUI KOKI PEZ102647",
  Alex: "Alexander Rodrigo Solis Delgado PEZ102500",
};

/* -------- Biblioteca de problemas por tipo -------- */
const PROBLEMS = {
  macbook: [
    "Screen not working","Battery not charging","Keyboard and trackpad not working",
    "Screen flickering","Speaker not working","WiFi and Bluetooth not working",
    "Screen cracked","Battery drains fast","SSD not detected","System stuck on loading screen",
    "Black screen no display","USB ports not working","Overheating issue",
    "Camera and microphone not working","No sound output","Charger not detected",
    "Screen with lines","Battery swollen","Fan loud and overheating","Stuck on Apple logo",
  ],
  ipad: [
    "Screen cracked","Touch screen not working","iCloud locked","Battery not charging",
    "WiFi and Bluetooth not working","Screen frozen","Stuck on Apple logo","Camera not working",
    "Speaker and microphone not working","No display","Screen with lines","Battery drains fast",
    "SIM card not detected","Apple ID locked","Charging port not working","Screen flickering",
    "No sound","Back and front camera blurry","Boot loop issue","Water damage no power",
  ],
  iphone: [
    "iCloud locked","Activation lock enabled","Apple ID locked","Screen cracked",
    "Touch not working","WiFi and Bluetooth not working","Battery not charging","Screen frozen",
    "Stuck on Apple logo","Camera not working","Speaker not working","No network service",
    "SIM card not detected","Face ID not working","Home button not working","Screen flickering",
    "Ghost touch issue","No sound output","Boot loop stuck","Water damaged won't turn on",
  ],
};
const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];

/* ---------- Helpers ---------- */
function fmtUSD(n) {
  const num = Number(n) || 0;
  return `$${num.toFixed(2)}`;
}
function fmtDateUS(d) {
  if (!d) return "";
  const dt = new Date(`${d}T00:00:00`);
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function toYYYYMMDD(input) {
  if (!input) return "";
  const s = String(input);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(input);
  if (isNaN(d)) return "";
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function normalize(s) {
  return String(s || "").trim().toLowerCase();
}
function parseDateScore(val) {
  if (!val) return 0;
  const ts = Date.parse(val);
  return Number.isNaN(ts) ? 0 : ts;
}
function latestTracking(p) {
  if (!Array.isArray(p?.tracking) || p.tracking.length === 0) return null;
  const sorted = [...p.tracking].sort((a, b) => {
    const scoreA = Math.max(parseDateScore(a?.updatedAt), parseDateScore(a?.createdAt), a?.id || 0);
    const scoreB = Math.max(parseDateScore(b?.updatedAt), parseDateScore(b?.createdAt), b?.id || 0);
    return scoreB - scoreA;
  });
  return sorted[0] || null;
}
function estadoCuentaParaDec(estado) {
  const e = normalize(estado);
  if (!e) return false;
  if (e === "recogido") return false;
  if (e === "en_eshopex") return true;
  if (e === "comprado_en_camino") return true;
  if (e.includes("camino")) return true;
  if (e.includes("adelant")) return true;
  if (e.includes("venta") && !e.includes("recogido")) return true;
  return false;
}
function isEnCaminoCliente(p) {
  if (estadoCuentaParaDec(p?.estado)) return true;
  const ultimo = latestTracking(p);
  return estadoCuentaParaDec(ultimo?.estado);
}
const get = (o, keys, def = "") =>
  keys.reduce((v, k) => (v != null ? v : o?.[k]), null) ?? def;

function getSize(p) {
  const sizeFromDetalle = get(p?.detalle, ["tamaño", "tamanio", "tamano"]);
  const sizeFromRoot = get(p, ["tamaño", "tamanio", "tamano"]);
  return sizeFromDetalle || p?.size || sizeFromRoot || "";
}
function getGama(p) {
  const d = get(p?.detalle, ["gama"]) || p?.gama || "";
  if (d) return d;
  const tipo = normalize(p?.tipo);
  if (tipo.includes("pro")) return "Pro";
  if (tipo.includes("air")) return "Air";
  return "";
}
function getProcesador(p) { return get(p?.detalle, ["procesador"]) || p?.procesador || ""; }
function getRam(p) { return get(p?.detalle, ["ram", "memoriaRam", "memoria"]) || p?.ram || ""; }
function getStorage(p) { return get(p?.detalle, ["almacenamiento", "storage", "capacidad", "gb"]) || p?.almacenamiento || ""; }
function getNumero(p) { return get(p?.detalle, ["numero"]) || p?.numero || ""; }
function getModelo(p) { return get(p?.detalle, ["modelo"]) || p?.modelo || ""; }
function getDescripcionOtro(p) { return get(p?.detalle, ["descripcionOtro", "descripcion"]) || p?.descripcion || ""; }

/* Limpia a string $ con 2 decimales */
function cleanMoneyToString(x) {
  const n = Number(String(x ?? "").replace(/[^\d.-]/g, ""));
  return isNaN(n) ? "0.00" : n.toFixed(2);
}

/* ----- CPU por gama (para Mac) ----- */
function cpuOptionsForMac(p) {
  const tipo = normalize(p?.tipo);
  if (!tipo.includes("macbook")) return [];
  const gamaRaw = getGama(p);
  const gama = normalize(gamaRaw);
  if (gama.includes("pro")) return ["i7", "i5"];
  if (gama.includes("air")) return ["i3", "i5"];
  return ["i5"];
}
function deriveProc(p) {
  const current = (getProcesador(p) || "").trim();
  if (current) return current;
  const opts = cpuOptionsForMac(p);
  return opts.length ? opts[0] : "";
}

/* --------- Etiqueta combo (incluye PROCESADOR) ---------- */
function labelForDropdown(p) {
  const tipo = String(p?.tipo || "").trim();
  const gama = getGama(p);
  const size = getSize(p);
  const proc = deriveProc(p);
  const ram = getRam(p);
  const sto = getStorage(p);

  if (tipo.toLowerCase().includes("iphone")) {
    const numero = String(getNumero(p) || "").trim();
    const modelo = String(getModelo(p) || getGama(p) || "").trim();
    const baseIphone = ["iPhone", numero, modelo].filter(Boolean).join(" ").trim();
    return [baseIphone || "iPhone", sto && `${sto} GB`].filter(Boolean).join(" ");
  }
  if (tipo.toLowerCase().includes("otro")) {
    const desc = String(getDescripcionOtro(p) || "").trim();
    return desc || "Otro";
  }

  const base = [tipo, gama, size && `${size}"`].filter(Boolean).join(" ");
  const extras = [proc, ram && `${ram} RAM`, sto && `${sto} GB`]
    .filter(Boolean)
    .join(" . ");
  return extras ? `${base} ${extras}` : base;
}

/* --------- Nombre base (sin problema). CPU inyectable en Mac --------- */
function buildCoreName(p, cpuOverride = "") {
  if (!p) return "";
  const tipoRaw = String(p?.tipo || "").trim();
  const tipo = tipoRaw.toLowerCase();
  const gama = (getGama(p) || "").trim();
  const sizeRaw = (getSize(p) || "").toString();
  const sizeNorm = sizeRaw.replace(/"/g, "").replace(",", ".").trim();
  const ram = (getRam(p) || "").toString().replace(/\s*gb\s*$/i, "");
  const sto = (getStorage(p) || "").toString().replace(/\s*gb\s*$/i, "");

  if (tipo.includes("ipad")) {
    const is13 = /^(13(\.\d+)?)$/.test(sizeNorm) || /^12\.9$/.test(sizeNorm);
    const is11 = /^11(\.\d+)?$/.test(sizeNorm);

    if (is13) {
      const gen = "4th gen";
      return ["iPad Pro 12.9", gen, sto && `${sto}GB`].filter(Boolean).join(" ");
    }
    if (is11) {
      const gen = "5th gen";
      return ["iPad Air", gen, sto && `${sto}GB`].filter(Boolean).join(" ");
    }
    return ["iPad", gama, sto && `${sto}GB`].filter(Boolean).join(" ");
  }

  if (tipo.includes("macbook")) {
    let cpu = cpuOverride && cpuOverride.trim();
    if (!cpu) {
      const opts = cpuOptionsForMac(p);
      cpu = opts[0] || (getProcesador(p) || "").trim() || "";
    }
    const parts = ["MacBook", gama, cpu, sizeNorm && `${sizeNorm}"`].filter(Boolean);
    const tail = [ram && `${ram} RAM`, sto && `${sto}GB`].filter(Boolean);
    return [...parts, ...tail].join(" ");
  }

  if (tipo.includes("iphone")) {
    const numero = String(getNumero(p) || "").trim();
    const modeloDetalle = String(getModelo(p) || "").trim();
    const gamaIphone = String(getGama(p) || "").trim();
    if (numero || modeloDetalle || gamaIphone) {
      const modelo = modeloDetalle || gamaIphone;
      return ["iPhone", numero, modelo, sto && `${sto}GB`].filter(Boolean).join(" ");
    }
    const tipoRest = tipoRaw.replace(/iphone\s*/i, "").trim();
    const gamaRaw = (getGama(p) || "").trim();
    const modeloRaw = String(p?.modelo || "").trim();
    let modelo = "";
    if (tipoRest) {
      modelo = tipoRest;
      const hasSuffix = /pro|max|plus|mini|se/i.test(modelo);
      if (gamaRaw && !modelo.toLowerCase().includes(gamaRaw.toLowerCase())) {
        if (hasSuffix || /pro|max|plus|mini|se/i.test(gamaRaw)) {
          modelo = `${modelo} ${gamaRaw}`.trim();
        }
      }
    } else if (gamaRaw) {
      modelo = gamaRaw;
    } else if (modeloRaw) {
      modelo = modeloRaw;
    }
    const title = modelo ? `iPhone ${modelo}`.trim() : "iPhone";
    return [title, sto && `${sto}GB`].filter(Boolean).join(" ");
  }

  if (tipo.includes("otro")) {
    const desc = String(getDescripcionOtro(p) || "").trim();
    return desc || "Producto";
  }

  return [p.tipo, gama, sizeNorm && `${sizeNorm}"`, getProcesador(p), ram && `${ram} RAM`, sto && `${sto}GB`]
    .filter(Boolean)
    .join(" ");
}

/* --------- Problema aleatorio según tipo --------- */
function randomProblemForProduct(p) {
  const tipo = String(p?.tipo || "").toLowerCase();
  if (tipo.includes("macbook")) return pickOne(PROBLEMS.macbook);
  if (tipo.includes("ipad")) return pickOne(PROBLEMS.ipad);
  if (tipo.includes("iphone")) return pickOne(PROBLEMS.iphone);
  return pickOne([].concat(PROBLEMS.macbook, PROBLEMS.ipad, PROBLEMS.iphone));
}

/* --------- Resolver casillero automáticamente --------- */
function stripDiacritics(s) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function slug(s) {
  return stripDiacritics(String(s || "").toLowerCase()).replace(/\s+/g, "");
}
const CAS_INDEX = Object.entries(CASILLEROS).map(([key, value]) => {
  const digits = (value.match(/\d+/g) || []).join("");
  return { key, value, digits, keySlug: slug(key), valSlug: slug(value) };
});

/** "Crudo" desde el producto para mostrar referencia */
function getRawCasillero(p) {
  if (!p) return "";
  const t0 = Array.isArray(p?.tracking) ? p.tracking[0] : (p.tracking || {});
  return String(
    t0?.casillero ??
    t0?.casilleroAsignado ??
    t0?.casilleroNombre ??
    t0?.destinatario ??
    p?.casillero ??
    p?.detalle?.casillero ??
    p?.destinatario ??
    ""
  ).trim();
}
function resolveCasilleroKey(raw) {
  const rawStr = String(raw || "");
  if (!rawStr) return null;

  const s = slug(rawStr);
  const digits = (rawStr.match(/\d+/g) || []).join("");

  const byKey = CAS_INDEX.find(e => e.keySlug === s);
  if (byKey) return byKey.key;

  const byVal = CAS_INDEX.find(e => e.valSlug.includes(s) || s.includes(e.valSlug));
  if (byVal) return byVal.key;

  if (digits) {
    const byDigits = CAS_INDEX.find(e => e.digits && (digits.includes(e.digits) || e.digits.includes(digits)));
    if (byDigits) return byDigits.key;
  }
  return null;
}
function resolveCasilleroKeyFromProducto(p) {
  return resolveCasilleroKey(getRawCasillero(p));
}

/* Helpers tracking en producto (solo para UI, NO se imprime en el HTML) */
function getT0(p) {
  if (!p) return null;
  return Array.isArray(p.tracking) ? p.tracking[0] : (p.tracking || null);
}
function getCarrier(p) {
  const t = getT0(p);
  return (t?.transportista || t?.carrier || "").toString().trim();
}
function getCarrierTracking(p) {
  const t = getT0(p);
  return (
    t?.trackingUsa ||
    t?.trackingUSA ||
    t?.tracking ||
    t?.numeroTracking ||
    ""
  ).toString().trim();
}
function getGroupKey(p) {
  return p?.envioGrupoId ?? p?.envioGrupo ?? p?.envioGrupoID ?? null;
}

/* --------- HTML builder (Shipping siempre Free con clase POSITIVE) --------- */
function buildModalContentHTML({
  seller,
  placedOn,
  orderNumber,
  casilleroKey,
  qty,
  price,        // ? DEC (unit price)
  itemName,
  shippingSvc,
  items,
}) {
  const paidOn = placedOn;
  const placedOnTxt = fmtDateUS(placedOn);
  const paidOnTxt = fmtDateUS(paidOn);

  const safeItems = Array.isArray(items) && items.length
    ? items
    : [{ qty: Math.max(1, Number(qty) || 1), name: itemName || "", price: Number(price) || 0, shippingSvc }];
  const itemsCount = safeItems.reduce((s, it) => s + (Number(it.qty) || 1), 0);
  const subtotal = safeItems.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 1), 0);
  const orderTotal = subtotal; // envio Free y Tax 0
  const itemsLabel = `${itemsCount} item${itemsCount === 1 ? "" : "s"}`;
  const shipName = CASILLEROS[casilleroKey] || "";

  return `
<div class="modal-content">
  <div>
    <div class="printer-friendly-content no-break portrait">
      <div class="gen-tables">
        <div class="gen-tables-page">
          <div class="gen-table-wrap">
            <div class="gen-table">
              <div class="pf-logo">
                <img width="250" height="200" alt="eBay Logo" src="https://ir.ebaystatic.com/rs/v/fxxj3ttftm5ltcqnto1o4baovyl.png">
              </div>
              <div class="gen-table-header"></div>

              <div class="gen-table-row">
                <div class="gen-table-cell">
                  <div class="section">
                    <div class="section-title-box">
                      <h2 class="section-title-header">
                        <span class="textual-display"><span class="eui-textual-display"><span class="eui-text-span"><span>Order information</span></span></span></span>
                      </h2>
                    </div>
                    <div class="section-data-items">
                      <div class="vodlabelsValues">
                        <dl class="eui-labels-values eui-label-value--table">
                          <div class="eui-label-value-line">
                            <dt class="eui-label"><span class="eui-textual-display"><span class="eui-text-span"><span>Buyer</span></span></span></dt>
                            <dd><span class="eui-textual-display"><span class="eui-text-span"><span>renato1_9</span></span></span></dd>
                          </div>
                        </dl>
                      </div>

                      <div class="vodlabelsValues">
                        <dl class="eui-labels-values eui-label-value--table">
                          <div class="eui-label-value-line">
                            <dt class="eui-label"><span class="eui-textual-display"><span class="eui-text-span"><span>Seller</span></span></span></dt>
                            <dd><span class="eui-textual-display"><span class="eui-text-span"><span>${seller || ""}</span></span></span></dd>
                          </div>
                        </dl>
                      </div>

                      <div class="vodlabelsValues">
                        <dl class="eui-labels-values eui-label-value--table">
                          <div class="eui-label-value-line">
                            <dt class="eui-label"><span class="eui-textual-display"><span class="eui-text-span"><span>Placed on</span></span></span></dt>
                            <dd><span class="eui-textual-display"><span class="eui-text-span"><span>${placedOnTxt}</span></span></span></dd>
                          </div>
                        </dl>
                      </div>

                      <div class="vodlabelsValues">
                        <dl class="eui-labels-values eui-label-value--table">
                          <div class="eui-label-value-line">
                            <dt class="eui-label"><span class="eui-textual-display"><span class="eui-text-span"><span>Payment method</span></span></span></dt>
                            <dd><span class="eui-textual-display"><span class="eui-text-span"><span>PayPal</span></span></span></dd>
                          </div>
                        </dl>
                      </div>

                      <div class="vodlabelsValues">
                        <dl class="eui-labels-values eui-label-value--table">
                          <div class="eui-label-value-line">
                            <dt class="eui-label"><span class="eui-textual-display"><span class="eui-text-span"><span>Paid on</span></span></span></dt>
                            <dd><span class="eui-textual-display"><span class="eui-text-span"><span>${paidOnTxt}</span></span></span></dd>
                          </div>
                        </dl>
                      </div>

                    </div>
                  </div>
                </div>

                <div class="gen-table-cell">
                  <div class="section">
                    <div class="section-title-box">
                      <h2 class="section-title-header">
                        <span class="textual-display"><span class="eui-textual-display"><span class="eui-text-span"><span>Shipping address</span></span></span></span>
                      </h2>
                    </div>
                    <div class="section-data-items">
                      <p><span class="textual-display"><span class="eui-textual-display"><span class="eui-text-span"><span>${shipName}</span></span></span></span></p>
                      <p><span class="textual-display"><span class="eui-textual-display"><span class="eui-text-span"><span>9990 NW 14th Street</span></span><span class="eui-text-span"><span>, </span></span><span class="eui-text-span"><span>Ste 110</span></span></span></span></p>
                      <p><span class="textual-display"><span class="eui-textual-display"><span class="eui-text-span"><span>Doral</span></span><span class="eui-text-span"><span>, </span></span><span class="eui-text-span"><span>Florida</span></span><span class="eui-text-span"><span> </span></span><span class="eui-text-span"><span>33192-2702</span></span></span></span></p>
                      <p><span class="textual-display"><span class="eui-textual-display"><span class="eui-text-span"><span>United States</span></span></span></span></p>
                    </div>
                  </div>
                </div>

                <div class="gen-table-cell">
                  <div class="section-module bar-sections">
                    <div class="section-module-header">
                      <div class="section-module-title-box">
                        <h2 class="section-module-title">
                          <span class="textual-display"><span class="eui-textual-display"><span class="eui-text-span"><span>Order total</span></span></span></span>
                        </h2>
                      </div>
                    </div>
                    <div class="section-module-content">
                      <div class="section-module-sections">
                        <div class="section">
                          <div class="section-data-items">
                            <div class="vodlabelsValues">
                              <dl class="eui-labels-values eui-label-value--table">
                                <div class="eui-label-value-line">
                                  <dt class="eui-label"><span class="eui-textual-display"><span class="eui-text-span"><span>${itemsLabel}</span></span></span></dt>
                                  <dd><span class="eui-textual-display"><span class="eui-text-span"><span>${fmtUSD(subtotal)}</span></span></span></dd>
                                </div>
                              </dl>
                            </div>

                            <div class="vodlabelsValues">
                              <dl class="eui-labels-values eui-label-value--table">
                                <div class="eui-label-value-line">
                                  <dt class="eui-label"><span class="eui-textual-display"><span class="eui-text-span"><span>Shipping</span></span></span></dt>
                                  <dd><span class="eui-textual-display"><span class="eui-text-span"><span class="POSITIVE">Free</span></span></span></dd>
                                </div>
                              </dl>
                            </div>

                            <div class="vodlabelsValues">
                              <dl class="eui-labels-values eui-label-value--table">
                                <div class="eui-label-value-line">
                                  <dt class="eui-label"><span class="eui-textual-display"><span class="eui-text-span"><span>Tax*</span></span></span></dt>
                                  <dd><span class="eui-textual-display"><span class="eui-text-span"><span>$0.00</span></span></span></dd>
                                </div>
                              </dl>
                            </div>
                          </div>
                        </div>

                        <hr />

                        <div class="section">
                          <div class="section-data-items">
                            <div class="vodlabelsValues">
                              <dl class="eui-labels-values eui-label-value--table">
                                <div class="eui-label-value-line">
                                  <dt class="eui-label"><span class="eui-textual-display"><span class="eui-text-span"><span class="BOLD">Order total</span></span></span></dt>
                                  <dd><span class="eui-textual-display"><span class="eui-text-span"><span>${fmtUSD(orderTotal)}</span></span></span></dd>
                                </div>
                              </dl>
                            </div>
                          </div>
                          <div class="section-foot-notes">
                            <p class="section-foot-note"><span class="textual-display"><span class="eui-textual-display"><span class="eui-text-span"><span>*We're required by law to collect sales tax and applicable fees for certain tax authorities.</span></span></span></span></p>
                            <p class="section-foot-note"><span class="textual-display"><a class="eui-textual-display eui-textual-display--action" href="https://www.ebay.com/help/buying/paying-items/paying-tax-ebay-purchases?id=4771" target="_blank" rel="noopener noreferrer"><span class="eui-text-span"><span class="legal-link">Learn more</span></span></a></span></p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div> <!-- /gen-table-cell -->
              </div> <!-- /gen-table-row -->

              <!-- Bloque inferior con tabla de ítems -->
              <div class="gen-table-row">
                <div class="gen-table-cell">
                  <div class="item-details underline">
                    <div class="item-details-header">
                      <div class="item-details-title-box">
                        <h2 class="item-details-title">
                          <span class="textual-display"><span class="eui-textual-display"><span class="eui-text-span"><span>Items bought from ${seller || ""}</span></span></span></span>
                        </h2>
                      </div>
                      <div class="item-details-sub-title-box qm-element-masked">
                        <h3 class="item-details-sub-title">
                          <span class="textual-display"><span class="eui-textual-display"><span class="eui-text-span"><span>Order number: ${orderNumber || ""}</span></span></span></span>
                        </h3>
                      </div>
                    </div>

                    <div class="details-table-section">
                      <table class="details-table">
                        <caption class="clipped">Items bought from ${seller || ""}</caption>
                        <thead>
                          <tr>
                            <th><span class="textual-display"><span class="eui-textual-display"><span class="eui-text-span"><span>Quantity</span></span></span></span></th>
                            <th><span class="textual-display"><span class="eui-textual-display"><span class="eui-text-span"><span>Item name</span></span></span></span></th>
                            <th><span class="textual-display"><span class="eui-textual-display"><span class="eui-text-span"><span>Shipping service</span></span></span></span></th>
                            <th><span class="textual-display"><span class="eui-textual-display"><span class="eui-text-span"><span>Item price</span></span></span></span></th>
                          </tr>
                        </thead>
                        <tbody>
${safeItems.map((it) => `
                          <tr>
                            <td><span class="textual-display"><span class="eui-textual-display"><span class="eui-text-span"><span>${Math.max(1, Number(it.qty) || 1)}</span></span></span></span></td>
                            <td><span class="textual-display"><span class="eui-textual-display"><span class="eui-text-span"><span>${it.name || ""}</span></span></span></span></td>
                            <td><span class="textual-display"><span class="eui-textual-display"><span class="eui-text-span"><span>${it.shippingSvc || "Standard Shipping"}</span></span></span></span></td>
                            <td><span class="textual-display"><span class="eui-textual-display"><span class="eui-text-span"><span>${fmtUSD(Number(it.price) || 0)}</span></span></span></span></td>
                          </tr>
`).join("")}
                        </tbody>
                      </table>
                    </div>

                  </div>
                </div>
              </div> <!-- /gen-table-row (inferior) -->

            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
`.trim();
}

/* ================== Componente ================== */
export default function ModalDec({ onClose, productos: productosProp, loading: loadingProp = false }) {
  // Si te pasan productos por props, se usan; si no, cargo del backend.
  const [productosApi, setProductosApi] = useState([]);
  const [loadingApi, setLoadingApi] = useState(true);
  const loading = loadingProp || loadingApi;
  const [localOverrides, setLocalOverrides] = useState({});

  // UI
  const [hardError, setHardError] = useState("");
  const [productoSel, setProductoSel] = useState(null);

  // N?cleo de nombre y problema
  const [nameCore, setNameCore] = useState("");       // sin problema
  const [problemSuffix, setProblemSuffix] = useState(""); // solo el problema

  // Form
  const [seller, setSeller] = useState("961firstave");
  const [placedOn, setPlacedOn] = useState(""); // YYYY-MM-DD
  const [orderNumber, setOrderNumber] = useState("");
  const [casilleroKey, setCasilleroKey] = useState("Renato");
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState("0.00"); // DEC
  const [itemName, setItemName] = useState("");
  const [shippingSvc, setShippingSvc] = useState("Standard Shipping");
  const [savingFactura, setSavingFactura] = useState(false);
  const [randomNames, setRandomNames] = useState({});
  const [linkedItemNames, setLinkedItemNames] = useState({});
  const resetSeleccion = () => {
    setProductoSel(null);
    setNameCore("");
    setProblemSuffix("");
    setItemName("");
    setPlacedOn("");
    setOrderNumber("");
    setQty(1);
    setPrice("0.00");
    setShippingSvc("Standard Shipping");
    setCasilleroKey("Renato");
  };

  // 1) Si NO vienen productos por props, cargar del backend
  useEffect(() => {
    let mounted = true;
    if (productosProp && productosProp.length) {
      setLoadingApi(false);
      return;
    }
    (async () => {
      try {
        setLoadingApi(true);
        setHardError("");
        const data = await api.get("/productos");
        const list = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
        if (mounted) setProductosApi(list);
      } catch (e) {
        if (mounted) setHardError("No se pudieron cargar los productos.");
      } finally {
        if (mounted) setLoadingApi(false);
      }
    })();
    return () => { mounted = false; };
  }, [productosProp]);

  // Fuente ?nica
  const productosAll = useMemo(() => {
    const base = productosProp && productosProp.length ? productosProp : productosApi;
    if (!localOverrides || Object.keys(localOverrides).length === 0) return base;
    return (base || []).map((item) =>
      localOverrides[item?.id] ? { ...item, ...localOverrides[item.id] } : item
    );
  }, [productosProp, productosApi, localOverrides]);

  // Filtrado: "en camino"
  const productosEnCamino = useMemo(
    () => (productosAll || []).filter((p) => isEnCaminoCliente(p) && !p?.facturaDecSubida),
    [productosAll]
  );

  // Lectores: DEC + fecha de compra
  const pickDec = (p) => {
    if (p?.dec != null) return p.dec;
    if (p?.valor?.valorDec != null) return p.valor.valorDec;
    return 0;
  };
  const pickValorProducto = (p) => {
    if (p?.valor?.valorProducto != null) return p.valor.valorProducto;
    if (p?.valorProducto != null) return p.valorProducto;
    return 0;
  };

  // Al elegir un producto
  const onPickProducto = (idStr) => {
    const p = productosEnCamino.find((x) => String(x.id) === String(idStr)) || null;

    if (!p) {
      setProductoSel(null);
      return;
    }

    // DEC -> precio
    const decVal = pickDec(p);
    const decClean = cleanMoneyToString(decVal);

    // Fecha de compra
    const fechaCompra = p?.valor?.fechaCompra || p?.fechaCompra;

    // Nombre base (sin problema)
    const core = buildCoreName(p);

    // Casillero autom?tico (si lo puedo resolver)
    const autoKey = resolveCasilleroKeyFromProducto(p);

    // Set del producto NUEVO y derivados
    setProductoSel({ ...p, __decResolved: decClean });

    setNameCore(core);
    setProblemSuffix("");               // limpia el problema al cambiar de producto
    setRandomNames({});
    setLinkedItemNames({});
    setPrice(decClean);
    setPlacedOn(toYYYYMMDD(fechaCompra));
    if (autoKey) setCasilleroKey(autoKey);
  };

  // Si cambia el producto seleccionado, re-sincroniza casillero automáticamente
  useEffect(() => {
    if (!productoSel) return;
    const autoKey = resolveCasilleroKeyFromProducto(productoSel);
    if (autoKey) setCasilleroKey(autoKey);
  }, [productoSel]);

  // ?? CPU aleatoria (Mac) + problema aleatorio al final
  const rollName = () => {
    if (!productoSel) return;
    const tipo = normalize(productoSel?.tipo);
    let core = buildCoreName(productoSel);
    if (tipo.includes("macbook")) {
      const opts = cpuOptionsForMac(productoSel);
      const cpu = pickOne(opts);
      core = buildCoreName(productoSel, cpu);
    }
    const prob = randomProblemForProduct(productoSel);
    const full = core + (prob ? ` ${prob}` : "");
    setNameCore(core);
    setProblemSuffix(prob || "");
    setRandomNames((prev) => ({ ...prev, [productoSel.id]: { core, problem: prob, full } }));
  };

  const rollLinkedName = (p) => {
    if (!p) return;
    const tipo = normalize(p?.tipo);
    let core = buildCoreName(p);
    if (tipo.includes("macbook")) {
      const opts = cpuOptionsForMac(p);
      const cpu = pickOne(opts);
      core = buildCoreName(p, cpu);
    }
    const prob = randomProblemForProduct(p);
    const full = core + (prob ? ` ${prob}` : "");
    setRandomNames((prev) => ({ ...prev, [p.id]: { core, problem: prob, full } }));
    setLinkedItemNames((prev) => ({ ...prev, [p.id]: full }));
    if (p?.id === productoSel?.id) {
      setNameCore(core);
      setProblemSuffix(prob || "");
    }
  };

  // itemName = core + (opcional) problema
  useEffect(() => {
    setItemName(nameCore + (problemSuffix ? ` ${problemSuffix}` : ""));
  }, [nameCore, problemSuffix]);

  // Edición manual: reemplaza el core y borra problema
  const onEditItemName = (val) => {
    setItemName(val);
    setNameCore(val);
    setProblemSuffix("");
    if (productoSel?.id != null) {
      setLinkedItemNames((prev) => ({ ...prev, [productoSel.id]: val }));
    }
  };

  // Derivados de tracking SOLO para mostrar en UI (no van al HTML)
  const carrier = getCarrier(productoSel);
  const carrierTracking = getCarrierTracking(productoSel);

  const linkedGroup = useMemo(() => {
    const groupKey = getGroupKey(productoSel);
    if (!groupKey) return [];
    return (productosAll || []).filter((p) => getGroupKey(p) === groupKey);
  }, [productoSel, productosAll]);

  const linkedItems = useMemo(() => {
    if (!productoSel) return null;
    const group = linkedGroup.length > 1 ? linkedGroup : [];
    if (group.length <= 1) return null;
    const totalReal = group.reduce((s, p) => s + (Number(pickValorProducto(p)) || 0), 0);
    const totalDec = group.reduce((s, p) => s + (Number(pickDec(p)) || 0), 0);
    const baseDec = (Number(pickDec(productoSel)) || 0) || totalDec;
    const fallbackShare = group.length ? 1 / group.length : 1;
    let used = 0;
    return group.map((p, idx) => {
      const real = Number(pickValorProducto(p)) || 0;
      const share = totalReal > 0 ? (real / totalReal) : fallbackShare;
      const isLast = idx === group.length - 1;
      const price = isLast
        ? +(baseDec - used).toFixed(2)
        : +((baseDec * share).toFixed(2));
      used += price;
      const override = linkedItemNames[p.id];
      const name = p?.id === productoSel?.id
        ? (itemName || override || buildCoreName(p))
        : (override || randomNames[p.id]?.full || buildCoreName(p));
      return {
        qty: 1,
        name,
        price,
        shippingSvc,
      };
    });
  }, [productoSel, linkedGroup, shippingSvc, itemName, randomNames, linkedItemNames]);

  const html = useMemo(
    () =>
      buildModalContentHTML({
        seller,
        placedOn,
        orderNumber,
        casilleroKey,
        qty,
        price,       // ? DEC
        itemName,
        shippingSvc,
        items: linkedItems,
      }),
    [seller, placedOn, orderNumber, casilleroKey, qty, price, itemName, shippingSvc, linkedItems]
  );

  // Cerrar con ESC
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleOverlayClick = (e) => { if (e.target === e.currentTarget) onClose?.(); };

  const copyHTML = async () => {
    try { await navigator.clipboard.writeText(html); alert("HTML copiado al portapapeles ?"); }
    catch {
      const ta = document.getElementById("dec-html-ta");
      if (ta) { ta.select(); document.execCommand("copy"); alert("HTML copiado (fallback) ?"); }
    }
  };
  const copySelector = async () => { try { await navigator.clipboard.writeText('class="gen-tables"'); } catch { } };
  const facturaMarcada = Boolean(productoSel?.facturaDecSubida);
  const toggleFacturaMarcada = async () => {
    if (!productoSel || savingFactura || facturaMarcada) return;
    const nextValue = true;
    setSavingFactura(true);
    try {
      const updated = await api.patch(`/productos/${productoSel.id}`, {
        facturaDecSubida: nextValue,
      });
      const base = updated?.id ? updated : { ...productoSel, facturaDecSubida: nextValue };
      const merged = productoSel?.__decResolved != null
        ? { ...base, __decResolved: productoSel.__decResolved }
        : base;
      setProductoSel(merged);
      setLocalOverrides((prev) => ({
        ...prev,
        [merged.id]: { ...(prev[merged.id] || {}), facturaDecSubida: merged.facturaDecSubida },
      }));
      setProductosApi((prev) => {
        if (!Array.isArray(prev) || prev.length === 0) return prev;
        return prev.map((item) =>
          item?.id === merged.id ? { ...item, facturaDecSubida: merged.facturaDecSubida } : item
        );
      });
      setTimeout(resetSeleccion, 350);
    } catch (err) {
      console.error('[ModalDec] Error al marcar factura DEC:', err);
      alert('No se pudo actualizar el estado de la factura.');
    } finally {
      setSavingFactura(false);
    }
  };

  const disabledSelect = loading || !!hardError;
  const rawCas = getRawCasillero(productoSel);

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4"
      onClick={handleOverlayClick}
      aria-modal="true"
      role="dialog"
    >
      <div className="w-full max-w-5xl bg-white rounded-xl shadow-xl" onClick={(e) => e.stopPropagation()}>
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b">
          <h2 className="text-base font-semibold">Generar HTML - Printer friendly (solo textos)</h2>
          <button onClick={onClose} className="text-gray-700 hover:text-black text-sm" aria-label="Close modal">&lt; Back</button>
        </div>

        {/* Productos */}
        <div className="grid gap-4 p-4 sm:p-6 border-b">
          {hardError ? (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{hardError}</div>
          ) : null}

          <div className="grid sm:grid-cols-4 gap-3">
            <label className="text-sm sm:col-span-2">
              <span className="block text-gray-600 mb-1">Producto (en camino)</span>
              <select
                className="input"
                value={productoSel?.id ?? ""}
                onChange={(e) => onPickProducto(e.target.value)}
                disabled={disabledSelect}
              >
                <option value="">
                  {loading
                    ? "Cargando productos..."
                    : productosEnCamino.length
                      ? "- Seleccionar -"
                      : "- Sin resultados (en camino) -"}
                </option>
                {!loading &&
                  productosEnCamino.map((p) => (
                    <option key={p.id} value={p.id}>
                      {labelForDropdown(p)} {/* incluye PROCESADOR en el combo */}
                    </option>
                  ))}
              </select>
            </label>

            {/* Valor DEC solo lectura */}
            <label className="text-sm">
              <span className="block text-gray-600 mb-1">Valor DEC</span>
              <input className="input" value={productoSel?.__decResolved || ""} readOnly placeholder="-" />
            </label>

            {/* Casillero único (afecta al HTML) */}
            <label className="text-sm">
              <span className="block text-gray-600 mb-1">Casillero</span>
              <select
                className="input"
                value={casilleroKey}
                onChange={(e) => setCasilleroKey(e.target.value)}
              >
                {Object.entries(CASILLEROS).map(([k, full]) => (
                  <option key={k} value={k}>{full}</option>
                ))}
              </select>
              <div className="text-[11px] text-gray-500 mt-1">
                Detectado del producto: {rawCas || "-"}
              </div>
            </label>
          </div>

          {/* Form datos de la orden */}
          <div className="grid sm:grid-cols-3 gap-3 mt-2">
            <label className="text-sm">
              <span className="block text-gray-600 mb-1">Seller</span>
              <input value={seller} onChange={(e) => setSeller(e.target.value)} className="input" placeholder="961firstave" />
            </label>
            <label className="text-sm">
              <span className="block text-gray-600 mb-1">Fecha de compra</span>
              <input type="date" value={placedOn} onChange={(e) => setPlacedOn(e.target.value)} className="input" />
            </label>
            <label className="text-sm">
              <span className="block text-gray-600 mb-1">Order number</span>
              <input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} className="input" placeholder="16-13587-70764" />
            </label>
          </div>

          {/* Tracking del transportista (solo lectura, NO va al HTML) */}
          <div className="grid sm:grid-cols-3 gap-3">
            <label className="text-sm">
              <span className="block text-gray-600 mb-1">Transportista</span>
              <input className="input" value={carrier || ""} readOnly placeholder="-" />
            </label>
            <label className="text-sm">
              <span className="block text-gray-600 mb-1">Tracking #</span>
              <input className="input" value={carrierTracking || ""} readOnly placeholder="-" />
            </label>
            <div />
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <label className="text-sm sm:col-span-2">
              <span className="block text-gray-600 mb-1">Item name</span>
              <div className="flex gap-2">
                <input
                  value={itemName}
                  onChange={(e) => onEditItemName(e.target.value)}
                  className="input flex-1"
                  placeholder='Ej. MacBook Pro i7 13" 16GB RAM 512GB Screen cracked'
                />
                <button
                  type="button"
                  onClick={rollName}
                  title="Elegir CPU (Mac) + problema aleatorio"
                  className="px-3 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700"
                  disabled={!productoSel}
                >
                  <FaDice className="text-base" />
                </button>
              </div>
            </label>
            <label className="text-sm">
              <span className="block text-gray-600 mb-1">Shipping service</span>
              <input value={shippingSvc} onChange={(e) => setShippingSvc(e.target.value)} className="input" placeholder="Standard Shipping" />
            </label>
          </div>

          {linkedGroup.length > 1 ? (
            <div className="grid sm:grid-cols-2 gap-3">
              {linkedGroup.filter((p) => p?.id !== productoSel?.id).map((p) => {
                const value = linkedItemNames[p.id] || randomNames[p.id]?.full || buildCoreName(p);
                return (
                  <label key={p.id} className="text-[11px] text-gray-600">
                    <span className="block mb-1">Item name vinculado #{p.id}</span>
                    <div className="flex gap-2">
                      <input
                        className="input text-xs py-1.5 flex-1"
                        value={value}
                        onChange={(e) =>
                          setLinkedItemNames((prev) => ({ ...prev, [p.id]: e.target.value }))
                        }
                      />
                      <button
                        type="button"
                        onClick={() => rollLinkedName(p)}
                        title="Generar item name"
                        className="px-2 rounded-lg bg-indigo-600 text-white text-xs hover:bg-indigo-700"
                      >
                        <FaDice className="text-sm" />
                      </button>
                    </div>
                  </label>
                );
              })}
            </div>
          ) : null}
        </div>

        {/* Resultado HTML */}
        <div className="p-4 sm:p-6">
          <div className="flex items-start justify-between mb-2 gap-4">
            <div>
              <h3 className="font-semibold">HTML (solo "modal-content")</h3>
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-1">
                Recordatorio: busca <code>class="gen-tables"</code> en tu DOM para pegar este HTML.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={copySelector} className="px-3 py-1.5 rounded border border-gray-300 text-sm hover:bg-gray-50 h-9">Copiar selector</button>
              <button onClick={copyHTML} className="px-3 py-1.5 rounded bg-black text-white text-sm hover:bg-gray-900 h-9">Copiar HTML</button>
              <button
                type="button"
                onClick={toggleFacturaMarcada}
                disabled={!productoSel || savingFactura || facturaMarcada}
                className={`px-3 py-1.5 rounded text-sm h-9 border transition ${
                  facturaMarcada
                    ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                } ${(!productoSel || savingFactura || facturaMarcada) ? 'opacity-60 cursor-not-allowed' : ''}`}
                title={productoSel ? 'Marca cuando la factura ya fue subida' : 'Selecciona un producto primero'}
              >
                {facturaMarcada ? 'Factura subida' : 'Subir factura'}
              </button>
            </div>
          </div>

          <textarea id="dec-html-ta" className="w-full max-w-md h-[200px] border rounded p-3 font-mono text-xs resize-none" readOnly value={html} />
          <p className="text-xs text-gray-500 mt-2">
            Copia este bloque y reemplaza en el DOM únicamente la parte <code>&lt;div class="modal-content"&gt;...&lt;/div&gt;</code>.
          </p>
        </div>
      </div>

      {/* Tailwind helpers */}
      <style>{`
        .input{ width:100%; border:1px solid #d1d5db; border-radius:0.5rem; padding:0.5rem 0.75rem; outline:none; }
        .input:focus{ box-shadow:0 0 0 3px rgba(99,102,241,.2); border-color:#6366f1; }
      `}</style>
    </div>
  );
}


