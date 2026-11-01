import React from 'react';
import {render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import {AuthContext} from '../../context/AuthContext';
import {ThemeProvider} from '../../context/ThemeContext';
import AppRoutes from '../../routes/AppRoutes';
import apiClient from '../../api/client';

test('retention approval exposes safety blockers and does not claim data was deleted',async()=>{
    const user=userEvent.setup();
    vi.spyOn(apiClient,'get').mockImplementation(async path=>({data:{data:path==='/retention/eligibility'?{recordId:'record',eligible:false,reasons:['An active legal hold prevents disposal']}:[]}}));
    render(<MemoryRouter initialEntries={['/compliance/retention']}><ThemeProvider><AuthContext.Provider value={{user:{role:'compliance_officer'},loading:false}}><AppRoutes/></AuthContext.Provider></ThemeProvider></MemoryRouter>);
    await user.type(await screen.findByLabelText('Medical record ID'),'record');
    await user.click(screen.getByRole('button',{name:'Check disposal eligibility'}));
    expect(await screen.findByText('An active legal hold prevents disposal')).toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'Approve disposal'})).not.toBeInTheDocument();
    expect(screen.getByText(/Approval does not delete data/)).toBeInTheDocument();
});
