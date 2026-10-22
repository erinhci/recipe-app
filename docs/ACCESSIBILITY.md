# Accessibility audit

**Standard:** WCAG 2.2 AA, plus the Vercel Web Interface Guidelines ·
**Date:** 2026-10-11 · **Version audited:** 0.12.0, fixes shipped in 0.13.0

## Second audit: Oct 22, 2026 (0.40.5, fixes in 0.40.6 and 0.40.7)

By this point the visual design pass had added five cook colors, glass,
gradients and animation. Earlier contrast checks used one color (berry).
This audit measured all five, in light and dark, on the rendered page:
each text run against the actual pixels behind it (350 runs).

| Check | Before | After |
| --- | --- | --- |
| axe-core violations (11 screens × light and dark) | 0 | 0 |
| Text under its contrast minimum, any of 5 colors (1.4.3) | 2 surfaces: ocean primary buttons 4.03:1; dark-mode ingredient magnets 2.7 to 4.0:1 (orange, green, violet) | None; lowest ocean button 5.2:1, lowest small magnet text 4.5:1 |
| Sideways scrolling at 200% text (1.4.4, 1.4.10) | Stats (a hidden data table ignored its 1px width) | None |
| Content cut off at 320 px (1.4.10) | Avatar tabs; a cook-mode link at 200% text | None; tabs and links wrap |
| Focus ring hidden or covered (2.4.7, 2.4.11) | None | None |
| Submit buttons disabled until valid (3.3.1) | 5 forms | Enabled; an empty submit marks the field, explains, and moves focus |
| Inputs under 16px (iOS zoom) | Servings picker, 15px | 16px |
| Font sizes in px (ignore the phone text size) | 12 of about 20 sizes | 0; one rem scale of 11 sizes, 12px floor |

Also shipped in 0.40.7: typographic apostrophes (with a test), en dash
number ranges in steps, `text-wrap: pretty` on paragraphs, shared motion
tokens, a slow pulse for the loading indicator under reduced motion,
darker stroke shades for the current-step bar and timer pointer, and
borders for Windows High Contrast (`forced-colors`). 0.40.8 set tabular
figures on every number that changes on screen.

How it was run: the app ran locally with sample recipes and a stand-in
for Supabase (signed in, no network), then Playwright drove axe-core,
the 320 px and 200% checks, a keyboard tab walk on every screen, and the
per-color pixel contrast measurement.

## Summary (first audit, Oct 11)

The app passed automated checks before this pass, but manual review found
problems with keyboard focus, sticky bars, hover and dark-mode states, and
error wording. All of them are fixed in 0.13.0. The theme is now plain
black and white, so testing focuses on how the app works.

| Check | Before | After |
| --- | --- | --- |
| axe-core violations (8 screens × light and dark, WCAG 2.0 to 2.2 AA tags plus best practice) | 0 | 0 |
| Sideways scrolling at 320 px wide (1.4.10 Reflow) | None | None |
| Sideways scrolling with text at 200% (1.4.4 Resize Text) | Not checked | None |
| Focused control hidden behind a sticky bar (2.4.11) | Note box on the recipe page | None |
| Focused control with no visible focus ring (2.4.7) | Date field | None |
| Lowest text contrast, light / dark (1.4.3) | 7.1 / not measured | 7.0 / 7.0 |

Automated tools catch only some issues. The items under "Still to test"
need a person with a screen reader and a real phone.

## Findings and fixes

### Perceivable

