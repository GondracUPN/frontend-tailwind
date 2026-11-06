import React, { useEffect, useRef, useState } from 'react';
import api from '../api';

const BUTTON = 'rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50';
const PRIMARY = 'rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50';
const initialPage = { stores: [], items: [], source: null, searched: false, scanned: 0, nextOffset: 0, hasMore: false, failedChecks: 0, offset: 0, phase: 'buya', nextPhase: 'buya', newMatches: null };

const mergeUnique = (previous, next, key) => {
  const entries = new Map();
  [...previous, ...next].forEach((entry) => { if (!entries.has(key(entry))) entries.set(key(entry), entry); });
  return [...entries.values()];
};
const ExternalLink = ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-amber-800 underline underline-offset-2">{children}</a>;

export default function EbayBuyaModal({ onClose }) {
  const [mode, setMode] = useState('stores');
  const [productUrl, setProductUrl] = useState('');
  const [storesPage, setStoresPage] = useState(initialPage);
  const [productPage, setProductPage] = useState(initialPage);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dialogRef = useRef(null);
  const requestRef = useRef(null);
  const page = mode === 'stores' ? storesPage : productPage;

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.querySelector('button')?.focus();
    return () => {
      requestRef.current?.abort();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  const search = async ({ append = false, retry = false } = {}) => {
    if (requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setBusy(true);
    setError('');
    const offset = retry ? page.offset : append ? page.nextOffset : 0;
    const phase = retry ? page.phase : append ? page.nextPhase : 'buya';
    const url = append || retry ? productPage.source?.url : productUrl.trim();
    try {
      const options = { signal: controller.signal, timeoutMs: 120000 };
      const data = mode === 'stores'
        ? await api.get(`/utils/ebay/buya/stores?offset=${offset}${phase === 'recent' ? '&phase=recent' : ''}`, options)
        : await api.post('/utils/ebay/buya/product', { url, offset }, options);
      if (controller.signal.aborted) return;
      const update = mode === 'stores' ? setStoresPage : setProductPage;
      update((previous) => ({
        ...initialPage, ...data, searched: true,
        newMatches: (data.stores || []).filter((store) => !(append || retry ? previous.stores : []).some((saved) => saved.seller.toLowerCase() === store.seller.toLowerCase())).length,
        scanned: (append || retry ? previous.scanned : 0) + (retry ? 0 : Number(data.scanned || 0)),
        stores: append || retry ? mergeUnique(previous.stores, data.stores || [], (store) => store.seller.toLowerCase()) : data.stores || [],
        items: append || retry ? mergeUnique(previous.items, data.items || [], (item) => item.itemId) : data.items || [],
      }));
    } catch (err) {
      if (!controller.signal.aborted) setError(String(err?.message || 'No se pudo completar la búsqueda de Buya.'));
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      requestRef.current = null;
    }
  };

  const handleKeyboard = (event) => {
    if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
    if (event.key !== 'Tab') return;
    const focusable = [...dialogRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), a[href]')];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-2 sm:p-4" onKeyDown={handleKeyboard}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="buya-modal-title" aria-describedby="buya-modal-description" className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-4 shadow-2xl sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h3 id="buya-modal-title" className="text-xl font-semibold text-slate-900">Buya</h3>
          <button type="button" onClick={onClose} className={BUTTON}>Cerrar</button>
        </div>
        <p id="buya-modal-description" className="mt-2 text-sm text-slate-600">Encuentra tiendas y publicaciones de Buya en eBay.</p>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2" role="group" aria-label="Tipo de búsqueda Buya">
          <button type="button" aria-pressed={mode === 'stores'} disabled={busy} onClick={() => { setMode('stores'); setError(''); }} className={mode === 'stores' ? PRIMARY : BUTTON}>Tiendas Buya con Apple</button>
          <button type="button" aria-pressed={mode === 'product'} disabled={busy} onClick={() => { setMode('product'); setError(''); }} className={mode === 'product' ? PRIMARY : BUTTON}>Buscar un producto</button>
        </div>

        {mode === 'stores' ? (
          <div className="mt-4">
            <p className="text-sm leading-6 text-slate-600">Revisa las publicaciones más recientes de Apple en eBay y busca enlaces o referencias a Buya en sus descripciones. Cada tienda incluye la publicación donde se encontró la referencia.</p>
            <button type="button" disabled={busy} onClick={() => search()} className={`${PRIMARY} mt-3`}>Buscar tiendas</button>
          </div>
        ) : (
          <form className="mt-4" onSubmit={(event) => { event.preventDefault(); search(); }}>
            <label htmlFor="buya-product-url" className="text-sm font-semibold text-slate-700">Enlace del producto de Buya</label>
            <input id="buya-product-url" type="url" required maxLength={2000} disabled={busy} placeholder="https://www.buya.com/Item/Details/..." value={productUrl} onChange={(event) => setProductUrl(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
            <p className="mt-2 text-sm text-slate-600">Extrae el código de inventario de la ficha y busca ese código completo en el título o la descripción de los anuncios de eBay.</p>
            <button type="submit" disabled={busy || !productUrl.trim()} className={`${PRIMARY} mt-3`}>Buscar en eBay</button>
          </form>
        )}

        {busy && <p role="status" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{mode === 'stores' ? 'Revisando publicaciones recientes y sus descripciones...' : 'Leyendo el código de Buya y comprobando coincidencias en eBay...'}</p>}
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        {page.searched && (
          <div className="mt-5 space-y-3" aria-live="polite">
            {mode === 'product' && page.source && <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
              <div className="font-semibold">{page.source.title}</div>
              <div className="mt-1">Código de inventario: <strong>{page.source.inventoryCode}</strong></div>
              <ExternalLink href={page.source.url}>Ver producto en Buya</ExternalLink>
            </div>}
            <p className="text-sm text-slate-600">{mode === 'stores' ? `${page.stores.length} tiendas encontradas` : `${page.items.length} coincidencias con el código exacto`} · {page.scanned} publicaciones exploradas</p>
            {mode === 'stores' && <div role="status" className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
              {page.phase === 'recent' ? 'Búsqueda ampliada: revisando descripciones de publicaciones recientes de Apple.' : 'Revisando publicaciones que eBay relaciona con Apple y Buya.'}
              {page.newMatches === 0 && ' Este bloque no añadió tiendas nuevas.'}
              {page.phase === 'buya' && page.nextPhase === 'recent' && ' La siguiente búsqueda se ampliará a otras publicaciones de Apple.'}
              {!page.hasMore && ' Se llegó al final de los resultados disponibles en esta búsqueda.'}
            </div>}
            {mode === 'stores' && page.stores.map((store) => <article key={store.seller.toLowerCase()} className="rounded-xl border border-slate-200 p-4">
              <div className="break-words font-semibold text-slate-900">{store.storeName}</div>
              <div className="text-sm text-slate-600">Vendedor: {store.seller}</div>
              <p className="mt-2 text-sm text-slate-600">{store.evidence}</p>
              <p className="mt-1 break-words text-sm text-slate-700">{store.latestItem.title}</p>
              <div className="mt-3 flex flex-wrap gap-4">
                <ExternalLink href={store.ebayUrl}>Ver tienda en eBay</ExternalLink>
                <ExternalLink href={store.buyaUrl}>Ver enlace de Buya</ExternalLink>
                <ExternalLink href={store.latestItem.itemWebUrl}>Ver publicación reciente</ExternalLink>
              </div>
            </article>)}
            {mode === 'product' && page.items.map((item) => <article key={item.itemId} className="rounded-xl border border-slate-200 p-4">
              <div className="break-words font-semibold text-slate-900">{item.title}</div>
              <div className="mt-1 text-sm text-slate-600">Vendedor: {item.seller}{item.priceUSD != null ? ` · US$ ${Number(item.priceUSD).toFixed(2)}` : ''}</div>
              <p className="my-2 text-sm text-slate-600">Código exacto encontrado en {item.matchedIn === 'title' ? 'el título' : 'la descripción o los detalles'}.</p>
              <ExternalLink href={item.itemWebUrl}>Ver producto en eBay</ExternalLink>
            </article>)}
            {!(mode === 'stores' ? page.stores.length : page.items.length) && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
              {page.failedChecks > 0 ? 'La comprobación quedó incompleta. Puedes reintentar este bloque.' : mode === 'stores' ? 'No se encontraron referencias a Buya en este bloque de publicaciones.' : 'No se encontró el código exacto en las publicaciones comprobadas.'}
              {page.hasMore && ' Puedes seguir buscando en el siguiente bloque.'}
            </p>}
            {page.failedChecks > 0 && <div role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
              No se pudieron comprobar {page.failedChecks} publicaciones de este bloque.
              <button type="button" disabled={busy} onClick={() => search({ retry: true })} className={`${BUTTON} ml-2`}>Reintentar bloque</button>
            </div>}
            {page.hasMore && <button type="button" disabled={busy} onClick={() => search({ append: true })} className={PRIMARY}>{mode === 'stores' ? 'Seguir buscando tiendas' : 'Seguir buscando el código'}</button>}
          </div>
        )}
      </div>
    </div>
  );
}
