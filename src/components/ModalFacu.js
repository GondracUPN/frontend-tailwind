import React, { useMemo, useState, useEffect } from "react";
import api from "../api";

const CASILLEROS = {
  Renato: "Renato Carbajal",
  Jorge: "Jorge Sahid Garcia Sanchez",
};

function fmtUSD(n) {
  const num = Number(n) || 0;
  return `$${num.toFixed(2)}`;
}

function fmtDateUS(d) {
  if (!d) return "";
  const dt = new Date(`${d}T00:00:00`);
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function buildItemNameWithIds(baseName, sn, imei1, imei2) {
  const base = String(baseName || "").trim();
  const snVal = String(sn || "").trim();
  const i1 = String(imei1 || "").trim();
  const i2 = String(imei2 || "").trim();
  const parts = [base];

  if (snVal) parts.push(`SN:${snVal}`);
  if (i1 && i2) {
    parts.push(`Imei 1: ${i1}`);
    parts.push(`Imei 2: ${i2}`);
  } else {
    const onlyImei = i1 || i2;
    if (onlyImei) parts.push(`Imei: ${onlyImei}`);
  }
  return parts.filter(Boolean).join(" ");
}

function buildModalContentHTML({
  seller,
  placedOn,
  orderNumber,
  casilleroKey,
  price,
  itemName,
  shippingSvc,
}) {
  const paidOn = placedOn;
  const placedOnTxt = fmtDateUS(placedOn);
  const paidOnTxt = fmtDateUS(paidOn);
  const itemPrice = Number(price) || 0;
  const subtotal = itemPrice;
  const orderTotal = subtotal;
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
                      <p><span class="textual-display"><span class="eui-textual-display"><span class="eui-text-span"><span>1920 NW 18th Street</span></span></span></span></p>
                      <p><span class="textual-display"><span class="eui-textual-display"><span class="eui-text-span"><span>Miami, Florida 33182</span></span></span></span></p>
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
                                  <dt class="eui-label"><span class="eui-textual-display"><span class="eui-text-span"><span>1 item</span></span></span></dt>
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
                </div>
              </div>

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
                          <tr>
                            <td><span class="textual-display"><span class="eui-textual-display"><span class="eui-text-span"><span>1</span></span></span></span></td>
                            <td><span class="textual-display"><span class="eui-textual-display"><span class="eui-text-span"><span>${itemName || ""}</span></span></span></span></td>
                            <td><span class="textual-display"><span class="eui-textual-display"><span class="eui-text-span"><span>${shippingSvc || "Standard Shipping"}</span></span></span></span></td>
                            <td><span class="textual-display"><span class="eui-textual-display"><span class="eui-text-span"><span>${fmtUSD(itemPrice)}</span></span></span></span></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
`.trim();
}

export default function ModalFacu({ onClose }) {
  const [seller, setSeller] = useState("961firstave");
  const [placedOn, setPlacedOn] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [casilleroKey, setCasilleroKey] = useState("Renato");
  const [price, setPrice] = useState("0.00");
  const [itemNameBase, setItemNameBase] = useState("");
  const [shippingSvc, setShippingSvc] = useState("Standard Shipping");
  const [serialNumber, setSerialNumber] = useState("");
  const [imei1, setImei1] = useState("");
  const [imei2, setImei2] = useState("");
  const [publishingTemplate, setPublishingTemplate] = useState(false);
  const [publishStatus, setPublishStatus] = useState("");
  const [publishAt, setPublishAt] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const meta = await api.get("/tm/ebay-template/meta");
        if (mounted && meta?.updatedAt) {
          setPublishAt(meta.updatedAt);
        }
      } catch {
        // no template yet
      }
    })();
    return () => { mounted = false; };
  }, []);

  const itemName = useMemo(
    () => buildItemNameWithIds(itemNameBase, serialNumber, imei1, imei2),
    [itemNameBase, serialNumber, imei1, imei2]
  );

  const html = useMemo(
    () =>
      buildModalContentHTML({
        seller,
        placedOn,
        orderNumber,
        casilleroKey,
        price,
        itemName,
        shippingSvc,
      }),
    [seller, placedOn, orderNumber, casilleroKey, price, itemName, shippingSvc]
  );

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleOverlayClick = (e) => { if (e.target === e.currentTarget) onClose?.(); };

  const copyHTML = async () => {
    try { await navigator.clipboard.writeText(html); alert("HTML copiado al portapapeles"); }
    catch {
      const ta = document.getElementById("facu-html-ta");
      if (ta) { ta.select(); document.execCommand("copy"); alert("HTML copiado (fallback)"); }
    }
  };

  const copySelector = async () => {
    try { await navigator.clipboard.writeText('class="gen-tables"'); } catch { /* ignore */ }
  };

  const publishTemplate = async () => {
    if (publishingTemplate) return;
    setPublishingTemplate(true);
    setPublishStatus("");
    try {
      const res = await api.post("/tm/ebay-template", {
        html,
        source: "modal-facu",
      });
      if (res?.updatedAt) setPublishAt(res.updatedAt);
      setPublishStatus("Plantilla publicada para Tampermonkey.");
    } catch (err) {
      console.error("[ModalFacu] Error publicando plantilla TM:", err);
      setPublishStatus("No se pudo publicar la plantilla.");
    } finally {
      setPublishingTemplate(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4"
      onClick={handleOverlayClick}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="w-full max-w-5xl bg-white rounded-xl shadow-xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b">
          <h2 className="text-base font-semibold">Generar FACU - Printer friendly (solo textos)</h2>
          <div className="flex items-center">
            <button onClick={onClose} className="text-gray-700 hover:text-black text-sm" aria-label="Close modal">&lt; Back</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="grid gap-4 p-4 sm:p-6 border-b">
            <div className="grid sm:grid-cols-3 gap-3">
              <label className="text-sm">
                <span className="block text-gray-600 mb-1">Valor DEC (USD)</span>
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

              <label className="text-sm sm:col-span-2">
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
              </label>
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
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

            <div className="grid sm:grid-cols-3 gap-3">
              <label className="text-sm sm:col-span-2">
                <span className="block text-gray-600 mb-1">Item name</span>
                <input
                  value={itemNameBase}
                  onChange={(e) => setItemNameBase(e.target.value)}
                  className="input"
                  placeholder='Ej. Iphone 14 128gb'
                />
              </label>
              <label className="text-sm">
                <span className="block text-gray-600 mb-1">Shipping service</span>
                <input value={shippingSvc} onChange={(e) => setShippingSvc(e.target.value)} className="input" placeholder="Standard Shipping" />
              </label>
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <label className="text-sm">
                <span className="block text-gray-600 mb-1">SN</span>
                <input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} className="input" placeholder="Serial Number" />
              </label>
              <label className="text-sm">
                <span className="block text-gray-600 mb-1">Imei 1</span>
                <input value={imei1} onChange={(e) => setImei1(e.target.value)} className="input" placeholder="Imei 1" />
              </label>
              <label className="text-sm">
                <span className="block text-gray-600 mb-1">Imei 2</span>
                <input value={imei2} onChange={(e) => setImei2(e.target.value)} className="input" placeholder="Imei 2" />
              </label>
            </div>

            <div className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded px-2 py-1">
              Item final: <span className="font-medium">{itemName || "-"}</span>
            </div>
          </div>

          <div className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-2 gap-4">
              <div>
                <h3 className="font-semibold">HTML (solo "modal-content")</h3>
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-1">
                  Recordatorio: busca <code>class="gen-tables"</code> en tu DOM para pegar este HTML.
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
              </div>
            </div>

            <textarea id="facu-html-ta" className="w-full max-w-md h-[200px] border rounded p-3 font-mono text-xs resize-none" readOnly value={html} />
            <p className={`text-xs mt-2 ${publishStatus.includes("No se pudo") ? "text-red-600" : "text-emerald-700"}`}>
              {publishStatus || (publishAt ? `Plantilla publicada: ${new Date(publishAt).toLocaleString()}` : "Aun no se ha publicado plantilla para TM.")}
            </p>
          </div>
        </div>
      </div>

      <style>{`
        .input{ width:100%; border:1px solid #d1d5db; border-radius:0.5rem; padding:0.5rem 0.75rem; outline:none; }
        .input:focus{ box-shadow:0 0 0 3px rgba(99,102,241,.2); border-color:#6366f1; }
      `}</style>
    </div>
  );
}
