import React from 'react';
import './CategoryFilter.css';

function CategoryFilter({ selectedCategories = [], onChange }) {
    const categories = [
        {
            value: 'ALL',
            label: 'All Medical Data',
            icon: '📋',
            description: 'Complete medical history'
        },
        {
            value: 'DIAGNOSES',
            label: 'Diagnoses',
            icon: '🩺',
            description: 'Medical diagnoses and conditions'
        },
        {
            value: 'PRESCRIPTIONS',
            label: 'Prescriptions',
            icon: '💊',
            description: 'Prescribed medications'
        },
        {
            value: 'LAB_RESULTS',
            label: 'Lab Results',
            icon: '🔬',
            description: 'Laboratory test results'
        },
        {
            value: 'IMAGING',
            label: 'Imaging Reports',
            icon: '🏥',
            description: 'X-rays, MRI, CT scans'
        },
        {
            value: 'VITALS',
            label: 'Vitals',
            icon: '❤️',
            description: 'Blood pressure, heart rate, etc.'
        },
        {
            value: 'CONSULTATIONS',
            label: 'Consultations',
            icon: '👨‍⚕️',
            description: 'Doctor consultation notes'
        },
    ];

    const handleCategoryToggle = (categoryValue) => {
        let newSelection;

        if (categoryValue === 'ALL') {
            // If 'ALL' is selected, clear other selections
            newSelection = selectedCategories.includes('ALL') ? [] : ['ALL'];
        } else {
            // Remove 'ALL' if a specific category is selected
            const filtered = selectedCategories.filter(c => c !== 'ALL');

            if (selectedCategories.includes(categoryValue)) {
                newSelection = filtered.filter(c => c !== categoryValue);
            } else {
                newSelection = [...filtered, categoryValue];
            }
        }

        onChange && onChange(newSelection);
    };

    const isSelected = (categoryValue) => {
        return selectedCategories.includes(categoryValue) ||
            (categoryValue !== 'ALL' && selectedCategories.includes('ALL'));
    };

    return (
        <div className="category-filter-container">
            <div className="filter-header">
                <h4>Data Categories</h4>
                <p className="filter-subtitle">
                    Select which types of medical data to include in consent
                </p>
            </div>

            <div className="categories-grid">
                {categories.map((category) => (
                    <div
                        key={category.value}
                        className={`category-card ${isSelected(category.value) ? 'selected' : ''}`}
                        onClick={() => handleCategoryToggle(category.value)}
                    >
                        <div className="category-checkmark">
                            {isSelected(category.value) ? '✓' : ''}
                        </div>

                        <div className="category-icon">{category.icon}</div>

                        <div className="category-content">
                            <h5 className="category-label">{category.label}</h5>
                            <p className="category-description">{category.description}</p>
                        </div>
                    </div>
                ))}
            </div>

            {selectedCategories.length > 0 && (
                <div className="selected-summary">
                    <span className="summary-icon">📌</span>
                    <span className="summary-text">
                        {selectedCategories.includes('ALL')
                            ? 'All medical data will be shared'
                            : `${selectedCategories.length} category${selectedCategories.length > 1 ? 'ies' : ''} selected`
                        }
                    </span>
                </div>
            )}
        </div>
    );
}

export default CategoryFilter;
