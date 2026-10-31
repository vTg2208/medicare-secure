import React, { useState } from 'react';
import { createImagingOrder } from '../../api/emrApi';
import Button from '../common/Button';
import './ImagingRequestForm.css';

const IMAGING_TYPES = [
    { id: 'XRAY', name: 'X-Ray', modality: 'CR' },
    { id: 'CT', name: 'CT Scan', modality: 'CT' },
    { id: 'MRI', name: 'MRI', modality: 'MR' },
    { id: 'ULTRASOUND', name: 'Ultrasound', modality: 'US' },
    { id: 'PET', name: 'PET Scan', modality: 'PT' }
];

const BODY_PARTS = [
    'Chest', 'Abdomen', 'Pelvis', 'Head', 'Neck',
    'Spine (Cervical)', 'Spine (Thoracic)', 'Spine (Lumbar)',
    'Left Arm', 'Right Arm', 'Left Leg', 'Right Leg'
];

const ImagingRequestForm = ({ visitId, patientId, onClose, onSuccess }) => {
    const [selectedType, setSelectedType] = useState('');
    const [selectedBodyPart, setSelectedBodyPart] = useState('');
    const [priority, setPriority] = useState('ROUTINE');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const typeDetails = IMAGING_TYPES.find(t => t.id === selectedType);

            await createImagingOrder({
                visitId,
                imagingType: typeDetails?.name,
                bodyPart: selectedBodyPart,
                priority: priority.toLowerCase(),
                clinicalIndication: notes,
                notes,
                contrastUsed: false
            });

            if (onSuccess) onSuccess();
            if (onClose) onClose();
        } catch (err) {
            setError(err.message || 'Failed to create imaging request');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="imaging-request-form">
            <h3>New Imaging Request</h3>

            {error && <div className="error-message">{error}</div>}

            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>Imaging Type</label>
                    <select
                        value={selectedType}
                        onChange={(e) => setSelectedType(e.target.value)}
                        required
                    >
                        <option value="">Select Type...</option>
                        {IMAGING_TYPES.map(type => (
                            <option key={type.id} value={type.id}>
                                {type.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="form-group">
                    <label>Body Part / Region</label>
                    <select
                        value={selectedBodyPart}
                        onChange={(e) => setSelectedBodyPart(e.target.value)}
                        required
                    >
                        <option value="">Select Region...</option>
                        {BODY_PARTS.map(part => (
                            <option key={part} value={part}>
                                {part}
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
                    <label>Clinical Notes / Reasoning</label>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Clinical indications, specific views needed..."
                        rows={3}
                    />
                </div>

                <div className="form-actions">
                    <Button type="button" variant="secondary" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={loading || !selectedType || !selectedBodyPart}>
                        {loading ? 'Sending...' : 'Send Request'}
                    </Button>
                </div>
            </form>
        </div>
    );
};

export default ImagingRequestForm;
