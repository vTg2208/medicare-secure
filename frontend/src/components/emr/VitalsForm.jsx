import React, { useState } from 'react';
import Button from '../common/Button';
import Input from '../common/Input';
import './VitalsForm.css';

function VitalsForm({ visitId, patientName, onSuccess, onCancel }) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        bloodPressureSystolic: '',
        bloodPressureDiastolic: '',
        heartRate: '',
        temperature: '',
        respiratoryRate: '',
        oxygenSaturation: '',
        weight: '',
        height: '',
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });

        // Auto-calculate BMI when weight and height are available
        if (name === 'weight' || name === 'height') {
            calculateBMI();
        }
    };

    const calculateBMI = () => {
        const weight = parseFloat(formData.weight);
        const height = parseFloat(formData.height) / 100; // Convert cm to m
        if (weight && height) {
            const bmi = (weight / (height * height)).toFixed(1);
            return bmi;
        }
        return null;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // TODO: API call to record vitals
            // await emrApi.recordVitals(visitId, formData);

            if (onSuccess) onSuccess();
        } catch (error) {
            alert('Failed to save vitals');
        } finally {
            setLoading(false);
        }
    };

    const bmi = calculateBMI();

    return (
        <div className="vitals-form-container">
            <div className="form-header">
                <h3>🩺 Record Vitals</h3>
                <p className="form-subtitle">Patient: {patientName || 'Unknown'}</p>
            </div>

            <div className="read-only-notice">
                <span className="notice-icon">ℹ️</span>
                <span>Vitals become read-only after submission</span>
            </div>

            <form onSubmit={handleSubmit} className="vitals-form">
                {/* Blood Pressure */}
                <div className="vitals-section">
                    <h4 className="section-title">Blood Pressure</h4>
                    <div className="form-row">
                        <Input
                            label="Systolic (mmHg)"
                            name="bloodPressureSystolic"
                            type="number"
                            value={formData.bloodPressureSystolic}
                            onChange={handleChange}
                            placeholder="120"
                            required
                        />
                        <Input
                            label="Diastolic (mmHg)"
                            name="bloodPressureDiastolic"
                            type="number"
                            value={formData.bloodPressureDiastolic}
                            onChange={handleChange}
                            placeholder="80"
                            required
                        />
                    </div>
                </div>

                {/* Cardiac & Respiratory */}
                <div className="vitals-section">
                    <h4 className="section-title">Cardiac & Respiratory</h4>
                    <div className="form-row">
                        <Input
                            label="Heart Rate (bpm)"
                            name="heartRate"
                            type="number"
                            value={formData.heartRate}
                            onChange={handleChange}
                            placeholder="72"
                            required
                        />
                        <Input
                            label="Respiratory Rate (breaths/min)"
                            name="respiratoryRate"
                            type="number"
                            value={formData.respiratoryRate}
                            onChange={handleChange}
                            placeholder="16"
                            required
                        />
                    </div>
                </div>

                {/* Temperature & Oxygen */}
                <div className="vitals-section">
                    <h4 className="section-title">Temperature & Oxygen</h4>
                    <div className="form-row">
                        <Input
                            label="Temperature (°F)"
                            name="temperature"
                            type="number"
                            step="0.1"
                            value={formData.temperature}
                            onChange={handleChange}
                            placeholder="98.6"
                            required
                        />
                        <Input
                            label="Oxygen Saturation (%)"
                            name="oxygenSaturation"
                            type="number"
                            value={formData.oxygenSaturation}
                            onChange={handleChange}
                            placeholder="98"
                            required
                        />
                    </div>
                </div>

                {/* Physical Measurements */}
                <div className="vitals-section">
                    <h4 className="section-title">Physical Measurements</h4>
                    <div className="form-row">
                        <Input
                            label="Weight (kg)"
                            name="weight"
                            type="number"
                            step="0.1"
                            value={formData.weight}
                            onChange={handleChange}
                            placeholder="70"
                            required
                        />
                        <Input
                            label="Height (cm)"
                            name="height"
                            type="number"
                            value={formData.height}
                            onChange={handleChange}
                            placeholder="170"
                            required
                        />
                    </div>
                    {bmi && (
                        <div className="bmi-display">
                            <strong>BMI:</strong> {bmi} kg/m²
                            <span className="bmi-category">
                                {bmi < 18.5 ? '(Underweight)' : bmi < 25 ? '(Normal)' : bmi < 30 ? '(Overweight)' : '(Obese)'}
                            </span>
                        </div>
                    )}
                </div>

                <div className="form-actions">
                    <Button type="button" variant="secondary" onClick={onCancel}>
                        Cancel
                    </Button>
                    <Button type="submit" loading={loading}>
                        Record Vitals
                    </Button>
                </div>
            </form>
        </div>
    );
}

export default VitalsForm;
