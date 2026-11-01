import React from 'react';
import { fireEvent,render,screen,waitFor } from '@testing-library/react';
import BreachWorkspace from './BreachWorkspace';
import { breachApi } from '../../api/breachApi';
vi.mock('../../api/breachApi',()=>({breachApi:{list:vi.fn(),get:vi.fn(),create:vi.fn(),assess:vi.fn(),record:vi.fn(),status:vi.fn()}}));
beforeEach(()=>{vi.clearAllMocks();breachApi.list.mockResolvedValue({cases:[],hasMore:false});});
test('shows list failures explicitly rather than claiming no breaches',async()=>{
    breachApi.list.mockRejectedValue(new Error('offline'));render(<BreachWorkspace />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('No breach assessments recorded.')).not.toBeInTheDocument();
});
test('an assessment form collects risk decisions and does not send notices',async()=>{
    render(<BreachWorkspace />);await screen.findByText('No breach assessments recorded.');
    fireEvent.click(screen.getByRole('button',{name:'Record potential breach'}));
    expect(screen.getByRole('form',{name:'Record potential breach'})).toBeInTheDocument();
    expect(screen.getByLabelText('HIPAA breach determination')).toHaveValue('pending');
    expect(screen.getByLabelText('Risk to individuals')).toHaveValue('unknown');
    expect(screen.getByLabelText('Awareness / discovery (UTC)')).toBeInTheDocument();
    expect(breachApi.create).not.toHaveBeenCalled();
});
test('a required notification remains visible and blocked resolution errors are recoverable',async()=>{
    const current={id:'case',version:1,status:'Open',assessment:{discoveredAt:'2026-01-01T10:00:00Z',regimes:['gdpr'],facts:'Fixture facts'},obligations:[{regime:'gdpr',audience:'authority',status:'overdue',dueAt:'2026-01-04T10:00:00Z',explanation:'Review required'}],notifications:[],history:[]};
    breachApi.list.mockResolvedValue({cases:[current],hasMore:false});breachApi.get.mockResolvedValue(current);
    breachApi.status.mockRejectedValue({response:{data:{message:'Complete the assessment and required evidence'}}});
    render(<BreachWorkspace />);
    fireEvent.click(await screen.findByRole('button',{name:/Open · GDPR/}));
    expect(await screen.findByText('overdue')).toBeInTheDocument();
    expect(screen.getByText(/does not send a message or submit a regulator report/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Resolve incident'}));
    await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('Complete the assessment and required evidence'));
});
