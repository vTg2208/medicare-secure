# Medicare homepage

The homepage introduces connected care through one illustrated story at a time: medical history, patient consent, and care coordination. An editorial split hero and a short getting-started journey replace the previous feature grid. Shared Medicare color tokens, Plus Jakarta Sans, the existing icon, and the shared theme control keep the public page consistent with login and clinical workspaces.

The carousel advances every seven seconds. Hover pauses temporarily; manual navigation and keyboard focus on navigation stop rotation until Play is selected. Rotation suspends when the carousel leaves the viewport or the document is hidden. Reduced-motion preferences start the carousel paused and remove transition effects. Controls include direct story selection, previous/next, play/pause, and horizontal touch swipes. Hidden stories are excluded from the accessibility tree; automatic changes do not produce live announcements.

The three custom illustrations were generated with the built-in image generation tool and optimized to 1000×750 WebP files totaling approximately 135 KB. Exact prompts and encoding details are recorded in `homepage-artwork.json`. No external image service or additional runtime dependency is required. React and CSS implement the interaction directly.

Demo calls to action lead to login. The global synthetic-data notice and restrictions on registration, uploads, email, and AI remain in effect. The homepage does not depend on an API request or expose backend availability indicators.

Validation covers automatic progression and wrapping, manual selection, pause/resume, keyboard focus, hover, document visibility, viewport visibility, reduced motion, touch navigation, and demo entry links. Browser review includes desktop light/dark and 320, 390, and 768 pixel layouts with stable slide dimensions.
