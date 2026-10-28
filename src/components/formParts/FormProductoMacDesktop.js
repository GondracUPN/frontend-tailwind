// iMac / Mac mini: chip, RAM y almacenamiento válidos por modelo; pantalla solo en iMac.
import CatalogModelFields from './CatalogModelFields';

export default function FormProductoMacDesktop({ tipo, detalle = {}, onChange }) {
  return <CatalogModelFields tipo={tipo === 'imac' ? 'imac' : 'macmini'} detalle={detalle} onChange={onChange} idPrefix={`producto-${tipo || 'macdesktop'}`} />;
}
