import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { resend, FROM_EMAIL } from '@/lib/resend'
import { anthropic, CLAUDE_MODEL } from '@/lib/claude'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()
  const { message_id } = body

  if (!message_id) {
    return NextResponse.json({ error: 'message_id is required' }, { status: 400 })
  }

  const { data: message, error: msgError } = await supabase
    .from('messages')
    .select('*, leads(*)')
    .eq('id', message_id)
    .single()

  if (msgError || !message) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 })
  }

  const lead = message.leads
  if (!lead?.contact_email) {
    return NextResponse.json({ error: 'Lead has no email address' }, { status: 400 })
  }

  try {
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: FROM_EMAIL,
      to: lead.contact_email,
      subject: message.subject || `WalletConnect Pay — ${lead.company}`,
      text: message.body,
    })

    if (emailError) throw new Error(emailError.message)

    const now = new Date()
    const followUp1 = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
    const followUp2 = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000)

    // Generate follow-up message drafts with Claude
    let followUp1Body = ''
    let followUp2Body = ''
    try {
      const followUpMsg = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 400,
        messages: [
          {
            role: 'user',
            content: `You sent this cold email to ${lead.contact_name || 'the decision maker'} (${lead.contact_role || 'Decision Maker'}) at ${lead.company}:

Subject: ${message.subject || ''}
Body: ${message.body}

Write two short follow-up messages:
1. Follow-up 1 (sent 14 days later): A brief, casual bump. 1-2 sentences. Reference the original email without re-pitching. End with a soft question.
2. Follow-up 2 (sent 21 days later): A final short follow-up. Acknowledge it's the last time you'll reach out on this. 1-2 sentences.

Return ONLY valid JSON: { "follow_up_1": "...", "follow_up_2": "..." }`,
          },
        ],
      })

      const followUpText = followUpMsg.content[0].type === 'text' ? followUpMsg.content[0].text : ''
      const followUpParsed = JSON.parse(followUpText.match(/\{[\s\S]*\}/)?.[0] || '{}')
      followUp1Body = followUpParsed.follow_up_1 || ''
      followUp2Body = followUpParsed.follow_up_2 || ''
    } catch {
      // Follow-up generation is non-critical — don't fail the send
    }

    await supabase
      .from('messages')
      .update({
        sent_at: now.toISOString(),
        follow_up_1_due: followUp1.toISOString(),
        follow_up_2_due: followUp2.toISOString(),
        follow_up_1_body: followUp1Body,
        follow_up_2_body: followUp2Body,
      })
      .eq('id', message_id)

    await supabase.from('leads').update({ lead_status: 'Contacted' }).eq('id', id)

    await supabase.from('outreach_log').insert({
      lead_id: id,
      message_id,
      action: 'sent',
      notes: `Email sent via Resend. ID: ${emailData?.id || 'unknown'}`,
    })

    return NextResponse.json({
      success: true,
      follow_up_1_due: followUp1.toISOString(),
      follow_up_2_due: followUp2.toISOString(),
    })
  } catch (error) {
    console.error('Send error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send email' },
      { status: 500 }
    )
  }
}
