import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { anthropic, CLAUDE_MODEL, WC_PAY_SYSTEM_PROMPT } from '@/lib/claude'

const ICP_SEGMENTS = [
  'PSP / Payment Processor',
  'E-commerce Platform',
  'Fintech / Neobank',
  'POS Provider',
  'Marketplace',
  'Travel & Hospitality',
  'Gaming / Digital Goods',
  'Emerging Market Fintech',
  'Other',
]

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('*')
    .eq('id', id)
    .single()

  if (leadError || !lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }

  if (!lead.company_description || !lead.walletconnect_value_prop) {
    return NextResponse.json(
      { error: 'Run enrichment before categorizing.' },
      { status: 400 }
    )
  }

  try {
    const message = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 512,
      system: WC_PAY_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Categorize this company as a potential WalletConnect Pay partner.

Company: ${lead.company}
Contact: ${lead.name}, ${lead.title || 'Unknown title'}
Description: ${lead.company_description}
WalletConnect Pay value prop: ${lead.walletconnect_value_prop}

Return ONLY valid JSON with these keys:
{
  "icp_segment": one of ${JSON.stringify(ICP_SEGMENTS)},
  "fit_score": "High", "Medium", or "Low",
  "fit_reason": "1-2 sentences explaining the score — what makes this a strong or weak fit for WalletConnect Pay, and what the key opportunity or barrier is."
}

Scoring guide:
- High: Clear use case, operates in payments/commerce, decision maker has budget authority, likely already evaluating crypto APMs
- Medium: Relevant industry but indirect fit, or relevant fit but unclear decision-making authority
- Low: Tangential industry, small budget, or no obvious payment integration need`,
        },
      ],
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

    let parsed: { icp_segment: string; fit_score: 'High' | 'Medium' | 'Low'; fit_reason: string }
    try {
      parsed = JSON.parse(responseText)
    } catch {
      const match = responseText.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('Could not parse Claude response')
      parsed = JSON.parse(match[0])
    }

    const { data: updated, error: updateError } = await supabase
      .from('leads')
      .update({
        icp_segment: parsed.icp_segment,
        fit_score: parsed.fit_score,
        fit_reason: parsed.fit_reason,
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) throw updateError
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Categorize error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Categorization failed' },
      { status: 500 }
    )
  }
}
