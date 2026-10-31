import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
function ProtectedRoute({ children, allowedRoles }) {
    const { user, loading, authError } = useContext(AuthContext);
    if (loading) {
        return <div role="status">Loading...</div>;
    }
    if (authError) return <div role="alert" className="p-8 text-center">{authError} <button onClick={() => window.location.reload()}>Retry</button></div>;
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    // Handle both 'role' and 'roleName' (normalize to lowercase)
    const userRole = (user.role || user.roleName)?.toLowerCase();

    if (allowedRoles && !allowedRoles.includes(userRole)) {
        return <Navigate to="/unauthorized" replace />;
    }
    return children;
}
export default ProtectedRoute;