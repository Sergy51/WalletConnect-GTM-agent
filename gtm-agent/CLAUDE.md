# CLAUDE.md — WalletConnect Pay GTM Agent

## Project Overview

- **What it does:** AI-powered B2B outbound sales pipeline for WalletConnect Pay — enriches leads, finds decision-makers, drafts personalized cold emails, and sends them via Resend
- **Stack:** Next.js 16.1.6 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui (New York style), Supabase (Postgres), Anthropic Claude (`claude-sonnet-4-5`), Exa.ai, Resend, PapaParse, Apollo.io, Perplexity
- **Architecture:** Single-page Next.js app; no routing — `app/page.tsx` is the entire UI. API routes in `app/api/`. No auth.

---

## Key Decisions & Conventions

### Coding style
- TypeScript strict mode; no `any` (except `enriched` in qualify route which uses `Record<string, any>` to handle Claude returning nested objects)
- API routes use `NextRequest` / `NextResponse` with `params: Promise<{ id: string }>`
- Client components at the top of the file with `'use client'`; server-only logic in `app/api/`
- Inline helper components defined inside `page.tsx` (e.g. `InlineSelect`, `TruncatedCell`, `KeyVpCell`, `Spinner`)

### Naming
- DB columns: `snake_case` — `contact_name`, `lead_type`, `company_size_employees`
- TS interfaces: `PascalCase` — `Lead`, `Message`, `OutreachLog`, `StrategicPriorities`
- API routes: REST-style (`/api/leads`, `/api/qualify/[id]`, `/api/generate-message/[id]`)

### Enrichment pipeline (`/api/qualify/[id]`)
Six phases per lead (Phase 1 runs three sources in parallel):
0. **Website discovery** — if `company_website` is null, Exa finds the official site and saves it before proceeding
1. **News + Perplexity + Twitter (parallel)** — all three run concurrently:
   - Exa news search → `news_sources` + `companyNews` context for Claude
   - Perplexity `sonar` model → `company_content` array in `strategic_priorities`
   - Twitter/X via Exa (`includeDomains: ['twitter.com','x.com','linkedin.com']`) → `social_media` array
2. **Type + size classification** — cheap Claude call (120 tokens) → `lead_type` + `company_size_employees`; skipped if both already set
3. **Contact search** — two-phase Exa search using `getPrioritizedTitles(type, size)`; only runs when `contact_name` is null
4. **Full enrichment** — single Claude call writes all remaining fields; `strategic_priorities` returned as structured JSON `{ news_and_press, company_content, social_media }`; status → `Enriched`
4b. **Apollo lookup (optional)** — if `useApollo=true` in request body and no email found yet, calls Apollo People Match. Verified emails set `contact_email_inferred = false`, `contact_email_verified = true`.

**Why two-phase classification:** Phase 2 is cheap; it gates Phase 3 so we search for the right roles before spending Exa credits on the wrong titles.

### Strategic priorities — structured JSON format
`strategic_priorities` is stored as a JSON string in the DB (text column). Shape:
```json
{
  "news_and_press": ["bullet from Exa news", "..."],
  "company_content": [{ "text": "bullet from Perplexity", "url": "https://source" }, "legacy string"],
  "social_media": [{ "text": "cleaned text", "url": "https://..." }]
}
```
- `news_and_press`: 2–4 bullets extracted by Claude from Exa news context
- `company_content`: `{ text, url }` objects from Perplexity `sonar` search (with citation URLs) — focuses on payments/fintech/crypto. Legacy leads may have plain strings; UI and email generation handle both formats.
- `social_media`: `{ text, url }` objects from Twitter/X/LinkedIn via Exa — strictly filtered to social domains only
- All three sections render as bullet-point summaries with `(source)` / `(LinkedIn)` / `(X)` links in the message panel
- Legacy leads with a flat string still render correctly (backward-compatible fallback in both UI and email generation)
- **Social media is NOT passed to the email drafting agent** — tweet content is too noisy; only `news_and_press` and `company_content` feed the email prompt

