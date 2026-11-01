import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import RelatedRecordDetails from '../../components/emr/RelatedRecordDetails';
import '../doctor/PatientRecords.css';

function MedicalRecordsView() {
    const { user } = useAuth();
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filterType, setFilterType] = useState('all');
    const [expandedRecords, setExpandedRecords] = useState(new Set());

    // useEffect(() => {
    //     if (user && user.id) {
    //         fetchMedicalRecords();
    //     }
    // }, [user, filterType]);

    // const fetchMedicalRecords = async () => {
    //     try {
    //         const token = getToken();
    //         const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5004/api';

    //         const response = await axios.get(
    //             `${apiUrl}/emr/patients/${user.id}/medical-records`,
    //             {
    //                 headers: { Authorization: `Bearer ${token}` }
    //             }
    //         );

    //         if (response.data.success) {
    //             const recordsData = response.data.data.records || [];
    //             setRecords(recordsData);
    //         }
    //         setLoading(false);
    //     } catch (err) {
    //         console.error('Failed to fetch medical records:', err);
    //         setError(err.response?.data?.message || 'Failed to load medical records.');
    //         setLoading(false);
    //     }
    // };

    const fetchMedicalRecords = useCallback(async () => {
        try {
            const response = await apiClient.get(`/emr/patients/${user.id}/medical-records`);
            if (response.data.success) {
                const recordsData = response.data.data.records || [];
                setRecords(recordsData);
            }
            setLoading(false);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load medical records.');
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (user && user.id) {
            fetchMedicalRecords();
        }
    }, [user, filterType, fetchMedicalRecords]);


    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatRecordType = (type) => {
        const types = {
            'consultation': 'Consultation',
            'diagnosis': 'Diagnosis',
            'prescription': 'Prescription',
            'lab_result': 'Lab Result',
            'imaging': 'Imaging Report',
            'procedure': 'Procedure',
            'note': 'Clinical Note',
            'other': 'Other'
        };
        return types[type] || type;
    };

    const toggleExpand = (recordId) => {
        setExpandedRecords(prev => {
            const newSet = new Set(prev);
            if (newSet.has(recordId)) {
                newSet.delete(recordId);
            } else {
                newSet.add(recordId);
            }
            return newSet;
        });
    };

    const filteredRecords = filterType === 'all'
        ? records
        : records.filter(r => r.type === filterType);

    return (
        <div className="patient-records-page">
            <header className="page-header">
                <div className="header-left">
                    <h1>My Medical Records</h1>
                    <p className="page-subtitle">
                        View all your medical records from healthcare providers
                    </p>
                </div>
                <div className="header-actions">
                    <select
                        className="filter-select"
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                    >
                        <option value="all">All Records</option>
                        <option value="consultation">Consultations</option>
                        <option value="diagnosis">Diagnoses</option>
                        <option value="prescription">Prescriptions</option>
                        <option value="lab_result">Lab Results</option>
                        <option value="imaging">Imaging</option>
                        <option value="procedure">Procedures</option>
                        <option value="note">Clinical Notes</option>
                    </select>
                </div>
            </header>

            <div className="page-content">
                {loading ? (
                    <div className="loading-state">Loading medical records...</div>
                ) : error ? (
                    <div className="error-message">
                        {error}
                    </div>
                ) : filteredRecords.length === 0 ? (
                    <div className="empty-state">
                        <p>No medical records found.</p>
                        <small>Records created by your healthcare providers will appear here.</small>
                    </div>
                ) : (
                    <div className="records-list">
                        {filteredRecords.map(record => {
                            const isExpanded = expandedRecords.has(record.id);
                            const shouldShowToggle = record.description && record.description.length > 150;

                            return (
                                <div key={record.id} className="record-card">
                                    <div className="record-header">
                                        <div>
                                            <span className="record-type-badge">
                                                {formatRecordType(record.type)}
                                            </span>
                                            <h3>{record.title}</h3>
                                        </div>
                                        <span className="record-date">{formatDate(record.created_at)}</span>
                                    </div>
                                    <div className="record-body">
                                        <div className="record-field">
                                            <strong>Description:</strong>
                                            <p className={isExpanded ? 'expanded' : 'collapsed'}>
                                                {record.description}
                                            </p>
                                            {shouldShowToggle && (
                                                <button
                                                    className="expand-btn"
                                                    onClick={() => toggleExpand(record.id)}
                                                >
                                                    {isExpanded ? 'Show Less' : 'Show More'}
                                                </button>
                                            )}
                                        </div>
                                        {record.created_by_name && (
                                            <div className="record-field">
                                                <strong>Created by:</strong>
                                                <p>{record.created_by_name} ({record.created_by_role})</p>
                                            </div>
                                        )}
                                        <RelatedRecordDetails recordId={record.id} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

export default MedicalRecordsView;
