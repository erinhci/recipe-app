# Our Kitchen

A shared recipe app for two people who cook together. Recipes open scaled
for two, both cooks see the same library on their own phones, and the app
works offline. Built as a progressive web app on React, Supabase, Gemini,
and Vercel.

The product plan and build spec live in the project doc (Build spec tab).

## Status

Step 1 of the MVP: project setup, database schema, sign-in, and joining a
shared kitchen. Import, recipes, cooking mode, and stats come next.

## One-time setup

### 1. Supabase

1. Create a project on the free plan.
2. Open the SQL editor, paste all of `supabase/migrations/0001_init.sql`,
   and run it.
3. In Authentication settings, edit the **Magic Link** email template so it
   includes the code. Replace the body with:

   ```html
   <h2>Your Our Kitchen sign-in code</h2>
   <p>Enter this code in the app: <strong>{{ .Token }}</strong></p>
   ```

   The app signs in with a typed code instead of a link, because on iPhone
   a link opens in Safari, which keeps separate storage from the home-screen
   app.

4. In Authentication URL settings, set the Site URL to the app's Vercel
   address once it exists.

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
first person signs in, creates the kitchen, and sends an invite link from
Settings. The second person opens the link, signs in, and joins.

## Local development

```sh
cp .env.example .env.local   # then fill in the two Supabase values
npm install
npm run dev
```

## Project layout

| Path | What it holds |
| --- | --- |
| `src/screens/` | One file per screen |
| `src/components/` | Shared pieces such as the page wrapper and bottom bar |
| `src/lib/supabase.js` | Supabase client |
| `src/lib/db.js` | Local IndexedDB database (Dexie) for offline use |
| `src/lib/auth.jsx` | Sign-in state and the current cook's kitchen |
| `src/index.css` | Design tokens and base styles |
| `supabase/migrations/` | Database schema, security rules, and stats views |
| `api/keepalive.js` | Daily route that keeps the free Supabase project awake |
| `vercel.json` | Daily cron schedule and app routing |