### Apollo People Match (`lib/apollo.ts`)
- Endpoint: `POST https://api.apollo.io/api/v1/people/match` with params as **URL query string** (not JSON body)
- Key params: `name` (full name), `organization_name`, `domain`, `reveal_personal_emails=true`
- Pass `linkedin_url` if available — most reliable identifier
- `reveal_personal_emails=true` is required; without it Apollo withholds emails even if they exist
- Free tier: 60 API calls/hour, 10,000 email credits/year. API key plan must support email reveal — free tier API keys may not reveal emails despite the parameter
- `email_status: 'unavailable'` = Apollo has the person but no verified work email. Falls through to generated fallback.
- `email_status: null` with a sparse record (no title, no linkedin) = matched wrong/incomplete record; likely a name disambiguation issue

### Perplexity search (`lib/perplexity.ts`)
- Model: `sonar` (search-enabled)
- Prompt asks for 3–5 specific strategic priority bullets related to payments/fintech/digital transformation/crypto
- Returns `PerplexityResult[]` = `{ text: string, url: string | null }[]` — captures citation URLs from the Perplexity API response
- Citation markers like `[1]` in the text are matched to the `citations` array and stripped from displayed text
- Gracefully returns `[]` on failure or missing `PERPLEXITY_API_KEY`

### Twitter/social search (`lib/twitter.ts`)
- Uses existing `EXA_API_KEY` — no new credentials needed
- `includeDomains: ['twitter.com', 'x.com', 'linkedin.com']` — but Exa doesn't always respect this strictly, so results are **post-filtered** by `isSocialDomain()` to reject anything not from those three domains
- LinkedIn posts are often login-walled — `cleanText()` detects "Agree & Join LinkedIn" boilerplate and uses the article title instead
- Returns `TweetResult[]` = `{ text: string, url: string }[]`

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
- Stored as JSON string in `leads.news_sources`; displayed as pill links under "News & Press Releases" in the message panel

### Contact targeting (`getPrioritizedTitles`)
- Separate role hierarchies for PSP and Merchant leads
- Four size tiers: `1-10 / 10-100 / 100-500 / 500-5000 / 5000+`
- Uses `company_size_employees` (headcount), NOT `company_size_revenue` — headcount determines org depth and who owns the decision
- Fallback: walks down the list if higher-priority roles aren't found

### Email generation (`/api/generate-message/[id]`)
- Sign-off: "Sergio Sanchez, Partnerships Lead, WalletConnect" (note: **Lead**, not Director)
- 6-part structure: subject → opening (specific) → value bridge → credibility signal → CTA → sign-off
- Under 150 words; opening must reference a specific real milestone from news
- Includes 3 few-shot examples in the prompt (Adyen PSP, Outpayce PSP Travel, Gucci Merchant)
- Banned openers: "I hope this finds you well", "I wanted to reach out"
- Strategic intel fed to email: `news_and_press` + `company_content` only. Social media excluded (too noisy).
- Instruction: "pick the SINGLE most relevant data point — prefer payments/crypto/digital assets/partnerships"
- **Key VP expansion**: The lead's `key_vp` values are expanded into a `=== KEY VALUE PROPOSITIONS TO EMPHASISE ===` section using the `emailContext` field from `WC_VALUE_PROPS` in `lib/constants.ts`. This gives the drafting agent rich product data (pricing, stats, competitive comparisons from the WC Pay product overview) to weave into the value bridge. The agent is explicitly instructed to use these specific arguments.
- **GTM track context**: Uses `lead.lead_type === 'Merchant'` to determine framing. Merchant = revenue/cost play; all other types = distribution/infrastructure play with actual `lead_type` name included. The old `=== 'PSP'` check was a legacy value that broke the split.

### Email flags (`contact_email_inferred`, `contact_email_verified`)
- `contact_email_inferred = true` + orange `!` badge → AI-generated `firstname.lastname@domain` fallback
- `contact_email_verified = true` + green `✓` badge → verified by Apollo People Match
- Neither flag → email found by Claude in source text (press releases, team pages)

