import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/parts', () => ({ getCompatibleParts: vi.fn() }));

import { getCompatibleParts } from '../services/parts';
import ExistingVehicleTicketForm from '../components/ExistingVehicleTicketForm';
import NewCustomerVehicleTicketForm from '../components/NewCustomerVehicleTicketForm';
import type { CompatiblePart, Mechanic, User, VehicleSearchHit } from '../types';

// A Mechanic keeps the existing-vehicle form minimal: auto-assigned, so only the
// description + parts choice are needed to reach submit.
const MECHANIC: User = {
  id: 5,
  username: 'david',
  full_name: 'דוד',
  email: null,
  role: 'Mechanic',
  is_active: true,
};

const VEHICLE: VehicleSearchHit = {
  vehicle_id: 50,
  license_plate: 'VW-1234',
  manufacturer: 'Volkswagen',
  model: 'Golf',
  year: 2018,
  customer_id: 10,
  customer_name: 'דן',
  customer_phone: '0501234567',
};

const MECHANICS: Mechanic[] = [{ id: 5, name: 'דוד', role: 'Mechanic' }];

const BRAKES: CompatiblePart = {
  id: 1,
  part_name: 'בלמים דיסק קדמי',
  part_code: 'BRK001',
  manufacturer: 'Volkswagen',
  model: 'Golf',
  year_start: 2015,
  quantity_current: 3,
  available: true,
};

const OIL_FILTER: CompatiblePart = {
  id: 2,
  part_name: 'מסנן שמן',
  part_code: 'OIL002',
  manufacturer: 'Volkswagen',
  model: 'Golf',
  year_start: 2010,
  quantity_current: 0,
  available: false,
};

const PARTS = [BRAKES, OIL_FILTER];

function renderExisting() {
  const onSubmit = vi.fn();
  render(
    <ExistingVehicleTicketForm
      user={MECHANIC}
      vehicle={VEHICLE}
      mechanics={MECHANICS}
      submitting={false}
      onSubmit={onSubmit}
    />
  );
  return onSubmit;
}

