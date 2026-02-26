import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { anthropic, CLAUDE_MODEL, WC_PAY_SYSTEM_PROMPT } from '@/lib/claude'
import { searchCompanyNews, searchForDecisionMakers, findCompanyWebsite } from '@/lib/exa'
import { searchCompanyPriorities } from '@/lib/perplexity'
import { searchRelevantTweets, type TweetResult } from '@/lib/twitter'
import { searchPersonEmail } from '@/lib/apollo'
import { INDUSTRIES, WC_VALUE_PROPS } from '@/lib/constants'

// Contact priority is based on company_size_employees (headcount), NOT company_size_revenue.
// Headcount determines how specialised/layered the org chart is.
// Revenue is used only as a qualification signal, not for targeting decisions.

function getPrioritizedTitles(
  leadType: string | null,
  employeeRange: string | null
): string[] {
  if (leadType === 'PSP') {
    if (employeeRange === '5000+') return [
      'Head of Alternative Payments',
      'VP Alternative Payments',
      'Global Head of Partnerships',
      'Head of Crypto Products',
      'Head of Digital Assets',
      'Director of Partnerships',
      'VP Partnerships',
      'Head of Business Development',
      'VP Product',
    ]
    if (employeeRange === '500-5000') return [
      'Head of APMs',
      'Head of Alternative Payments',
      'VP Partnerships',
      'Director of Partnerships',
      'Head of Crypto',
      'Head of Digital Assets',
      'VP Product',
      'Head of Business Development',
      'CTO',
    ]
    if (employeeRange === '100-500') return [
      'VP Partnerships',
      'VP Product',
      'Head of Business Development',
      'Head of APMs',
      'Head of Alternative Payments',
      'VP Engineering',
      'CTO',
      'CEO',
      'Founder',
    ]
    // 1-10 or 10-100
    return ['CEO', 'Founder', 'Co-founder', 'CTO', 'VP Product', 'VP Partnerships']
  }

  if (leadType === 'Merchant') {
    if (employeeRange === '5000+') return [
      'VP Global Payments',
      'Head of Global Payments',
      'VP Payments',
      'Head of Payment Products',
      'Director of Treasury Operations',
      'VP Financial Operations',
      'Head of Checkout',
      'VP Commerce',
      'Director of Finance',
    ]
    if (employeeRange === '500-5000') return [
      'VP Payments',
      'Head of Payments',
      'Director of Treasury',
      'VP Financial Operations',
      'Head of Checkout',
      'VP Commerce',
      'CFO',
    ]
    if (employeeRange === '100-500') return [
      'Head of Payments',
      'Director of Payments',
      'VP Finance',
      'Head of E-commerce',
      'Director of Product',
      'CFO',
      'CEO',
    ]
    // 1-10 or 10-100
    return ['CEO', 'Founder', 'Co-founder', 'CFO', 'Head of Operations', 'CTO']
  }

  // Other / Unknown — generic fallback, biased toward seniority at large companies
  if (employeeRange === '5000+' || employeeRange === '500-5000') return [
    'VP Partnerships',
    'Director of Partnerships',
    'Head of Business Development',
    'VP Product',
    'CFO',
    'CTO',
  ]
  if (employeeRange === '100-500') return [
    'VP Partnerships',
    'VP Product',
    'Head of Business Development',
    'CFO',
    'CTO',
    'CEO',
  ]
  return ['CEO', 'Founder', 'Co-founder', 'CTO', 'CFO', 'VP Partnerships']
}

function getDomain(website: string | null): string | null {
  if (!website) return null
  try {
    return new URL(website).hostname.replace(/^www\./, '')
  } catch { return null }
}

