import React, { useState, useEffect, useCallback } from 'react';
import Button from '../common/Button';
import './BedAllocation.css';

function BedAllocation({ onAssign, onDischarge, onTransfer }) {
    const [loading, setLoading] = useState(true);
    const [selectedWard, setSelectedWard] = useState('ICU');
    const [beds, setBeds] = useState([]);
    const [selectedBed, setSelectedBed] = useState(null);

    const loadBeds = useCallback(async () => {
        setLoading(true);
        try {
            // TODO: Replace with actual API call
            // const data = await bedApi.getBeds(selectedWard);

            // Mock data
            const mockBeds = Array.from({ length: 12 }, (_, i) => ({
                id: `${selectedWard}-BED-${(i + 1).toString().padStart(3, '0')}`,
                bedNumber: i + 1,
                ward: selectedWard,
                floor: Math.floor(i / 4) + 1,
                status: ['AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'OCCUPIED'][i % 4],
                patient: i % 4 === 1 || i % 4 === 3 ? {
                    name: ['John Doe', 'Jane Smith', 'Robert Williams', 'Emily Brown'][i % 4],
                    id: `P${10000 + i}`,
                    admittedAt: new Date(Date.now() - (i + 1) * 86400000).toISOString(),
                } : null,
            }));

            setBeds(mockBeds);
        } catch (error) {
        } finally {
            setLoading(false);
        }
    }, [selectedWard]);

    useEffect(() => {
        loadBeds();
    }, [loadBeds]);

    const wards = [
        { id: 'ICU', name: 'Intensive Care Unit', icon: '🏥' },
        { id: 'GENERAL', name: 'General Ward', icon: '🛏️' },
        { id: 'PEDIATRICS', name: 'Pediatrics', icon: '👶' },
        { id: 'MATERNITY', name: 'Maternity', icon: '🤱' },
        { id: 'EMERGENCY', name: 'Emergency', icon: '🚑' },
    ];

    const getBedStatusClass = (status) => {
        const statusMap = {
            AVAILABLE: 'bed-available',
            OCCUPIED: 'bed-occupied',
            MAINTENANCE: 'bed-maintenance',
        };
        return statusMap[status] || 'bed-available';
    };

    const getBedStatusLabel = (status) => {
        const labelMap = {
            AVAILABLE: 'Available',
            OCCUPIED: 'Occupied',
            MAINTENANCE: 'Maintenance',
        };
        return labelMap[status] || status;
    };

    const handleBedClick = (bed) => {
        setSelectedBed(bed);
    };

    const handleAssignPatient = () => {
        if (selectedBed && selectedBed.status === 'AVAILABLE') {
            onAssign && onAssign(selectedBed.id);
            setSelectedBed(null);
            loadBeds();
        }
    };

    const handleDischargePatient = () => {
        if (selectedBed && selectedBed.status === 'OCCUPIED') {
            onDischarge && onDischarge(selectedBed.id, selectedBed.patient.id);
            setSelectedBed(null);
            loadBeds();
        }
    };

    const handleTransferPatient = () => {
        if (selectedBed && selectedBed.status === 'OCCUPIED') {
            onTransfer && onTransfer(selectedBed.id, selectedBed.patient.id);
            setSelectedBed(null);
        }
    };

    const getDaysAdmitted = (admittedAt) => {
        const days = Math.floor((Date.now() - new Date(admittedAt)) / 86400000);
        return days === 0 ? 'Today' : `${days} day${days > 1 ? 's' : ''}`;
    };

    const stats = {
        total: beds.length,
        available: beds.filter(b => b.status === 'AVAILABLE').length,
        occupied: beds.filter(b => b.status === 'OCCUPIED').length,
        maintenance: beds.filter(b => b.status === 'MAINTENANCE').length,
    };

    return (
        <div className="bed-allocation-container">
            <div className="bed-allocation-header">
                <div>
                    <h3>Bed Allocation Management</h3>
                    <p className="bed-allocation-subtitle">
                        Manage patient bed assignments and ward occupancy
                    </p>
                </div>

                {/* Stats */}
                <div className="bed-stats">
                    <div className="stat-item stat-total">
                        <span className="stat-value">{stats.total}</span>
                        <span className="stat-label">Total</span>
                    </div>
                    <div className="stat-item stat-available">
                        <span className="stat-value">{stats.available}</span>
                        <span className="stat-label">Available</span>
                    </div>
                    <div className="stat-item stat-occupied">
                        <span className="stat-value">{stats.occupied}</span>
                        <span className="stat-label">Occupied</span>
                    </div>
                    <div className="stat-item stat-maintenance">
                        <span className="stat-value">{stats.maintenance}</span>
                        <span className="stat-label">Maintenance</span>
                    </div>
                </div>
            </div>

            {/* Ward Selection */}
            <div className="ward-selection">
                {wards.map((ward) => (
                    <button
                        key={ward.id}
                        className={`ward-chip ${selectedWard === ward.id ? 'active' : ''}`}
                        onClick={() => setSelectedWard(ward.id)}
                    >
                        <span className="ward-icon">{ward.icon}</span>
                        <span className="ward-name">{ward.name}</span>
                    </button>
                ))}
            </div>

            {/* Bed Grid */}
            <div className="bed-content">
                {loading ? (
                    <div className="loading-state">
                        <div className="spinner"></div>
                        <p>Loading bed information...</p>
                    </div>
                ) : (
                    <>
                        <div className="bed-grid">
                            {beds.map((bed) => (
                                <div
                                    key={bed.id}
                                    className={`bed-card ${getBedStatusClass(bed.status)} ${selectedBed?.id === bed.id ? 'selected' : ''}`}
                                    onClick={() => handleBedClick(bed)}
                                >
                                    <div className="bed-card-header">
                                        <span className="bed-number">Bed {bed.bedNumber}</span>
                                        <span className={`bed-status ${getBedStatusClass(bed.status)}`}>
                                            {getBedStatusLabel(bed.status)}
                                        </span>
                                    </div>

                                    {bed.patient && (
                                        <div className="bed-patient-info">
                                            <h4>{bed.patient.name}</h4>
                                            <p className="patient-id">ID: {bed.patient.id}</p>
                                            <p className="patient-admitted">
                                                Admitted: {getDaysAdmitted(bed.patient.admittedAt)}
                                            </p>
                                        </div>
                                    )}

                                    <div className="bed-meta">
                                        <span>Floor {bed.floor}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Selected Bed Actions */}
                        {selectedBed && (
                            <div className="bed-actions-panel">
                                <div className="panel-header">
                                    <h4>Bed {selectedBed.bedNumber} - {selectedBed.ward}</h4>
                                    <button
                                        className="close-panel"
                                        onClick={() => setSelectedBed(null)}
                                    >
                                        ✕
                                    </button>
                                </div>

                                <div className="panel-content">
                                    {selectedBed.status === 'AVAILABLE' && (
                                        <div className="action-section">
                                            <p className="action-description">
                                                This bed is available for patient assignment
                                            </p>
                                            <Button
                                                variant="primary"
                                                onClick={handleAssignPatient}
                                            >
                                                Assign Patient
                                            </Button>
                                        </div>
                                    )}

                                    {selectedBed.status === 'OCCUPIED' && selectedBed.patient && (
                                        <div className="action-section">
                                            <div className="patient-details">
                                                <h5>Current Patient</h5>
                                                <p><strong>Name:</strong> {selectedBed.patient.name}</p>
                                                <p><strong>Patient ID:</strong> {selectedBed.patient.id}</p>
                                                <p><strong>Admitted:</strong> {getDaysAdmitted(selectedBed.patient.admittedAt)} ago</p>
                                            </div>
                                            <div className="action-buttons">
                                                <Button
                                                    variant="secondary"
                                                    onClick={handleTransferPatient}
                                                >
                                                    Transfer Bed
                                                </Button>
                                                <Button
                                                    variant="primary"
                                                    onClick={handleDischargePatient}
                                                >
                                                    Discharge Patient
                                                </Button>
                                            </div>
                                        </div>
                                    )}

                                    {selectedBed.status === 'MAINTENANCE' && (
                                        <div className="action-section">
                                            <p className="action-description">
                                                This bed is currently under maintenance
                                            </p>
                                            <Button variant="secondary">
                                                Mark as Available
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

export default BedAllocation;
