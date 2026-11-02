import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
const Login = lazy(() => import('../pages/auth/Login'));
const Register = lazy(() => import('../pages/auth/Register'));

const PatientDashboard = lazy(() => import('../pages/patient/Dashboard'));
const DoctorDashboard = lazy(() => import('../pages/doctor/Dashboard'));
const HospitalAdminDashboard = lazy(() => import('../pages/admin/HospitalAdminDashboard'));
const StaffDashboard = lazy(() => import('../pages/staff/Dashboard'));
import ProtectedRoute from './ProtectedRoute';
const Consent = lazy(() => import('../pages/patient/Consent'));
const Visits = lazy(() => import('../pages/patient/Visits'));
const MedicalRecords = lazy(() => import('../pages/patient/MedicalRecords'));
const MedicalRecordsView = lazy(() => import('../pages/patient/MedicalRecordsView'));
const VisitQueue = lazy(() => import('../pages/staff/VisitQueue'));
const ActiveVisits = lazy(() => import('../pages/doctor/ActiveVisits'));
const PatientRecords = lazy(() => import('../pages/doctor/PatientRecords'));
const PatientMedicalRecords = lazy(() => import('../pages/doctor/PatientMedicalRecords'));
const ConsentRequests = lazy(() => import('../pages/doctor/ConsentRequests'));
const ClinicalNotes = lazy(() => import('../pages/doctor/ClinicalNotes'));
const NurseDashboard = lazy(() => import('../pages/nurse/Dashboard'));
const AssignedPatients = lazy(() => import('../pages/nurse/AssignedPatients'));
const NursePatientRecords = lazy(() => import('../pages/nurse/NursePatientRecords'));
const NurseMedications = lazy(() => import('../pages/nurse/NurseMedications'));
const NurseProfile = lazy(() => import('../pages/nurse/NurseProfile'));
const NurseVitals = lazy(() => import('../pages/nurse/NurseVitals'));
const NurseSchedule = lazy(() => import('../pages/nurse/NurseSchedule'));
const LabDashboard = lazy(() => import('../pages/lab/Dashboard'));
const RadiologistDashboard = lazy(() => import('../pages/radiology/Dashboard'));
const ImagingQueue = lazy(() => import('../pages/radiology/ImagingQueue'));
const ReportUpload = lazy(() => import('../pages/radiology/ReportUpload'));
const RadiologistProfile = lazy(() => import('../pages/radiology/RadiologistProfile'));
const RadiologistAuditLogs = lazy(() => import('../pages/radiology/RadiologistAuditLogs'));
const PharmacistDashboard = lazy(() => import('../pages/pharmacist/Dashboard'));
const PharmacistPrescriptionQueue = lazy(() => import('../pages/pharmacist/PrescriptionQueue'));
const PharmacistInventory = lazy(() => import('../pages/pharmacist/Inventory'));
const PharmacistProfile = lazy(() => import('../pages/pharmacist/PharmacistProfile'));
const PharmacistAuditLogs = lazy(() => import('../pages/pharmacist/PharmacistAuditLogs'));

// Compliance Officer Pages
const ComplianceDashboard = lazy(() => import('../pages/compliance/Dashboard'));
const GlobalAuditLogs = lazy(() => import('../pages/compliance/GlobalAuditLogs'));
const Incidents = lazy(() => import('../pages/compliance/Incidents'));
const ConsentOverrides = lazy(() => import('../pages/compliance/ConsentOverrides'));
const ComplianceProfile = lazy(() => import('../pages/compliance/Profile'));
const PrivacyCenter = lazy(() => import('../pages/privacy/PrivacyCenter'));
const PrivacyNotice = lazy(() => import('../pages/privacy/PrivacyNotice'));
const NoticeGovernance = lazy(() => import('../pages/privacy/NoticeGovernance'));

// Insurance Pages
const InsuranceDashboard = lazy(() => import('../pages/insurance/Dashboard'));
const InsuranceClaimsManagement = lazy(() => import('../pages/insurance/ClaimsManagement'));
const InsuranceCoverageVerification = lazy(() => import('../pages/insurance/CoverageVerification'));
const InsurancePolicyholders = lazy(() => import('../pages/insurance/Policyholders'));
const InsuranceProfile = lazy(() => import('../pages/insurance/Profile'));

// Researcher Pages
const ResearcherDashboard = lazy(() => import('../pages/researcher/Dashboard'));
const ResearcherDataExplorer = lazy(() => import('../pages/researcher/DataExplorer'));
const ResearcherProfile = lazy(() => import('../pages/researcher/Profile'));

