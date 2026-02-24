# WalletConnect GTM Agent

AI-powered outbound sales pipeline for WalletConnect Pay. Built as a POC/demo for internal stakeholders.

## What it does

A human-in-the-loop GTM pipeline with 4 AI-powered stages:

1. **Lead Input** — CSV upload or manual entry
2. **Enrichment** — Claude AI generates a company summary + personalized WalletConnect Pay value prop, augmented by Exa.ai company news
3. **Message Generation** — Claude AI writes a cold outreach email (or LinkedIn DM) using the enrichment context
4. **Send + Follow-up** — Sends via Resend.com, schedules follow-up reminders at T+14 and T+21 days

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Open the SQL editor and run the contents of `supabase/schema.sql`
3. Copy your project URL and anon key from Project Settings → API

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
ANTHROPIC_API_KEY=sk-ant-...
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=outreach@yourdomain.com
EXA_API_KEY=...
```

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. (Optional) Seed demo leads

```bash
npx tsx scripts/seed.ts
```

This inserts 5 realistic demo leads across different pipeline stages — useful for CEO demos.

## Deployment (Vercel)

```bash
npx vercel --prod
```

Add all environment variables in the Vercel dashboard under Project Settings → Environment Variables.

## API Keys needed

| Service | Free tier | Link |
|---|---|---|
| Anthropic Claude | Pay-as-you-go (~$0.001/lead) | console.anthropic.com |
| Supabase | Free up to 500MB | supabase.com |
| Resend | 3,000 emails/month free | resend.com |
| Exa.ai | 1,000 searches/month free | exa.ai |

## Tech stack

- Next.js 14 (App Router)
- Tailwind CSS + shadcn/ui
- Supabase (PostgreSQL)
- Anthropic Claude API
- Resend (email)
- Exa.ai (company news)
- Vercel (deployment)
