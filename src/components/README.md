# MaraeHub V2

Digital operational management platform for marae in New Zealand.
Built with React + Supabase + Vercel.

---

## Setup Instructions

### Step 1 — Add your Supabase keys

1. Copy `.env.example` and rename it to `.env.local`
2. Open `.env.local` and fill in your values:

```
REACT_APP_SUPABASE_URL=https://cbeenkpjpnhmtqtnjiyd.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your_publishable_key_here
```

### Step 2 — Install and run locally (optional)

```bash
npm install
npm start
```

This opens the app at http://localhost:3000

### Step 3 — Deploy to Vercel

1. Go to github.com and create a new repository called `maraehub-v2`
2. Upload all these files to the repository
3. Go to vercel.com and click "Add New Project"
4. Import your GitHub repository
5. In Vercel's Environment Variables section, add:
   - `REACT_APP_SUPABASE_URL` = your Supabase project URL
   - `REACT_APP_SUPABASE_ANON_KEY` = your publishable key
6. Click Deploy — your app will be live in ~2 minutes

---

## Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Trustee | trustee@maraehub.com | Trustee123! |
| Community | community@maraehub.com | Community123! |

---

## What's Built

- ✅ Login / logout with Supabase Auth
- ✅ Role-based routing (Trustee vs Community)
- ✅ Trustee Dashboard with stats
- ✅ Booking approval system (approve / decline)
- ✅ Projects manager (add, edit, delete, progress tracking)
- ✅ Assets register (add, edit, delete, condition tracking)
- ✅ Community booking wizard (3-step, saves to Supabase)
- ✅ Community booking history view

---

## Project: MaraeHub NZ Ltd
Founder: Waj Williams
Domain: maraehub.com
