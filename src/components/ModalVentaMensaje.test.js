import { fireEvent, render, screen } from '@testing-library/react';
import ModalVentaMensaje from './ModalVentaMensaje';

const productos = [
  { id: 42, label: 'iPhone 15 Pro' },
  { id: 123, label: 'MacBook Air M3' },
];

test('permite buscar el producto por Code y muestra producto mas codigo en el desplegable', () => {
  render(<ModalVentaMensaje onClose={jest.fn()} productos={productos} />);

  expect(screen.getByRole('option', { name: 'MS-42 - iPhone 15 Pro' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'MS-123 - MacBook Air M3' })).toBeInTheDocument();

  fireEvent.change(screen.getByPlaceholderText('Buscar por producto o Code (MS-123, MS123 o 123)'), {
    target: { value: 'MS123' },
  });

  expect(screen.queryByRole('option', { name: 'MS-42 - iPhone 15 Pro' })).not.toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'MS-123 - MacBook Air M3' })).toBeInTheDocument();
});
