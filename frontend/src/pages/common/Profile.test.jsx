import React from 'react';
import {MemoryRouter} from 'react-router-dom';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import Profile from './Profile';
import {AuthContext} from '../../context/AuthContext';
import {userApi} from '../../api/userApi';
import {ThemeProvider} from '../../context/ThemeContext';
vi.mock('../../api/userApi',()=>({userApi:{getProfile:vi.fn(),updateProfile:vi.fn()}}));
vi.mock('../../components/common/PasskeySetupCard',()=>({default:()=>null}));
test('profile saves use an identity-bound update and never authenticate again',async()=>{
    const user={id:'account-a',firstName:'Fixture',role:'patient'},login=vi.fn(),updateUser=vi.fn();
    userApi.getProfile.mockResolvedValue({success:true,data:{user}});
    userApi.updateProfile.mockResolvedValue({success:true,data:{firstName:'Updated',lastName:'Fixture',phone:'+15550001002'}});
    render(<MemoryRouter><ThemeProvider><AuthContext.Provider value={{user,login,updateUser,logout:vi.fn()}}><Profile/></AuthContext.Provider></ThemeProvider></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button',{name:/Save Changes/}));
    await waitFor(()=>expect(updateUser).toHaveBeenCalledWith({firstName:'Updated',lastName:'Fixture',phone:'+15550001002'},'account-a'));
    expect(login).not.toHaveBeenCalled();
});
