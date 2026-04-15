// src/components/ModalDec.js
import React, { useMemo, useState, useEffect, useRef } from "react";
import api, { API_URL } from "../api";
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
  Sebastian: "Sebastian Arturo Zenteno PEZ105183",
};
const DEC_FORM_EMAIL_BY_CASILLERO = {
  Walter: "gongarc2001@gmail.com",
  Renato: "renato1carbajal@gmail.com",
  Christian: "limonimofelip@gmail.com",
  Alex: "dracgonic12@gmail.com",
  MamaRen: "renato1carbajal@outlook.com",
  Jorge: "goneba2526@gmail.com",
  Kenny: "gondrac10@gmail.com",
  Sebastian: "macsominus@gmail.com",
};
const DEC_FORM_CLIP_PREFIX = "DEC_AUTOFILL:";
const DEC_FORM_TARGET_URL_KEY = "decAutofillTargetUrl";
const DEFAULT_DEC_FORM_TARGET_URL = "https://www.eshopex.com/pe/prealerta_cb0.aspx";

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
const EBAY_LOGO = "https://ir.ebaystatic.com/rs/v/fxxj3ttftm5ltcqnto1o4baovyl.png";

/* ---------- Helpers ---------- */
function fmtUSD(n) {
  const num = Number(n) || 0;
  return `$${num.toFixed(2)}`;
}
function fmtDateUS(d, options = {}) {
  if (!d) return "";
  const dt = new Date(`${d}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return "";
  const baseOptions = { month: "short", day: "numeric", year: "numeric" };
  return dt.toLocaleDateString("en-US", { ...baseOptions, ...(options || {}) });
}
function dateToYMD(dt) {
  if (!(dt instanceof Date) || Number.isNaN(dt.getTime())) return "";
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function addDaysYMD(ymd, days) {
  if (!ymd) return "";
  const dt = new Date(`${ymd}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return "";
  dt.setDate(dt.getDate() + Number(days || 0));
  return dateToYMD(dt);
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
function normalizeExternalProductLabel(input) {
  const s = normalize(input);
  if (s.includes("macbook")) return "MacBook piezas";
  if (s.includes("iphone")) return "iPhone piezas";
  if (s.includes("watch")) return "Apple Watch piezas";
  if (s.includes("ipad")) return "iPad piezas";
  return "Apple piezas";
}
function encodeAutofillPayload(payload) {
  try {
    return window.btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  } catch {
    return "";
  }
}
function buildAutofillUrl(baseUrl, payload) {
  const rawBase = String(baseUrl || "").trim();
  if (!rawBase) return "";
  try {
    const url = new URL(rawBase);
    const hashParams = new URLSearchParams(String(url.hash || "").replace(/^#/, ""));
    hashParams.set("decfill", encodeAutofillPayload(payload));
    url.hash = hashParams.toString();
    return url.toString();
  } catch {
    return "";
  }
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

function buildAmazonTemplateHTML({
  placedOn,
  orderNumber,
  casilleroKey,
  qty,
  price,
  itemName,
  items,
  deliveryHeadline,
  imageSmall,
  imageLarge,
}) {
  const safeItems = Array.isArray(items) && items.length
    ? items
    : [{ qty: Math.max(1, Number(qty) || 1), name: itemName || "", price: Number(price) || 0 }];
  const subtotal = safeItems.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 1), 0);
  const grandTotal = subtotal;
  const shipName = CASILLEROS[casilleroKey] || "";
  const placedOnTxt = fmtDateUSLong(placedOn);
  const deliveryText = String(deliveryHeadline || "Delivered tomorrow").trim();
  const eligibleThroughTxt = amazonEligibleThroughFor(deliveryText, placedOn);
  const showEligibleLine = shouldShowAmazonEligibleLine(deliveryText);
  const deliveryHeading = deliveryText.toLowerCase().startsWith("delivered ")
    ? deliveryText.replace(/^Delivered\s*/i, '<span class="a-text-bold">Delivered </span><span class="a-text-bold a-nowrap">')
        .replace(/$/, "</span>")
    : `<span class="a-text-bold">${esc(deliveryText)}</span>`;

  const itemsHtml = safeItems.map((it) => `
  <div class="a-row a-spacing-top-base">
    <div class="a-fixed-left-grid a-spacing-none"><div class="a-fixed-left-grid-inner" style="padding-left:100px">
      <div class="a-fixed-left-grid-col a-col-left" style="width:100px;margin-left:-100px;float:left;">
        <div class="" data-component="itemImage">
          <div class="aok-relative">
            <a class="a-link-normal" href="#" keepapreview="pf_prevImg">
              <img alt="${esc(it.name || "")}" src="${esc(it.imageSmall || imageSmall || DEFAULT_IMAGE_SRC)}" height="90" width="90" data-a-hires="${esc(it.imageLarge || it.imageSmall || imageLarge || imageSmall || DEFAULT_IMAGE_SRC)}">
            </a>
          </div>
        </div>
      </div>
      <div class="a-fixed-left-grid-col a-col-right" style="padding-left:1.5%;float:left;">
        <div class="" data-component="itemTitle">
          <div class="a-row"><a class="a-link-normal" href="#" keepapreview="pf_prevImg">${esc(it.name || "")}</a></div>
        </div>
        <div class="" data-component="orderedMerchant">
          <span class="a-size-small a-color-secondary">Sold by: Amazon.com</span>
        </div>
        <div class="" data-component="supplierOfRecord">
          <span class="a-size-small a-color-secondary">Supplied by: Other</span>
        </div>
        ${showEligibleLine ? `
        <div class="" data-component="itemReturnEligibility">
          <div class="a-row">
            <span class="a-size-small">Return or replace items: Eligible through ${esc(eligibleThroughTxt || "")}</span>
          </div>
        </div>` : ""}
        ${Math.max(1, Number(it.qty) || 1) > 1 ? `<div class="od-item-view-qty"><span>${Math.max(1, Number(it.qty) || 1)}</span></div>` : ""}
        <div class="" data-component="quantity">
          <span class="a-size-small">Quantity: ${Math.max(1, Number(it.qty) || 1)}</span>
        </div>
        <div class="" data-component="unitPrice">
          <span class="a-price a-text-price" data-a-size="s" data-a-color="base">
            <span class="a-offscreen">${esc(fmtUSD(Number(it.price) || 0))}</span>
            <span aria-hidden="true">${esc(fmtUSD(Number(it.price) || 0))}</span>
          </span>
        </div>
      </div>
    </div></div>
  </div>`).join("");

  return `
<div class="" data-component="default">
  <div class="" data-component="debugBanner"></div>
  <div class="" data-component="aapiDebug"></div>
  <div class="" data-component="title">
    <div class="a-section">
      <div class="a-row">
        <div class="" data-component="titleLeftGrid">
          <div class="a-column a-span6">
            <div class="" data-component="printODTitle">
              <h1>Order Summary</h1>
            </div>
          </div>
        </div>
        <div class="" data-component="titleRightGrid">
          <div class="a-column a-span6 a-text-right a-span-last">
            <div class="" data-component="brandLogo"></div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="" data-component="saveButtonMobile"></div>

  <div class="" data-component="briefOrderInfoInvoice">
    <div class="a-section">
      <div class="a-row a-spacing-mini">
        <div class="" data-component="briefOrderInfoInvoiceLeftGridDesktop">
          <div class="a-section">
            <div class="a-column a-span9 a-spacing-top-mini">
              <div class="" data-component="poNumber"></div>
              <div class="" data-component="orderDateLabel"><span>Order placed</span></div>
              <div class="" data-component="orderDate"><span>${esc(placedOnTxt)} <i class="a-icon a-icon-text-separator" role="presentation"></i></span></div>
              <div class="" data-component="orderIdLabel"><span>Order #</span></div>
              <div class="" data-component="orderId"><span>${esc(orderNumber || "")}</span></div>
            </div>
          </div>
        </div>
        <div class="" data-component="briefOrderInfoInvoiceLeftGridMobile"></div>
        <div class="" data-component="briefOrderInfoInvoiceRightGrid">
          <div class="a-section">
            <div class="a-column a-span3 a-text-right a-span-last">
              <div class="" data-component="saveButton">
                <span class="a-declarative" data-action="printOD-print" data-printod-print="{}">
                  <span class="a-button a-button-primary printOD-hide-print" id="a-autoid-0">
                    <span class="a-button-inner">
                      <input class="a-button-input" type="submit" aria-labelledby="a-autoid-0-announce">
                      <span class="a-button-text" aria-hidden="true" id="a-autoid-0-announce">Print</span>
                    </span>
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="" data-component="orderSummary">
    <div class="a-box-group a-spacing-base">
      <div class="a-box"><div class="a-box-inner">
        <div class="a-fixed-right-grid"><div class="a-fixed-right-grid-inner" style="padding-right:260px">
          <div class="a-fixed-right-grid-col a-col-left" style="padding-right:0%;float:left;">
            <div class="a-row">
              <div class="a-column a-span5">
                <div class="" data-component="shippingAddress">
                  <h5 class="a-spacing-micro">Ship to</h5>
                  <ul class="a-unordered-list a-nostyle a-vertical">
                    <li><span class="a-list-item">${esc(shipName)}</span></li>
                    <li><span class="a-list-item">9990 NW 14TH ST STE 110<br>DORAL, FL 33192-2702</span></li>
                    <li><span class="a-list-item">United States</span></li>
                  </ul>
                </div>
              </div>
              <div class="a-column a-span7 a-span-last">
                <div class="a-section a-spacing-base">
                  <div class="" data-component="viewPaymentPlanSummaryWidget">
                    <h5 class="a-spacing-micro">Payment method</h5>
                    <div class="a-section">
                      <div class="a-row pmts-portal-root-EsrhbdGCI4j3">
                        <div class="a-column a-span12 pmts-payment-instrument-billing-address">
                          <span class="pmts-payments-instrument-detail-box-paystationpaymentmethod">Visa<span class="a-letter-space"></span> <span class="a-color-base">ending in 9513</span><br></span>
                        </div>
                      </div>
                      <span class="a-button a-button-base a-button-small pmts-view-your-transactions-button" id="a-autoid-1">
                        <span class="a-button-inner"><a href="#" class="a-button-text" role="button" id="a-autoid-1-announce">View related transactions</a></span>
                      </span>
                    </div>
                  </div>
                  <div class="" data-component="aapiPaymentMethods"></div>
                </div>
              </div>
            </div>
          </div>
          <div id="od-subtotals" class="a-fixed-right-grid-col a-col-right" style="width:260px;margin-right:-260px;float:left;">
            <div class="" data-component="chargeSummary">
              <div class="a-column a-span12">
                <div class="a-row a-spacing-small"><h5>Order Summary</h5></div>
                <ul class="a-unordered-list a-nostyle a-vertical">
                  <li><span class="a-list-item"><div class="a-row od-line-item-row"><div class="a-column a-span7 od-line-item-row-label"><span class="a-size-base"><span>Item(s) Subtotal: </span></span></div><div class="a-column a-span5 od-line-item-row-content a-span-last"><span class="a-size-base a-color-base">${esc(fmtUSD(subtotal))}</span></div></div></span></li>
                  <li><span class="a-list-item"><div class="a-row od-line-item-row"><div class="a-column a-span7 od-line-item-row-label"><span class="a-size-base"><span>Shipping &amp; Handling:</span></span></div><div class="a-column a-span5 od-line-item-row-content a-span-last"><span class="a-size-base a-color-base">$0.00</span></div></div></span></li>
                  <li><span class="a-list-item"><div class="a-row od-line-item-row"><div class="a-column a-span7 od-line-item-row-label"><span class="a-size-base"><span>Total before tax:</span></span></div><div class="a-column a-span5 od-line-item-row-content a-span-last"><span class="a-size-base a-color-base">${esc(fmtUSD(subtotal))}</span></div></div></span></li>
                  <li><span class="a-list-item"><div class="a-row od-line-item-row"><div class="a-column a-span7 od-line-item-row-label"><span class="a-size-base"><span>Estimated tax to be collected:</span></span></div><div class="a-column a-span5 od-line-item-row-content a-span-last"><span class="a-size-base a-color-base">$0.00</span></div></div></span></li>
                  <li><span class="a-list-item"><div class="a-row od-line-item-row"><div class="a-column a-span7 od-line-item-row-label"><span class="a-size-base a-color-base a-text-bold"><span>Grand Total:</span></span></div><div class="a-column a-span5 od-line-item-row-content a-span-last"><span class="a-size-base a-color-base a-text-bold">${esc(fmtUSD(grandTotal))}</span></div></div></span></li>
                </ul>
              </div>
            </div>
          </div>
        </div></div>
      </div></div>
    </div>
  </div>

  <div class="" data-component="orderCard">
    <div class="" data-component="shipments">
      <div class="a-box-group">
        <div class="a-box"><div class="a-box-inner">
          <div class="a-fixed-right-grid"><div class="a-fixed-right-grid-inner" style="padding-right:220px">
            <div class="a-fixed-right-grid-col a-col-left" style="padding-right:3.2%;float:left;">
              <div class="" data-component="shipmentStatus">
                <div id="shipment-top-row" class="a-row">
                  <div class="a-section">
                    <div class="a-row">
                      <h4 class="a-color-base od-status-message">${deliveryHeading}</h4>
                    </div>
                    <div class="a-row od-status-message"></div>
                    <div class="a-row"></div>
                  </div>
                </div>
              </div>
              <div class="" data-component="purchasedItems">
                ${itemsHtml}
              </div>
            </div>
          </div></div>
        </div></div>
      </div>
    </div>
  </div>
</div>
`.trim();
}

const PRINT_CSS = `
  *{box-sizing:border-box}body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#111827;background:#eef2f7}
  .doc{padding:24px}.page{max-width:980px;margin:0 auto}.card{background:#fff;border:1px solid #d7dce2;border-radius:14px;box-shadow:0 14px 36px rgba(15,23,42,.08);overflow:hidden}
  .pad{padding:24px}.section{border:1px solid #d7dce2;border-radius:12px;background:#fff;overflow:hidden}.grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:22px}
  .title{font-size:18px;font-weight:700;margin:0 0 14px}.rows{display:grid;gap:6px;font-size:13px;line-height:1.5}.line{display:flex;justify-content:space-between;gap:12px}
  .line strong{color:#111827}.muted{color:#4b5563}.table{width:100%;border-collapse:collapse;font-size:13px}.table th,.table td{padding:12px 10px;border-bottom:1px solid #e5e7eb;text-align:left;vertical-align:top}
  .table th:last-child,.table td:last-child{text-align:right;white-space:nowrap}.table thead th{font-size:12px;color:#4b5563;text-transform:uppercase;letter-spacing:.04em}.table tbody tr:last-child td{border-bottom:0}
  .ebay-head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:22px}.ebay-head img{width:142px;height:auto}.ebay-meta{text-align:right;font-size:12px;color:#4b5563}
  .market-top{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.market-top h1{margin:0 0 10px;font-size:28px;line-height:1.1;font-weight:500}.market-line{font-size:14px}.market-line .sep{margin:0 10px;color:#9ca3af}
  .print-pill{min-width:70px;padding:10px 14px;border-radius:999px;border:1px solid #f5b400;background:#ffd814;color:#111827;font-size:14px;text-align:center}
  .market-grid{display:grid;grid-template-columns:1.1fr 1.2fr 1fr;gap:24px}.market-label{margin:0 0 8px;font-size:15px;font-weight:700}.market-info{display:grid;gap:3px;font-size:13px;line-height:1.45}
  .market-delivery{padding:18px 20px}.market-delivery h2{margin:0;font-size:18px;font-weight:700}.market-item{display:grid;grid-template-columns:90px 1fr 120px;gap:16px;padding:18px 20px;border-top:1px solid #e5e7eb}
  .market-item:first-of-type{border-top:0}.market-thumb{width:90px;height:90px;border:1px solid #d1d5db;border-radius:8px;overflow:hidden;background:#fff;display:flex;align-items:center;justify-content:center}
  .market-thumb img{width:90px;height:90px;object-fit:cover;display:block}.market-name{font-size:15px;line-height:1.35;margin-bottom:8px;color:#146eb4}.store-apple .market-name{color:#111827}
  .market-meta{display:grid;gap:3px;font-size:13px;color:#374151}.market-price{text-align:right;font-size:15px;font-weight:700}.summary .line{margin-bottom:4px}.summary .grand{margin-top:10px;padding-top:10px;border-top:1px solid #d1d5db;font-weight:700}
  .store-apple body,.store-apple{background:#f5f5f7}.store-apple .print-pill{border-color:#d1d5db;background:#f3f4f6}
  .store-amazon body,.store-amazon{background:#fff}
  .store-amazon .doc{padding:0}
  .store-amazon .page{max-width:none;width:100%}
  .store-amazon .card{border:0;box-shadow:none;border-radius:0}
  .store-amazon .pad{padding:22px 28px}
  .amazon-title{margin:0;font-size:52px;line-height:1.05;font-weight:400;color:#111}
  .amazon-brief{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;margin:10px 0 18px}
  .amazon-brief-line{font-size:15px;color:#111}
  .amazon-brief-line .sep{display:inline-block;margin:0 10px;color:#6b7280}
  .amazon-print{display:inline-flex;align-items:center;justify-content:center;height:34px;padding:0 18px;border-radius:999px;border:1px solid #f7ca00;background:#ffd814;color:#111;font-size:14px;margin-top:6px}
  .amazon-box{border:1px solid #d5d9d9;border-radius:8px;background:#fff}
  .amazon-top-grid{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1.1fr) 285px;gap:28px;padding:16px 18px}
  .amazon-label{margin:0 0 8px;font-size:18px;font-weight:700;color:#111}
  .amazon-list{display:grid;gap:4px;font-size:15px;line-height:1.42;color:#111}
  .amazon-pay-button{display:inline-flex;align-items:center;justify-content:center;min-height:26px;padding:0 12px;margin-top:8px;border:1px solid #888c8c;border-radius:999px;background:#fff;color:#0f1111;font-size:13px}
  .amazon-summary-col .line{margin-bottom:4px;font-size:15px}
  .amazon-summary-col .grand{margin-top:8px;padding-top:8px;border-top:1px solid #d5d9d9;font-weight:700}
  .amazon-delivery-box{margin-top:12px;border:1px solid #d5d9d9;border-radius:8px;background:#fff}
  .amazon-delivery-head{padding:14px 18px 10px}
  .amazon-delivery-head h2{margin:0;font-size:18px;font-weight:700;color:#111}
  .amazon-item{display:grid;grid-template-columns:108px minmax(0,1fr) 130px;gap:18px;padding:14px 18px;border-top:1px solid #eaeded}
  .amazon-item:first-of-type{border-top:0}
  .amazon-thumb{width:108px;height:100px;display:flex;align-items:flex-start;justify-content:center}
  .amazon-thumb img{width:90px;height:90px;object-fit:cover;display:block}
  .amazon-item-title{margin:0 0 8px;font-size:15px;line-height:1.45;color:#2162a1}
  .amazon-item-meta{display:grid;gap:4px;font-size:13px;line-height:1.4;color:#565959}
  .amazon-item-meta .primary{color:#111}
  .amazon-price{font-size:15px;font-weight:400;color:#111;text-align:right}
  @page{size:auto;margin:14mm}
  @media print{
    body{background:#fff}
    .doc{padding:0}
    .card{box-shadow:none}
    .print-pill,.amazon-print{display:none!important}
    .store-amazon .page{width:100% !important;max-width:none !important}
    .store-amazon .pad{padding:20px 24px !important}
    .amazon-title{font-size:52px !important}
    .amazon-brief-line,.amazon-list,.amazon-summary-col .line{font-size:15px !important}
    .amazon-item-title{font-size:15px !important}
    .amazon-item-meta{font-size:13px !important}
    .amazon-top-grid{grid-template-columns:1.05fr 1.1fr 285px !important}
    .amazon-item{grid-template-columns:108px minmax(0,1fr) 130px !important}
    .market-grid{grid-template-columns:1.1fr 1.2fr 1fr !important}
    .market-item{grid-template-columns:90px 1fr 120px !important}
    .market-price,.amazon-price{text-align:right !important}
  }
  @media screen and (max-width:900px){.doc{padding:16px}.grid3,.market-grid,.market-item,.amazon-top-grid,.amazon-item{grid-template-columns:1fr}.market-price,.amazon-price{text-align:left}.ebay-head,.market-top,.amazon-brief{flex-direction:column;align-items:flex-start}}
`;

const DEFAULT_IMAGE_SRC =
  'data:image/svg+xml;charset=UTF-8,' +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="284" height="284" viewBox="0 0 284 284"><rect width="284" height="284" fill="#f3f4f6"/><rect x="26" y="26" width="232" height="232" rx="28" fill="#ffffff" stroke="#d1d5db" stroke-width="6"/><circle cx="103" cy="108" r="26" fill="#d1d5db"/><path d="M58 214c20-40 46-60 76-60 27 0 46 12 68 42l24-27 26 45H58z" fill="#cbd5e1"/></svg>');

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function fmtDateUSLong(d) { return fmtDateUS(d, { month: "long", day: "numeric", year: "numeric" }); }
function fmtDateUSNoYear(d) {
  if (!d) return "";
  const dt = new Date(`${d}T00:00:00`);
  if (isNaN(dt)) return "";
  return dt.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}
function amazonEligibleThroughFor(deliveryHeadline, placedOn) {
  const normalizedHeadline = String(deliveryHeadline || "").trim().toLowerCase();
  if (normalizedHeadline === "arriving today") {
    const todayYmd = dateToYMD(new Date());
    return fmtDateUSLong(addDaysYMD(todayYmd, 15));
  }
  return fmtDateUSLong(placedOn);
}
function shouldShowAmazonEligibleLine(deliveryHeadline) {
  return String(deliveryHeadline || "").trim().toLowerCase() === "arriving today";
}
function docWrap(storeClass, html) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>DEC Preview</title><style>${PRINT_CSS}</style></head><body class="${esc(storeClass)}">${html}</body></html>`;
}
function ensureItems({ items, qty, itemName, price, shippingSvc }) {
  if (Array.isArray(items) && items.length) return items;
  return [{ qty: Math.max(1, Number(qty) || 1), name: String(itemName || "").trim(), price: Number(price) || 0, shippingSvc: shippingSvc || "Standard Shipping" }];
}
function totalsFor(items) {
  const safe = ensureItems({ items });
  const itemsCount = safe.reduce((s, it) => s + (Number(it.qty) || 1), 0);
  const subtotal = safe.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 1), 0);
  return { itemsCount, subtotal: +subtotal.toFixed(2), grandTotal: +subtotal.toFixed(2) };
}
function deliveryHeadlineFor(mode, deliveredOn, customText) {
  if (mode === "arrivingToday") return "Arriving today";
  if (mode === "delivered") return deliveredOn ? `Delivered ${fmtDateUSNoYear(deliveredOn)}` : "Delivered";
  if (mode === "custom") return String(customText || "").trim() || "Delivered tomorrow";
  return "Delivered tomorrow";
}
function buildPrintableEbayDoc({ seller, placedOn, orderNumber, casilleroKey, qty, price, itemName, shippingSvc, items }) {
  const safe = ensureItems({ items, qty, itemName, price, shippingSvc });
  const { itemsCount, subtotal, grandTotal } = totalsFor(safe);
  const shipName = CASILLEROS[casilleroKey] || "";
  const rows = safe.map((it) => `
    <tr>
      <td>${esc(Math.max(1, Number(it.qty) || 1))}</td>
      <td>${esc(it.name || "")}</td>
      <td>${esc(it.shippingSvc || "Standard Shipping")}</td>
      <td>${esc(fmtUSD(Number(it.price) || 0))}</td>
    </tr>`).join("");
  return docWrap("store-ebay", `
    <div class="doc"><div class="page"><div class="card"><div class="pad">
      <div class="ebay-head">
        <img src="${EBAY_LOGO}" alt="eBay" />
        <div class="ebay-meta"><div>Printer friendly preview</div><div>${esc(fmtDateUS(placedOn, { month: "short" }) || "-")}</div></div>
      </div>
      <div class="grid3">
        <section class="section"><div class="pad"><h2 class="title">Order information</h2><div class="rows">
          <div class="line"><span class="muted">Buyer</span><strong>renato1_9</strong></div>
          <div class="line"><span class="muted">Seller</span><strong>${esc(seller || "")}</strong></div>
          <div class="line"><span class="muted">Placed on</span><strong>${esc(fmtDateUS(placedOn, { month: "short" }) || "-")}</strong></div>
          <div class="line"><span class="muted">Payment method</span><strong>PayPal</strong></div>
          <div class="line"><span class="muted">Paid on</span><strong>${esc(fmtDateUS(placedOn, { month: "short" }) || "-")}</strong></div>
        </div></div></section>
        <section class="section"><div class="pad"><h2 class="title">Shipping address</h2><div class="rows">
          <div>${esc(shipName)}</div><div>9990 NW 14th Street, Ste 110</div><div>Doral, Florida 33192-2702</div><div>United States</div>
        </div></div></section>
        <section class="section"><div class="pad"><h2 class="title">Order total</h2><div class="rows">
          <div class="line"><span>${esc(`${itemsCount} item${itemsCount === 1 ? "" : "s"}`)}</span><strong>${esc(fmtUSD(subtotal))}</strong></div>
          <div class="line"><span>Shipping</span><strong>Free</strong></div>
          <div class="line"><span>Tax*</span><strong>$0.00</strong></div>
        </div><div style="border-top:1px solid #d1d5db;margin:16px 0 12px;"></div><div class="line" style="font-size:22px;font-weight:700"><span>Order total</span><span>${esc(fmtUSD(grandTotal))}</span></div></div></section>
      </div>
      <section class="section" style="margin-top:18px"><div class="pad">
        <h2 class="title" style="margin-bottom:4px">Items bought from ${esc(seller || "")}</h2>
        <div class="muted" style="font-size:12px;margin-bottom:16px">Order number: ${esc(orderNumber || "")}</div>
        <table class="table"><thead><tr><th>Quantity</th><th>Item name</th><th>Shipping service</th><th>Item price</th></tr></thead><tbody>${rows}</tbody></table>
      </div></section>
    </div></div></div></div>`);
}
function buildPrintableMarketDoc({ store, placedOn, orderNumber, casilleroKey, qty, price, itemName, items, deliveryHeadline, imageSmall }) {
  const safe = ensureItems({ items, qty, itemName, price });
  const { subtotal, grandTotal } = totalsFor(safe);
  const shipName = CASILLEROS[casilleroKey] || "";
  const isApple = store === "apple";
  const soldBy = isApple ? "Apple" : "Amazon.com";
  const title = isApple ? "Order Details" : "Order Summary";
  const eligibleThroughTxt = amazonEligibleThroughFor(deliveryHeadline, placedOn);
  const showEligibleLine = shouldShowAmazonEligibleLine(deliveryHeadline);
  if (!isApple) {
    const cards = safe.map((it) => `
      <div class="amazon-item">
        <div class="amazon-thumb">
          <img src="${esc(it.imageSmall || imageSmall || DEFAULT_IMAGE_SRC)}" alt="Product" />
        </div>
        <div>
          <div class="amazon-item-title">${esc(it.name || "")}</div>
          <div class="amazon-item-meta">
            <div>Sold by: Amazon.com</div>
            <div>Supplied by: Other</div>
            ${showEligibleLine ? `<div class="primary">Return or replace items: Eligible through ${esc(eligibleThroughTxt || "-")}</div>` : ""}
            <div class="primary">Quantity: ${esc(Math.max(1, Number(it.qty) || 1))}</div>
          </div>
        </div>
        <div class="amazon-price">${esc(fmtUSD(Number(it.price) || 0))}</div>
      </div>`).join("");
    return docWrap("store-amazon", `
      <div class="doc">
        <div class="page">
          <div class="card">
            <div class="pad">
              <h1 class="amazon-title">Order Summary</h1>
              <div class="amazon-brief">
                <div class="amazon-brief-line">
                  <span>Order placed</span>
                  <span>${esc(fmtDateUSLong(placedOn) || "-")}</span>
                  <span class="sep">|</span>
                  <span>Order #</span>
                  <span>${esc(orderNumber || "")}</span>
                </div>
                <div class="amazon-print">Print</div>
              </div>

              <section class="amazon-box">
                <div class="amazon-top-grid">
                  <div>
                    <h5 class="amazon-label">Ship to</h5>
                    <div class="amazon-list">
                      <div>${esc(shipName)}</div>
                      <div>9990 NW 14TH ST STE 110</div>
                      <div>DORAL, FL 33192-2702</div>
                      <div>United States</div>
                    </div>
                  </div>
                  <div>
                    <h5 class="amazon-label">Payment method</h5>
                    <div class="amazon-list">
                      <div>Visa ending in 9513</div>
                    </div>
                    <div class="amazon-pay-button">View related transactions</div>
                  </div>
                  <div class="amazon-summary-col">
                    <h5 class="amazon-label">Order Summary</h5>
                    <div class="line"><span>Item(s) Subtotal:</span> <strong>${esc(fmtUSD(subtotal))}</strong></div>
                    <div class="line"><span>Shipping &amp; Handling:</span> <strong>$0.00</strong></div>
                    <div class="line"><span>Total before tax:</span> <strong>${esc(fmtUSD(subtotal))}</strong></div>
                    <div class="line"><span>Estimated tax to be collected:</span> <strong>$0.00</strong></div>
                    <div class="line grand"><span>Grand Total:</span> <strong>${esc(fmtUSD(grandTotal))}</strong></div>
                  </div>
                </div>
              </section>

              <section class="amazon-delivery-box">
                <div class="amazon-delivery-head">
                  <h2>${esc(deliveryHeadline || "Delivered tomorrow")}</h2>
                </div>
                ${cards}
              </section>
            </div>
          </div>
        </div>
      </div>`);
  }
  const cards = safe.map((it) => `
    <div class="market-item">
      <div class="market-thumb"><img src="${esc(imageSmall || DEFAULT_IMAGE_SRC)}" alt="Product" /></div>
      <div>
        <div class="market-name">${esc(it.name || "")}</div>
        <div class="market-meta">
          <div>Sold by: ${esc(soldBy)}</div>
          <div>Payment method: Visa ending in 9513</div>
          <div>Quantity: ${esc(Math.max(1, Number(it.qty) || 1))}</div>
        </div>
      </div>
      <div class="market-price">${esc(fmtUSD(Number(it.price) || 0))}</div>
    </div>`).join("");
  return docWrap(`store-market ${isApple ? "store-apple" : "store-amazon"}`, `
    <div class="doc"><div class="page"><div class="card"><div class="pad">
      <div class="market-top">
        <div>
          <h1>${esc(title)}</h1>
          <div class="market-line">Order placed ${esc(fmtDateUSLong(placedOn) || "-")} <span class="sep">|</span> Order # ${esc(orderNumber || "")} <span class="sep">|</span> ${isApple ? "Apple" : "Amazon"}</div>
        </div>
        <div class="print-pill">Print</div>
      </div>
      <section class="section" style="margin-top:18px"><div class="pad"><div class="market-grid">
        <div><p class="market-label">Ship to</p><div class="market-info"><div>${esc(shipName)}</div><div>9990 NW 14th ST STE 110</div><div>DORAL, FL 33192-2702</div><div>United States</div></div></div>
        <div><p class="market-label">Payment method</p><div class="market-info"><div>Visa ending in 9513</div></div></div>
        <div class="summary">
          <p class="market-label">${esc(title)}</p>
          <div class="line"><span>Item(s) Subtotal:</span><strong>${esc(fmtUSD(subtotal))}</strong></div>
          <div class="line"><span>Shipping &amp; Handling:</span><strong>$0.00</strong></div>
          <div class="line"><span>Total before tax:</span><strong>${esc(fmtUSD(subtotal))}</strong></div>
          <div class="line"><span>Estimated tax to be collected:</span><strong>$0.00</strong></div>
          <div class="line grand"><span>Grand Total:</span><strong>${esc(fmtUSD(grandTotal))}</strong></div>
        </div>
      </div></div></section>
      <section class="section" style="margin-top:18px"><div class="market-delivery"><h2>${esc(deliveryHeadline || "Delivered tomorrow")}</h2></div>${cards}</section>
    </div></div></div></div>`);
}
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.readAsDataURL(blob);
  });
}
function loadImg(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo cargar la imagen."));
    img.src = src;
  });
}
function squareFromImage(img, size) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo preparar el canvas.");
  const scale = Math.min(size / img.width, size / img.height);
  const drawWidth = img.width * scale;
  const drawHeight = img.height * scale;
  const offsetX = (size - drawWidth) / 2;
  const offsetY = (size - drawHeight) / 2;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
  return canvas.toDataURL("image/png");
}
async function normalizeImagePipeline(src) {
  const original = await loadImg(src);
  const large = squareFromImage(original, 284);
  const resized = await loadImg(large);
  const small = squareFromImage(resized, 90);
  return { large, small };
}
async function fetchUrlAsDataUrl(url) {
  const res = await fetch(`${API_URL}/utils/image-proxy?url=${encodeURIComponent(String(url || "").trim())}`);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || "No se pudo descargar la imagen.");
  }
  return blobToDataUrl(await res.blob());
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
  const [store, setStore] = useState("ebay");
  const [seller, setSeller] = useState("961firstave");
  const [placedOn, setPlacedOn] = useState(""); // YYYY-MM-DD
  const [orderNumber, setOrderNumber] = useState("");
  const [casilleroKey, setCasilleroKey] = useState("Renato");
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState("0.00"); // DEC
  const [itemName, setItemName] = useState("");
  const [manualMainDecRef, setManualMainDecRef] = useState("");
  const [manualCarrier, setManualCarrier] = useState("");
  const [manualCarrierTracking, setManualCarrierTracking] = useState("");
  const [shippingSvc, setShippingSvc] = useState("Standard Shipping");
  const [savingFactura, setSavingFactura] = useState(false);
  const [publishingTemplate, setPublishingTemplate] = useState(false);
  const [publishStatus, setPublishStatus] = useState("");
  const [publishAt, setPublishAt] = useState("");
  const [autofillTargetUrl, setAutofillTargetUrl] = useState("");
  const [randomNames, setRandomNames] = useState({});
  const [linkedItemNames, setLinkedItemNames] = useState({});
  const [groupLinkedAsSame, setGroupLinkedAsSame] = useState(false);
  const [deliveryMode, setDeliveryMode] = useState("tomorrow");
  const [deliveredOn, setDeliveredOn] = useState("");
  const [customDeliveryText, setCustomDeliveryText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageLarge, setImageLarge] = useState(DEFAULT_IMAGE_SRC);
  const [imageSmall, setImageSmall] = useState(DEFAULT_IMAGE_SRC);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageStatus, setImageStatus] = useState("");
  const [imageFileName, setImageFileName] = useState("");
  const [linkedImages, setLinkedImages] = useState({});
  const manualLineIdRef = useRef(1);
  const [manualLinkedLines, setManualLinkedLines] = useState([]);
  const addManualLinkedLine = () => {
    const nextId = manualLineIdRef.current++;
    setManualLinkedLines((prev) => ([
      ...prev,
      {
        id: `manual-${nextId}`,
        name: "",
        decRef: "",
      },
    ]));
  };
  const updateManualLinkedLine = (id, patch) => {
    setManualLinkedLines((prev) =>
      prev.map((line) => (line.id === id ? { ...line, ...patch } : line))
    );
  };
  const resetSeleccion = () => {
    setProductoSel(null);
    setNameCore("");
    setProblemSuffix("");
    setItemName("");
    setPlacedOn("");
    setOrderNumber("");
    setQty(1);
    setPrice("0.00");
    setManualMainDecRef("");
    setManualCarrier("");
    setManualCarrierTracking("");
    setShippingSvc("Standard Shipping");
    setCasilleroKey("Renato");
    setGroupLinkedAsSame(false);
    setLinkedImages({});
    setManualLinkedLines([]);
    setDeliveryMode("tomorrow");
    setDeliveredOn("");
    setCustomDeliveryText("");
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

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const metaPath = store === "amazon" ? "/tm/amazon-template/meta" : "/tm/ebay-template/meta";
        const meta = await api.get(metaPath);
        if (mounted && meta?.updatedAt) {
          setPublishAt(meta.updatedAt);
        } else if (mounted) {
          setPublishAt("");
        }
      } catch {
        if (mounted) setPublishAt("");
      }
    })();
    return () => { mounted = false; };
  }, [store]);
  useEffect(() => {
    try {
      setAutofillTargetUrl(localStorage.getItem(DEC_FORM_TARGET_URL_KEY) || DEFAULT_DEC_FORM_TARGET_URL);
    } catch {
      setAutofillTargetUrl(DEFAULT_DEC_FORM_TARGET_URL);
    }
  }, []);

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
      setNameCore("");
      setProblemSuffix("");
      setItemName("");
      setPrice("0.00");
      setManualMainDecRef("");
      setRandomNames({});
      setLinkedItemNames({});
      setGroupLinkedAsSame(false);
      setLinkedImages({});
      setManualLinkedLines([]);
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
    setGroupLinkedAsSame(false);
    setLinkedImages({});
    setManualMainDecRef("");
    setPrice(decClean);
    setPlacedOn(toYYYYMMDD(fechaCompra));
    setDeliveryMode("tomorrow");
    setDeliveredOn("");
    setCustomDeliveryText("");
    if (autoKey) setCasilleroKey(autoKey);
  };

  // Si cambia el producto seleccionado, re-sincroniza casillero automáticamente
  useEffect(() => {
    if (!productoSel) return;
    const autoKey = resolveCasilleroKeyFromProducto(productoSel);
    if (autoKey) setCasilleroKey(autoKey);
  }, [productoSel]);

  const randomNameForAnyProduct = () => {
    const pool = (productosEnCamino && productosEnCamino.length)
      ? productosEnCamino
      : (productosAll || []);
    if (pool.length) {
      const p = pool[Math.floor(Math.random() * pool.length)];
      const tipo = normalize(p?.tipo);
      let core = buildCoreName(p);
      if (tipo.includes("macbook")) {
        const opts = cpuOptionsForMac(p);
        const cpu = pickOne(opts);
        core = buildCoreName(p, cpu);
      }
      const prob = randomProblemForProduct(p);
      return core + (prob ? ` ${prob}` : "");
    }
    const genericCore = pickOne([
      'MacBook Pro i7 13" 16GB RAM 512GB',
      'iPad Pro 12.9 4th gen 256GB',
      'iPhone 13 Pro 256GB',
    ]);
    const prob = randomProblemForProduct(null);
    return `${genericCore} ${prob}`.trim();
  };

  // ?? CPU aleatoria (Mac) + problema aleatorio al final
  const rollName = () => {
    if (!productoSel) {
      onEditItemName(randomNameForAnyProduct());
      return;
    }
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

  const rollManualLinkedName = (id) => {
    const full = randomNameForAnyProduct();
    updateManualLinkedLine(id, { name: full });
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
  const effectiveCarrier = String(productoSel ? carrier : manualCarrier).trim();
  const effectiveCarrierTracking = String(productoSel ? carrierTracking : manualCarrierTracking).trim();
  const autofillPayload = useMemo(() => {
    const resolvedPrice = cleanMoneyToString(price);
    const typeSource = productoSel?.tipo || itemName;
    return {
      source: "modal-dec",
      sourceProductId: productoSel?.id ?? null,
      casilleroKey,
      email: DEC_FORM_EMAIL_BY_CASILLERO[casilleroKey] || "",
      carrier: effectiveCarrier,
      tracking: effectiveCarrierTracking,
      store: "ebay",
      product: normalizeExternalProductLabel(typeSource),
      purchaseValue: resolvedPrice,
      decTotalUsd: resolvedPrice,
      rawItemName: itemName || "",
      placedOn,
      orderNumber,
    };
  }, [
    productoSel,
    casilleroKey,
    effectiveCarrier,
    effectiveCarrierTracking,
    price,
    itemName,
    placedOn,
    orderNumber,
  ]);
  const autofillUrl = useMemo(
    () => buildAutofillUrl(autofillTargetUrl, autofillPayload),
    [autofillTargetUrl, autofillPayload]
  );

  const linkedGroup = useMemo(() => {
    const groupKey = getGroupKey(productoSel);
    if (!groupKey) return [];
    return (productosAll || []).filter((p) => getGroupKey(p) === groupKey);
  }, [productoSel, productosAll]);
  const getLinkedImageEntry = (id) => linkedImages[id] || {
    url: "",
    large: DEFAULT_IMAGE_SRC,
    small: DEFAULT_IMAGE_SRC,
    busy: false,
    status: "",
    fileName: "",
  };
  const setLinkedImageEntry = (id, patch) => {
    setLinkedImages((prev) => ({
      ...prev,
      [id]: {
        ...getLinkedImageEntry(id),
        ...(prev[id] || {}),
        ...(patch || {}),
      },
    }));
  };
  const linkedGroupOthers = useMemo(
    () => linkedGroup.filter((p) => p?.id !== productoSel?.id),
    [linkedGroup, productoSel]
  );

  const linkedItems = useMemo(() => {
    if (!productoSel) return null;
    const group = linkedGroup.length > 1 ? linkedGroup : [];
    if (group.length <= 1) return null;
    const totalReal = group.reduce((s, p) => s + (Number(pickValorProducto(p)) || 0), 0);
    const totalDec = group.reduce((s, p) => s + (Number(pickDec(p)) || 0), 0);
    const baseDec = (Number(pickDec(productoSel)) || 0) || totalDec;
    const fallbackShare = group.length ? 1 / group.length : 1;
    let used = 0;
    const rawItems = group.map((p, idx) => {
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
      const linkedImage = p?.id === productoSel?.id ? null : linkedImages[p.id];
      return {
        qty: 1,
        name,
        price,
        shippingSvc,
        productId: p?.id ?? null,
        imageSmall: p?.id === productoSel?.id ? imageSmall : (linkedImage?.small || DEFAULT_IMAGE_SRC),
        imageLarge: p?.id === productoSel?.id ? imageLarge : (linkedImage?.large || DEFAULT_IMAGE_SRC),
      };
    });
    if (!groupLinkedAsSame) return rawItems;
    const selectedItem = rawItems.find((it) => Number(it.productId) === Number(productoSel?.id)) || rawItems[0];
    const totalQty = rawItems.reduce((s, it) => s + (Number(it.qty) || 1), 0);
    const totalPrice = rawItems.reduce((s, it) => s + (Number(it.price) || 0), 0);
    return [{
      ...selectedItem,
      qty: totalQty,
      price: totalQty > 0 ? totalPrice / totalQty : totalPrice,
      grouped: true,
      groupedIds: rawItems.map((it) => it.productId).filter(Boolean),
    }];
  }, [productoSel, linkedGroup, shippingSvc, itemName, randomNames, linkedItemNames, linkedImages, imageSmall, imageLarge, groupLinkedAsSame]);

  const manualItems = useMemo(() => {
    if (productoSel) return null;
    const parseRef = (v) => {
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? n : 0;
    };
    const namedLines = [
      { name: itemName, decRef: parseRef(manualMainDecRef) },
      ...manualLinkedLines.map((line) => ({
        name: line?.name || "",
        decRef: parseRef(line?.decRef),
      })),
    ]
      .map((line) => ({ ...line, name: String(line.name || "").trim() }))
      .filter((line) => line.name);

    const total = Number(price) || 0;
    const count = Math.max(1, namedLines.length || 1);
    const totalRef = namedLines.reduce((s, line) => s + line.decRef, 0);
    const fallbackShare = count ? 1 / count : 1;
    let used = 0;
    return Array.from({ length: count }).map((_, idx) => {
      const line = namedLines[idx] || { name: "", decRef: 0 };
      const share = totalRef > 0 ? (line.decRef / totalRef) : fallbackShare;
      const isLast = idx === count - 1;
      const linePrice = isLast
        ? +(total - used).toFixed(2)
        : +((total * share).toFixed(2));
      used += linePrice;
      return {
        qty: 1,
        name: line.name || "",
        price: linePrice,
        shippingSvc: shippingSvc || "Standard Shipping",
      };
    });
  }, [productoSel, itemName, manualMainDecRef, manualLinkedLines, price, shippingSvc]);

  const htmlItems = useMemo(() => {
    if (productoSel) {
      return linkedItems && linkedItems.length ? linkedItems : null;
    }
    return manualItems;
  }, [productoSel, linkedItems, manualItems]);
  const manualHasMultiple = !productoSel && manualLinkedLines.length > 0;
  const deliveryHeadline = useMemo(
    () => deliveryHeadlineFor(deliveryMode, deliveredOn, customDeliveryText),
    [deliveryMode, deliveredOn, customDeliveryText]
  );
  const previewDoc = useMemo(
    () => (store === "ebay"
      ? buildPrintableEbayDoc({
          seller,
          placedOn,
          orderNumber,
          casilleroKey,
          qty,
          price,
          itemName,
          shippingSvc,
          items: htmlItems,
        })
      : buildPrintableMarketDoc({
          store,
          placedOn,
          orderNumber,
          casilleroKey,
          qty,
          price,
          itemName,
          items: htmlItems,
          deliveryHeadline,
          imageSmall,
        })),
    [
      store,
      seller,
      placedOn,
      orderNumber,
      casilleroKey,
      qty,
      price,
      itemName,
      shippingSvc,
      htmlItems,
      deliveryHeadline,
      imageSmall,
    ]
  );

  // Cerrar con ESC
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleOverlayClick = (e) => { if (e.target === e.currentTarget) onClose?.(); };
  const openPrintDialog = () => {
    const win = window.open("", "_blank", "width=1400,height=1000");
    if (!win) {
      alert("No se pudo abrir la vista de impresion.");
      return;
    }
    win.document.open();
    win.document.write(previewDoc);
    win.document.close();
    const printWhenReady = () => {
      win.focus();
      setTimeout(() => win.print(), 450);
    };
    if (win.document.readyState === "complete") printWhenReady();
    else win.onload = printWhenReady;
  };
  const processImageDataUrl = async (dataUrl, label) => {
    setImageBusy(true);
    setImageStatus("");
    try {
      const normalized = await normalizeImagePipeline(dataUrl);
      setImageLarge(normalized.large);
      setImageSmall(normalized.small);
      setImageStatus(`Imagen lista: ${label} (284x284 -> 90x90).`);
    } catch (err) {
      console.error("[ModalDec] image error", err);
      setImageStatus("No se pudo procesar la imagen.");
    } finally {
      setImageBusy(false);
    }
  };
  const processLinkedImageDataUrl = async (productId, dataUrl, label) => {
    if (!productId) return;
    setLinkedImageEntry(productId, { busy: true, status: "", fileName: label || "" });
    try {
      const normalized = await normalizeImagePipeline(dataUrl);
      setLinkedImageEntry(productId, {
        busy: false,
        status: `Imagen lista: ${label} (284x284 -> 90x90).`,
        fileName: label || "",
        large: normalized.large,
        small: normalized.small,
      });
    } catch (err) {
      console.error("[ModalDec] linked image error", err);
      setLinkedImageEntry(productId, {
        busy: false,
        status: "No se pudo procesar la imagen.",
      });
    }
  };
  const handleLoadRemoteImage = async () => {
    const remoteUrl = String(imageUrl || "").trim();
    if (!remoteUrl) return;
    setImageBusy(true);
    setImageStatus("");
    try {
      const dataUrl = await fetchUrlAsDataUrl(remoteUrl);
      const normalized = await normalizeImagePipeline(dataUrl);
      setImageLarge(normalized.large);
      setImageSmall(normalized.small);
      setImageFileName("");
      setImageStatus("Imagen URL lista (284x284 -> 90x90).");
    } catch (err) {
      console.error("[ModalDec] remote image error", err);
      setImageStatus(err?.message ? String(err.message) : "No se pudo descargar la imagen.");
    } finally {
      setImageBusy(false);
    }
  };
  const handleLoadRemoteLinkedImage = async (productId) => {
    const current = getLinkedImageEntry(productId);
    const remoteUrl = String(current?.url || "").trim();
    if (!remoteUrl) return;
    setLinkedImageEntry(productId, { busy: true, status: "" });
    try {
      const dataUrl = await fetchUrlAsDataUrl(remoteUrl);
      const normalized = await normalizeImagePipeline(dataUrl);
      setLinkedImageEntry(productId, {
        busy: false,
        status: "Imagen URL lista (284x284 -> 90x90).",
        fileName: "",
        large: normalized.large,
        small: normalized.small,
      });
    } catch (err) {
      console.error("[ModalDec] linked remote image error", err);
      setLinkedImageEntry(productId, {
        busy: false,
        status: err?.message ? String(err.message) : "No se pudo descargar la imagen.",
      });
    }
  };
  const handleImageFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setImageFileName(file.name);
      const dataUrl = await blobToDataUrl(file);
      await processImageDataUrl(dataUrl, file.name);
    } catch (err) {
      console.error("[ModalDec] local image error", err);
      setImageStatus("No se pudo leer la imagen local.");
      setImageBusy(false);
    } finally {
      e.target.value = "";
    }
  };
  const handleLinkedImageFile = async (productId, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setLinkedImageEntry(productId, { fileName: file.name });
      const dataUrl = await blobToDataUrl(file);
      await processLinkedImageDataUrl(productId, dataUrl, file.name);
    } catch (err) {
      console.error("[ModalDec] linked local image error", err);
      setLinkedImageEntry(productId, {
        busy: false,
        status: "No se pudo leer la imagen local.",
      });
    } finally {
      e.target.value = "";
    }
  };
  const resetImage = () => {
    setImageUrl("");
    setImageFileName("");
    setImageLarge(DEFAULT_IMAGE_SRC);
    setImageSmall(DEFAULT_IMAGE_SRC);
    setImageStatus("");
  };
  const resetLinkedImage = (productId) => {
    setLinkedImageEntry(productId, {
      url: "",
      fileName: "",
      large: DEFAULT_IMAGE_SRC,
      small: DEFAULT_IMAGE_SRC,
      busy: false,
      status: "",
    });
  };
  const isHtmlStore = store === "ebay" || store === "amazon";
  const htmlSelector = store === "amazon" ? 'data-component="default"' : 'class="gen-tables"';
  const html = store === "amazon"
    ? buildAmazonTemplateHTML({
        placedOn,
        orderNumber,
        casilleroKey,
        qty,
        price,
        itemName,
        items: htmlItems,
        deliveryHeadline,
        imageSmall,
        imageLarge,
      })
    : buildModalContentHTML({
        seller,
        placedOn,
        orderNumber,
        casilleroKey,
        qty,
        price,
        itemName,
        shippingSvc,
        items: htmlItems,
      });
  const copyHTML = async () => {
    try { await navigator.clipboard.writeText(html); alert("HTML copiado al portapapeles."); }
    catch {
      const ta = document.getElementById("dec-html-ta");
      if (ta) { ta.select(); document.execCommand("copy"); alert("HTML copiado."); }
    }
  };
  const copySelector = async () => { try { await navigator.clipboard.writeText(htmlSelector); } catch { } };
  const copyAutofillPayload = async () => {
    const text = `${DEC_FORM_CLIP_PREFIX}${JSON.stringify(autofillPayload)}`;
    try {
      await navigator.clipboard.writeText(text);
      alert("Payload DEC copiado. En la web externa usa el userscript para rellenar.");
    } catch {
      alert("No se pudo copiar el payload DEC.");
    }
  };
  const configureAutofillTarget = () => {
    const nextUrl = window.prompt("URL del formulario externo para autofill", autofillTargetUrl || DEFAULT_DEC_FORM_TARGET_URL);
    if (nextUrl == null) return;
    const clean = String(nextUrl || "").trim();
    try {
      if (clean) localStorage.setItem(DEC_FORM_TARGET_URL_KEY, clean);
      else localStorage.removeItem(DEC_FORM_TARGET_URL_KEY);
    } catch {}
    setAutofillTargetUrl(clean || DEFAULT_DEC_FORM_TARGET_URL);
  };
  const openAutofillTarget = async () => {
    if (!autofillUrl) {
      configureAutofillTarget();
      return;
    }
    try {
      await navigator.clipboard.writeText(`${DEC_FORM_CLIP_PREFIX}${JSON.stringify(autofillPayload)}`);
    } catch {}
    window.open(autofillUrl, "_blank", "noopener,noreferrer");
  };
  const publishTemplate = async () => {
    if (publishingTemplate) return;
    setPublishingTemplate(true);
    setPublishStatus("");
    try {
      let res;
      if (store === "amazon") {
        const token = localStorage.getItem("token");
        const raw = await fetch(`${API_URL}/tm/amazon-template?source=modal-dec-amazon`, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: html,
        });
        if (!raw.ok) {
          const txt = await raw.text().catch(() => "");
          throw new Error(`HTTP ${raw.status} - ${txt.slice(0, 500)}`);
        }
        res = await raw.json();
      } else {
        res = await api.post("/tm/ebay-template", {
          html,
          source: "modal-dec",
        });
      }
      if (res?.updatedAt) setPublishAt(res.updatedAt);
      setPublishStatus("Plantilla publicada para Tampermonkey.");
    } catch (err) {
      console.error("[ModalDec] Error publicando plantilla TM:", err);
      setPublishStatus("No se pudo publicar la plantilla.");
    } finally {
      setPublishingTemplate(false);
    }
  };
  const facturaTargets = useMemo(() => {
    if (!productoSel) return [];
    return linkedGroup.length > 1 ? linkedGroup : [productoSel];
  }, [productoSel, linkedGroup]);
  const facturaMarcada = facturaTargets.length > 0 && facturaTargets.every((p) => Boolean(p?.facturaDecSubida));
  const facturaButtonLabel = facturaMarcada
    ? (facturaTargets.length > 1 ? 'Facturas subidas' : 'Factura subida')
    : (facturaTargets.length > 1 ? 'Subir facturas' : 'Subir factura');
  const toggleFacturaMarcada = async () => {
    if (!productoSel || savingFactura || facturaMarcada) return;
    const nextValue = true;
    setSavingFactura(true);
    try {
      const targets = facturaTargets.length ? facturaTargets : [productoSel];
      const updates = await Promise.all(
        targets.map(async (item) => {
          const updated = await api.patch(`/productos/${item.id}`, {
            facturaDecSubida: nextValue,
          });
          const base = updated?.id ? updated : { ...item, facturaDecSubida: nextValue };
          return item?.__decResolved != null
            ? { ...base, __decResolved: item.__decResolved }
            : base;
        })
      );
      const updatedById = new Map(updates.map((item) => [item.id, item]));
      const selectedUpdated = updatedById.get(productoSel.id);
      if (selectedUpdated) setProductoSel(selectedUpdated);
      setLocalOverrides((prev) => ({
        ...prev,
        ...updates.reduce((acc, item) => {
          acc[item.id] = { ...(prev[item.id] || {}), facturaDecSubida: item.facturaDecSubida };
          return acc;
        }, {}),
      }));
      setProductosApi((prev) => {
        if (!Array.isArray(prev) || prev.length === 0) return prev;
        return prev.map((item) =>
          updatedById.has(item?.id) ? { ...item, facturaDecSubida: updatedById.get(item.id).facturaDecSubida } : item
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
      <div
        className={`${store === "ebay" ? "max-w-5xl" : "max-w-[1400px]"} w-full bg-white rounded-xl shadow-xl max-h-[94vh] flex flex-col overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b">
          <h2 className="text-base font-semibold">{store === "ebay" ? "Generar HTML - Printer friendly (solo textos)" : "DEC printable preview"}</h2>
          <button onClick={onClose} className="text-gray-700 hover:text-black text-sm" aria-label="Close modal">&lt; Back</button>
        </div>

        <div className="flex-1 overflow-y-auto">
        <div className={store === "ebay" ? "" : "grid xl:grid-cols-[500px_minmax(0,1fr)]"}>
        <div className={`grid gap-4 p-4 sm:p-6 ${store === "ebay" ? "border-b" : "border-b xl:border-b-0 xl:border-r"}`}>
          {hardError ? (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{hardError}</div>
          ) : null}

          <div className="grid gap-3">
            <label className="text-sm">
              <span className="block text-gray-600 mb-1">Tienda</span>
              <select className="input" value={store} onChange={(e) => setStore(e.target.value)}>
                <option value="ebay">eBay</option>
                <option value="amazon">Amazon</option>
                <option value="apple">Apple</option>
              </select>
            </label>
          </div>

          <div className="grid sm:grid-cols-4 gap-3">
            <label className="text-sm sm:col-span-2">
              <span className="block text-gray-600 mb-1">Producto (opcional, en camino)</span>
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
              <div className="text-[11px] text-gray-500 mt-1">
                Si no eliges producto, puedes crear la boleta llenando los campos manualmente.
              </div>
            </label>

            {productoSel ? (
              <label className="text-sm">
                <span className="block text-gray-600 mb-1">Valor DEC (producto)</span>
                <input className="input" value={productoSel?.__decResolved || ""} readOnly placeholder="-" />
              </label>
            ) : (
              <label className="text-sm">
                <span className="block text-gray-600 mb-1">Valor DEC total (USD)</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="input"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                />
              </label>
            )}

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

          <div className={`grid gap-3 mt-2 ${store === "ebay" ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
            {store === "ebay" ? (
              <label className="text-sm">
                <span className="block text-gray-600 mb-1">Seller</span>
                <input value={seller} onChange={(e) => setSeller(e.target.value)} className="input" placeholder="961firstave" />
              </label>
            ) : null}
            <label className="text-sm">
              <span className="block text-gray-600 mb-1">{store === "ebay" ? "Fecha de compra" : "Order placed"}</span>
              <input type="date" value={placedOn} onChange={(e) => setPlacedOn(e.target.value)} className="input" />
            </label>
            <label className="text-sm">
              <span className="block text-gray-600 mb-1">Order number</span>
              <input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} className="input" placeholder={store === "ebay" ? "16-13587-70764" : "112-6574313-0325818"} />
            </label>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <label className="text-sm">
              <span className="block text-gray-600 mb-1">Transportista</span>
              <input
                className="input"
                value={productoSel ? (carrier || "") : manualCarrier}
                onChange={(e) => setManualCarrier(e.target.value)}
                readOnly={!!productoSel}
                placeholder="-"
              />
            </label>
            <label className="text-sm">
              <span className="block text-gray-600 mb-1">Tracking #</span>
              <input
                className="input"
                value={productoSel ? (carrierTracking || "") : manualCarrierTracking}
                onChange={(e) => setManualCarrierTracking(e.target.value)}
                readOnly={!!productoSel}
                placeholder="-"
              />
            </label>
            <div />
          </div>

          <div className="border border-sky-200 rounded-lg p-3 bg-sky-50">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="text-sm">
                <div className="font-medium text-sky-900">Autofill formulario externo</div>
                <div className="text-sky-800 mt-1">Email: <span className="font-medium">{autofillPayload.email || "-"}</span></div>
                <div className="text-sky-800">Producto: <span className="font-medium">{autofillPayload.product}</span></div>
                <div className="text-sky-800">Tracking: <span className="font-medium">{autofillPayload.tracking || "-"}</span></div>
                <div className="text-sky-800">Valor USD: <span className="font-medium">{autofillPayload.purchaseValue}</span></div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={copyAutofillPayload}
                  className="px-3 py-2 rounded border border-sky-300 text-sky-900 text-sm hover:bg-white"
                >
                  Copiar payload
                </button>
                <button
                  type="button"
                  onClick={configureAutofillTarget}
                  className="px-3 py-2 rounded border border-sky-300 text-sky-900 text-sm hover:bg-white"
                >
                  URL formulario
                </button>
                <button
                  type="button"
                  onClick={openAutofillTarget}
                  className="px-3 py-2 rounded bg-sky-700 text-white text-sm hover:bg-sky-800"
                >
                  Abrir y rellenar
                </button>
              </div>
            </div>
            <div className="text-[11px] text-sky-900 mt-2 break-all">
              {autofillTargetUrl
                ? `Destino guardado: ${autofillTargetUrl}`
                : "Primero guarda la URL del formulario externo. Luego 'Abrir y rellenar' enviara el payload por URL y portapapeles."}
            </div>
          </div>

          <div className="hidden">
            <label className="text-sm">
              <span className="block text-gray-600 mb-1">Tienda</span>
              <select className="input" value={store} onChange={(e) => setStore(e.target.value)}>
                <option value="ebay">eBay</option>
                <option value="amazon">Amazon</option>
                <option value="apple">Apple</option>
              </select>
            </label>
          </div>

          <div className="grid sm:grid-cols-4 gap-3">
            <label className="text-sm sm:col-span-2">
              <span className="block text-gray-600 mb-1">Item name</span>
              <div className="space-y-2">
                <input
                  value={itemName}
                  onChange={(e) => onEditItemName(e.target.value)}
                  className="input w-full"
                  placeholder='Ej. MacBook Pro i7 13" 16GB RAM 512GB Screen cracked'
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={rollName}
                    title="Elegir CPU (Mac) + problema aleatorio"
                    className="px-3 h-10 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700"
                  >
                    <FaDice className="text-base" />
                  </button>
                  {store === "amazon" && linkedGroup.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => setGroupLinkedAsSame((prev) => !prev)}
                      className={`px-3 h-10 rounded-lg text-xs border transition ${
                        groupLinkedAsSame
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                      }`}
                      title="Si son iguales, Amazon mostrara un solo item con cantidad"
                    >
                      {groupLinkedAsSame ? "Mismo producto: Si" : "Mismo producto"}
                    </button>
                  ) : null}
                </div>
              </div>
            </label>
            {store === "ebay" ? (
              <label className="text-sm">
                <span className="block text-gray-600 mb-1">Shipping service</span>
                <input value={shippingSvc} onChange={(e) => setShippingSvc(e.target.value)} className="input" placeholder="Standard Shipping" />
              </label>
            ) : <div />}
            {!productoSel && manualHasMultiple ? (
              <label className="text-sm">
                <span className="block text-gray-600 mb-1">DEC ref (item 1)</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={manualMainDecRef}
                  onChange={(e) => setManualMainDecRef(e.target.value)}
                  className="input"
                  placeholder="0.00"
                />
              </label>
            ) : null}
          </div>

          {linkedGroup.length > 1 && !groupLinkedAsSame ? (
            <div className="grid sm:grid-cols-2 gap-3">
              {linkedGroupOthers.map((p) => {
                const value = linkedItemNames[p.id] || randomNames[p.id]?.full || buildCoreName(p);
                return (
                  <label key={p.id} className="text-[11px] text-gray-600">
                    <span className="block mb-1">Item name vinculado #{p.id}</span>
                    <div className="space-y-2">
                      <input
                        className="input text-xs py-1.5 w-full"
                        value={value}
                        onChange={(e) =>
                          setLinkedItemNames((prev) => ({ ...prev, [p.id]: e.target.value }))
                        }
                      />
                      <div>
                        <button
                          type="button"
                          onClick={() => rollLinkedName(p)}
                          title="Generar item name"
                          className="px-3 h-9 rounded-lg bg-indigo-600 text-white text-xs hover:bg-indigo-700"
                        >
                          <FaDice className="text-sm" />
                        </button>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          ) : null}

          {!productoSel ? (
            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="text-sm font-medium text-gray-700">Items adicionales (manual)</div>
                <button
                  type="button"
                  onClick={addManualLinkedLine}
                  className="px-3 py-1.5 rounded bg-gray-800 text-white text-xs hover:bg-gray-900"
                >
                  + Agregar linea
                </button>
              </div>
              <div className="text-[11px] text-gray-500 mb-3">
                {manualHasMultiple
                  ? "Modo manual: define DEC ref por item y se prorratea el Valor DEC total en base a esos refs."
                  : "Modo manual: con 1 producto no se necesita DEC ref por item."}
              </div>
              {manualLinkedLines.length > 0 ? (
                <div className="grid sm:grid-cols-2 gap-3">
                  {manualLinkedLines.map((line, idx) => (
                    <label key={line.id} className="text-[11px] text-gray-600">
                      <span className="block mb-1">Item name manual #{idx + 2}</span>
                      <div className={`grid ${manualHasMultiple ? "grid-cols-[1fr_130px_auto]" : "grid-cols-[1fr_auto]"} gap-2`}>
                        <input
                          className="input text-xs py-1.5 flex-1"
                          value={line.name}
                          onChange={(e) => updateManualLinkedLine(line.id, { name: e.target.value })}
                        />
                        {manualHasMultiple ? (
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            className="input text-xs py-1.5"
                            value={line.decRef || ""}
                            onChange={(e) => updateManualLinkedLine(line.id, { decRef: e.target.value })}
                            placeholder="DEC ref"
                          />
                        ) : null}
                        <button
                          type="button"
                          onClick={() => rollManualLinkedName(line.id)}
                          title="Generar item name"
                          className="px-2 rounded-lg bg-indigo-600 text-white text-xs hover:bg-indigo-700"
                        >
                          <FaDice className="text-sm" />
                        </button>
                      </div>
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {store !== "ebay" ? (
            <>
              <div className="grid sm:grid-cols-3 gap-3">
                <label className="text-sm">
                  <span className="block text-gray-600 mb-1">Estado entrega</span>
                  <select className="input" value={deliveryMode} onChange={(e) => setDeliveryMode(e.target.value)}>
                    <option value="tomorrow">Delivered tomorrow</option>
                    <option value="arrivingToday">Arriving today</option>
                    <option value="delivered">Delivered + fecha</option>
                    <option value="custom">Texto manual</option>
                  </select>
                </label>
                {deliveryMode === "delivered" ? (
                  <label className="text-sm">
                    <span className="block text-gray-600 mb-1">Fecha entregada</span>
                    <input type="date" value={deliveredOn} onChange={(e) => setDeliveredOn(e.target.value)} className="input" />
                  </label>
                ) : deliveryMode === "arrivingToday" ? (
                  <div className="sm:col-span-2 text-xs text-gray-500 flex items-end pb-2">
                    Se mostrara &quot;Arriving today&quot; y Amazon contara 15 dias calendario desde hoy para &quot;Eligible through&quot;.
                  </div>
                ) : deliveryMode === "custom" ? (
                  <label className="text-sm sm:col-span-2">
                    <span className="block text-gray-600 mb-1">Texto de entrega</span>
                    <input value={customDeliveryText} onChange={(e) => setCustomDeliveryText(e.target.value)} className="input" placeholder="Delivered Thursday, March 20" />
                  </label>
                ) : <div className="sm:col-span-2 text-xs text-gray-500 flex items-end pb-2">Se mostrara "Delivered tomorrow".</div>}
              </div>

              <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-3">
                <div className="text-sm font-medium text-gray-700">Imagen del producto</div>
                <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
                  <label className="text-sm">
                    <span className="block text-gray-600 mb-1">URL de imagen</span>
                    <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="input" placeholder="https://..." />
                  </label>
                  <button type="button" onClick={handleLoadRemoteImage} disabled={imageBusy || !String(imageUrl || "").trim()} className={`px-3 py-2 rounded text-sm ${imageBusy || !String(imageUrl || "").trim() ? "bg-gray-300 text-gray-600" : "bg-black text-white hover:bg-gray-900"}`}>
                    {imageBusy ? "Procesando..." : "Cargar URL"}
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="px-3 py-2 rounded border border-gray-300 text-sm cursor-pointer hover:bg-white">
                    Subir imagen
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageFile} />
                  </label>
                  <button type="button" onClick={resetImage} className="px-3 py-2 rounded border border-gray-300 text-sm hover:bg-white">Limpiar imagen</button>
                  <div className="text-xs text-gray-500">{imageFileName ? `Archivo: ${imageFileName}` : "Acepta URL o archivo local."}</div>
                </div>
                <div className="grid sm:grid-cols-[110px_160px_1fr] gap-4 items-center">
                  <div className="rounded-lg border border-gray-300 bg-white p-2 flex items-center justify-center">
                    <img src={imageSmall} alt="90x90" className="w-[90px] h-[90px] object-cover" />
                  </div>
                  <div className="rounded-lg border border-gray-300 bg-white p-2 flex items-center justify-center overflow-hidden">
                    <img src={imageLarge} alt="284x284" className="w-[142px] h-[142px] object-cover" />
                  </div>
                  <div className={`text-xs ${imageStatus.includes("No se pudo") ? "text-red-600" : "text-gray-600"}`}>
                    <div>Proceso aplicado: 284x284 y luego 90x90.</div>
                    <div className="mt-1">{imageStatus || "Usando placeholder hasta que cargues una imagen."}</div>
                  </div>
                </div>
                {store === "amazon" && linkedGroupOthers.length > 0 && !groupLinkedAsSame ? (
                  <div className="pt-2 border-t border-gray-200 space-y-3">
                    <div className="text-sm font-medium text-gray-700">Imagen por producto vinculado</div>
                    {linkedGroupOthers.map((p) => {
                      const entry = getLinkedImageEntry(p.id);
                      const linkedName = linkedItemNames[p.id] || randomNames[p.id]?.full || buildCoreName(p);
                      return (
                        <div key={`img-linked-${p.id}`} className="rounded-lg border border-gray-200 bg-white p-3 space-y-3">
                          <div className="text-xs font-medium text-gray-700">#{p.id} {linkedName || buildCoreName(p)}</div>
                          <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
                            <label className="text-sm">
                              <span className="block text-gray-600 mb-1">URL de imagen</span>
                              <input
                                value={entry.url || ""}
                                onChange={(e) => setLinkedImageEntry(p.id, { url: e.target.value })}
                                className="input"
                                placeholder="https://..."
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => handleLoadRemoteLinkedImage(p.id)}
                              disabled={entry.busy || !String(entry.url || "").trim()}
                              className={`px-3 py-2 rounded text-sm ${entry.busy || !String(entry.url || "").trim() ? "bg-gray-300 text-gray-600" : "bg-black text-white hover:bg-gray-900"}`}
                            >
                              {entry.busy ? "Procesando..." : "Cargar URL"}
                            </button>
                          </div>
                          <div className="flex flex-wrap items-center gap-3">
                            <label className="px-3 py-2 rounded border border-gray-300 text-sm cursor-pointer hover:bg-white">
                              Subir imagen
                              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleLinkedImageFile(p.id, e)} />
                            </label>
                            <button type="button" onClick={() => resetLinkedImage(p.id)} className="px-3 py-2 rounded border border-gray-300 text-sm hover:bg-white">Limpiar imagen</button>
                            <div className="text-xs text-gray-500">{entry.fileName ? `Archivo: ${entry.fileName}` : "Acepta URL o archivo local."}</div>
                          </div>
                          <div className="grid sm:grid-cols-[110px_160px_1fr] gap-4 items-center">
                            <div className="rounded-lg border border-gray-300 bg-white p-2 flex items-center justify-center">
                              <img src={entry.small || DEFAULT_IMAGE_SRC} alt={`90x90-${p.id}`} className="w-[90px] h-[90px] object-cover" />
                            </div>
                            <div className="rounded-lg border border-gray-300 bg-white p-2 flex items-center justify-center overflow-hidden">
                              <img src={entry.large || DEFAULT_IMAGE_SRC} alt={`284x284-${p.id}`} className="w-[142px] h-[142px] object-cover" />
                            </div>
                            <div className={`text-xs ${String(entry.status || "").includes("No se pudo") ? "text-red-600" : "text-gray-600"}`}>
                              <div>Proceso aplicado: 284x284 y luego 90x90.</div>
                              <div className="mt-1">{entry.status || "Usando placeholder hasta que cargues una imagen."}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

          {store === "apple" ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button type="button" onClick={openPrintDialog} className="px-3 py-2 rounded bg-amber-400 text-black text-sm hover:bg-amber-300">
                Imprimir / Guardar PDF
              </button>
              <button
                type="button"
                onClick={toggleFacturaMarcada}
                disabled={!productoSel || savingFactura || facturaMarcada}
                className={`px-3 py-2 rounded text-sm border transition ${
                  facturaMarcada
                    ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                } ${(!productoSel || savingFactura || facturaMarcada) ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {facturaButtonLabel}
              </button>
            </div>
          ) : null}
        </div>

        {store === "apple" ? (
        <div className="p-4 sm:p-6 bg-slate-100">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h3 className="font-semibold text-slate-900">Vista previa</h3>
              <p className="text-xs text-slate-500">Esto es lo que se imprimira o se guardara como PDF.</p>
            </div>
            <div className="text-xs text-slate-500">{store === "ebay" ? "Template eBay" : store === "amazon" ? "Template Amazon" : "Template Apple"}</div>
          </div>
          <div className="rounded-xl overflow-hidden border border-slate-300 bg-white shadow-sm">
            <iframe title="DEC preview" srcDoc={previewDoc} className="w-full h-[78vh] bg-white" />
          </div>
        </div>
        ) : null}

        <div className={isHtmlStore ? "p-4 sm:p-6" : "hidden"}>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-2 gap-4">
            <div>
              <h3 className="font-semibold">HTML (solo contenedor destino)</h3>
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-1">
                Recordatorio: busca <code>{htmlSelector}</code> en tu DOM para pegar este HTML.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={copySelector} className="px-3 py-1.5 rounded border border-gray-300 text-sm hover:bg-gray-50 h-9">Copiar selector</button>
              <button onClick={copyHTML} className="px-3 py-1.5 rounded bg-black text-white text-sm hover:bg-gray-900 h-9">Copiar HTML</button>
              <button
                type="button"
                onClick={publishTemplate}
                disabled={publishingTemplate}
                className={`px-3 py-1.5 rounded text-sm h-9 border transition ${
                  publishingTemplate
                    ? "bg-blue-300 text-white border-blue-300"
                    : "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
                } ${publishingTemplate ? "cursor-not-allowed opacity-70" : ""}`}
                title="Guardar plantilla en el endpoint para Tampermonkey"
              >
                {publishingTemplate ? "Publicando..." : "Publicar plantilla TM"}
              </button>
              <button
                type="button"
                onClick={toggleFacturaMarcada}
                disabled={!productoSel || savingFactura || facturaMarcada}
                className={`px-3 py-1.5 rounded text-sm h-9 border transition ${
                  facturaMarcada
                    ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                } ${(!productoSel || savingFactura || facturaMarcada) ? 'opacity-60 cursor-not-allowed' : ''}`}
                title={productoSel ? (facturaTargets.length > 1 ? 'Marca cuando las facturas del grupo ya fueron subidas' : 'Marca cuando la factura ya fue subida') : 'Selecciona un producto primero'}
              >
                {facturaButtonLabel}
              </button>
            </div>
          </div>

          <textarea id="dec-html-ta" className="w-full max-w-md h-[200px] border rounded p-3 font-mono text-xs resize-none" readOnly value={html} />
          <p className="text-xs text-gray-500 mt-2">
            {store === "amazon"
              ? <>Copia este bloque y reemplaza en el DOM únicamente la parte <code>&lt;div data-component="default"&gt;...&lt;/div&gt;</code>.</>
              : <>Copia este bloque y reemplaza en el DOM únicamente la parte <code>&lt;div class="modal-content"&gt;...&lt;/div&gt;</code>.</>}
          </p>
          <p className={`text-xs mt-2 ${publishStatus.includes("No se pudo") ? "text-red-600" : "text-emerald-700"}`}>
            {publishStatus || (publishAt ? `Plantilla publicada: ${new Date(publishAt).toLocaleString()}` : "Aún no se ha publicado plantilla para TM.")}
          </p>
        </div>
        </div>
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


