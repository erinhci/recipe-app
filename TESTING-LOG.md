# Testing log

What came up while Erin and her partner used the app at home, and how the
product changed because of it. Newest first. Each entry lists what we saw,
what changed, and the commit, so the case study can trace a finding to the
build.

The partner is referred to as "Partner" here because this file may be public.

## Summary

| Date | Finding | Outcome | Commit |
| --- | --- | --- | --- |
| 2026-10-12 | Two-chef mode: a step's ingredients were hard to spot on a scan; the tester left two-chef mode to check the ingredient list | Open. Redesign drawn on the design canvas (Oct 13): a "You'll need" card above the step text, with a checkbox per ingredient and a link to the full list | See entry |
| 2026-10-12 | Reviewing all screens side by side in Figma: main buttons still on the left (Save recipe, Sort it, Choose files, Estimate again, Stop cooking); Restore and Delete forever too close | Main actions on the right; ways out and deletes on the far left of the same row; Stop cooking stays left with space above, away from Log it (0.25.1) | `601b604` |
| 2026-10-11 | Exploratory walkthrough: "it looks like a bunch of big blocks of text" | Text density pass: shorter copy, icon tab bar and facts row, compact nutrition (0.25.0); all eight screens moved to Figma, light and dark, bound to the theme's tokens | See entry |
| 2026-10-11 | US/Metric toggle and the Units setting changed nothing; the two-chef plan felt redundant; whose step is whose still not distinct enough | Units set once (Settings or setup) and applied everywhere, cups convert in metric; plan removed; You / other cook / Together labels (0.24.0) | See entry |
| 2026-10-11 | Cooking screens review: "what does fold mean" isn't relevant; Ask on the left; no way to log a change mid-recipe; steps hard to scan. Plus the open severity 3s (the other cook's steps, overview, nutrition for what was made) and library filtering | Suggested questions per step, change log per cook with servings and nutrition, bold actions and amounts, scroll focus, two-chef plan and reminders, library search, sort, and filters (0.23.0) | See entry |
| 2026-10-11 | Heuristic evaluation, round 1 (Library, Add a recipe, Stats, Settings): crowded cards, add button out of reach and limited, cluttered import, list-heavy stats, slow kitchen list, no permanent delete, odd Sign out placement, meaningless build code | Fixed in 0.22.0 | See entry |
| 2026-10-11 | Erin: add photos now, limited so storage can't fill by accident, and both cooks can see and add them | Built: one photo per cook per meal, shrunk to about 300 KB, 500 per kitchen, synced (0.21.0) | See entry |
| 2026-10-11 | Severity 3: the shared step waits for check-offs that Partner skips with dirty hands | One tap catches up earlier steps; shared steps no longer lock (0.20.0) | See entry |
| 2026-10-11 | Nine open findings rated on Nielsen's severity scale | Four rated 3 (major) and fixed first; then the same tasks are tested again with Partner | See entry |
| 2026-10-11 | After the debrief: the "Start now" note was too prescriptive; Partner wants the times and to decide himself | Note removed; prep and cook times added to recipes and shown before cooking (0.19.1) | See entry |
| 2026-10-11 | First two-chef cook (egg bites): mismatched amounts in steps, a skipped preheat, idle waiting, missed hand-off, no way to note a change mid-cook, and more | Fixes and additions in 0.19.0; ounces for weighing and Partner's preference for the step list are open | See entry |
| 2026-10-11 | Partner's PDF import was refused for being over 8 MB, and a recipe link failed with a vague error | Large PDFs read on the phone and sent as text or page images; links fetched like a browser with a backup reader; specific error messages (0.18.1) | See entry |
| 2026-10-11 | Two-chef mode from the plan wasn't built yet | Built: Gemini split, pick a part, live check-offs on both phones, shared steps, hand-offs (0.18.0) | See entry |
| 2026-10-11 | Cooking mode hid every step but the current one, which is hard when hands are busy or messy | Upcoming steps listed under the current one; finished steps under Done (0.17.0) | See entry |
| 2026-10-11 | Typing minutes for each meal was tedious, and the time is an estimate anyway | Each recipe's total time is added once per logged meal; cooking mode's Finish logs the meal; manual minutes and timed sessions removed (0.16.0) | See entry |
| 2026-10-11 | Cooking time could only come from cooking mode, and couldn't be seen or removed | Minutes can be added in the cook log; each day shows its time with Remove time (0.15.0), replaced in 0.16.0 | See entry |
| 2026-10-11 | No way to keep a rating after a recipe edit; ratings and cook log too large; "Show original" did nothing useful | Keep-rating option, compact ratings and log, breakdown shown once, servings reset link (0.14.0) | See entry |
| 2026-10-11 | Before deeper user testing, the look should be plain and the app should meet WCAG 2.2 AA | Black-and-white theme, spacing cleanup, accessibility audit and fixes (0.13.0) | See entry |
| 2026-10-11 | Keeping earlier versions of every recipe isn't needed; the note already says what changed | Earlier versions removed; only a short note-to-change record is kept | See entry |
| 2026-10-11 | The version in Settings (a commit code) said nothing useful | Version numbers with plain-language notes; what's new after updating | See entry |
| 2026-10-11 | Keeping imported screenshots and PDFs is clutter once the recipe is checked | Originals no longer saved; the recipe's credit is kept instead | See entry |
| 2026-10-11 | Want photos of finished dishes, to see how it turned out and for stats later | Planned (Later), synced between phones; built in 0.21.0 | See entry |
| 2026-10-11 | The update banner never appeared; updates showed up later on their own | Banner pinned to the top of the screen; checks for updates more often | See entry |
| 2026-10-11 | Notes looked like big cards, the app's own note offered "Turn into a recipe change", and a note could be applied again | Notes look like a comments thread; a used note can't be applied twice | See entry |
| 2026-10-11 | Waiting on Gemini looked like a frozen screen | Loading indicator; faster settings per task | `1a7579d` |
| 2026-10-11 | Phones kept showing an older version after updates shipped | App offers updates and shows its version | `e8b0626` |
| 2026-10-11 | A note asking for two changes only got one, and saving added a duplicate note | Every part of a note is covered or flagged; no duplicate note | `f39d1d0` |
| 2026-10-11 | Partner wants calorie and protein estimates for recipes | Nutrition estimates added to the MVP | `622fb5c` |
| 2026-10-11 | Logging after midnight defaults to the wrong day | Open | Not built |
| 2026-10-11 | Rating each meal felt like a repeat of rating the recipe | Ratings moved to the recipe | `b14becf` |
| 2026-10-11 | Both cooks logged the same dinner, so ratings split across two entries | Same recipe and date count as one meal | `3d71b97` |
| 2026-10-11 | Setting up the kitchen showed there was no way to remove a member | Remove a member or leave a kitchen | `7cd9031` |

