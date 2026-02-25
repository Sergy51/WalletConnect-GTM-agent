import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { anthropic, CLAUDE_MODEL, WC_PAY_SYSTEM_PROMPT } from '@/lib/claude'
import { searchCompanyNews, searchForDecisionMakers } from '@/lib/exa'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // 1. Fetch lead
  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('*')
    .eq('id', id)
    .single()

  if (leadError || !lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }

  if (!lead.company) {
    return NextResponse.json({ error: 'Lead must have a company name' }, { status: 400 })
  }

  try {
    // 2. Search for company news and context
    const companyNews = await searchCompanyNews(lead.company, lead.company_website)

    // 3. Search for decision makers if contact info not already set
    let contactContext = ''
    if (!lead.contact_name && !lead.contact_email) {
      const titles = ['CEO', 'CTO', 'VP Payments', 'Head of Payments', 'Chief Product Officer', 'VP Product', 'Head of Partnerships']
      contactContext = await searchForDecisionMakers(lead.company, lead.company_website, titles)
      // TODO: if EXA contact search returns no results, fall back to Apollo API
    }

    // 4. Single Claude call to qualify the lead
    const prompt = `You are qualifying a B2B sales lead for WalletConnect Pay. Based on the information below, fill in as many fields as you can with reasonable confidence.

Company: ${lead.company}
Website: ${lead.company_website || 'Unknown'}

Recent news and context:
${companyNews}

${contactContext ? `Contact/team information found:
${contactContext}` : ''}

Current known contact info:
- Name: ${lead.contact_name || 'Unknown'}
- Role: ${lead.contact_role || 'Unknown'}
- Email: ${lead.contact_email || 'Unknown'}

Instructions:
- For lead_type: classify as "PSP" if payment infrastructure/processor/gateway, "Merchant" if commerce/retail/marketplace, "Other" otherwise
- For lead_priority: "High" = strong fit for WC Pay (payments-focused, high volume, crypto-friendly), "Medium" = possible fit, "Low" = weak/tangential fit
- For crypto_capabilities: "None" = no crypto, "Basic" = accepts some crypto, "Advanced" = deep crypto integration
- For company_size_employees: use ranges '1-10', '10-100', '100-500', '500-5000', '5000+'
- For company_size_revenue: use ranges '<$1M', '$1-10M', '$10-100M', '$100-500M', '$500M+'
- Only return fields where you have reasonable confidence; return null for uncertain ones
- Do NOT overwrite contact info that is already known (marked as non-Unknown above)

Return ONLY valid JSON with these exact keys (null for unknown):
{
  "lead_type": "PSP" | "Merchant" | "Other" | null,
  "industry": string | null,
  "company_size_employees": string | null,
  "company_size_revenue": string | null,
  "payments_stack": string | null,
  "crypto_capabilities": "None" | "Basic" | "Advanced" | null,
  "estimated_yearly_volumes": string | null,
  "strategic_priorities": string | null,
  "lead_priority": "High" | "Medium" | "Low" | null,
  "contact_name": string | null,
  "contact_role": string | null,
  "contact_email": string | null,
  "contact_phone": string | null,
  "contact_linkedin": string | null,
  "company_description": string | null,
  "walletconnect_value_prop": string | null
}

No markdown, no explanation, just the JSON object.`

    const message = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system: WC_PAY_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

    let qualified: Record<string, string | null>
    try {
      qualified = JSON.parse(responseText)
    } catch {
      const match = responseText.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('Could not parse Claude response')
      qualified = JSON.parse(match[0])
    }

    // 5. Only overwrite fields that are currently null/empty in the DB
    const updates: Record<string, string | null> = { lead_status: 'Qualified' }
    const overwritableFields = [
      'lead_type', 'industry', 'company_size_employees', 'company_size_revenue',
      'payments_stack', 'crypto_capabilities', 'estimated_yearly_volumes',
      'strategic_priorities', 'lead_priority', 'company_description', 'walletconnect_value_prop',
    ]
    for (const field of overwritableFields) {
      if (!lead[field] && qualified[field] != null) {
        updates[field] = qualified[field]
      }
    }
    // Contact fields: only set if not already present
    const contactFields = ['contact_name', 'contact_role', 'contact_email', 'contact_phone', 'contact_linkedin']
    for (const field of contactFields) {
      if (!lead[field] && qualified[field] != null) {
        updates[field] = qualified[field]
      }
    }

    const { data: updatedLead, error: updateError } = await supabase
      .from('leads')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (updateError) throw updateError

    return NextResponse.json(updatedLead)
  } catch (error) {
    console.error('Qualification error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Qualification failed' },
      { status: 500 }
    )
  }
}
