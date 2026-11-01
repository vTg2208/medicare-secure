# Medicare homepage: show the care journey

The homepage must answer three questions before asking visitors to read further: what Medicare manages, who uses it, and how patients control sharing. The hero names medical records and the care team, then illustrates a report moving through a permission-controlled workflow.

## Principles implemented

- **Recognition:** familiar report, patient, clinician, switch and lock controls explain the product through actions. The same report remains visible throughout.
- **Hierarchy:** one primary action creates a patient account. Existing patients have a portal link; care teams have a separate sign-in section. Each uses the existing account routes.
- **Progressive disclosure:** one workflow occupies the hero. Visits, records and permissions appear as three short steps below it rather than a catalogue of features.
- **Control and feedback:** visitors can change sharing, open the illustrated report, select a chapter, pause or replay. Taking control stops autoplay. Labels and access history explain state independently of color.
- **Consistency:** the existing Brand, ThemeToggle, Plus Jakarta Sans and semantic Medicare tokens supply typography, colors, light/dark surfaces, focus styling and elevation. No new dependency or competing palette is introduced.
- **Accessibility:** controls have names and visible focus, keyboard actions suppress immediate motion, the switch has a larger hit area, and playback controls have 44px targets. Reduced-motion preference disables autoplay and decorative motion while preserving manual exploration. Offscreen or background playback stops. Future history events remain hidden from assistive technology.
- **Truthful behavior:** withdrawal blocks future requests; it never removes the patient's original report or pretends to recall information already received. These public illustration controls never modify account permissions or access patient data.
- **Responsive composition:** the animation adapts to its container; the homepage becomes a single column on smaller screens. Secondary assurances are hidden on narrow screens to prioritize the product story. Text and control wrapping still require a rendered-device review.

## Motion

The six-phase loop takes 7.25 seconds, down from the initial 12.4-second concept. Phases last 1300 / 650 / 1250 / 1600 / 650 / 1800ms: report ready, approve, share, view logged, withdraw, future access blocked. Transitions use opacity and transforms; surfaces and borders change color to communicate state. No layout properties animate.

## References and interpretation

Public first-party pages informed the design direction; these are design interpretations rather than reproduced layouts or assets:

- [Linear](https://linear.app/): use concrete product workflows to explain the product.
- [Stripe](https://stripe.com/): connect an explicit benefit to a clear action and tangible interface.
- [Apple Health](https://www.apple.com/health/): use approachable health language and make personal control visible.

Medicare retains its own identity. No customer statistics, certification badges, or regulatory-compliance guarantees are invented.

## Review boundary

This branch implements the redesigned homepage and reusable care-journey illustration. It does not claim a completed usability audit of every authenticated clinical screen. Existing workflow functionality remains behind the same account routes.

The local preview uses isolated sources and no production account data. This work is not a production deployment. Interaction tests, theme checks, lint and builds provide code-level evidence; the browser bridge was unavailable for the final visual review, so screenshots, real-device wrapping and perceived motion quality have not been verified.

Verification on 2026-11-01: all 99 frontend tests across 19 files passed in an isolated sequential run, including the 11 care-journey cases and homepage entry-route integration. ESLint passed. The shared-theme check passed for 75 stylesheets, 128 components/pages and 37 shared tokens. Both the application and standalone concept built successfully. An earlier concurrent run exceeded the default five-second timeout in one test; without simultaneous lint/build jobs, the unchanged test passed in 675ms. No test timeout was relaxed.
