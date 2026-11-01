# Repository completeness and recovery

The maintained source repository is [vTg2208/medicare-secure](https://github.com/vTg2208/medicare-secure). The application, optional AI service, dependency manifests, migrations, tests, development scripts, infrastructure templates, monitoring definitions, design assets and operational documentation are versioned together.

The source audit compared the original workspace with the deployed repository before copying files. Every shared frontend/backend source file matched the maintained version. Local-only supported files were added without replacing that application code. Earlier development notes and tooling are retained under [legacy](../legacy/README.md), outside runtime build contexts. An embedded legacy token was removed from the repository copy.

## Recreate a working checkout

```sh
git clone https://github.com/vTg2208/medicare-secure.git
cd medicare-secure
npm ci --prefix backend
npm ci --prefix frontend
```

Follow the root [README](../README.md) and [DEVOPS.md](../DEVOPS.md) to configure local services. The setup script generates missing local secrets and preserves existing environment files. The production template requires explicit TLS material, distinct owner/runtime credentials and external HTTPS origins. The optional AI service has its own [requirements and test instructions](../ai-service/README.md).

Dependencies, build output, Python caches and generated retrieval databases can be recreated from source and manifests. Empty runtime directories are created by their owning services; Git does not need to store them.

## Material kept outside GitHub

Actual environment files, passwords and encryption keys, uploaded credential documents, database contents, private logs and local recovery artifacts are not source assets. They must remain in the owner's private storage. Local-only personal documents, generated schema exports and private working-copy histories were included in a separately encrypted project-preservation archive rather than published to this repository.

The private archive lives outside the original project directory. Its independent key is stored in a separate owner-restricted directory. The archive includes a file/hash manifest and verified portable Git bundles for both local repository histories. Authenticated decryption, ZIP integrity and the portable Node.js restore tool were exercised before reporting the backup as verified. Keep both the archive and its recovery key; deleting either defeats recovery.

This local preservation archive is not a newly coordinated database backup. Existing database recovery artifacts are preserved within it. Hosted Supabase data and provider-managed Vercel/Render environment settings remain separate from a source checkout. Use the [backup and recovery procedure](backup-recovery.md) for live database/file recovery assurance.

## Verification and branch cleanup

Before publishing the additional source:

- The optional service passed 23 offline tests in a network-disabled Linux container, and its runtime dependency check passed.
- Local setup created matching independent signing/encryption secrets, preserved existing environment bytes on rerun, and passed configuration validation in a disposable fixture.
- Four development/production/monitoring Compose configurations validated without starting services or loading production credentials. Development ports remained loopback-bound and the project name is portable across clone locations.
- Root JavaScript and PowerShell setup syntax checks passed. Trivy's source secret scan reported no remaining findings after the legacy-token removal.
- The architecture SVG regenerated deterministically, matched its seven pinned icon hashes and rendered with bounded text and no remote resources.

Branch cleanup is limited to remote branches whose recorded tips are ancestors of `main`, have no open pull request and have no newer remote tip at deletion time. `main`, unmerged work and active development branches are retained. All removed tips remain reachable from `main`; source history is not rewritten. Local development branches and worktree files are preserved in the private archive and are not deleted by remote cleanup.

A fresh clone must be compared against the published file manifest before removing the original workspace. The final remote SHA and clone verification results belong with the owner's private preservation report.