function generateFallbackEmail(name: string | null, website: string | null, company: string): string {
  const domain = getDomain(website) ?? company.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com'
  if (name) {
    const parts = name.toLowerCase().trim().split(/\s+/)
    return parts.length >= 2 ? `${parts[0]}.${parts[parts.length - 1]}@${domain}` : `${parts[0]}@${domain}`
  }
  return `contact@${domain}`
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const useApollo: boolean = body.useApollo === true

  const { data: lead, error: leadError } = await supabase
    .from('leads').select('*').eq('id', id).single()

  if (leadError || !lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  if (!lead.company) return NextResponse.json({ error: 'Lead must have a company name' }, { status: 400 })

  try {
    // ─── Phase 0: Find website if missing ─────────────────────────────────────
    let resolvedWebsite = lead.company_website
    if (!resolvedWebsite) {
      resolvedWebsite = await findCompanyWebsite(lead.company)
      if (resolvedWebsite) {
        await supabase.from('leads').update({ company_website: resolvedWebsite }).eq('id', id)
      }
    }

    // ─── Phase 1: Company news + Perplexity + Twitter (parallel) ──────────────
    const [{ context: companyNews, sources: newsSources }, perplexityPriorities, tweetSummaries]: [
      Awaited<ReturnType<typeof import('@/lib/exa').searchCompanyNews>>,
      string[],
      TweetResult[],
    ] = await Promise.all([
      searchCompanyNews(lead.company, resolvedWebsite),
      searchCompanyPriorities(lead.company, resolvedWebsite),
      searchRelevantTweets(lead.company, lead.contact_name, lead.secondary_contact_name),
    ])

    // ─── Phase 2: Determine type + size (skip if already known) ───────────────
    // Use the known values first so manual overrides are respected.
    let resolvedType: string | null = lead.lead_type
    let resolvedSize: string | null = lead.company_size_employees  // headcount drives contact targeting

    if (!resolvedType || !resolvedSize) {
      const p1 = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 120,
        messages: [{
          role: 'user',
          content: `Classify this company for a B2B sales tool.

Company: ${lead.company}
Website: ${resolvedWebsite || 'Unknown'}
Context: ${companyNews.slice(0, 600)}

Return ONLY valid JSON:
{
  "lead_type": "PSP" | "Merchant" | "Other",
  "company_size_employees": "1-10" | "10-100" | "100-500" | "500-5000" | "5000+" | null
}

- lead_type: "PSP" if payment processor/gateway/acquirer/infrastructure; "Merchant" if commerce/retail/marketplace/travel/gaming; "Other" otherwise
- company_size_employees: best estimate of headcount range, or null if truly unknown

No markdown, just JSON.`,
        }],
      })

      const p1Text = p1.content[0].type === 'text' ? p1.content[0].text : ''
      try {
        const p1Data = JSON.parse(p1Text.match(/\{[\s\S]*\}/)?.[0] ?? '{}')
        if (!resolvedType) resolvedType = p1Data.lead_type ?? null
        if (!resolvedSize) resolvedSize = p1Data.company_size_employees ?? null
      } catch { /* proceed with nulls */ }
    }

    // ─── Phase 3: Contact search using targeted title list ────────────────────
    let contactContext = ''
    if (!lead.contact_name) {
      const prioritizedTitles = getPrioritizedTitles(resolvedType, resolvedSize)
      contactContext = await searchForDecisionMakers(lead.company, resolvedWebsite, prioritizedTitles)
    }

    // TODO: if EXA contact search returns no results, fall back to Apollo API

    // ─── Phase 4: Full enrichment Claude call ─────────────────────────────────
    const industryList = INDUSTRIES.join(', ')
    const vpList = WC_VALUE_PROPS.map(v => `"${v.key}": ${v.description}`).join('\n')
    const vpKeys = WC_VALUE_PROPS.map(v => `"${v.key}"`).join(', ')

    // Build the ranked title list for the prompt so Claude knows the fallback order
    const prioritizedTitles = getPrioritizedTitles(resolvedType, resolvedSize)
    const titlesRanked = prioritizedTitles.map((t, i) => `  ${i + 1}. ${t}`).join('\n')

    const prompt = `You are enriching a B2B sales lead for WalletConnect Pay. Use ALL sources below.

Company: ${lead.company}
Website: ${resolvedWebsite || 'Unknown'}
Already determined — lead_type: ${resolvedType ?? 'Unknown'}, employee range: ${resolvedSize ?? 'Unknown'}

=== RECENT NEWS & COMPANY CONTEXT ===
${companyNews}

${contactContext ? `=== TEAM / CONTACT INFORMATION FOUND ===
${contactContext}

` : ''}=== CURRENTLY KNOWN CONTACT INFO ===
- Name: ${lead.contact_name || 'NOT YET KNOWN — extract from sources above'}
- Role: ${lead.contact_role || 'Unknown'}
- Email: ${lead.contact_email || 'Unknown'}

=== INSTRUCTIONS ===

CONTACT EXTRACTION — TARGET ROLE PRIORITY ORDER (work top-to-bottom, use first match found):
${titlesRanked}

Rules:
- Scan ALL sources (news, team pages, press releases) for person names and titles matching the list above
- Use the highest-priority role you find evidence of; only move to the next if no trace of the previous exists
- Recognise patterns like "Jane Smith, Head of Payments at ${lead.company}" or "${lead.company} appoints Sarah Lee as VP Partnerships"
- contact_email: return a real address only if found in the sources; otherwise return null (do NOT invent one)
- contact_linkedin: linkedin.com/in/... URL if in context; null if not found

KEY VALUE PROPOSITIONS (mandatory — never return null):
Pick 1–2 from EXACTLY: ${vpKeys}
${resolvedType === 'PSP'
  ? '→ PSP: prefer "Compliance" (travel rule + sanctions screening) and "Single API" (one integration, all merchants)'
  : resolvedType === 'Merchant'
    ? '→ Merchant: prefer "Lower Fees" (0.5–1% vs 2.5–3.5% cards) and "New Volumes" (crypto-native customers, 15–20% larger baskets)'
    : '→ Default to "Lower Fees, Global Reach" if type is unclear'}
Return as comma-separated string. If unsure, default to "Lower Fees, Global Reach".

WalletConnect Pay value prop reference:
${vpList}

OTHER FIELDS:
- lead_type: confirm or correct the already-determined value (${resolvedType ?? 'Unknown'})
- industry: exactly one from: ${industryList}
- lead_priority: score based on whether crypto payments appear in the company's strategic priorities:
  "High" = strategic priorities mention anything related to crypto, digital assets, stablecoins, blockchain payments, or Web3
  "Medium" = strategic priorities do not mention crypto or digital assets
- company_size_employees: confirm or correct (${resolvedSize ?? 'Unknown'}) — '1-10','10-100','100-500','500-5000','5000+'
- company_size_revenue: '<$1M','$1-10M','$10-100M','$100-500M','$500M+'
- strategic_priorities: Return a JSON object with this exact structure:
  {
    "news_and_press": ["bullet 1 from news context", "bullet 2"],
    "company_content": [],
    "social_media": []
  }
  Extract 2-4 concise bullets from the news context above into "news_and_press". Leave "company_content" and "social_media" as empty arrays.
- walletconnect_value_prop: 2–3 sentences on why WC Pay fits this specific company

Return ONLY valid JSON (null for unknown fields; key_vp always required):
{
  "lead_type": "PSP" | "Merchant" | "Other" | null,
  "industry": string | null,
  "company_size_employees": string | null,
  "company_size_revenue": string | null,
  "strategic_priorities": { "news_and_press": string[], "company_content": string[], "social_media": string[] },
  "lead_priority": "High" | "Medium" | null,
  "key_vp": string,
  "contact_name": string | null,
  "contact_role": string | null,
  "contact_email": string | null,
  "contact_linkedin": string | null,
  "company_description": string | null,
  "walletconnect_value_prop": string | null
}

No markdown, no explanation, just the JSON object.`

    const message = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1400,
      system: WC_PAY_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let enriched: Record<string, any>
    try {
      enriched = JSON.parse(responseText)
    } catch {
      const match = responseText.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('Could not parse Claude response')
      enriched = JSON.parse(match[0])
    }

    if (!enriched.key_vp) enriched.key_vp = 'Lower Fees, Global Reach'

    // Normalize strategic_priorities into the structured JSON string format.
    // Claude may return the field as a JSON object (structured) or a plain string (legacy).
    // Either way, we stringify it into the { news_and_press, company_content, social_media } shape.
    if (enriched.strategic_priorities != null) {
      const raw = enriched.strategic_priorities
      if (typeof raw === 'string') {
        // Check if it's already a JSON string of the structured format
        try {
          const parsed = JSON.parse(raw) as Record<string, unknown>
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            enriched.strategic_priorities = JSON.stringify({
              news_and_press: Array.isArray(parsed.news_and_press) ? parsed.news_and_press : [],
              company_content: Array.isArray(parsed.company_content) ? parsed.company_content : [],
              social_media: Array.isArray(parsed.social_media) ? parsed.social_media : [],
            })
          } else {
            // Plain string — wrap it
            enriched.strategic_priorities = JSON.stringify({
              news_and_press: [raw],
              company_content: [],
              social_media: [],
            })
          }
        } catch {
          // Not valid JSON — treat as plain string
          enriched.strategic_priorities = JSON.stringify({
            news_and_press: [raw],
            company_content: [],
            social_media: [],
          })
        }
      } else if (typeof raw === 'object') {
        // Claude returned a parsed object directly (from JSON.parse of the full response)
        const obj = raw as Record<string, unknown>
        enriched.strategic_priorities = JSON.stringify({
          news_and_press: Array.isArray(obj.news_and_press) ? obj.news_and_press : [],
          company_content: Array.isArray(obj.company_content) ? obj.company_content : [],
          social_media: Array.isArray(obj.social_media) ? obj.social_media : [],
        })
      }
    }

    // Merge Perplexity + Twitter results into structured priorities
    if ((perplexityPriorities.length > 0 || tweetSummaries.length > 0) && enriched.strategic_priorities) {
      try {
        const sp = JSON.parse(enriched.strategic_priorities as string)
        if (perplexityPriorities.length > 0) sp.company_content = perplexityPriorities
        if (tweetSummaries.length > 0) sp.social_media = tweetSummaries
        enriched.strategic_priorities = JSON.stringify(sp)
      } catch { /* ignore merge failure */ }
    }

    // Determine whether the email is real (found by Claude) or generated by us.
    // Claude is instructed to return null if it doesn't find a real address,
    // so any email we add here via generateFallbackEmail is definitively inferred.
    let emailInferred = false
    let emailVerified = false

    // Apollo lookup — try to find a verified email before falling back to generated one
    if (!lead.contact_email && !enriched.contact_email && useApollo) {
      const contactName = enriched.contact_name || lead.contact_name
      if (contactName) {
        const domain = getDomain(resolvedWebsite || lead.company_website)
        const linkedinUrl = enriched.contact_linkedin || lead.contact_linkedin
        const apolloResult = await searchPersonEmail(contactName, lead.company, domain, linkedinUrl)
        if (apolloResult?.email) {
          enriched.contact_email = apolloResult.email
          emailInferred = false
          emailVerified = true  // Apollo confirmed this email
          // Also grab LinkedIn URL if we don't have one
          if (!lead.contact_linkedin && !enriched.contact_linkedin && apolloResult.linkedin_url) {
            enriched.contact_linkedin = apolloResult.linkedin_url
          }
        }
      }
    }

    if (!lead.contact_email && !enriched.contact_email) {
      enriched.contact_email = generateFallbackEmail(
        enriched.contact_name || lead.contact_name,
        lead.company_website,
        lead.company
      )
      emailInferred = true
    }

    const updates: Record<string, string | boolean | null> = { lead_status: 'Enriched' }
    const overwritableFields = [
      'lead_type', 'industry', 'company_size_employees', 'company_size_revenue',
      'strategic_priorities', 'lead_priority', 'key_vp',
      'company_description', 'walletconnect_value_prop',
    ]
    for (const field of overwritableFields) {
      if (!lead[field] && enriched[field] != null) updates[field] = enriched[field]
    }
    const contactFields = ['contact_name', 'contact_role', 'contact_email', 'contact_linkedin']
    for (const field of contactFields) {
      if (!lead[field] && enriched[field] != null) updates[field] = enriched[field]
    }
    // Always write the inferred/verified flags so they reflect this enrichment run
    updates.contact_email_inferred = emailInferred
    updates.contact_email_verified = emailVerified
    // Always overwrite news sources with latest Exa results
    if (newsSources.length > 0) updates.news_sources = JSON.stringify(newsSources)

    const { data: updatedLead, error: updateError } = await supabase
      .from('leads').update(updates).eq('id', id).select().single()

    if (updateError) throw updateError
    return NextResponse.json(updatedLead)

  } catch (error) {
    console.error('Enrichment error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Enrichment failed' },
      { status: 500 }
    )
  }
}
