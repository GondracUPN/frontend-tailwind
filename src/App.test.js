import { act, fireEvent, render, screen } from '@testing-library/react';
import App from './App';

test('muestra la navegacion principal con inventario', () => {
  render(<App />);
  expect(screen.getAllByRole('button', { name: 'Inventario' })).toHaveLength(2);
});


test('libera el desplazamiento al pasar del menú móvil al escritorio', () => {
  const originalMatchMedia = window.matchMedia;
  let compact = true;
  const listeners = new Set();
  window.matchMedia = jest.fn(query => ({
    matches: query.includes('max-width') ? compact : !compact,
    addEventListener: (_, listener) => listeners.add(listener),
    removeEventListener: (_, listener) => listeners.delete(listener),
  }));
  try {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar menu' }));
    expect(document.body).toHaveStyle({ overflow: 'hidden' });
    act(() => { compact = false; listeners.forEach(listener => listener()); });
    expect(document.body.style.overflow).toBe('');
    expect(screen.getByRole('navigation', { name: 'Navegación principal' })).toBeVisible();
  } finally {
    window.matchMedia = originalMatchMedia;
  }
});
