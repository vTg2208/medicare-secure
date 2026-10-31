import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import { nurseApi } from '../../api/nurseApi';
import ThemeToggle from '../../components/common/ThemeToggle';
import '../../pages/patient/Dashboard.css';

const NursePatientRecords = () => {
    const { id: patientId } = useParams();
    const navigate = useNavigate();


    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newRecord, setNewRecord] = useState({ type: 'note', title: '', description: '' });
    const [submitting, setSubmitting] = useState(false);

    const fetchRecords = useCallback(async () => {
        try {
            setLoading(true);
            const response = await nurseApi.getPatientRecords(patientId);
            if (response && response.success) {
                setRecords(response.data || []);
            }
        } catch (error) {
        } finally {
            setLoading(false);
        }
    }, [patientId]);

    useEffect(() => { fetchRecords(); }, [fetchRecords]);

    const handleAddRecord = async (e) => {
        e.preventDefault();
        try {
            setSubmitting(true);
            const response = await nurseApi.addPatientRecord(patientId, newRecord);
            if (response && response.success) {
                setShowAddForm(false);
                setNewRecord({ type: 'note', title: '', description: '' });
                fetchRecords();
            }
        } catch (error) {
        } finally {
            setSubmitting(false);
        }
    };

    const formatType = (type) => {
        const types = {
            'consultation': 'Consultation',
            'diagnosis': 'Diagnosis',
            'prescription': 'Prescription',
            'lab_result': 'Lab Result',
            'imaging': 'Imaging',
            'procedure': 'Procedure/Action',
            'note': 'Nursing Note',
            'other': 'Other'
        };
        return types[type] || type;
    };

    const getTypeColor = (type) => {
        switch (type) {
            case 'note': return 'text-violet-600 bg-violet-100/50 border-violet-200 dark:text-violet-400 dark:bg-violet-900/30 dark:border-violet-800/50';
            case 'procedure': return 'text-amber-600 bg-amber-100/50 border-amber-200 dark:text-amber-400 dark:bg-amber-900/30 dark:border-amber-800/50';
            case 'consultation': return 'text-emerald-600 bg-emerald-100/50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-900/30 dark:border-emerald-800/50';
            case 'lab_result': return 'text-sky-600 bg-sky-100/50 border-sky-200 dark:text-sky-400 dark:bg-sky-900/30 dark:border-sky-800/50';
            case 'prescription': return 'text-rose-600 bg-rose-100/50 border-rose-200 dark:text-rose-400 dark:bg-rose-900/30 dark:border-rose-800/50';
            default: return 'text-slate-600 bg-slate-100/50 border-slate-200 dark:text-slate-400 dark:bg-slate-800/50 dark:border-slate-700/50';
        }
    };

    const getTypeIcon = (type) => {
        switch (type) {
            case 'note': return 'edit_document';
            case 'procedure': return 'healing';
            case 'consultation': return 'stethoscope';
            case 'lab_result': return 'science';
            case 'prescription': return 'medication';
            default: return 'article';
        }
    };

    return (
        <div className="patient-dashboard-wrapper bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 text-slate-800 dark:text-slate-100 flex h-screen w-full overflow-hidden">
            <div className="absolute top-4 right-4 z-50">
                <ThemeToggle />
            </div>

            <main className="flex-1 flex flex-col h-full overflow-hidden relative w-full">
                {/* Stunning Decorative Backgrounds */}
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-teal-500/10 dark:bg-teal-400/5 rounded-full blur-[100px] pointer-events-none"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/10 dark:bg-indigo-400/5 rounded-full blur-[100px] pointer-events-none"></div>

                <header className="px-10 py-8 flex items-center justify-between flex-shrink-0 z-10 sticky top-0 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/30 transition-all shadow-sm">
                    <div className="flex items-center gap-6">
                        <button
                            onClick={() => navigate('/nurse/patients')}
                            className="group relative w-12 h-12 flex items-center justify-center rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:-translate-x-1 transition-all duration-300"
                        >
                            <span className="material-symbols-outlined text-teal-600 dark:text-teal-400 group-hover:scale-110 transition-transform">arrow_back</span>
                        </button>
                        <div>
                            <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-teal-600 to-indigo-600 dark:from-teal-400 dark:to-indigo-400">
                                Patient Records
                            </h1>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1.5 flex items-center gap-2 font-medium">
                                <span className="material-symbols-outlined text-[16px]">tag</span>
                                {patientId}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={() => setShowAddForm(!showAddForm)}
                        className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all duration-300 shadow-lg ${showAddForm ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 shadow-slate-200/50 dark:shadow-none' : 'bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white shadow-teal-500/30 hover:shadow-teal-500/50 hover:-translate-y-0.5'}`}
                    >
                        <span className="material-symbols-outlined text-[20px]">{showAddForm ? 'close' : 'add_circle'}</span>
                        {showAddForm ? 'Cancel Creation' : 'New Record'}
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto px-10 py-8 pb-24 scrollbar-hide">
                    <div className="max-w-5xl mx-auto space-y-8">

                        {/* Premium Add Record Form */}
                        {showAddForm && (
                            <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-2xl rounded-3xl border border-white/50 dark:border-slate-700/50 p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] animate-fade-in-up relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-teal-400/5 rounded-full blur-3xl -mx-20 -my-20"></div>
                                <div className="relative z-10 flex items-center gap-4 mb-6">
                                    <div className="w-12 h-12 rounded-2xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-teal-600 dark:text-teal-400">
                                        <span className="material-symbols-outlined text-2xl">post_add</span>
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Create Nursing Record</h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Document vitals, observations, or actions taken.</p>
                                    </div>
                                </div>
                                <form onSubmit={handleAddRecord} className="space-y-6 relative z-10">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Record Category</label>
                                            <div className="relative">
                                                <select
                                                    value={newRecord.type}
                                                    onChange={(e) => setNewRecord({ ...newRecord, type: e.target.value })}
                                                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/50 text-slate-900 dark:text-white appearance-none transition-all shadow-sm"
                                                >
                                                    <option value="note">Nursing Note (Vitals/Observation)</option>
                                                    <option value="procedure">Clinical Procedure / Action</option>
                                                    <option value="other">Other</option>
                                                </select>
                                                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-teal-500">category</span>
                                                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Record Title</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    required
                                                    value={newRecord.title}
                                                    onChange={(e) => setNewRecord({ ...newRecord, title: e.target.value })}
                                                    placeholder="E.g. Morning Vitals Check"
                                                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/50 text-slate-900 dark:text-white transition-all shadow-sm placeholder:font-normal placeholder:text-slate-400"
                                                />
                                                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-teal-500">title</span>
                                            </div>
                                        </div>
                                        <div className="md:col-span-2 space-y-2">
                                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Detailed Description</label>
                                            <textarea
                                                required
                                                value={newRecord.description}
                                                onChange={(e) => setNewRecord({ ...newRecord, description: e.target.value })}
                                                rows="4"
                                                placeholder="Enter detailed clinical notes here..."
                                                className="w-full p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/50 text-slate-900 dark:text-white resize-none transition-all shadow-sm placeholder:font-normal placeholder:text-slate-400"
                                            ></textarea>
                                        </div>
                                    </div>
                                    <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-700/50">
                                        <button
                                            type="submit"
                                            disabled={submitting}
                                            className="px-8 py-3.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-teal-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 hover:-translate-y-0.5"
                                        >
                                            {submitting ? (
                                                <><span className="material-symbols-outlined animate-spin text-[20px]">sync</span> Saving...</>
                                            ) : (
                                                <><span className="material-symbols-outlined text-[20px]">save</span> Save Record To Chart</>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}

                        {/* Premium Records Timeline */}
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-32">
                                <div className="w-16 h-16 border-4 border-teal-100 dark:border-teal-900 border-t-teal-500 dark:border-t-teal-400 rounded-full animate-spin"></div>
                                <p className="mt-6 text-slate-500 font-medium animate-pulse">Retrieving patient history...</p>
                            </div>
                        ) : records.length > 0 ? (
                            <div className="relative pt-6 pb-12">
                                {/* Glowing Timeline Track */}
                                <div className="absolute top-0 bottom-0 left-[31px] md:left-[39px] w-1 bg-gradient-to-b from-teal-500/20 via-indigo-500/20 to-transparent rounded-full z-0 pointer-events-none"></div>

                                <div className="space-y-8">
                                    {records.map((record, idx) => (
                                        <div key={record.id} className="relative z-10 flex gap-6 md:gap-8 animate-fade-in-up" style={{ animationDelay: `${idx * 0.05}s` }}>
                                            {/* Dynamic Timeline Marker */}
                                            <div className="mt-6 flex-shrink-0 relative">
                                                <div className="absolute inset-0 bg-teal-400 blur-md opacity-20 rounded-full"></div>
                                                <div className="w-16 h-16 md:w-20 md:h-20 bg-white dark:bg-slate-800 rounded-full shadow-md flex items-center justify-center border-4 border-slate-50 dark:border-slate-900 relative z-10">
                                                    <span className={`material-symbols-outlined text-2xl md:text-3xl ${getTypeColor(record.type).split(' ')[0]}`}>
                                                        {getTypeIcon(record.type)}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Expansive Record Card */}
                                            <div className="flex-1 bg-white/70 dark:bg-slate-800/60 backdrop-blur-xl border border-white/60 dark:border-slate-700/50 p-6 md:p-8 rounded-[2rem] shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgb(0,0,0,0.1)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] transition-all duration-300 group">
                                                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
                                                    <div className="space-y-3">
                                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-lg uppercase tracking-widest ${getTypeColor(record.type)}`}>
                                                            <span className="material-symbols-outlined text-[14px]">label</span>
                                                            {formatType(record.type)}
                                                        </span>
                                                        <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">{record.title}</h3>
                                                    </div>
                                                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-100/80 dark:bg-slate-900/50 rounded-xl border border-slate-200/50 dark:border-slate-700/50 h-fit">
                                                        <span className="material-symbols-outlined text-slate-400 text-[18px]">schedule</span>
                                                        <span className="text-sm font-bold text-slate-600 dark:text-slate-300">
                                                            {new Date(record.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="bg-slate-50/80 dark:bg-slate-900/60 p-5 rounded-2xl text-slate-700 dark:text-slate-300 text-[15px] leading-relaxed mb-6 border border-slate-200/50 dark:border-slate-800/80 shadow-inner">
                                                    {record.description}
                                                </div>

                                                <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-700/50">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-indigo-500 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                                                        {record.created_by_name?.charAt(0) || 'N'}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{record.created_by_name}</span>
                                                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{record.created_by_role}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="py-24 flex flex-col items-center justify-center bg-white/40 dark:bg-slate-800/40 backdrop-blur-2xl rounded-[3rem] border border-dashed border-slate-300 dark:border-slate-700/80 shadow-sm relative overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-50/50 dark:to-slate-900/50"></div>
                                <div className="relative z-10 flex flex-col items-center">
                                    <div className="w-24 h-24 mb-6 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shadow-inner rotate-3 hover:rotate-0 transition-transform duration-500">
                                        <span className="material-symbols-outlined text-5xl text-teal-500/50 dark:text-teal-400/50">note_stack</span>
                                    </div>
                                    <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-3">No Clinical Records Found</h3>
                                    <p className="text-slate-500 dark:text-slate-400 text-center max-w-sm mx-auto font-medium">
                                        The digital chart for this patient is currently empty. Begin documenting care by adding a new record.
                                    </p>
                                    <button
                                        onClick={() => setShowAddForm(true)}
                                        className="mt-8 px-6 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-teal-600 dark:text-teal-400 font-bold rounded-xl shadow-sm hover:shadow-md hover:-translate-y-1 transition-all flex items-center gap-2"
                                    >
                                        <span className="material-symbols-outlined">add</span>
                                        Create First Record
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default NursePatientRecords;
