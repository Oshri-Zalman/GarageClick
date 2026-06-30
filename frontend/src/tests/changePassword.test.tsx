import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AxiosError } from 'axios';
import Header from '../layouts/Header';

// The change-password dialog calls the auth service; mock it and keep the rest of
// the auth module (e.g. logout) as no-ops so the Header renders standalone.
vi.mock('../services/auth', () => ({
  logout: vi.fn(),
  changePassword: vi.fn(),
}));

import { changePassword } from '../services/auth';

// Builds an AxiosError carrying a backend `detail`, like the real api client.
function axiosError(detail: string, status = 400): AxiosError {
  const err = new AxiosError('request failed');
  err.response = { data: { detail }, status } as AxiosError['response'];
  return err;
}

function renderHeader(role = 'Manager') {
  return render(
    <MemoryRouter>
      <Header userName="אורי" userRole={role} />
    </MemoryRouter>
  );
}

// The change-password entry point now lives inside the header user menu: open
// the menu, then click the "החלפת סיסמה" item.
async function openDialog(role = 'Manager') {
  renderHeader(role);
  await userEvent.click(screen.getByRole('button', { name: 'תפריט משתמש' }));
  await userEvent.click(screen.getByRole('menuitem', { name: 'החלפת סיסמה' }));
  return screen.getByRole('dialog', { name: 'החלפת סיסמה' });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Change password — entry point', () => {
  it.each(['Manager', 'Secretary', 'Mechanic'])(
    'exposes the "החלפת סיסמה" entry point via the user menu for %s',
    async (role) => {
      renderHeader(role);
      // Not a standalone header button — it is inside the user menu.
      expect(screen.queryByRole('button', { name: 'החלפת סיסמה' })).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'תפריט משתמש' }));
      expect(screen.getByRole('menuitem', { name: 'החלפת סיסמה' })).toBeInTheDocument();
    }
  );

  it('does not render the entry point when no user is signed in', () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    );
    expect(screen.queryByRole('button', { name: 'תפריט משתמש' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'החלפת סיסמה' })).not.toBeInTheDocument();
  });

  it('opens the modal when the entry point is clicked', async () => {
    const dialog = await openDialog();
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByLabelText('סיסמה נוכחית')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('סיסמה חדשה')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('אימות סיסמה חדשה')).toBeInTheDocument();
  });

  it('renders masked password fields with a visibly dark text color', async () => {
    const dialog = await openDialog();
    for (const label of ['סיסמה נוכחית', 'סיסמה חדשה', 'אימות סיסמה חדשה']) {
      const input = within(dialog).getByLabelText(label);
      // Stays masked (never plain text)…
      expect(input).toHaveAttribute('type', 'password');
      // …and the typed value/bullets are dark enough to actually see.
      expect(input).toHaveClass('text-gray-900');
    }
  });
});

describe('Change password — show/hide toggles', () => {
  // The toggle button lives in the same container as its input.
  const toggleFor = (input: HTMLElement, name: 'הצג סיסמה' | 'הסתר סיסמה') =>
    within(input.parentElement as HTMLElement).getByRole('button', { name });

  it('renders a persistent show control for each field, visible before typing', async () => {
    const dialog = await openDialog();
    // All three eye buttons are present immediately, with the fields still empty.
    expect(within(dialog).getAllByRole('button', { name: 'הצג סיסמה' })).toHaveLength(3);
  });

  it('renders exactly one show/hide control per field', async () => {
    const dialog = await openDialog();
    for (const label of ['סיסמה נוכחית', 'סיסמה חדשה', 'אימות סיסמה חדשה']) {
      const input = within(dialog).getByLabelText(label);
      const container = input.parentElement as HTMLElement;
      expect(within(container).getAllByRole('button')).toHaveLength(1);
    }
  });

  it('uses plain SVG icons, not emoji', async () => {
    const dialog = await openDialog();
    const text = dialog.textContent ?? '';
    // None of the previous emoji glyphs are rendered anywhere in the dialog…
    expect(text).not.toContain('\u{1F648}'); // 🙈
    expect(text).not.toContain('\u{1F441}'); // 👁
    expect(text).not.toContain('\u{FE0F}'); // emoji variation selector
    // …and each toggle renders an inline <svg> icon instead.
    const toggle = within(dialog).getAllByRole('button', { name: 'הצג סיסמה' })[0];
    expect(toggle.querySelector('svg')).toBeInTheDocument();
  });

  it('toggles only the clicked field from password to text and back', async () => {
    const dialog = await openDialog();
    const current = within(dialog).getByLabelText('סיסמה נוכחית');
    const next = within(dialog).getByLabelText('סיסמה חדשה');
    const confirm = within(dialog).getByLabelText('אימות סיסמה חדשה');

    await userEvent.click(toggleFor(current, 'הצג סיסמה'));

    // Only the current-password field reveals; the others stay masked.
    expect(current).toHaveAttribute('type', 'text');
    expect(next).toHaveAttribute('type', 'password');
    expect(confirm).toHaveAttribute('type', 'password');

    // Clicking again re-masks that same field.
    await userEvent.click(toggleFor(current, 'הסתר סיסמה'));
    expect(current).toHaveAttribute('type', 'password');
  });

  it('does not submit the form when a toggle is clicked', async () => {
    const dialog = await openDialog();
    const current = within(dialog).getByLabelText('סיסמה נוכחית');

    await userEvent.click(toggleFor(current, 'הצג סיסמה'));

    // type="button" → no submit, so the API is never called.
    expect(changePassword).not.toHaveBeenCalled();
  });
});

