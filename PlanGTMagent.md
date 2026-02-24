# GTM Automation Agent POC — WalletConnect Pay

## Executive Summary

This document outlines the architecture, implementation plan, and rationale for a GTM automation pipeline built to accelerate outbound sales for WalletConnect Pay. The system is a human-in-the-loop pipeline dashboard where each stage is AI-powered and triggered by the user — making the reasoning visible and the demo compelling.

---

## Critical Analysis of the 4-Agent Approach

### What Works Well

- **4-stage pipeline** maps cleanly to the actual GTM motion (discover → enrich → message → send)
- **Supabase** is an excellent choice: Postgres with a built-in dashboard, real-time, and a generous free tier
- **Claude API** is the right tool for enrichment and personalization — best-in-class reasoning and writing
- **Platform-aware messaging** (email vs LinkedIn vs Twitter) is a genuine differentiator vs generic outreach tools

### Problems & Fixes

| Issue | Problem | Recommendation |
|---|---|---|
| LinkedIn scraping | Violates ToS; blocked by anti-bot at scale | Replace with Apollo.io API (50 free exports/month) or CSV import |
| Twitter/X API for tweets | $100+/month for basic access | Use Exa.ai or Perplexity API for recent company news instead |
| LinkedIn outreach sending | No public API; requires approved partner status | Focus on email (Resend.com, free tier). Optionally draft LinkedIn copy for manual paste |
| Fully autonomous pipeline | Hard to demo, errors compound, opaque to viewer | Human-in-the-loop: each agent runs on user click — CEO can watch each step |
| Automated calendar follow-up | Needs persistent scheduler infra (complex) | Store follow-up dates in Supabase; show "due today" queue in UI |

### Core Recommendation

Don't build 4 independent autonomous agents running in the background. Build a **pipeline dashboard** where each stage is an AI-powered step the user triggers manually. This is *more* impressive to a CEO (they see the AI reasoning at each step) and far simpler to build and demo reliably without compounding errors or black-box failures.

---

## Target ICP for WalletConnect Pay

Based on the product overview (APM-style crypto payment integration for PSPs):

### Primary Segments

- **Payment Service Providers (PSPs)** — looking to add crypto as an alternative payment method
- **E-commerce platforms** — especially in gaming, digital goods, luxury, and travel
- **POS system providers** — seeking modern payment rails
- **Fintechs in emerging markets** — high stablecoin adoption, weak banking infrastructure

### Decision-Maker Titles

- VP / Head of Partnerships
- VP of Product (PSPs)
- CTO / Head of Engineering
- CEO (companies under 100 employees)

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│              Next.js 14 Web App (Vercel)             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐  │
│  │ Agent 1  │ │ Agent 2  │ │ Agent 3  │ │Agent 4 │  │
│  │  Lead    │ │Enrichment│ │ Message  │ │ Send + │  │
│  │  Input   │ │+ Qualify │ │  Draft   │ │Follow-up│ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └───┬────┘  │
└───────┼────────────┼────────────┼────────────┼───────┘
        │            │            │            │
   Apollo.io    Claude API    Claude API   Resend.com
   or CSV       + Exa.ai      (Claude)     (email)
                    │
               Supabase (PostgreSQL)
```

---

## Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Frontend + Backend | Next.js 14 (App Router + API Routes) | Vercel-native, single repo, great DX |
| Styling | Tailwind CSS + shadcn/ui | Fast, professional look with minimal effort |
| Database | Supabase | User's choice; great free tier + built-in dashboard |
| AI | Anthropic Claude API (claude-3-5-haiku or sonnet) | Best-in-class writing and reasoning |
| Email sending | Resend.com | Simplest API; 3,000 free emails/month |
| Lead data | Apollo.io API or CSV upload | Free tier available; proper B2B contact data |
| Company news | Exa.ai API | Semantic search; better than Twitter API for this use case |
| Deployment | Vercel | Free; instant shareable URL |

---

## Supabase Data Model

### `leads` table

```sql
CREATE TABLE leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  title text,
  company text NOT NULL,
  linkedin_url text,
  twitter_handle text,
  company_website text,
  company_description text,
  company_size text,
  walletconnect_value_prop text,
  recent_news text,
  status text NOT NULL DEFAULT 'new',
  -- new | qualified | message_drafted | sent | followed_up | responded | not_interested
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### `messages` table

