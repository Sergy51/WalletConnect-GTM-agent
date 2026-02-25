'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import type { Lead, Message } from '@/types'

interface MessagePanelProps {
  leads: Lead[]
  index: number
  onNext: () => void
  onClose: () => void
}

export function MessagePanel({ leads, index, onNext, onClose }: MessagePanelProps) {
  const lead = leads[index]
  const [message, setMessage] = useState<Message | null>(null)
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState(false)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [followUp1Body, setFollowUp1Body] = useState('')
  const [followUp2Body, setFollowUp2Body] = useState('')
  const [followUp1Date, setFollowUp1Date] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 14)
    return d.toISOString().slice(0, 10)
  })
  const [followUp2Date, setFollowUp2Date] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 21)
    return d.toISOString().slice(0, 10)
  })

  // Auto-generate message on mount / when lead changes
  useEffect(() => {
    if (!lead) return
    setMessage(null)
    setSubject('')
    setBody('')
    setFollowUp1Body('')
    setFollowUp2Body('')
    generateMessage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead?.id])

  async function generateMessage() {
    if (!lead) return
    setGenerating(true)
    try {
      const res = await fetch(`/api/generate-message/${lead.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: 'email' }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || 'Failed to generate message')
        return
      }
      const msg: Message = await res.json()
      setMessage(msg)
      setSubject(msg.subject || '')
      setBody(msg.body || '')
    } catch {
      toast.error('Failed to generate message')
    } finally {
      setGenerating(false)
    }
  }

  async function sendEmail() {
    if (!message) return
    setSending(true)
    try {
      // Update the message with any edits first
      await fetch(`/api/update-message/${message.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          body,
          follow_up_1_due: followUp1Date,
          follow_up_2_due: followUp2Date,
          follow_up_1_body: followUp1Body,
          follow_up_2_body: followUp2Body,
        }),
      })

      const res = await fetch(`/api/send/${lead.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_id: message.id }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || 'Failed to send email')
        return
      }
      toast.success(`Email sent to ${lead.contact_email}`)
      if (index < leads.length - 1) {
        onNext()
      } else {
        onClose()
      }
    } finally {
      setSending(false)
    }
  }

  if (!lead) return null

  const priorityColors: Record<string, string> = {
    High: 'bg-red-100 text-red-700',
    Medium: 'bg-yellow-100 text-yellow-700',
    Low: 'bg-gray-100 text-gray-600',
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="w-[65%] bg-background border-l shadow-2xl flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-semibold">{lead.company}</span>
            {leads.length > 1 && (
              <span className="text-sm text-muted-foreground">
                Lead {index + 1} of {leads.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {leads.length > 1 && index < leads.length - 1 && (
              <Button variant="outline" size="sm" onClick={onNext}>Skip</Button>
            )}
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none ml-2">&times;</button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Company info */}
          <div className="w-[35%] border-r p-5 overflow-y-auto shrink-0 space-y-4">
            <div>
              <div className="text-xs uppercase text-muted-foreground font-medium mb-2">Company</div>
              <div className="font-medium">{lead.company}</div>
              {lead.company_website && (
                <a
                  href={lead.company_website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline truncate block"
                >
                  {lead.company_website}
                </a>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              {lead.lead_type && (
                <div>
                  <div className="text-xs text-muted-foreground">Type</div>
                  <div>{lead.lead_type}</div>
                </div>
              )}
              {lead.industry && (
                <div>
                  <div className="text-xs text-muted-foreground">Industry</div>
                  <div>{lead.industry}</div>
                </div>
              )}
              {lead.company_size_employees && (
                <div>
                  <div className="text-xs text-muted-foreground">Employees</div>
                  <div>{lead.company_size_employees}</div>
                </div>
              )}
              {lead.company_size_revenue && (
                <div>
                  <div className="text-xs text-muted-foreground">Revenue</div>
                  <div>{lead.company_size_revenue}</div>
                </div>
              )}
            </div>

            {lead.lead_priority && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">Priority</div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${priorityColors[lead.lead_priority] || ''}`}>
                  {lead.lead_priority}
                </span>
              </div>
            )}

            {lead.strategic_priorities && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">Strategic Priorities</div>
                <p className="text-sm leading-relaxed">{lead.strategic_priorities}</p>
              </div>
            )}

            {lead.company_description && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">About</div>
                <p className="text-sm leading-relaxed text-muted-foreground">{lead.company_description}</p>
              </div>
            )}

            {lead.walletconnect_value_prop && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">WC Pay Value Prop</div>
                <p className="text-sm leading-relaxed text-muted-foreground">{lead.walletconnect_value_prop}</p>
              </div>
            )}
          </div>

          {/* Right: Message editor */}
          <div className="flex-1 p-5 overflow-y-auto space-y-4">
            {!lead.contact_email && (
              <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                No email address set for this lead. Add one before sending.
              </div>
            )}

            {generating ? (
              <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
                <div className="h-4 w-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                <span>Generating draft...</span>
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase">Subject</label>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Email subject"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase">Body</label>
                  <Textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={6}
                    placeholder="Email body"
                  />
                </div>

                <div className="border-t pt-4 space-y-3">
                  <div className="text-xs font-medium text-muted-foreground uppercase">Follow-up 1 (+14 days)</div>
                  <Input
                    type="date"
                    value={followUp1Date}
                    onChange={(e) => setFollowUp1Date(e.target.value)}
                    className="w-40"
                  />
                  <Textarea
                    value={followUp1Body}
                    onChange={(e) => setFollowUp1Body(e.target.value)}
                    rows={3}
                    placeholder="Follow-up 1 message (auto-generated after send)"
                  />
                </div>

                <div className="border-t pt-4 space-y-3">
                  <div className="text-xs font-medium text-muted-foreground uppercase">Follow-up 2 (+21 days)</div>
                  <Input
                    type="date"
                    value={followUp2Date}
                    onChange={(e) => setFollowUp2Date(e.target.value)}
                    className="w-40"
                  />
                  <Textarea
                    value={followUp2Body}
                    onChange={(e) => setFollowUp2Body(e.target.value)}
                    rows={3}
                    placeholder="Follow-up 2 message (auto-generated after send)"
                  />
                </div>

                <div className="pt-2">
                  <Button
                    onClick={sendEmail}
                    disabled={sending || !message || !lead.contact_email}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {sending ? 'Sending...' : `Send Email${lead.contact_email ? ` to ${lead.contact_email}` : ''}`}
                  </Button>
                  {!message && !generating && (
                    <button
                      onClick={generateMessage}
                      className="w-full mt-2 text-sm text-muted-foreground hover:text-foreground underline"
                    >
                      Regenerate draft
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
