// src/components/formParts/FormProductoMacbook.js
// MacBook: modelo comercial y configuraciones válidas desde el catálogo Apple (/apple-catalog/forms).
import CatalogModelFields from './CatalogModelFields';

export default function FormProductoMacbook({ detalle, onChange }) {
  return <CatalogModelFields tipo="macbook" detalle={detalle} onChange={onChange} />;
}