describe('PartsSelection — compatible parts in the ticket flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCompatibleParts).mockResolvedValue(PARTS);
  });

  it('loads compatible parts for the known vehicle (existing-vehicle flow)', async () => {
    renderExisting();
    expect(getCompatibleParts).toHaveBeenCalledWith('Volkswagen', 'Golf', 2018);
    expect(await screen.findByLabelText('בלמים דיסק קדמי')).toBeInTheDocument();
  });

  it('shows out-of-stock parts but disables their selection', async () => {
    renderExisting();
    const outOfStock = await screen.findByLabelText('מסנן שמן');
    expect(outOfStock).toBeDisabled();
  });

  it('shows the Hebrew out-of-stock message for parts with no stock', async () => {
    renderExisting();
    expect(await screen.findByText('החלק אינו זמין במלאי')).toBeInTheDocument();
  });

  it('allows selecting an available part and reveals a quantity control', async () => {
    renderExisting();
    const brakes = await screen.findByLabelText('בלמים דיסק קדמי');
    await userEvent.click(brakes);
    expect(brakes).toBeChecked();
    expect(screen.getByLabelText('כמות עבור בלמים דיסק קדמי')).toBeInTheDocument();
  });

  it('caps the quantity options at the available stock', async () => {
    renderExisting();
    await userEvent.click(await screen.findByLabelText('בלמים דיסק קדמי'));
    const qty = screen.getByLabelText('כמות עבור בלמים דיסק קדמי');
    const options = within(qty).getAllByRole('option');
    expect(options).toHaveLength(3); // stock is 3 → 1,2,3
    expect(within(qty).queryByRole('option', { name: '4' })).not.toBeInTheDocument();
  });

  it('blocks submit with a Hebrew message when no part and not "אחר" is chosen', async () => {
    const onSubmit = renderExisting();
    await screen.findByLabelText('בלמים דיסק קדמי');
    await userEvent.type(screen.getByLabelText('תיאור התקלה'), 'בדיקה כללית');
    await userEvent.click(screen.getByRole('button', { name: 'פתח כרטיס' }));

    expect(await screen.findByText(/יש לבחור חלף תואם/)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('allows submit with parts: [] when "אחר / ללא חלפים" is chosen', async () => {
    const onSubmit = renderExisting();
    await screen.findByLabelText('בלמים דיסק קדמי');
    await userEvent.type(screen.getByLabelText('תיאור התקלה'), 'בדיקה כללית');
    await userEvent.click(screen.getByLabelText('אחר / ללא חלפים'));
    await userEvent.click(screen.getByRole('button', { name: 'פתח כרטיס' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ vehicle_id: 50, parts: [] })
    );
  });

  it('sends parts: [{ part_id, quantity }] for the selected part', async () => {
    const onSubmit = renderExisting();
    await userEvent.click(await screen.findByLabelText('בלמים דיסק קדמי'));
    await userEvent.selectOptions(screen.getByLabelText('כמות עבור בלמים דיסק קדמי'), '2');
    await userEvent.type(screen.getByLabelText('תיאור התקלה'), 'החלפת בלמים');
    await userEvent.click(screen.getByRole('button', { name: 'פתח כרטיס' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ parts: [{ part_id: 1, quantity: 2 }] })
    );
  });

  it('shows a selected parts summary before submit', async () => {
    renderExisting();
    await userEvent.click(await screen.findByLabelText('בלמים דיסק קדמי'));
    const summary = screen.getByTestId('selected-parts-summary');
    expect(within(summary).getByText(/בלמים דיסק קדמי/)).toBeInTheDocument();
  });

  it('shows a Hebrew error and retries the load when it fails', async () => {
    vi.mocked(getCompatibleParts).mockRejectedValueOnce(new Error('500'));
    renderExisting();

    expect(await screen.findByText(/שגיאה בטעינת החלפים התואמים/)).toBeInTheDocument();

    // Retry now succeeds (default beforeEach mock resolves PARTS).
    await userEvent.click(screen.getByRole('button', { name: 'נסה שוב' }));
    expect(await screen.findByLabelText('בלמים דיסק קדמי')).toBeInTheDocument();
  });

  it('loads compatible parts in the new-vehicle flow once details are entered', async () => {
    render(
      <NewCustomerVehicleTicketForm
        user={MECHANIC}
        licensePlate="ZZ-9999"
        mechanics={MECHANICS}
        submitting={false}
        onSubmit={vi.fn()}
      />
    );

    // No vehicle yet → no fetch.
    expect(getCompatibleParts).not.toHaveBeenCalled();

    await userEvent.selectOptions(screen.getByLabelText('יצרן'), 'BMW');
    await userEvent.type(screen.getByLabelText('דגם'), '320i');
    await userEvent.type(screen.getByLabelText('שנה'), '2020');

    await waitFor(() =>
      expect(getCompatibleParts).toHaveBeenCalledWith('BMW', '320i', 2020)
    );
    expect(await screen.findByLabelText('בלמים דיסק קדמי')).toBeInTheDocument();
  });
});

describe('PartsSelection — reset on vehicle change (new-vehicle flow)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCompatibleParts).mockResolvedValue(PARTS);
  });

  function renderNew() {
    const onSubmit = vi.fn();
    render(
      <NewCustomerVehicleTicketForm
        user={MECHANIC}
        licensePlate="ZZ-9999"
        mechanics={MECHANICS}
        submitting={false}
        onSubmit={onSubmit}
      />
    );
    return onSubmit;
  }

  async function fillVehicle(make = 'BMW', model = '320i', year = '2020') {
    await userEvent.selectOptions(screen.getByLabelText('יצרן'), make);
    await userEvent.type(screen.getByLabelText('דגם'), model);
    await userEvent.type(screen.getByLabelText('שנה'), year);
    // Wait for the first compatible-parts load to resolve.
    await screen.findByLabelText('בלמים דיסק קדמי');
  }

  it('clears the selected part and reloads when the manufacturer changes', async () => {
    renderNew();
    await fillVehicle();

    await userEvent.click(screen.getByLabelText('בלמים דיסק קדמי'));
    expect(screen.getByTestId('selected-parts-summary')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('יצרן'), 'Toyota');

    // The list reloads for the new vehicle, with the previous part no longer chosen.
    const brakes = await screen.findByLabelText('בלמים דיסק קדמי');
    expect(brakes).not.toBeChecked();
    expect(screen.queryByTestId('selected-parts-summary')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(getCompatibleParts).toHaveBeenCalledWith('Toyota', '320i', 2020)
    );
  });

  it('clears the selected part when the model changes', async () => {
    renderNew();
    await fillVehicle();

    await userEvent.click(screen.getByLabelText('בלמים דיסק קדמי'));
    expect(screen.getByTestId('selected-parts-summary')).toBeInTheDocument();

    // Append to the model; the parts selection is dropped immediately.
    await userEvent.type(screen.getByLabelText('דגם'), 'd');
    expect(screen.queryByTestId('selected-parts-summary')).not.toBeInTheDocument();

    const brakes = await screen.findByLabelText('בלמים דיסק קדמי');
    expect(brakes).not.toBeChecked();
    await waitFor(() =>
      expect(getCompatibleParts).toHaveBeenCalledWith('BMW', '320id', 2020)
    );
  });

  it('clears the selected part when the year changes', async () => {
    renderNew();
    await fillVehicle();

    await userEvent.click(screen.getByLabelText('בלמים דיסק קדמי'));
    expect(screen.getByTestId('selected-parts-summary')).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText('שנה'));
    await userEvent.type(screen.getByLabelText('שנה'), '2019');

    const brakes = await screen.findByLabelText('בלמים דיסק קדמי');
    expect(brakes).not.toBeChecked();
    expect(screen.queryByTestId('selected-parts-summary')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(getCompatibleParts).toHaveBeenCalledWith('BMW', '320i', 2019)
    );
  });

  it('clears "אחר / ללא חלפים" when the vehicle details change', async () => {
    renderNew();
    await fillVehicle();

    await userEvent.click(screen.getByLabelText('אחר / ללא חלפים'));
    expect(screen.getByTestId('selected-parts-summary')).toHaveTextContent('ללא חלפים (אחר)');

    await userEvent.selectOptions(screen.getByLabelText('יצרן'), 'Toyota');

    await screen.findByLabelText('בלמים דיסק קדמי');
    expect(screen.getByLabelText('אחר / ללא חלפים')).not.toBeChecked();
    expect(screen.queryByTestId('selected-parts-summary')).not.toBeInTheDocument();
  });

  it('keeps the selected part in the existing-vehicle flow (no reset)', async () => {
    render(
      <ExistingVehicleTicketForm
        user={MECHANIC}
        vehicle={VEHICLE}
        mechanics={MECHANICS}
        submitting={false}
        onSubmit={vi.fn()}
      />
    );

    await userEvent.click(await screen.findByLabelText('בלמים דיסק קדמי'));
    // The existing-vehicle summary is read-only — there is no vehicle field to
    // change — so the selection simply persists.
    expect(screen.getByLabelText('בלמים דיסק קדמי')).toBeChecked();
    expect(screen.getByTestId('selected-parts-summary')).toBeInTheDocument();
    expect(screen.queryByLabelText('יצרן')).not.toBeInTheDocument();
  });
});
