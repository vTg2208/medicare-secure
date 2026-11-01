import React from 'react';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import AppRoutes from './routes/AppRoutes';
import ErrorBoundary from './components/common/ErrorBoundary';
import './styles/global.css';

function App() {
    return (
        <ErrorBoundary><AuthProvider>
            <ThemeProvider>
                <AppRoutes />
            </ThemeProvider>
        </AuthProvider></ErrorBoundary>
    );
}

export default App;
