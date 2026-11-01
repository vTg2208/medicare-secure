# API Documentation

## Landing Page
**URL:** `/`

**Backend APIs Needed:**
1. **GET `/health`**
   - **Explanation:** Verify backend services and DB connection are running before allowing login/signup.
   - **Data Format required:**
     ```json
     { "status": "UP", "database": "CONNECTED", "version": "1.0.0" }
     ```

2. **GET `/public/stats`**
   - **Explanation:** Show marketing data (hospitals count, patients managed).
   - **Data Format required:**
     ```json
     { "success": true, "data": { "hospitalsCount": 45, "patientsManaged": 12000 } }
     ```

## Login Page
**URL:** `/login`

**Backend APIs Needed:**
1. **POST `/api/v1/auth/login`**
   - **Explanation:** Authenticate with email and password. Returns access token and user role.
   - **Data Format required:**
     ```json
     { "success": true, "data": { "user": { "id": "uuid", "email": "user@email.com", "role": "PATIENT" }, "accessToken": "ey..." } }
     ```

2. **POST `/api/v1/auth/passkey/login/options`**
   - **Explanation:** Returns WebAuthn challenge options for passkey authentication.
   - **Data Format required:**
     ```json
     { "success": true, "data": { "challenge": "...", "timeout": 60000, "rpId": "localhost", "allowCredentials": [], "userVerification": "preferred" } }
     ```

3. **POST `/api/v1/auth/passkey/login/verify`**
   - **Explanation:** Verifies the signed passkey credential and logs the user in.
   - **Data Format required:**
     ```json
     { "success": true, "data": { "user": { "id": "uuid", "email": "user@email.com", "role": "PATIENT" }, "accessToken": "ey..." } }
     ```

4. **POST `/api/v1/auth/logout`**
   - **Explanation:** Logs out the current user session.
   - **Data Format required:**
     ```json
     { "success": true, "message": "Logged out" }
     ```

## Registration Page
**URL:** `/register`

**Backend APIs Needed:**
1. **POST `/api/v1/auth/register/patient`**
   - **Explanation:** Registers a new patient and triggers OTP verification.
   - **Data Format required:**
     ```json
     { "success": true, "message": "OTP sent to patient@example.com" }
     ```

2. **POST `/api/v1/auth/otp/verify`**
   - **Explanation:** Verifies OTP sent during registration to activate the account.
   - **Data Format required:**
     ```json
     { "success": true, "message": "OTP verified successfully" }
     ```

## Patient Dashboard
**URL:** `/patient/dashboard`

**Backend APIs Needed (Mocked):**
1. **GET `/api/v1/patient/profile`**
   - **Explanation:** Retrieves basic profile info of the logged-in patient.
   - **Data Format required:**
     ```json
     { "success": true, "data": { "id": "uuid", "firstName": "John", "lastName": "Doe" } }
     ```

2. **GET `/api/v1/patient/health-facts`**
   - **Explanation:** Returns 3 daily health facts (heart rate, nutrition, sleep).
   - **Data Format required:**
     ```json
     { "success": true, "data": [{ "title": "Vital Monitoring", "description": "Stable heart rate recorded last 24h." }] }
     ```

3. **GET `/api/v1/patient/activities`**
   - **Explanation:** Returns recent history (diagnoses, visits, prescriptions).
   - **Data Format required:**
     ```json
     { "success": true, "data": [{ "id": "act-1", "type": "Diagnosis", "title": "Stable Recovery", "date": "2025-10-12T10:00:00Z", "colorClass": "bg-indigo-500", "borderColorClass": "border-indigo-500/30" }] }
     ```

## Patient Profile Page
**URL:** `/patient/profile`

**Backend APIs Needed (Mocked):**
1. **GET `/api/v1/users/profile`**
   - **Explanation:** Retrieves the current logged-in user's full profile.
   - **Data Format required:**
     ```json
     { "success": true, "data": { "user": { "id": "uuid", "firstName": "John", "lastName": "Doe", "email": "patient@medicare.com", "phone": "+1 234 567 890", "role": "PATIENT", "status": "active" } } }
     ```

