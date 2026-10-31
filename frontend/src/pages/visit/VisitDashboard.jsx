import Brand from '../../components/common/Brand';
import ThemeToggle from '../../components/common/ThemeToggle';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import VisitLifecycle from '../../components/visit/VisitLifecycle';
import LabRequestForm from '../../components/clinical/LabRequestForm';
import ImagingRequestForm from '../../components/clinical/ImagingRequestForm';
import PrescriptionForm from '../../components/clinical/PrescriptionForm';
import { visitApi } from '../../api/visitApi';
import { emrApi } from '../../api/emrApi';

import './VisitDashboard.css';

function VisitDashboard() {
    const { visitId } = useParams();
    const navigate = useNavigate();

    const [visit, setVisit] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('overview');

    // Modal states
    const [showLabModal, setShowLabModal] = useState(false);
    const [showImagingModal, setShowImagingModal] = useState(false);
    const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);

    const loadVisitDetails = useCallback(async () => {
        setLoading(true);
        try {
            const visits = await visitApi.getHospitalVisits();
            const foundVisit = visits.data ? visits.data.find(v => v.id === visitId) : null;

            if (foundVisit) {
                const [labOrders, imagingOrders, prescriptions] = await Promise.all([
                    emrApi.getVisitLabOrders(visitId).catch(() => []),
                    emrApi.getVisitImagingOrders(visitId).catch(() => []),
                    emrApi.getVisitPrescriptions(visitId).catch(() => [])
                ]);

                setVisit({
                    ...foundVisit,
                    patientName: `${foundVisit.patient_first_name} ${foundVisit.patient_last_name}`,
                    patientId: foundVisit.patient_id,
                    visitDate: new Date(foundVisit.created_at).toLocaleDateString(),
                    visitTime: new Date(foundVisit.created_at).toLocaleTimeString(),
                    labOrders: labOrders.data || [],
                    imagingOrders: imagingOrders.data || [],
                    prescriptions: prescriptions.data || []
                });
            } else {
                setError('Visit not found');
            }

        } catch (error) {
            setError('Failed to load visit details');
        } finally {
            setLoading(false);
        }
    }, [visitId]);

    useEffect(() => {
        if (visitId) {
            loadVisitDetails();
        }
    }, [visitId, loadVisitDetails]);

    const handleCloseVisit = async () => {
        if (window.confirm('Are you sure you want to close this visit?')) {
            try {
                await visitApi.updateVisit(visitId, { status: 'closed' });
                loadVisitDetails(); // Refresh
            } catch (err) {
                alert('Failed to close visit');
            }
        }
    };

    const handleRequestSuccess = () => {
        setShowLabModal(false);
        setShowImagingModal(false);
        setShowPrescriptionModal(false);
        loadVisitDetails(); // Refresh data to show new request
        alert('Request submitted successfully');
    };

