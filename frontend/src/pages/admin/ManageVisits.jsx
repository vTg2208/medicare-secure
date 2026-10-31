import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { visitApi } from '../../api/visitApi'; // Ensure correct import path
import { userApi } from '../../api/userApi'; // Ensure correct import path
import Button from '../../components/common/Button';
import '../patient/Dashboard.css'; // Import the shared dashboard theme
import './ManageVisits.css';

const ManageVisits = () => {
    const navigate = useNavigate();
    const [visits, setVisits] = useState([]);
    const [doctors, setDoctors] = useState([]);
    const [nurses, setNurses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

    // Selection state for each visit
    const [assignments, setAssignments] = useState({});

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [visitsData, doctorsData, nursesData] = await Promise.all([
                visitApi.getHospitalVisits('pending'),
                userApi.getDoctors(),
                userApi.getNurses()
            ]);

            setVisits(visitsData.data || []);
            setDoctors(doctorsData.data || []);
            setNurses(nursesData.data || []);

        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'Failed to load data';
            setError(`Error: ${msg}`);
        } finally {
            setLoading(false);
        }
    };

    const handleAssignmentChange = (visitId, field, value) => {
        setAssignments(prev => ({
            ...prev,
            [visitId]: {
                ...prev[visitId],
                [field]: value
            }
        }));
    };

    const handleAssign = async (visitId) => {
        const assignment = assignments[visitId];
        if (!assignment?.doctorId) {
            alert('Please select a doctor');
            return;
        }

        if (!assignment?.scheduledDate || !assignment?.scheduledTime) {
            alert('Please select date and time for the visit');
            return;
        }

        try {
            // Create scheduled time string
            const scheduledTime = `${assignment.scheduledDate}T${assignment.scheduledTime}:00`;

            // Approve visit with scheduled time in one call
            const result = await visitApi.approveVisit(
                visitId,
                assignment.doctorId,
                assignment.nurseId || null,
                scheduledTime
            );

            // Display OTP prominently
            const otpCode = result.data.otp;
            alert(`Visit approved!\n\nOTP for patient: ${otpCode}\n\nPlease communicate this OTP to the patient for verification.`);

            setSuccessMessage(`Visit approved! OTP: ${otpCode}`);

            // Refresh the list
            fetchData();

            setTimeout(() => setSuccessMessage(null), 10000);
        } catch (err) {
            const errorMsg = err.response?.data?.message || err.message || 'Unknown error';
            alert('Failed to approve visit: ' + errorMsg);
        }
    };

    if (loading) return <div className="loading">Loading visits...</div>;
    if (error) return <div className="error">{error}</div>;

    return (
        <div className="dashboard-container">
            <header className="dashboard-header">
                <div className="header-content">
                    <div className="header-left">
                        <h1>Visit Management</h1>
                        <p className="header-subtitle">Manage patient visits and staff assignments</p>
                    </div>
                    <Button onClick={() => navigate('/admin/dashboard')} variant="secondary">Back to Dashboard</Button>
                </div>
            </header>

            <div className="dashboard-content">
                {successMessage && <div className="success-message">{successMessage}</div>}

                <div className="visits-table-container">
                    {visits.length === 0 ? (
                        <p className="no-visits">No pending visit requests.</p>
                    ) : (
                        <table className="visits-table">
                            <thead>
                                <tr>
                                    <th>Patient</th>
                                    <th>Reason</th>
                                    <th>Symptoms</th>
                                    <th>Date</th>
                                    <th>Time</th>
                                    <th>Assign Doctor</th>
                                    <th>Assign Nurse</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visits.map(visit => (
                                    <tr key={visit.id}>
                                        <td>
                                            <div className="patient-name">{visit.patient_first_name} {visit.patient_last_name}</div>
                                            <div className="patient-email">{visit.patient_email}</div>
                                        </td>
                                        <td>{visit.reason}</td>
                                        <td>{visit.symptoms || '-'}</td>
                                        <td>
                                            <input
                                                type="date"
                                                value={assignments[visit.id]?.scheduledDate || ''}
                                                onChange={(e) => handleAssignmentChange(visit.id, 'scheduledDate', e.target.value)}
                                                className="date-input"
                                                min={new Date().toISOString().split('T')[0]}
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="time"
                                                value={assignments[visit.id]?.scheduledTime || ''}
                                                onChange={(e) => handleAssignmentChange(visit.id, 'scheduledTime', e.target.value)}
                                                className="time-input"
                                            />
                                        </td>
                                        <td>
                                            <select
                                                value={assignments[visit.id]?.doctorId || ''}
                                                onChange={(e) => handleAssignmentChange(visit.id, 'doctorId', e.target.value)}
                                                className="staff-select"
                                            >
                                                <option value="">Select Doctor</option>
                                                {doctors.map(doc => (
                                                    <option key={doc.id} value={doc.id}>
                                                        Dr. {doc.firstName} {doc.lastName}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                        <td>
                                            <select
                                                value={assignments[visit.id]?.nurseId || ''}
                                                onChange={(e) => handleAssignmentChange(visit.id, 'nurseId', e.target.value)}
                                                className="staff-select"
                                            >
                                                <option value="">Select Nurse</option>
                                                {nurses.map(nurse => (
                                                    <option key={nurse.id} value={nurse.id}>
                                                        {nurse.firstName} {nurse.lastName}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                        <td>
                                            <button
                                                className="assign-btn"
                                                onClick={() => handleAssign(visit.id)}
                                            >
                                                Approve & Get OTP
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ManageVisits;