2. **PUT `/api/v1/users/profile`**
   - **Explanation:** Updates the current user's profile fields (firstName, lastName, phone).
   - **Request Body:** `{ "firstName": "John", "lastName": "Doe", "phone": "+1 234 567 890" }`
   - **Data Format required:**
     ```json
     { "success": true, "data": { "id": "uuid", "firstName": "John", "lastName": "Doe", "email": "patient@medicare.com", "phone": "+1 234 567 890" } }
     ```

## Visits Management
**URL:** `/patient/visits`

**Backend APIs Needed (Mocked):**
1. **GET `/api/v1/visits/my-visits`**
   - **Explanation:** Retrieves all visits for the logged-in patient.
   - **Data Format required:**
     ```json
     { "success": true, "data": [{ "id": "visit-1", "visit_code": "123456", "organization_name": "Medicare General Hospital", "doctor_first_name": "Sarah", "doctor_last_name": "Smith", "reason": "Regular Checkup", "scheduled_time": "2025-12-31T00:00:00.000Z", "status": "scheduled" }] }
     ```

2. **POST `/api/v1/visits/check-in`**
   - **Explanation:** Checks a patient into a visit using a visit code (from QR scan or manual entry).
   - **Request Body:** `{ "visitCode": "123456" }`
   - **Data Format required:**
     ```json
     { "success": true, "data": { "visitId": "uuid", "visitCode": "123456", "status": "checked_in", "hospitalName": "Medicare General Hospital" } }
     ```

3. **POST `/api/v1/visits/request`**
   - **Explanation:** Creates a new visit request.
   - **Data Format required:**
     ```json
     { "success": true, "data": { "id": "uuid", "status": "pending" } }
     ```

## Consent Management
**URL:** `/patient/consent`

**Backend APIs Needed (Mocked):**
1. **GET `/api/v1/consent/active`**
   - **Explanation:** Returns all currently active consents granted by the patient.
   - **Data Format required:**
     ```json
     [{ "id": "consent-1", "hospitalName": "Medicare General Hospital", "doctorName": "Dr. Sarah Smith", "grantedAt": "2025-01-01T00:00:00.000Z", "expiresAt": "2025-01-06T00:00:00.000Z", "status": "active", "permissions": [{ "recordType": "Consultation", "accessLevel": "read" }] }]
     ```

2. **GET `/api/v1/consent/history`**
   - **Explanation:** Returns past/expired consents for the patient.
   - **Data Format required:**
     ```json
     [{ "id": "consent-old-1", "hospitalName": "City Clinic", "doctorName": "Dr. James Lee", "grantedAt": "...", "expiresAt": "...", "status": "expired", "permissions": [] }]
     ```

3. **POST `/api/v1/consent/grant`**
   - **Explanation:** Grants a new consent (used both from the Grant Consent QR screen and the manual form).
   - **Request Body:** `{ "hospitalId": "hosp-123", "hospitalName": "Medicare General Hospital", "durationHours": 2, "durationMinutes": 0, "permissions": [{ "recordType": "Consultation", "accessLevel": "read" }] }`
   - **Data Format required:**
     ```json
     { "success": true, "data": { "id": "consent-uuid", "status": "active", "grantedAt": "...", "expiresAt": "..." } }
     ```

4. **PUT `/api/v1/consent/:consentId`**
   - **Explanation:** Updates an existing consent (permissions or duration).
   - **Data Format required:**
     ```json
     { "success": true, "message": "Consent updated" }
     ```

5. **PUT `/api/v1/consent/revoke/:consentId`**
   - **Explanation:** Revokes an active consent immediately.
   - **Data Format required:**
     ```json
     { "success": true, "message": "Consent revoked" }
     ```

## Medical Records
**URL:** `/patient/medical-records`

