import React, { useState, useMemo, useId } from 'react';
import { getDoctorMockImage } from '../../utils/mockImages';
import FlowSteps from '../common/FlowSteps';
import BookingDialog from './BookingDialog';

const DoctorSelectionPopup = ({ doctors, onClose, onSelect, initialDoctorId = null, returnFocusRef }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [selectedDoctorId, setSelectedDoctorId] = useState(initialDoctorId);
    const [expanded, setExpanded] = useState(false);
    const id = useId();
    const categories = useMemo(() => ['All', ...new Set(doctors.map(doctor => doctor.specialization?.trim() || 'General'))], [doctors]);
    const filteredDoctors = useMemo(() => doctors.filter(doctor => {
        const specialty = doctor.specialization?.trim() || 'General';
        const term = searchQuery.trim().toLowerCase();
        return (selectedCategory === 'All' || specialty === selectedCategory) && (`Dr. ${doctor.firstName} ${doctor.lastName}`.toLowerCase().includes(term) || specialty.toLowerCase().includes(term));
    }), [doctors, selectedCategory, searchQuery]);
    const selected = doctors.find(doctor => doctor.id === selectedDoctorId);
    const visibleDoctors = expanded ? filteredDoctors : filteredDoctors.filter((doctor, index) => index < 4 || doctor.id === selectedDoctorId);

    return <BookingDialog wide labelledBy={`${id}-heading`} onDismiss={onClose} returnFocusRef={returnFocusRef}>
        <header className="flex items-center justify-between gap-4 mb-5">
            <h2 id={`${id}-heading`} className="text-xl font-bold">Select Doctor</h2>
            <button type="button" onClick={onClose} aria-label="Close doctor selection" className="p-2 rounded-lg hover:bg-canvas"><span aria-hidden="true" className="material-symbols-outlined">close</span></button>
        </header>
        <FlowSteps label="Booking progress" steps={[{ label: 'Doctor' }, { label: 'Appointment' }, { label: 'Request' }]} currentStep={0} />
        <div className="grid sm:grid-cols-2 gap-4 my-6">
            <div><label htmlFor={`${id}-specialty`} className="block mb-2 font-semibold">Specialty</label>
                <select id={`${id}-specialty`} value={selectedCategory} onChange={event => { setSelectedCategory(event.target.value); setExpanded(false); }} className="w-full p-3 border border-line bg-surface rounded-lg">
                    {categories.map(category => <option key={category} value={category}>{category === 'All' ? 'All specialties' : category}</option>)}
                </select>
            </div>
            <div><label htmlFor={`${id}-search`} className="block mb-2 font-semibold">Search doctors</label>
                <input id={`${id}-search`} type="search" placeholder="Name or specialty" value={searchQuery} onChange={event => { setSearchQuery(event.target.value); setExpanded(false); }} className="w-full p-3 border border-line bg-surface rounded-lg" />
            </div>
        </div>
        <p className="text-sm mb-4" role="status">Showing {visibleDoctors.length} of {filteredDoctors.length} doctors</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {visibleDoctors.map(doctor => <button type="button" key={doctor.id} onClick={() => setSelectedDoctorId(doctor.id)} aria-pressed={selectedDoctorId === doctor.id} className="mc-provider-card border border-line rounded-2xl p-3 bg-surface">
                <img alt="" src={doctor.profileImage || getDoctorMockImage(doctor.id)} />
                <span className="block font-bold mt-3">Dr. {doctor.firstName} {doctor.lastName}</span>
                <span className="block text-sm mt-1">{doctor.specialization || 'General'}</span>
                {selectedDoctorId === doctor.id && <span className="block text-sm font-semibold mt-2">Selected</span>}
            </button>)}
        </div>
        {!filteredDoctors.length && <p className="my-8">No doctors found matching your criteria.</p>}
        {filteredDoctors.length > 4 && <button type="button" onClick={() => setExpanded(value => !value)} aria-expanded={expanded} className="my-5 px-4 py-2 border border-line rounded-lg">{expanded ? 'Show fewer doctors' : `Show all ${filteredDoctors.length} doctors`}</button>}
        <footer className="mt-5 pt-5 border-t border-line flex flex-col sm:flex-row justify-between gap-4 sm:items-center">
            <p className="text-sm mc-booking-summary">{selected ? `Selected: Dr. ${selected.firstName} ${selected.lastName}` : 'Choose a doctor to view clinic appointments.'}</p>
            <button type="button" onClick={() => selected && onSelect(selected)} disabled={!selected} className="px-6 py-3 rounded-lg bg-primary-600 text-white disabled:opacity-50">Continue</button>
        </footer>
    </BookingDialog>;
};

export default DoctorSelectionPopup;
