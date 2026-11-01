# Logging & Threat Coverage Matrix — Secure Healthcare Management System

## Document Control

| Field | Value |
|---|---|
| Version | 1.0 |
| Created | 2026-02-28 |
| Owner | DevOps / Security Engineering |
| Review Cadence | Quarterly or after new threat scenario identified |
| Status | Active |

---

## 1. Purpose

Map every identified threat to its preventive controls, detection signals, logging sources, and alert configuration. This ensures no threat lacks observability coverage and every log source has a defined consumer.

---

## 2. Threat-to-Logging Coverage Matrix

### T-01: Insider Record Snooping

| Layer | Detail |
|---|---|
| **Preventive Controls** | RBAC middleware (`rbac.middleware.js`), ABAC policy engine (`abac.middleware.js`), consent verification (`consent.middleware.js`), care-team scope enforcement |
| **Detection Signals** | Excessive patient record reads per actor per time window; access to records outside assigned care team; after-hours access patterns |
| **Logging Source** | `audit.middleware.js` → `audit_logs` table (action, actor, resource, timestamp, hash chain) |
| **Log Fields Required** | `user_id`, `role`, `action` (READ), `resource_type` (patient/diagnosis/prescription), `resource_id` (patient_id), `timestamp`, `ip_address` |
| **Alert Rule** | `COUNT(record_access) WHERE user_id = X AND time_window = 1h > 50` → **HIGH** |
| **Alert Owner** | Security Team |
| **Escalation** | Security Lead → Compliance Officer |
| **Current Status** | ✅ Audit logging active, ⚠️ threshold alerting not yet configured |

---

### T-02: Privilege Escalation

| Layer | Detail |
|---|---|
| **Preventive Controls** | Role validation middleware, JWT role claims verification, admin-only role management endpoints |
| **Detection Signals** | Role assignment outside change window; self-role elevation attempt; privilege use immediately after role change |
| **Logging Source** | `audit_logs` (admin actions), `users` table (role changes), auth middleware (failed authz) |
| **Log Fields Required** | `actor_id`, `target_user_id`, `old_role`, `new_role`, `action` (ROLE_CHANGE), `timestamp`, `approval_reference` |
| **Alert Rule** | Any `ROLE_CHANGE` action → **CRITICAL** (immediate notification); Failed authorization attempts > 5 in 10 min → **HIGH** |
| **Alert Owner** | Security Team + System Admin |
| **Escalation** | Immediate page to Security Lead |
| **Current Status** | ✅ Role changes logged, ⚠️ real-time alerting not configured |

---

### T-03: SQL / Command Injection

| Layer | Detail |
|---|---|
| **Preventive Controls** | Parameterized queries via `pg` Pool, input validation, helmet security headers |
| **Detection Signals** | Repeated 4xx/5xx with SQL keywords in request body; unusual query patterns in DB slow query log |
| **Logging Source** | Express error middleware (`error.middleware.js`), application logs (`/app/logs/`), DB query metrics |
| **Log Fields Required** | `request_path`, `request_method`, `status_code`, `error_type`, `ip_address`, `user_agent`, `timestamp` |
| **Alert Rule** | `COUNT(status >= 400) WHERE ip = X AND time_window = 5m > 20` → **HIGH**; SQL keyword pattern in error logs → **HIGH** |
| **Alert Owner** | DevOps / SRE |
| **Escalation** | DevOps → Security Team |
| **Current Status** | ✅ Error middleware active, ⚠️ pattern-based alerting not configured |

---

### T-04: Data Exfiltration (Bulk Query Abuse)

| Layer | Detail |
|---|---|
| **Preventive Controls** | Pagination in API responses, role-scoped queries, rate limiting |
| **Detection Signals** | Abnormal row volume per session; rapid sequential queries across many patients; export/download spikes |
| **Logging Source** | `audit_logs` (resource access), API access logs, DB connection stats |
| **Log Fields Required** | `user_id`, `action` (READ/EXPORT), `resource_type`, `result_count`, `time_window`, `session_id` |
| **Alert Rule** | `SUM(result_count) WHERE user_id = X AND time_window = 1h > 500` → **CRITICAL**; Export action on > 10 unique patients in 30 min → **CRITICAL** |
| **Alert Owner** | Security Team |
| **Escalation** | Security Lead → CISO / DPO |
| **Current Status** | ✅ Audit logging active, ⚠️ volume-based alerting not configured |

---

### T-05: Consent Bypass / Override Abuse

| Layer | Detail |
|---|---|
| **Preventive Controls** | Consent middleware (`consent.middleware.js`), emergency access with duration limits, consent model validation |
| **Detection Signals** | Access granted without active consent record; emergency override usage; consent revocation followed by continued access |
| **Logging Source** | `audit_logs`, `consents` table (status changes), emergency access logs |
| **Log Fields Required** | `user_id`, `patient_id`, `consent_id`, `consent_status`, `action`, `emergency_flag`, `override_reason`, `timestamp` |
| **Alert Rule** | Any emergency override activation → **CRITICAL** (notification + mandatory review); Access after consent revocation → **CRITICAL** |
| **Alert Owner** | Security Team + Compliance |
| **Escalation** | Compliance Officer → Legal |
| **Current Status** | ✅ Consent logging active, ⚠️ post-override review workflow not automated |