**Backend APIs Needed (Mocked):**
1. **GET `/api/v1/emr/patients/:patientId/medical-records`**
   - **Explanation:** Returns all medical records for a patient (filterable by type on the frontend).
   - **Data Format required:**
     ```json
     { "success": true, "data": { "records": [{ "id": "rec-1", "type": "consultation", "title": "Annual Physical Examination", "description": "...", "created_by_name": "Dr. Sarah Smith", "created_by_role": "DOCTOR", "created_at": "2025-01-01T00:00:00.000Z" }] } }
     ```
   - **Record types:** `consultation`, `diagnosis`, `prescription`, `lab_result`, `imaging`, `procedure`, `note`

## Audit Trail
**URL:** `/patient/audit-trail`

**Backend APIs Needed (Mocked):**
1. **GET `/api/v1/audit/my-trail`**
   - **Explanation:** Returns a paginated list of audit log entries — who accessed the patient's data and when.
   - **Query Params (optional):** `startDate`, `endDate`, `action`, `limit`, `offset`
   - **Action values:** `user_login`, `view_patient_records`, `consent_grant`, `consent_revoke`, `consent_view`, `consent_expired`, `create_visit`, `approve_visit`
   - **Data Format required:**
     ```json
     { "success": true, "data": { "logs": [{ "id": "log-1", "action": "consent_grant", "userFirstName": "Sarah", "userLastName": "Smith", "userEmail": "dr.sarah@medicare.com", "userRole": "DOCTOR", "timestamp": "2025-12-31T10:00:00.000Z", "purpose": "Pre-surgery consultation access" }], "pagination": { "total": 4, "pages": 1, "limit": 50, "offset": 0 } } }
     ```

## Session Management (all pages)
1. **GET `/api/v1/auth/verify`**
   - **Explanation:** Verifies the current session token. Called on every page load to keep the user authenticated.
   - **Data Format required:**
     ```json
     { "success": true, "data": { "user": { "id": "uuid", "email": "user@email.com", "role": "PATIENT" } } }
     ```



2. **GET `/public/stats` (Optional for future)**
   - **Explanation:** To show marketing data such as the number of hospitals currently using the system securely.
   - **Data Format required:**
     ```json
     {
       "data": {
         "hospitalsCount": 45,
         "patientsManaged": 12000
       },
       "success": true
     }
     ```

## Login Page
**URL:** `/login`

**Backend APIs Needed:**
1. **POST `/api/v1/auth/login`**
   - **Explanation:** Authenticates standard user credentials (email and password) to obtain an access token and user role.
   - **Data Format required:**
     ```json
     {
       "success": true,
       "data": {
         "user": {
           "id": "uuid",
           "email": "user@email.com",
           "role": "PATIENT | DOCTOR | NURSE | RADIOLOGIST | PHARMACIST | COMPLIANCE_OFFICER | ADMIN"
         },
         "accessToken": "ey..."
       }
     }
     ```

2. **POST `/api/v1/auth/passkey/login-options`**
   - **Explanation:** Retrieves the WebAuthn challenge options needed for passkey authentication from the server.
   - **Data Format required:**
     ```json
     {
       "success": true,
       "data": {
         // Standard PublicKeyCredentialRequestOptions JSON
       }
     }
     ```

3. **POST `/api/v1/auth/passkey/login-verify`**
   - **Explanation:** Verifies the signed passkey credential submitted by the browser and logs the user in.
   - **Data Format required:**
     ```json
     {
       "success": true,
       "data": {
         "user": {
           "id": "uuid",
           "email": "user@email.com",
           "role": "PATIENT | DOCTOR | NURSE | RADIOLOGIST | PHARMACIST | COMPLIANCE_OFFICER | ADMIN"
         },
         "accessToken": "ey..."
       }
     }
     ```

## Registration Page
**URL:** `/register`

**Backend APIs Needed:**
1. **POST `/api/v1/auth/register/patient`**
   - **Explanation:** Registers a new patient into the system and triggers an OTP verification flow.
   - **Data Format required:**
     ```json
     {
       "success": true,
       "message": "OTP sent to patient@example.com"
     }
     ```

