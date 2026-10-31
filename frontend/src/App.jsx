import React from 'react';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import AppRoutes from './routes/AppRoutes';
import ErrorBoundary from './components/common/ErrorBoundary';
import DemoNotice from './components/common/DemoNotice';
import { isDemoMode } from './config/demoMode';
import './styles/global.css';

function App() {
    return (
        <ErrorBoundary><AuthProvider>
            <ThemeProvider>
                {isDemoMode ? (
                    <div className="demo-shell">
                        <DemoNotice />
                        <div className="demo-content"><AppRoutes /></div>
                    </div>
                ) : <AppRoutes />}
            </ThemeProvider>
        </AuthProvider></ErrorBoundary>
    );
}

export default App;
