import { fireEvent, render, screen } from '@testing-library/react';
import ProductToolbar from './ProductToolbar';

const handlers = () => ({
  onRecojo: jest.fn(), onAdelantar: jest.fn(), onMensajeVenta: jest.fn(), onPersonal: jest.fn(),
  onAnalisis: jest.fn(), onFotos: jest.fn(), onScanner: jest.fn(), onMarcaAgua: jest.fn(), onDec: jest.fn(), onFacu: jest.fn(),
});

test('muestra todas las herramientas sin desplegar menús', () => {
  const h = handlers();
  render(<ProductToolbar {...h} sellerAssign={{ count: 3, onClick: jest.fn() }} />);
  [
    /Registrar recojo/, /Adelantar venta/, /Mensaje de venta/, /Paquetes personales/, /Fotos Eshopex/,
    /Escanear SN/, /Marca de agua/, /^DEC$/, /^FACU$/, /Análisis/, /Asignar vendedor \(3\)/,
  ].forEach((name) => expect(screen.getByRole('button', { name })).toBeInTheDocument());
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});

test('cada botón ejecuta su acción', () => {
  const h = handlers();
  render(<ProductToolbar {...h} />);
  fireEvent.click(screen.getByRole('button', { name: /Registrar recojo/ }));
  fireEvent.click(screen.getByRole('button', { name: /^DEC$/ }));
  expect(h.onRecojo).toHaveBeenCalled();
  expect(h.onDec).toHaveBeenCalled();
});
