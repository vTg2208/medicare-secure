# Medicare architecture diagram

The README uses [a standalone vector diagram](../assets/medicare-architecture.svg) with technology icons, user symbols, hosting boundaries, and orthogonal request paths. The deployment flow reads from people to the React application on Vercel, then through its same-origin proxy to the Express API on Render and the private PostgreSQL schema on Supabase.

The access policy is an API responsibility, not a separately deployed authentication service. Supabase represents the database; the diagram does not imply that Supabase Auth or Storage is used. Audit and governance evidence is retained in PostgreSQL. No AWS service or unimplemented replication layer is depicted.

Dashed connections and containers identify services that require separate configuration: upload scanning and durable encrypted file storage, SMTP delivery, and optional AI intake. They do not assert that these integrations are provisioned on the current free hosting plans. Hosting, transport, authorization, scanning and retention details remain defined by the source and [threat model](../architecture-threat-model.md).

## Edit and regenerate

The editable source is [render_architecture.py](render_architecture.py). It uses only the Python standard library and the checked-in icons:

```sh
python docs/design/render_architecture.py
```

The generated SVG embeds every icon path and uses no remote image, font, script, stylesheet or renderer. Text labels, explicit arrowheads and dash segments remain portable across GitHub and SVG/PDF viewers. The 1600 × 1030 viewBox scales without loss of detail. A descriptive SVG title, description and README alt text provide a textual overview.

## Icons and provenance

Vercel, React, Render, Node.js, Supabase, PostgreSQL and FastAPI marks come from [Simple Icons](https://github.com/simple-icons/simple-icons), distributed under [CC0-1.0](../assets/icons/simple-icons/LICENSE.md). Their pinned upstream revision, download URLs and SHA-256 hashes are in [sources.json](../assets/icons/simple-icons/sources.json). The source SVGs are vendored alongside that manifest, so regeneration needs no network access.

Patient, clinician, administrator, proxy, policy, audit, scanner, encrypted-folder, mail and lock symbols are original project SVG artwork. Technology marks identify the depicted components; they do not imply affiliation or endorsement.
