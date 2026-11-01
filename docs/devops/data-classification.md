# Data Classification Policy — Secure Healthcare Management System

## Document Control

| Field | Value |
|---|---|
| Version | 1.0 |
| Created | 2026-02-28 |
| Owner | DevOps / Security / Compliance Engineering |
| Review Cadence | Semi-annually or after schema changes |
| Status | Active |

---

## 1. Purpose

Define data classification levels, identify all data assets in the system, and specify the required security controls for each classification. This document drives encryption, access control, retention, masking, and audit decisions across all DevOps phases.

---

## 2. Classification Levels

| Level | Label | Description | Regulatory Scope |
|---|---|---|---|
| **L4** | PHI (Protected Health Information) | Clinical or health-linked personal data | HIPAA §164.312, GDPR Art. 9 |
| **L3** | PII (Personally Identifiable Information) | Personal identifiers not directly clinical | GDPR Art. 5, HIPAA §164.514 |
| **L2** | Internal / Operational | Non-public operational data | Internal policy |
| **L1** | Public | Publicly shareable, non-sensitive | Integrity controls only |

---

## 3. Data Inventory by Classification

### L4 — PHI

| Data Element | Database Table(s) | Access Scope | Controls |
|---|---|---|---|
| Diagnoses | `diagnoses` | Treating doctor, care team | RBAC + ABAC + consent, encryption at rest, audit log |
| Prescriptions | `prescriptions` | Treating doctor, care team, pharmacy | RBAC + ABAC + consent, encryption at rest, audit log |
| Lab orders & results | `lab_orders`, `lab_results` | Ordering doctor, lab staff, care team | RBAC + ABAC + consent, audit log |
| Imaging orders & reports | `imaging_orders`, `imaging_reports` | Ordering doctor, radiology, care team | RBAC + ABAC + consent, audit log |
| Medication orders | `medication_orders` | Treating doctor, pharmacy, nurse | RBAC + ABAC + consent, audit log |
| Visit notes / clinical notes | `medical_records` | Treating doctor, care team | RBAC + ABAC + consent, immutability (amendments only), audit log |
| Visit records | `visits` | Treating doctor, front desk, care team | RBAC, audit log |
| Consent records | `consents` | Patient, admin, treating doctor | Integrity-critical, tamper-evident, audit log |

**Required Controls for L4:**
- Encryption at rest (PostgreSQL TDE or volume encryption)
- Encryption in transit (TLS 1.2+)
- RBAC + ABAC + consent verification before access
- Immutable audit trail with hash chain
- Data masking in non-production environments
- Retention: minimum 6 years (HIPAA), subject to jurisdiction
- Right to access / portability (GDPR Art. 15, 20)
- Anonymization for research use

### L3 — PII

| Data Element | Database Table(s) | Access Scope | Controls |
|---|---|---|---|
| Patient name, DOB, gender | `patients` | Front desk, treating team, admin | RBAC, masking in logs/non-prod |
| Patient address, phone, email | `patients` | Front desk, admin | RBAC, masking in responses by role |
| Government ID (hashed) | `patients` | Admin only | Hashed storage, never displayed in full |
| Emergency contact info | `patients` | Front desk, treating team | RBAC, masking |
| Staff name, email, phone | `users` | Admin, self | RBAC |
| Staff credentials (hashed) | `users` | System only | bcrypt hash, never exposed |
| Passkey/WebAuthn credentials | `passkey_credentials` | System only | Stored as binary, never exposed |

**Required Controls for L3:**
- Encryption in transit (TLS 1.2+)
- RBAC-scoped access
- Pseudonymization / masking in non-production
- Masking middleware for API responses based on role
- Retention: per GDPR data minimization / organizational policy
- Right to erasure where legally permissible (GDPR Art. 17)

### L2 — Internal / Operational

| Data Element | Storage | Access Scope | Controls |
|---|---|---|---|
| Audit logs | `audit_logs` | Security team, compliance, admin | Immutable, hash-chain verified, append-only |
| Access violation records | `access_violations` | Security team, admin | Role-scoped, alerting |
| Staff-org mappings | `staff_org_mappings` | Admin | RBAC |
| Roles, permissions config | `roles` | System admin | Change-tracked, audit log |
| Bed allocations | `bed_allocations` | Nurse, admin | RBAC |
| Care team assignments | `care_teams` | Treating team, admin | RBAC |
| Service configurations | `.env`, config files | DevOps | Encrypted at rest, access-controlled |
| Application logs | `/app/logs/` | DevOps, SRE | Retention policy, no PHI/PII in logs |
| Verification documents | `verification_documents`, `/uploads/` | Admin, HR | Encrypted storage, retention policy |