2. **POST `/api/v1/auth/otp/verify`**
   - **Explanation:** Verifies the OTP sent to the patient during registration to activate the account.
   - **Data Format required:**
     ```json
     {
       "success": true,
       "message": "OTP verified successfully"
     }
     ```

## Patient Dashboard UI
**URL:** `/patient/dashboard`

**Backend APIs Needed (Mocked):**
1. **GET `/api/v1/patient/profile`**
   - **Explanation:** Retrieves the standard basic profile info of the logged in patient.
   - **Data Format required:**
     ```json
     {
       "success": true,
       "data": {
           "id": "uuid",
           "firstName": "John",
           "lastName": "Doe"
       }
     }
     ```

2. **GET `/api/v1/patient/health-facts`**
   - **Explanation:** Returns 3 small daily facts based on patient data (heart rate, nutrition, sleep).
   - **Data Format required:**
     ```json
     {
       "success": true,
       "data": [
            {
               "title": "Vital Monitoring",
               "description": "Stable heart rate and blood pressure recorded last 24h."
            }
       ]
     }
     ```

3. **GET `/api/v1/patient/activities`**
   - **Explanation:** Returns recent history (diagnoses, hospital visits, prescriptions).
   - **Data Format required:**
     ```json
     {
       "success": true,
       "data": [
            {
               "id": "act-1",
               "type": "Diagnosis",
               "title": "Stable Recovery (Post-Op)",
               "date": "2025-10-12T10:00:00Z",
               "colorClass": "bg-indigo-500",
               "borderColorClass": "border-indigo-500/30"
            }
       ]
     }
     ```

## Visits Management APIs (Mocked)
1. **GET `/api/v1/visits/my-visits`**
   - **Explanation:** Retrieves the visits specific to the patient.
   - **Data Format required:**
     ```json
     {
       "success": true,
       "data": [
            {
               "id": "visit-1",
               "visit_code": "123456",
               "organization_name": "Medicare General Hospital",
               "doctor_first_name": "Sarah",
               "doctor_last_name": "Smith",
               "reason": "Regular Checkup",
               "scheduled_time": "2025-12-31T00:00:00.000Z",
               "status": "scheduled"
            }
       ]
     }
     ```

## Audit Trail APIs (Mocked)
1. **GET `/api/v1/audit/my-trail`**
   - **Explanation:** Returns a paginated list of audit log entries for the current patient — who accessed their data and when.
   - **Query Params (optional):** `startDate`, `endDate`, `action`, `limit`, `offset`
   - **Data Format required:**
     ```json
     {
       "success": true,
       "data": {
         "logs": [
           {
             "id": "log-1",
             "action": "consent_grant",
             "userFirstName": "Sarah",
             "userLastName": "Smith",
             "userEmail": "dr.sarah@medicare.com",
             "userRole": "DOCTOR",
             "timestamp": "2025-12-31T10:00:00.000Z",
             "purpose": "Pre-surgery consultation access"
           }
         ],
         "pagination": { "total": 4, "pages": 1, "limit": 50, "offset": 0 }
       }
     }
     ```

## Nurse Workflow APIs (Mocked)
1. **GET `/api/v1/nurse/stats`**
   - **Explanation:** Returns top-level statistics for the logged-in nurse dashboard.
   - **Data Format required:**
     ```json
     {
       "success": true,
       "data": {
           "assignedPatients": 14,
           "vitalsRecorded": 32,
           "careTasks": 8,
           "observations": 5
       }
     }
     ```

2. **GET `/api/v1/nurse/assigned-patients`**
   - **Explanation:** Returns a list of patients currently assigned to the nurse.
   - **Data Format required:**
     ```json
     {
       "success": true,
       "data": [
           {
               "id": "pat-1",
               "firstName": "Robert",
               "lastName": "Fox",
               "room": "101-A",
               "condition": "Post-Op Recovery",
               "nextCheck": "2025-12-31T10:30:00.000Z",
               "status": "stable"
           }
       ]
     }
     ```

