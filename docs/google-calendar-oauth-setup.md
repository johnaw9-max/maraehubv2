# Google Calendar OAuth2 Setup — Step-by-Step (for Waj)

**Goal:** register MaraeHub with Google so trustees can connect their own Google Calendar and get hui dates synced to it automatically.

**Scope:** this covers the Google Cloud Console setup only — creating the project, enabling the Calendar API, configuring the consent screen, and generating credentials. No app code changes happen in these steps.

**Before you start:** you'll need a Google account with permission to create a Google Cloud project (any personal or Workspace Google account can do this — it doesn't need to be a paid account, Calendar API usage at MaraeHub's scale is free).

---

## Step 1 — Create the Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com).
2. Top-left project dropdown → **New Project**.
3. Name it something identifiable, e.g. `MaraeHub`. Leave "Organization" as whatever it defaults to (fine to leave as "No organization" on a personal account).
4. Click **Create**, then make sure the new project is selected in the top-left dropdown before continuing — every next step happens inside this project.

## Step 2 — Enable the Calendar API

1. Left sidebar (or search bar) → **APIs & Services** → **Library**.
2. Search for **Google Calendar API**.
3. Click it, then click **Enable**.

That's it for this step — no configuration yet, just turning the API on for this project.

## Step 3 — Configure the OAuth consent screen

This is the screen trustees will see when they click "Connect Google Calendar" in MaraeHub, and it's also where Google decides whether your app needs review before real users (not just test accounts) can use it.

1. **APIs & Services** → **OAuth consent screen**.
2. **User type: External.** (Trustees are not members of a Google Workspace organization you control, so this is the only option that applies — Internal is only for Google Workspace accounts inside the same org.)
3. Fill in the required fields:
   - **App name**: `MaraeHub`
   - **User support email**: your email (or Jason's)
   - **App logo**: optional, skip for now
   - **Developer contact email**: your email
4. **Scopes** — click **Add or Remove Scopes**, and add exactly:
   - `https://www.googleapis.com/auth/calendar.events`
   
   Do **not** add the broader `https://www.googleapis.com/auth/calendar` scope — that also grants the ability to create/delete entire calendars, which is more access than MaraeHub needs. `calendar.events` only allows creating, editing, and deleting individual events, which is all the hui-sync feature does.
5. **Test users** — while the app is in "Testing" status (the default, and where it'll stay until verification is complete), only Google accounts you explicitly add here can connect. Add your own account and Waj's account here so you can both test the real OAuth flow before it's opened up further.
6. Save.

**Important — don't skip this:** while the consent screen stays in **Testing** status, Google will silently expire each trustee's connection after about 7 days of the app being unverified — the sync will just stop working with no obvious error. This is fine for our own testing, but before any real trustee relies on this, the app needs to go through **Google's verification** (see Step 5) and be moved to **Production** status. Flag this explicitly when we're ready to hand this to a real trustee, not just test accounts.

## Step 4 — Create OAuth 2.0 credentials

1. **APIs & Services** → **Credentials**.
2. **Create Credentials** → **OAuth client ID**.
3. **Application type: Web application.**
4. Name it something identifiable, e.g. `MaraeHub Calendar`.
5. **Authorized redirect URIs** — add one entry per Supabase project MaraeHub runs on (this one Google app/client can serve all of them, unlike some other integrations we've built where each environment needs its own registration). For each marae's Supabase project, the redirect URI will point at that project's edge function, e.g.:
   - `https://<project-ref>.functions.supabase.co/google-calendar-callback`
   
   We'll confirm the exact URL(s) once the edge function is named — for now, leave this step open and come back to fill in the real URL(s) once that's decided. It's fine to create the client with a placeholder redirect URI now and edit it later; Google lets you add/change redirect URIs on an existing client at any time.
6. Click **Create**. Google will show a **Client ID** and **Client Secret** — copy both somewhere safe immediately (the secret in particular isn't shown again in full after you close this dialog; you'd have to generate a new one).

**Do not commit the Client ID or Client Secret into the codebase.** These get set as Supabase Edge Function secrets (`supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=...`) on each Supabase project individually, the same way Xero's credentials are handled — never in a `.env` file that gets committed.

## Step 5 — Verification (needed before real trustees use this, not before testing)

Once the OAuth flow is working end-to-end with test accounts, submit the app for Google's verification review from the OAuth consent screen page (**Publish App** → follow the verification prompts). Because `calendar.events` is a "sensitive" scope, Google requires:

- A **privacy policy URL** (must be a real, reachable page — MaraeHub will need one if it doesn't already have one).
- A brief explanation of how the app uses the scope.
- Possibly a short screen-recording demo of the OAuth flow, if Google's reviewer asks for one.

Review typically takes anywhere from a few days to a couple of weeks. Budget for this lead time before committing to a date for real trustees to start using calendar sync — plan to kick this off as soon as the flow is confirmed working with test accounts, not at the end of the build.

---

## What you'll have at the end of this doc

- A Google Cloud project with the Calendar API enabled.
- An OAuth consent screen configured for External users, requesting only `calendar.events`.
- A Client ID + Client Secret (Web application type), with your and Waj's accounts added as test users.
- A verification submission in progress (or ready to submit once the redirect URI and flow are finalized).

**Not covered here** (comes after this, in the actual build): the Supabase Edge Function that handles the OAuth callback, the per-trustee token storage table, and the sync logic itself.
