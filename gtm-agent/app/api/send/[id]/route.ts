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

  const { data: message, error: msgError } = await supabase
    .from('messages')
    .select('*')
    .eq('id', message_id)
    .single()

  if (msgError || !message) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 })
  }

  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('*')
    .eq('id', id)
    .single()

  if (leadError || !lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }

  if (!lead.contact_email) {
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

    await supabase
      .from('messages')
      .update({ sent_at: now.toISOString() })
      .eq('id', message_id)

    await supabase.from('leads').update({ lead_status: 'Contacted' }).eq('id', id)

    await supabase.from('outreach_log').insert({
      lead_id: id,
      message_id,
      action: 'sent',
      notes: `Email sent via Resend. ID: ${emailData?.id || 'unknown'}`,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Send error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send email' },
      { status: 500 }
    )
  }
}
