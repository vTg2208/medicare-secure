# Data classification and handling

The current authoritative application inventory is [the checked table/column inventory](../compliance/data-inventory.json). It covers the actual migrated catalog, sensitive column overrides and seven non-table stores. [Control evidence](../compliance/control-evidence.md), [the lifecycle map](../compliance/data-lifecycle.md) and [external assurance](../compliance/operational-assurance.md) replace the older blanket descriptions of table encryption and fixed legal retention periods.

| Class | Meaning | Handling |
| --- | --- | --- |
| Clinical | Records, results, prescriptions, care messages, insurance/intake and potentially clinical audit snapshots | Owner/care/purpose/consent checks, restricted provider storage, protected downloads/exports and explicit retention/hold review |
| Identity | Account/contact/profile, credential references and organization/staff administration | Self/scoped administration, minimized projections, purpose review and category-specific retention |
| Security | Authentication verifiers, invitation bearer credentials, access policy and security events | Restricted access, bounded/revocable credentials, sanitized operational logs; hashes are not encryption |
| Governance | Consent, privacy/breach decisions, holds/disposal and retained evidence | Authorized governance/owned exports, immutable histories where implemented; selected narratives encrypted |
| Operational | Migrations, scheduling, inventory and object quota | Restricted configuration/data access and integrity checks; schema metadata is not patient-row evidence |
| Public | Intentionally published information such as a reviewed privacy notice | Explicit officer publication; no patient receipts, drafts or credentials exposed |

Table defaults conservatively classify their columns; explicit overrides distinguish sensitive payloads, bearer tokens, public verification material and application ciphertext. Ordinary clinical database fields are not all application-encrypted. Provider database/log volume encryption requires actual environment evidence. File/message/governance envelopes and encrypted backup recovery have their own boundaries and preserved-key requirements.

There is no universal medical, audit or identity retention duration in this classification. Use approved category/clinic/jurisdiction policies and review workflow dependencies, legal holds and backup/disposal reconciliation. The existing disposal tool has an explicit limited scope and does not erase all patient or governance information.

Operational logging is allowlisted/sanitized and bounded. The subject export excludes secrets and unrelated identities. Research exposes consented aggregates with a minimum distinct-patient cohort; this does not validate the legacy dataset/DICOM anonymization helpers. Non-production fixtures must remain synthetic.

Run `npm run governance:check` and the real `governance-inventory.integration.test.js` checks after a schema/column change. A passing reference checker is not proof of a provider safeguard, actual test execution or organizational acceptance.
