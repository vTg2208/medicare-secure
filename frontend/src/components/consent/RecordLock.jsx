import React, { useState } from 'react';
import Button from '../common/Button';
import Input from '../common/Input';
import './RecordLock.css';

function RecordLock({ recordId, isLocked, onLockChange }) {
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLock = () => {
        setShowConfirmation(true);
    };

    const handleConfirmLock = async () => {
        if (!password) {
            alert('Password confirmation required');
            return;
        }

        setLoading(true);
        try {
            // TODO: API call to lock record
            // await consentApi.lockRecord(recordId, password);
            if (onLockChange) onLockChange(true);
            setShowConfirmation(false);
            setPassword('');
        } catch (error) {
            alert('Failed to lock record');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div className="record-lock-container">
                <div className="lock-info">
                    <span className="lock-icon">{isLocked ? '🔒' : '🔓'}</span>
                    <div>
                        <h4 className="lock-title">
                            {isLocked ? 'Record Permanently Locked' : 'Lock Sensitive Record'}
                        </h4>
                        <p className="lock-description">
                            {isLocked
                                ? 'Only emergency access can view this record'
                                : 'Permanently restrict access to emergency-only'}
                        </p>
                    </div>
                </div>

                {!isLocked && (
                    <Button onClick={handleLock} variant="secondary">
                        🔒 Lock Record
                    </Button>
                )}

                {isLocked && (
                    <div className="locked-badge">
                        <span>Emergency Access Only</span>
                    </div>
                )}
            </div>

            {/* Confirmation Modal */}
            {showConfirmation && (
                <div className="modal-overlay" onClick={() => setShowConfirmation(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>🔒 Permanently Lock Record</h3>
                            <button className="modal-close" onClick={() => setShowConfirmation(false)}>✕</button>
                        </div>

                        <div className="modal-body">
                            <div className="warning-notice">
                                <span className="warning-icon">⚠️</span>
                                <div>
                                    <strong>Permanent Action</strong>
                                    <p>This action cannot be undone. The record will only be accessible via emergency access with justification.</p>
                                </div>
                            </div>

                            <Input
                                label="Confirm with Password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your password"
                                required
                            />
                        </div>

                        <div className="modal-footer">
                            <Button variant="secondary" onClick={() => setShowConfirmation(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleConfirmLock} loading={loading}>
                                Confirm Lock
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default RecordLock;