### Key VP (`key_vp` column)
- Stored as comma-separated string e.g. `"Integration Simplicity, Compliance"`
- Rendered as color-coded pill badges via `KeyVpCell` — NOT via `InlineSelect` (can't match multi-value strings)
- **Two separate VP sets** defined in `lib/constants.ts`:
  - **Non-merchant** (`NON_MERCHANT_VALUE_PROPS`): Integration Simplicity, Compliance, Widest Coverage, Modular, Fee Predictability
  - **Merchant** (`MERCHANT_VALUE_PROPS`): Faster Settlement, Lower Fees, New Volumes, Best-in-Class UX
  - `WC_VALUE_PROPS` = combined spread of both (for UI checkbox picker)
- Each VP has three fields: `key` (display label), `description` (short, shown in UI tooltips), `emailContext` (rich product data from WC Pay overview, fed to email drafting agent only — NOT shown in table UI)
- Enrichment prompt only shows the applicable VP set based on `lead_type` and instructs Claude to hyper-tailor based on company size, crypto maturity, pain points, and business model
- `industry` field is only populated for Merchant leads; null for all other types

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
- Add Lead modal: manual form + CSV upload with column mapping
- Enrichment pipeline (6-phase): website → news+Perplexity+Twitter → classify → contacts → full enrich → Apollo
- Apollo.io email lookup with UI dialog (single + batch); green ✓ badge for verified emails
- Perplexity strategic priorities search (company_content)
- Twitter/LinkedIn social search via Exa (social_media) — displayed as bullet summaries with source links
- Structured `strategic_priorities` JSON with three collapsible sections in message panel (all rendered as bullet summaries with source links)
- Two-phase LinkedIn URL discovery (name extraction → targeted profile search)
- Payments-focused news with generic URL filtering; sources as pill links under News & Press Releases
- Primary contact fields in message panel (name, role, email, LinkedIn) — editable, auto-save on blur, with inferred/verified email badges
- Secondary contact fields in message panel (name, email, LinkedIn) — manual only
- Tiered decision-maker targeting by lead type and company size
- Message generation with 6-part email structure + follow-up drafts
- Email sending via Resend; lead status → `Contacted` on send
- Delete All / Delete selected (N) with confirmation
- Batch enrich (sequential, per-row spinner feedback) with optional Apollo dialog
- Apollo dialog shown once for batch; choice applied to all leads in the run
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

-- Apollo verified email flag
ALTER TABLE leads ADD COLUMN IF NOT EXISTS contact_email_verified boolean DEFAULT false;

-- Follow-up scheduling
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS follow_up_1_due  timestamptz,
  ADD COLUMN IF NOT EXISTS follow_up_2_due  timestamptz,
  ADD COLUMN IF NOT EXISTS follow_up_1_body text,
  ADD COLUMN IF NOT EXISTS follow_up_2_body text;

-- Dashboard follow-up send tracking
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS follow_up_1_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS follow_up_2_sent_at timestamptz;
```

### Known issues / tech debt
- ~~Send route re-generates follow-ups with a second Claude call after sending, overwriting panel edits~~ — FIXED. Redundant Claude call removed from `app/api/send/[id]/route.ts`.
- ~~Email drafting `gtmTrack` used legacy `=== 'PSP'` check that never matched~~ — FIXED. Now uses `=== 'Merchant'` split.
- No actual follow-up scheduler — T+14 / T+21 due dates are stored but never triggered
- Resend is on `onboarding@resend.dev` (free domain) — domain verification needed for production
- `recharts` is installed but unused
- `scripts/seed.ts` still exists but is no longer wired to any UI
- Twitter/X social search returns limited results — Exa's domain filtering for twitter.com/x.com is unreliable (results often come from news sites despite `includeDomains`); post-filtering rejects non-social domains but means the section is often empty
- Existing leads enriched before this session will have old VP keys (e.g. "Global Reach", "Single API", "Instant Settlement") that no longer match the new VP set — they'll render with gray fallback color in the UI. Re-enriching will assign new VPs.

---

## Next Steps

1. ~~**Apollo API for contact enrichment**~~ — DONE. Apollo People Match integrated. Green ✓ badge for verified emails. Apollo dialog for single and batch enrich. Env vars: `APOLLO_API_KEY`, `NEXT_PUBLIC_APOLLO_ENABLED=true`.

2. ~~**Perplexity + Twitter enrichment**~~ — DONE. Both integrated into Phase 1 parallel call. Structured `strategic_priorities` JSON. Collapsible three-section display in message panel.

3. **Improve social media sourcing** — Exa's Twitter/X results are unreliable (domain filter not strictly respected). Options: (a) use a dedicated Twitter API or RapidAPI Twitter scraper; (b) drop Twitter entirely and rely on Perplexity + news for social signals; (c) keep as-is (pills-only display, data collected but low signal).

4. **Follow-ups tab** — build a proper follow-up management view: list all sent leads with `follow_up_1_due` / `follow_up_2_due` dates, ability to preview/edit follow-up copy, and a send button per follow-up. Also remove the redundant Claude call in the send route.

5. **Tracking dashboard tab** — pipeline metrics: leads by status, conversion rates, emails sent vs opened, top industries/lead types. `recharts` is already installed.

6. **Make enrichment faster** — Phase 0 (website discovery) still runs before Phase 1. Could parallelize 0+1 for companies that already have a website. Also consider running Phase 2 classification inside the Phase 4 prompt to save one Claude call.

---

## Important Context

### Gotchas
- **No FK between `messages` and `leads`** — `DROP TABLE leads CASCADE` was run during the DB rebuild; it dropped the FK constraint. The send route fetches lead and message in separate queries — do not reintroduce a join.
- **`key_vp` is multi-value** — never pass it to `InlineSelect`; always use `KeyVpCell`.
- **`walletconnect_value_prop` vs `key_vp`** — `walletconnect_value_prop` is a free-text paragraph written by Claude explaining fit; `key_vp` is a comma-separated list of 1-2 standardized keys from `NON_MERCHANT_VALUE_PROPS` or `MERCHANT_VALUE_PROPS` depending on lead type.
- **`industry` is Merchant-only** — The enrichment prompt and a post-enrichment guard both enforce that `industry` is null for non-Merchant leads. Don't change this without updating both.
- **VP sets are type-dependent** — The enrichment prompt only shows VPs from the applicable set (merchant vs non-merchant). The `InlineKeyVpCell` checkbox picker in `page.tsx` shows all VPs combined (`WC_VALUE_PROPS`). If you add/rename a VP key, update: `lib/constants.ts`, `VP_COLORS` in both `page.tsx` and `message-panel.tsx`.
- **`emailContext` vs `description` on VPs** — `description` is the short label for UI display. `emailContext` is the rich product context fed to the email drafting agent. Only `emailContext` should reference specific stats, pricing, and competitive data from the WC Pay product overview.
- **Contact search is two-phase** — Phase A runs 3 parallel Exa calls; Phase B does one more targeted LinkedIn search by extracted person name. Total: up to 4 Exa calls per enrichment in the contact phase alone.
- **`isGenericUrl` in news search** — filters URLs where `pathname` has ≤2 segments and any segment matches known index words (news, blog, press, company, en, fr, etc.). Keeps specific article slugs, tweets, LinkedIn posts.
- **Current Claude model:** `claude-sonnet-4-5` (set in `lib/claude.ts`). Update there to change globally.
- **Enrichment only writes null fields** — never overwrites manually set values. Check `overwritableFields` and `contactFields` arrays in `qualify/[id]/route.ts`.
- **Apollo params must be query string, not JSON body** — the People Match endpoint is POST but expects parameters as URL query params (`?name=...&domain=...`), not as a JSON body. Sending as JSON body causes the API to return sparse/wrong matches.
- **Apollo free tier may not reveal emails via API** — the UI can show emails you can see on app.apollo.io, but the API key's plan level determines what `reveal_personal_emails=true` actually returns. Upgrade to a paid plan for reliable email reveal.
- **Social media domain filtering is post-hoc** — `includeDomains` in Exa is not always reliable. `isSocialDomain()` in `lib/twitter.ts` filters results after the fact; always keep this filter in place.
- **`strategic_priorities` backward compatibility** — old leads have a flat string value. Both the email generation route and the message panel UI handle this gracefully with a try/catch and legacy fallback path. Within the structured format, `company_content` items can be `{ text, url }` objects (new, with Perplexity citations) or plain strings (legacy). Both UI and email generation handle both.
- **`saveContactField` is generic** — The function in `message-panel.tsx` (formerly `saveSecondaryContact`) patches any lead field by name. Used for both primary and secondary contact fields.

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
APOLLO_API_KEY                # Apollo People Match for email lookup
NEXT_PUBLIC_APOLLO_ENABLED    # Set to 'true' to show Apollo dialog in UI
PERPLEXITY_API_KEY            # Perplexity sonar search for company priorities
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
- Active branch: `feature/dashboard-tab` (branched from `main`)
