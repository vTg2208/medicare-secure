import React, { useState, useEffect, useCallback } from 'react';
import Button from '../common/Button';
import './StaffAssignment.css';

function StaffAssignment({ visitId, currentAssignments = [], onAssign, onRemove }) {
    const [availableStaff, setAvailableStaff] = useState([]);
    const [selectedRole, setSelectedRole] = useState('ALL');
    const [loading, setLoading] = useState(true);

    const loadAvailableStaff = useCallback(async () => {
        setLoading(true);
        try {
            // TODO: Replace with actual API call
            // const data = await staffApi.getAvailableStaff(selectedRole);

            // Mock data
            const mockStaff = [
                {
                    id: 1,
                    name: 'Emily Davis',
                    role: 'NURSE',
                    department: 'General',
                    shift: '09:00 - 17:00',
                    onShift: true,
                    assigned: false
                },
                {
                    id: 2,
                    name: 'Michael Chen',
                    role: 'NURSE',
                    department: 'ICU',
                    shift: '07:00 - 15:00',
                    onShift: true,
                    assigned: false
                },
                {
                    id: 3,
                    name: 'Sarah Williams',
                    role: 'LAB_TECHNICIAN',
                    department: 'Laboratory',
                    shift: '08:00 - 16:00',
                    onShift: true,
                    assigned: false
                },
                {
                    id: 4,
                    name: 'James Brown',
                    role: 'RADIOLOGIST',
                    department: 'Radiology',
                    shift: '10:00 - 18:00',
                    onShift: false,
                    assigned: false
                },
                {
                    id: 5,
                    name: 'Lisa Anderson',
                    role: 'PHARMACIST',
                    department: 'Pharmacy',
                    shift: '09:00 - 17:00',
                    onShift: true,
                    assigned: false
                },
                {
                    id: 6,
                    name: 'Robert Taylor',
                    role: 'LAB_TECHNICIAN',
                    department: 'Laboratory',
                    shift: '08:00 - 16:00',
                    onShift: true,
                    assigned: true
                },
            ];

            const filtered = selectedRole === 'ALL'
                ? mockStaff
                : mockStaff.filter(s => s.role === selectedRole);

            setAvailableStaff(filtered);
        } catch (error) {
        } finally {
            setLoading(false);
        }
    }, [selectedRole]);

    useEffect(() => {
        loadAvailableStaff();
    }, [loadAvailableStaff]);

    const handleAssign = (staffId) => {
        onAssign && onAssign(staffId);
        loadAvailableStaff();
    };

    const getRoleBadgeClass = (role) => {
        const roleMap = {
            NURSE: 'role-nurse',
            LAB_TECHNICIAN: 'role-lab',
            RADIOLOGIST: 'role-radiology',
            PHARMACIST: 'role-pharmacy',
        };
        return roleMap[role] || 'role-default';
    };

    const formatRole = (role) => {
        return role.replace('_', ' ').toLowerCase()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    return (
        <div className="staff-assignment-container">
            <div className="assignment-header">
                <h3>Assign Staff to Visit</h3>
                <p className="assignment-subtitle">
                    Select healthcare professionals to assign to this visit
                </p>
            </div>

            {/* Role Filter */}
            <div className="role-filter">
                <button
                    className={`filter-chip ${selectedRole === 'ALL' ? 'active' : ''}`}
                    onClick={() => setSelectedRole('ALL')}
                >
                    All Staff
                </button>
                <button
                    className={`filter-chip ${selectedRole === 'NURSE' ? 'active' : ''}`}
                    onClick={() => setSelectedRole('NURSE')}
                >
                    Nurses
                </button>
                <button
                    className={`filter-chip ${selectedRole === 'LAB_TECHNICIAN' ? 'active' : ''}`}
                    onClick={() => setSelectedRole('LAB_TECHNICIAN')}
                >
                    Lab Techs
                </button>
                <button
                    className={`filter-chip ${selectedRole === 'RADIOLOGIST' ? 'active' : ''}`}
                    onClick={() => setSelectedRole('RADIOLOGIST')}
                >
                    Radiologists
                </button>
                <button
                    className={`filter-chip ${selectedRole === 'PHARMACIST' ? 'active' : ''}`}
                    onClick={() => setSelectedRole('PHARMACIST')}
                >
                    Pharmacists
                </button>
            </div>

            {/* Staff List */}
            <div className="staff-list-container">
                {loading ? (
                    <div className="loading-state">
                        <div className="spinner"></div>
                        <p>Loading available staff...</p>
                    </div>
                ) : availableStaff.length === 0 ? (
                    <div className="empty-state">
                        <span className="empty-icon">👥</span>
                        <h3>No Staff Available</h3>
                        <p>No staff members match the selected criteria.</p>
                    </div>
                ) : (
                    <div className="staff-grid">
                        {availableStaff.map((staff) => (
                            <div
                                key={staff.id}
                                className={`staff-item ${!staff.onShift ? 'off-shift' : ''} ${staff.assigned ? 'assigned' : ''}`}
                            >
                                <div className="staff-item-header">
                                    <div className="staff-avatar-small">
                                        {staff.name.split(' ').map(n => n[0]).join('')}
                                    </div>
                                    <div className="staff-info-main">
                                        <h4>{staff.name}</h4>
                                        <span className={`role-badge ${getRoleBadgeClass(staff.role)}`}>
                                            {formatRole(staff.role)}
                                        </span>
                                    </div>
                                </div>

                                <div className="staff-item-details">
                                    <div className="detail-item">
                                        <span className="detail-label">Department:</span>
                                        <span className="detail-value">{staff.department}</span>
                                    </div>
                                    <div className="detail-item">
                                        <span className="detail-label">Shift:</span>
                                        <span className="detail-value">{staff.shift}</span>
                                    </div>
                                    <div className="detail-item">
                                        <span className="detail-label">Status:</span>
                                        <span className={`status-indicator ${staff.onShift ? 'on-shift' : 'off-shift'}`}>
                                            {staff.onShift ? 'On Shift' : 'Off Shift'}
                                        </span>
                                    </div>
                                </div>

                                <div className="staff-item-actions">
                                    {staff.assigned ? (
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => onRemove && onRemove(staff.id)}
                                        >
                                            Remove
                                        </Button>
                                    ) : (
                                        <Button
                                            variant="primary"
                                            size="sm"
                                            disabled={!staff.onShift}
                                            onClick={() => handleAssign(staff.id)}
                                        >
                                            Assign
                                        </Button>
                                    )}
                                </div>

                                {!staff.onShift && (
                                    <div className="off-shift-warning">
                                        ⚠️ Staff member is currently off shift
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default StaffAssignment;