## 2026-10-12: Step ingredients hard to find in two-chef mode (open)

**Finding.** Feedback after a two-chef cook: on a quick scan, the tester
couldn't tell the current step apart from the ingredients that step needs.
To find the amounts, they left two-chef mode and opened the recipe's
ingredient list.

**Reasoning.** The "You'll need" list sat under the large step text and the
timer, in the same type as the steps, so it read as more instructions.
Leaving the mode mid-cook loses your place and breaks the hand-off between
the two phones. Severity 3 (Major): it interrupted the task, and it applies
to every step that uses ingredients.

**Change (designed, not built).** On the design canvas, the step's
ingredients move above the step text into their own card ("You'll need",
with a count), one checkbox per ingredient to tick off as you measure, and
a link to all ingredients for the recipe without leaving the mode. Check it
in the next two-chef session.

## 2026-10-12: Button placement across screens

**Finding.** Looking at all eight screens side by side in Figma, Erin saw
that several main buttons still sat on the left, out of thumb reach: Save
recipe and Cancel, Sort it, Choose files, Estimate again, and Stop cooking.
Restore and Delete forever in Recently Deleted were stacked right next to
each other. Moving Stop cooking to the right would have put it directly
under Log it.

**Reasoning.** Two separate problems. Reach: the main action on a phone
is fastest to hit on the right, near the thumb (Fitts's law, distance to
the target). Mis-taps: a rare or destructive action placed next to a
frequent one gets hit by accident. That is error prevention (Nielsen's
heuristic 5), and the fix is distance between the two.

**Change (version 0.25.1).** One rule for every action row:

- The main action sits on the right: Save recipe, Sort it, Choose files,
  Estimate again, Sync now, Edit, Restore.
- When a row has a way out or a delete, it goes to the far left of the
  same row: Cancel, Delete, Delete forever.
- Stop cooking stays on the left by itself, with extra space above it,
  so it isn't under Log it. The close button at the top does the same
  thing.

**Commit.** `601b604`

## 2026-10-11: Text density pass

**Finding.** From an exploratory walkthrough: "I feel like you got to stop
working on the functionality and start working on the aesthetics because I
feel like it looks like a bunch of big blocks of text."

**Decision.** Erin split the feedback in two. The density of text is a
hierarchy problem that can be fixed inside the plain theme now; the
visual identity (type, color, motion) moves to Figma as its own phase, as
planned when the plain theme was chosen. The plain phase ends here on
purpose: every open severity 3 is built and the core flows have held for
several rounds, so further testing would start reacting to the look.

**Change (version 0.25.0).**

- Tab bar: an icon over each label; "Import" is now "Add", matching the
  page title "Add a recipe".
- Recipe page: average rating, times made, prep and cook time, and cuisine
  in one row with icons, instead of two text lines; each cook's own rating
  moved to the rating section. Start cooking and Two chefs sit side by
  side with icons. Nutrition shows four numbers (calories, protein, carbs,
  fat per serving), with portions and the per-ingredient breakdown in one
  collapsed section. The cook log drops its explanation line, and each day
  reads "Oct 12, 2026 · Erin".
- Cooking modes: "Screen stays on" only appears when it can't; the step's
  time is part of its heading; "Changes this time" and "Ask" show a note
  only after something happens.
- Shorter hints throughout (servings, the scaling note, the edit form,
  Stats, Settings).

**Measured.** Visible words on each page, same sample data, before and
after:

| Page | Before | After | Change |
| --- | --- | --- | --- |
| Library | 103 | 103 | +0% |
| Recipe | 379 | 289 | -24% |
| Cooking mode | 199 | 169 | -15% |
| Two-chef mode | 292 | 261 | -11% |
| Add a recipe | 55 | 55 | +0% |
| Stats | 243 | 225 | -7% |
| Settings | 156 | 148 | -5% |
| Edit recipe | 156 | 106 | -32% |

Recipe text itself (steps and ingredients) is unchanged; the cuts are in
the app's own copy. No accessibility violations (axe) after the changes.

**Handoff to Figma.** The eight main screens (Library, Recipe, Cooking
mode, Two chefs, Add a recipe, Stats, Settings, Edit recipe) are in a
Figma file, light and dark, 390 px wide, built from the 0.25.0 build with
the same sample data. Every color, the corner radius, and the text sizes
are bound to variables named after the CSS tokens (for example
`light/accent` and `dark/accent` both map to `var(--color-accent)`), so a
change to a token changes every screen. Light and dark are two groups of
variables because the Figma Starter plan allows one mode per collection.
Photos are grey placeholders. Layers are positioned to match the app, not
auto-layout, so they can be moved freely while exploring.

**Next.** Visual identity in Figma (type, color, motion), starting from
that file.

## 2026-10-11: Units that do something, and whose step is whose

**What Erin found** (cooking egg bites in two-chef mode with Partner):

- The US and Metric buttons on the recipe page didn't change any amounts,
  and neither did Units in Settings: "it's a useless button." Units are
  standard for a person, so they belong in Settings only, possibly chosen
  during onboarding with your name.
- "The whole recipe at the top is too much and redundant": the step list,
  with your part in full and the other cook's condensed, already gives the
  overview.
- "The distinction between Brian's and my next steps still doesn't feel
  distinct enough."
- She was given the pan steps instead of the egg mixture; after a refresh
  it was right. Not reproduced. A step handed over with "Give this step"
  stays with the other cook for the rest of that cook (until Finish, or 6
  hours), which would look like this.

**Cause of the units bug.** Metric kept spoon measures as spoons, and also
turned any small amount into spoons. At 2 servings every amount in the egg
bites was small, so switching changed nothing.

**Change (version 0.24.0).**

| Finding | Change |
| --- | --- |
| Units buttons did nothing | In metric, amounts written in cups or fluid ounces show in milliliters at any size (a quarter cup at 2 of 6 servings is "20 ml", not "4 tsp"); weights show in grams. Spoon measures stay spoons, since they're the same everywhere |
| Units in two places | The toggle is gone from the recipe page; Settings decides for every recipe and both cooking modes, with a hint saying so |
| Onboarding | Setting up or joining a kitchen asks for measurements with your name, defaulting to US on US English phones and metric elsewhere |
| Redundant plan | "Your plan" removed from two-chef mode |
| Whose step is whose | Each step starts with a label: a filled "You", a dashed outline with the other cook's name, or "Together". The other cook's steps sit indented behind a dashed rule, and the step they're on has a dashed outline with "Brian is here" in the label. The step-in-view highlight only applies to your steps. Shape and fill carry the difference, not color |

**How it was checked.** Unit tests for metric milliliters at small sizes.
Two phones against a fake server: the plan card is gone, labels read
"You", "Brian is here", and "Together", one dashed outline for the other
cook's step, and no accessibility violations (axe). With metric set in
Settings, the recipe page showed "225 g spaghetti" and had no units
toggle.

