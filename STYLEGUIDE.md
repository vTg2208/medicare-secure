# Medicare interface system

Use the login's calm teal identity throughout the public website, account screens and all role workspaces. Shared values live in `frontend/src/styles/tokens.css`; Tailwind's brand and neutral ramps match those values. Components use semantic CSS variables so light and dark modes do not require their own unrelated palettes.

## Token contract

- Canvas and panels: `--mc-canvas`, `--mc-surface`, `--mc-surface-raised`, `--mc-surface-muted`, `--mc-surface-hover`.
- Text and boundaries: `--mc-text`, `--mc-text-muted`, `--mc-text-subtle`, `--mc-border`, `--mc-border-strong`.
- Identity: `--mc-brand` (solid teal), `--mc-brand-hover`, `--mc-accent` (theme-aware text), `--mc-brand-soft`, `--mc-on-brand` (white text on solid action colors).
- Feedback: `--mc-success`, `--mc-warning`, `--mc-danger`, `--mc-info`, their `-bg` and `-border` variants, plus `--mc-danger-solid` and `--mc-success-solid` for filled actions.
- Structure: `--mc-font`, `--mc-radius-control`, `--mc-radius-panel`, `--mc-shadow-sm`, `--mc-shadow-panel`, `--mc-shadow-overlay`, `--mc-overlay`, `--mc-focus`.

Use solid panels with fine borders. Primary actions are solid teal, secondary actions have neutral borders, and destructive actions retain danger styling. Role identity belongs in page titles and labels, not separate brand colors or logos. Use the shared Brand component for product identity and Material Symbols for interface icons. Keep clinical status colors, charts, uploaded documents and print output semantically meaningful.

No role-specific gradients, animated particle backgrounds, glowing brand marks, alternate fonts, translucent glass panels or gradient text. Focus, disabled, loading, success and failure states must remain visible. Tables may scroll inside their container on small screens; page navigation must remain usable without hiding role destinations.

## Implementation and review plan

1. Centralize theme tokens, typography and semantic feedback colors.
2. Migrate shared components and page-specific styles to the contract.
3. Apply one brand, primary palette, panel treatment and responsive navigation to every route.
4. Check representative role dashboards, forms, tables, dialogs and public/auth screens in both themes, including narrow viewports.
5. Run frontend regression tests, lint and production build; publish in focused commits and verify the live deployment.

## Build enforcement and verification

`npm run check:theme` parses all 72 stylesheets and checks 126 frontend JSX files. It rejects hardcoded interface colors, undefined theme variables, alternate fonts, decorative gradients/blur, divergent brand ramps and insufficient contrast in the shared action/selected-text palette. `npm run build` always runs this check before compiling.

The theme change passed 62 frontend behavior tests across 11 suites, including a new check that theme selection persists across navigation and remounting. Lint and the production build are required alongside the theme audit.

Local browser checks used an isolated, read-only synthetic visual fixture to render 52 role screens at desktop width and a 390px frame; navigation remained visible and page-level horizontal overflow was absent. The same 52 screens were checked in dark mode. Twelve representative light-theme workflows received DOM contrast probes, and eight representative workflows were also checked at 320px. These checks cover the rendered fixture states, not every possible record, upload, device or hardware passkey. Clinical print/PDF capture retains a light paper surface and readable ink in either theme. Fixtures and their transport adapter are local inspection artifacts and are excluded from deployment source.
