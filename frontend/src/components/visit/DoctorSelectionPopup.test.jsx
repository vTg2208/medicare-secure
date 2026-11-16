import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DoctorSelectionPopup from './DoctorSelectionPopup';

const doctors = Array.from({ length: 9 }, (_, index) => ({ id: `doc-${index}`, firstName: `Provider${index}`, lastName: 'Test', specialization: `Specialty ${index}` }));

test('all providers and specialties remain reachable and a selected provider survives collapse and filtering', async () => {
    const user = userEvent.setup();
    const select = vi.fn();
    render(<DoctorSelectionPopup doctors={doctors} onClose={vi.fn()} onSelect={select} />);
    expect(screen.queryByRole('button', { name: /Dr. Provider8 Test/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Show all 9 doctors/ }));
    await user.click(screen.getByRole('button', { name: /Dr. Provider8 Test/ }));
    await user.click(screen.getByRole('button', { name: /Show fewer doctors/ }));
    expect(screen.getByRole('button', { name: /Dr. Provider8 Test/ })).toHaveAttribute('aria-pressed', 'true');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Specialty' }), 'Specialty 0');
    expect(screen.getByRole('button', { name: /Dr. Provider0 Test/ })).toBeInTheDocument();
    expect(screen.getByText(/Selected: Dr. Provider8 Test/)).toBeInTheDocument();
    await user.type(screen.getByRole('searchbox', { name: /Search doctors/ }), 'missing');
    expect(screen.getByText(/No doctors found/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Continue/ }));
    expect(select).toHaveBeenCalledWith(doctors[8]);
});

test('dialog traps keyboard focus, closes on Escape and returns focus to its trigger', async () => {
    const user = userEvent.setup();
    function Example() {
        const [open, setOpen] = React.useState(false);
        return <><button onClick={() => setOpen(true)}>Choose doctor</button>{open && <DoctorSelectionPopup doctors={doctors} onClose={() => setOpen(false)} onSelect={vi.fn()} />}</>;
    }
    render(<Example />);
    const trigger = screen.getByRole('button', { name: 'Choose doctor' });
    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Select Doctor' });
    const close = within(dialog).getByRole('button', { name: 'Close doctor selection' });
    expect(close).toHaveFocus();
    await user.tab({ shift: true });
    expect(within(dialog).getByRole('button', { name: /Show all/ })).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
});