```sql
CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  platform text NOT NULL, -- email | linkedin | twitter
  subject text,
  body text NOT NULL,
  version int DEFAULT 1,
  sent_at timestamptz,
  follow_up_1_due timestamptz,
  follow_up_2_due timestamptz,
  created_at timestamptz DEFAULT now()
);
```

### `outreach_log` table

```sql
CREATE TABLE outreach_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  message_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  action text NOT NULL, -- sent | opened | replied | bounced | follow_up_sent
  timestamp timestamptz DEFAULT now(),
  notes text
);
```

---

## Agent Implementations

### Agent 1 — Lead Input

- **Option A**: CSV upload (parse name, email, title, company, website using Papa Parse)
- **Option B**: Manual entry form
- **Option C (stretch)**: Apollo.io API search by title + industry keywords
- Stores records in `leads` with status `new`

### Agent 2 — Enrichment & Qualification

- Triggered per lead (or batch via "Enrich All")
- Calls Exa.ai to find recent news about the company (last 90 days)
- Calls Claude API to generate:
  1. Company summary (2–3 sentences)
  2. `walletconnect_value_prop` — how WC Pay specifically helps this company
- Updates lead to status `qualified`

### Agent 3 — Personalized Message Generation

- Triggered per qualified lead
- Calls Claude API with structured prompt (see below)
- Generates email subject + body + optional LinkedIn DM variant
- Stores in `messages` table; lead → `message_drafted`

### Agent 4 — Send + Follow-up Scheduling

- User reviews/edits messages in UI (inline edit)
- "Approve & Send" → calls Resend API, logs to `outreach_log`
- Follow-up dates written to `messages` (T+14 days, T+21 days)
- Dashboard "Due Today" section surfaces follow-up queue

---

## Claude Prompt Template (Agent 3)

```
System:
You are a top B2B sales copywriter for WalletConnect Pay — an end-to-end
crypto and stablecoin payment method (APM) for global commerce.
Key facts: 700+ wallets supported, 500M+ reachable users, $400B+ volume
in 2025, fees of 0.5–1.0% (vs 2.5–3.5% for cards), settlement in seconds,
built-in compliance. Single integration into existing PSP stacks.

User:
Write a cold outreach {platform} message to {name}, {title} at {company}.
- Company: {company_description}
- Why WC Pay helps them: {walletconnect_value_prop}
- Recent news/context: {recent_news}
- Tone: casual, peer-to-peer, no fluff, no "I hope this finds you well"
- Length: 3 sentences for email body; 2 for LinkedIn DM
- Output: JSON with keys "subject" (email only) and "body"
```

---

## UI Pages

| Page | Route | Description |
|---|---|---|
| Dashboard | `/` | Funnel stats (total / qualified / drafted / sent / responded), follow-up queue |
| Leads table | `/leads` | All leads with status filter, bulk-run enrichment, bulk-run message gen |
| Lead detail | `/leads/[id]` | Full profile, value prop, generated message, send button, log |
| Add leads | `/leads/new` | CSV upload or manual form |
| Follow-ups | `/followups` | Leads with follow-up due (sorted by date) |

---

## Phased Implementation Plan

### Phase 1 — Foundation

