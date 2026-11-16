# Dependency monitoring

`.github/dependabot.yml` requests weekly update pull requests for frontend and backend npm manifests/lockfiles, the AI service's pip requirements, GitHub Actions, and base-image tags in each application's Dockerfile. npm, pip and Actions minor/patch updates are grouped per application/ecosystem; major updates remain separate. Docker updates are grouped per application. Open version-update pull requests are bounded per entry. Review updates and let the relevant application CI pass before merging; this configuration does not auto-merge updates.

## Vulnerability checks

- Frontend CI runs `npm audit --audit-level=low` and backend CI runs `npm audit --audit-level=moderate`, including development dependencies.
- AI service CI retains `pip check`, offline tests on Python 3.11/3.12, and the minimal production-image build. `pip check` checks installed dependency compatibility; it does not check vulnerability advisories.
- A separate Python 3.12 job installs `pip-audit==2.10.1` from `ai-service/requirements-audit.txt`. It independently resolves and audits `requirements-dev.txt` (which includes production requirements), `requirements-rag.txt` (optional production dependencies), and the audit-tool requirements, including transitive dependencies. Keeping these audits separate avoids combining tool, application and optional dependency environments.
- The audit job uses `--strict`, has no ignored advisories or suppressed failures, and fails on reported vulnerabilities or dependency collection failures. Requests have a 30-second timeout; each matrix job has a 30-minute limit. External package indexes and the advisory service must be reachable.
- AI CI runs on relevant pull requests, pushes to `main`, a Monday 05:23 UTC schedule, and manual dispatch. The schedule checks for new advisories even when application requirements have not changed. Offline test requests remain prohibited by the existing test fixture; the separate audit job intentionally uses the network.

The audit tool version was checked against the [official PyPI package page](https://pypi.org/project/pip-audit/) on 2026-11-16. Its separate pin lets Dependabot propose tool updates without adding tooling to the production environment.

The first PR audit passed for runtime/development and audit-tool requirements, and identified five advisory entries for optional `chromadb==1.5.9` (including a duplicated identifier). The [published advisory](https://osv.dev/vulnerability/PYSEC-2026-311) describes pre-authentication code injection and includes 1.5.9 in its affected range. The [official package page](https://pypi.org/project/chromadb/) still listed 1.5.9 as its latest release on 2026-11-16. Do not ignore these results or claim that a current version is necessarily safe. The remediation replaces the optional Chroma storage adapter with a local standard-library vector index while retaining document retrieval; its requirements must pass a fresh audit before merge.

## Activation and response

GitHub loads Dependabot configuration and scheduled workflows from the repository's default branch. After merging, confirm that GitHub Actions and Dependabot version updates are enabled, inspect the first dependency-update check and scheduled/manual audit run, and configure required branch checks according to repository policy. Existing alert/security-update settings are repository settings and are not enabled by this file alone. GitHub may delay scheduled jobs, and schedules can be disabled for inactive public repositories.

For a failure, inspect the reported dependency, advisory and fixed versions; determine whether it is direct or transitive, update the appropriate manifest/lockfile, and run the affected application's checks and image build. An index outage or resolution error also fails the audit and needs investigation. Do not bypass failures with a blanket ignore or label an unverified package vulnerable.

Dependabot tracks Dockerfile base-image updates; it does not scan installed operating-system packages or prove a built image is vulnerability-free. Optional RAG requirements are audited but their runtime behavior is not exercised by the minimal-image build. Scheduled audits depend on external advisory data and do not provide continuous monitoring or establish the deployed version. No registry/advisory network run or GitHub activation is established by local YAML validation.
