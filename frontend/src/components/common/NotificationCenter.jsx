import React, { useState, useEffect } from 'react';
import './NotificationCenter.css';

function NotificationCenter() {
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        loadNotifications();
        // In real app, set up WebSocket connection for real-time notifications
        // const ws = new WebSocket('ws://localhost:3001/notifications');
        // ws.onmessage = handleNewNotification;
    }, []);

    const loadNotifications = () => {
        // Mock notifications - replace with actual API call
        const mockNotifications = [
            {
                id: 1,
                type: 'LAB_RESULT',
                title: 'Lab Results Ready',
                message: 'Blood test results for patient John Doe are now available',
                timestamp: new Date(Date.now() - 10 * 60000),
                read: false,
                icon: '🔬',
                link: '/lab/results/123',
            },
            {
                id: 2,
                type: 'VISIT_STATUS',
                title: 'Visit Status Changed',
                message: 'Patient Jane Smith has checked in for visit',
                timestamp: new Date(Date.now() - 30 * 60000),
                read: false,
                icon: '✅',
                link: '/visit/456',
            },
            {
                id: 3,
                type: 'IMAGING_RESULT',
                title: 'Imaging Report Available',
                message: 'X-Ray report for patient Robert Williams is ready',
                timestamp: new Date(Date.now() - 60 * 60000),
                read: true,
                icon: '🏥',
                link: '/imaging/results/789',
            },
            {
                id: 4,
                type: 'ASSIGNMENT',
                title: 'New Visit Assignment',
                message: 'You have been assigned to visit #V-2024-005',
                timestamp: new Date(Date.now() - 120 * 60000),
                read: true,
                icon: '👤',
                link: '/visit/v-2024-005',
            },
        ];

        setNotifications(mockNotifications);
        setUnreadCount(mockNotifications.filter(n => !n.read).length);
    };

    const markAsRead = (notificationId) => {
        setNotifications(prev =>
            prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
    };

    const markAllAsRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCount(0);
    };

    const handleNotificationClick = (notification) => {
        markAsRead(notification.id);
        if (notification.link) {
            // Navigate to the link
            window.location.href = notification.link;
        }
        setIsOpen(false);
    };

    const getTimeAgo = (timestamp) => {
        const seconds = Math.floor((new Date() - timestamp) / 1000);

        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    };

    const getNotificationClass = (type) => {
        const typeMap = {
            LAB_RESULT: 'notification-lab',
            IMAGING_RESULT: 'notification-imaging',
            VISIT_STATUS: 'notification-visit',
            ASSIGNMENT: 'notification-assignment',
            EMERGENCY: 'notification-emergency',
        };
        return typeMap[type] || 'notification-default';
    };

    return (
        <div className="notification-center">
            <button
                className="notification-bell"
                onClick={() => setIsOpen(!isOpen)}
                aria-label="Notifications"
            >
                <span className="bell-icon">🔔</span>
                {unreadCount > 0 && (
                    <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                )}
            </button>

            {isOpen && (
                <>
                    <div className="notification-overlay" onClick={() => setIsOpen(false)} />
                    <div className="notification-panel">
                        <div className="notification-header">
                            <h3>Notifications</h3>
                            {unreadCount > 0 && (
                                <button
                                    className="mark-all-read"
                                    onClick={markAllAsRead}
                                >
                                    Mark all as read
                                </button>
                            )}
                        </div>

                        <div className="notification-list">
                            {notifications.length === 0 ? (
                                <div className="notification-empty">
                                    <span className="empty-icon">🔕</span>
                                    <p>No notifications</p>
                                </div>
                            ) : (
                                notifications.map((notification) => (
                                    <div
                                        key={notification.id}
                                        className={`notification-item ${!notification.read ? 'unread' : ''} ${getNotificationClass(notification.type)}`}
                                        onClick={() => handleNotificationClick(notification)}
                                    >
                                        <div className="notification-icon">
                                            {notification.icon}
                                        </div>
                                        <div className="notification-content">
                                            <h4 className="notification-title">
                                                {notification.title}
                                            </h4>
                                            <p className="notification-message">
                                                {notification.message}
                                            </p>
                                            <span className="notification-time">
                                                {getTimeAgo(notification.timestamp)}
                                            </span>
                                        </div>
                                        {!notification.read && (
                                            <div className="unread-indicator" />
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

export default NotificationCenter;
