import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App';
import api from './api';

beforeEach(() => localStorage.setItem('token', 'test-session'));
afterEach(() => localStorage.clear());

test('sin sesión muestra login sin montar las páginas comerciales', () => {
  localStorage.clear();
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
  expect(screen.queryByRole('navigation', { name: 'Navegación principal' })).not.toBeInTheDocument();
});

test('al iniciar sesión procesa programaciones y permite reintentar si fallan', async () => {
  localStorage.clear();
  const post = jest.spyOn(api, 'post').mockImplementation(async (url) => {
    if (url === '/auth/login') return { token: 'session', user: { id: 1, role: 'admin' } };
    throw new Error('Servidor temporalmente no disponible');
  });
  try {
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText('admin'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText('••••••'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron generar los cargos programados');
    expect(post.mock.calls.filter(([url]) => url === '/schedules/process')).toHaveLength(1);
    post.mockResolvedValueOnce({ ok: true, processed: [] });
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar programaciones' }));
    await waitFor(() => expect(screen.queryByText(/No se pudieron generar los cargos programados/)).not.toBeInTheDocument());
    expect(post.mock.calls.filter(([url]) => url === '/schedules/process')).toHaveLength(2);
  } finally { post.mockRestore(); }
});

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
