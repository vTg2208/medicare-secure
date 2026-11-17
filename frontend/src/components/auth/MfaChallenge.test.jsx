import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MfaChallenge from './MfaChallenge';
import { authApi } from '../../api/authApi';
vi.mock('../../api/authApi', () => ({ authApi: { mfaRecover:vi.fn(),mfaStartSetup:vi.fn(),mfaConfirmSetup:vi.fn(),mfaAcknowledgeSetup:vi.fn() } }));

test.each(['recovery','confirmation'])('resumes the same last-code recovery ticket after a lost %s response', async lost => {
    vi.clearAllMocks();
    const ticket='last-code-recovery-ticket'; let authorized=false, seeds=0, confirmations=0, remaining=1;
    authApi.mfaRecover.mockImplementation(async () => {
        if (remaining!==1) throw Error('Recovery code consumed');
        remaining--; authorized=true;
        if(lost==='recovery') throw Error('Response lost after commit');
        return {data:{nextStep:'enroll'}};
    });
    authApi.mfaStartSetup.mockImplementation(async received => {
        expect(received).toBe(ticket); expect(authorized).toBe(true); seeds++;
        return {data:{secret:`SEED${seeds}`,provisioningUri:'otpauth://totp/Fixture?secret=JBSWY3DPEHPK3PXP'}};
    });
    authApi.mfaConfirmSetup.mockImplementation(async () => {
        confirmations++;
        if(lost==='confirmation'&&confirmations===1) throw Error('Response lost after commit');
        return {data:{recoveryCodes:['new-recovery-code']}};
    });
    authApi.mfaAcknowledgeSetup.mockResolvedValue({data:{user:{id:'fixture',role:'patient'}}});
    const done=vi.fn();
    render(<MfaChallenge challenge={{ticket,nextStep:'verify'}} onComplete={done} onCancel={vi.fn()}/>);
    fireEvent.click(screen.getByText('Use a recovery code'));
    fireEvent.change(screen.getByLabelText('Recovery code'),{target:{value:'12345678-12345678-12345678-12345678'}});
    fireEvent.click(screen.getByText('Verify recovery code'));
    if(lost==='confirmation') {
        fireEvent.click(await screen.findByText('Start authenticator setup'));
        fireEvent.change(await screen.findByLabelText('Authenticator code'),{target:{value:'123456'}});
        fireEvent.click(screen.getByText('Confirm authenticator'));
    }
    expect(await screen.findByRole('alert')).toHaveTextContent('Response lost');
    fireEvent.click(screen.getByRole('button',{name:'Resume authenticator setup'}));
    fireEvent.change(await screen.findByLabelText('Authenticator code'),{target:{value:'123456'}});
    fireEvent.click(screen.getByText('Confirm authenticator'));
    fireEvent.click(await screen.findByLabelText('I saved my recovery codes in a safe place'));
    fireEvent.click(screen.getByText('Finish secure sign-in'));
    await waitFor(()=>expect(done).toHaveBeenCalledOnce());
    expect(remaining).toBe(0); expect(authApi.mfaRecover).toHaveBeenCalledOnce();
    expect(authApi.mfaAcknowledgeSetup).toHaveBeenCalledWith(ticket);
    expect(done).toHaveBeenCalledOnce();
});
