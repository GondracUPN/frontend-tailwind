import React from 'react';
import PanelVentaCuotas from './ventas/PanelVentaCuotas';
export default function ModalAdelantoDetalle({ adelanto, onClose, onSaved }) {
  return adelanto?.id ? <PanelVentaCuotas adelantoId={adelanto.id} onClose={onClose} onChanged={onSaved} /> : null;
}