const NewVisit = lazy(() => import('../pages/patient/NewVisit'));
const ScheduleNewVisit = lazy(() => import('../pages/patient/ScheduleNewVisit'));
const GrantConsent = lazy(() => import('../pages/patient/GrantConsent'));
const VisitManagement = lazy(() => import('../pages/admin/VisitManagement'));
const VerifyVisitOTP = lazy(() => import('../pages/patient/VerifyVisitOTP'));
const AcceptInvitation = lazy(() => import('../pages/auth/AcceptInvitation'));
const StaffManagement = lazy(() => import('../pages/admin/StaffManagement'));
const WorkflowDashboard = lazy(() => import('../pages/staff/WorkflowDashboard'));
const UserManagement = lazy(() => import('../pages/admin/UserManagement'));
const AuditLogs = lazy(() => import('../pages/admin/AuditLogs'));
const DoctorRegistration = lazy(() => import('../pages/admin/DoctorRegistration'));
const DoctorVerification = lazy(() => import('../pages/admin/DoctorVerification'));
const AuditTrail = lazy(() => import('../pages/patient/AuditTrail'));
const Profile = lazy(() => import('../pages/common/Profile'));
const LandingPage = lazy(() => import('../pages/LandingPage'));
const ReceptionistVisitManagement = lazy(() => import('../pages/receptionist/ReceptionistVisitManagement'));
const PatientRegistration = lazy(() => import('../pages/staff/PatientRegistration'));
const Support = lazy(() => import('../pages/patient/Support'));
const Messages = lazy(() => import('../pages/patient/Messages'));
const AppointmentCalendar = lazy(() => import('../pages/admin/AppointmentCalendar'));
const RetentionGovernance = lazy(() => import('../pages/compliance/RetentionGovernance'));
const AIChatbot = lazy(() => import('../pages/patient/AIChatbot'));
const TriageQueue = lazy(() => import('../pages/doctor/TriageQueue'));

