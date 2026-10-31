import React, { useState, useEffect, useCallback } from 'react';
import Button from '../../components/common/Button';
import './Dashboard.css';

function PharmacyDashboard() {
    const [prescriptions, setPrescriptions] = useState([]);
    const [filter, setFilter] = useState('PENDING');
    const [loading, setLoading] = useState(true);

    const loadPrescriptions = useCallback(async () => {
        setLoading(true);
        try {
            // TODO: Replace with actual API call
            // const data = await pharmacyApi.getPrescriptions(filter);

            // Mock data
            const mockData = [
                {
                    id: 1,
                    prescriptionId: 'RX-2024-0001',
                    patientName: 'John Doe',
                    patientId: 'P12345',
                    doctorName: 'Dr. Sarah Johnson',
                    medication: 'Amoxicillin 500mg',
                    dosage: '1 tablet, 3 times daily',
                    quantity: 21,
                    instructions: 'Take with food. Complete the full course.',
                    prescribedDate: '2024-02-04',
                    status: 'PENDING',
                    visitId: 'V-2024-001',
                },
                {
                    id: 2,
                    prescriptionId: 'RX-2024-0002',
                    patientName: 'Jane Smith',
                    patientId: 'P12346',
                    doctorName: 'Dr. Michael Chen',
                    medication: 'Lisinopril 10mg',
                    dosage: '1 tablet once daily',
                    quantity: 30,
                    instructions: 'Take in the morning. Monitor blood pressure.',
                    prescribedDate: '2024-02-05',
                    status: 'PENDING',
                    visitId: 'V-2024-002',
                },
                {
                    id: 3,
                    prescriptionId: 'RX-2024-0003',
                    patientName: 'Robert Williams',
                    patientId: 'P12347',
                    doctorName: 'Dr. Emily Davis',
                    medication: 'Metformin 500mg',
                    dosage: '1 tablet, 2 times daily',
                    quantity: 60,
                    instructions: 'Take with meals.',
                    prescribedDate: '2024-02-03',
                    status: 'DISPENSED',
                    visitId: 'V-2024-003',
                },
            ];

            setPrescriptions(mockData.filter(p => p.status === filter));
        } catch (error) {
        } finally {
            setLoading(false);
        }
    }, [filter]);

    useEffect(() => { loadPrescriptions(); }, [loadPrescriptions]);

    const handleDispense = async (prescriptionId) => {
        try {
            // TODO: Replace with actual API call
            // await pharmacyApi.dispensePrescription(prescriptionId);

            loadPrescriptions();
        } catch (error) {
        }
    };

    const handleViewDetails = (prescription) => {
    };

    const getStatusBadge = (status) => {
        const statusConfig = {
            PENDING: { class: 'status-pending', label: 'Pending' },
            DISPENSED: { class: 'status-dispensed', label: 'Dispensed' },
            CANCELLED: { class: 'status-cancelled', label: 'Cancelled' },
        };
        const config = statusConfig[status] || statusConfig.PENDING;
        return <span className={`status-badge ${config.class}`}>{config.label}</span>;
    };

    return (
        <div className="pharmacy-dashboard">
            <div className="dashboard-header">
                <div className="header-content">
                    <h2>Medication Orders</h2>
                    <p className="header-subtitle">
                        Manage prescription dispensing and medication orders
                    </p>
                </div>
            </div>

            <div className="filter-tabs">
                <button
                    className={`filter-tab ${filter === 'PENDING' ? 'active' : ''}`}
                    onClick={() => setFilter('PENDING')}
                >
                    <span className="tab-icon">⏳</span>
                    Pending Orders
                    <span className="tab-count">{prescriptions.length}</span>
                </button>
                <button
                    className={`filter-tab ${filter === 'DISPENSED' ? 'active' : ''}`}
                    onClick={() => setFilter('DISPENSED')}
                >
                    <span className="tab-icon">✓</span>
                    Dispensed
                </button>
                <button
                    className={`filter-tab ${filter === 'CANCELLED' ? 'active' : ''}`}
                    onClick={() => setFilter('CANCELLED')}
                >
                    <span className="tab-icon">✕</span>
                    Cancelled
                </button>
            </div>

            <div className="prescriptions-container">
                {loading ? (
                    <div className="loading-state">
                        <div className="spinner"></div>
                        <p>Loading prescriptions...</p>
                    </div>
                ) : prescriptions.length === 0 ? (
                    <div className="empty-state">
                        <span className="empty-icon">💊</span>
                        <h3>No {filter.toLowerCase()} prescriptions</h3>
                        <p>There are no prescriptions with this status at the moment.</p>
                    </div>
                ) : (
                    <div className="prescriptions-grid">
                        {prescriptions.map((prescription) => (
                            <div key={prescription.id} className="prescription-card">
                                <div className="card-header">
                                    <div className="prescription-id">
                                        <span className="id-label">Rx ID:</span>
                                        <span className="id-value">{prescription.prescriptionId}</span>
                                    </div>
                                    {getStatusBadge(prescription.status)}
                                </div>

                                <div className="patient-info">
                                    <div className="info-row">
                                        <span className="info-icon">👤</span>
                                        <div>
                                            <p className="patient-name">{prescription.patientName}</p>
                                            <p className="patient-id">ID: {prescription.patientId}</p>
                                        </div>
                                    </div>
                                    <div className="info-row">
                                        <span className="info-icon">👨‍⚕️</span>
                                        <div>
                                            <p className="doctor-name">{prescription.doctorName}</p>
                                            <p className="prescribed-date">
                                                {new Date(prescription.prescribedDate).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="medication-details">
                                    <h4 className="medication-name">
                                        💊 {prescription.medication}
                                    </h4>
                                    <div className="detail-row">
                                        <span className="detail-label">Dosage:</span>
                                        <span className="detail-value">{prescription.dosage}</span>
                                    </div>
                                    <div className="detail-row">
                                        <span className="detail-label">Quantity:</span>
                                        <span className="detail-value">{prescription.quantity} units</span>
                                    </div>
                                    <div className="instructions-box">
                                        <p className="instructions-label">Instructions:</p>
                                        <p className="instructions-text">{prescription.instructions}</p>
                                    </div>
                                </div>

                                <div className="card-actions">
                                    <Button
                                        variant="secondary"
                                        onClick={() => handleViewDetails(prescription)}
                                    >
                                        View Details
                                    </Button>
                                    {prescription.status === 'PENDING' && (
                                        <Button
                                            variant="primary"
                                            onClick={() => handleDispense(prescription.id)}
                                        >
                                            Dispense
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default PharmacyDashboard;