describe('Change password — validation', () => {
  it('blocks submit and shows required-field messages when empty', async () => {
    const dialog = await openDialog();
    await userEvent.click(within(dialog).getByRole('button', { name: 'עדכן סיסמה' }));

    expect(await within(dialog).findByText('יש להזין את הסיסמה הנוכחית')).toBeInTheDocument();
    expect(within(dialog).getByText('יש להזין סיסמה חדשה')).toBeInTheDocument();
    expect(within(dialog).getByText('יש לאמת את הסיסמה החדשה')).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('enforces the new-password minimum length', async () => {
    const dialog = await openDialog();
    await userEvent.type(within(dialog).getByLabelText('סיסמה נוכחית'), 'oldpass');
    await userEvent.type(within(dialog).getByLabelText('סיסמה חדשה'), '123');
    await userEvent.type(within(dialog).getByLabelText('אימות סיסמה חדשה'), '123');
    await userEvent.click(within(dialog).getByRole('button', { name: 'עדכן סיסמה' }));

    expect(await within(dialog).findByText('הסיסמה חייבת להכיל לפחות 6 תווים')).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('blocks a confirm-password mismatch', async () => {
    const dialog = await openDialog();
    await userEvent.type(within(dialog).getByLabelText('סיסמה נוכחית'), 'oldpass');
    await userEvent.type(within(dialog).getByLabelText('סיסמה חדשה'), 'newpass1');
    await userEvent.type(within(dialog).getByLabelText('אימות סיסמה חדשה'), 'newpass2');
    await userEvent.click(within(dialog).getByRole('button', { name: 'עדכן סיסמה' }));

    expect(await within(dialog).findByText('הסיסמאות אינן תואמות')).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });
});

describe('Change password — submit', () => {
  it('calls the API with the correct payload and shows a success message', async () => {
    vi.mocked(changePassword).mockResolvedValue();
    const dialog = await openDialog();
    await userEvent.type(within(dialog).getByLabelText('סיסמה נוכחית'), 'oldpass');
    await userEvent.type(within(dialog).getByLabelText('סיסמה חדשה'), 'newpass1');
    await userEvent.type(within(dialog).getByLabelText('אימות סיסמה חדשה'), 'newpass1');
    await userEvent.click(within(dialog).getByRole('button', { name: 'עדכן סיסמה' }));

    expect(changePassword).toHaveBeenCalledWith('oldpass', 'newpass1');
    expect(await screen.findByText('הסיסמה עודכנה בהצלחה.')).toBeInTheDocument();
  });

  it('maps an incorrect current password to a Hebrew message', async () => {
    vi.mocked(changePassword).mockRejectedValueOnce(
      axiosError('Current password is incorrect.', 400)
    );
    const dialog = await openDialog();
    await userEvent.type(within(dialog).getByLabelText('סיסמה נוכחית'), 'wrongpass');
    await userEvent.type(within(dialog).getByLabelText('סיסמה חדשה'), 'newpass1');
    await userEvent.type(within(dialog).getByLabelText('אימות סיסמה חדשה'), 'newpass1');
    await userEvent.click(within(dialog).getByRole('button', { name: 'עדכן סיסמה' }));

    expect(await within(dialog).findByText('הסיסמה הנוכחית אינה נכונה.')).toBeInTheDocument();
  });

  it('maps a 401 to a re-login prompt', async () => {
    vi.mocked(changePassword).mockRejectedValueOnce(axiosError('Not authenticated', 401));
    const dialog = await openDialog();
    await userEvent.type(within(dialog).getByLabelText('סיסמה נוכחית'), 'oldpass');
    await userEvent.type(within(dialog).getByLabelText('סיסמה חדשה'), 'newpass1');
    await userEvent.type(within(dialog).getByLabelText('אימות סיסמה חדשה'), 'newpass1');
    await userEvent.click(within(dialog).getByRole('button', { name: 'עדכן סיסמה' }));

    expect(
      await within(dialog).findByText('יש להתחבר מחדש כדי לבצע פעולה זו.')
    ).toBeInTheDocument();
  });

  it('falls back to a safe generic Hebrew message on an unknown error', async () => {
    vi.mocked(changePassword).mockRejectedValueOnce(new Error('boom'));
    const dialog = await openDialog();
    await userEvent.type(within(dialog).getByLabelText('סיסמה נוכחית'), 'oldpass');
    await userEvent.type(within(dialog).getByLabelText('סיסמה חדשה'), 'newpass1');
    await userEvent.type(within(dialog).getByLabelText('אימות סיסמה חדשה'), 'newpass1');
    await userEvent.click(within(dialog).getByRole('button', { name: 'עדכן סיסמה' }));

    expect(
      await within(dialog).findByText('אירעה שגיאה בעת עדכון הסיסמה. נסה שוב.')
    ).toBeInTheDocument();
  });
});
