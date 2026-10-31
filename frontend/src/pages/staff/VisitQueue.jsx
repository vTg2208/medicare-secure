// Staff Visit Queue Page - Epic 3: Visit Management
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { visitApi } from '../../api/visitApi';
import VisitCard from '../../components/visit/VisitCard';
import '../patient/Visits.css';
import './VisitQueue.css';

function VisitQueue() {
    const navigate = useNavigate();
    const [visits, setVisits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('checked-in'); // checked-in, active, completed
    const [successMessage, setSuccessMessage] = useState('');

    useEffect(() => {
        fetchVisits();
        // Poll for updates every 30 seconds
        const interval = setInterval(fetchVisits, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchVisits = async () => {
        setLoading(true);
        try {
            const data = await visitApi.getTodayVisits();
            setVisits(data.visits || []);
        } catch (error) {
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (action, visitId) => {
        try {
            if (action === 'activate') {
                await visitApi.activateVisit(visitId);
                setSuccessMessage('Visit activated successfully!');
            } else if (action === 'close') {
                await visitApi.closeVisit(visitId);
                setSuccessMessage('Visit closed successfully!');
            }

            fetchVisits(); // Refresh visits
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (error) {
            alert(error.response?.data?.message || 'Action failed');
        }
    };

    const filterVisits = () => {
        if (filter === 'checked-in') {
            return visits.filter(v => v.status === 'CHECKED_IN');
        } else if (filter === 'active') {
            return visits.filter(v => v.status === 'ACTIVE');
        } else if (filter === 'completed') {
            return visits.filter(v => v.status === 'COMPLETED');
        }
        return visits;
    };

    const filteredVisits = filterVisits();

    // Calculate stats
    const stats = {
        checkedIn: visits.filter(v => v.status === 'CHECKED_IN').length,
        active: visits.filter(v => v.status === 'ACTIVE').length,
        completed: visits.filter(v => v.status === 'COMPLETED').length,
        total: visits.length,
    };

    return (
        <div className="visits-page">
            <header className="page-header">
                <div className="header-left">
                    <h1>Visit Queue</h1>
                    <p className="page-subtitle">Manage today's patient visits and check-ins</p>
                </div>
                <button
                    className="btn btn-secondary"
                    onClick={() => navigate('/staff/dashboard')}
                >
                    Back to Dashboard
                </button>
            </header>

            <div className="visits-content">
                {successMessage && (
                    <div className="success-alert">
                        {successMessage}
                    </div>
                )}

                {/* Refresh Button */}
                <div className="action-section">
                    <button className="btn btn-primary" onClick={fetchVisits}>
                        Refresh Queue
                    </button>
                </div>

                {/* Stats Overview */}
                <div className="queue-stats">
                    <div className="stat-card-small">
                        <div className="stat-number">{stats.checkedIn}</div>
                        <div className="stat-label">Pending Activation</div>
                    </div>
                    <div className="stat-card-small">
                        <div className="stat-number">{stats.active}</div>
                        <div className="stat-label">Active Visits</div>
                    </div>
                    <div className="stat-card-small">
                        <div className="stat-number">{stats.completed}</div>
                        <div className="stat-label">Completed Today</div>
                    </div>
                    <div className="stat-card-small">
                        <div className="stat-number">{stats.total}</div>
                        <div className="stat-label">Total Visits</div>
                    </div>
                </div>

                {/* Filter Tabs */}
                <div className="filter-tabs">
                    <button
                        className={`filter-tab ${filter === 'checked-in' ? 'active' : ''}`}
                        onClick={() => setFilter('checked-in')}
                    >
                        Pending ({stats.checkedIn})
                    </button>
                    <button
                        className={`filter-tab ${filter === 'active' ? 'active' : ''}`}
                        onClick={() => setFilter('active')}
                    >
                        Active ({stats.active})
                    </button>
                    <button
                        className={`filter-tab ${filter === 'completed' ? 'active' : ''}`}
                        onClick={() => setFilter('completed')}
                    >
                        Completed ({stats.completed})
                    </button>
                </div>

                {/* Visits List */}
                <div className="visits-list">
                    {loading ? (
                        <div className="loading-state">
                            <div className="spinner"></div>
                            <p>Loading visits...</p>
                        </div>
                    ) : filteredVisits.length === 0 ? (
                        <div className="empty-state">
                            <p>No {filter.replace('-', ' ')} visits</p>
                            <p className="empty-hint">
                                {filter === 'checked-in'
                                    ? 'Patients will appear here after checking in'
                                    : `No ${filter} visits at the moment`}
                            </p>
                        </div>
                    ) : (
                        filteredVisits.map(visit => (
                            <VisitCard
                                key={visit.id}
                                visit={visit}
                                userRole="staff"
                                onAction={handleAction}
                                showActions={true}
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

export default VisitQueue;
