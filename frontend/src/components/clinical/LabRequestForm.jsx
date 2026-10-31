import React, { useState } from 'react';
import { createLabOrder } from '../../api/emrApi';
import Button from '../common/Button';
import './LabRequestForm.css';

const LAB_TEST_TYPES = [
    { id: 'BLOOD_COUNT', name: 'Complete Blood Count (CBC)', category: 'HEMATOLOGY' },
    { id: 'METABOLIC_PANEL', name: 'Basic Metabolic Panel (BMP)', category: 'CHEMISTRY' },
    { id: 'LIPID_PANEL', name: 'Lipid Panel', category: 'CHEMISTRY' },
    { id: 'URINALYSIS', name: 'Urinalysis', category: 'URINE' },
    { id: 'CULTURE', name: 'Bacterial Culture', category: 'MICROBIOLOGY' },
    { id: 'THYROID', name: 'Thyroid Panel', category: 'CHEMISTRY' }
];

const LabRequestForm = ({ visitId, patientId, onClose, onSuccess }) => {
    const [selectedTest, setSelectedTest] = useState('');
    const [priority, setPriority] = useState('ROUTINE');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const testDetails = LAB_TEST_TYPES.find(t => t.id === selectedTest);

            await createLabOrder({
                visitId,
                testCode: selectedTest,
                testName: testDetails?.name,
                testCategory: testDetails?.category,
                priority: priority.toLowerCase(),
                clinicalIndication: notes,
                notes
            });

            if (onSuccess) onSuccess();
            if (onClose) onClose();
        } catch (err) {
            setError(err.message || 'Failed to create lab request');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="lab-request-form">
            <h3>New Lab Request</h3>

            {error && <div className="error-message">{error}</div>}

            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>Test Type</label>
                    <select
                        value={selectedTest}
                        onChange={(e) => setSelectedTest(e.target.value)}
                        required
                    >
                        <option value="">Select Test...</option>
                        {LAB_TEST_TYPES.map(test => (
                            <option key={test.id} value={test.id}>
                                {test.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="form-group">
                    <label>Priority</label>
                    <div className="radio-group">
                        <label>
                            <input
                                type="radio"
                                value="ROUTINE"
                                checked={priority === 'ROUTINE'}
                                onChange={(e) => setPriority(e.target.value)}
                            /> Routine
                        </label>
                        <label>
                            <input
                                type="radio"
                                value="URGENT"
                                checked={priority === 'URGENT'}
                                onChange={(e) => setPriority(e.target.value)}
                            /> Urgent
                        </label>
                        <label>
                            <input
                                type="radio"
                                value="STAT"
                                checked={priority === 'STAT'}
                                onChange={(e) => setPriority(e.target.value)}
                            /> STAT (Emergency)
                        </label>
                    </div>
                </div>

                <div className="form-group">
                    <label>Clinical Notes</label>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Reason for test, specific instructions..."
                        rows={3}
                    />
                </div>

                <div className="form-actions">
                    <Button type="button" variant="secondary" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={loading || !selectedTest}>
                        {loading ? 'Sending...' : 'Send Request'}
                    </Button>
                </div>
            </form>
        </div>
    );
};

export default LabRequestForm;