if (loading) return (
        <div className="patient-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] flex items-center justify-center p-8">
            <div className="glass-panel rounded-3xl p-8 text-slate-600 dark:text-slate-300">Loading visit details...</div>
        </div>
    );
    if (error) return (
        <div className="patient-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] flex items-center justify-center p-8">
            <div className="glass-panel border-rose-500/50 rounded-3xl p-8 text-rose-500">{error}</div>
        </div>
    );
    if (!visit) return (
        <div className="patient-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] flex items-center justify-center p-8">
            <div className="glass-panel border-rose-500/50 rounded-3xl p-8 text-rose-500">Visit not found</div>
        </div>
    );

    return (
        <div className="patient-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] text-slate-800 dark:text-slate-100 p-4 lg:p-8">
            <div className="max-w-[1440px] mx-auto glass-panel rounded-3xl min-h-[90vh] shadow-sm flex overflow-hidden mc-workspace">
                {/* Left Sidebar */}
                <aside className="w-64 border-r border-line dark:border-slate-800/50 p-6 flex flex-col mc-sidebar">
                    <Brand />
                    <nav className="space-y-2 flex-grow">
                        <button
                            className={`w-full flex items-center gap-3 px-4 py-3 transition rounded-lg font-medium ${activeTab === 'overview' ? 'sidebar-item-active text-slate-800 dark:text-slate-800' : 'text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface'}`}
                            onClick={() => setActiveTab('overview')}
                        >
                            <span className="material-symbols-outlined text-[20px]">grid_view</span>
                            Overview
                        </button>
                        <button
                            className={`w-full flex items-center gap-3 px-4 py-3 transition rounded-lg font-medium ${activeTab === 'requests' ? 'sidebar-item-active text-slate-800 dark:text-slate-800' : 'text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface'}`}
                            onClick={() => setActiveTab('requests')}
                        >
                            <span className="material-symbols-outlined text-[20px]">assignment</span>
                            Requests
                        </button>
                    </nav>
                    <div className="space-y-2 mt-auto pt-6 border-t border-line dark:border-slate-800/50">
                        <button onClick={() => navigate(-1)} className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-lg">
                            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                            Back
                        </button>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-grow p-8 overflow-y-auto">
                    <header className="mb-10">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Visit Dashboard</h2>
                                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Managing Visit: {visitId}</p>
                            </div>
                            <div className="flex items-center gap-3 glass-card px-4 py-2 rounded-2xl">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${visit?.status?.toLowerCase() === 'active' ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-slate-100 dark:bg-slate-800/30'}`}>
                                    <div className={`w-2 h-2 rounded-full ${visit?.status?.toLowerCase() === 'active' ? 'bg-emerald-500' : 'bg-slate-500'}`}></div>
                                </div>
                                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 uppercase tracking-wider">{visit?.status || 'Unknown'}</span>
                            </div>
                        </div>
                    </header>

                    <div className="content-area">
                        {activeTab === 'overview' && (
                            <div className="glass-card rounded-3xl p-6">
                                <h4 className="text-xl font-semibold mb-6 text-slate-800 dark:text-slate-100">Lifecycle</h4>
                                <VisitLifecycle currentStatus={visit.status} timestamps={{}} />
                            </div>
                        )}

                        {activeTab === 'requests' && (
                            <div className="space-y-6">
                                <h4 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Requests &amp; Orders</h4>

                                {visit.labOrders && visit.labOrders.length > 0 && (
                                    <div className="glass-card rounded-3xl p-6">
                                        <div className="flex items-center gap-3 mb-6 border-b border-primary-100 dark:border-primary-900/30 pb-4">
                                            <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400">
                                                <span className="material-symbols-outlined text-xl">science</span>
                                            </div>
                                            <h5 className="font-bold text-lg text-slate-800 dark:text-slate-100">Lab Orders</h5>
                                        </div>
                                        <div className="space-y-4">
                                            {visit.labOrders.map(order => (
                                                <div key={order.id} className="flex justify-between items-center bg-surface dark:bg-slate-800/50 p-4 rounded-2xl border border-line dark:border-slate-700/50">
                                                    <div>
                                                        <span className="font-bold text-slate-800 dark:text-slate-100 block mb-1">{order.test_name}</span>
                                                        <span className="text-xs text-slate-500 dark:text-slate-400 capitalize">{order.priority} • {new Date(order.created_at).toLocaleDateString()}</span>
                                                    </div>
                                                    <span className={`px-3 py-1 text-[10px] font-bold uppercase rounded-lg ${order.status === 'completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                                                        {order.status}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {visit.imagingOrders && visit.imagingOrders.length > 0 && (
                                    <div className="glass-card rounded-3xl p-6">
                                        <div className="flex items-center gap-3 mb-6 border-b border-primary-100 dark:border-primary-900/30 pb-4">
                                            <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400">
                                                <span className="material-symbols-outlined text-xl">radiology</span>
                                            </div>
                                            <h5 className="font-bold text-lg text-slate-800 dark:text-slate-100">Imaging Orders</h5>
                                        </div>
                                        <div className="space-y-4">
                                            {visit.imagingOrders.map(order => (
                                                <div key={order.id} className="flex justify-between items-center bg-surface dark:bg-slate-800/50 p-4 rounded-2xl border border-line dark:border-slate-700/50">
                                                    <div>
                                                        <span className="font-bold text-slate-800 dark:text-slate-100 block mb-1">{order.imaging_type} - {order.body_part}</span>
                                                        <span className="text-xs text-slate-500 dark:text-slate-400 capitalize">{order.priority} • {new Date(order.created_at).toLocaleDateString()}</span>
                                                    </div>
                                                    <span className={`px-3 py-1 text-[10px] font-bold uppercase rounded-lg ${order.status === 'completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                                                        {order.status}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {visit.prescriptions && visit.prescriptions.length > 0 && (
                                    <div className="glass-card rounded-3xl p-6">
                                        <div className="flex items-center gap-3 mb-6 border-b border-rose-100 dark:border-rose-900/30 pb-4">
                                            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center text-rose-600 dark:text-rose-400">
                                                <span className="material-symbols-outlined text-xl">prescriptions</span>
                                            </div>
                                            <h5 className="font-bold text-lg text-slate-800 dark:text-slate-100">Prescriptions</h5>
                                        </div>
                                        <div className="space-y-4">
                                            {visit.prescriptions.map(rx => (
                                                <div key={rx.id} className="flex justify-between items-center bg-surface dark:bg-slate-800/50 p-4 rounded-2xl border border-line dark:border-slate-700/50">
                                                    <div>
                                                        <span className="font-bold text-slate-800 dark:text-slate-100 block mb-1">{rx.medication} {rx.dosage}</span>
                                                        <span className="text-xs text-slate-500 dark:text-slate-400 capitalize">{rx.frequency} • {rx.route}</span>
                                                    </div>
                                                    <span className={`px-3 py-1 text-[10px] font-bold uppercase rounded-lg ${rx.status === 'active' ? "bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400" : 'bg-slate-100 text-slate-700 dark:bg-slate-800/30 dark:text-slate-400'}`}>
                                                        {rx.status}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {(!visit.labOrders?.length && !visit.imagingOrders?.length && !visit.prescriptions?.length) && (
                                    <div className="glass-card rounded-3xl p-8 text-center">
                                        <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 mb-2">folder_open</span>
                                        <p className="text-slate-500 dark:text-slate-400">No active requests or prescriptions.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </main>

                {/* Right Sidebar */}
                <aside className="w-80 border-l border-line dark:border-slate-800/50 p-6 glass-panel flex flex-col">
                    <h3 className="text-xl font-bold mb-6 text-slate-800 dark:text-slate-100">Patient Details</h3>
                    <div className="bg-surface dark:bg-slate-800/80 rounded-2xl p-4 shadow-sm mb-8 border border-line dark:border-slate-700/50 text-slate-800 dark:text-slate-100">
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider font-semibold">Name</p>
                        <p className="font-bold text-lg mb-4 text-slate-900 dark:text-white">{visit?.patientName}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider font-semibold">Reason</p>
                        <p className="font-medium text-slate-800 dark:text-slate-200">{visit?.reason || 'Not specified'}</p>
                    </div>

                    <h3 className="text-xl font-bold mb-4 text-slate-800 dark:text-slate-100">Actions</h3>
                    <div className="grid grid-cols-2 gap-3 mb-10">
                        <div className="glass-card rounded-2xl p-4 flex flex-col items-center gap-2 cursor-pointer hover:bg-surface dark:hover:bg-surface transition text-center" onClick={() => setShowLabModal(true)}>
                            <span className="material-symbols-outlined text-primary-500 text-2xl">science</span>
                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase leading-tight mt-1">Lab Request</span>
                        </div>
                        <div className="glass-card rounded-2xl p-4 flex flex-col items-center gap-2 cursor-pointer hover:bg-surface dark:hover:bg-surface transition text-center" onClick={() => setShowImagingModal(true)}>
                            <span className="material-symbols-outlined text-primary-500 text-2xl">radiology</span>
                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase leading-tight mt-1">Imaging Req</span>
                        </div>
                        <div className="glass-card rounded-2xl p-4 flex flex-col items-center gap-2 cursor-pointer hover:bg-surface dark:hover:bg-surface transition text-center" onClick={() => setShowPrescriptionModal(true)}>
                            <span className="material-symbols-outlined text-rose-500 text-2xl">prescriptions</span>
                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase leading-tight mt-1">Prescription</span>
                        </div>
                        <div className="glass-card rounded-2xl p-4 flex flex-col items-center gap-2 cursor-pointer hover:bg-surface dark:hover:bg-surface transition text-center" onClick={() => window.print()}>
                            <span className="material-symbols-outlined text-slate-500 text-2xl">print</span>
                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase leading-tight mt-1">Print Summary</span>
                        </div>
                    </div>

                    <div className="mt-auto space-y-3">
                        {visit?.status?.toLowerCase() === 'active' && (
                            <button onClick={handleCloseVisit} className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-bold transition shadow-lg shadow-rose-500/30">
                                <span className="material-symbols-outlined text-lg">cancel</span>
                                End Visit
                            </button>
                        )}
                        <ThemeToggle />
                    </div>
                </aside>
            </div>

            {/* Modals */}
            {showLabModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-surface dark:bg-slate-800 rounded-3xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">New Lab Request</h3>
                            <button onClick={() => setShowLabModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <LabRequestForm
                            visitId={visitId}
                            patientId={visit.patientId}
                            onClose={() => setShowLabModal(false)}
                            onSuccess={handleRequestSuccess}
                        />
                    </div>
                </div>
            )}

            {showImagingModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-surface dark:bg-slate-800 rounded-3xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">New Imaging Request</h3>
                            <button onClick={() => setShowImagingModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <ImagingRequestForm
                            visitId={visitId}
                            patientId={visit.patientId}
                            onClose={() => setShowImagingModal(false)}
                            onSuccess={handleRequestSuccess}
                        />
                    </div>
                </div>
            )}

            {showPrescriptionModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-surface dark:bg-slate-800 rounded-3xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">New Prescription</h3>
                            <button onClick={() => setShowPrescriptionModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <PrescriptionForm
                            onAdd={async (data) => {
                                try {
                                    await emrApi.createPrescription({ ...data, visitId, patientId: visit.patientId });
                                    handleRequestSuccess();
                                } catch (err) {
                                    alert('Failed to add prescription');
                                }
                            }}
                            onCancel={() => setShowPrescriptionModal(false)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

export default VisitDashboard;
