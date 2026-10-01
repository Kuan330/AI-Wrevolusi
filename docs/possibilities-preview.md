# Possibilities and career exploration

Live route: `/possibilities`. It uses the signed-in account's confirmed tasks and current ESCO skill review. Career roles and their essential or optional skill links come from the pinned ESCO v1.2.0 catalogue. A current skill connection is included only when the user said “I use this” for a still-confirmed task. Developing interests are shown separately and do not count as current skill evidence.

Recommendations require at least one reviewed shared skill and return up to three roles. They are exploratory transferability directions, not a Malaysian occupation crosswalk, hiring prediction, salary or vacancy claim, or job-readiness rating. ESCO's official role-skill links describe European occupations. The UI shows the ESCO attribution, version, and the catalogue snapshot's retrieval date. If the catalogue or sufficient current skill evidence is unavailable, the page explains the evidence gap instead of falling back to generated WEF/ILO keyword matches.

Selecting an essential skill opens the learning catalogue with the skill name and chosen ESCO role carried into the search. The project does not have a reviewed ESCO-to-course crosswalk; the learning page labels results as name-search results and asks the user to assess each course. The progress-review flow remains an explicit, dated review of study and practice records.

The generated design preview at `/possibilities?demo=1` uses fictional profiles, skills, experiences and connections. Demo favourites use `aiwrevolusi.possibilities.demo.saved` and do not write to the real skill profile.

The central character is a generated raster portrait with a 3D appearance, not a WebGL model. Skill tags use CSS elliptical motion with upright labels, pause on hover/focus/selection, a manual pause control and static positions for small screens and reduced-motion preferences.

## Generated asset

Tool: built-in image_gen (not CLI).

Saved asset: `frontend/public/images/possibilities-avatar.png`.

Final prompt:

Use case: stylized-concept. Asset type: central avatar for a skills exploration web page. Generate a single polished 3D clay-render portrait bust of an adult woman, mature approachable face, dark shoulder-length softly waved hair, gentle confident smile, wearing a simple muted dusty-blue blouse. Front-facing waist-up composition, hands out of frame. Soft rounded sculptural forms, subtle realistic volumetric shading, tasteful professional illustration, warm soft studio light, not childish or exaggerated. Actual transparent background. Centered isolated subject, full head and shoulders with generous padding. No text, no labels, no circles, no decorations, no logos. This avatar will be displayed at 240px tall in a pastel blue and pink interface.

## Verification

Production build passed. Browser checks: skill selection, related-role filtering, role detail, favourites surviving refresh, inclusion of learning skills, mobile width and reduced-motion behavior. Lint has existing warnings outside this page.