- `npx create-next-app` with TypeScript + Tailwind
- Install shadcn/ui, Supabase JS client, Anthropic SDK, Resend SDK
- Create Supabase project + run schema migrations
- Configure env vars: `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `RESEND_API_KEY`, `EXA_API_KEY`
- Basic layout with sidebar navigation

### Phase 2 — Agent 1: Lead Input

- CSV upload page with Papa Parse
- Manual entry form
- Leads table with status badges

### Phase 3 — Agent 2: Enrichment

- `/api/enrich/[id]` route: Exa.ai → Claude → Supabase update
- "Enrich" button per lead + "Enrich All" batch action
- Display value prop on lead detail page

### Phase 4 — Agent 3: Message Generation

- `/api/generate-message/[id]` route: Claude API call with prompt template
- Inline message editor on lead detail page
- LinkedIn variant toggle

### Phase 5 — Agent 4: Send + Follow-up

- `/api/send/[id]` route: Resend email API + log to `outreach_log`
- Follow-up date calculation + storage
- "Due Today" section on dashboard

### Phase 6 — Polish + Deploy

- Dashboard funnel chart (Recharts or shadcn charts)
- Seed realistic demo leads for CEO presentation
- Deploy to Vercel (`vercel --prod`)
- Share URL

---

## Verification & Testing Checklist

1. Upload a CSV with 5 test leads → verify they appear in the table
2. Run enrichment on each → verify value props are sensible for WC Pay
3. Generate messages → review personalization quality
4. Send a test email to yourself → verify received via Resend
5. Check follow-up dates appear correctly in dashboard
6. Open Vercel URL in incognito → confirm CEO can view without auth
7. (Optional) Add basic auth with a shared password via Vercel env vars

---

## Project File Structure

```
walletconnect-gtm/
├── app/
│   ├── layout.tsx              # Root layout with sidebar
│   ├── page.tsx                # Dashboard (funnel + follow-ups)
│   ├── leads/
│   │   ├── page.tsx            # Leads table
│   │   ├── new/page.tsx        # CSV upload + manual entry
│   │   └── [id]/page.tsx       # Lead detail
│   ├── followups/
│   │   └── page.tsx            # Follow-up queue
│   └── api/
│       ├── leads/
│       │   └── route.ts        # POST: create lead(s)
│       ├── enrich/
│       │   └── [id]/route.ts   # POST: enrich lead
│       ├── generate-message/
│       │   └── [id]/route.ts   # POST: generate message
│       └── send/
│           └── [id]/route.ts   # POST: send email
├── components/
│   ├── sidebar.tsx
│   ├── lead-table.tsx
│   ├── lead-status-badge.tsx
│   ├── funnel-chart.tsx
│   └── message-editor.tsx
├── lib/
│   ├── supabase.ts             # Supabase client
│   ├── claude.ts               # Anthropic client
│   ├── exa.ts                  # Exa.ai client
│   └── resend.ts               # Resend client
├── types/
│   └── index.ts                # Lead, Message, OutreachLog types
├── supabase/
│   └── schema.sql              # Database schema
├── scripts/
│   └── seed.ts                 # Demo data seed script
├── .env.example
├── .env.local                  # Not committed
├── PlanGTMagent.md             # This document
└── README.md
```

---

## Key Design Decisions

### Why Human-in-the-Loop?

Fully autonomous pipelines compound errors invisibly. A CEO demo where the AI silently generates a bad value prop and sends a terrible email is worse than showing no demo at all. Human-in-the-loop means:

- The user triggers each stage intentionally
- The AI output is visible before it's acted on
- Errors are caught and corrected at each step
- The demo shows the AI "thinking" — which is more impressive than a black box

### Why Email Over LinkedIn/Twitter?

LinkedIn has no public outreach API (only approved Sales Navigator partners). Twitter API is $100+/month. Email via Resend.com is free for 3,000 sends/month, has a clean API, and is the primary B2B outreach channel for enterprise sales.

### Why Exa.ai for Company News?

Exa.ai provides semantic search over the live web — better signal-to-noise than Twitter for B2B company news. Free tier supports POC usage. Perplexity API is a good alternative.

### Why Not Build a Full Auth System?

This is a POC for a CEO demo. Adding OAuth or user accounts would take significant time and add no demo value. Use Vercel's built-in password protection (set via environment variable) if access control is needed.
