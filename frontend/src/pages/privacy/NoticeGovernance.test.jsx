import React from 'react';
import { render,screen,fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { ThemeProvider } from '../../context/ThemeContext';
import NoticeGovernance from './NoticeGovernance';
import { noticeApi } from '../../api/noticeApi';
vi.mock('../../api/noticeApi',()=>({noticeApi:{current:vi.fn(),publications:vi.fn(),publish:vi.fn()}}));
const fields=['Purposes','Processing basis','Data categories','Recipients and providers','Retention and disposal','Transfers','Patient rights','Complaints','Security boundaries'];
const version={id:'published-one',versionNumber:'1',publishedAt:'2026-11-02T00:00:00Z',content:{title:'Reviewed patient notice',operatorName:'Fixture operator',contactEmail:'privacy@example.invalid',sections:{}}};
const mount=()=>render(<MemoryRouter><AuthContext.Provider value={{user:{id:'officer',role:'compliance_officer'},loading:false}}><ThemeProvider><NoticeGovernance/></ThemeProvider></AuthContext.Provider></MemoryRouter>);
const fill=async()=>{
    await screen.findByLabelText('Notice title');
    for(const [label,value] of [['Notice title','Reviewed patient notice'],['Responsible operator','Fixture operator'],['Privacy contact email','privacy@example.invalid'],['Private publication review basis','Reviewed this synthetic publication with the responsible operator.']])fireEvent.change(screen.getByLabelText(label),{target:{value}});
    for(const field of fields)fireEvent.change(screen.getByLabelText(field),{target:{value:`Reviewed synthetic information about ${field.toLowerCase()}.`}});
};
beforeEach(()=>{vi.clearAllMocks();noticeApi.current.mockResolvedValue(null);noticeApi.publications.mockResolvedValue({versions:[],hasMore:false,nextBefore:null});noticeApi.publish.mockResolvedValue(version);});
test('an officer previews and explicitly confirms publication before a version becomes public',async()=>{
    const user=userEvent.setup();mount();await fill();expect(screen.queryByRole('button',{name:'Publish notice'})).not.toBeInTheDocument();
    await user.click(screen.getByRole('button',{name:'Preview notice'}));expect(screen.getByRole('button',{name:'Publish notice'})).toBeDisabled();
    await user.click(screen.getByRole('checkbox',{name:/authorized to publish/i}));await user.click(screen.getByRole('button',{name:'Publish notice'}));
    expect(await screen.findByText(/Notice version 1 published/i)).toBeInTheDocument();
    expect(screen.getByRole('link',{name:'Read published version'})).toHaveAttribute('href','/privacy-notice/published-one');
});
test('editing a preview removes its publication confirmation',async()=>{
    const user=userEvent.setup();mount();await fill();await user.click(screen.getByRole('button',{name:'Preview notice'}));await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button',{name:'Edit notice'}));await user.click(screen.getByRole('button',{name:'Preview notice'}));
    expect(screen.getByRole('checkbox')).not.toBeChecked();expect(screen.getByRole('button',{name:'Publish notice'})).toBeDisabled();expect(noticeApi.publish).not.toHaveBeenCalled();
});
test('a failed publication preserves the preview and never claims success',async()=>{
    noticeApi.publish.mockRejectedValue({response:{data:{message:'Publication could not be audited'}}});const user=userEvent.setup();mount();await fill();
    await user.click(screen.getByRole('button',{name:'Preview notice'}));await user.click(screen.getByRole('checkbox'));await user.click(screen.getByRole('button',{name:'Publish notice'}));
    expect(await screen.findByRole('alert')).toHaveTextContent('Publication could not be audited');expect(screen.queryByText(/Notice version 1 published/i)).not.toBeInTheDocument();
    expect(screen.getByRole('heading',{name:'Reviewed patient notice'})).toBeInTheDocument();
});
test('a history refresh failure cannot turn a committed publication into a false failure',async()=>{
    noticeApi.publications.mockResolvedValueOnce({versions:[],hasMore:false}).mockRejectedValue(new Error('history unavailable'));
    const user=userEvent.setup();mount();await fill();await user.click(screen.getByRole('button',{name:'Preview notice'}));await user.click(screen.getByRole('checkbox'));await user.click(screen.getByRole('button',{name:'Publish notice'}));
    expect(await screen.findByText(/Notice version 1 published/i)).toBeInTheDocument();expect(await screen.findByRole('alert')).toHaveTextContent(/publication history/i);
});