function AppRoutes() {
    return (
        <Suspense fallback={<div role="status" className="p-8 text-center">Loading page...</div>}>
        <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/privacy-notice/:versionId?" element={<PrivacyNotice />} />
            <Route path="/compliance/notices" element={<ProtectedRoute allowedRoles={['compliance_officer']}><NoticeGovernance /></ProtectedRoute>} />
            <Route path="/staff/invitation/:token" element={<AcceptInvitation />} />

            {/* Protected Routes */}
            <Route path="/patient/privacy" element={<ProtectedRoute allowedRoles={['patient']}><PrivacyCenter /></ProtectedRoute>} />
            <Route path="/compliance/privacy" element={<ProtectedRoute allowedRoles={['compliance_officer']}><PrivacyCenter /></ProtectedRoute>} />
            <Route path="/compliance/retention" element={<ProtectedRoute allowedRoles={['compliance_officer']}><RetentionGovernance /></ProtectedRoute>} />
            <Route path="/messages" element={<ProtectedRoute allowedRoles={['patient', 'doctor', 'nurse']}><Messages /></ProtectedRoute>} />
            <Route path="/admin/appointment-calendars" element={<ProtectedRoute allowedRoles={['hospital_admin', 'system_admin']}><AppointmentCalendar /></ProtectedRoute>} />
            <Route path="/doctor/messages" element={<ProtectedRoute allowedRoles={['doctor']}><Messages /></ProtectedRoute>} />
            <Route path="/nurse/messages" element={<ProtectedRoute allowedRoles={['nurse']}><Messages /></ProtectedRoute>} />
            <Route
                path="/patient/dashboard"
                element={
                    <ProtectedRoute allowedRoles={['patient']}>
                        <PatientDashboard />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/patient/chatbot"
                element={
                    <ProtectedRoute allowedRoles={['patient']}>
                        {<AIChatbot />}
                    </ProtectedRoute>
                }
            />

            <Route
                path="/doctor/dashboard"
                element={
                    <ProtectedRoute allowedRoles={['doctor']}>
                        <DoctorDashboard />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/doctor/triage-sessions"
                element={
                    <ProtectedRoute allowedRoles={['doctor']}>
                        <TriageQueue />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/patient/consent"
                element={
                    <ProtectedRoute allowedRoles={['patient']}>
                        <Consent />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/patient/consent/grant"
                element={
                    <ProtectedRoute allowedRoles={['patient']}>
                        <GrantConsent />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/patient/visits"
                element={
                    <ProtectedRoute allowedRoles={['patient']}>
                        <Visits />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/patient/messages"
                element={
                    <ProtectedRoute allowedRoles={['patient']}>
                        <Messages />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/patient/support"
                element={
                    <ProtectedRoute allowedRoles={['patient']}>
                        <Support />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/patient/medical-records-view"
                element={
                    <ProtectedRoute allowedRoles={['patient']}>
                        <MedicalRecordsView />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/staff/registration"
                element={
                    <ProtectedRoute allowedRoles={['receptionist', 'nurse', 'staff']}>
                        {<PatientRegistration />}
                    </ProtectedRoute>
                }
            />

            <Route
                path="/staff/visit-queue"
                element={
                    <ProtectedRoute allowedRoles={['staff']}>
                        <VisitQueue />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/doctor/patients"
                element={
                    <ProtectedRoute allowedRoles={['doctor']}>
                        <PatientRecords />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/doctor/patients/:id/records"
                element={
                    <ProtectedRoute allowedRoles={['doctor']}>
                        <PatientMedicalRecords />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/doctor/consent"
                element={
                    <ProtectedRoute allowedRoles={['doctor']}>
                        <ConsentRequests />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/doctor/notes"
                element={
                    <ProtectedRoute allowedRoles={['doctor']}>
                        <ClinicalNotes />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/doctor/active-visits"
                element={
                    <ProtectedRoute allowedRoles={['doctor']}>
                        <ActiveVisits />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/patient/medical-records"
                element={
                    <ProtectedRoute allowedRoles={['patient']}>
                        <MedicalRecords />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/nurse/dashboard"
                element={
                    <ProtectedRoute allowedRoles={['nurse']}>
                        <NurseDashboard />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/nurse/patients"
                element={
                    <ProtectedRoute allowedRoles={['nurse']}>
                        <AssignedPatients />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/nurse/patients/:id/records"
                element={
                    <ProtectedRoute allowedRoles={['nurse']}>
                        <NursePatientRecords />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/nurse/medications"
                element={
                    <ProtectedRoute allowedRoles={['nurse']}>
                        <NurseMedications />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/nurse/profile"
                element={
                    <ProtectedRoute allowedRoles={['nurse']}>
                        <NurseProfile />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/nurse/vitals"
                element={
                    <ProtectedRoute allowedRoles={['nurse']}>
                        <NurseVitals />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/nurse/schedule"
                element={
                    <ProtectedRoute allowedRoles={['nurse']}>
                        <NurseSchedule />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/dashboard/lab"
                element={
                    <ProtectedRoute allowedRoles={['lab_tech', 'lab_technician']}>
                        <LabDashboard />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/radiology/dashboard"
                element={
                    <ProtectedRoute allowedRoles={['radiologist']}>
                        <RadiologistDashboard />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/radiology/queue"
                element={
                    <ProtectedRoute allowedRoles={['radiologist']}>
                        <ImagingQueue />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/radiology/upload"
                element={
                    <ProtectedRoute allowedRoles={['radiologist']}>
                        {<ReportUpload />}
                    </ProtectedRoute>
                }
            />

            <Route
                path="/admin/dashboard"
                element={
                    <ProtectedRoute allowedRoles={['admin', 'hospital_admin', 'system_admin']}>
                        <HospitalAdminDashboard />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/patient/visits/new"
                element={
                    <ProtectedRoute allowedRoles={['patient']}>
                        <NewVisit />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/patient/visits/schedule"
                element={
                    <ProtectedRoute allowedRoles={['patient']}>
                        <ScheduleNewVisit />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/patient/visits/verify-otp"
                element={
                    <ProtectedRoute allowedRoles={['patient']}>
                        {<VerifyVisitOTP />}
                    </ProtectedRoute>
                }
            />

            <Route
                path="/patient/audit-trail"
                element={
                    <ProtectedRoute allowedRoles={['patient']}>
                        <AuditTrail />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/admin/visits"
                element={
                    <ProtectedRoute allowedRoles={['admin', 'hospital_admin', 'system_admin']}>
                        <VisitManagement />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/admin/staff"
                element={
                    <ProtectedRoute allowedRoles={['admin', 'hospital_admin', 'system_admin']}>
                        <StaffManagement />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/admin/users"
                element={
                    <ProtectedRoute allowedRoles={['admin', 'hospital_admin', 'system_admin']}>
                        <UserManagement />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/admin/audit-logs"
                element={
                    <ProtectedRoute allowedRoles={['admin', 'hospital_admin', 'system_admin']}>
                        <AuditLogs />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/admin/doctor-registration"
                element={
                    <ProtectedRoute allowedRoles={['admin', 'hospital_admin', 'system_admin']}>
                        {<DoctorRegistration />}
                    </ProtectedRoute>
                }
            />

            <Route
                path="/admin/doctor-verification"
                element={
                    <ProtectedRoute allowedRoles={['admin', 'hospital_admin', 'system_admin']}>
                        {<DoctorVerification />}
                    </ProtectedRoute>
                }
            />

            <Route
                path="/receptionist/visits"
                element={
                    <ProtectedRoute allowedRoles={['receptionist']}>
                        <ReceptionistVisitManagement />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/staff/dashboard"
                element={
                    <ProtectedRoute allowedRoles={[
                        'staff',
                        'nurse',
                        'receptionist',
                        'pharmacist',
                        'insurance_provider',
                        'researcher',
                        'compliance_officer',
                        'admin',
                        'hospital_admin',
                        'system_admin'
                    ]}>
                        <StaffDashboard />
                    </ProtectedRoute>
                }
            />


            <Route
                path="/staff/workflow"
                element={
                    <ProtectedRoute allowedRoles={[
                        'staff', 'nurse', 'doctor', 'admin', 'hospital_admin', 'system_admin', 'receptionist'
                    ]}>
                        <WorkflowDashboard />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/patient/profile"
                element={
                    <ProtectedRoute allowedRoles={['patient', 'doctor', 'staff', 'nurse', 'lab_tech', 'lab_technician', 'radiologist', 'admin', 'hospital_admin', 'system_admin']}>
                        <Profile />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/profile"
                element={
                    <ProtectedRoute allowedRoles={['patient', 'doctor', 'staff', 'nurse', 'lab_tech', 'lab_technician', 'radiologist', 'admin', 'hospital_admin', 'system_admin', 'pharmacist', 'receptionist']}>
                        <Profile />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/radiology/profile"
                element={
                    <ProtectedRoute allowedRoles={['radiologist']}>
                        <RadiologistProfile />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/radiology/audit-logs"
                element={
                    <ProtectedRoute allowedRoles={['radiologist']}>
                        <RadiologistAuditLogs />
                    </ProtectedRoute>
                }
            />

            {/* Pharmacist Routes */}
            <Route
                path="/pharmacist/dashboard"
                element={
                    <ProtectedRoute allowedRoles={['pharmacist']}>
                        <PharmacistDashboard />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/pharmacist/prescriptions"
                element={
                    <ProtectedRoute allowedRoles={['pharmacist']}>
                        <PharmacistPrescriptionQueue />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/pharmacist/inventory"
                element={
                    <ProtectedRoute allowedRoles={['pharmacist']}>
                        <PharmacistInventory />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/pharmacist/profile"
                element={
                    <ProtectedRoute allowedRoles={['pharmacist']}>
                        <PharmacistProfile />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/pharmacist/audit-logs"
                element={
                    <ProtectedRoute allowedRoles={['pharmacist']}>
                        <PharmacistAuditLogs />
                    </ProtectedRoute>
                }
            />

            {/* Compliance Officer Routes */}
            <Route
                path="/compliance/dashboard"
                element={
                    <ProtectedRoute allowedRoles={['compliance_officer']}>
                        <ComplianceDashboard />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/compliance/global-audits"
                element={
                    <ProtectedRoute allowedRoles={['compliance_officer']}>
                        <GlobalAuditLogs />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/compliance/incidents"
                element={
                    <ProtectedRoute allowedRoles={['compliance_officer']}>
                        <Incidents />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/compliance/consent-overrides"
                element={
                    <ProtectedRoute allowedRoles={['compliance_officer']}>
                        <ConsentOverrides />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/compliance/profile"
                element={
                    <ProtectedRoute allowedRoles={['compliance_officer']}>
                        <ComplianceProfile />
                    </ProtectedRoute>
                }
            />

            {/* Insurance Routes */}
            <Route
                path="/insurance/dashboard"
                element={
                    <ProtectedRoute allowedRoles={['insurance', 'insurance_provider']}>
                        <InsuranceDashboard />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/insurance/claims"
                element={
                    <ProtectedRoute allowedRoles={['insurance', 'insurance_provider']}>
                        <InsuranceClaimsManagement />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/insurance/coverage"
                element={
                    <ProtectedRoute allowedRoles={['insurance', 'insurance_provider']}>
                        <InsuranceCoverageVerification />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/insurance/policyholders"
                element={
                    <ProtectedRoute allowedRoles={['insurance', 'insurance_provider']}>
                        <InsurancePolicyholders />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/insurance/profile"
                element={
                    <ProtectedRoute allowedRoles={['insurance', 'insurance_provider']}>
                        <InsuranceProfile />
                    </ProtectedRoute>
                }
            />

            {/* Researcher Routes */}
            <Route
                path="/researcher/dashboard"
                element={
                    <ProtectedRoute allowedRoles={['researcher']}>
                        <ResearcherDashboard />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/researcher/explorer"
                element={
                    <ProtectedRoute allowedRoles={['researcher']}>
                        <ResearcherDataExplorer />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/researcher/profile"
                element={
                    <ProtectedRoute allowedRoles={['researcher']}>
                        <ResearcherProfile />
                    </ProtectedRoute>
                }
            />

            <Route path="/lab/dashboard" element={<Navigate to="/dashboard/lab" replace />} />
            <Route path="/unauthorized" element={<div className="p-8 text-center text-rose-500 font-bold">Unauthorized Access</div>} />

            {/* Default redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
            <Route path="/" element={<LandingPage />} />
        </Routes>
        </Suspense>
    );
}
export default AppRoutes;
