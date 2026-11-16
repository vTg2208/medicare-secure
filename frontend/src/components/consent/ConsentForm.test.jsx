import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConsentForm from './ConsentForm';
import apiClient from '../../api/client';

const roles = ['doctor', 'nurse', 'lab_tech', 'radiologist', 'pharmacist', 'insurance_provider', 'researcher'];
const recipients = roles.map((role, index) => ({ id: `recipient-${index}`, firstName: 'Recipient', lastName: `${index}`, role, organization: 'Local Hospital' }));

test.each(roles)('grants consent to a discovered %s recipient with the chosen scope', async role => {
    const user = userEvent.setup();
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { success: true, data: recipients } });
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { success: true } });
    const onSuccess = vi.fn();
    render(<ConsentForm onSuccess={onSuccess} onCancel={vi.fn()} />);
    const recipient = recipients.find(item => item.role === role);
    await screen.findByRole('option', { name: new RegExp(`${role.replaceAll('_', ' ')} — Local Hospital`) });
    expect(get).toHaveBeenCalledWith('/users/consent-recipients');
    await user.selectOptions(screen.getByLabelText('Grant Access To *'), recipient.id);
    const research = role === 'researcher';
    const insurance = role === 'insurance_provider';
    await user.selectOptions(screen.getByLabelText('Purpose *'), research ? 'clinical_research' : insurance ? 'insurance_claim' : 'treatment');
    await user.selectOptions(screen.getByLabelText('Data Category *'), insurance ? 'insurance_claim' : 'lab_results');
    await user.click(screen.getByRole('button', { name: 'Grant Consent' }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(post).toHaveBeenCalledWith('/consent/grant', expect.objectContaining({ recipientUserId: recipient.id, dataCategory: insurance ? 'insurance_claim' : 'lab_results', purpose: research ? 'clinical_research' : insurance ? 'insurance_claim' : 'treatment', accessLevel: 'read', endTime: null }));
});

test('keeps a failed grant visible and allows the patient to retry', async () => {
    const user = userEvent.setup();
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { data: recipients } });
    const post = vi.spyOn(apiClient, 'post').mockRejectedValueOnce({ response: { data: { message: 'Recipient is no longer eligible' } } }).mockResolvedValueOnce({ data: { success: true } });
    const onSuccess = vi.fn();
    render(<ConsentForm onSuccess={onSuccess} onCancel={vi.fn()} />);
    await screen.findByRole('option', { name: /doctor —/ });
    await user.selectOptions(screen.getByLabelText('Grant Access To *'), recipients[0].id);
    await user.selectOptions(screen.getByLabelText('Duration'), '24-hours');
    await user.click(screen.getByRole('button', { name: 'Grant Consent' }));
    expect(await screen.findByText('Recipient is no longer eligible')).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Duration')).toHaveValue('24-hours');
    await user.click(screen.getByRole('button', { name: 'Grant Consent' }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(post).toHaveBeenCalledTimes(2);
    for (const [, payload] of post.mock.calls) {
        expect(new Date(payload.endTime) - new Date(payload.startTime)).toBe(24 * 60 * 60 * 1000);
    }
});

test.each([['1-hour', 3600], ['24-hours', 86400], ['7-days', 604800]])('grants a finite %s duration with an explicit expiry', async (choice, seconds) => {
    const user = userEvent.setup();
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { data: recipients } });
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { success: true } });
    render(<ConsentForm onSuccess={vi.fn()} onCancel={vi.fn()} />);
    await screen.findByRole('option', { name: /doctor —/ });
    await user.selectOptions(screen.getByLabelText('Grant Access To *'), recipients[0].id);
    expect(screen.getByLabelText('Duration')).toHaveValue('unlimited');
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Duration'), choice);
    expect(screen.getByText(/Access will expire on:/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Grant Consent' }));
    await waitFor(() => expect(post).toHaveBeenCalledOnce());
    const payload = post.mock.calls[0][1];
    expect(new Date(payload.endTime) - new Date(payload.startTime)).toBe(seconds * 1000);
});

