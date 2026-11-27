import React from 'react';
import { closeDetachedModal, useDetachedModals } from '../services/detachedModals';

export default function DetachedModalsHost() {
  const modals = useDetachedModals();
  return modals.map((modal) => (
    <React.Fragment key={modal.id}>{modal.render(() => closeDetachedModal(modal.id))}</React.Fragment>
  ));
}
