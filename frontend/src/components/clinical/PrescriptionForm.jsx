import React, { useState } from 'react';
import './PrescriptionForm.css';

function PrescriptionForm({ onAdd, onCancel }) {
    const [prescription, setPrescription] = useState({
        medication: '',
        dosage: '',
        frequency: '',
        duration: '',
        route: 'oral',
        instructions: '',
    });

    const frequencies = [
        'Once daily', 'Twice daily', 'Three times daily', 'Four times daily',
        'Every 4 hours', 'Every 6 hours', 'Every 8 hours', 'Every 12 hours',
        'As needed', 'Before meals', 'After meals', 'At bedtime'
    ];

    const routes = [
        ['oral', 'Oral'], ['intravenous', 'IV'], ['intramuscular', 'IM'],
        ['subcutaneous', 'SC'], ['topical', 'Topical'], ['inhalation', 'Inhalation'], ['other', 'Other'],
    ];

    const handleSubmit = (e) => {
        e.preventDefault();
        if (prescription.medication && prescription.dosage && prescription.frequency) {
            onAdd && onAdd(prescription);
            // Reset form
            setPrescription({
                medication: '',
                dosage: '',
                frequency: '',
                duration: '',
                route: 'oral',
                instructions: '',
            });
        }
    };

    return (
        <div className="prescription-form-container">
            <div className="form-header">
                <h3>Add Prescription</h3>
                <p className="form-subtitle">Enter medication details for this visit</p>
            </div>

            <form className="prescription-form" onSubmit={handleSubmit}>
                <div className="form-section">
                    <div className="form-row">
                        <div className="form-group">
                            <label>Medication Name *</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="e.g., Amoxicillin"
                                value={prescription.medication}
                                onChange={(e) => setPrescription({ ...prescription, medication: e.target.value })}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Dosage *</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="e.g., 500mg"
                                value={prescription.dosage}
                                onChange={(e) => setPrescription({ ...prescription, dosage: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Frequency *</label>
                            <select
                                className="form-select"
                                value={prescription.frequency}
                                onChange={(e) => setPrescription({ ...prescription, frequency: e.target.value })}
                                required
                            >
                                <option value="">Select frequency</option>
                                {frequencies.map(freq => (
                                    <option key={freq} value={freq}>{freq}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Duration</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="e.g., 7 days"
                                value={prescription.duration}
                                onChange={(e) => setPrescription({ ...prescription, duration: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Route of Administration</label>
                        <select
                            className="form-select"
                            value={prescription.route}
                            onChange={(e) => setPrescription({ ...prescription, route: e.target.value })}
                        >
                            {routes.map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Special Instructions</label>
                        <textarea
                            className="textarea-field"
                            rows="3"
                            placeholder="Additional instructions for the patient..."
                            value={prescription.instructions}
                            onChange={(e) => setPrescription({ ...prescription, instructions: e.target.value })}
                        />
                    </div>
                </div>

                <div className="form-actions">
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={onCancel}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="btn btn-primary"
                    >
                        Add Prescription
                    </button>
                </div>
            </form>
        </div>
    );
}

export default PrescriptionForm;
