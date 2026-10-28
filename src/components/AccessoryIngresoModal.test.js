import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import api from '../api';
import AccessoryIngresoModal from './AccessoryIngresoModal';
jest.mock('../api', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
beforeEach(() => { jest.resetAllMocks(); api.get.mockResolvedValue([]); });

test('crea referencia en el mismo ingreso, muestra resumen de varias líneas e importación y reintenta con la misma clave', async () => {
  api.post.mockRejectedValueOnce(new Error('Sin conexión')).mockResolvedValue({ referencia: { id: 1 }, lotes: [{ id: 10 }, { id: 11 }] });
  const saved = jest.fn(), close = jest.fn();
  render(<AccessoryIngresoModal onClose={close} onSaved={saved} />);
  fireEvent.click(screen.getByRole('button', { name: 'Crear referencia' }));
  fireEvent.change(screen.getByLabelText('Categoría'), { target: { value: 'Cable' } });
  fireEvent.change(screen.getByLabelText('Modelo'), { target: { value: 'USB-C 60W' } });
  fireEvent.change(screen.getByLabelText('Comprado por'), { target: { value: 'Gonzalo' } });
  fireEvent.change(screen.getByLabelText('Tipo de ingreso'), { target: { value: 'importada' } });
  fireEvent.change(screen.getByLabelText('Moneda'), { target: { value: 'USD' } });
  fireEvent.change(screen.getByLabelText('Tipo de cambio de compra'), { target: { value: '4' } });
  fireEvent.change(screen.getByLabelText('Logística total (S/)'), { target: { value: '20' } });
  fireEvent.change(screen.getByLabelText('Cantidad línea 1'), { target: { value: '2' } });
  fireEvent.change(screen.getByLabelText('Costo por unidad línea 1'), { target: { value: '10' } });
  fireEvent.click(screen.getByRole('button', { name: 'Agregar línea' }));
  fireEvent.change(screen.getByLabelText('Cantidad línea 2'), { target: { value: '3' } });
  fireEvent.change(screen.getByLabelText('Costo por unidad línea 2'), { target: { value: '15' } });
  expect(screen.getByText('Costo total línea 1: USD 20.00')).toBeVisible();
  expect(screen.getByText('Costo total línea 2: USD 45.00')).toBeVisible();
  expect(screen.getByLabelText('Resumen del ingreso')).toHaveTextContent('Total general: S/ 280.00');
  fireEvent.click(screen.getByRole('button', { name: 'Guardar ingreso' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión');
  fireEvent.click(screen.getByRole('button', { name: 'Guardar ingreso' }));
  await waitFor(() => expect(saved).toHaveBeenCalled());
  expect(api.post.mock.calls[0][1]).toEqual(api.post.mock.calls[1][1]);
  expect(api.post.mock.calls[0][1]).toMatchObject({ referencia: { modelo: 'USB-C 60W', categoria: 'Cable' }, tipoCambioCompra: 4, costoLogistica: 20,
    lineas: [{ cantidad: 2, costoUnitario: 10 }, { cantidad: 3, costoUnitario: 15 }] });
});


test('409 con id ofrece usar la referencia existente y conserva los datos de la compra',async()=>{
 api.post.mockRejectedValueOnce(Object.assign(new Error('Referencia duplicada'),{status:409,data:{id:8}})).mockResolvedValue({lotes:[]});
 api.get.mockImplementation(path=>Promise.resolve(path.endsWith('/8')?{id:8,activo:true,modelo:'Cable existente'}:[]));
 render(<AccessoryIngresoModal onClose={jest.fn()} onSaved={jest.fn()} />);
 fireEvent.click(screen.getByText('Crear referencia'));fireEvent.change(screen.getByLabelText('Categoría'),{target:{value:'Cable'}});fireEvent.change(screen.getByLabelText('Modelo'),{target:{value:'USB-C'}});fireEvent.change(screen.getByLabelText('Comprado por'),{target:{value:'Gonzalo'}});fireEvent.change(screen.getByLabelText('Costo por unidad línea 1'),{target:{value:'10'}});fireEvent.click(screen.getByText('Guardar ingreso'));
 fireEvent.click(await screen.findByText('Usar la referencia existente #8'));await waitFor(()=>expect(screen.getByLabelText('Referencia')).toHaveValue('8'));expect(screen.getByLabelText('Costo por unidad línea 1')).toHaveValue(10);
 fireEvent.click(screen.getByText('Guardar ingreso'));await waitFor(()=>expect(api.post).toHaveBeenCalledTimes(2));expect(api.post.mock.calls[1][1]).toMatchObject({referenciaId:8,comprador:'Gonzalo',lineas:[{cantidad:1,costoUnitario:10}]});expect(api.post.mock.calls[1][1]).not.toHaveProperty('referencia');
});
