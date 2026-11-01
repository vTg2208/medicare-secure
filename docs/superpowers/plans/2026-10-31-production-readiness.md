# Production Readiness Implementation Plan

**Goal:** Repair and verify this repository end to end for owner inspection before deployment.

**Architecture:** Preserve the React/Express/PostgreSQL application and its existing roles. Make database provisioning repeatable, enforce authentication and resource access on the server, and connect production services through a single frontend origin. AI screening remains an optional service and must never expose another patient's session.

**Tech Stack:** Node.js 24, React, Express, PostgreSQL, Python/FastAPI, Docker Compose.

**Scope:** Existing functionality, production configuration, regression coverage, CI, and operating documentation. No deployment or live-data changes.

## Review focus

- Revoked tokens must remain invalid even if another session is active.
- Patient identifiers and organizational boundaries must be enforced before reads or writes.
- A fresh database must support all routed features without manual SQL patches.
- Missing AI/email dependencies must produce explicit failures without exposing clinical data.
- Production builds must use the configured API and exclude development authentication.

## Tasks

- [x] Establish backend tests, frontend tests/build, dependency audit, and fresh-database baselines.
- [x] Repair environment validation, database TLS, migration ordering/history, and safe initial administration.
- [x] Add regression tests and fix token/session binding, account status, OTP lifecycle, and authentication UI.
- [x] Add regression tests and fix confirmed resource/organization/consent authorization failures.
- [x] Repair chatbot ownership, bounded calls, service authentication, and optional-service configuration.
- [x] Repair frontend runtime/build failures, API contracts, and user-facing failure handling.
- [x] Align containers, reverse proxy, readiness/shutdown, CI, and production environment examples.
- [x] Run full verification and document evidence, inspection steps, and any remaining external prerequisites.
