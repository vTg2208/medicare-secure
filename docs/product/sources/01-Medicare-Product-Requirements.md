# Medicare product requirements

MC-PRD-001 | Version 1.0 | 16 November 2026

Status: For stakeholder review and baseline approval

## Contents

1. Product overview
2. Contents
3. Objectives and measures
4. Audience and personas
5. Identity and patient information requirements
6. Care coordination requirements
7. Consent and governance requirements
8. Operations optional scope and experience
9. Release acceptance risks and decisions
10. References and baseline control


## Product overview

Medicare is a permission-aware healthcare information and patient management web application. It connects patients and care teams around medical records, visits, prescriptions, diagnostic results and patient-controlled information sharing. Its product value depends on accountable access and reliable care workflows, rather than appointment booking alone.

| Document control | Value |
| --- | --- |
| Document ID | MC-PRD-001 |
| Version and date | 1.0 / 16 November 2026 |
| Review state | For stakeholder review and baseline approval |
| Accountable owner | Product owner role; individual appointment pending |
| Readers | Product, design, engineering, clinical operations, quality and privacy reviewers |

### Problem and product proposition

Patients need understandable access to their history and meaningful sharing choices. Care teams need the correct patient information at the point of care, without receiving unrestricted access to unrelated records. Administrators and privacy officers need attributable evidence of access, workflow changes and rights fulfillment.

### Product boundary

The current hosted application is a synthetic demonstration. Source controls and successful tests do not establish authorization for real patient use, clinical validation, provider assurance or legal certification. Operational acceptance is a separate release gate.

### How to use this document

This PRD defines intended outcomes, user needs, scope and acceptance. MC-IA-001 defines navigation and task flows; MC-TRD-001 specifies system and verification requirements. Must, Should and Could express release priority. Implemented, Conditional and Proposed describe evidence state, independently of priority.

Baseline: recorded main release 029ab9b on 16 November 2026, plus committed product and architecture sources. Uncommitted local changes are excluded from the approved baseline. Proposed targets require owner approval.


## Contents

Use these sections for review and maintenance. PDF bookmarks provide the same section navigation. Requirement IDs and flow IDs remain stable when page numbers change.

| Section | Page |
| --- | --- |
| Product overview | 1 |
| Objectives and measures | 3 |
| Audience and personas | 4 |
| Identity and patient information requirements | 5 |
| Care coordination requirements | 6 |
| Consent and governance requirements | 7 |
| Operations optional scope and experience | 8 |
| Release acceptance risks and decisions | 9 |
| References and baseline control | 10 |


## Objectives and measures

The following targets are proposed acceptance measures, not reported production performance or research findings. Establish a baseline in a synthetic pilot before setting a real-use service commitment.

| Objective | Measure and proposed target | Validation |
| --- | --- | --- |
| OBJ-01 Safe access | Zero successful cross-patient or cross-organization accesses in the defined negative-test matrix. | API and database authorization tests; security review. |
| OBJ-02 Understandable sharing | At least 90% task success for granting and revoking a correctly scoped consent in a moderated pilot. | At least 8 representative participants; report counts and errors. |
| OBJ-03 Reliable visits | Exactly one success for competing requests for the same reserved slot; other requests receive a conflict. | Concurrent integration tests and time-zone fixtures. |
| OBJ-04 Accountable handling | Every protected mutation and sensitive file release in the test matrix retains required attributable evidence. | Injected audit failures and evidence reconciliation. |
| OBJ-05 Usable self-service | At least 90% completion for finding a record and booking an available visit without facilitator intervention. | Task-based pilot; synthetic accounts and realistic devices. |
| OBJ-06 Operable service | Recovery, alert receipt and release gates are demonstrated in the intended environment before real patient use. | Operator evidence and stakeholder sign-off. |

### Measurement safeguards

Use task identifiers, aggregate outcomes and durations. Do not collect clinical payloads, government identifiers or full navigation histories for product analytics. Success rate denominators must exclude neither failures nor abandoned tasks without an explicit rule. Report sample sizes and confidence limitations.

### Prioritization

Must covers identity, object authorization, core care workflows, patient rights and evidence integrity. Should covers operability and accessibility acceptance before a real-use pilot. Could covers optional AI and study-specific research extensions. Deferred scope must not appear as a working clinical capability.


## Audience and personas

These personas are role-based design hypotheses derived from product workflows. They are not claims of completed user interviews. Validate language, device access, assistance needs and task frequency with intended users.