## 2026-10-11: Cooking screens and the open severity 3s

**What Erin found** (reviewing solo and two-chef cooking on her phone):

- The example question "What does fold in mean?" is confusing when the
  recipe has no folding. A likely question for the step, ready to tap,
  "feels more intelligent", with typing your own still possible.
- The Ask button sat on the left, under the field; the right is expected.
- "Note for next time" doesn't allow for changes mid-recipe.
- An animation that brings each step forward while scrolling could help
  the earlier pain point of telling steps apart.
- Bolding key actions and measurements would help someone scan a step.
- The library needs filtering and sorting soon.

**Decision.** A change made while cooking is saved with that day's cook,
and the recipe stays as written; any change can still update the recipe.
This answers the tension from the egg bite debrief between notes and
Partner's request for "a history mode... with the portioning of that time
we made it." Erin also moved the three open severity 3 findings into this
build.

**Change (version 0.23.0, migration 0011).**

| Finding | Change |
| --- | --- |
| Irrelevant example question | Gemini suggests the 2 questions a cook is most likely to ask at each step (doneness, timing, swaps). Tap one to ask it. Suggestions are made once per version of the steps and kept on the phone |
| Ask on the left | The question field and Ask button share a row, Ask on the right |
| No way to log a change mid-recipe | "Changes this time" replaces "Note for next time": a change is saved with today's cook, listed on that day in the cook log, and has "Update recipe", which opens the existing note-to-recipe-change flow |
| No record of each cook (severity 2) | Each cook records the servings made (from cooking mode, or a picker in the log) and its changes |
| Nutrition doesn't reflect changes made mid-cook (severity 3) | Each cook shows calories and protein for what was made: the recipe estimate scaled to the servings, plus Gemini's estimate of the logged changes |
| Hard to scan steps | Actions that start a sentence or clause, amounts with units, temperatures, and times are bold |
| Telling steps apart while scrolling | The step nearest the middle of the screen gets a bar and grows slightly as you scroll; with reduced motion it gets the bar only |
| The other cook's steps look too similar (severity 3) | In two-chef mode the other cook's steps are one-line reminders, with a button to show them in full |
| No overview before starting (severity 3, open part) | "Your plan" at the top of two-chef mode: your steps and shared steps with their times, the other cook's runs folded into one line, open until the first check-off |
| Library filtering | Search across titles, cuisines, and ingredients; sort by recently added, most made, top rated, quickest, or A to Z; chips for not made yet, meal types, and cuisines. The view is remembered on the phone |

**Fixed along the way.** Amounts in step text now match an ingredient
when the import rounded them (0.3 cup in the list, 1/3 cup in the step),
so they scale too. Changes for a table or column that a migration hasn't
added yet wait on the phone instead of being dropped.

**How it was checked.** Unit tests for emphasis, rounded amounts, per-cook
nutrition, library filtering and sorting, the suggestion function, and
changes waiting for a migration. In the browser against a fake server:
suggestions loaded and answered, a change was logged and sent with
today's date, Finish saved 2 servings, and the change estimate raised the
cook's nutrition; two-chef mode showed the plan and three reminders,
which expanded; library filters and sort narrowed and reordered. No
accessibility violations (axe) in light or dark mode.

**Setup.** Run migration 0011 and redeploy `ask-step`. Until then, changes
and servings stay on the phone and suggestions don't appear.

## 2026-10-11: Heuristic evaluation, round 1

**Method.** Erin went through the app page by page on her phone (dark
mode) and noted problems, then the matching fixes were built. Her
screenshots from 8:00 PM, before the changes, are the "before" set. The
heuristic column names the Nielsen heuristic (or principle) each problem
falls under.