**Required Controls for L2:**
- Role-scoped access
- Change tracking / audit trail
- Log sanitization (no PHI/PII leakage into operational logs)
- Retention per operational needs (audit logs: 7 years minimum)

### L1 — Public

| Data Element | Location | Controls |
|---|---|---|
| Health check endpoint response | `/health` | Integrity (no version info leakage) |
| Public API documentation | Docs (if published) | Anti-tamper, versioned |
| Static frontend assets (CSS/JS/images) | nginx / CDN | Cache-control, SRI hashes |

**Required Controls for L1:**
- Integrity verification
- No sensitive data exposure
- Subresource integrity for static assets

---

## 4. Data Flow Classification Map

```
Browser (Untrusted)
  │
  ├─ Login request ──────────► API (PII: email + password hash comparison)
  │                              │
  │                              ├─► JWT issued (Internal token, L2)
  │                              │
  ├─ Patient lookup ────────► API ──► DB query (PII L3 + PHI L4)
  │                              │
  │                              ├─► Response masked by role (masking middleware)
  │                              │
  ├─ Create diagnosis ──────► API ──► Consent check ──► DB write (PHI L4)
  │                              │
  │                              ├─► Audit log entry (L2, hash-chained)
  │                              │
  ├─ Upload document ───────► API ──► File storage (L3/L4 depending on content)
  │                              │
  │                              ├─► Metadata in DB (L2)
  │
  └─ View audit log ────────► API ──► Audit DB (L2, admin/security only)
```

---

## 5. Environment-Specific Classification Controls

| Control | Production | Staging | Development |
|---|---|---|---|
| Real PHI/PII data | Yes (encrypted) | **No** — synthetic only | **No** — synthetic only |
| Encryption at rest | Required | Required | Recommended |
| TLS in transit | Required (TLS 1.2+) | Required | Optional (localhost) |
| Data masking | Role-based API masking | Full masking applied | Minimal (dev convenience) |
| Audit logging | Full + hash chain | Full | Enabled, no hash chain |
| Access controls | RBAC + ABAC + consent | RBAC + ABAC | RBAC (simplified) |
| Log sanitization | Strict (no PHI/PII) | Strict | Warning on violations |
| Backup encryption | Required | Required | Not required |

---

## 6. Non-Production Data Policy

- **Production data must NEVER be copied to non-production environments.**
- Staging and development environments must use synthetic/seeded data only.
- The existing `seed.js`, `seed_doctors.js`, and `seed_extended.js` scripts provide synthetic datasets.
- If realistic test data is needed, use the `anonymization.service.js` to strip PII/PHI before export.
- Database snapshots from production must be anonymized before restore to non-prod.

---

## 7. Retention Schedule

| Data Type | Retention Period | Disposal Method | Legal Basis |
|---|---|---|---|
| PHI (clinical records) | Minimum 6 years post last encounter | Secure deletion + certificate | HIPAA §164.530(j) |
| PII (patient demographics) | Duration of care + 6 years | Secure deletion | GDPR Art. 5(1)(e) |
| Audit logs | 7 years minimum | Archive to cold storage | HIPAA §164.312(b) |
| Consent records | Duration of consent + 6 years | Archive | GDPR Art. 7, HIPAA |
| Application logs | 90 days active, 1 year archive | Rotation + deletion | Operational policy |
| Backups | 90 days | Encrypted deletion | Operational policy |
| Session / OTP data | Until expiry (30 min / 10 min) | Auto-purge | Operational policy |

---

## 8. Classification Decision Tree

```
Is the data directly about a patient's health condition, treatment, or care?
  ├─ YES → L4 (PHI)
  │
  └─ NO → Can the data identify a specific individual?
            ├─ YES → L3 (PII)
            │
            └─ NO → Is the data internal operational / non-public?
                      ├─ YES → L2 (Internal)
                      │
                      └─ NO → L1 (Public)
```

---

## Approval

| Role | Name | Date | Signature |
|---|---|---|---|
| DevOps Lead | | | |
| Compliance Officer | | | |
| Security Lead | | | |