| Persona | Job and context | Needs and acceptance focus |
| --- | --- | --- |
| Patient managing recurring care | Reviews records, books follow-up visits and decides which clinician can access information; may use a shared or mobile device. | Plain-language labels, clear patient identity, explicit sharing scope, accessible forms, safe sign-out and recoverable errors. |
| Physician and nurse | Works through assigned care episodes with time pressure and repeated patient switching. | Fast authorized context, reliable notes and orders, visible visit identity, no stale responses applied to another patient. |
| Diagnostic or pharmacy specialist | Completes assigned tests, reports or prescriptions within an organization. | Actionable queues, validated results, safe attachments and clear terminal states; no duplicate completion. |
| Reception and hospital administrator | Registers patients, manages calendars, invitations, assignments and clinic flow. | Organization-scoped lists, verified scheduling, clear account states and role-appropriate administrative authority. |
| Compliance and privacy officer | Investigates incidents, fulfills rights requests and manages retention decisions. | Searchable attributable evidence, controlled case histories, legal holds and proof of fulfillment. |
| Insurance officer or researcher | Uses restricted insurance workflows or consent-based aggregate analysis. | Purpose-limited information; no implied entitlement to full records or identified research exports. |

### Primary and secondary audiences

Primary audiences are patients and direct care teams. Supporting audiences are operational staff, administrators and specialist order processors. Governance, insurance and research users have distinct purposes and narrower information contracts. Product procurement and deployment decisions require clinical, privacy and platform owners.

### Excluded audience assumptions

Guardian access, delegated consent, public research datasets and automated insurance eligibility decisions are not established capabilities. Minor or dependent-patient workflows require separate requirements and governance review.


## Identity and patient information requirements

### FR-01 Account registration and verification

Priority: Must. State: Conditional: mail and scanning must be operational.

The system shall validate patient registration and email verification before granting account access, and shall support reviewed professional onboarding.

**Acceptance** Valid registration reaches verification; invalid or replayed OTP fails; delivery unavailability cannot produce a verified account. Professional credentials remain subject to review.

**Evidence** backend/src/modules/auth; frontend/src/pages/auth

### FR-02 Password and passkey access

Priority: Must. State: Implemented.

The system shall support password sign-in and authenticated enrollment of optional WebAuthn passkeys, with revocable sessions.

**Acceptance** Invalid credentials, expired sessions and wrong origin or challenge fail. Logout revokes the session. Users can cancel device authentication without losing the password alternative.

**Evidence** backend/src/modules/auth; frontend/src/context/AuthContext.jsx

### FR-03 Role and patient context

Priority: Must. State: Implemented.

The system shall restrict each protected operation using role and applicable ownership, organization, care relationship, consent and purpose.

**Acceptance** Direct URL, API request, altered object ID and unrelated-organization attempts expose no unauthorized content; client-provided role or patient identity cannot override server checks.

**Evidence** backend/src/middleware; frontend/src/routes/ProtectedRoute.jsx

### FR-04 Patient record access

Priority: Must. State: Implemented.

The system shall let a patient review permitted clinical records and allow assigned clinicians to access authorized history.

**Acceptance** Notes, diagnoses, prescriptions and results are attributed to the correct patient and visit. Late responses cannot populate a newly selected patient. Empty data is identified without fabricated clinical values.

**Evidence** frontend/src/pages/patient; backend/src/modules/emr

### FR-05 Corrections and information provenance

Priority: Must. State: Implemented.

The system shall preserve attributed correction history and distinguish clinical addenda from silent replacement of an earlier clinical fact.

**Acceptance** Approved demographic correction updates the intended subject; clinical correction retains original attribution and adds review evidence. Unauthorized edits fail.

**Evidence** backend/src/modules/privacy; docs/privacy-fulfillment.md


## Care coordination requirements

### FR-06 Appointment availability and booking

Priority: Must. State: Implemented.

The system shall expose actual published doctor availability and atomically reserve the submitted appointment instant.

**Acceptance** Unconfigured calendars expose no slots. Conflicting requests receive 409. Displayed clinic time zone and submitted ISO instant identify the same appointment.

**Evidence** backend/src/modules/appointments; docs/appointment-calendars.md

### FR-07 Visit lifecycle and assignments

Priority: Must. State: Implemented.

The system shall support request, staff review, assignment, check-in and closure under permitted state transitions.

**Acceptance** Assignment and schedule changes persist atomically; unrelated staff cannot modify the visit. Terminal visits release reservations according to domain rules. Booking does not automatically grant record consent.

**Evidence** backend/src/modules/visit; backend/src/models/visit.model.js

### FR-08 Clinical documentation and orders

Priority: Must. State: Implemented.

The system shall let authorized clinicians document care and issue diagnoses, prescriptions and diagnostic orders for the active patient context.

**Acceptance** Invalid fields and incompatible state transitions fail. A note or order cannot be attached to a different selected visit because an earlier request completed late.

