# Historical local reference material

This directory preserves earlier local development material so it is not lost when the original workspace is removed. It is outside the frontend, backend and AI build contexts and is not loaded by the running application.

Use the root [README](../README.md), [operations runbook](../DEVOPS.md), current package manifests and active `.github/workflows` for setup and verification. Files under `local-reference` retain their former relative paths for provenance; they are not another supported deployment configuration.

In particular, the archived mock server is a historical fixture rather than an alternative application API. The archived security workflow and scan script use older image targets and warning-only reporting; their presence does not establish a successful scan or regulatory compliance. The active service workflows contain the current dependency, behavior and container checks.

Private configuration, credential documents, database contents and generated caches are intentionally excluded from this archive and from GitHub. They are preserved separately in the owner's encrypted local project backup.
