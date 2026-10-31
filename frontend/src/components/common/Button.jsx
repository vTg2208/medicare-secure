import React from 'react';
import './Button.css';
function Button({
    children,
    onClick,
    type = 'button',
    variant = 'primary',
    disabled = false,
    loading = false
}) {
    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled || loading}
            className={`btn btn-${variant} ${loading ? 'btn-loading' : ''}`}
        >
            {loading ? 'Loading...' : children}
        </button>
    );
}
export default Button;