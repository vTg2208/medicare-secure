# Monitoring and recovery readiness

The free hosted site remains a synthetic demonstration. The optional self-hosted observability overlay is configuration for an operator to review and enable; this task did not provision a cloud monitoring service, send an alert, or create a paid resource.

## Implemented source configuration

- `docker-compose.observability.yaml` joins the production application's private network, publishes neither monitoring dashboard, supplies a dedicated metrics secret file, and configures an explicit Alertmanager service/target. A reviewed receiver configuration and a matching backend bearer token are mandatory inputs.
- `monitoring/prometheus/production.yml` authenticates to `/metrics`. The public frontend does not proxy that endpoint. Development monitoring remains separate and must not be treated as a production deployment.
- Eight alert rules use real application/scrape metrics: target absence/down, error rate, route-based latency, failed authentication/denied requests, audit failures and missing audit telemetry. Unsupported imaginary business/backup counters were removed. JSON `/health` and `/readyz` responses are no longer scraped as Prometheus exposition.
- `audit_log_errors_total` increments on strict audit insert/clinical transaction audit failures. Log files have a finite budget: five 10MiB files per normal/error/exception/rejection transport. Container log rotation and Prometheus retention are bounded too.
- Encrypted coordinated backup and disposable restore tools are implemented and tested with actual PostgreSQL, encrypted reports and credential path recovery in both supported application schemas. See [backup and recovery](backup-recovery.md). A tool does not by itself schedule or externally retain a backup.

Prometheus `promtool check config` validates the production configuration and all eight rules. HTTP/database tests exercise the audit failure signal. These checks do not prove delivery to a real on-call destination.

## Operational evidence still required before actual patient use

| Boundary | Required owner/environment evidence |
| --- | --- |
| Alert delivery | Supply the actual reviewed Alertmanager receiver file and dedicated token, verify private connectivity, and demonstrate one test alert and recovery notification to the intended incident owner. No destination is silently invented. |
| Database transport | The hosted configuration uses certificate-verified TLS. The standalone production Compose template now requires verified TLS and rejects plaintext TCP; see [database transport](database-transport.md). The owner must supply and rotate certificates and verify the intended host. |
| Storage encryption | Ordinary clinical PostgreSQL columns are not application-encrypted. The owner must establish encrypted database volumes, backup storage and access controls in the actual provider/host. Application file/narrative encryption does not prove those properties. |
| Recovery | Coordinate stopped writes and encrypted database/file backup, retain the two required keys separately, retain encrypted artifacts off-host, define recovery objectives, schedule the job and complete a restore drill in the intended environment. |
| Malware scanning | Enable scanner availability/signature updates and verify clean, rejected and unavailable cases before enabling uploads. The free demo keeps uploads disabled. |
| Database exporter | The old development exporter shares broad application credentials. It is deliberately absent from the new production overlay. Provision a dedicated read-only monitoring role before adding database telemetry. |
| Governance | Establish provider/legal arrangements, incident responsibility, workforce/access review and the applicable record retention/legal-hold policy. This repository does not certify the organization or provider. |

New reports and credentials use `SHMSENC2` with authenticated file identity. Older unbound `SHMSENC1` files require the reviewed, default-dry-run [migration tool](file-encryption-migration.md). Keep original ciphertext and the original application key until recovery and migration are verified.
