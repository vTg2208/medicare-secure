import React from 'react';

function LabTestDetails({ test }) {
    if (!test) return null;

    return (
        <div className="glass-card rounded-3xl p-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400">
                    <span className="material-symbols-outlined text-xl">biotech</span>
                </div>
                <h4 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Test Details Panel</h4>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 dark:bg-slate-800/30 p-4 rounded-2xl">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Patient ID</span>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mt-1">PAT-{test.patient_id}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/30 p-4 rounded-2xl">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Visit ID</span>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mt-1">VIS-{test.visit_id}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/30 p-4 rounded-2xl">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Test Name</span>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mt-1">{test.test_name}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/30 p-4 rounded-2xl">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Requested By</span>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mt-1">{test.doctor}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/30 p-4 rounded-2xl col-span-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Clinical Notes</span>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mt-1">{test.notes || 'None provided'}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/30 p-4 rounded-2xl col-span-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Requested Time</span>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mt-1">{new Date(test.requested_time).toLocaleString()}</p>
                </div>
            </div>
        </div>
    );
}

export default LabTestDetails;
