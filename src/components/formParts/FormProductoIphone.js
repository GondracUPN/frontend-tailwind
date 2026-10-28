// src/components/formParts/FormProductoIphone.js
// iPhone: modelo comercial y configuraciones válidas desde el catálogo Apple (/apple-catalog/forms).
import CatalogModelFields from './CatalogModelFields';

export default function FormProductoIphone({ detalle, onChange }) {
  return <CatalogModelFields tipo="iphone" detalle={detalle} onChange={onChange} />;
}
