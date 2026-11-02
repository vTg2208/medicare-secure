import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import PrivacyCenter from './PrivacyCenter';
import { privacyApi } from '../../api/privacyApi';
vi.mock('../../api/privacyApi', () => ({ privacyApi: { requests: vi.fn(), review: vi.fn(), submit: vi.fn(), update: vi.fn(), exportData: vi.fn(), controls: vi.fn(), releaseControl: vi.fn(), exportRequest: vi.fn(), confirmReceipt: vi.fn(), linkDisposal: vi.fn() } }));
vi.mock('../../components/common/ThemeToggle', () => ({ default: () => null }));
const renderAs = role => render(<MemoryRouter><AuthContext.Provider value={{ user: { role }, logout: vi.fn() }}><PrivacyCenter /></AuthContext.Provider></MemoryRouter>);
beforeEach(() => { vi.clearAllMocks(); privacyApi.requests.mockResolvedValue([]); privacyApi.review.mockResolvedValue([]); privacyApi.controls.mockResolvedValue([]); });
test('patients can submit a privacy request with their chosen type and details', async () => {
    const user = userEvent.setup(); privacyApi.submit.mockResolvedValue({ id: 'created' });
    renderAs('patient');
    await user.selectOptions(screen.getByLabelText('Request type'), 'rectification');
    await user.type(screen.getByLabelText('What would you like us to review?'), 'Please correct my date of birth.');
    await user.click(screen.getByRole('button', { name: 'Submit request' }));
    await waitFor(() => expect(privacyApi.submit).toHaveBeenCalledWith({ type: 'rectification', details: 'Please correct my date of birth.' }));
    expect(await screen.findByText('Request submitted. Its review date and decision history appear below.')).toHaveAttribute('role', 'status');
});
test('export errors are accessible and the confirmation password is cleared', async () => {
    const user = userEvent.setup(); privacyApi.exportData.mockRejectedValue({ response: { data: { message: 'Current password could not be confirmed' } } });
    renderAs('patient');
    const password = screen.getByLabelText('Current password');
    await user.type(password, 'entered-password');
    await user.click(screen.getByRole('button', { name: 'Download my information' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Current password could not be confirmed');
    expect(password).toHaveValue('');
    expect(privacyApi.exportData).toHaveBeenCalledWith('entered-password');
});
test('a reviewer sees the review queue and cannot export a patient account', async () => {
    renderAs('compliance_officer');
    expect(await screen.findByRole('heading', { name: 'Privacy requests' })).toBeInTheDocument();
    await waitFor(() => expect(privacyApi.review).toHaveBeenCalled());
    expect(screen.queryByLabelText('Current password')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit request' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Manage notice publications' })).toHaveAttribute('href', '/compliance/notices');
});
test('a failed queue load is visible and does not claim an empty queue', async () => {
    privacyApi.requests.mockRejectedValue(new Error('offline'));
    renderAs('patient');
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load privacy requests');
    expect(screen.queryByText('No privacy requests yet.')).not.toBeInTheDocument();
});
test('the officer selects the processing purpose that the server must actually restrict', async () => {
    const user = userEvent.setup();
    privacyApi.review.mockResolvedValue([{id:'request',type:'restriction',status:'in_review',details:'Please restrict secondary research use.',history:[]}]);
    privacyApi.update.mockResolvedValue({});
    renderAs('compliance_officer');
    await user.selectOptions(await screen.findByLabelText('Processing purpose'),'research');
    await user.type(screen.getByLabelText('Resolution and actions actually taken'),'Research processing will now be blocked.');
    await user.type(screen.getByLabelText('Decision or retention basis'),'Reviewed the patient restriction request.');
    await user.click(screen.getByRole('button',{name:'Save review'}));
    await waitFor(()=>expect(privacyApi.update).toHaveBeenCalledWith('request',expect.objectContaining({action:{type:'restrict',purpose:'research'}})));
});
test('patients can withdraw their own processing restriction without granting consent', async () => {
    const user = userEvent.setup();
    privacyApi.controls.mockResolvedValue([{id:'control',purpose:'research'}]);
    privacyApi.releaseControl.mockResolvedValue({});
    renderAs('patient');
    await user.click(await screen.findByRole('button',{name:'Release research restriction'}));
    await waitFor(()=>expect(privacyApi.releaseControl).toHaveBeenCalledWith('control'));
});

const evidenceRequest = (overrides={}) => ({id:'request',type:'access',status:'in_review',details:'Please provide my supported structured information.',history:[],evidence:{exports:[],disposals:[]},...overrides});
const receipt = {id:'receipt',requestId:'request',contentHash:'a'.repeat(64),byteLength:120,schemaVersion:1,preparedAt:'2026-11-02T01:00:00Z',confirmedAt:null,scope:'Structured copy only',exclusions:['Attachments remain separate authenticated downloads.']};
test('request copy preparation never confirms receipt until the patient explicitly acts', async()=>{
    const user=userEvent.setup();const onClick=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});
    URL.createObjectURL=vi.fn(()=> 'blob:synthetic');URL.revokeObjectURL=vi.fn();
    privacyApi.requests.mockResolvedValue([evidenceRequest()]);
    privacyApi.exportRequest.mockImplementation(async()=>{privacyApi.requests.mockResolvedValue([evidenceRequest({evidence:{exports:[receipt],disposals:[]}})]);return {data:{patientId:'owned',name:'Zoë 医療'},receipt};});
    privacyApi.confirmReceipt.mockImplementation(async()=>{privacyApi.requests.mockResolvedValue([evidenceRequest({evidence:{exports:[{...receipt,confirmedAt:'2026-11-02T01:01:00Z'}],disposals:[]}})]);return {...receipt,confirmedAt:'2026-11-02T01:01:00Z'};});
    renderAs('patient');
    const password=await screen.findByLabelText('Current password for this request');
    await user.type(password,'entered-password');await user.click(screen.getByRole('button',{name:'Download a copy for this request'}));
    expect(await screen.findByText('Copy prepared; receipt not confirmed')).toBeInTheDocument();
    const savedBlob=URL.createObjectURL.mock.calls[0][0];
    const savedText=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsText(savedBlob);});
    expect(savedText).toBe('{\n  "patientId": "owned",\n  "name": "Zoë 医療"\n}');
    expect(password).toHaveValue('');expect(privacyApi.confirmReceipt).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button',{name:'I received this copy'}));
    expect(await screen.findByText(/Receipt confirmed by you/)).toBeInTheDocument();
    expect(privacyApi.confirmReceipt).toHaveBeenCalledWith('request','receipt',receipt.contentHash);
    onClick.mockRestore();
});
test('an owned prepared receipt can be confirmed after refresh and failed confirmation remains retryable',async()=>{
    const user=userEvent.setup();privacyApi.requests.mockResolvedValue([evidenceRequest({evidence:{exports:[receipt],disposals:[]}})]);
    privacyApi.confirmReceipt.mockRejectedValue({response:{data:{message:'Request closed during confirmation'}}});renderAs('patient');
    await user.click(await screen.findByRole('button',{name:'I received this copy'}));
    expect(await screen.findByRole('alert')).toHaveTextContent('Request closed during confirmation');
    expect(screen.getByRole('button',{name:'I received this copy'})).toBeEnabled();
});
test('officer completion selects only confirmed evidence and sends its case-bound identifier',async()=>{
    const user=userEvent.setup();privacyApi.review.mockResolvedValue([evidenceRequest({evidence:{exports:[receipt,{...receipt,id:'confirmed',confirmedAt:'2026-11-02T01:01:00Z'}],disposals:[]}})]);
    privacyApi.update.mockResolvedValue({});renderAs('compliance_officer');
    const selection=await screen.findByLabelText('Confirmed export receipt');
    expect(Array.from(selection.options).some(option=>option.value==='receipt')).toBe(false);
    await user.selectOptions(selection,'confirmed');
    await user.type(screen.getByLabelText('Resolution and actions actually taken'),'The patient confirmed receipt of the requested structured copy.');
    await user.type(screen.getByLabelText('Decision or retention basis'),'Reviewed the requested scope and exclusions.');
    await user.click(screen.getByRole('button',{name:'Save review'}));
    await waitFor(()=>expect(privacyApi.update).toHaveBeenCalledWith('request',expect.objectContaining({action:{type:'export_receipt',receiptId:'confirmed'}})));
});
test('partial erasure selects completed resources and cannot select pending cleanup',async()=>{
    const user=userEvent.setup();privacyApi.review.mockResolvedValue([evidenceRequest({type:'erasure',evidence:{exports:[],disposals:[{id:'link',disposalId:'done',resourceType:'care_message',status:'completed',executedAt:'2026-11-02T01:01:00Z',pendingAttachments:0},{id:'pending',disposalId:'pending',resourceType:'medical_record',status:'database_disposed',pendingAttachments:1}]}})]);
    privacyApi.update.mockResolvedValue({});renderAs('compliance_officer');
    await user.selectOptions(await screen.findByLabelText('Next review status'),'partially_fulfilled');
    expect(screen.queryByRole('checkbox',{name:'Use completed disposal pending'})).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox',{name:'Use completed disposal done'}));
    await user.type(screen.getByLabelText('Resolution and actions actually taken'),'Only correspondence was disposed; clinical records remain.');
    await user.type(screen.getByLabelText('Decision or retention basis'),'Reviewed completed disposal evidence and retained scope.');
    await user.click(screen.getByRole('button',{name:'Save review'}));
    await waitFor(()=>expect(privacyApi.update).toHaveBeenCalledWith('request',expect.objectContaining({action:{type:'disposal_evidence',disposalIds:['done']}})));
});
test('old terminal decisions are shown without fabricated receipt evidence',async()=>{
    privacyApi.requests.mockResolvedValue([evidenceRequest({status:'fulfilled',outcome:{resolution:'Prior recorded decision.',retentionBasis:'Historical review.'}})]);
    renderAs('patient');expect(await screen.findByText('This historical decision has no linked fulfillment evidence.')).toBeInTheDocument();
});
test('the officer links reviewed disposal scope and sees a retryable API error without executing deletion',async()=>{
    const user=userEvent.setup();privacyApi.review.mockResolvedValue([evidenceRequest({type:'erasure'})]);
    privacyApi.linkDisposal.mockRejectedValue({response:{data:{message:'Patient disposal decision not found'}}});renderAs('compliance_officer');
    await user.type(await screen.findByLabelText('Disposal decision ID'),'11111111-1111-1111-1111-111111111111');
    await user.type(screen.getByLabelText('Scope addressed by this disposal'),'Only the reviewed correspondence is in scope.');
    await user.click(screen.getByRole('button',{name:'Link disposal evidence'}));
    expect(await screen.findByRole('alert')).toHaveTextContent('Patient disposal decision not found');
    expect(screen.getByRole('button',{name:'Link disposal evidence'})).toBeEnabled();
    expect(screen.queryByRole('button',{name:/execute|delete/i})).not.toBeInTheDocument();
});
test('a closed case identifies the confirmed copy used in its decision',async()=>{
    privacyApi.requests.mockResolvedValue([evidenceRequest({status:'fulfilled',outcome:{resolution:'Supported copy supplied.',retentionBasis:'Reviewed scope.',appliedAction:{type:'export_receipt',receipt:{...receipt,confirmedAt:'2026-11-02T01:01:00Z'},scope:'Structured copy only.'}}})]);
    renderAs('patient');expect(await screen.findByText('Evidence used for this decision')).toBeInTheDocument();
    expect(screen.getByText('Confirmed copy: receipt')).toBeInTheDocument();expect(screen.queryByText(/undefined/)).not.toBeInTheDocument();
});
