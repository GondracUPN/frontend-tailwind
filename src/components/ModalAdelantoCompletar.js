import React from 'react';
import PanelVentaCuotas from './ventas/PanelVentaCuotas';
export default function ModalAdelantoCompletar({ adelanto, onClose, onSaved }) {
  return adelanto?.id ? <PanelVentaCuotas adelantoId={adelanto.id} onClose={onClose} onChanged={onSaved} /> : null;
}
