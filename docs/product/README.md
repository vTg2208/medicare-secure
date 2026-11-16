# Medicare product documentation

Version 1.0 · 16 November 2026 · For stakeholder review and baseline approval

This documentation set describes Medicare's product scope, information architecture and technical requirements. Read the PRD first, the information architecture second, and the technical requirements third. Current implementation, conditional integrations and proposed acceptance targets are identified separately.

## Documents

| Document | Read online | Shareable PDF |
| --- | --- | --- |
| Product Requirements Document | [Overview, objectives, personas, features and acceptance criteria](sources/01-Medicare-Product-Requirements.md) | [PRD](01-Medicare-Product-Requirements.pdf) |
| Information Architecture | [Mindmaps, sitemap, routes, six user flows and UX contract](sources/02-Medicare-Information-Architecture.md) | [Information architecture](02-Medicare-Information-Architecture.pdf) |
| Technical Requirements | [Technology, storage, environments, security, release and recovery](sources/03-Medicare-Technical-Requirements.md) | [Technical requirements](03-Medicare-Technical-Requirements.pdf) |

## Editable supporting material

- [Product requirements register](sources/requirements-register.csv)
- [Requirements traceability](sources/requirements-traceability.csv)
- [Frontend route inventory](sources/route-inventory.csv)
- [Classified data catalog summary](sources/data-catalog-summary.csv)
- [Implementation sources and standards references](sources/source-manifest.md)
- [Vector diagrams and Mermaid source files](diagrams/)
- [File integrity checksums](SHA256SUMS.txt)

The 11 diagrams are supplied as rendered SVGs and editable Mermaid sources. Markdown sources can be reviewed directly on GitHub. Requirement IDs connect the PRD, task flows and technical verification.

## Baseline and maintenance

The documents reference the inspected source revision and recorded release explicitly. Proposed service objectives and role-based persona hypotheses require stakeholder validation; they are not reported measurements or completed user research. References include the public scope of ISO/IEC/IEEE 29148:2018, W3C WCAG 2.2 and OWASP ASVS 5.0.0. No formal certification or conformance assessment is asserted.

When product scope, routes, data handling or deployment boundaries change, update the affected Markdown, diagrams and CSV registers together, then regenerate and visually review the corresponding PDFs. Retain stable requirement IDs, revise the document version/date and refresh checksums. Do not add secrets, patient records, build scripts, review images or duplicate distribution archives to this folder.
