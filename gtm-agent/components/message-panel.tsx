'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { WC_VALUE_PROPS } from '@/lib/constants'
import type { Lead, Message } from '@/types'

interface MessagePanelProps {
  leads: Lead[]
  index: number
  onNext: () => void
  onClose: () => void
}

const VP_COLORS: Record<string, string> = {
  'Lower Fees': 'bg-green-100 text-green-700',
  'Instant Settlement': 'bg-blue-100 text-blue-700',
  'Global Reach': 'bg-purple-100 text-purple-700',
  'Compliance': 'bg-red-100 text-red-700',
  'New Volumes': 'bg-teal-100 text-teal-700',
  'Single API': 'bg-orange-100 text-orange-700',
}

const PRIORITY_COLORS: Record<string, string> = {
  High: 'bg-orange-100 text-orange-700',
  Medium: 'bg-yellow-100 text-yellow-700',
}

function Spinner() {
  return <div className="inline-block h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin opacity-60" />
}

export function MessagePanel({ leads, index, onNext, onClose }: MessagePanelProps) {
  const lead = leads[index]
  const [localLead, setLocalLead] = useState<Lead>(lead)
  const [enriching, setEnriching] = useState(false)
  const [message, setMessage] = useState<Message | null>(null)
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState(false)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [followUp1Body, setFollowUp1Body] = useState('')
  const [followUp2Body, setFollowUp2Body] = useState('')
  const [followUp1Date] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 14); return d.toISOString().slice(0, 10)
  })
  const [followUp2Date] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 21); return d.toISOString().slice(0, 10)
  })
  const [secondaryName, setSecondaryName] = useState('')
  const [secondaryEmail, setSecondaryEmail] = useState('')
  const [secondaryLinkedIn, setSecondaryLinkedIn] = useState('')

  useEffect(() => {
    if (!lead) return
    setLocalLead(lead)
    setMessage(null)
    setSubject('')
    setBody('')
    setFollowUp1Body('')
    setFollowUp2Body('')
    setSecondaryName(lead.secondary_contact_name || '')
    setSecondaryEmail(lead.secondary_contact_email || '')
    setSecondaryLinkedIn(lead.secondary_contact_linkedin || '')
    if (lead.lead_status !== 'New') {
      generateMessage(lead)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead?.id])

  async function generateMessage(targetLead: Lead = localLead) {
    setGenerating(true)
    try {
      const res = await fetch(`/api/generate-message/${targetLead.id}`, {
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
      setFollowUp1Body(msg.follow_up_1_body || '')
      setFollowUp2Body(msg.follow_up_2_body || '')
    } catch {
      toast.error('Failed to generate message')
    } finally {
      setGenerating(false)
    }
  }

  async function enrichLead() {
    setEnriching(true)
    try {
      const res = await fetch(`/api/qualify/${localLead.id}`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || 'Enrichment failed')
        return
      }
      const enriched: Lead = await res.json()
      setLocalLead(enriched)
      toast.success('Lead enriched')
      generateMessage(enriched)
    } catch {
      toast.error('Enrichment failed')
    } finally {
      setEnriching(false)
    }
  }

  async function saveSecondaryContact(field: string, value: string) {
    try {
      await fetch(`/api/update-lead/${localLead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value || null }),
      })
    } catch {
      // silent — columns may not exist yet in DB
    }
  }

  async function sendEmail() {
    if (!message) return
    setSending(true)
    try {
      await fetch(`/api/update-message/${message.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject, body,
          follow_up_1_due: followUp1Date,
          follow_up_2_due: followUp2Date,
          follow_up_1_body: followUp1Body,
          follow_up_2_body: followUp2Body,
        }),
      })

      const res = await fetch(`/api/send/${localLead.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_id: message.id }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || 'Failed to send email')
        return
      }
      toast.success(`Email sent to ${localLead.contact_email}`)
      if (index < leads.length - 1) onNext()
      else onClose()
    } finally {
      setSending(false)
    }
  }

  if (!lead) return null

  const isUnenriched = localLead.lead_status === 'New'
  const keyVps = localLead.key_vp?.split(',').map(v => v.trim()).filter(Boolean) || []
  const relevantVpDetails = WC_VALUE_PROPS.filter(v => keyVps.includes(v.key))
  const newsSources: { title: string; url: string }[] = (() => {
    try { return localLead.news_sources ? JSON.parse(localLead.news_sources) : [] }
    catch { return [] }
  })()

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="w-[65%] bg-background border-l shadow-2xl flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-semibold">{localLead.company}</span>
            {leads.length > 1 && (
              <span className="text-sm text-muted-foreground">Lead {index + 1} of {leads.length}</span>
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
              <div className="text-xs uppercase text-muted-foreground font-medium mb-1">Company</div>
              <div className="font-medium">{localLead.company}</div>
              {localLead.company_website && (
                <a href={localLead.company_website} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline truncate block">
                  {localLead.company_website}
                </a>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              {localLead.lead_type && <div><div className="text-xs text-muted-foreground">Type</div><div>{localLead.lead_type}</div></div>}
              {localLead.industry && <div><div className="text-xs text-muted-foreground">Industry</div><div>{localLead.industry}</div></div>}
              {localLead.company_size_employees && <div><div className="text-xs text-muted-foreground">Employees</div><div>{localLead.company_size_employees}</div></div>}
              {localLead.company_size_revenue && <div><div className="text-xs text-muted-foreground">Revenue</div><div>{localLead.company_size_revenue}</div></div>}
            </div>

            {localLead.lead_priority && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">Priority</div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PRIORITY_COLORS[localLead.lead_priority] || ''}`}>
                  {localLead.lead_priority}
                </span>
              </div>
            )}

            {localLead.strategic_priorities && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">Strategic Priorities</div>
                <p className="text-sm leading-relaxed">{localLead.strategic_priorities}</p>
                {newsSources.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {newsSources.map((s, i) => (
                      <a
                        key={i}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={s.title}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-[11px] font-medium text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors"
                      >
                        Source {i + 1}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            {localLead.company_description && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">About</div>
                <p className="text-sm leading-relaxed text-muted-foreground">{localLead.company_description}</p>
              </div>
            )}

            {/* WC Pay Value Prop */}
            {!isUnenriched && (
              <div>
                <div className="text-xs uppercase text-muted-foreground font-medium mb-2">WC Pay Value Prop</div>
                {keyVps.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {keyVps.map(vp => (
                      <span key={vp} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${VP_COLORS[vp] || 'bg-gray-100 text-gray-600'}`}>
                        {vp}
                      </span>
                    ))}
                  </div>
                )}
                {relevantVpDetails.length > 0 && (
                  <div className="space-y-2 mb-2">
                    {relevantVpDetails.map(vp => (
                      <div key={vp.key} className="text-sm">
                        <span className="font-medium">{vp.key}:</span>{' '}
                        <span className="text-muted-foreground">{vp.description}</span>
                      </div>
                    ))}
                  </div>
                )}
                {localLead.walletconnect_value_prop && (
                  <p className="text-sm leading-relaxed text-muted-foreground">{localLead.walletconnect_value_prop}</p>
                )}
              </div>
            )}

            {/* Secondary Contact */}
            <div className="border-t pt-4">
              <div className="text-xs uppercase text-muted-foreground font-medium mb-3">Secondary Contact</div>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-muted-foreground block mb-0.5">Name</label>
                  <Input
                    value={secondaryName}
                    onChange={e => setSecondaryName(e.target.value)}
                    onBlur={() => saveSecondaryContact('secondary_contact_name', secondaryName)}
                    placeholder="Full name"
                    className="h-7 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-0.5">Email</label>
                  <Input
                    value={secondaryEmail}
                    onChange={e => setSecondaryEmail(e.target.value)}
                    onBlur={() => saveSecondaryContact('secondary_contact_email', secondaryEmail)}
                    placeholder="email@company.com"
                    className="h-7 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-0.5">LinkedIn</label>
                  <Input
                    value={secondaryLinkedIn}
                    onChange={e => setSecondaryLinkedIn(e.target.value)}
                    onBlur={() => saveSecondaryContact('secondary_contact_linkedin', secondaryLinkedIn)}
                    placeholder="linkedin.com/in/..."
                    className="h-7 text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right: Message editor or enrich prompt */}
          <div className="flex-1 p-5 overflow-y-auto">
            {isUnenriched ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                <p className="text-sm text-muted-foreground max-w-xs">
                  This lead hasn&apos;t been enriched yet. Enrich it first to find the right contact and generate a personalised email.
                </p>
                <Button onClick={enrichLead} disabled={enriching} className="mt-1">
                  {enriching ? (
                    <span className="flex items-center gap-2"><Spinner /> Enriching...</span>
                  ) : 'Enrich'}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Recipient info */}
                <div className="flex items-center gap-3 px-3 py-2.5 bg-muted/40 rounded-lg text-sm">
                  <span className="text-muted-foreground shrink-0">To:</span>
                  <div className="flex items-center gap-2 min-w-0">
                    {localLead.contact_name && (
                      <span className="font-medium truncate">{localLead.contact_name}</span>
                    )}
                    {localLead.contact_email ? (
                      <span className="text-muted-foreground truncate">&lt;{localLead.contact_email}&gt;</span>
                    ) : (
                      <span className="text-amber-600 text-xs">No email — add one before sending</span>
                    )}
                  </div>
                </div>

                {generating ? (
                  <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
                    <div className="h-4 w-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                    <span>Generating draft...</span>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground uppercase">Subject</label>
                      <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Email subject" />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground uppercase">Body</label>
                      <Textarea value={body} onChange={e => setBody(e.target.value)} rows={6} placeholder="Email body" />
                    </div>

                    <div className="border-t pt-4 space-y-2">
                      <div className="text-xs font-medium text-muted-foreground uppercase">Follow-up 1 (+14 days)</div>
                      <Input type="date" value={followUp1Date} readOnly className="w-40" />
                      <Textarea value={followUp1Body} onChange={e => setFollowUp1Body(e.target.value)} rows={3}
                        placeholder="Follow-up 1 message" />
                    </div>

                    <div className="border-t pt-4 space-y-2">
                      <div className="text-xs font-medium text-muted-foreground uppercase">Follow-up 2 (+21 days)</div>
                      <Input type="date" value={followUp2Date} readOnly className="w-40" />
                      <Textarea value={followUp2Body} onChange={e => setFollowUp2Body(e.target.value)} rows={3}
                        placeholder="Follow-up 2 message" />
                    </div>

                    <div className="pt-2">
                      <Button onClick={sendEmail} disabled={sending || !message || !localLead.contact_email}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                        {sending ? 'Sending...' : 'Send Email'}
                      </Button>
                      {!message && !generating && (
                        <button onClick={() => generateMessage()}
                          className="w-full mt-2 text-sm text-muted-foreground hover:text-foreground underline">
                          Regenerate draft
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