3. **GET `/api/v1/nurse/activities`**
   - **Explanation:** Returns a recent activity feed for actions performed by the nurse.
   - **Data Format required:**
     ```json
     {
       "success": true,
       "data": [
           {
               "id": "n-act-1",
               "type": "Vitals Recorded",
               "title": "Vitals taken for Robert Fox",
               "date": "2025-12-31T09:00:00.000Z",
               "colorClass": "bg-teal-500",
               "borderColorClass": "border-teal-500/30"
           }
       ]
     }
     ```

4. **GET `/api/v1/nurse/patients/:patientId/records`**
   - **Explanation:** Returns isolated medical records specifically visible to nurses (e.g., vitals, notes, observations).
   - **Data Format required:**
     ```json
     {
       "success": true,
       "data": [
           {
               "id": "rec-n1-pat1",
               "type": "observation",
               "title": "Shift Observation",
               "description": "Patient is resting comfortably...",
               "created_at": "2025-12-31T09:00:00.000Z",
               "created_by_name": "Nurse Sarah",
               "created_by_role": "RN"
           }
       ]
     }
     ```

5. **POST `/api/v1/nurse/patients/:patientId/records`**
   - **Explanation:** Allows a nurse to create a new specific medical record (types: vitals, observation, input_action).
   - **Request Body:** `{ "type": "vitals", "title": "Vitals Check", "description": "BP: 120/80..." }`
   - **Data Format required:**
     ```json
     {
       "success": true,
       "message": "Record created successfully",
       "data": {
           "id": "rec-n-new-12345",
           "type": "vitals",
           "title": "Vitals Check",
           "description": "BP: 120/80...",
           "created_at": "2025-12-31T10:00:00.000Z",
           "created_by_name": "Current Nurse",
           "created_by_role": "RN"
       }
     }
     ```

6. **GET `/api/v1/nurse/medications`**
   - **Explanation:** Returns a list of all medications due for the nurse's assigned patients during their active shift.
   - **Data Format required:**
     ```json
     {
       "success": true,
       "data": [
           {
               "id": "med-1",
               "patientId": "pat-1",
               "patientName": "Robert Fox",
               "room": "101-A",
               "medicationName": "Amoxicillin",
               "dosage": "500mg",
               "route": "Oral",
               "scheduledTime": "2025-12-31T09:00:00.000Z",
               "status": "pending"
           }
       ]
     }
     ```

7. **PUT `/api/v1/nurse/medications/:medicationId/status`**
   - **Explanation:** Allows a nurse to update the administration status of a particular medication.
   - **Request Body:** `{ "status": "administered", "notes": "Patient took med with water." }`
   - **Data Format required:**
     ```json
     {
       "success": true,
       "message": "Medication med-1 marked as administered",
       "data": {
           "id": "med-1",
           "status": "administered",
           "notes": "Patient took med with water.",
           "updatedAt": "2025-12-31T09:05:00.000Z"
       }
     }
     ```

8. **GET `/api/v1/nurse/profile`**
   - **Explanation:** Returns the detailed profile information for the authenticated nurse.
   - **Data Format required:**
     ```json
     {
       "success": true,
       "data": {
           "id": "nurse-789",
           "firstName": "Sarah",
           "lastName": "Jenkins",
           "role": "Registered Nurse",
           "employeeId": "RN-2024-56789",
           "department": "General Medicine",
           "email": "sarah.jenkins@medicare.com",
           "phone": "+1 (555) 123-4567",
           "status": "Active",
           "joinedDate": "2020-03-15",
           "licenseNumber": "RN987654321",
           "address": "123 Healthcare Ave...",
           "emergencyContact": { "name": "Michael Jenkins", "relationship": "Spouse", "phone": "+1..." },
           "assignedWards": ["Ward A (East Wing)", "Ward B (West Wing)"],
           "shiftPreference": "Day Shift (07:00 - 19:00)"
       }
     }
     ```

