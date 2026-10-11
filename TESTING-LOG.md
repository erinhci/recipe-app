# Testing log

What came up while Erin and her partner used the app at home, and how the
product changed because of it. Newest first. Each entry lists what we saw,
what changed, and the commit, so the case study can trace a finding to the
build.

The partner is referred to as "Partner" here because this file may be public.

## Summary

| Date | Finding | Outcome | Commit |
| --- | --- | --- | --- |
| 2026-10-11 | Waiting on Gemini looked like a frozen screen | Loading indicator; faster settings per task | See entry |
| 2026-10-11 | Phones kept showing an older version after updates shipped | App offers updates and shows its version | See entry |
| 2026-10-11 | A note asking for two changes only got one, and saving added a duplicate note | Every part of a note is covered or flagged; no duplicate note | See entry |
| 2026-10-11 | Partner wants calorie and protein estimates for recipes | Nutrition estimates added to the MVP | See entry |
| 2026-10-11 | Logging after midnight defaults to the wrong day | Open | Not built |
| 2026-10-11 | Rating each meal felt like a repeat of rating the recipe | Ratings moved to the recipe | `b14becf` |
| 2026-10-11 | Both cooks logged the same dinner, so ratings split across two entries | Same recipe and date count as one meal | `3d71b97` |
| 2026-10-11 | Setting up the kitchen showed there was no way to remove a member | Remove a member or leave a kitchen | `7cd9031` |

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