| Page | What Erin found | Heuristic | Change (0.22.0) |
| --- | --- | --- | --- |
| Library | "Add recipe" sat at the top, out of the thumb zone, and went straight to typing from scratch, "already an import option and the least efficient" | Flexibility and efficiency of use; thumb reach (Fitts's law) | A rounded "+ Add recipe" button sits bottom right, above the tab bar, and opens every way to add a recipe |
| Library | Cards were small, "to the point of looking crowded and overwhelming" | Aesthetic and minimalist design | Larger cards with more space between them; the whole card is the link (no underlined title); every card has an 80 px picture, the newest photo or the recipe's first letter, so rows line up |
| Add a recipe | "Cluttered and overwhelming"; choosing a file still needed a "Read recipe" button on every card | Aesthetic and minimalist design; flexibility and efficiency | Screenshots, photos, and PDFs share one card with a "Choose files" button, and reading starts when files are chosen; the card says so first, per WCAG 3.2.2 (On Input). Pasting a link starts reading too; a typed link uses a short Go button. Labels are the card headings, so each card has less text |
| Add a recipe | Typing from scratch was a small link here but had its own button on the Library | Consistency and standards | "Type it in yourself" is a full-width button at the bottom |
| Stats | Bullet lists and equal bars read as "clutter and overwhelm"; asked for charts and badges to make it feel like a game | Aesthetic and minimalist design; recognition rather than recall | Three stat tiles (meals, time together, cuisines); milestones as badges, earned ones filled and the next one per track outlined with a progress meter; a column chart of meals by week (last 8 weeks, with a table for screen readers); shares of all meals as thin meters with counts and percents; top ingredients as chips |
| Settings | "Your kitchen" took a second to show who's in it, though it rarely changes | Visibility of system status | Read from the phone's synced copy, so it shows at once and offline |
| Settings | Recently Deleted had no way to delete for good | User control and freedom | "Delete forever" under Restore, with a confirmation that lists what goes with it; photo files are removed from storage too |
| Settings | Sign out sat on the left between Sync and Version | Consistency and standards (where people expect it) | Sign out is the last thing on the page, aligned right |
| Settings | "build c0a5608" means nothing to users | Match between system and the real world | Only the version number and release date show |

**How it was checked.** Automated tests for the weekly counts and for
deleting forever (rows and photo files). Both color schemes screenshotted
at phone size against a fake server, with no accessibility violations
(axe) on any of the four pages. Choosing a file and pasting a link each
went straight to the review screen.

**Open.** Recipes that sit in Recently Deleted for 30 days are removed by
the daily cleanup, but their photo files stay in storage. Deleting forever
from the app removes them.

## 2026-10-11: Photos of finished dishes

**Decision.** Erin moved photos up from Later: "a quick and high impact
UI." Two conditions: storage can't fill up by accident, and both cooks
can see and add photos.

**Change (version 0.21.0, migration 0010).**

- Each day in the cook log has "Add photo". Each cook can add one photo
  per meal; adding another replaces theirs, so a meal has at most two.
  Right after cooking, the rating section offers "Add a photo of how it
  turned out".
- The newest photo shows at the top of the recipe, with the date and who
  added it, and as a small picture on the recipe's card in the library.
  Tapping a photo in the log opens it larger, with Remove.
- Removing a meal from the log removes its photos too, and the
  confirmation says so.

**Limits on storage.** Photos are shrunk on the phone to a JPEG of about
300 KB, at most 1280 pixels on the long side. The database holds the same
limits in case a phone doesn't: files over 500 KB or not JPEG are refused
by the storage bucket, one photo per cook per meal, and 500 photos per
kitchen (about 150 MB of the free 1 GB). A removed photo's file is deleted
from storage, so nothing is left behind.

**Offline.** A photo is saved on the phone first and uploads when the
phone is online; the file goes up before its record, so the other phone
never sees a photo without its image. Photos from the other phone are
downloaded once and kept, so they show offline after that.

**How it was tested.** Database rules in an in-memory Postgres (one photo
each per meal, the 500 KB and 500-photo limits, no access from another
kitchen). Sync tests for the upload order, replacing, removing before
upload, refusals, and removal from the other phone. Two phones against a
fake server: Erin added and replaced a photo, Partner's library and
recipe showed it, he added his own and removed it, and removing the meal
removed the rest. No accessibility violations (axe), and the photo picker
is a labeled file input reachable by keyboard.

## 2026-10-11: Check-offs that don't hold up the cook

**Finding (severity 3).** Two-chef mode locked a shared step until every
step before it was checked off. Partner skips check-offs when his hands
are dirty ("Skip over mostly") and caught up later by checking several at
once, so the waiting logic was wrong for most of the cook. He also didn't
want voice commands.

**Change (version 0.20.0).**

- Checking off a step also checks your own earlier steps that aren't
  checked. Checking a shared step checks every step before it, on both
  parts, since the parts have come together. One tap catches up.
- The message says which steps were checked ("Steps 3 and 4 done.") with
  Undo next to it. Unchecking a step only unchecks that one.
- Shared steps no longer lock. When the other cook's part isn't checked
  off, the step says so ("Brian hasn't checked off step 3 yet. Start when
  you're both ready.") with the tidy-up tasks, and the cooks decide when
  to start. This follows the earlier decision to give cooks the facts
  rather than instructions.

**How it was tested.** Unit tests for the catch-up rules, and two phones
against a fake server: Erin reached the shared step with Partner's step
unchecked, checked the shared step, and both phones showed steps 3 and 4
done; Undo reverted both; Partner checked only the shared step from the
list and caught up the same way. No accessibility violations (axe).

**For the next session.** Watch whether Partner checks off more often now
that one tap covers several steps, and whether anyone checks a step ahead
by mistake.

## 2026-10-11: Severity ratings, round 1

**Method.** Erin rated each finding still open after the egg bite session
on Nielsen's 0 to 4 severity scale
([Nielsen, 1994](https://www.nngroup.com/articles/how-to-rate-the-severity-of-usability-problems/)),
weighing frequency (common or rare), impact (easy or hard to overcome) and
persistence (once, or every time). Fixes from 0.19.0 and 0.19.1 aren't
rated, since the next session tests them.

| Rating | Meaning (Nielsen's wording) |
| --- | --- |
| 0 | I don't agree that this is a usability problem at all |
| 1 | Cosmetic problem only: need not be fixed unless extra time is available on project |
| 2 | Minor usability problem: fixing this should be given low priority |
| 3 | Major usability problem: important to fix, so should be given high priority |
| 4 | Usability catastrophe: imperative to fix this before product can be released |

| Finding | Evidence | Severity | Reasoning |
| --- | --- | --- | --- |
| The shared step waits for check-offs that people skip | Partner: "Skip over mostly, because sometimes in between steps my hands are dirty"; he caught up by checking several at once | 3 | High frequency: skipped on most steps, every cook. Persistent: hands are dirty every time. Impact: Partner caught up by checking several at once, so the cook finished, but the waiting and "together" logic is wrong until he does |
| The other cook's steps look too much like your own | Partner: "a little more grayed out, but not enough… do I need to do this?" | 3 | Frequent: every step of every two-chef cook. Persistent. Impact: Partner stopped to work out whether a step was his and said there was "kind of a lot going on" |
| The large next-step card goes unused | Partner: "I just like having a scrollable list"; Erin's notes: "[Partner] wasn't using large text" | 1 | Doesn't block the cook: Partner used the step list instead, and it worked. Low confidence, since the evidence comes from one participant in one session |
| No overview of the whole cook before starting | Partner: "time estimates near the beginning… so I can kind of visualize the whole process" | 3 | Partly fixed in 0.19.1 (prep and cook times at the top). Still open: seeing all of your steps and their times before starting. Re-rate after the next session |
| Unclear whether changing servings mid-cook changes the saved recipe | Partner: "I wasn't sure if editing the servings… would affect the fully saved recipe or just this session" | 2 | Partner hesitated once; no wrong amounts resulted. Likely to come up whenever a cook is scaled mid-cook |
| Nutrition doesn't reflect changes made mid-cook | Partner "ended up looking up the macronutrients on a separate app" | 3 | Raising servings on the recipe page is a workaround in the app, but it's a roundabout extra step he didn't find, and it scales every ingredient, so it only approximates added eggs or vegetables |
| No record of each cook: servings, changes, notes | Partner: "maybe a history mode… with the portioning of that time we made it" | 2 | Doesn't block the cook. Same root as the nutrition and ounces findings: the app knows the recipe, not what was actually cooked |
| Amounts can't be shown by weight (ounces) | Erin's notes: "[Partner] preferred using oz instead of cups for measuring out chicken (he's tracking protein)" | 2 | Frequent for Partner, low impact: nothing shows it stopped him, and he can weigh the chicken himself |
| Logging after midnight defaults to the next day | Found Oct 10 | 1 | Low frequency, can be caught and edited, and a change might clash with what users expect |

**Changes to the first ratings after review.** Check-offs went from 4 to 3:
the cook finished and nothing in the session was blocked by a stale
check-off, though the logic is wrong until someone catches up. Ounces went
from 3 to 2, since its first reasoning (needing another app) belonged to
the nutrition finding.

**Limitations.** One rater (Erin), one session, and one participant who
also uses the app daily. Nielsen recommends averaging three to five
evaluators. No second rater was available, so these ratings get revisited
after the next session.

**Next.** Fix the 3s first: check-offs gating the shared step, the other
cook's steps, nutrition after mid-cook changes, and the open part of the
overview. Nutrition, the per-cook record and ounces share a root and are
planned as one cluster. Then test the same tasks with Partner again.

## 2026-10-11: Times instead of instructions

**Finding.** In the egg bite debrief, Partner explained he skipped the
preheat step on purpose: a new oven, not knowing how long prep would
take, and not wanting it running too long. Knowing the oven now, he'd
make the same call. 0.19.0 had added a "Start now" note to steps like
preheating, which tells the cook what to do instead of giving them what
they need to decide.

**Decision.** Erin: their oven heats fast, so preheating stays a
regular step. Cooks see the prep and cook time and decide for
themselves.

**Change (version 0.19.1).**

- The "Start now" note is gone from two-chef mode, and the split no
  longer asks Gemini for one.
- Recipes have separate prep and cook times (migration 0009), next to the
  total. Imports read them from the page or the recipe, and Gemini
  estimates them when they aren't given. Edit has Prep, Cook, and Total
  fields; a blank total is prep plus cook.
- The recipe page and the top of both cooking modes show "Prep 10 min ·
  Cook 20 min". Two-chef mode adds the time left, from the split's step
  times.

## 2026-10-11: First two-chef cook (egg bites)

**Session.** Erin and Partner made egg bites (6 servings) in two-chef mode
on two phones. Gemini split the recipe into "Egg Mixture" (Erin) and "Pan
and Fillings" (Partner), with pouring and baking as a shared step. Erin
took notes and screenshots and recorded a 15-minute voice memo (transcript
to follow).

**Findings and changes (version 0.19.0).**

| # | Finding | Change |
| --- | --- | --- |
| 1 | The app opens at 2 servings and Erin forgot to change it. "You'll need" showed 2-serving amounts (1 1/3 eggs) while the step text still said "4 large eggs", so they used the wrong amounts before noticing | Amounts in step text are rewritten to match the scaled ingredient list and shown in bold. An amount only changes when it matches an ingredient's original amount and the ingredient's name follows it, so counts like "6 muffin cups" and times stay as written |
| 2 | Same session: the servings weren't visible enough in cooking mode to catch the mistake | Both cooking modes show a servings stepper and "The recipe makes 6, so amounts are scaled. Make 6". In two-chef mode the servings live on the shared cook, so both phones always show the same amounts |
| 3 | Partner skipped step 1 (preheat the oven) because he didn't want to preheat too early | The split now includes about how long each step takes and a "Start now" note for steps that need a head start, like "The oven takes about 10 minutes to heat…" |
| 4 | Partner asked "How long does it take to cook?" | Two-chef mode shows "About N min left" at the top, from the step times; regular cooking mode shows the recipe's total time |
| 5 | Erin finished her part early (the new oven took Partner longer to set up) and stood waiting | The waiting screen says who is on which step, where the two parts meet again ("You'll work together at step 5…"), and a few tidy-up tasks for that part from the split, like "Toss the egg shells" and "Put away the seasonings" |
| 6 | Partner didn't see the option to give a step to the other cook; with one step each it's easy to miss | "Give this step to Erin" sits right under the Done button |
| 7 | Partner didn't use the large next-step card; he scrolled the list of all steps instead | The list marks "Your next step" with a border and shows where the other cook is ("Erin is here"). Whether the large card is needed at all stays open |
| 8 | Two-chef mode had no step questions | "Ask about step N" works in two-chef mode, and answers use the scaled amounts |
| 9 | They added a teaspoon of chicken bouillon mid-cook and had nowhere to record it | "Note for next time" in both cooking modes saves to the recipe's notes, where it can become a recipe change |
| 10 | The only way out of cooking mode was a button at the bottom | An X at the top right of both cooking modes |
| 11 | Ratings only allowed whole stars | Half stars, set by tapping or dragging across the stars (as in Letterboxd). It's a standard slider underneath, so it works with a screen reader and arrow keys |

**Open.**

- Partner measures chicken in ounces, not cups, because he tracks protein.
  Showing weights for ingredients written by volume needs a weight for
  each ingredient (a density table or Gemini), so it's left for later.
- Whether the large next-step card earns its space in two-chef mode, given
  Partner preferred the list. Worth watching in the next session.

**Debrief (from the 15-minute recording).** Erin asked the debrief
questions right after cooking. Partner's answers, lightly cleaned up:

| Topic | What Partner said | What it points to |
| --- | --- | --- |
| Knowing what to do next | "No… the recipe list was pretty straightforward." | The split itself worked |
| Asking how long it cooks | He was at the oven with his phone on the table: "I didn't really have the hands to carry my phone… I didn't look ahead" | Timing has to be visible at a glance, before hands are full |
| Skipping the preheat | First time with a new oven, unsure how long prep would take: "didn't want to waste the energy just having the oven run for too long." Knowing the oven now, he'd make the same call, just with better timing | He wants the facts to decide (how long the oven takes, how long prep takes), not an instruction. The "Start now" label added in 0.19.0 is more prescriptive than he wants |
| Fairness of the split | "The split felt pretty fair… we were both busy at the same time" | Keep the split as is |
| Ease | "Pretty easy," but "kind of a lot going on": the list showed both cooks' steps with "that tiny thing saying which section I'm on." He'd rather "see all of my steps and maybe a small reminder of where yours are," or a button to expand the other cook's steps | Show your own steps by default and collapse the other cook's into short reminders |
| Telling steps apart | The other cook's steps were "a little more grayed out but not enough"; "I was reading stuff and I was like, do I need to do this?" | The current dimming isn't enough. Hiding or collapsing beats shading |
| The large next-step card | Never used it: "I personally just like scrolling through instructions… to pre-look at the next one" | Two sources now (Erin's notes and this) say the list is the main view. The large card may not earn its space |
| Checking off steps | "Skip over mostly… my hands are dirty"; he caught up later by checking several at once. He wouldn't use voice either: "I feel like I have to be talking a lot" | Check-offs are what drive the waiting and "together" logic, and he mostly doesn't do them. Two-chef mode can't depend on them |
| Following the other cook | "I was just kind of focused on reading my stuff and getting my stuff done" | "Erin is on step 3" has little value for him |
| Next time | Would use two-chef mode: "it's nice having the breakdown for who does what," but "still a lot on the screen and a lot of interactions." He'd like it to stay "more of a background tool" | Fewer required taps; glanceable |
| Font size | "Fine"; the color was "too similar to the other chef's instructions" | Same as above |
| One change | Time estimates up front "so I can kind of visualize the whole process… not have to be by the book… gauge it yourself and make your own decisions" | An overview of the whole cook with times, at the start |
| Changing the recipe mid-cook | They made more than planned (extra vegetables, so more eggs). He wasn't sure whether changing servings would change the saved recipe or only this cook, and looked up macros in another app to account for the extra eggs | Cooking needs its own amounts and nutrition for this cook, separate from the recipe |
| History | A history per recipe ("a little clock symbol") with each time it was made: when, the portions used, and notes from that cook. He wants the original recipe kept as the template and edits made per cook, not a saved version per serving size, because he worried about "delving too far from the original recipe" | Each cook log entry could hold what was actually made that time: servings, changed amounts, and notes |

**Tensions to resolve.**

- Two-chef mode relies on check-offs to know who is waiting and when the
  shared step can start. The person it's meant to help skips them because
  his hands are full, and doesn't want voice commands.
- Erin chose earlier not to keep recipe versions, because notes already
  record what changed. Partner is asking for something different: a record
  of each cook, with the original recipe left alone.

**What it means for the case study.** The core promise held: neither
cook asked the other what to do next, and Partner called the split fair. The problems were at the edges of
the split: timing (when to start the oven, how long it all takes), what
to do while waiting, and amounts that didn't match. The scaling bug only
surfaced because two people were reading two different parts of the
screen.

## 2026-10-11: Partner's imports failed

**Finding.** Partner tried to import a soft tofu stew (soondubu jjigae)
recipe two ways. The PDF was refused for being 10 MB, over the 8 MB
limit. The link (cookerru.com) failed with an error that didn't say why.

**Cause.**

- PDF: PDFs were sent to Gemini whole, and a page saved as a PDF is mostly
  photos, so even a short recipe can be over 8 MB.
- Link: the page itself is fine. It uses a common WordPress recipe plugin
  whose recipe data the importer already reads (checked with a test built
  from the page). The likely cause is the site turning away the
  function's request, which said it was an app, not a browser. The app
  then showed the Supabase client's own wording ("non-2xx status code")
  instead of a reason.

**Change (version 0.18.1).**

- A PDF over 8 MB is read on the phone first. If it has text, only the
  text is sent (a 13.5 MB test PDF became 233 bytes). If it's a scan, its
  first pages are sent as compressed images (an 18.8 MB scan became
  441 KB). The size limit is gone from the screen.
- Links are requested the way a phone browser asks for a page. If the
  site still refuses, a public page-reading service is tried. If both
  fail, the message names the problem, such as "That site doesn't let apps
  read its pages (error 403)", and suggests saving the page as a PDF or
  taking screenshots.
- Any other failure says what kind it was and what to do, instead of the
  Supabase client's wording.
- The import function now logs each page request's result, so a failed
  link can be checked in Supabase's logs.

## 2026-10-11: Two-chef mode

**Context.** Two-chef mode was in the original plan (Next phase) for the
problem "the other person has to ask what they can help with." Erin asked
to build it after the cooking mode changes.

**Change (version 0.18.0).**

- "Cook with two chefs" on the recipe page. The first time, Gemini splits
  the steps into two named parts (like "Pasta" and "Sauce") and shared
  steps where they come together. The split is saved with the recipe, so
  it works offline after that. If a recipe is one sequence that two
  people can't share, it says so and offers regular cooking mode.
- One cook picks a part and the other phone gets the other part. If both
  tap the same part at once, the first wins and the second gets the other.
- Each phone shows its next step in large text with a big "Done" button,
  and every step below it, with the other cook's steps dimmed and
  labeled with their name. Check-offs show on both phones within seconds.
- A shared step waits until both parts reach it, and says who it's
  waiting on. Steps can be handed to the other cook, and parts swapped.
- "Both parts, on this phone" runs both on one phone. Offline, each phone
  keeps its own progress and sends check-offs when it reconnects.
- Finish logs the meal once for both cooks.

**How it was tested.** The database functions were run against a real
Postgres, including two cooks claiming the same part and someone outside
the kitchen trying to join. Two browser sessions stood in for two phones
against a fake server for the full cook, plus an offline run.

**Still to test.** Two real phones in the same kitchen: whether live
updates arrive fast enough, and whether the split makes sense to cook by.

## 2026-10-11: Reading ahead in cooking mode

**Finding.** Erin pointed out that cooking mode shows only one step at a
time. Someone whose hands are busy or messy can't tap to the next step,
so they can't see what's coming.

**Change (version 0.17.0).** The current step stays large at the top.
Below it, "Coming up" lists every remaining step, numbered, in text large
enough to read from the counter. Finished steps are tucked under "Done".
Previous and Next still work as before.

**Still open.** Moving between steps without touching the screen. iOS
Voice Control can already press the buttons by name ("Tap Next step");
a built-in "say next" option is a possible follow-up.

## 2026-10-11: Time from the recipe instead of by hand

**Finding.** A few minutes after 0.15.0, Erin found that typing minutes for
each meal was tedious, and since the number is an estimate anyway, the
recipe's own time would do. Cooking mode should just record that we made
it.

**Change (version 0.16.0).**

- Recipes have a "Total time, in minutes" field in Edit. Imports already
  read a stated total time; Gemini now estimates one from the steps when
  the recipe doesn't give one.
- Time cooking together in Stats adds each recipe's total time once per
  logged meal, even when both cooks log it. Stats says how many meals
  don't count because their recipe has no time, and the recipe page links
  to Edit to add one.
- Finish in cooking mode logs today's meal and opens "How was it?". Stop
  cooking logs nothing. A mistaken log is removed from the cook log like
  any other.
- The manual minutes field, "Remove time", and the "cooking mode, not
  logged" rows are gone. Cooking mode no longer times sessions.

**Bug found while testing.** Adding a total time asked to re-rate the
recipe, because every save marked the ingredients and steps as changed.
Saves that leave the ingredients and steps as they were now keep their
old times, so only real changes ask for a new rating.

**Decision in the case study.** This replaced a feature built 15 minutes
earlier. Measured time was precise but asked for effort at the end of
every meal; an estimate from the recipe costs nothing and is close
enough for a "time together" stat.

## 2026-10-11: Adding and removing cooking time

**Finding.** Erin asked whether cooking sessions could be added or deleted.
They couldn't. The only way to record time was to keep cooking mode open,
and we won't always use it. There was also no way to see or remove a
session, which matters for clearing test data.

**Change (version 0.15.0).**

- The cook log form has an optional "Minutes cooking" field. It works for
  a new date, or for a date that's already logged (the button reads
  "Add time" and no second meal is added).
- Each cook log row shows that day's time, such as "55 min · logged by
  Brian and Erin", with "Remove time". Removing a logged day removes its
  time too.
- Time from cooking mode on a day nobody logged now gets its own row
  ("cooking mode, not logged"), so everything counted in Stats is visible.

**Bug found while testing.** Added time is placed at 6 PM on that day, so
two cooks adding time for the same dinner overlap and count once. For
today before 6 PM, that put the time in the future, and Stats showed
negative minutes. Time added for today now ends at the current time, and
Stats ignores any time still in the future.

## 2026-10-11: Rating prompt, cook log, and servings

**Finding.** Using 0.13.0 on her phone, Erin found:

- After the recipe was edited, the "Rate it again?" prompt had no way to
  dismiss it. She didn't want to change her rating, so it stayed on screen.
- The Ratings card repeated the breakdown (each cook's stars and the
  average) that already shows under the recipe title, and took most of a
  screen.
- The cook log said "We made this on" above a "We made this" button, and
  each logged date was its own large card.
- "Show original" did nothing when the recipe was already written for two,
  and adjusting servings covers what it was for.

**Change (version 0.14.0).**

- The prompt now reads "You gave it 4★ before the recipe changed" with
  "Keep 4★" and "Change rating". Keeping re-saves the same stars, so the
  prompt clears on both phones.
- The breakdown shows once, under the title. The rating section is one
  line: "You gave it 4★" with "Change rating", which opens the stars and a
  Cancel.
- The cook log is a "Date made" field and an "Add to log" button on one
  line. Past dates are a compact list with a divider between them.
- "Show original" is removed. When servings differ from what the recipe
  makes, a line says "The recipe as written makes 4" with a "Make 4" link.

## 2026-10-11: Plain theme and accessibility pass

**Decision.** Before running more in-depth user testing, Erin wanted the app
to look like a plain MVP: black and white, consistent spacing, and up to
WCAG 2.2 AA. A styled look at this stage would pull attention away from
whether the features work, and plain tokens make a good starting template
for the visual design later in Figma.

**Change (version 0.13.0).**

- Black, white, and grays in light and dark mode. Red only for errors,
  always with words.
- Spacing comes from shared layout classes instead of one-off settings, with
  even gaps between sections and room above the bottom menu.
- Accessibility audit and fixes; the full report is in
  [docs/ACCESSIBILITY.md](docs/ACCESSIBILITY.md).

**What the audit showed.** Automated checks (axe-core) found nothing before
or after the pass. Tabbing through the screens by hand found two real
failures it missed: the note box ended up behind the bottom menu
(2.4.11 Focus Not Obscured) and the date field showed no focus ring (2.4.7).
Raw sync errors like "TypeError: Failed to fetch" were also caught by
reading the screens, not by the tool.

**Still to test.** VoiceOver on an iPhone in the installed app, the largest
iOS text size, and Voice Control.

## 2026-10-11: Drop earlier versions of recipes

**Finding.** Erin decided storing a full copy of a recipe before every edit
wasn't worth it. When a change comes from a note, the note itself already
records what changed and why.

**Change (version 0.12.0).**

- Saving an edit no longer stores a copy of the old recipe, and the Earlier
  versions section (with Restore) is gone.
- When a change comes from a note, only a short record is kept: which note
  and its summary. That's what lets the note show "Used to change the
  recipe" and stops it from being applied twice.
- "Rate it again" after an edit now checks when the ingredients or steps
  were last saved, instead of looking for a stored version.
- Migration 0005 removes the recipe copies already stored.

**Trade-off.** An edit can't be undone from the app anymore. A change from
a note is reviewed before saving, and a manual edit can be fixed with
another edit.

## 2026-10-11: Version numbers people can read

**Finding.** Settings showed "App version a947736", a commit code that
means nothing to the people using the app.

**Change.**

- Versions are numbered (0.11.0) with a short list of what's new in plain
  words. Settings shows the current version, its notes, and every earlier
  version.
- The update banner names the waiting version and its main change, like
  "Version 0.11.1 is ready".
- After an update, the app shows what changed since the version that phone
  last ran, once.
- The history was filled in back to 0.1.0, so versions line up with this
  log: 0.6.1 is the same-day meal fix, 0.7.0 the recipe-level ratings,
  0.8.0 nutrition, and so on. The commit code stays, in small print, for
  matching a screenshot to an exact build.

## 2026-10-11: Don't keep imported originals

**Finding.** Erin pointed out that once a recipe's text is copied over and
checked, the original screenshot or PDF is clutter and uses storage. What's
worth keeping is the source, if the recipe credits one.

**Change.**

- The original still shows beside the parsed recipe on the review screen,
  then is discarded when the recipe is saved. Nothing is uploaded.
- Import picks up who the recipe is credited to: Gemini reads a credit
  printed in a screenshot or PDF (a site, cookbook, person, or account) and
  any web address, without guessing; links use the page's author or
  publisher. The review screen has a Credit field to check or fill in.
- The recipe page shows "From Just One Cookbook", linked when there's a
  web address. The old "Show the original" section is gone.
- Existing stored originals are cleared (migration 0004, then emptying the
  storage bucket in Supabase).

**Photos follow-up.** Erin confirmed that photos of finished dishes should
sync between phones.

## 2026-10-11: Photos of finished dishes (planned)

**Finding.** Erin wants to add photos of what a recipe looked like when
they made it, and to use them later in more game-like stats. She suggested
keeping them on the device.

**Planned approach.** A photo on each cook log entry, shrunk to about
300 KB. It's saved on the phone so it shows offline, and synced to Supabase
Storage so both phones see it (the free 1 GB holds roughly 3,000 photos).
Keeping photos only on the phone that took them would hide them from the
other cook and lose them if the app is deleted.

## 2026-10-11: Update banner not seen

**Finding.** After two updates shipped, Erin never saw "A new version of
the app is ready." Each update appeared later by itself.

**Cause.** The update worked as designed underneath: the new version
downloaded in the background and took over when the app next fully
restarted. The banner sat at the very top of the page, so it was out of
sight while scrolled down a recipe, and the app only looked for updates
when it came back to the front or every 30 minutes.

**Change.**

- The banner is pinned to the top of the screen wherever the page is
  scrolled, with Update now and Later.
- The app also looks for updates when moving between screens (at most once
  a minute), when the phone reconnects, and every 10 minutes.
- Tested with two builds in a browser: the banner appeared, and Update now
  switched to the new version.

**Also added.** Each recipe card in the Library shows the average rating
and how many times it was made, like "★ 3.5 · made 1 time · Japanese".

## 2026-10-11: Notes as a comments thread

**Finding.** Looking at the notes after the avocado oil fix, Erin found
three problems. Each note was a large card with full-size buttons, so a few
notes filled the screen. The note the app had posted after a change
("Changed the recipe from Erin's note: ...") offered "Turn into a recipe
change", which made no sense for a change already made. A note that had
already changed the recipe could be applied again.

**Change.**

- Notes look like a comments thread: initial, name, and date, the note,
  then small text actions. Oldest first, with a "Add a note" box and Post
  button at the bottom.
- A note that was used shows "Used to change the recipe" with the summary,
  and no longer offers the change. The review screen also refuses a note
  that was already used, in case the other phone hasn't synced yet.
- Notes the old version of the app posted after a change show as a quiet
  "Recipe updated: ..." line with no change action. The author can delete
  them.

## 2026-10-11: Waiting on Gemini

**Finding.** While Gemini worked, the screen just sat there. It wasn't
clear whether anything was happening, and the waits felt long.

**Change: feedback while waiting.**

- Every Gemini wait (import, changes from notes, step questions, nutrition)
  shows a spinner, what's happening, a seconds counter, and the usual time.
- After 20 to 30 seconds it says it's taking longer than usual and that
  waiting is fine.
- With Reduce Motion on, the spinner stays still; the counter still shows
  progress. Screen readers hear the message once, not every second.

**Change: speed.**

- Gemini 3.8 Flash "thinks" at a medium level by default before answering.
  Import, nutrition, and step questions now ask for a low level, which
  answers sooner. If a model rejects the setting, the app asks again
  without it.
- Step questions try Flash-Lite first, since quick answers matter most
  while cooking.
- Changes from notes keep the default level. That task has to catch every
  part of a note (see the avocado oil entry), so accuracy is worth a few
  seconds.
- Each Gemini call now logs its model and time in Supabase, so wait times
  can be compared before and after.

**Baseline, before the speed change** (Supabase execution time, one call
each on 2026-10-11):

| Task | Function | Time |
| --- | --- | --- |
| Import the Isobe mochi screenshot | import-recipe | 32.1 s |
| Draft a change from a note | suggest-edit | 17.4 s |
| Estimate nutrition | estimate-nutrition | 2.9 s |

The import took about twice as long as the "usually 5 to 15 seconds" the
app had been telling people.

**To measure.** The same tasks after the speed change, and whether lower
thinking changes the quality of imports or nutrition estimates.

## 2026-10-11: Phones kept an older version

**Finding.** After the ratings change shipped, Erin's phone still showed the
old layout (stars in the log form and on every date). The new version had
deployed; the home-screen app was still running the copy it keeps for
offline use. Closing and reopening the app picked up the change.

**Why it matters.** During testing, feedback on an old version looks like
feedback on the new one. Without a way to see the version, there's no way
to tell them apart.

**Change.**

- The app checks for a new version whenever it comes back to the front and
  shows "A new version of the app is ready" with an Update now button. It
  never reloads on its own, so it can't interrupt cooking mode.
- Settings shows the app version and build time, so a screenshot can be
  matched to a build.

## 2026-10-11: Changes from a note: missed change and duplicate note

**Finding.** Erin's note on Isobe mochi asked for two things: find a middle
heat for the glaze, and add the avocado oil used to grease the pan. After
"Turn into a recipe change", the recipe got one change, the oil never
appeared in the ingredients, and the summary still said the oil was added.
Saving also posted an automatic note ("Changed the recipe from Erin's
note: ...") that read as a duplicate and had its own "Turn into a recipe
change" button.

**Cause.**

- Gemini numbered the new ingredient as one past the end of the list. The
  app treated that as an invalid position and dropped the change without
  saying so, while the summary described every change Gemini meant to make.
- The automatic note was meant to tell the other cook what changed, but it
  repeated the original note in a second place.

**Change.**

- An ingredient or step added past the end now goes at the end.
- Gemini is told to cover every part of a note, and to turn heat or timing
  advice into a change to the step it applies to.
- Each change shows its own reason. If any suggestion can't be applied,
  the review screen says so and points to Edit before saving.
- No automatic note. The original note now shows "Used to change the
  recipe" with the date and summary, and Earlier versions labels that
  version as a change from a note.
- Whoever wrote a note can delete it, which also clears the old automatic
  notes.
- Lines like "avocado oil, for greasing the pan" no longer get flagged for a
  missing amount.

**Design takeaway.** An AI summary has to describe what was applied, and a
partial result has to be visible. Silent drops break trust in the approve
step, which is the safeguard the feature depends on.

## 2026-10-11: Nutrition estimates

**Context.** First week of real use. Partner works out and moves between cutting
and bulking. He already works out calories and protein by hand for everything
he cooks.

**Finding.** Partner wants a calorie and nutrition estimate on each recipe,
with protein and calories as the numbers that matter most to him.

**Why it fits the product.** The app already holds the ingredients and
scales them, so the inputs for an estimate are on hand. It removes a manual
step one of the two cooks does every time they cook.

**Decision.** Moved into the MVP the same day instead of waiting for the
Next phase, because it serves a need one of the two users has every time
they cook.

**What was built.**

- An "Estimate nutrition" button on each recipe. Gemini estimates calories,
  protein, carbs, and fat for each ingredient line, and the app adds the
  lines up and divides by servings. Doing the math in the app keeps the
  totals consistent with the breakdown.
- "How much you ate" in half-serving steps, since the two cooks don't
  necessarily eat the same amount. Calories and protein are shown in bold.
- A breakdown per ingredient, including what Gemini assumed for lines
  without an amount, so a number that looks off can be traced to its line.
- The estimate is saved with the recipe, so it shows offline and on both
  phones without asking Gemini again. If the ingredients or servings change,
  the app says the numbers may be off and offers to estimate again.
- Labeled as an estimate throughout, with a note that brands, cuts, and
  absorbed oil change the real numbers.

**Still open for research.**

- Is half-serving precision enough for tracking a cut, or does Partner need
  grams?
- Which numbers matter beyond calories and protein?
- How accurate does an estimate need to be before it's trusted? A check
  against USDA FoodData Central (free API) is an option if Gemini's numbers
  drift.

## 2026-10-11: Logging after midnight (open)

**Finding.** We cooked Isobe mochi on the evening of Oct 10 and logged it
after midnight. The date field defaulted to Oct 11, so it had to be changed
by hand.

**Possible fix.** Default to the previous day when logging in the early
morning hours. Not built yet.

## 2026-10-11: Ratings belong to the recipe

**Finding.** After the meal-grouping fix below, the recipe page still asked
for a new rating every time the recipe was logged. Erin's feedback: the
date is nice as a diary, but a rating should stay the same after the first
time unless the recipe changes or we want to change it.

**Change.**

- Each cook has one rating per recipe. It carries over to every later meal
  and only changes when that cook changes it.
- If the recipe is edited after a rating was given, the rating is marked
  "rated before the latest edit" and that cook is asked to rate again.
  This covers manual edits, changes drafted from notes, and restoring an
  earlier version.
- The cook log became a diary: each date and who logged it.
- Removing a diary entry keeps your rating. If the other cook's rating is
  stored with that entry, the app warns first.

**Commit.** `b14becf`

## 2026-10-11: Both cooks logged the same dinner

**Finding.** After making Isobe mochi together, Erin and Partner each logged
the meal on their own phones. The recipe showed two entries for Oct 10, one
with each rating, and no average.

**Cause.** The app treated every log as a separate meal. Two people cooking
together is the main use case, so logging from both phones is expected.

**Change.**

- One recipe on one date counts as one meal, shown as one entry with both
  cooks' names.
- Logging a date that's already logged doesn't add a second entry.
- Stats count it once.

**Commit.** `3d71b97`

## 2026-10-11: Removing kitchen members

**Finding.** While setting up the shared kitchen and inviting Partner, Erin
noticed there was no way to remove someone or leave a kitchen.

**Change.** Settings can remove a cook or leave the kitchen. Their notes and
ratings keep their name, and unused invite links expire.

**Commit.** `7cd9031`
