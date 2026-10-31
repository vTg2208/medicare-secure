import React, { useState } from 'react';
import Button from '../common/Button';
import './LabRequest.css';

function LabRequest({ visitId, patientId, onSuccess, onCancel }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [selectedTests, setSelectedTests] = useState([]);
    const [formData, setFormData] = useState({
        priority: 'ROUTINE',
        specialInstructions: '',
    });

    const availableTests = [
        {
            category: 'Blood Tests',
            tests: [
                { id: 'CBC', name: 'Complete Blood Count (CBC)' },
                { id: 'BMP', name: 'Basic Metabolic Panel (BMP)' },
                { id: 'CMP', name: 'Comprehensive Metabolic Panel (CMP)' },
                { id: 'LIPID', name: 'Lipid Panel' },
                { id: 'HBA1C', name: 'Hemoglobin A1C' },
                { id: 'THYROID', name: 'Thyroid Function Tests' },
            ],
        },
        {
            category: 'Urine Tests',
            tests: [
                { id: 'UA', name: 'Urinalysis' },
                { id: 'URINE_CULTURE', name: 'Urine Culture' },
            ],
        },
        {
            category: 'Specialty Tests',
            tests: [
                { id: 'LIVER', name: 'Liver Function Tests' },
                { id: 'KIDNEY', name: 'Kidney Function Tests' },
                { id: 'COAGULATION', name: 'Coagulation Panel' },
                { id: 'BILIRUBIN', name: 'Bilirubin Test' },
            ],
        },
    ];

    const handleTestToggle = (testId) => {
        setSelectedTests(prev =>
            prev.includes(testId)
                ? prev.filter(id => id !== testId)
                : [...prev, testId]
        );
        setError('');
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value,
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (selectedTests.length === 0) {
            setError('Please select at least one test');
            return;
        }

        setLoading(true);

        try {
            // TODO: Replace with actual API call
            // await labApi.createLabRequest({
            //     visitId,
            //     patientId,
            //     tests: selectedTests,
            //     ...formData
            // });

            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1500));
            onSuccess && onSuccess();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create lab request');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="lab-request-container">
            <div className="lab-request-header">
                <h3>Request Laboratory Tests</h3>
                <p className="lab-request-subtitle">
                    Select laboratory tests to order for this patient
                </p>
            </div>

            <form onSubmit={handleSubmit} className="lab-request-form">
                {/* Test Selection */}
                <div className="test-selection-section">
                    {availableTests.map((category) => (
                        <div key={category.category} className="test-category">
                            <h4 className="category-title">{category.category}</h4>
                            <div className="test-grid">
                                {category.tests.map((test) => (
                                    <div
                                        key={test.id}
                                        className={`test-card ${selectedTests.includes(test.id) ? 'selected' : ''}`}
                                        onClick={() => handleTestToggle(test.id)}
                                    >
                                        <div className="test-checkbox">
                                            {selectedTests.includes(test.id) ? '✓' : ''}
                                        </div>
                                        <div className="test-name">{test.name}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Priority Selection */}
                <div className="form-section">
                    <h4 className="section-title">Priority Level</h4>
                    <div className="priority-options">
                        <label className={`priority-option ${formData.priority === 'ROUTINE' ? 'selected' : ''}`}>
                            <input
                                type="radio"
                                name="priority"
                                value="ROUTINE"
                                checked={formData.priority === 'ROUTINE'}
                                onChange={handleChange}
                            />
                            <div className="option-content">
                                <span className="option-icon">📅</span>
                                <div>
                                    <div className="option-label">Routine</div>
                                    <div className="option-description">Results in 24-48 hours</div>
                                </div>
                            </div>
                        </label>

                        <label className={`priority-option ${formData.priority === 'URGENT' ? 'selected' : ''}`}>
                            <input
                                type="radio"
                                name="priority"
                                value="URGENT"
                                checked={formData.priority === 'URGENT'}
                                onChange={handleChange}
                            />
                            <div className="option-content">
                                <span className="option-icon">⚡</span>
                                <div>
                                    <div className="option-label">Urgent</div>
                                    <div className="option-description">Results in 4-6 hours</div>
                                </div>
                            </div>
                        </label>

                        <label className={`priority-option ${formData.priority === 'STAT' ? 'selected' : ''}`}>
                            <input
                                type="radio"
                                name="priority"
                                value="STAT"
                                checked={formData.priority === 'STAT'}
                                onChange={handleChange}
                            />
                            <div className="option-content">
                                <span className="option-icon">🚨</span>
                                <div>
                                    <div className="option-label">STAT</div>
                                    <div className="option-description">Immediate - Results in 1 hour</div>
                                </div>
                            </div>
                        </label>
                    </div>
                </div>

                {/* Special Instructions */}
                <div className="form-section">
                    <h4 className="section-title">Special Instructions</h4>
                    <textarea
                        name="specialInstructions"
                        value={formData.specialInstructions}
                        onChange={handleChange}
                        placeholder="Enter any special instructions for the lab..."
                        className="instructions-textarea"
                        rows="3"
                    />
                </div>

                {/* Selected Tests Summary */}
                {selectedTests.length > 0 && (
                    <div className="selected-summary">
                        <h4>Selected Tests ({selectedTests.length})</h4>
                        <div className="selected-tags">
                            {selectedTests.map((testId) => {
                                const test = availableTests
                                    .flatMap(cat => cat.tests)
                                    .find(t => t.id === testId);
                                return (
                                    <span key={testId} className="selected-tag">
                                        {test?.name}
                                        <button
                                            type="button"
                                            onClick={() => handleTestToggle(testId)}
                                            className="tag-remove"
                                        >
                                            ✕
                                        </button>
                                    </span>
                                );
                            })}
                        </div>
                    </div>
                )}

                {error && <div className="error-alert">{error}</div>}

                <div className="form-actions">
                    <Button type="button" variant="secondary" onClick={onCancel}>
                        Cancel
                    </Button>
                    <Button type="submit" loading={loading}>
                        Submit Lab Request
                    </Button>
                </div>
            </form>
        </div>
    );
}

export default LabRequest;
