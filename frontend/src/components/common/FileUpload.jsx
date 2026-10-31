import React, { useState } from 'react';
import './FileUpload.css';

function FileUpload({ accept, maxSize = 10, onFileSelect, label }) {
    const [file, setFile] = useState(null);
    const [dragActive, setDragActive] = useState(false);
    const [error, setError] = useState('');

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const validateFile = (file) => {
        const maxSizeBytes = maxSize * 1024 * 1024; // Convert MB to bytes

        if (file.size > maxSizeBytes) {
            setError(`File size exceeds ${maxSize}MB limit`);
            return false;
        }

        setError('');
        return true;
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const droppedFile = e.dataTransfer.files[0];
            if (validateFile(droppedFile)) {
                setFile(droppedFile);
                if (onFileSelect) onFileSelect(droppedFile);
            }
        }
    };

    const handleChange = (e) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            if (validateFile(selectedFile)) {
                setFile(selectedFile);
                if (onFileSelect) onFileSelect(selectedFile);
            }
        }
    };

    const handleRemove = () => {
        setFile(null);
        setError('');
        if (onFileSelect) onFileSelect(null);
    };

    const formatFileSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    return (
        <div className="file-upload-container">
            {label && <label className="upload-label">{label}</label>}

            <div
                className={`upload-zone ${dragActive ? 'drag-active' : ''} ${error ? 'upload-error' : ''}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
            >
                <input
                    type="file"
                    id="file-upload"
                    className="file-input"
                    accept={accept}
                    onChange={handleChange}
                />

                {!file ? (
                    <label htmlFor="file-upload" className="upload-content">
                        <div className="upload-icon">📁</div>
                        <p className="upload-text">
                            <strong>Click to upload</strong> or drag and drop
                        </p>
                        <p className="upload-hint">
                            {accept ? `Accepted: ${accept}` : 'All file types'} (Max {maxSize}MB)
                        </p>
                    </label>
                ) : (
                    <div className="file-preview">
                        <div className="file-icon">📄</div>
                        <div className="file-details">
                            <p className="file-name">{file.name}</p>
                            <p className="file-size">{formatFileSize(file.size)}</p>
                        </div>
                        <button
                            type="button"
                            onClick={handleRemove}
                            className="remove-button"
                            aria-label="Remove file"
                        >
                            ✕
                        </button>
                    </div>
                )}
            </div>

            {error && <p className="error-message">{error}</p>}
        </div>
    );
}

export default FileUpload;