test('discloses labeled exact fields and preserves custom values when switching choices', async () => {
    const user = userEvent.setup();
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { data: recipients } });
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { success: true } });
    render(<ConsentForm onSuccess={vi.fn()} onCancel={vi.fn()} />);
    await screen.findByRole('option', { name: /doctor —/ });
    await user.selectOptions(screen.getByLabelText('Grant Access To *'), recipients[0].id);
    await user.selectOptions(screen.getByLabelText('Duration'), 'custom');
    await user.type(screen.getByLabelText('Hours'), '2');
    await user.type(screen.getByLabelText('Minutes'), '15');
    await user.type(screen.getByLabelText('Seconds'), '30');
    await user.selectOptions(screen.getByLabelText('Duration'), '7-days');
    expect(screen.queryByLabelText('Hours')).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Duration'), 'custom');
    expect(screen.getByLabelText('Hours')).toHaveValue(2);
    expect(screen.getByLabelText('Minutes')).toHaveValue(15);
    expect(screen.getByLabelText('Seconds')).toHaveValue(30);
    await user.click(screen.getByRole('button', { name: 'Grant Consent' }));
    await waitFor(() => expect(post).toHaveBeenCalledOnce());
    const payload = post.mock.calls[0][1];
    expect(new Date(payload.endTime) - new Date(payload.startTime)).toBe(8130 * 1000);
});

test('requires a positive custom duration and only grants unlimited when selected', async () => {
    const user = userEvent.setup();
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { data: recipients } });
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { success: true } });
    render(<ConsentForm onSuccess={vi.fn()} onCancel={vi.fn()} />);
    await screen.findByRole('option', { name: /doctor —/ });
    await user.selectOptions(screen.getByLabelText('Grant Access To *'), recipients[0].id);
    await user.selectOptions(screen.getByLabelText('Duration'), 'custom');
    await user.click(screen.getByRole('button', { name: 'Grant Consent' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a custom duration greater than zero, or choose Unlimited.');
    expect(post).not.toHaveBeenCalled();
    await user.selectOptions(screen.getByLabelText('Duration'), 'unlimited');
    await user.click(screen.getByRole('button', { name: 'Grant Consent' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/consent/grant', expect.objectContaining({ endTime: null })));
});

test('allows a finite grant start date to be cleared while the patient chooses another date', async () => {
    const user = userEvent.setup();
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { data: recipients } });
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { success: true } });
    render(<ConsentForm onSuccess={vi.fn()} onCancel={vi.fn()} />);
    await screen.findByRole('option', { name: /doctor —/ });
    await user.selectOptions(screen.getByLabelText('Grant Access To *'), recipients[0].id);
    await user.selectOptions(screen.getByLabelText('Duration'), '1-hour');
    await user.clear(screen.getByLabelText('Start Date *'));
    expect(screen.getByText('Choose a start date to see the expiry.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Grant Consent' }));
    expect(post).not.toHaveBeenCalled();
});

test.each([
    ['2035-06-02T14:15:00.000Z', '24-hours'],
    ['2035-06-01T16:30:30.000Z', 'custom'],
])('preserves an existing finite grant expiry %s when updating its purpose', async (endTime, choice) => {
    const user = userEvent.setup();
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { data: recipients } });
    const put = vi.spyOn(apiClient, 'put').mockResolvedValue({ data: { success: true } });
    const initialData = {
        id: 'consent-1', recipientUserId: recipients[0].id, dataCategory: 'lab_results',
        purpose: 'treatment', accessLevel: 'read', startTime: '2035-06-01T14:15:00.000Z', endTime,
    };
    render(<ConsentForm initialData={initialData} onSuccess={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByLabelText('Duration')).toHaveValue(choice);
    expect(screen.getByLabelText('Grant Access To *')).toBeDisabled();
    if (choice === 'custom') {
        expect(screen.getByLabelText('Hours')).toHaveValue(2);
        expect(screen.getByLabelText('Minutes')).toHaveValue(15);
        expect(screen.getByLabelText('Seconds')).toHaveValue(30);
    }
    await user.selectOptions(screen.getByLabelText('Purpose *'), 'consultation');
    await user.click(screen.getByRole('button', { name: 'Update Consent' }));
    await waitFor(() => expect(put).toHaveBeenCalledWith('/consent/consent-1', {
        ...initialData, id: undefined, purpose: 'consultation',
    }));
});