9. **PUT `/api/v1/nurse/profile`**
   - **Explanation:** Updates the nurse's profile details (phone, address, emergency contact).
   - **Request Body:** `{ "phone": "+1 222-3333", "address": "New Address" }`
   - **Data Format required:**
     ```json
     {
       "success": true,
       "message": "Profile updated successfully",
       "data": { ...updated profile object... }
     }
     ```

## Radiology Endpoints

1. **GET `/api/v1/radiology/stats`**
   - **Explanation:** Returns dashboard statistics like pending reads and priority cases.
   - **Response:**
     ```json
     {
       "success": true,
       "data": {
           "pendingReads": 14,
           "inProgress": 3,
           "completedToday": 28,
           "priorityCases": 2
       }
     }
     ```

2. **GET `/api/v1/radiology/orders`**
   - **Explanation:** Retrieves a list of imaging orders in the queue. Allows filtering by `status` and `priority`.
   - **Response:**
     ```json
     {
       "success": true,
       "count": 5,
       "data": [
         {
           "id": "img-req-001",
           "visitId": "VST-2024-0891",
           "imagingType": "MRI",
           "status": "pending"
         }
       ]
     }
     ```

3. **POST `/api/v1/radiology/upload`**
   - **Explanation:** Uploads an imaging report securely via multipart/form-data.
   - **Response:**
     ```json
     {
       "success": true,
       "message": "Imaging report securely uploaded and cryptographically signed.",
       "reportId": "rep-12345"
     }
     ```

4. **GET `/api/v1/radiology/profile`**
   - **Explanation:** Returns the detailed profile information for the authenticated radiologist.
   - **Response:**
     ```json
     {
       "success": true,
       "data": {
           "id": "rad-101",
           "firstName": "Rajesh",
           "role": "Senior Radiologist",
           "email": "radiologist@medicare.com",
           "status": "Active"
       }
     }
     ```

5. **PUT `/api/v1/radiology/profile`**
   - **Explanation:** Updates the radiologist's profile details.
   - **Request Body:** `{ "phone": "+1 222-3333", "address": "New Address" }`
   - **Response:**
     ```json
     {
       "success": true,
       "message": "Profile updated successfully",
       "data": { ...updated profile object... }
     }
     ```

6. **GET `/api/v1/radiology/audit-logs`**
   - **Explanation:** Retrieves security audit logs for radiological data access and activities.
   - **Response:**
     ```json
     {
       "success": true,
       "data": [
         {
           "id": "AL-1004",
           "timestamp": "2024-03-08T10:15:30Z",
           "action": "REPORT_SIGNED",
           "ip": "192.168.1.55",
           "details": "Signed MRI report for Order ORD-4829"
         }
       ]
     }
     ```
## Pharmacist Portal

**Backend APIs Needed (Mocked):**
1. **GET `/api/v1/pharmacist/stats`**
   - **Explanation:** Returns dashboard metrics for the pharmacist.
   - **Data Format required:**
     ```json
     { "success": true, "data": { "pendingPrescriptions": 12, "dispensedToday": 48, "lowStockAlerts": 3, "refillRequests": 5 } }
     ```

2. **GET `/api/v1/pharmacist/prescriptions`**
   - **Explanation:** Retrieves the queue of prescriptions (supports status filtering).
   - **Data Format required:**
     ```json
     { "success": true, "data": [{ "id": "rx-2024-001", "patientName": "Robert Fox", "medication": "Amoxicillin 500mg", "dosage": "1 capsule three times daily for 7 days", "prescribedBy": "Dr. Sarah Smith", "status": "pending" }] }
     ```

3. **PUT `/api/v1/pharmacist/prescriptions/:id/dispense`**
   - **Explanation:** Updates the status of a specific prescription to "dispensed".
   - **Data Format required:**
     ```json
     { "success": true, "message": "Prescription rx-2024-001 marked as dispensed." }
     ```

