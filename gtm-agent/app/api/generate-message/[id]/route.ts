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
      { error: 'Lead must be qualified before generating a message. Run qualification first.' },
      { status: 400 }
    )
  }

  try {
    // Derive GTM track from lead_type directly
    const gtmTrack = lead.lead_type === 'PSP' ? 'PSP' : 'Merchant'

    const trackContext = gtmTrack === 'PSP'
      ? 'This is a PSP/payment infrastructure company. Frame WC Pay as a distribution lever — one API integration adds crypto to all their merchants. Emphasise APM simplicity, built-in compliance, and the 500M+ wallet network they instantly access.'
      : 'This is a merchant/commerce company. Frame WC Pay as a revenue and cost play — crypto customers have 15-25% higher AOV, fees are 0.5-1% vs 2.5-3.5% for cards, settlement is instant (vs 1-3 days for cards and 30+ days for other APMs), and there are no chargebacks.'

    const ctaInstruction = gtmTrack === 'PSP'
      ? 'End with a low-friction CTA like "worth a 20-min call to walk through the integration?"'
      : 'End with a trial/demo-oriented CTA like "happy to show you a live checkout in 15 min"'

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
          content: `Write a cold outreach ${platform} message to ${lead.contact_name || 'the decision maker'}, ${lead.contact_role || 'Decision Maker'} at ${lead.company}.

Company context: ${lead.company_description || lead.company}
Why WalletConnect Pay helps them: ${lead.walletconnect_value_prop}

GTM track context: ${trackContext}

Rules:
- Tone: casual, peer-to-peer, no buzzwords, no "I hope this finds you well", no "exciting opportunity"
- Length: ${lengthInstruction}
- Start with something specific to them — not a generic opener
- ${ctaInstruction}
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

    return NextResponse.json(savedMessage)
  } catch (error) {
    console.error('Message generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Message generation failed' },
      { status: 500 }
    )
  }
}
