# CLAUDE.md — WalletConnect Pay GTM Agent

## Project Overview

- **What it does:** AI-powered B2B outbound sales pipeline for WalletConnect Pay — enriches leads, finds decision-makers, drafts personalized cold emails, and sends them via Resend
- **Stack:** Next.js 16.1.6 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui (New York style), Supabase (Postgres), Anthropic Claude (`claude-sonnet-4-5`), Exa.ai, Resend, PapaParse
- **Architecture:** Single-page Next.js app; no routing — `app/page.tsx` is the entire UI. API routes in `app/api/`. No auth.

---

## Key Decisions & Conventions

### Coding style
- TypeScript strict mode; no `any`
- API routes use `NextRequest` / `NextResponse` with `params: Promise<{ id: string }>`
- Client components at the top of the file with `'use client'`; server-only logic in `app/api/`
- Inline helper components defined inside `page.tsx` (e.g. `InlineSelect`, `TruncatedCell`, `KeyVpCell`, `Spinner`)

### Naming
- DB columns: `snake_case` — `contact_name`, `lead_type`, `company_size_employees`
- TS interfaces: `PascalCase` — `Lead`, `Message`, `OutreachLog`
- API routes: REST-style (`/api/leads`, `/api/qualify/[id]`, `/api/generate-message/[id]`)

### Enrichment pipeline (`/api/qualify/[id]`)
Five sequential phases per lead:
0. **Website discovery** — if `company_website` is null, Exa finds the official site and saves it before proceeding
1. **News search** — Exa fetches payments-relevant company news (90 days); sources stored as JSON in `news_sources`
2. **Type + size classification** — cheap Claude call (120 tokens) → `lead_type` + `company_size_employees`; skipped if both already set
3. **Contact search** — two-phase Exa search using `getPrioritizedTitles(type, size)`; only runs when `contact_name` is null
4. **Full enrichment** — single Claude call writes all remaining fields; status → `Enriched`

**Why two-phase classification:** Phase 2 is cheap; it gates Phase 3 so we search for the right roles before spending Exa credits on the wrong titles.

### Contact search — two-phase Exa strategy (`lib/exa.ts → searchForDecisionMakers`)
- **Phase A** — 3 parallel searches:
  1. Company website's team/about/leadership pages (`site:${website}`)
  2. Broad web search for named executives (`"Company" (Title OR Title) name contact`)
  3. LinkedIn profiles filtered by company + title (`includeDomains: ['linkedin.com']`)
- **Phase B** — extracts candidate person names from Phase A text using a capitalised-words regex, then does a targeted LinkedIn search: `("Firstname Lastname") "Company"` filtered to `linkedin.com`. Catches cases where the name appears in a press release but no LinkedIn URL came back from the title search.
- Results from all phases are deduplicated by URL before being passed to Claude.

### News sources (`lib/exa.ts → searchCompanyNews`)
- Query is payments-focused: `"Company" payments crypto digital assets stablecoin checkout partnerships product launch news`
- Fetches 6 candidates, filters with `isGenericUrl()`, takes up to 3 specific articles
- `isGenericUrl` drops root domains, category pages (`/news`, `/blog`, `/en/news`), LinkedIn company profiles — keeps specific article URLs, tweets, LinkedIn posts
- Stored as JSON string in `leads.news_sources`; displayed as pill links in the message panel
- LinkedIn posts and tweets are allowed (not excluded)

### Contact targeting (`getPrioritizedTitles`)
- Separate role hierarchies for PSP and Merchant leads
- Four size tiers: `1-10 / 10-100 / 100-500 / 500-5000 / 5000+`
- Uses `company_size_employees` (headcount), NOT `company_size_revenue` — headcount determines org depth and who owns the decision
- Fallback: walks down the list if higher-priority roles aren't found

### Email generation
- Follows `/Users/sergio/Documents/Code/WalletConnect/email_generation_guidelines.md` — 6-part structure: subject → opening (specific) → value bridge → credibility signal → CTA → sign-off as "Sergio Sanchez, Partnerships Director, WalletConnect"
- Under 150 words; opening must reference a specific real milestone from news
- Includes 3 few-shot examples in the prompt (Adyen PSP, Outpayce PSP Travel, Gucci Merchant)
- Banned openers: "I hope this finds you well", "I wanted to reach out"
- Insert first, then update follow_up fields separately (non-critical — see DB note below)

### Email inferred flag
- Claude is instructed to return `null` for `contact_email` if not found
- Code generates `firstname.lastname@domain` fallback and sets `contact_email_inferred = true`
- Table shows inferred emails in orange with an `!` badge

