# Source manifest

Medicare documentation package | Version 1.0 | 16 November 2026

Inspected committed source: `b8e5761f45b2f50043b84f041073cc6ad9cce2f0`. Recorded final main/deployment revision from the preceding task: `029ab9b61203bf3b58dcad2d06067c4f33503812`. Local working changes are excluded. Referenced source files were inspected; older release reports retain their original dates and limitations.

## Implementation sources

- S-01 Product and operating overview: [README.md](https://github.com/vTg2208/medicare-secure/blob/b8e5761f45b2f50043b84f041073cc6ad9cce2f0/README.md)
- S-02 Original problem and scope: [docs/problem-statement.md](https://github.com/vTg2208/medicare-secure/blob/b8e5761f45b2f50043b84f041073cc6ad9cce2f0/docs/problem-statement.md)
- S-03 Requirement coverage and known limitations: [docs/requirements-traceability.md](https://github.com/vTg2208/medicare-secure/blob/b8e5761f45b2f50043b84f041073cc6ad9cce2f0/docs/requirements-traceability.md)
- S-04 Architecture and threat boundaries: [docs/architecture-threat-model.md](https://github.com/vTg2208/medicare-secure/blob/b8e5761f45b2f50043b84f041073cc6ad9cce2f0/docs/architecture-threat-model.md)
- S-05 Exact frontend route gates: [frontend/src/routes/AppRoutes.jsx](https://github.com/vTg2208/medicare-secure/blob/b8e5761f45b2f50043b84f041073cc6ad9cce2f0/frontend/src/routes/AppRoutes.jsx)
- S-06 API mounts and public exceptions: [backend/src/app.js](https://github.com/vTg2208/medicare-secure/blob/b8e5761f45b2f50043b84f041073cc6ad9cce2f0/backend/src/app.js)
- S-07 Appointment reservation rules: [docs/appointment-calendars.md](https://github.com/vTg2208/medicare-secure/blob/b8e5761f45b2f50043b84f041073cc6ad9cce2f0/docs/appointment-calendars.md)
- S-08 Rights fulfillment evidence: [docs/privacy-fulfillment.md](https://github.com/vTg2208/medicare-secure/blob/b8e5761f45b2f50043b84f041073cc6ad9cce2f0/docs/privacy-fulfillment.md)
- S-09 Retention and disposal rules: [docs/retention-disposal.md](https://github.com/vTg2208/medicare-secure/blob/b8e5761f45b2f50043b84f041073cc6ad9cce2f0/docs/retention-disposal.md)
- S-10 Backup and recovery: [docs/backup-recovery.md](https://github.com/vTg2208/medicare-secure/blob/b8e5761f45b2f50043b84f041073cc6ad9cce2f0/docs/backup-recovery.md)
- S-11 Monitoring readiness: [docs/monitoring-readiness.md](https://github.com/vTg2208/medicare-secure/blob/b8e5761f45b2f50043b84f041073cc6ad9cce2f0/docs/monitoring-readiness.md)
- S-12 External assurance boundaries: [docs/compliance/operational-assurance.md](https://github.com/vTg2208/medicare-secure/blob/b8e5761f45b2f50043b84f041073cc6ad9cce2f0/docs/compliance/operational-assurance.md)
- S-13 Classified data catalog: [docs/compliance/data-inventory.json](https://github.com/vTg2208/medicare-secure/blob/b8e5761f45b2f50043b84f041073cc6ad9cce2f0/docs/compliance/data-inventory.json)
- S-14 Hosted frontend proxy and headers: [frontend/vercel.json](https://github.com/vTg2208/medicare-secure/blob/b8e5761f45b2f50043b84f041073cc6ad9cce2f0/frontend/vercel.json)
- S-15 Self-managed production template: [docker-compose.prod.yaml](https://github.com/vTg2208/medicare-secure/blob/b8e5761f45b2f50043b84f041073cc6ad9cce2f0/docker-compose.prod.yaml)
- S-16 Optional AI contract: [ai-service/README.md](https://github.com/vTg2208/medicare-secure/blob/b8e5761f45b2f50043b84f041073cc6ad9cce2f0/ai-service/README.md)
- S-17 Browser token lifecycle: [frontend/src/utils/tokenManager.js](https://github.com/vTg2208/medicare-secure/blob/b8e5761f45b2f50043b84f041073cc6ad9cce2f0/frontend/src/utils/tokenManager.js)
- S-18 Upload credential limits: [backend/src/middleware/upload.middleware.js](https://github.com/vTg2208/medicare-secure/blob/b8e5761f45b2f50043b84f041073cc6ad9cce2f0/backend/src/middleware/upload.middleware.js)
- S-19 Shared design system: [STYLEGUIDE.md](https://github.com/vTg2208/medicare-secure/blob/b8e5761f45b2f50043b84f041073cc6ad9cce2f0/STYLEGUIDE.md)

## Recorded release evidence

- [Main release](https://github.com/vTg2208/medicare-secure/commit/029ab9b61203bf3b58dcad2d06067c4f33503812)
- [Main CI history](https://github.com/vTg2208/medicare-secure/actions?query=branch%3Amain+event%3Apush)
- [Registration test synchronization fix PR 38](https://github.com/vTg2208/medicare-secure/pull/38)
- Merged original dependency PRs: [#19](https://github.com/vTg2208/medicare-secure/pull/19), [#20](https://github.com/vTg2208/medicare-secure/pull/20), [#21](https://github.com/vTg2208/medicare-secure/pull/21), [#22](https://github.com/vTg2208/medicare-secure/pull/22), [#23](https://github.com/vTg2208/medicare-secure/pull/23), [#24](https://github.com/vTg2208/medicare-secure/pull/24), [#25](https://github.com/vTg2208/medicare-secure/pull/25), [#26](https://github.com/vTg2208/medicare-secure/pull/26), [#27](https://github.com/vTg2208/medicare-secure/pull/27), [#29](https://github.com/vTg2208/medicare-secure/pull/29), [#30](https://github.com/vTg2208/medicare-secure/pull/30), [#31](https://github.com/vTg2208/medicare-secure/pull/31), [#33](https://github.com/vTg2208/medicare-secure/pull/33)
- Deferred original migration PRs: [#16](https://github.com/vTg2208/medicare-secure/pull/16), [#17](https://github.com/vTg2208/medicare-secure/pull/17), [#18](https://github.com/vTg2208/medicare-secure/pull/18), [#28](https://github.com/vTg2208/medicare-secure/pull/28), [#32](https://github.com/vTg2208/medicare-secure/pull/32)

## Standards references

- STD-01 [ISO/IEC/IEEE 29148:2018](https://www.iso.org/standard/72089.html). Public catalog scope consulted for requirements life-cycle and information-item structure. Full paid standard was not assessed.
- STD-02 [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/). Accessibility acceptance target AA; conformance requires complete-flow evaluation.
- STD-03 [OWASP ASVS 5.0.0](https://owasp.org/www-project-application-security-verification-standard/). Security verification reference; no complete ASVS level assessment is asserted.

## Evidence interpretation

Historical test counts and provider evidence are not reissued as current acceptance results. Documentation generation did not run application tests, send email, modify production configuration, exercise actual patient records or complete provider/legal review. Proposed numerical targets and role-based persona hypotheses require stakeholder validation.

The route CSV describes frontend role gates. The data CSV summarizes committed catalog metadata and contains no patient rows. The model diagram is conceptual, not a complete physical schema.
