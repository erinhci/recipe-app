# Testing log

What came up while Erin and her partner used the app at home, and how the
product changed because of it. Newest first. Each entry lists what we saw,
what changed, and the commit, so the case study can trace a finding to the
build.

The partner is referred to as "Partner" here because this file may be public.

## Summary

| Date | Finding | Outcome | Commit |
| --- | --- | --- | --- |
| 2026-10-11 | Partner wants calorie and protein estimates for recipes | Added to backlog | Not built |
| 2026-10-11 | Logging after midnight defaults to the wrong day | Open | Not built |
| 2026-10-11 | Rating each meal felt like a repeat of rating the recipe | Ratings moved to the recipe | `b14becf` |
| 2026-10-11 | Both cooks logged the same dinner, so ratings split across two entries | Same recipe and date count as one meal | `3d71b97` |
| 2026-10-11 | Setting up the kitchen showed there was no way to remove a member | Remove a member or leave a kitchen | `7cd9031` |

## 2026-10-11: Nutrition estimates (backlog)

**Context.** First week of real use. Partner works out and moves between cutting
and bulking. He already works out calories and protein by hand for everything
he cooks.

**Finding.** Partner wants a calorie and nutrition estimate on each recipe,
with protein and calories as the numbers that matter most to him.

**Why it fits the product.** The app already holds the ingredients and
scales them, so the inputs for an estimate are on hand. It removes a manual
step one of the two cooks does every time they cook.

**Proposed approach (not built yet).**

- Gemini estimates calories, protein, carbs, and fat per serving from the
  ingredient list, the same way it already reads recipes on import.
- Shown as an estimate, with a line saying so. The numbers follow the
  servings stepper.
- Saved with the recipe and worked out again when the recipe is edited,
  so it isn't recalculated on every view.
- Option to check against USDA FoodData Central (free API) for more
  reliable numbers per ingredient.

**Open questions for research.**

- Do the two cooks eat equal portions? If not, "per serving" may be the
  wrong unit, and each cook may want their own share.
- Which numbers matter beyond calories and protein?
- How accurate does an estimate need to be before it's trusted for a cut?

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
