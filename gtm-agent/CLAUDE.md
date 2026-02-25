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
Four sequential phases per lead:
1. **News search** — Exa.ai fetches recent company news (90 days)
2. **Type + size classification** — Cheap Claude call (120 tokens) → `lead_type` + `company_size_employees`; skipped if both already set
3. **Contact search** — Exa.ai targeted search using `getPrioritizedTitles(type, size)` — only runs when `contact_name` is null
4. **Full enrichment** — Single Claude call writes all remaining fields

**Why two-phase:** Phase 2 is cheap; it gates Phase 3 so we search for the right roles before spending Exa credits on the wrong titles.

### Contact targeting (`getPrioritizedTitles`)
- Separate role hierarchies for PSP and Merchant leads
- Four size tiers: `1-10 / 10-100 / 100-500 / 500-5000 / 5000+`
- Uses `company_size_employees` (headcount), NOT `company_size_revenue` — headcount determines org depth and who owns the decision
- Fallback: walks down the list if higher-priority roles aren't found

### Email generation
- Follows `/Users/sergio/Documents/Code/WalletConnect/email_generation_guidelines.md` — 6-part structure: subject → opening (specific) → value bridge → credibility signal → CTA → sign-off as "Sergio Sanchez, Partnerships Director, WalletConnect"
- Under 150 words
- Includes 2 few-shot examples in the prompt (Adyen PSP, Gucci Merchant)
- Insert first, then update follow_up fields separately (non-critical — see DB note below)

### Email inferred flag
- Claude is instructed to return `null` for `contact_email` if not found
- Code generates `firstname.lastname@domain` fallback and sets `contact_email_inferred = true`
- Table shows inferred emails in orange with an `!` badge

### Key VP (`key_vp` column)
- Stored as comma-separated string e.g. `"Lower Fees, Global Reach"`
- Rendered as color-coded pill badges via `KeyVpCell` component — NOT via `InlineSelect` (InlineSelect can't match multi-value strings)
- 5 defined value props in `lib/constants.ts`: Lower Fees, Instant Settlement, Global Reach, Zero Chargebacks, Single API

---

## Current State

### Working
- Single-page table UI with inline editing (status, type, industry, priority, crypto)
- Add Lead modal: manual form + CSV upload with column mapping
- Enrichment pipeline (4-phase): news → classify → contacts → full enrich
- Tiered decision-maker targeting by lead type and company size
- Message generation with 6-part email structure + follow-up drafts
- Email sending via Resend; lead status → `Contacted` on send
- Delete All with confirmation
- Batch enrich (sequential, per-row spinner feedback)
- Message panel: company info sidebar + email editor + follow-up fields + recipient display
- `key_vp` displays as colored pill badges in table

### Pending DB migration
Run this in Supabase SQL editor if the `messages` table is missing follow-up columns:
```sql
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS follow_up_1_due  timestamptz,
  ADD COLUMN IF NOT EXISTS follow_up_2_due  timestamptz,
  ADD COLUMN IF NOT EXISTS follow_up_1_body text,
  ADD COLUMN IF NOT EXISTS follow_up_2_body text;
```
Without this, follow-up fields will be empty after generation (generation itself still works).

### Known issues / tech debt
- `lead_priority` skews "High" — enrichment prompt not calibrated well enough; needs tighter scoring rubric
- Send route re-generates follow-ups with a second Claude call after sending, overwriting any panel edits saved via `update-message`. Redundant — should be removed.
- No actual follow-up scheduler — T+14 / T+21 due dates are stored but never triggered
- Resend is on `onboarding@resend.dev` (free domain) — domain verification needed for production
- `recharts` is installed but unused
- `scripts/seed.ts` still exists but is no longer wired to any UI

---

## Next Steps

1. **Fix `lead_priority` skew** — add a scoring rubric to the Phase 4 Claude prompt: "High" = active crypto strategy or crypto-adjacent product, "Medium" = payments-focused but no crypto signal, "Low" = unclear fit. Currently almost always returns "High".

2. **Apollo API fallback** — `qualify/[id]` has `// TODO: if EXA contact search returns no results, fall back to Apollo API`. Add Apollo People Search call when Exa returns no contact info. Env var: `APOLLO_API_KEY`.

3. **Follow-up automation** — build a scheduler (Vercel Cron or Supabase Edge Function) that queries `messages` where `follow_up_1_due <= now()` and `sent_at IS NOT NULL` and sends the follow-up email via Resend.

4. **Remove redundant follow-up generation from send route** — `app/api/send/[id]/route.ts` lines 56-86 call Claude again post-send. Follow-ups are already generated in `generate-message`. Delete this block.

---

## Important Context

### Gotchas
- **No FK between `messages` and `leads`** — `DROP TABLE leads CASCADE` was run during the DB rebuild; it dropped the FK constraint from `messages.lead_id → leads.id`. The send route fetches lead and message in separate queries as a workaround — do not reintroduce a join.
- **`key_vp` is multi-value** — never pass it to `InlineSelect`; always use `KeyVpCell`.
- **`walletconnect_value_prop` vs `key_vp`** — `walletconnect_value_prop` is a free-text paragraph written by Claude explaining fit; `key_vp` is a comma-separated list of 1-2 standardized keys from `WC_VALUE_PROPS`.
- **Exa searches are two parallel calls** in `searchForDecisionMakers` (site-specific + general web). Results are deduplicated by URL before being passed to Claude.
- **Current Claude model:** `claude-sonnet-4-5` (set in `lib/claude.ts`). Update there to change globally.
- **Enrichment only writes null fields** — it will never overwrite a manually set value. Check `overwritableFields` and `contactFields` arrays in `qualify/[id]/route.ts`.

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