---

### T-06: Session Hijacking / JWT Theft

| Layer | Detail |
|---|---|
| **Preventive Controls** | JWT expiry (24h access, 7d refresh), refresh token rotation, CORS restrictions, helmet headers |
| **Detection Signals** | Same JWT used from multiple IPs; token use after explicit logout; rapid geographic change in access origin |
| **Logging Source** | Auth middleware logs, `sessions` / `active_sessions` tracking, login/logout audit entries |
| **Log Fields Required** | `user_id`, `token_jti`, `ip_address`, `user_agent`, `action` (LOGIN/LOGOUT/TOKEN_REFRESH), `timestamp` |
| **Alert Rule** | Same `user_id` active from > 2 distinct IPs in 15 min → **HIGH**; Token use after logout → **CRITICAL** |
| **Alert Owner** | Security Team |
| **Escalation** | Force session invalidation + notify user |
| **Current Status** | ✅ Session tracking exists, ⚠️ multi-IP detection not implemented |

---

### T-07: Denial of Service

| Layer | Detail |
|---|---|
| **Preventive Controls** | express-rate-limit (global: 100/15m, login: 5/15m, OTP: 3/1h), health checks |
| **Detection Signals** | Rate limit threshold hits; connection pool exhaustion; abnormal traffic volume |
| **Logging Source** | Rate limit middleware logs, Docker health checks, application logs, system metrics |
| **Log Fields Required** | `ip_address`, `endpoint`, `rate_limit_remaining`, `status_code` (429), `timestamp` |
| **Alert Rule** | `COUNT(status = 429) WHERE time_window = 5m > 100` → **HIGH**; DB connection pool > 80% → **HIGH** |
| **Alert Owner** | DevOps / SRE |
| **Escalation** | DevOps → Infrastructure team |
| **Current Status** | ✅ Rate limiting active, ⚠️ infrastructure-level monitoring not configured |

---

### T-08: Supply Chain Compromise

| Layer | Detail |
|---|---|
| **Preventive Controls** | npm audit in CI, lockfile-based `npm ci`, Docker multi-stage builds |
| **Detection Signals** | New critical CVE in dependency scan; unexpected binary in container image; lockfile diff in PR |
| **Logging Source** | CI pipeline outputs (npm audit, Trivy), SBOM artifacts, Git diff |
| **Log Fields Required** | `dependency_name`, `cve_id`, `severity`, `pipeline_run_id`, `sha`, `timestamp` |
| **Alert Rule** | Critical/High CVE found in production dependencies → **CRITICAL**; Image scan fails → block deployment |
| **Alert Owner** | DevOps / Security |
| **Escalation** | Security Lead → Patch coordination |
| **Current Status** | ✅ npm audit in CI, ⚠️ no SBOM, no image scanning, no signing |

---

## 3. Log Source Inventory

| Log Source | Format | Location | Retention | Consumer |
|---|---|---|---|---|
| Application logs | JSON (winston) | `/app/logs/`, stdout | 90 days active, 1 year archive | DevOps, SRE |
| Audit trail | DB records + hash chain | `audit_logs` table | 7 years | Security, Compliance |
| Access violation logs | DB records | `access_violations` table | 7 years | Security |
| Auth events | Structured log | App logs + audit table | 90 days (logs), 7 years (audit) | Security |
| Rate limit events | Structured log | App logs | 90 days | DevOps |
| CI pipeline logs | GitHub Actions | GitHub | per GitHub retention | DevOps |
| Docker health checks | Docker daemon | Container runtime | Ephemeral | DevOps |
| PostgreSQL logs | PostgreSQL log format | Container volume | 30 days | DBA, DevOps |

---

## 4. Coverage Gap Summary

| Gap ID | Description | Threat(s) | Priority | Remediation Phase |
|---|---|---|---|---|
| G-01 | No threshold-based alerting on record access volume | T-01, T-04 | P0 | Phase 8 |
| G-02 | No real-time privilege change alerting | T-02 | P0 | Phase 8 |
| G-03 | No automated post-emergency-override review | T-05 | P1 | Phase 8 + App |
| G-04 | No multi-IP session detection | T-06 | P1 | Phase 8 + App |
| G-05 | No SBOM / image scanning / signing | T-08 | P1 | Phase 3 |
| G-06 | No WAF / DAST scanning | T-03 | P2 | Phase 3 + Infra |
| G-07 | No infrastructure DDoS protection | T-07 | P2 | Infrastructure |
| G-08 | No export rate limiting / DLP | T-04 | P0 | Phase 8 + App |

---

## 5. Log Hygiene Rules

1. **No PHI/PII in application logs.** Use resource IDs only (patient_id, user_id), never names, DOBs, or clinical data.
2. **Audit log entries are append-only.** No UPDATE or DELETE on `audit_logs` table.
3. **Hash chain integrity** must be verified on a scheduled basis (daily minimum).
4. **Log timestamps must be UTC** across all sources.
5. **Structured JSON format** for all application logs to enable automated parsing.
6. **Correlation IDs** (request ID / trace ID) must be present in every log entry for cross-source tracing.

---

## Approval

| Role | Name | Date | Signature |
|---|---|---|---|
| DevOps Lead | | | |
| Security Lead | | | |