4. **GET `/api/v1/pharmacist/inventory`**
   - **Explanation:** Returns current medication inventory levels.
   - **Data Format required:**
     ```json
     { "success": true, "data": [{ "id": "inv-101", "name": "Amoxicillin 500mg", "genericName": "Amoxicillin", "stock": 450, "status": "In Stock", "location": "Aisle 2, Shelf B" }] }
     ```

5. **GET `/api/v1/pharmacist/profile`**
   - **Explanation:** Returns generic provider personal and contact info.
   - **Data Format required:**
     ```json
     { "success": true, "data": { "id": "pharm-456", "firstName": "Aisha", "lastName": "Patel", "role": "Lead Pharmacist", "email": "pharmacist@medicare.com", "phone": "+1 (555) 777-8899" } }
     ```

6. **PUT `/api/v1/pharmacist/profile`**
   - **Explanation:** Updates the generic provider profile.
   - **Data Format required:**
     ```json
     { "success": true, "message": "Profile updated successfully", "data": { "id": "pharm-456", "email": "pharmacist@medicare.com", "phone": "new phone number" } }
     ```

7. **GET `/api/v1/pharmacist/audit-logs`**
   - **Explanation:** Returns audit logs for the pharmacist's activities.
   - **Data Format required:**
     ```json
     { "success": true, "data": [{ "id": "PAL-2005", "timestamp": "2024-03-08T10:00:00.000Z", "action": "RX_DISPENSED", "ip": "192.168.1.60", "details": "Dispensed Amoxicillin 500mg for Patient PAT-8819" }] }
     ```

## Compliance Portal

**Backend APIs Needed (Mocked):**
1. **GET `/api/v1/compliance/dashboard`**
   - **Explanation:** Returns dashboard metrics for the compliance officer.
   - **Data Format required:**
     ```json
     { "success": true, "data": { "authAnomalies": 3, "openIncidents": 5, "activeOverrides": 2, "pendingReviews": 12 } }
     ```

2. **GET `/api/v1/compliance/global-audits`**
   - **Explanation:** Retrieves a system-wide view of all audit logs.
   - **Data Format required:**
     ```json
     { "success": true, "data": [{ "id": "AUD-9905", "timestamp": "2025-01-01T10:00:00.000Z", "user": "Sarah Jenkins (NURSE)", "action": "VIEW_RECORD", "details": "Accessed vitals history for PAT-8819", "status": "Success" }] }
     ```

3. **GET `/api/v1/compliance/incidents`**
   - **Explanation:** Returns reported security and privacy incidents.
   - **Data Format required:**
     ```json
     { "success": true, "data": [{ "id": "INC-2024-001", "date": "2025-01-01T10:00:00.000Z", "type": "Unauthorized Access", "reporter": "Automated System", "status": "Investigating", "description": "Multiple failed login attempts detected..." }] }
     ```

4. **PUT `/api/v1/compliance/incidents/:id`**
   - **Explanation:** Updates the status of a specific security incident.
   - **Data Format required:**
     ```json
     { "success": true, "message": "Incident INC-2024-001 updated to Resolved." }
     ```

5. **GET `/api/v1/compliance/consent-overrides`**
   - **Explanation:** Returns a list of emergency consent overrides by doctors ("glass breaks").
   - **Data Format required:**
     ```json
     { "success": true, "data": [{ "id": "OVR-501", "date": "2025-01-01T10:00:00.000Z", "doctor": "Dr. Sarah Smith", "patientId": "PAT-9002", "reason": "Medical Emergency (Cardiac Arrest)", "status": "Pending Review" }] }
     ```

6. **GET`/api/v1/compliance/profile`**
   - **Explanation:** Returns compliance officer personal and contact info.
   - **Data Format required:**
     ```json
     { "success": true, "data": { "id": "comp-999", "firstName": "Robert", "lastName": "Oppenheimer", "role": "Chief Compliance Officer", "email": "compliance@medicare.com", "phone": "+1 (555) 999-0000" } }
     ```

7. **PUT `/api/v1/compliance/profile`**
   - **Explanation:** Updates the compliance officer profile.
   - **Data Format required:**
     ```json
     { "success": true, "message": "Profile updated successfully", "data": { "id": "comp-999", "email": "compliance@medicare.com", "phone": "new phone number" } }
     ```

