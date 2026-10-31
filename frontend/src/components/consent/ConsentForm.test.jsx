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
    await user.click(screen.getByRole('button', { name: 'Grant Consent' }));
    expect(await screen.findByText('Recipient is no longer eligible')).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Grant Consent' }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(post).toHaveBeenCalledTimes(2);
});
