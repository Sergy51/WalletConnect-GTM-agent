import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { resend, FROM_EMAIL } from '@/lib/resend'

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

  // Fetch message + lead
  const { data: message, error: msgError } = await supabase
    .from('messages')
    .select('*, leads(*)')
    .eq('id', message_id)
    .single()

  if (msgError || !message) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 })
  }

  const lead = message.leads
  if (!lead?.email) {
    return NextResponse.json({ error: 'Lead has no email address' }, { status: 400 })
  }

  try {
    // Send email via Resend
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: FROM_EMAIL,
      to: lead.email,
      subject: message.subject || `WalletConnect Pay — ${lead.company}`,
      text: message.body,
    })

    if (emailError) throw new Error(emailError.message)

    const now = new Date()
    const followUp1 = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
    const followUp2 = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000)

    // Update message with sent timestamp and follow-up dates
    await supabase
      .from('messages')
      .update({
        sent_at: now.toISOString(),
        follow_up_1_due: followUp1.toISOString(),
        follow_up_2_due: followUp2.toISOString(),
      })
      .eq('id', message_id)

    // Update lead status
    await supabase.from('leads').update({ status: 'sent' }).eq('id', id)

    // Log the action
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
