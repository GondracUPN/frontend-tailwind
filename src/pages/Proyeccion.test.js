import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Proyeccion from './Proyeccion';
import { getAnalyticsSummary } from '../services/analytics';

jest.mock('../services/analytics', () => ({
  getAnalyticsSummary: jest.fn(),
  invalidateAnalyticsCache: jest.fn(),
}));

test('filtra la proyección con el mismo vendedor usado por Análisis', async () => {
  getAnalyticsSummary.mockResolvedValue({ sales: { perMonth: [] }, comprasPeriodo: [] });
  render(<Proyeccion setVista={jest.fn()} />);
  await waitFor(() => expect(getAnalyticsSummary).toHaveBeenCalledWith({}));
  fireEvent.change(screen.getByLabelText('Vendedor'), { target: { value: 'Gonzalo' } });
  await waitFor(() => expect(getAnalyticsSummary).toHaveBeenCalledWith({ vendedor: 'Gonzalo' }));
  fireEvent.change(screen.getByLabelText('Vendedor'), { target: { value: 'Renato' } });
  await waitFor(() => expect(getAnalyticsSummary).toHaveBeenCalledWith({ vendedor: 'Renato' }));
});
