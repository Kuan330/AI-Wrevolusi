# Possibilities preview

Route: `/possibilities?demo=1` (direct entry in development). All profiles, skills, experiences and career connections are explicitly fictional demo data. No recommendation API, user skill inference, job readiness score or live vacancies. Demo favourites use `aiwrevolusi.possibilities.demo.saved` and do not write to the real skill profile.

The central character is a generated raster portrait with a 3D appearance, not a WebGL model. Skill tags use CSS elliptical motion with upright labels, pause on hover/focus/selection, a manual pause control and static positions for small screens and reduced-motion preferences.

## Generated asset

Tool: built-in image_gen (not CLI).

Saved asset: `frontend/public/images/possibilities-avatar.png`.

Final prompt:

Use case: stylized-concept. Asset type: central avatar for a skills exploration web page. Generate a single polished 3D clay-render portrait bust of an adult woman, mature approachable face, dark shoulder-length softly waved hair, gentle confident smile, wearing a simple muted dusty-blue blouse. Front-facing waist-up composition, hands out of frame. Soft rounded sculptural forms, subtle realistic volumetric shading, tasteful professional illustration, warm soft studio light, not childish or exaggerated. Actual transparent background. Centered isolated subject, full head and shoulders with generous padding. No text, no labels, no circles, no decorations, no logos. This avatar will be displayed at 240px tall in a pastel blue and pink interface.

## Verification

Production build passed. Browser checks: skill selection, related-role filtering, role detail, favourites surviving refresh, inclusion of learning skills, mobile width and reduced-motion behavior. Lint has existing warnings outside this page.
