# Security hardening implementation plan

Goal: close the remaining input-validation, credential-upload, dependency-monitoring, and public-form bot-protection gaps; verify HTTPS without changing clinical functionality.

Constraints: preserve the existing theme, routes, API payloads, protected resource/consent checks, valid upload formats, and unrelated working changes. Online service work uses the owner's Chrome. Local Git, source editing, and tests stay in the workspace. The branch is named `security-hardening`. No new privileged database access or storage exposure is needed; there are no inbound webhooks to secure.

- [x] Validate clinical medical-record inputs at the server boundary before any persistence, preserving multiline clinical text and existing authorization. Add regressions for malformed shapes, unknown fields/types, excessive text, and valid payloads.
- [x] Require credential filename extension, MIME, and detected content to agree before antivirus scanning/encryption/persistence. Preserve valid PDF/JPEG/PNG and existing encrypted-file migration. Add regressions for spoofed MIME, unknown/double extensions, mismatched bytes and valid files.
- [ ] Add Python vulnerability auditing and dependency-update configuration for application packages, containers and CI actions. Keep compatibility checks and offline tests. Check current advisory results through the browser and address demonstrated vulnerable versions without speculative upgrades.
- [ ] Integrate an accessible public-authentication challenge with server-side verification, bounded network calls, explicit failure states, token reset/retry, and normal development/testing support. Preserve passkey and authenticated staff flows. Production activation must be verified against actual provider configuration; do not claim an inactive feature is complete.
- [x] Verify HTTP redirects to HTTPS for public frontend/API and inspect existing production TLS/security-header configuration through the browser. Add appropriate production application enforcement where the edge alone is insufficient, respecting trusted proxy configuration and local health checks.
- [x] Rename the existing remote branch through GitHub's browser UI and preserve history.
- [x] Run relevant backend/frontend tests, static checks and builds, review the diff independently, and report source/configuration/activation limits explicitly.

Source implementation and independent review are complete. Provider keys are stored in the existing Render service with enforcement disabled until the compatible frontend deploys. Production activation and initial CI advisory results remain deployment checks.
