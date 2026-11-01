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

The six-phase loop takes 7.25 seconds, down from the initial 12.4-second concept. Phases last 1300 / 650 / 1550 / 1300 / 650 / 1800ms: report ready, approve, share, view logged, withdraw, future access blocked.

The report lock follows the user's physical padlock reference through three poses: locked, unlocked with the shackle lifted, and unlocked with the shackle turned. Opening lifts the shackle 7 SVG units over 180ms, holds the lifted pose for 240ms, then swivels it over 380ms around the vertical retained leg. The front projection narrows the upright U to an edge, then reveals it on the other side of the retained leg. The longer retained leg stays inside the body while the free end clears it. The body stays still. Closing reverses the swivel, holds, then lowers the shackle.

The two legs have different insertion depths: the free end finishes at SVG y=19 and the retained leg at y=27. After lifting, the retained leg still reaches y=20 inside the body, whose top is y=17. The swivel axis stays at x=24. Non-scaling stroke keeps the shackle visible during the edge-on part of the turn. After an 820ms lead-in, the report copy travels to the clinician over 650ms. The original report and recorded view remain in place when future access is withdrawn.

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

Baseline verification before the motion refinements: all 99 frontend tests across 19 files passed in an isolated sequential run, including the 11 care-journey cases and homepage entry-route integration. ESLint passed. The shared-theme check passed for 75 stylesheets, 128 components/pages and 37 shared tokens. Both the application and standalone concept built successfully. An earlier concurrent run exceeded the default five-second timeout in one test; without simultaneous lint/build jobs, the unchanged test passed in 675ms. No test timeout was relaxed.

Three-pose verification on 2026-11-01: the 11 care-journey tests, component lint, shared-theme check and production application build passed in the existing isolated dependency image with networking disabled. The timeline test reflects the rebalanced share/view holds. Foreground browser recording captured all three actual poses, the upright swivel and the inverse closing sequence. At 390px, the scene retains one lock, the original report, a 36px connector and no horizontal overflow. Keyboard operation shows the final pose immediately. The recorded poses and GIF are stored with the local review artifacts. No dependency was added.