## Insurance API
**Base URL:** `/api/v1/insurance`
**Headers:** `Authorization: Bearer <token>`

### 1. Dashboard Stats
**Endpoint:** `GET /dashboard`
- **Description:** Returns aggregate claim statistics for the insurance dashboard.
- **Response Format:**
  ```json
  {
    "success": true,
    "data": {
      "pendingClaims": 2,
      "approvedClaims": 1,
      "deniedClaims": 1,
      "totalPayout": "350.50",
      "activePolicies": 12,
      "recentClaims": []
    }
  }
  ```

### 2. Claims Management
**Endpoint:** `GET /claims`
- **Description:** Returns a list of all hospital claims.
- **Response Format:**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "CLM-001",
        "patientName": "John Doe",
        "policyNumber": "POL-123456",
        "diagnosis": "Hypertension",
        "amount": 150.00,
        "status": "Pending",
        "submittedAt": "2026-03-01T10:00:00Z"
      }
    ]
  }
  ```

**Endpoint:** `PUT /claims/:id`
- **Description:** Updates the status (Approved/Denied/Pending) of a claim.
- **Request Body:**
  ```json
  {
    "status": "Approved",
    "notes": "Optional reason for denial or approval"
  }
  ```
- **Response Format:** Returns the updated claim object.

### 3. Coverage Verification
**Endpoint:** `GET /coverage/verify`
- **Description:** Checks if a policyholder is active.
- **Query Params:** `?memberId=PH-001` or `?policyNumber=POL-123456`
- **Response Format:**
  ```json
  {
    "success": true,
    "data": {
      "covered": true,
      "policyDetails": {
        "id": "PH-001",
        "name": "John Doe",
        "policyNumber": "POL-123456",
        "type": "Premium",
        "status": "Active",
        "coverageStart": "2025-01-01",
        "coverageEnd": "2026-12-31"
      },
      "copay": 25.00,
      "deductibleUsed": 1500.00,
      "deductibleTotal": 5000.00
    }
  }
  ```

### 4. Policyholders Directory
**Endpoint:** `GET /policyholders`
- **Description:** Returns a directory of all policyholders under this company.
- **Response Format:** Array of policyholder objects.

### 5. Profile Management
**Endpoint:** `GET /profile`
**Endpoint:** `PUT /profile`
- **Description:** Handles retrieving and updating the logged-in agent's profile details.

## Researcher Portal
**Base URL:** `/api/v1/research`

### 1. Research Stats
**Endpoint:** `GET /stats`
- **Description:** Overview of data volume in the system.
- **Response Format:**
  ```json
  { "success": true, "data": { "totalRecords": 125430, "activeStudies": 12, "anonymizedPatients": 45200, "dataPointsCollected": 850024 } }
  ```

### 2. Symptoms Data
**Endpoint:** `GET /symptoms`
- **Description:** Aggregated symptom frequency across anonymized patients.
- **Response Format:**
  ```json
  { "success": true, "data": [ { "name": "Fatigue", "count": 1250, "severityAvg": 4.2 } ] }
  ```

### 3. Treatments Data
**Endpoint:** `GET /treatments`
- **Description:** Aggregated efficacy and usage of prescribed treatments.
- **Response Format:**
  ```json
  { "success": true, "data": [ { "name": "Amoxicillin", "successRate": 85, "usageCount": 5400 } ] }
  ```

### 4. Demographics
**Endpoint:** `GET /demographics`
- **Description:** De-identified distribution of patient age ranges and gender.
- **Response Format:**
  ```json
  { "success": true, "data": { "ageGroups": [ { "range": "0-18", "percentage": 15 } ], "gender": [ { "category": "Male", "percentage": 48 } ] } }
  ```

### 5. Profile Management
**Endpoint:** `GET /profile`
**Endpoint:** `PUT /profile`
- **Description:** Handles getting and updating the researcher profile details.

