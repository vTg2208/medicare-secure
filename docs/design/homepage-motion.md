# Medicare homepage: show the care journey

The homepage must answer three questions before asking visitors to read further: what Medicare manages, who uses it, and how patients control sharing. The hero names medical records and the care team, then illustrates a report moving through a permission-controlled workflow.

For release, this introduction is added ahead of the existing homepage content. The illustrated feature carousel, its three stories, original onboarding steps and closing invitation remain below it. The former hero copy becomes a section heading, preserving one H1. Navigation, spacing, colors and typography use the same shared theme throughout. Repeated actions are consolidated into the introductory and closing registration links, with a separate care-team sign-in link.

## Principles implemented

- **Recognition:** familiar report, patient, clinician, switch and lock controls explain the product through actions. The same report remains visible throughout.
- **Hierarchy:** one primary action creates a patient account. Existing patients have a portal link; care teams have a separate sign-in section. Each uses the existing account routes.
- **Progressive disclosure:** one workflow occupies the hero. The existing carousel below it presents one illustrated feature at a time, followed by the original three onboarding steps.
- **Control and feedback:** boxed previous/next chevrons occupy the top-right corner, replacing the numerical step counter and bottom playback bar. Navigation wraps through all six steps. Pointer navigation restarts the 2.5-second hold and continues autoplay; keyboard navigation holds the selected step until focus leaves the illustration. Direct sharing/report interactions stay in manual mode until an arrow is used. Labels and access history explain state independently of color.
- **Consistency:** the existing Brand, ThemeToggle, Plus Jakarta Sans and semantic Medicare tokens supply typography, colors, light/dark surfaces, focus styling and elevation. No new dependency or competing palette is introduced.
- **Accessibility:** controls have names and visible focus, keyboard actions suppress immediate motion, the switch has a larger hit area, and both navigation arrows have at least 44px targets. Reduced-motion preference disables autoplay and decorative motion while preserving manual exploration through the arrows and sharing controls. Offscreen or background playback stops. Future history events remain hidden from assistive technology.
- **Truthful behavior:** withdrawal blocks future requests; it never removes the patient's original report or pretends to recall information already received. These public illustration controls never modify account permissions or access patient data.
- **Responsive composition:** the animation adapts to its container; the homepage becomes a single column on smaller screens. Care cards share their top edge and height. The care-team content has reserved text rows, centered icons and a stable action width, with bottom padding and a 48px-high action on narrow screens so wrapping labels do not move the layout.

## Motion

Every phase lasts 2500ms, giving a 15-second loop: report ready, approve, share, view logged, withdraw, future access blocked. One shared duration controls every phase. The timing test checks the boundary at 2499ms and 2500ms for all six phases. The longer hold lets visitors read the captions after the existing lock and file movements settle.

The report lock follows the user's physical padlock reference through three poses: locked, unlocked with the shackle lifted, and unlocked with the shackle turned. Opening lifts the shackle 7 SVG units over 180ms, pauses for 40ms, then swivels over 300ms around the vertical retained leg. The lift accelerates gently and settles before the swivel. Symmetrical easing gives the turn a gradual start and finish. The front projection narrows the upright U to an edge, then reveals it on the other side of the retained leg. The longer retained leg stays inside the body while the free end clears it. The body stays still. Closing uses a 300ms reverse swivel, 40ms pause and 180ms lowering motion. Opening finishes at 520ms; the file transfer then finishes within the same phase. Transitions retarget from their current positions when sharing is toggled mid-motion.

The two legs have different insertion depths: the free end finishes at SVG y=19 and the retained leg at y=27. After lifting, the retained leg still reaches y=20 inside the body, whose top is y=17. The swivel axis stays at x=24. Non-scaling stroke keeps the shackle visible during the edge-on part of the turn. After a 540ms lead-in, the report copy travels to the clinician over 440ms, finishing at 980ms. The original report and recorded view remain in place when future access is withdrawn.

The transfer uses container-relative transform distances, so it crosses the cards on both desktop and phone layouts instead of moving a few pixels inside the connector. Lock transitions remain interruptible. The automatic file sequence pauses when the illustration is offscreen, the tab is hidden or keyboard focus holds a step; reduced-motion and keyboard interactions show the resulting state immediately. Movement uses transforms and opacity; no layout properties animate.

