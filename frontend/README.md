# Frontend

Use Node 24 and `npm ci`. Run `npm start` for the Vite development server on port 3000. It forwards `/api` and `/readyz` to the backend on port 5000.

Verification: `npm run lint -- --max-warnings=0`, `npm test`, `npm run build`, and `npm audit --audit-level=low`. Vitest runs once by default; `npm run test:watch` enables watch mode. Production assets are written to `build/`.

The build accepts existing `REACT_APP_*` variables. `REACT_APP_API_URL` defaults to `/api`, accepts either an origin or a URL ending in `/api`, and is compiled into the bundle. These are public settings, never secrets. Restart the development server or rebuild after changing them.

The production Docker stage serves the app with unprivileged nginx on port 8080. It proxies `/api/` and `/readyz` to `backend:5000`, serves a local `/health` liveness check, sets security headers, and supports browser route refreshes. This configuration uses same-origin API connections; deployments that deliberately use a separate API origin must also adjust nginx's `connect-src` policy. Put HTTPS termination in front of the service before public use.

The former Create React App build and Jest commands have been replaced by Vite and Vitest. Pages load on demand, and PDF export libraries load only when export is requested. Development login is absent from production routes and source.