| # | Issue | WCAG | Severity | Fix |
| --- | --- | --- | --- | --- |
| 1 | Native controls (select, date picker, checkboxes) stayed light in dark mode | 1.4.3, 1.4.11 | Major | `color-scheme: light dark` and a `color-scheme` meta tag, so the browser draws them to match |
| 2 | The theme's contrast ratios were estimates in comments | 1.4.3, 1.4.11 | Minor | Every token pair calculated; table below |
| 3 | Warnings (stale nutrition, a change that couldn't be applied, ingredient lines with no amount) relied on a yellow background | 1.4.1 | Minor | Neutral background plus a border or a left bar; the words already say what's wrong |
| 4 | The browser theme color was brick red | Guidelines | Minor | `theme-color` matches the page: white, or near-black in dark mode |

### Operable

| # | Issue | WCAG | Severity | Fix |
| --- | --- | --- | --- | --- |
| 5 | Tabbing to the note box left it behind the bottom menu | 2.4.11 Focus Not Obscured | Major | `scroll-padding` for the sticky bars, plus a small script that scrolls a focused control clear of the bottom bar or update banner |
| 6 | The date field showed no focus ring (focus sits on the field's inner parts) | 2.4.7 Focus Visible | Major | Form fields show the ring on `:focus` and `:focus-within` |
| 7 | The page heading showed a thick blue box each time a screen opened | Guidelines | Minor | Headings are focused on purpose (so screen readers start there) but aren't controls, so they no longer show the ring |
| 8 | Buttons, links, star ratings, and fields had no hover state | Guidelines | Minor | Hover states for each |
| 9 | Page padding ignored the iPhone home bar, so the last item could sit under the menu | 1.4.10 | Minor | Bottom padding includes the safe area, and cooking mode accounts for its taller step bar |

### Understandable

| # | Issue | WCAG | Severity | Fix |
| --- | --- | --- | --- | --- |
| 10 | Sync errors showed raw text like "TypeError: Failed to fetch" | 3.3.1 Error Identification | Major | "Couldn't reach the server. Changes are saved on this phone and will sync when the connection is back." Other errors say to try Sync now and show details below |
| 11 | Placeholder text didn't follow the guideline | Guidelines | Minor | "Add a note…" |

### Robust

| # | Issue | WCAG | Severity | Fix |
| --- | --- | --- | --- | --- |
| 12 | The "Opening your kitchen…" loading screen had no heading | 1.3.1 (best practice) | Minor | A visually hidden "Our Kitchen" heading |
| 13 | The what's-new panel after an update wasn't announced | 4.1.3 Status Messages | Minor | Announced politely when it appears |

## Color contrast

Calculated with the WCAG relative-luminance formula. Worst case for each
pair is listed (text on the plain background, on cards, and on gray notices).

| Element | Light | Dark | Required | Pass |
| --- | --- | --- | --- | --- |
| Body text | #111 on #f2f2f2, 16.9:1 | #f2f2f2 on #262626, 13.5:1 | 4.5:1 | Yes |
| Secondary text | #525252 on #f2f2f2, 7.0:1 | #b0b0b0 on #262626, 7.0:1 | 4.5:1 | Yes |
| Error text | #b3261e on #f2f2f2, 5.8:1 | #ff8a80 on #1c1c1c, 7.5:1 | 4.5:1 | Yes |
| Button text (hover, lowest) | #fff on #3a3a3a, 11.4:1 | #111 on #d0d0d0, 12.2:1 | 4.5:1 | Yes |
| Field and control borders | #767676 on #f2f2f2, 4.1:1 | #8a8a8a on #1c1c1c, 4.9:1 | 3:1 | Yes |
| Focus ring | #111 on #fff, 18.9:1 | #f2f2f2 on #121212, 16.7:1 | 3:1 | Yes |
| Dividers between items | #d4d4d4, 1.5:1 | #3d3d3d, 1.7:1 | Exempt | Decorative |

## Keyboard

Tabbed through the recipe page (23 stops), cooking mode, and Settings.

| Element | Tab order | Enter / Space | Arrow keys |
| --- | --- | --- | --- |
| Skip to content | First | Jumps to the page | — |
| Servings − and + | In reading order | Change servings | — |
| US / Metric | One stop for the group | Selects | Move between options |
| Star rating | One stop for the group | Selects | Move between stars |
| All ingredients, How this was estimated | In order | Opens and closes | — |
| Cooking mode steps | Previous and Next buttons | Move a step | Left and right move a step |

Nothing traps focus. Every stop showed a visible ring, and none ended up
behind the bottom menu or cooking mode's step bar.

## Screen reader (from the markup)

| Element | Announced as |
| --- | --- |
| Servings buttons | "One fewer serving, button", "One more serving, button" |
| Star rating | "Your rating, group", then "4 stars, radio button" |
| Cooking step | "Step 2 of 6", then the step text, announced when the step changes |
| Loading | "Gemini is estimating each ingredient…", once (not every second) |
| Recipe card rating | "3.5 out of 5" |

## Still to test

- VoiceOver on an iPhone, in the installed home-screen app: each screen's
  first announcement, the star rating, cooking mode's step changes, and the
  update banner.
- Text size set to the largest Dynamic Type size in iOS Settings.
- Voice Control: whether every button can be named and pressed.
- Cooking mode used from across the counter at arm's length.

## How to rerun the automated checks

Build with fake Supabase settings, serve the build, sign in a test user
in the browser, load sample data into IndexedDB, then run axe-core on each
screen in light and dark mode, check for sideways scrolling at 320 px and
at 200% text, and tab through each screen checking the focus ring and
whether a sticky bar covers it.
