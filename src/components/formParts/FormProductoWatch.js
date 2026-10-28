// src/components/formParts/FormProductoWatch.js
// Apple Watch: modelo comercial y configuraciones válidas desde el catálogo Apple (/apple-catalog/forms).
import CatalogModelFields from './CatalogModelFields';

export default function FormProductoWatch({ detalle, onChange }) {
  return <CatalogModelFields tipo="watch" detalle={detalle} onChange={onChange} />;
}
