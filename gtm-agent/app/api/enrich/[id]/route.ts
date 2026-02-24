import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { anthropic, CLAUDE_MODEL, WC_PAY_SYSTEM_PROMPT } from '@/lib/claude'
import { searchCompanyNews } from '@/lib/exa'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Fetch lead
  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('*')
    .eq('id', id)
    .single()

  if (leadError || !lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }

  try {
    // Step 1: Fetch recent news via Exa.ai
    const recentNews = await searchCompanyNews(lead.company, lead.company_website)

    // Step 2: Call Claude to generate company summary + value prop
    const message = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system: WC_PAY_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Analyze this company and generate two things:

Company: ${lead.company}
Website: ${lead.company_website || 'Unknown'}
Contact title: ${lead.title || 'Unknown'}
Company size: ${lead.company_size || 'Unknown'}
Recent news: ${recentNews}

Return a JSON object with exactly these two keys:
1. "company_description": A 2–3 sentence factual summary of what this company does and who their customers are.
2. "walletconnect_value_prop": A 2–3 sentence explanation of specifically how WalletConnect Pay would benefit this company — be concrete, reference their business model, mention the fee savings (0.5–1% vs 2.5–3.5% cards), speed, or reach (500M+ wallets) as relevant.

Output only valid JSON, no markdown.`,
        },
      ],
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

    let parsed: { company_description: string; walletconnect_value_prop: string }
    try {
      parsed = JSON.parse(responseText)
    } catch {
      // Try to extract JSON from the response
      const match = responseText.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('Could not parse Claude response')
      parsed = JSON.parse(match[0])
    }

    // Step 3: Update lead in Supabase
    const { data: updated, error: updateError } = await supabase
      .from('leads')
      .update({
        company_description: parsed.company_description,
        walletconnect_value_prop: parsed.walletconnect_value_prop,
        recent_news: recentNews,
        status: 'qualified',
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) throw updateError

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Enrich error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Enrichment failed' },
      { status: 500 }
    )
  }
}
