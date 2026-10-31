import React from 'react';

function LabQueue({ tests, onSelect }) {
    return (
        <div className="glass-card rounded-3xl p-6">
            <h4 className="text-xl font-semibold mb-6 text-slate-800 dark:text-slate-100">Assigned Lab Requests</h4>
            {tests && tests.length > 0 ? (
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-700">
                                <th className="p-3 text-sm font-bold text-slate-500 dark:text-slate-400">Patient Name</th>
                                <th className="p-3 text-sm font-bold text-slate-500 dark:text-slate-400">Visit ID</th>
                                <th className="p-3 text-sm font-bold text-slate-500 dark:text-slate-400">Test Type</th>
                                <th className="p-3 text-sm font-bold text-slate-500 dark:text-slate-400">Doctor</th>
                                <th className="p-3 text-sm font-bold text-slate-500 dark:text-slate-400">Requested Time</th>
                                <th className="p-3 text-sm font-bold text-slate-500 dark:text-slate-400">Status</th>
                                <th className="p-3 text-sm font-bold text-slate-500 dark:text-slate-400">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tests.map(test => (
                                <tr key={test.id} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                    <td className="p-3 text-sm text-slate-800 dark:text-slate-200">{test.patient_name}</td>
                                    <td className="p-3 text-sm text-slate-800 dark:text-slate-200">VIS-{test.visit_id}</td>
                                    <td className="p-3 text-sm text-slate-800 dark:text-slate-200">{test.test_name}</td>
                                    <td className="p-3 text-sm text-slate-800 dark:text-slate-200">{test.doctor}</td>
                                    <td className="p-3 text-sm text-slate-800 dark:text-slate-200">{new Date(test.requested_time).toLocaleString()}</td>
                                    <td className="p-3">
                                        <span className="px-2 py-1 text-[10px] font-bold uppercase rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                                            {test.status}
                                        </span>
                                    </td>
                                    <td className="p-3">
                                        <button
                                            onClick={() => onSelect(test)}
                                            className="px-3 py-1.5 bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400 font-medium text-xs rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors"
                                        >
                                            View Details
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="text-center py-8">
                    <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 mb-2">science</span>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No lab requests assigned</p>
                </div>
            )}
        </div>
    );
}

export default LabQueue;
