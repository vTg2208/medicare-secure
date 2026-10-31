import React from 'react';
import './Input.css';
function Input({
    label,
    type = 'text',
    name,
    value,
    onChange,
    placeholder,
    error,
    required = false,
    ...rest
}) {
    return (
        <div className="input-group">
            {label && (
                <label htmlFor={name} className="input-label">
                    {label} {required && <span className="required">*</span>}
                </label>
            )}
            <input
                id={name}
                type={type}
                name={name}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                className={`input-field ${error ? 'input-error' : ''}`}
                required={required}
                {...rest}
            />
            {error && <span className="error-message">{error}</span>}
        </div>
    );
}
export default Input;