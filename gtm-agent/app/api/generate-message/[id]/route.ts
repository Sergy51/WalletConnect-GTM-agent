import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { anthropic, CLAUDE_MODEL, WC_PAY_SYSTEM_PROMPT } from '@/lib/claude'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const platform: 'email' | 'linkedin' = body.platform || 'email'

  // Fetch lead
  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('*')
    .eq('id', id)
    .single()

  if (leadError || !lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }

  if (!lead.walletconnect_value_prop) {
    return NextResponse.json(
      { error: 'Lead must be enriched before generating a message. Run enrichment first.' },
      { status: 400 }
    )
  }

  try {
    const lengthInstruction =
      platform === 'email'
        ? '3 sentences for the email body (tight, no fluff)'
        : '2 sentences for the LinkedIn DM (ultra-concise)'

    const message = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 512,
      system: WC_PAY_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Write a cold outreach ${platform} message to ${lead.name}, ${lead.title || 'Decision Maker'} at ${lead.company}.

Company context: ${lead.company_description || lead.company}
Why WalletConnect Pay helps them: ${lead.walletconnect_value_prop}
Recent news/context: ${lead.recent_news || 'None available'}

Rules:
- Tone: casual, peer-to-peer, no buzzwords, no "I hope this finds you well", no "exciting opportunity"
- Length: ${lengthInstruction}
- Start with something specific to them — not a generic opener
- End with a single, low-friction CTA (e.g., "Worth a quick chat?")
${platform === 'email' ? '- Include a compelling, specific subject line' : '- No subject line needed'}

Return ONLY valid JSON with keys:
${platform === 'email' ? '"subject" and "body"' : '"body"'}

No markdown, no explanation, just the JSON object.`,
        },
      ],
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

    let parsed: { subject?: string; body: string }
    try {
      parsed = JSON.parse(responseText)
    } catch {
      const match = responseText.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('Could not parse Claude response')
      parsed = JSON.parse(match[0])
    }

    // Save message to DB
    const { data: savedMessage, error: msgError } = await supabase
      .from('messages')
      .insert({
        lead_id: id,
        platform,
        subject: parsed.subject || null,
        body: parsed.body,
        version: 1,
      })
      .select()
      .single()

    if (msgError) throw msgError

    // Update lead status
    await supabase
      .from('leads')
      .update({ status: 'message_drafted' })
      .eq('id', id)

    return NextResponse.json(savedMessage)
  } catch (error) {
    console.error('Message generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Message generation failed' },
      { status: 500 }
    )
  }
}
