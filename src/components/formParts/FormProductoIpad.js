// src/components/formParts/FormProductoIpad.js
// iPad: modelo comercial y configuraciones válidas desde el catálogo Apple (/apple-catalog/forms).
import CatalogModelFields from './CatalogModelFields';

export default function FormProductoIpad({ detalle, onChange }) {
  return <CatalogModelFields tipo="ipad" detalle={detalle} onChange={onChange} />;
}
