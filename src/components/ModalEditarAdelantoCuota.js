import React from 'react';
import PanelVentaCuotas from './ventas/PanelVentaCuotas';
export default function ModalEditarAdelantoCuota({ adelanto, adelantoId, index, onClose, onSaved }) {
  return <PanelVentaCuotas adelantoId={adelantoId || adelanto?.id} initialIndex={index} onClose={onClose} onChanged={onSaved} />;
}
