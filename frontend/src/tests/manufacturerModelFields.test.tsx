import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ManufacturerModelFields from '../components/ManufacturerModelFields';

vi.mock('../services/catalog', () => ({
  getManufacturers: vi.fn(),
  getModels: vi.fn(),
}));

import { getManufacturers, getModels } from '../services/catalog';

const fieldClass = 'field';

// Controlled harness so the cascading fields behave like they do inside a form.
function Harness() {
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  return (
    <ManufacturerModelFields
      idPrefix="test"
      fieldClass={fieldClass}
      manufacturer={manufacturer}
      model={model}
      onManufacturerChange={setManufacturer}
      onModelChange={setModel}
    />
  );
}

describe('ManufacturerModelFields — catalog dropdowns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getManufacturers).mockResolvedValue(['Tesla', 'BMW', 'Toyota']);
    vi.mocked(getModels).mockResolvedValue([]);
  });

  it('loads the manufacturer catalog into the dropdown', async () => {
    render(<Harness />);
    const select = screen.getByLabelText('יצרן');
    // "Tesla" is only present if the catalog loaded (it is not in the static fallback).
    expect(await screen.findByRole('option', { name: 'Tesla' })).toBeInTheDocument();
    expect(select).toBeInTheDocument();
  });

  it('loads models from the backend when a manufacturer is selected', async () => {
    vi.mocked(getModels).mockResolvedValue(['1 Series', 'X1', 'X5']);
    const { container } = render(<Harness />);
    await screen.findByRole('option', { name: 'Tesla' });

    await userEvent.selectOptions(screen.getByLabelText('יצרן'), 'BMW');

    expect(getModels).toHaveBeenCalledWith('BMW');
    // The model datalist is populated with the manufacturer's models.
    await vi.waitFor(() =>
      expect(container.querySelector('datalist option[value="X1"]')).not.toBeNull()
    );
  });

  it('reloads models when the manufacturer changes', async () => {
    render(<Harness />);
    await screen.findByRole('option', { name: 'Tesla' });

    await userEvent.selectOptions(screen.getByLabelText('יצרן'), 'BMW');
    await userEvent.selectOptions(screen.getByLabelText('יצרן'), 'Toyota');

    expect(getModels).toHaveBeenCalledWith('BMW');
    expect(getModels).toHaveBeenCalledWith('Toyota');
  });

  it('lets the user enter a custom manufacturer + model via "אחר"', async () => {
    render(<Harness />);
    await screen.findByRole('option', { name: 'Tesla' });

    await userEvent.selectOptions(screen.getByLabelText('יצרן'), 'אחר');

    // A free-text manufacturer field appears and accepts custom input.
    const customInput = await screen.findByLabelText('יצרן (הזן ידנית)');
    await userEvent.type(customInput, 'Lada');
    expect(customInput).toHaveValue('Lada');

    // The model stays a free-text field that accepts any value.
    const modelInput = screen.getByLabelText('דגם');
    await userEvent.type(modelInput, 'Niva');
    expect(modelInput).toHaveValue('Niva');
  });

  it('keeps working (falls back) when the catalog endpoint fails', async () => {
    vi.mocked(getManufacturers).mockRejectedValueOnce(new Error('500'));
    render(<Harness />);
    // The static fallback list still renders so the form is never blocked.
    expect(await screen.findByRole('option', { name: 'BMW' })).toBeInTheDocument();
  });
});
