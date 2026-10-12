# Our Kitchen

A shared recipe app for two people who cook together. Recipes open scaled
for two, both cooks see the same library on their own phones, and the app
works offline. Built as a progressive web app on React, Supabase, Gemini,
and Vercel.

The product plan and build spec live in the project doc (Build spec tab).
Findings from using the app and the changes they led to are in
[TESTING-LOG.md](TESTING-LOG.md). The accessibility audit is in
[docs/ACCESSIBILITY.md](docs/ACCESSIBILITY.md).

## Status

Done: sign-in and shared kitchens; recipes with scaling, units, notes, and
offline sync; import from screenshots, PDFs, links, and pasted text;
cooking mode with step questions; cook log with a rating from each cook;
kitchen stats and milestones; recipe changes drafted from notes; nutrition estimates.
Next: the Next features in the build spec.

## One-time setup

### 1. Supabase

1. Create a project on the free plan.
2. Open the SQL editor and run each file in `supabase/migrations/` once,
   in order: `0001_init.sql`, `0002_remove_members.sql`,
   `0003_nutrition.sql`, `0004_source_credit.sql`,
   `0005_drop_recipe_copies.sql`, `0006_drop_cooking_sessions.sql`
   (after both phones are on 0.16.0), `0007_two_chef.sql`, then
   `0008_shared_servings_half_stars.sql`, then `0009_prep_cook_time.sql`, then
   `0010_meal_photos.sql`. (Run
   `0001b_grants_only.sql` only if an early copy of 0001 was used.)
3. In Authentication, open **Sign In / Providers**. Under User Signups,
   turn off **Confirm email** and save. The app uses email and
   password, so no email is ever sent. This avoids needing a custom email
   sender, and on iPhone it keeps sign-in inside the home-screen app.
4. After both cooks have created accounts, turn off **Allow new users to
   sign up** on the same page, so nobody else can make an account.
5. In **Edge Functions**, open **Secrets** and add `GEMINI_API_KEY` with a
   Gemini API key from Google AI Studio. Optional: `GEMINI_MODELS`, a
   comma-separated list of models to try in order (default:
   `gemini-3.8-flash,gemini-3.5-flash-lite`).
6. In **Edge Functions**, deploy a new function named `import-recipe` using
   the browser editor, and paste in
   `supabase/functions/import-recipe/index.ts`. Leave JWT verification on,
   so only signed-in cooks can use your Gemini quota.
7. Do the same for a function named `ask-step`, pasting in
   `supabase/functions/ask-step/index.ts`. It answers questions typed in
   cooking mode and uses the same Gemini secret.
8. Do the same for `suggest-edit`, pasting in
   `supabase/functions/suggest-edit/index.ts`. It drafts recipe changes
   from notes.
9. Do the same for `estimate-nutrition`, pasting in
   `supabase/functions/estimate-nutrition/index.ts`. It estimates calories
   and macros. Run `0003_nutrition.sql` first so estimates can be saved.
10. Do the same for `split-steps`, pasting in
    `supabase/functions/split-steps/index.ts`. It splits a recipe's steps
    between two cooks for two-chef mode. Run `0007_two_chef.sql` first.

### 2. Vercel

1. Sign in to Vercel with GitHub and import this repo. The Vite preset is
   detected automatically.
2. Add these environment variables (both are on Supabase's API settings
   page):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `CRON_SECRET`: any long random string. Vercel's daily cron sends it,
     so nobody else can trigger the keep-alive route.
3. Deploy. Every push to `main` deploys again.

### 3. Phones

Open the Vercel address on each phone and add it to the home screen. The
first person creates an account, creates the kitchen, and sends an invite link from
Settings. The second person opens the link, signs in, and joins.

## Local development

```sh
cp .env.example .env.local   # then fill in the two Supabase values
npm install
npm run dev
```

## Releasing

Every push to `main` that changes the app gets a new entry at the top of
`src/releases.json`: a version number and a few plain-language notes on
what changed. Bump the last number for fixes (0.9.1 to 0.9.2) and the
middle number for new features (0.9.2 to 0.10.0). The app shows these
notes in Settings, in the update banner, and once after updating.

## Project layout

| Path | What it holds |
| --- | --- |
| `src/screens/` | One file per screen |
| `src/components/` | Shared pieces such as the page wrapper and bottom bar |
| `src/lib/supabase.js` | Supabase client |
| `src/lib/db.js` | Local IndexedDB database (Dexie) for offline use |
| `src/lib/auth.jsx` | Sign-in state and the current cook's kitchen |
| `src/index.css` | Design tokens and base styles |
| `src/releases.json` | Version history shown in the app |
| `supabase/migrations/` | Database schema, security rules, and stats views |
| `api/keepalive.js` | Daily route that keeps the free Supabase project awake |
| `vercel.json` | Daily cron schedule and app routing |
