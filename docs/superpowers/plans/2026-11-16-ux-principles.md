# UX principles implementation plan

> **For agentic workers:** Use focused implementation tasks and independent review. Preserve existing user changes and API contracts.

**Goal:** Apply the six reviewed UX principles where relevant without changing Medicare's theme or clinical functionality.

**Architecture:** Improve the current routed screens with progressive disclosure, shared connected progress, and consistent modal isolation. Keep existing React state and API payloads. Do not introduce a carousel where users do not need one.

**Tech stack:** React, existing semantic CSS tokens and Tailwind, Vitest/Testing Library, Playwright.

**Spec:** The user's request and the six-principle review in this chat.

## Constraints

- Keep the current teal theme, light/dark support, existing destinations, required fields, validation, consent scopes, booking availability, and server payloads.
- Preserve all pre-existing dirty changes, especially staff registration and its existing handoff test.
- No dependencies, backend changes, deployment, or commits are needed.
- Optional details remain editable; hidden required inputs must never block submission.
- Duration presets retain unlimited and exact custom-duration behavior, including editing existing grants.
- Keep all record types, doctors, specialties, and appointment slots reachable.
- Use connected progress only for actual sequential steps; label optional steps explicitly.
- Maintain keyboard access, focus visibility, dialog Escape/Back behavior, and narrow-screen readability.

## Tasks

### 1. Staff registration disclosure

Files: `frontend/src/pages/staff/PatientRegistration.jsx` and its existing test.

- [x] Add a regression check that optional data can be disclosed, entered, collapsed, and submitted without loss.
- [x] Show six required basic fields first; group optional demographics/address and contact/insurance in labeled details sections.
- [x] Preserve password generation, validation, submission payload, and email-verification handoff.
- [x] Run focused tests.

### 2. Consent duration choices

Files: `frontend/src/components/consent/ConsentForm.jsx`, `.css`, and `.test.jsx`.

- [x] Test finite preset payload, unlimited payload, custom duration, existing finite-grant editing, and failure/retry.
- [x] Present understandable duration presets with custom hours/minutes/seconds disclosed on demand.
- [x] Preserve visible recipient, data scope, purpose, access level, start date, and an explicit expiry summary.
- [x] Run focused tests.

### 3. Booking dialogs and progressive choice

Files: `frontend/src/components/visit/DoctorSelectionPopup.jsx`, `DoctorProfilePopup.jsx`, their tests and focused dialog styles; `pages/patient/ScheduleNewVisit.jsx`, `Visits.jsx` as needed only for booking state integration.

- [x] Test filtering, limited initial provider/slot choices with access to all, selected item persistence, and exact server appointment payload.
- [x] Add connected Doctor / Appointment / Request progress to the actual booking screens.
- [x] Use a consistent dimmed backdrop and accessible focus/Escape/return behavior in both booking dialogs.
- [x] Keep search and all specialties available; disclose larger provider and slot lists without hiding the selected item.
- [x] Run focused tests.

### 4. Registration progress, record choices, and visit action hierarchy

Files: new `components/common/FlowSteps.jsx` and `.css`; `pages/auth/Register.jsx`; `pages/patient/MedicalRecords.jsx` and test; `pages/patient/Visits.jsx` and focused styles.

- [x] Provide a shared ordered, connected, wrapping step indicator with `aria-current="step"` and completed-state labels.
- [x] Show the accurate patient account / email / optional passkey flow and doctor account / pending-review flow.
- [x] Keep common record types upfront and disclose all remaining types with a labeled control; preserve query and pagination reset.
- [x] Place visit actions in normal task flow with a clear primary action; keep walk-in and code check-in accessible.
- [x] Add explicit mobile overflow/swipe affordances only where horizontal interaction remains relevant.

### 5. Verification and review

- [x] Review integrated changes for validation, API payload compatibility, selected-state persistence, optional-step truthfulness, and existing edits.
- [x] Run the frontend test suite, lint, theme/font checks, and production build.
- [x] Inspect desktop and 390px/320px rendering in light/dark with isolated synthetic responses, including disclosures, record filtering, and doctor/time/back/request transitions.
- [x] Report completed changes and any genuine remaining limits.

## Verification results

- Final frontend suite: 169 tests passed across 33 files.
- ESLint, semantic theme audit, self-hosted font audit, production build, and whitespace checks passed.
- Browser review at 1440px, 390px, and 320px covered light/dark rendering, optional registration details, consent presets/custom fields, record filters, mobile navigation arrows, booking list expansion, preserved choices, exact request data, focus trapping, Escape, and focus restoration.
- Browser requests used isolated synthetic responses; no live clinical writes or backend integration verification were performed. The local backend was not running, so live telemetry delivery was outside this check.
- Independent code review found one omitted staff navigation integration; it was corrected and checked at 320px.
- Changes remain local on `codex/ux-principles`; no dependencies, commits, or deployments were added.
