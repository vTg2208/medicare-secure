import React, { useEffect } from 'react';
import './NotificationToast.css';

function NotificationToast({
    message,
    type = 'info',
    duration = 5000,
    onClose
}) {
    useEffect(() => {
        if (duration > 0) {
            const timer = setTimeout(() => {
                onClose && onClose();
            }, duration);

            return () => clearTimeout(timer);
        }
    }, [duration, onClose]);

    const getToastIcon = () => {
        const icons = {
            info: 'ℹ️',
            success: '✅',
            warning: '⚠️',
            error: '❌',
        };
        return icons[type] || icons.info;
    };

    return (
        <div className={`notification-toast toast-${type}`}>
            <div className="toast-icon">{getToastIcon()}</div>
            <div className="toast-message">{message}</div>
            <button className="toast-close" onClick={onClose}>
                ✕
            </button>
        </div>
    );
}

// Container component to manage multiple toasts
export function NotificationToastContainer({ toasts, removeToast }) {
    return (
        <div className="toast-container">
            {toasts.map((toast) => (
                <NotificationToast
                    key={toast.id}
                    message={toast.message}
                    type={toast.type}
                    duration={toast.duration}
                    onClose={() => removeToast(toast.id)}
                />
            ))}
        </div>
    );
}

export default NotificationToast;
