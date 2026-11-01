import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { ThemeProvider } from '../../context/ThemeContext';
import PrivacyNotice from './PrivacyNotice';
import AppRoutes from '../../routes/AppRoutes';
import { noticeApi } from '../../api/noticeApi';
vi.mock('../../api/noticeApi', () => ({ noticeApi: { current:vi.fn(),version:vi.fn(),acknowledgements:vi.fn(),acknowledge:vi.fn() } }));
const first={id:'version-one',versionNumber:'1',contentHash:'a'.repeat(64),publishedAt:'2026-11-01T10:00:00Z',content:{title:'Patient information notice',operatorName:'Fixture Care',contactEmail:'privacy@example.invalid',sections:{purposes:'Provide authorized care to patients.',rights:'Use the Privacy Center to request a review.'}}};
const ownReceipt={id:'receipt-one',versionId:first.id,contentHash:first.contentHash,acknowledgedAt:'2026-11-02T00:00:00Z',notice:first};
const renderPage=(role=null,route='/privacy-notice',component=<PrivacyNotice />)=>render(<MemoryRouter initialEntries={[route]}><AuthContext.Provider value={{user:role?{id:'patient-one',role}:null,loading:false,logout:vi.fn()}}><ThemeProvider>{component.type===AppRoutes?component:<Routes><Route path="/privacy-notice/:versionId?" element={component}/></Routes>}</ThemeProvider></AuthContext.Provider></MemoryRouter>);
beforeEach(()=>{
    vi.clearAllMocks(); noticeApi.current.mockResolvedValue(first); noticeApi.version.mockResolvedValue(first);
    noticeApi.acknowledgements.mockResolvedValue({currentVersionId:first.id,acknowledgedCurrent:false,receipts:[]}); noticeApi.acknowledge.mockResolvedValue(ownReceipt);
});
test('an unconfigured notice is explicit and no acknowledgement is invented',async()=>{
    noticeApi.current.mockResolvedValue(null); renderPage();
    expect(await screen.findByText(/no privacy notice has been published/i)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument(); expect(noticeApi.acknowledge).not.toHaveBeenCalled();
});
test('anonymous readers see published text safely without creating consent or receipts',async()=>{
    noticeApi.current.mockResolvedValue({...first,content:{...first.content,title:'<img src=x onerror=alert(1)>',sections:{purposes:'<script>private()</script>'}}});renderPage();
    expect(await screen.findByRole('heading',{name:'<img src=x onerror=alert(1)>'})).toBeInTheDocument();
    expect(screen.getByText('<script>private()</script>')).toBeInTheDocument(); expect(document.querySelector('script')).toBeNull();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument(); expect(noticeApi.acknowledge).not.toHaveBeenCalled();
});
test('a patient explicitly acknowledges the displayed version and sees the saved receipt',async()=>{
    const user=userEvent.setup();renderPage('patient');
    const checkbox=await screen.findByRole('checkbox',{name:/I have read this version/i});
    expect(screen.getByRole('button',{name:'Record acknowledgement'})).toBeDisabled();
    await user.click(checkbox); await user.click(screen.getByRole('button',{name:'Record acknowledgement'}));
    expect(await screen.findByText(/acknowledgement recorded/i)).toBeInTheDocument();
    expect(screen.getByText(/does not give anyone permission/i)).toBeInTheDocument();
    expect(screen.getByRole('link',{name:/Read acknowledged notice version 1/i})).toHaveAttribute('href','/privacy-notice/version-one');
    expect(noticeApi.acknowledge).toHaveBeenCalledWith(first.id);
});
test('a pending acknowledgement cannot be submitted twice',async()=>{
    let complete;noticeApi.acknowledge.mockReturnValue(new Promise(resolve=>{complete=resolve;}));const user=userEvent.setup();renderPage('patient');
    await user.click(await screen.findByRole('checkbox'));await user.click(screen.getByRole('button',{name:'Record acknowledgement'}));
    expect(screen.getByRole('button',{name:/Recording/})).toBeDisabled();expect(noticeApi.acknowledge).toHaveBeenCalledTimes(1);
    complete(ownReceipt);expect(await screen.findByText(/acknowledgement recorded/i)).toBeInTheDocument();
});
test('a changed notice requires reading the new version and another explicit action',async()=>{
    noticeApi.acknowledge.mockRejectedValue({response:{status:409,data:{message:'The notice changed'}}});const user=userEvent.setup();renderPage('patient');
    await user.click(await screen.findByRole('checkbox'));await user.click(screen.getByRole('button',{name:'Record acknowledgement'}));
    const reload=await screen.findByRole('button',{name:'Reload current notice'});
    const second={...first,id:'version-two',versionNumber:'2',content:{...first.content,title:'Updated patient notice'}};noticeApi.current.mockResolvedValue(second);
    noticeApi.acknowledgements.mockResolvedValue({currentVersionId:second.id,acknowledgedCurrent:false,receipts:[]});await user.click(reload);
    expect(await screen.findByRole('heading',{name:'Updated patient notice'})).toBeInTheDocument();expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(screen.getByRole('button',{name:'Record acknowledgement'})).toBeDisabled();expect(noticeApi.acknowledge).toHaveBeenCalledTimes(1);
});
test('a historical notice remains readable and cannot be acknowledged as the current notice',async()=>{
    noticeApi.current.mockResolvedValue({...first,id:'version-two',versionNumber:'2'});noticeApi.acknowledgements.mockResolvedValue({currentVersionId:'version-two',acknowledgedCurrent:false,receipts:[ownReceipt]});
    renderPage('patient','/privacy-notice/version-one');expect(await screen.findByText(/earlier notice version/i)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();expect(screen.getByRole('link',{name:'Read current notice'})).toHaveAttribute('href','/privacy-notice');
});
test('a receipt-history failure does not hide the public notice or claim acknowledgement',async()=>{
    noticeApi.acknowledgements.mockRejectedValue(new Error('unavailable'));renderPage('patient');
    expect(await screen.findByRole('heading',{name:'Patient information notice'})).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent(/acknowledgement history/i);expect(screen.queryByText(/acknowledgement recorded/i)).not.toBeInTheDocument();
});
test('the actual public route exposes the notice without authentication',async()=>{
    renderPage(null,'/privacy-notice',<AppRoutes/>);expect(await screen.findByRole('heading',{name:'Patient information notice'})).toBeInTheDocument();
});
