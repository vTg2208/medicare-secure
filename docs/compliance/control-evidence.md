# Control evidence and assurance boundaries

The authoritative structured matrix is [control-matrix.json](control-matrix.json). It maps engineering controls to reviewed framework references, implementation files, named test scenarios, limitations, historical execution reports and external responsibilities. It is not a legal applicability decision or certification.

| Control | Implemented engineering | Remaining boundary |
| --- | --- | --- |
| ACCESS-01 | Authenticated sessions; role, ownership, care, organization and scoped consent checks | Workforce access review; compromised service/owner accounts; legacy helpers must not be mistaken for the active policy |
| INTEGRITY-01 | Clinical mutations and actor evidence commit together; retained audit hash chain | Owner-level destruction/tampering and independent monitoring; audit payloads can contain sensitive snapshots |
| PRIVACY-01 | Owner exports and reviewed requests; actual restrictions and corrections | Erasure/disposal linkage, access/portability delivery artifacts and complete deadline escalation remain partial |
| RETENTION-01 | Explicit policies, holds, activity clocks, privileged approved disposal and file cleanup | Unsupported categories, retained workflow dependencies and restore-time disposal reconciliation |
| CONFIDENTIALITY-01 | Identity-bound encrypted files/selected narratives, verified transport configuration and durable private objects | Provider volume encryption, key custody/rotation and live scanner operation |
| INCIDENT-01 | Restricted versioned assessments and immutable notification-evidence logging | Human legal assessment, real incident ownership and delivery evidence |
| MINIMIZATION-01 | Scoped aggregate research and sanitized operational logging | Collection necessity review and stronger de-identification for future dataset sharing |
| RECOVERY-01 | One coordinated database/file snapshot, independent archive key, exact cloud-download recovery gate | Defined recovery objectives, promotion rehearsal and operator failure delivery |

Run `npm run governance:check` from backend. It validates metadata shape, local source/evidence references and named scenario references. Its result is **references_checked_only**: it does not execute tests, contact a provider or turn a pending responsibility into a verified fact. Historical observations retain their actual source revision, date and report. Referenced scenarios can subsequently change; fresh execution evidence must be recorded independently.

The catalog integration test additionally compares [data-inventory.json](data-inventory.json) with a real fresh migrated PostgreSQL schema. It reads only metadata, works in public and healthcare layouts, and rejects unknown/removed tables or columns. Column overrides refine the default table classification. Hashes, public verification keys, bearer credentials, ciphertext and unencrypted clinical snapshots are distinguished explicitly.

External status is either `pending` or `owner_recorded`. An owner-recorded assertion requires attribution, a date and retained evidence references; it is not machine verification. No aggregate compliance percentage is produced. The [operational checklist](operational-assurance.md) defines the evidence needed for actual use.

Framework references are the [official GDPR text](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679), [HHS Security Rule overview](https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html), and [HHS technical safeguards guidance](https://www.hhs.gov/sites/default/files/ocr/privacy/hipaa/administrative/securityrule/techsafeguards.pdf). Mappings identify design motivations; responsible reviewers determine applicability, exceptions and organizational obligations.