### Key VP (`key_vp` column)
- Stored as comma-separated string e.g. `"Lower Fees, Global Reach"`
- Rendered as color-coded pill badges via `KeyVpCell` — NOT via `InlineSelect` (can't match multi-value strings)
- 6 defined value props in `lib/constants.ts`: Lower Fees, Instant Settlement, Global Reach, Compliance, New Volumes, Single API
- PSP hint: prefer Compliance + Single API; Merchant hint: prefer Lower Fees + New Volumes

### Lead priority (`lead_priority`)
- Two tiers: `High` (crypto/digital assets/stablecoins/Web3 mentioned in strategic priorities) or `Medium` (not mentioned)
- Displayed in table as "Crypto Priority" column

### Lead status & sort order
- Statuses: `New → Enriched → Contacted → Proposal → Negotiating → Won | Lost | Churned`
- Table sorted by funnel stage (Won first, Churned last) then alphabetically within each stage
- `STATUS_RANK` map drives the sort in `sortLeads()`, applied on every state mutation

---

## Current State

### Working
- Single-page table UI with inline editing for all fields; company name click opens message panel
- Add Lead modal: manual form (upfront: Company, Website, Contact, Role, Email; more fields: Type, Industry, Employees, Revenue, LinkedIn, Key VP) + CSV upload with column mapping
- Enrichment pipeline (5-phase): website → news → classify → contacts → full enrich
- Two-phase LinkedIn URL discovery (name extraction → targeted profile search)
- Payments-focused news with generic URL filtering; sources displayed as pill links in panel
- Secondary contact fields in message panel (name, email, LinkedIn) — manual only
- Tiered decision-maker targeting by lead type and company size
- Message generation with 6-part email structure + follow-up drafts; enrich button in panel for New leads
- Email sending via Resend; lead status → `Contacted` on send
- Delete All with confirmation
- Batch enrich (sequential, per-row spinner feedback)
- Leads sorted by funnel stage then alphabetically

### Pending DB migrations
Run in Supabase SQL editor if columns are missing:
```sql
-- Secondary contact fields
ALTER TABLE leads ADD COLUMN IF NOT EXISTS secondary_contact_name text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS secondary_contact_email text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS secondary_contact_linkedin text;

-- News sources (JSON array stored as text)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS news_sources text;

-- Follow-up scheduling
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS follow_up_1_due  timestamptz,
  ADD COLUMN IF NOT EXISTS follow_up_2_due  timestamptz,
  ADD COLUMN IF NOT EXISTS follow_up_1_body text,
  ADD COLUMN IF NOT EXISTS follow_up_2_body text;
```

### Known issues / tech debt
- Send route re-generates follow-ups with a second Claude call after sending, overwriting panel edits. Redundant — should be removed (`app/api/send/[id]/route.ts` lines 56-86).
- No actual follow-up scheduler — T+14 / T+21 due dates are stored but never triggered
- Resend is on `onboarding@resend.dev` (free domain) — domain verification needed for production
- `recharts` is installed but unused
- `scripts/seed.ts` still exists but is no longer wired to any UI

---

## Next Steps

1. **Apollo API for contact enrichment** — `qualify/[id]` has `// TODO: if EXA contact search returns no results, fall back to Apollo API`. Implement Apollo People Search when Exa returns no contact info. Env var: `APOLLO_API_KEY`. Apollo returns verified emails and LinkedIn URLs — much more reliable than Exa for this purpose.

2. **Follow-ups tab** — build a proper follow-up management view: list all sent leads with `follow_up_1_due` / `follow_up_2_due` dates, ability to preview/edit follow-up copy, and a send button per follow-up. Also remove the redundant Claude call in the send route (see tech debt above).

3. **Tracking dashboard tab** — add a second tab (or section) with pipeline metrics: leads by status, conversion rates, emails sent vs opened, top industries/lead types. `recharts` is already installed and ready to use.

4. **Make enrichment faster** — current pipeline is sequential (5 phases, multiple round-trips). Ideas: parallelise Phase 1 + Phase 0 where possible; cache Exa results for recently searched companies; consider running Phase 2 classification inside the Phase 4 prompt to save one Claude call; explore streaming responses to show partial results sooner.

---

## Important Context

### Gotchas
- **No FK between `messages` and `leads`** — `DROP TABLE leads CASCADE` was run during the DB rebuild; it dropped the FK constraint. The send route fetches lead and message in separate queries — do not reintroduce a join.
- **`key_vp` is multi-value** — never pass it to `InlineSelect`; always use `KeyVpCell`.
- **`walletconnect_value_prop` vs `key_vp`** — `walletconnect_value_prop` is a free-text paragraph written by Claude explaining fit; `key_vp` is a comma-separated list of 1-2 standardized keys from `WC_VALUE_PROPS`.
- **Contact search is two-phase** — Phase A runs 3 parallel Exa calls; Phase B does one more targeted LinkedIn search by extracted person name. Total: up to 4 Exa calls per enrichment in the contact phase alone.
- **`isGenericUrl` in news search** — filters URLs where `pathname` has ≤2 segments and any segment matches known index words (news, blog, press, company, en, fr, etc.). Keeps specific article slugs, tweets, LinkedIn posts.
- **Current Claude model:** `claude-sonnet-4-5` (set in `lib/claude.ts`). Update there to change globally.
- **Enrichment only writes null fields** — never overwrites manually set values. Check `overwritableFields` and `contactFields` arrays in `qualify/[id]/route.ts`.

### DB schema tables
- `leads` — recreated clean (no cascade dependencies remain)
- `messages` — kept from original project; may need `follow_up_*` migration above
- `outreach_log` — kept as-is, logs send events

### Environment variables (names only)
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
ANTHROPIC_API_KEY
RESEND_API_KEY
RESEND_FROM_EMAIL
EXA_API_KEY
# APOLLO_API_KEY  (not yet implemented)
```

### Email guidelines
Full tone/structure guidelines for outreach emails live at:
`/Users/sergio/Documents/Code/WalletConnect/email_generation_guidelines.md`
(outside the repo — copy relevant sections into the prompt if regenerating)

### Tests
None. No test framework installed.

---

## Commands Reference

```bash
# Dev
npm run dev          # Start dev server at localhost:3000

# Build & run
npm run build        # Production build
npm start            # Serve production build

# Lint
npm run lint         # ESLint check

# Supabase DB — run in Supabase SQL editor, not locally
# See: supabase/schema.sql for the full leads table DDL
```

### Git
- Active branch: `feat/new-model-ui-rewrite`
- Base branch: `main`