**Evidence** backend/src/modules/emr; frontend/src/pages/doctor

### FR-09 Diagnostics and medication fulfillment

Priority: Must. State: Conditional: file workflows require scanner operation.

The system shall route valid orders to authorized laboratory, imaging and pharmacy users and retain completion evidence.

**Acceptance** Cancelled orders cannot be completed. Duplicate or concurrent medication fulfillment cannot dispense twice. Result files require successful validation and scanning.

**Evidence** backend/src/modules/lab; radiology; pharmacist

### FR-10 Care correspondence

Priority: Must. State: Implemented.

The system shall provide persistent, encrypted patient-provider threads under current care and consent scope.

**Acceptance** Only the patient and authorized care participants can read or reply. Purpose restrictions and consent changes affect subsequent access. Subject exports include permitted correspondence.

**Evidence** backend/src/modules/messages; frontend/src/pages/patient/Messages.jsx


## Consent and governance requirements

### FR-11 Explicit sharing decisions

Priority: Must. State: Implemented.

The system shall let the patient grant, inspect, edit and revoke recipient-specific sharing with category, purpose, permission and expiry.

**Acceptance** An expired or revoked grant cannot authorize a new operation. Editing one scope does not silently broaden another independent grant. Sharing choices are shown before confirmation.

**Evidence** backend/src/modules/consent; frontend/src/pages/patient/Consent.jsx

### FR-12 Emergency read access

Priority: Must. State: Implemented.

The system shall provide justified, patient-specific, finite, read-only emergency access for eligible care roles with required evidence and patient notification.

**Acceptance** Wrong role, missing justification and expired grant fail. The grant cannot authorize mutation or bulk access. Incident and audit evidence are retained.

**Evidence** backend/src/modules/emergency; docs/clinical-audit-integrity.md

### FR-13 Patient rights casework

Priority: Must. State: Implemented.

The system shall support owned exports, correction requests, restrictions, objections and reviewed erasure outcomes with attributable histories.

**Acceptance** Access/portability completion requires fulfillment evidence; patient confirmation links to the owned receipt. Erasure subject to retention or a hold produces a reasoned disposition.

**Evidence** backend/src/modules/privacy; docs/privacy-fulfillment.md

### FR-14 Audit and incident oversight

Priority: Must. State: Implemented.

The system shall retain required access and change evidence and provide appropriately restricted incident investigation.

**Acceptance** Audit-dependent operations fail safely when durable evidence cannot be written. Officer-only investigation data is unavailable to unrelated roles. A notification log is not presented as proof of external delivery.

**Evidence** backend/src/modules/audit; compliance; docs/clinical-audit-integrity.md

### FR-15 Retention and controlled disposal

Priority: Must. State: Conditional: approved organizational policy and operator procedure.

The system shall support reviewed retention policies, legal holds and separately privileged disposal execution.

**Acceptance** A hold or retained dependency blocks disposal. Approval alone deletes no record. Restored data is reconciled with completed disposal decisions before operational promotion.

**Evidence** backend/src/modules/privacy/retention.routes.js; docs/retention-disposal.md


## Operations optional scope and experience

### FR-16 Organization administration

Priority: Must. State: Implemented.

The system shall restrict calendars, staff invitations, user review and organizational workflow management to their authorized administrative scope.

**Acceptance** Hospital staff cannot administer unrelated organizations or make themselves system administrators through a modified request. Privileged changes retain evidence.

**Evidence** backend/src/modules/admin; staff; users

### FR-17 Purpose-limited insurance and research

Priority: Must. State: Implemented.

The system shall limit insurance workflows to their authorized purpose and research output to consented aggregates with small-cohort suppression.

**Acceptance** Research output below five distinct patients is suppressed; identified row-level research export is unavailable. Insurance role membership alone does not unlock full medical history.

**Evidence** backend/src/modules/insurance; research

### FR-18 Optional AI intake

Priority: Could. State: Conditional: separately configured and reviewed service.

When explicitly enabled, the system shall collect reported symptoms and produce a draft summary for clinician review.

**Acceptance** Provider failure and invalid summaries return an unavailable state. AI output does not establish diagnosis, emergency urgency or queue priority. Readiness and provider/clinical validation are separate.

**Evidence** ai-service/README.md; backend/src/modules/chatbot

### FR-19 Accessible task-oriented experience

Priority: Should. State: Proposed acceptance baseline.

The system shall preserve the Medicare theme and provide clear progress, recoverable forms and consistent role-appropriate navigation.

**Acceptance** The six agreed UX principles are applied where relevant, with keyboard alternatives, explicit results and no critical action presented as an advertisement. Test WCAG 2.2 AA criteria on complete priority tasks.

