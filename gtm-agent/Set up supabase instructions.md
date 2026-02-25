# Setup Instructions

## 1. Create a Supabase account and project

1. Go to **supabase.com** → click "Start your project" → sign up with GitHub
2. Click "New project"
3. Fill in:
   - **Name:** `walletconnect-gtm` (or anything)
   - **Database password:** create a strong password and save it somewhere (you won't need it again for this)
   - **Region:** pick the closest one to you
4. Click "Create new project" — wait ~2 minutes for it to provision

## 2. Run the database schema

1. In your Supabase project, click **SQL Editor** in the left sidebar
2. Click "New query"
3. Open `gtm-agent/supabase/schema.sql` in your code editor, copy the entire contents
4. Paste it into the SQL editor, click **Run** (or Cmd+Enter)
5. You should see "Success. No rows returned" — that means the 3 tables were created

## 3. Get your Supabase credentials

1. In the left sidebar click **Project Settings** (gear icon at the bottom)
2. Click **API**
3. You need two values:
   - **Project URL** — looks like `https://abcdefghij.supabase.co`
   - **anon public** key — a long string starting with `eyJ...`

## 4. Get your other API keys

**Anthropic (Claude):**
1. Go to **console.anthropic.com** → sign in → click "API Keys" → "Create Key"
2. Copy the key (starts with `sk-ant-`)

**Resend (email sending):**
1. Go to **resend.com** → sign up → click "API Keys" → "Create API Key"
2. Copy the key (starts with `re_`)
3. For the "from" email: you can use `onboarding@resend.dev` as the sender for testing — Resend provides this out of the box on the free tier, no domain needed

**Exa.ai (company news):**
1. Go to **exa.ai** → sign up → go to Dashboard → API Keys → create one
2. Copy the key

## 5. Fill in your environment variables

Open `gtm-agent/.env.local` in a text editor and replace the placeholder values:

```
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghij.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-...
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=onboarding@resend.dev
EXA_API_KEY=...
```

## 6. Run the app

```bash
cd /Users/sergio/Documents/Code/WalletConnect/gtm-agent
npm run dev
```

Open **http://localhost:3000** — you should see the dashboard.

## 7. Load the demo leads (for the CEO presentation)

```bash
npx tsx scripts/seed.ts
```

This inserts 5 pre-built leads in different pipeline stages so the dashboard isn't empty when you demo it.

## 8. Test the full pipeline

1. Go to **Leads** — you'll see the 5 demo leads
2. Click a lead with status "New" (James Whitfield or Lena Hartmann)
3. Click **Run Enrichment** — watch Claude generate the company summary and WC Pay value prop
4. Click **Generate Message** — watch it write a personalized cold email
5. Edit the subject/body if you want, then click **Approve & Send Email**
   - This sends a real email via Resend to whatever address is on the lead
   - For testing: edit the lead's email to your own address first
6. Go back to **Dashboard** — follow-up dates will appear and the funnel stats will update

## 9. Deploy to Vercel (to get a shareable URL)

```bash
cd /Users/sergio/Documents/Code/WalletConnect/gtm-agent
npx vercel
```

- Sign in with GitHub when prompted
- Accept all defaults
- After it deploys, go to **vercel.com/dashboard** → your project → **Settings → Environment Variables**
- Add all 5 variables from your `.env.local` there
- Then run `npx vercel --prod` to redeploy with the env vars live

You'll get a URL like `https://gtm-agent-xyz.vercel.app` you can share directly.

---

## Note on sending real emails

On Resend's free tier, the `onboarding@resend.dev` sender only works for sending to your own verified email address. To send to real prospect addresses you need to add and verify your own domain in Resend (takes ~5 min via DNS records). Fine to skip for the demo — just send test emails to yourself.
