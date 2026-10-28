// AirPods: modelo/edición comercial; ANC solo cuando la generación tiene ambas versiones documentadas.
import CatalogModelFields from './CatalogModelFields';

export default function FormProductoAirpods({ detalle, onChange }) {
  return <CatalogModelFields tipo="airpods" detalle={detalle} onChange={onChange} />;
}
