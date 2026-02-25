import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { anthropic, CLAUDE_MODEL, WC_PAY_SYSTEM_PROMPT } from '@/lib/claude'
import { searchCompanyNews } from '@/lib/exa'

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

  try {
    const recentNews = await searchCompanyNews(lead.company, lead.company_website)

    const message = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system: WC_PAY_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `You are analyzing the company "${lead.company}" (website: ${lead.company_website || 'unknown'}).

IMPORTANT: Describe ONLY this exact company — "${lead.company}". Do NOT describe any other company with a similar name. If the search results below refer to a different company, ignore them entirely.

If you cannot find reliable public information specifically about "${lead.company}":
- Set company_description to a brief note that public information is limited for this company.
- Set walletconnect_value_prop based only on what can be reasonably inferred from their name/website.
- Set confidence to "low".

Otherwise set confidence to "high".

Contact title: ${lead.title || 'Unknown'}
Company size: ${lead.company_size || 'Unknown'}
Web search results (may or may not be about this company):
${recentNews}

Return ONLY valid JSON with exactly these keys:
{
  "company_description": "2-3 sentence factual summary of what this company does and who their customers are.",
  "walletconnect_value_prop": "2-3 sentences on how WalletConnect Pay specifically helps them — reference fee savings (0.5-1% vs 2.5-3.5%), speed, or the 500M+ wallet reach as relevant.",
  "confidence": "high" or "low"
}`,
        },
      ],
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

    let parsed: { company_description: string; walletconnect_value_prop: string; confidence: 'high' | 'low' }
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
        company_description: parsed.company_description,
        walletconnect_value_prop: parsed.walletconnect_value_prop,
        recent_news: recentNews,
        enrichment_confidence: parsed.confidence || 'high',
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
