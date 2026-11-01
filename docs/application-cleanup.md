# Standard application experience

This change follows the requirements-completion review at `d14df15`. It changes application presentation and removes the shared deployment-mode behavior. It does not apply cloud migrations, alter existing account credentials, update existing clinical records or rewrite audit history.

## Application changes

- All public and authenticated routes use the normal application components. The global notice, alternate homepage/login copy, restricted-feature pages and unused component showcase were removed.
- Registration, invitations, patient onboarding, report uploads, verification and passkey enrollment no longer depend on a shared mode. Authentication, roles, consent, malware scanning, file encryption, durable auditing and clinical-state rules continue to apply.
- The API no longer installs the mode middleware or exposes its public deployment-mode endpoint. The frontend no longer reads a mode flag or forces one through its Vercel build command.
- Email delivery depends on actual SMTP configuration. Missing SMTP creates no transport and returns a service-unavailable error. Public verification routes check this before creating accounts or processing credential uploads. Password login remains independent. Partial SMTP configuration is rejected during startup validation.
- AI continues to use its existing explicit service setting and authenticated service token. Removing presentation restrictions does not invent an AI provider, mail account, antivirus scanner or durable upload store.
- Bundled records and private account identifiers remain available through the separate, manually invoked `seed-workspace.js` tool. New seed output uses ordinary record and organization labels. Its empty-database, exact-ledger, password-hash and transactional rollback checks remain intact. Generated account passwords stay outside source and are not displayed by the interface.
- Local development seed scripts require `ALLOW_SAMPLE_DATA=true`, a development/test environment and a loopback database. This protects production data from public development passwords; it is not an application feature mode.

## Deployment

The review branches were renamed to `clean-application-experience` and `requirements-completion`, then integrated into `main`. The private database upgrade through `025`, API release and frontend release are complete. See [the verified release record](releases/2026-11-01-main-release.md); retain [the release procedure](requirements-release.md) for future upgrades.

When promoting, remove obsolete `DEMO_MODE` and `REACT_APP_DEMO_MODE` hosting settings. Neither is read by this application. Configure SMTP before account verification is needed; configure the scanner and a durable encrypted upload store before accepting documents. Existing account identifiers and passwords do not need to change. Historical deployment reports describe earlier releases; this document and the current README describe the new behavior.

The infrastructure/provider, retention, monitoring and recovery prerequisites in [the requirement report](requirements-traceability.md) still apply. A presentation cleanup does not establish approval for actual patient information.

## Verification

- Backend: 156 unit tests across 23 files; 141 Node checks across all 15 root suites, with no skips or failures. The latter includes actual PostgreSQL, browser-schema installation and upgrade, protected clinical access, audit integrity, privacy/breach workflows, encryption and recovery.
- Frontend: 88 behavior tests across 18 files; lint, shared theme validation and production build passed.
- Backend syntax checks passed. Browser checks confirmed the normal homepage and login copy, restored account-creation link and loaded carousel artwork.
- The local PostgreSQL service uses disposable tmpfs storage. After restarting it, the sandbox runner now applies the migrations before integration tests, matching CI's explicit provisioning step.

Tests ran in the existing constrained, offline containers. No hosting credentials, outbound mail, model-provider requests or actual patient records were used.
