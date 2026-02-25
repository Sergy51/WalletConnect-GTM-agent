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

  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('*')
    .eq('id', id)
    .single()

  if (leadError || !lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }

  try {
    const gtmTrack = lead.lead_type === 'PSP' ? 'PSP' : 'Merchant'

    const trackContext = gtmTrack === 'PSP'
      ? 'This is a PSP/payment infrastructure company. Frame WC Pay as a distribution lever — one API integration adds crypto to all their merchants. Emphasise APM simplicity, built-in compliance, and the 500M+ wallet network they instantly access.'
      : 'This is a merchant/commerce company. Frame WC Pay as a revenue and cost play — crypto customers have higher AOV, fees are 0.5–1% vs 2.5–3.5% for cards, settlement is instant, and there are no chargebacks.'

    const ctaInstruction = gtmTrack === 'PSP'
      ? 'Ask for a short call — e.g. "Would 20 minutes make sense to explore how this fits within your stack?"'
      : 'Ask for a demo or short call — e.g. "Would a 15-minute call work to walk through a live checkout?"'

    const emailPrompt = `Write a cold outreach email on behalf of Sergio Sanchez, Partnerships Director at WalletConnect.

Recipient: ${lead.contact_name || 'the decision maker'}, ${lead.contact_role || 'Decision Maker'} at ${lead.company}
Company context: ${lead.company_description || lead.company}
${lead.walletconnect_value_prop ? `Why WalletConnect Pay fits them: ${lead.walletconnect_value_prop}` : ''}
Key value props for this lead: ${lead.key_vp || 'Lower Fees, Global Reach'}
GTM context: ${trackContext}

EMAIL STRUCTURE — follow exactly, total body under 150 words:
1. Subject: Short (5–8 words), specific to the recipient's company or role. No generic lines.
2. Opening (1 sentence): Reference something specific — a company milestone, recent news, their role, or a relevant industry trend. Never "I hope this finds you well."
3. Value bridge (2–3 sentences): Connect what you know about their business to a concrete problem WalletConnect Pay solves. Be specific — mention volumes, use cases, or pain points.
4. Credibility signal (1 sentence): One proof point — e.g. "We process over $400B in transacted volume globally across PSP and merchant partners."
5. CTA (1 sentence): ${ctaInstruction}
6. Sign-off: "Best,\\nSergio Sanchez\\nPartnerships Director, WalletConnect"

TONE: Professional but not corporate. Write like a knowledgeable peer, not a salesperson. No buzzwords, no "exciting opportunity."

--- EXAMPLE (PSP track) ---
Subject: Crypto payments for Adyen's enterprise merchants — no build required

Hi Pieter,

Adyen's single-platform approach to global payments is unmatched — processing nearly $900B in volume while competitors are still stitching together acquisitions. But crypto acceptance is one area where Stripe has been moving faster, particularly with stablecoin payouts.

WalletConnect can close that gap without Adyen building anything in-house. We provide a single API integration that lets your merchants accept BTC, ETH, and stablecoins with instant fiat settlement — no crypto exposure, no compliance overhead for Adyen. We currently process over $400B in transacted volume across PSP and merchant partners globally.

Would 20 minutes make sense to explore how this would work within your unified commerce stack?

Best,
Sergio Sanchez
Partnerships Director, WalletConnect

--- EXAMPLE (Merchant track) ---
Subject: Scaling Gucci's crypto payments beyond the U.S. pilot

Hi Francesca,

Gucci's move to accept crypto at select U.S. boutiques has set the standard for luxury retail — no other major house has committed as boldly to making digital assets a real checkout option. As you work on engaging a younger, digitally native customer base, expanding that pilot globally feels like a natural next step.

WalletConnect can help you scale crypto acceptance from a handful of U.S. stores to every market Gucci operates in — with a single integration that supports BTC, ETH, stablecoins, and 100+ tokens, instant fiat settlement, and full regulatory compliance across jurisdictions. We process over $400B in volume and already work with major luxury and retail brands navigating this exact expansion.

Would a 15-minute call work for your team to explore the global rollout?

Best,
Sergio Sanchez
Partnerships Director, WalletConnect
--- END EXAMPLES ---

Also write two follow-up messages:
- follow_up_1 (sent 14 days later): casual bump, 1–2 sentences, reference the original without re-pitching, end with a soft question
- follow_up_2 (sent 21 days later): brief final note, acknowledge it's the last touch, 1–2 sentences

Return ONLY valid JSON:
{ "subject": "...", "body": "...", "follow_up_1": "...", "follow_up_2": "..." }

No markdown, no explanation, just the JSON object.`

    const linkedinPrompt = `Write a short LinkedIn DM on behalf of Sergio Sanchez, Partnerships Director at WalletConnect.

Recipient: ${lead.contact_name || 'the decision maker'}, ${lead.contact_role || 'Decision Maker'} at ${lead.company}
Company context: ${lead.company_description || lead.company}
${lead.walletconnect_value_prop ? `Why WalletConnect Pay fits them: ${lead.walletconnect_value_prop}` : ''}
Key value props: ${lead.key_vp || 'Lower Fees, Global Reach'}

Rules:
- 2 sentences max, ultra-concise
- Start with something specific to them, not a generic opener
- ${ctaInstruction}
- No subject line

Also write two follow-up messages (1 sentence each):
- follow_up_1 (sent 14 days later): casual bump
- follow_up_2 (sent 21 days later): brief final note

Return ONLY valid JSON:
{ "body": "...", "follow_up_1": "...", "follow_up_2": "..." }

No markdown, no explanation, just the JSON object.`

    const message = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1600,
      system: WC_PAY_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: platform === 'email' ? emailPrompt : linkedinPrompt,
        },
      ],
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

    let parsed: { subject?: string; body: string; follow_up_1?: string; follow_up_2?: string }
    try {
      parsed = JSON.parse(responseText)
    } catch {
      const match = responseText.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('Could not parse Claude response')
      parsed = JSON.parse(match[0])
    }

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

    // Populate follow-ups in a separate update — non-critical, silently ignored
    // if the follow_up_* columns don't exist yet in your messages table.
    // Run this migration if you want pre-populated follow-ups:
    //   ALTER TABLE messages
    //     ADD COLUMN IF NOT EXISTS follow_up_1_body text,
    //     ADD COLUMN IF NOT EXISTS follow_up_2_body text;
    if (parsed.follow_up_1 || parsed.follow_up_2) {
      const { data: withFollowUps } = await supabase
        .from('messages')
        .update({
          follow_up_1_body: parsed.follow_up_1 || null,
          follow_up_2_body: parsed.follow_up_2 || null,
        })
        .eq('id', savedMessage.id)
        .select()
        .single()
      if (withFollowUps) return NextResponse.json(withFollowUps)
    }

    return NextResponse.json(savedMessage)
  } catch (error) {
    console.error('Message generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Message generation failed' },
      { status: 500 }
    )
  }
}
