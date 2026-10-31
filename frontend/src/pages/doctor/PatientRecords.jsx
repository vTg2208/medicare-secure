import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';
import ThemeToggle from '../../components/common/ThemeToggle';
import './PatientRecords.css';

function PatientRecords() {
    const navigate = useNavigate();
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => { fetchPatients(); }, []);

    const fetchPatients = async () => {
        try {
            const response = await apiClient.get('/consent/doctor/patients');
            setPatients(response.data.data || []);
        } catch (err) {
            setError('Failed to load patient records.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="pr-wrapper">
            {/* Theme Toggle */}
            <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 50 }}>
                <ThemeToggle />
            </div>

            {/* Top Bar */}
            <div className="pr-topbar">
                <div className="pr-topbar-left">
                    <div className="pr-topbar-icon">
                        <span className="material-symbols-outlined" style={{ fontSize: 22 }}>folder_shared</span>
                    </div>
                    <div>
                        <h1 className="pr-topbar-title">Patient Records</h1>
                        <p className="pr-topbar-subtitle">Access and manage patient medical records with consent verification</p>
                    </div>
                </div>
                <div className="pr-topbar-actions">
                    <button className="pr-btn-back" onClick={() => navigate('/doctor/dashboard')}>
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                        </svg>
                        Back to Dashboard
                    </button>
                </div>
            </div>

            {/* Body */}
            <div className="pr-body">
                {loading ? (
                    <div className="pr-loading">
                        <div className="pr-spinner" />
                        <p>Loading patients…</p>
                    </div>
                ) : error ? (
                    <div className="pr-error-banner">{error}</div>
                ) : patients.length === 0 ? (
                    <div className="pr-empty-state pr-glass-card">
                        <svg width="56" height="56" fill="none" stroke="#a5b4fc" strokeWidth="1.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <p>No patients have granted you access yet.</p>
                    </div>
                ) : (
                    <>
                        <h2 className="pr-section-heading">My Patients</h2>
                        <div className="pr-grid">
                            {patients.map(patient => (
                                <div
                                    key={patient.id}
                                    className="pr-patient-card pr-glass-card"
                                    onClick={() => navigate(`/doctor/patients/${patient.id}/records`)}
                                >
                                    <div className="pr-patient-card-header">
                                        <div className="pr-patient-avatar">
                                            {patient.first_name?.[0]}{patient.last_name?.[0]}
                                        </div>
                                        <div>
                                            <p className="pr-patient-name">{patient.first_name} {patient.last_name}</p>
                                            <p className="pr-patient-id">ID: {patient.unique_health_id}</p>
                                        </div>
                                    </div>

                                    <div className="pr-patient-info">
                                        <span>DOB: {new Date(patient.date_of_birth).toLocaleDateString()}</span>
                                        &nbsp;·&nbsp;
                                        <span>Gender: {patient.gender}</span>
                                    </div>

                                    <div className="pr-patient-footer">
                                        <span className="pr-access-badge">{patient.access_level} Access</span>
                                        <button
                                            className="pr-view-btn"
                                            onClick={e => { e.stopPropagation(); navigate(`/doctor/patients/${patient.id}/records`); }}
                                        >
                                            View Records
                                            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                            </svg>
                                        </button>
                                    </div>

                                    {patient.consent_expires_at && (
                                        <p className="pr-expiry">
                                            Expires: {new Date(patient.consent_expires_at).toLocaleString()}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default PatientRecords;
