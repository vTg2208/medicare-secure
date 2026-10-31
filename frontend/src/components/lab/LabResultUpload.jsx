import React, { useState } from 'react';
import { labApi } from '../../api/labApi';

function LabResultUpload({ test, onUploadSuccess }) {
    const [file, setFile] = useState(null);
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const ALLOWED_FORMATS = ['application/pdf', 'image/jpeg', 'image/png'];
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        setError('');

        if (selectedFile) {
            if (!ALLOWED_FORMATS.includes(selectedFile.type)) {
                setError('Invalid file format. Allowed formats: PDF, JPG, PNG.');
                setFile(null);
            } else if (selectedFile.size > MAX_FILE_SIZE) {
                setError('File size exceeds 5MB limit.');
                setFile(null);
            } else {
                setFile(selectedFile);
            }
        }
    };

    const handleUpload = async (e) => {
        e.preventDefault();

        if (!file) {
            setError('Please select a valid file to upload.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const formData = new FormData();
            formData.append('order_id', test.id);
            formData.append('visit_id', test.visit_id);
            formData.append('patient_id', test.patient_id);
            formData.append('test_name', test.test_name || '');
            formData.append('test_code', test.test_code || '');
            formData.append('test_category', test.test_category || '');
            formData.append('notes', notes);
            formData.append('file', file);

            await labApi.uploadLabResult(formData);

            // Clear form
            setFile(null);
            setNotes('');
            // Optional: reset file input via ref
            document.getElementById('file-upload').value = '';

            if (onUploadSuccess) {
                onUploadSuccess();
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to upload lab result. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (!test) return null;

    return (
        <div className="glass-card rounded-3xl p-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <span className="material-symbols-outlined text-xl">cloud_upload</span>
                </div>
                <h4 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Upload Result Form</h4>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-xl text-sm font-medium border border-rose-100 dark:border-rose-900/50 flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg">error</span>
                    {error}
                </div>
            )}

            <form onSubmit={handleUpload} className="space-y-4">
                <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Result File Upload (PDF, JPG, PNG)</label>
                    <div className="relative">
                        <input
                            id="file-upload"
                            type="file"
                            accept=".pdf, .jpg, .jpeg, .png"
                            onChange={handleFileChange}
                            className="w-full text-sm text-slate-500 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 dark:file:bg-indigo-900/30 dark:file:text-indigo-400 dark:hover:file:bg-indigo-900/50 transition-colors"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Result Notes (Optional)</label>
                    <textarea
                        rows="3"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Enter any observational notes here..."
                        className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-slate-100 transition-all resize-none shadow-sm"
                    ></textarea>
                </div>

                <div className="pt-2">
                    <button
                        type="submit"
                        disabled={loading || !file}
                        className={`w-full py-3 px-4 flex items-center justify-center gap-2 text-sm font-bold text-white rounded-xl shadow-md transition-all ${loading || !file ? 'bg-indigo-400 dark:bg-indigo-600/50 cursor-not-allowed cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg dark:hover:shadow-indigo-900/20'}`}
                    >
                        {loading ? (
                            <>
                                <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                                Uploading...
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined text-lg">publish</span>
                                Upload Result
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default LabResultUpload;
