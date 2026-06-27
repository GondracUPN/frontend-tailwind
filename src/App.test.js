import { render, screen } from '@testing-library/react';
import App from './App';

test('muestra la navegacion principal con inventario', () => {
  render(<App />);
  expect(screen.getAllByRole('button', { name: 'Inventario' })).toHaveLength(2);
});
