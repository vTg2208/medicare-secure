# Main release — 1 November 2026

## Source integration

The private `vTg2208/medicare-secure` repository's review branches were renamed to `requirements-completion` and `clean-application-experience`. Both were fast-forward merged into `main`, preserving all 21 implementation commits without conflicts or a squash. The local source workspace branch was renamed to `production-readiness`; its original upstream history and private working files were not published.

Application commit `86efbe35fad08150e165f1fc0a45c34771fe7d06` contains both reviewed changesets. Follow-up commit `d11039a` fixes a CI startup race: the container health request now retries initial empty replies within a bounded startup window. It does not change application behavior.

## Database upgrade and protection

The owner approved the database upgrade and deployment in this chat. Through the owner's browser, the guarded private-schema exporter applied migrations `018`–`025` and the new runtime grants in one transaction. The ledger now contains 25 entries, ending in `025_private_audit_head`.

- Only the existing `healthcare_api` principal received the required new table and sequence privileges. Governance histories retain append-only protection. No account password or signing/encryption key was changed.
- SQL verification confirmed that the private schema is unavailable to `anon` and `authenticated`, the audit head matches the latest retained audit entry, the API cannot update the head, and the privileged chain-trigger function is not directly executable by that API principal.
- The Supabase SQL-editor principal cannot assume the application role. Its denied role-switch check was rolled back; no membership was granted to bypass that restriction. Actual application-role access was verified through the deployed API and signed-in UI.
- No hosted document/report attachments existed at preflight. No existing clinical records, account identifiers or credentials were rewritten; verification updated normal authentication metadata and added access-audit events.

Before upgrading, an encrypted PostgreSQL snapshot captured all 41 existing private tables and the migration-017 ledger. Authenticated decryption and typed row reconstruction matched the original snapshot inside PostgreSQL. The encrypted artifact, separate recovery key and non-secret manifest remain under the original workspace's ignored `.local/release-main/` directory; none are committed. This browser-created database snapshot is distinct from the repository's streaming database/file backup format. It has not undergone an independent full-host disaster-recovery drill or been configured as a recurring/off-host backup.

## Deployment

- Render deployed the tested API commit first: [successful API deployment](https://dashboard.render.com/web/srv-dbj30sg473hc73b1iu00/deploys/dep-dbjcapetlv9c73cqmf1g). Its schema-aware [readiness endpoint](https://medicare-secure-api.onrender.com/readyz) returned `{"success":true}`.
- After API readiness, pushing the integrated `main` triggered the [production frontend deployment](https://vercel.com/theegela-vishnu-vardhans-projects/medicare/9K5EzgSZLYTUe6naAs9BD37tSZaq), which reached Ready and served [medicare-vtg.vercel.app](https://medicare-vtg.vercel.app/).
- Render temporarily disabled automatic deployments as part of its specific-commit deployment workflow. Its original `On Commit` setting was restored afterward; it still tracks `main`.
- Existing Free/Hobby plans and service addresses were retained. No paid resource or account connector was used.

## Verification

- [Backend CI passed](https://github.com/vTg2208/medicare-secure/actions/runs/41274831540): unit tests, all opted-in PostgreSQL/browser/recovery suites, dependency audit, repeatable migrations and production image build.
- [Frontend CI passed after the readiness fix](https://github.com/vTg2208/medicare-secure/actions/runs/41275335002): 88 behavior tests, strict lint, theme/build, dependency audit, image build and nginx/header/routing/unprivileged-user smoke checks.
- Previously recorded isolated verification covered 156 backend unit tests and 141 Node checks with zero skips. Application source did not change during integration; the follow-up change was confined to CI readiness polling.
- The live homepage and login use normal application routes without a global presentation-mode banner. Existing patient and compliance credentials still work. The patient privacy center loaded; password-confirmed information export returned success and retained a corresponding audit event. Officer breach response and global audits loaded without permission/service errors. No breach case, privacy request or external notice was submitted by this verification.
- Both verification accounts were signed out afterward. The live public homepage is the inspection entry point.

SMTP delivery, document scanning/durable storage, AI providers, actual alert delivery and full-host scheduled recovery remain environment-dependent integrations. Existing sample records are retained. Actual patient use still requires the operational/provider conditions in [the requirement report](../requirements-traceability.md); this release is not a regulatory certification.