The report carries the scene's only lock. The permission header, patient header, clinician preview, button and history avoid repeating it. The connector uses a circular transfer badge set into a softly tinted channel, with short docking leads that align with the cards. Its contrast increases when access is approved. The sharing switch separates its 48×28px pill track and 20px thumb from its 48×44px button hit area. This preserves the standard switch shape under the application's global minimum button height. Desktop and 390px browser checks verified both thumb positions, one lock and no phone-width horizontal overflow.

## References and interpretation

Public first-party pages informed the design direction; these are design interpretations rather than reproduced layouts or assets:

- [Linear](https://linear.app/): use concrete product workflows to explain the product.
- [Stripe](https://stripe.com/): connect an explicit benefit to a clear action and tangible interface.
- [Apple Health](https://www.apple.com/health/): use approachable health language and make personal control visible.

Medicare retains its own identity. No customer statistics, certification badges, or regulatory-compliance guarantees are invented.

## Review boundary

This branch implements the redesigned homepage and reusable care-journey illustration. It does not claim a completed usability audit of every authenticated clinical screen. Existing workflow functionality remains behind the same account routes.

The local preview uses isolated sources and no production account data. Browser review covers the built homepage at desktop and narrow viewport sizes, including intermediate file positions, card alignment and the settled light/dark states. Physical-device testing and a complete accessibility audit remain outside this review.

Baseline verification before the motion refinements: all 99 frontend tests across 19 files passed in an isolated sequential run, including the 11 care-journey cases and homepage entry-route integration. ESLint passed. The shared-theme check passed for 75 stylesheets, 128 components/pages and 37 shared tokens. Both the application and standalone concept built successfully. An earlier concurrent run exceeded the default five-second timeout in one test; without simultaneous lint/build jobs, the unchanged test passed in 675ms. No test timeout was relaxed.

Three-pose verification on 2026-11-01: the 11 care-journey tests, component lint, shared-theme check and production application build passed in the existing isolated dependency image with networking disabled. The timeline test reflects the rebalanced share/view holds. Foreground browser recording captured all three actual poses, the upright swivel and the inverse closing sequence. At 390px, the scene retains one lock, the original report, a 36px connector and no horizontal overflow. Keyboard operation shows the final pose immediately. The recorded poses and GIF are stored with the local review artifacts. No dependency was added.

Release validation against current production: all 110 frontend tests across 23 files, full frontend lint, the shared-theme check and the production build passed. The integration test checks that the sharing introduction precedes the retained feature carousel and that the original onboarding and both audience entry routes remain present. Browser review covered the combined desktop layout, carousel navigation, closing invitation, light/dark tokens and a 390px layout with one H1, one carousel and no horizontal overflow. The release modifies only the seven homepage-related files; no backend or database changes are included.

Current cleanup verification: 23 homepage, journey and carousel tests passed; ESLint, shared-theme checks and the production build passed. Browser review at 360px, 390px and 810px confirmed no horizontal overflow, equal care-card heights and top edges, centered 48px-high actions and consistent bottom insets in both allowed and protected states.

Arrow-navigation verification: 26 targeted homepage, care-journey and carousel checks passed, with strict frontend lint, the shared-theme check and the production build. Regressions cover both wrap directions, one-second timer reset, pointer autoplay after focus, keyboard holds and blur resume, reduced motion and history reset. Browser review at 320px, 360px, 390px and 810px found no overflow or header overlap, with 44px navigation targets and matching care-card alignment. Pointer navigation continued advancing automatically; both shared themes were reviewed.

Pacing follow-up: the owner requested a slower sequence after reviewing the one-second version. Each step now holds for 2500ms (15 seconds overall), with all six 2499/2500ms boundaries covered. Keyboard-only focus pauses playback; pointer focus arriving after a navigation click does not. The 28 targeted checks, lint, shared-theme validation and production build passed. Browser review reproduced keyboard-to-pointer navigation and confirmed continued autoplay with the longer hold.