**Evidence** MC-IA-001; STYLEGUIDE.md

### Out of scope

Validated clinical decision support, complete SOAP conversion, telemedicine, external FHIR/HL7 interoperability, actual SMS delivery, guardian/delegated consent, DICOM de-identification and an end-to-end insurance payment system are outside this baseline. A routed page, helper or placeholder is not sufficient evidence of a completed feature.


## Release acceptance risks and decisions

### Release acceptance

- All Must requirements have a reviewed implementation link and passing positive, negative and recovery tests appropriate to the change.
- Care, privacy and administrative stakeholders complete synthetic acceptance tasks using their actual roles. Cross-tenant denial, consent revocation, booking conflict and audit outage are mandatory scenarios.
- Live email delivery, scanner clean/malicious/outage behavior, external alert delivery and a timed recovery exercise are evidenced before enabling dependent workflows for real patient use.
- No release claims clinical validity, legal compliance certification, provider encryption assurance or service availability without corresponding scoped evidence.

| Risk | Impact and mitigation | Accountable role |
| --- | --- | --- |
| Free hosting and cold starts | Delayed or failed requests; show retry states and accept an appropriate service tier before real use. | Platform owner |
| Wrong-patient or overbroad sharing | Clinical and privacy harm; enforce object scope, patient identity and concurrent-state tests. | Clinical and security leads |
| Unverified integrations | Signup, uploads or response escalation unavailable; gate features on evidenced operating readiness. | Operations owner |
| Unapproved policies and identifiers | Unnecessary collection or unsupported retention; approve collection necessity, jurisdiction and records policy. | Privacy and records owners |
| Optional AI or aggregate misuse | Unsafe inference or re-identification; keep optional, restrict purpose and validate intended use. | Clinical or research owner |

### Decisions required for approval

D-01 appoint product and clinical owners. D-02 approve intended organizations, population and jurisdiction. D-03 approve service objectives and hosting capacity. D-04 approve retention, notices and identifier collection necessity. D-05 decide which optional integrations enter the release. D-06 approve security, accessibility and recovery evidence.

### Change control

Record proposed change, rationale, affected requirement IDs, data/privacy impact, migration and test impact, owner and decision. Update all three documents together when routes, domain rules or deployment boundaries change. Version 1.0 becomes an approved baseline only after the accountable product, engineering, clinical, privacy and operations roles record acceptance.

References: ISO/IEC/IEEE 29148:2018 public scope; W3C WCAG 2.2; OWASP ASVS 5.0.0. These guide structure and verification; no full standard-conformance assessment is asserted. Full source manifest is included with the package.


## References and baseline control

The documents describe the product baseline and proposed acceptance requirements. Material marked Proposed is a target or decision awaiting approval. Conditional capabilities depend on explicitly operated integrations. Source implementation does not by itself establish organizational, provider or regulatory assurance.

### Implementation baseline

Committed source inspection: b8e5761f45b2f50043b84f041073cc6ad9cce2f0. Recorded deployed main release after dependency maintenance: 029ab9b61203bf3b58dcad2d06067c4f33503812. No uncommitted local code is treated as deployed. Exact dependency resolutions belong to the released lockfiles. The source manifest links immutable inspected files, release evidence and the relevant merged pull requests.

### Engineering and design sources

Product scope and coverage: S-01 to S-03. Trust boundaries and data governance: S-04 and S-08 to S-13. Route and API architecture: S-05 and S-06. Scheduling: S-07. Deployment and optional integration: S-14 to S-18. Theme and interaction consistency: S-19. Full paths and immutable repository links are in sources/source-manifest.md.

### External references

STD-01 ISO/IEC/IEEE 29148:2018. Public catalog scope consulted for requirements life-cycle and information-item structure. Full paid standard was not assessed. https://www.iso.org/standard/72089.html

STD-02 W3C WCAG 2.2. Accessibility acceptance target AA; conformance requires complete-flow evaluation. https://www.w3.org/TR/WCAG22/

STD-03 OWASP ASVS 5.0.0. Security verification reference; no complete ASVS level assessment is asserted. https://owasp.org/www-project-application-security-verification-standard/

### Interpretation and approval

These references guide requirements quality, accessibility acceptance and security verification. A PRD, information architecture document and technical requirements specification do not have one universal mandated format. The package provides stable identifiers, explicit scope, measurable criteria, traceability, source evidence, risks and review ownership. It does not assert ISO certification, WCAG conformance, an ASVS level or medical/legal certification.

Public standards pages were consulted in the user Chrome browser on 16 November 2026. No external credentials, patient records or private environment values are included in this package.
