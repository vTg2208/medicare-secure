import React from 'react';
import { Navigate } from 'react-router-dom';
// Use the recipient-based consent flow for every entry point.
export default function GrantConsent() {
    return <Navigate to="/patient/consent" replace />;
}
