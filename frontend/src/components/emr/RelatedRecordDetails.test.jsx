import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RelatedRecordDetails from './RelatedRecordDetails';
import apiClient from '../../api/client';

test('shows persisted diagnoses, prescriptions and downloadable laboratory reports', async () => {
    const user = userEvent.setup();
    const get = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ data: { success: true, data: {
        diagnoses: [{ id: 'dx', icd_code: 'I10', description: 'Hypertension', status: 'chronic', version: 2 }],
        prescriptions: [{ id: 'rx', medication: 'Medication A', dosage: '5mg', frequency: 'once daily', status: 'pending' }],
        labResults: [{ id: 'lab', test_name: 'CBC', interpretation: 'Within reference range', file_url: '/api/files/patient/lab_results/report.pdf', file_name: 'report.pdf' }],
        imagingReports: [{ id: 'image', imaging_type: 'X-Ray', findings: 'No acute findings', impression: 'Normal study' }],
    } } }).mockResolvedValue({ data: new Blob(['report']) });
    URL.createObjectURL = vi.fn(() => 'blob:report');
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<RelatedRecordDetails recordId="record" />);
    await user.click(screen.getByRole('button', { name: 'View clinical details' }));
    expect(await screen.findByText('I10 — Hypertension')).toBeInTheDocument();
    expect(screen.getByText('Medication A')).toBeInTheDocument();
    expect(screen.getByText('Within reference range')).toBeInTheDocument();
    expect(screen.getByText('No acute findings')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Download CBC report' }));
    expect(get).toHaveBeenLastCalledWith('/files/patient/lab_results/report.pdf', { responseType: 'blob' });
    expect(click).toHaveBeenCalledOnce();
});

test('keeps access failures visible and allows another attempt', async () => {
    const user = userEvent.setup();
    vi.spyOn(apiClient, 'get').mockRejectedValueOnce({ response: { data: { message: 'Active patient consent is required' } } })
        .mockResolvedValueOnce({ data: { success: true, data: { diagnoses: [], prescriptions: [], labResults: [], imagingReports: [] } } });
    render(<RelatedRecordDetails recordId="record" />);
    await user.click(screen.getByRole('button', { name: 'View clinical details' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Active patient consent is required');
    await user.click(screen.getByRole('button', { name: 'View clinical details' }));
    expect(await screen.findByText('No linked clinical details.')).toBeInTheDocument();
});
