import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';


import { BrowserRouter } from 'react-router-dom';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

// Keep measurement code out of the initial rendering path.
const monitorPerformance = () => {
  import('./utils/performanceMonitoring').then(module => module.startPerformanceMonitoring()).catch(() => {});
};
if (document.readyState === 'complete') setTimeout(monitorPerformance, 0);
else window.addEventListener('load', monitorPerformance, { once: true });

