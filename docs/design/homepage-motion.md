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

The six-phase loop takes 7.25 seconds, down from the initial 12.4-second concept. Phases last 1300 / 650 / 1250 / 1600 / 650 / 1800ms: report ready, approve, share, view logged, withdraw, future access blocked.

Permission now has a physical representation. A lock stays attached to the original report. The entire U-shaped shackle rotates clockwise by 90 degrees over 480ms around its stationary bottom-right endpoint at SVG (24, 19), like a clock hand. The hinge uses the shackle's fill-box bottom-right corner; neither the hinge nor the lock body translates. Closing reverses the same rotation. After a 500ms lead-in, a larger report copy travels from the patient's card to the clinician's card over 650ms and settles into a document icon. The original report and recorded view remain in place when future access is withdrawn.

The transfer uses container-relative transform distances, so it crosses the cards on both desktop and phone layouts instead of moving a few pixels inside the connector. Lock transitions remain interruptible. The automatic file sequence pauses with playback; reduced-motion and keyboard interactions show the resulting state immediately. Movement uses transforms and opacity; no layout properties animate.

The report carries the scene's only lock. The permission header, patient header, clinician preview, button and history avoid repeating it. The connector uses a circular transfer badge set into a softly tinted channel, with short docking leads that align with the cards. Its contrast increases when access is approved. The sharing switch separates its 48×28px pill track and 20px thumb from its 48×44px button hit area. This preserves the standard switch shape under the application's global minimum button height. Desktop and 390px browser checks verified both thumb positions, one lock and no phone-width horizontal overflow.

## References and interpretation

Public first-party pages informed the design direction; these are design interpretations rather than reproduced layouts or assets:

- [Linear](https://linear.app/): use concrete product workflows to explain the product.
- [Stripe](https://stripe.com/): connect an explicit benefit to a clear action and tangible interface.
- [Apple Health](https://www.apple.com/health/): use approachable health language and make personal control visible.

Medicare retains its own identity. No customer statistics, certification badges, or regulatory-compliance guarantees are invented.

## Review boundary

This branch implements the redesigned homepage and reusable care-journey illustration. It does not claim a completed usability audit of every authenticated clinical screen. Existing workflow functionality remains behind the same account routes.

The local preview uses isolated sources and no production account data. This work is not a production deployment. Browser review now covers the actual built homepage at desktop size and a 390px viewport, including intermediate file positions and the settled light/dark states. Physical-device testing and a complete accessibility audit remain outside this review.

Verification on 2026-11-01: all 99 frontend tests across 19 files passed in an isolated sequential run, including the 11 care-journey cases and homepage entry-route integration. ESLint passed. The shared-theme check passed for 75 stylesheets, 128 components/pages and 37 shared tokens. Both the application and standalone concept built successfully. An earlier concurrent run exceeded the default five-second timeout in one test; without simultaneous lint/build jobs, the unchanged test passed in 675ms. No test timeout was relaxed.

Object-motion follow-up on 2026-11-01: the 11 care-journey tests, component lint, shared-theme check and production application build passed in the existing isolated dependency image with networking disabled. Browser samples measured about 419px of horizontal file travel on desktop and 194px at 390px viewport width. The file stayed inside the phone scene with no horizontal page overflow. Screenshots show the open shackle, intermediate transfer, received report and closed gate. No new dependency was added.

Hinge and connector refinement on 2026-11-01: the same checks passed after introducing the staged lift and right-hand pivot, and replacing the arrow/barrier with the transfer badge. Foreground browser recording captured the lifted shackle while rotation was still zero, the subsequent rightward swing, then the inverse closing sequence. At 390px, the connector is 36px wide, the scene has one lock, and the page has no horizontal overflow. Recorded GIFs and screenshots are stored with the local review artifacts.

Fixed-pivot correction on 2026-11-01 supersedes the staged lift: the entire shackle now performs a clockwise quarter-turn about its stationary bottom-right endpoint. Browser recording confirmed fill-box origin (16, 16) within the path's bounds, zero translation in its rotation matrices, no translating parent and no lift wrapper. Closing reverses the rotation. The 390px view retained one lock and no horizontal overflow; the 11 interaction tests, lint, theme check and build passed.
