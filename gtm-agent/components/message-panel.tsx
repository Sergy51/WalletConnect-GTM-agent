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
  // PSP
  'Integration Simplicity': 'bg-orange-100 text-orange-700',
  'Compliance': 'bg-red-100 text-red-700',
  'Widest Coverage': 'bg-purple-100 text-purple-700',
  'Modular': 'bg-indigo-100 text-indigo-700',
  'Fee Predictability': 'bg-cyan-100 text-cyan-700',
  // Merchant
  'Faster Settlement': 'bg-blue-100 text-blue-700',
  'Lower Fees': 'bg-green-100 text-green-700',
  'New Volumes': 'bg-teal-100 text-teal-700',
  'Best-in-Class UX': 'bg-pink-100 text-pink-700',
}

const PRIORITY_COLORS: Record<string, string> = {
  High: 'bg-orange-100 text-orange-700',
  Medium: 'bg-yellow-100 text-yellow-700',
}

function Spinner() {
  return <div className="inline-block h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin opacity-60" />
}

interface StrategicPrioritiesDisplayProps {
  priorities: string
  newsSources: { title: string; url: string }[]
}

function StrategicPrioritiesDisplay({ priorities, newsSources }: StrategicPrioritiesDisplayProps) {
  type ContentItem = string | { text: string; url: string | null }
  let parsed: { news_and_press?: string[]; company_content?: ContentItem[]; social_media?: string[] } | null = null
  try {
    const obj = JSON.parse(priorities)
    if (obj && typeof obj === 'object' && (obj.news_and_press || obj.company_content || obj.social_media)) {
      parsed = obj
    }
  } catch { /* legacy string */ }

  if (!parsed) {
    // Legacy flat string fallback
    return (
      <div>
        <div className="text-xs text-muted-foreground mb-1">Strategic Priorities</div>
        <p className="text-sm leading-relaxed">{priorities}</p>
        {newsSources.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {newsSources.map((s, i) => (
              <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" title={s.title}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-[11px] font-medium text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors">
                Source {i + 1}
              </a>
            ))}
          </div>
        )}
      </div>
    )
  }

  // social_media items can be { text, url } objects or legacy strings
  type SocialItem = { text: string; url: string } | string
  const socialItems: SocialItem[] = Array.isArray(parsed.social_media) ? parsed.social_media : []

  const hasNews = (parsed.news_and_press?.length ?? 0) > 0
  const hasContent = (parsed.company_content?.length ?? 0) > 0
  const hasSocial = socialItems.length > 0

  if (!hasNews && !hasContent && !hasSocial) return null

  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">Strategic Priorities</div>
      <div className="space-y-2">
        {hasNews && (
          <CollapsibleSection label="News & Press Releases">
            <ul className="text-sm leading-relaxed space-y-1">
              {(parsed.news_and_press ?? []).map((item: string, i: number) => (
                <li key={i} className="flex gap-1.5">
                  <span className="text-muted-foreground shrink-0">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            {newsSources.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {newsSources.map((s, i) => (
                  <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" title={s.title}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-[11px] font-medium text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors">
                    Source {i + 1}
                  </a>
                ))}
              </div>
            )}
          </CollapsibleSection>
        )}

        {hasContent && (
          <CollapsibleSection label="Company Content">
            <ul className="text-sm leading-relaxed space-y-1">
              {(parsed.company_content ?? []).map((item: string | { text: string; url: string | null }, i: number) => {
                const text = typeof item === 'string' ? item : item.text
                const url = typeof item === 'string' ? null : item.url
                return (
                  <li key={i} className="flex gap-1.5">
                    <span className="text-muted-foreground shrink-0">•</span>
                    <span>
                      {text}
                      {url && (
                        <a href={url} target="_blank" rel="noopener noreferrer"
                          className="ml-1 text-[11px] text-blue-600 hover:underline">
                          (source)
                        </a>
                      )}
                    </span>
                  </li>
                )
              })}
            </ul>
          </CollapsibleSection>
        )}

        {hasSocial && (
          <CollapsibleSection label="Social Media">
            <ul className="text-sm leading-relaxed space-y-1">
              {socialItems.map((item, i) => {
                const url = typeof item === 'string' ? null : item.url
                const text = typeof item === 'string' ? item : item.text
                const platform = url?.includes('linkedin.com') ? 'LinkedIn' : url?.includes('twitter.com') || url?.includes('x.com') ? 'X' : null
                return (
                  <li key={i} className="flex gap-1.5">
                    <span className="text-muted-foreground shrink-0">•</span>
                    <span>
                      {text}
                      {url && (
                        <a href={url} target="_blank" rel="noopener noreferrer"
                          className="ml-1 text-[11px] text-blue-600 hover:underline">
                          {platform ? `(${platform})` : '(source)'}
                        </a>
                      )}
                    </span>
                  </li>
                )
              })}
            </ul>
          </CollapsibleSection>
        )}
      </div>
    </div>
  )
}


function CollapsibleSection({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="border rounded-md">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>{label}</span>
        <span className="text-[10px]">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="px-2.5 pb-2">{children}</div>}
    </div>
  )
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
  const [followUp1Date, setFollowUp1Date] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 14); return d.toISOString().slice(0, 10)
  })
  const [followUp2Date, setFollowUp2Date] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 21); return d.toISOString().slice(0, 10)
  })
  const [primaryName, setPrimaryName] = useState('')
  const [primaryRole, setPrimaryRole] = useState('')
  const [primaryEmail, setPrimaryEmail] = useState('')
  const [primaryLinkedIn, setPrimaryLinkedIn] = useState('')
  const [secondaryName, setSecondaryName] = useState('')
  const [secondaryEmail, setSecondaryEmail] = useState('')
  const [secondaryLinkedIn, setSecondaryLinkedIn] = useState('')
  const [showApolloDialog, setShowApolloDialog] = useState(false)
  const apolloEnabled = process.env.NEXT_PUBLIC_APOLLO_ENABLED === 'true'

  useEffect(() => {
    if (!lead) return
    setLocalLead(lead)
    setMessage(null)
    setSubject('')
    setBody('')
    setFollowUp1Body('')
    setFollowUp2Body('')
    const d1 = new Date(); d1.setDate(d1.getDate() + 14)
    setFollowUp1Date(d1.toISOString().slice(0, 10))
    const d2 = new Date(); d2.setDate(d2.getDate() + 21)
    setFollowUp2Date(d2.toISOString().slice(0, 10))
    setPrimaryName(lead.contact_name || '')
    setPrimaryRole(lead.contact_role || '')
    setPrimaryEmail(lead.contact_email || '')
    setPrimaryLinkedIn(lead.contact_linkedin || '')
    setSecondaryName(lead.secondary_contact_name || '')
    setSecondaryEmail(lead.secondary_contact_email || '')
    setSecondaryLinkedIn(lead.secondary_contact_linkedin || '')
    if (lead.lead_status !== 'New') {
      fetchExistingMessage(lead)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead?.id])

  async function fetchExistingMessage(targetLead: Lead = localLead) {
    try {
      const res = await fetch(`/api/generate-message/${targetLead.id}`)
      if (!res.ok) return
      const msg: Message | null = await res.json()
      if (msg) {
        setMessage(msg)
        setSubject(msg.subject || '')
        setBody(msg.body || '')
        setFollowUp1Body(msg.follow_up_1_body || '')
        setFollowUp2Body(msg.follow_up_2_body || '')
        if (msg.follow_up_1_due) setFollowUp1Date(msg.follow_up_1_due.slice(0, 10))
        if (msg.follow_up_2_due) setFollowUp2Date(msg.follow_up_2_due.slice(0, 10))
      }
    } catch { /* silent */ }
  }

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
      if (msg.follow_up_1_due) setFollowUp1Date(msg.follow_up_1_due.slice(0, 10))
      if (msg.follow_up_2_due) setFollowUp2Date(msg.follow_up_2_due.slice(0, 10))
    } catch {
      toast.error('Failed to generate message')
    } finally {
      setGenerating(false)
    }
  }

  function handleEnrichClick() {
    if (apolloEnabled) {
      setShowApolloDialog(true)
    } else {
      enrichLead(false)
    }
  }

  async function enrichLead(useApollo: boolean) {
    setShowApolloDialog(false)
    setEnriching(true)
    try {
      const res = await fetch(`/api/qualify/${localLead.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ useApollo }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || 'Enrichment failed')
        return
      }
      const enriched: Lead = await res.json()
      setLocalLead(enriched)
      toast.success('Lead enriched')
    } catch {
      toast.error('Enrichment failed')
    } finally {
      setEnriching(false)
    }
  }

  async function saveContactField(field: string, value: string) {
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
            <Button variant="outline" size="sm" onClick={handleEnrichClick} disabled={enriching}>
              {enriching ? <><Spinner /> Enriching...</> : (localLead.lead_status !== 'New' ? 'Re-enrich' : 'Enrich')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => generateMessage()} disabled={generating || localLead.lead_status === 'New'}>
              {generating ? <><Spinner /> Drafting...</> : (message ? 'Re-draft email' : 'Draft email')}
            </Button>
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
              <StrategicPrioritiesDisplay
                priorities={localLead.strategic_priorities}
                newsSources={newsSources}
              />
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

            {/* Primary Contact */}
            <div className="border-t pt-4">
              <div className="text-xs uppercase text-muted-foreground font-medium mb-3">Primary Contact</div>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-muted-foreground block mb-0.5">Name</label>
                  <Input
                    value={primaryName}
                    onChange={e => setPrimaryName(e.target.value)}
                    onBlur={() => saveContactField('contact_name', primaryName)}
                    placeholder="Full name"
                    className="h-7 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-0.5">Role</label>
                  <Input
                    value={primaryRole}
                    onChange={e => setPrimaryRole(e.target.value)}
                    onBlur={() => saveContactField('contact_role', primaryRole)}
                    placeholder="e.g. VP of Payments"
                    className="h-7 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-0.5">Email</label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      value={primaryEmail}
                      onChange={e => setPrimaryEmail(e.target.value)}
                      onBlur={() => saveContactField('contact_email', primaryEmail)}
                      placeholder="email@company.com"
                      className="h-7 text-xs flex-1"
                    />
                    {primaryEmail && localLead.contact_email_verified && (
                      <span title="Verified by Apollo" className="text-green-600 text-sm shrink-0">✓</span>
                    )}
                    {primaryEmail && localLead.contact_email_inferred && !localLead.contact_email_verified && (
                      <span title="Inferred email — not verified" className="text-orange-500 text-sm font-bold shrink-0">!</span>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-0.5">LinkedIn</label>
                  <Input
                    value={primaryLinkedIn}
                    onChange={e => setPrimaryLinkedIn(e.target.value)}
                    onBlur={() => saveContactField('contact_linkedin', primaryLinkedIn)}
                    placeholder="linkedin.com/in/..."
                    className="h-7 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Secondary Contact */}
            <div className="border-t pt-4">
              <div className="text-xs uppercase text-muted-foreground font-medium mb-3">Secondary Contact</div>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-muted-foreground block mb-0.5">Name</label>
                  <Input
                    value={secondaryName}
                    onChange={e => setSecondaryName(e.target.value)}
                    onBlur={() => saveContactField('secondary_contact_name', secondaryName)}
                    placeholder="Full name"
                    className="h-7 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-0.5">Email</label>
                  <Input
                    value={secondaryEmail}
                    onChange={e => setSecondaryEmail(e.target.value)}
                    onBlur={() => saveContactField('secondary_contact_email', secondaryEmail)}
                    placeholder="email@company.com"
                    className="h-7 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-0.5">LinkedIn</label>
                  <Input
                    value={secondaryLinkedIn}
                    onChange={e => setSecondaryLinkedIn(e.target.value)}
                    onBlur={() => saveContactField('secondary_contact_linkedin', secondaryLinkedIn)}
                    placeholder="linkedin.com/in/..."
                    className="h-7 text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right: Message editor */}
          <div className="flex-1 p-5 overflow-y-auto relative">
            {generating ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
                <div className="h-5 w-5 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Generating draft...</span>
              </div>
            ) : !message ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                <p className="text-sm text-muted-foreground max-w-xs">
                  {isUnenriched
                    ? 'Enrich this lead first, then draft an email.'
                    : 'No email drafted yet. Click "Draft email" above to generate one.'}
                </p>
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

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase">Subject</label>
                  <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Email subject" />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase">Body</label>
                  <Textarea value={body} onChange={e => setBody(e.target.value)} rows={6} placeholder="Email body" />
                </div>

                <div className="border-t pt-4 space-y-2">
                  <div className="text-xs font-medium text-muted-foreground uppercase">Follow-up 1</div>
                  <Input type="date" value={followUp1Date} onChange={e => setFollowUp1Date(e.target.value)} className="w-40" />
                  <Textarea value={followUp1Body} onChange={e => setFollowUp1Body(e.target.value)} rows={3}
                    placeholder="Follow-up 1 message" />
                </div>

                <div className="border-t pt-4 space-y-2">
                  <div className="text-xs font-medium text-muted-foreground uppercase">Follow-up 2</div>
                  <Input type="date" value={followUp2Date} onChange={e => setFollowUp2Date(e.target.value)} className="w-40" />
                  <Textarea value={followUp2Body} onChange={e => setFollowUp2Body(e.target.value)} rows={3}
                    placeholder="Follow-up 2 message" />
                </div>

                <div className="pt-2">
                  <Button onClick={sendEmail} disabled={sending || !message || !localLead.contact_email}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                    {sending ? 'Sending...' : 'Send Email'}
                  </Button>
                </div>
              </div>
            )}

            {/* Apollo dialog overlay */}
            {showApolloDialog && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                <div className="p-4 border rounded-lg bg-background shadow-lg max-w-sm">
                  <div className="font-medium text-sm mb-1">Use Apollo.io for email lookup?</div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Apollo can find verified email addresses using API credits. Each enrichment uses at most 1 API call.
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => enrichLead(false)}>Skip Apollo</Button>
                    <Button size="sm" onClick={() => enrichLead(true)}>Use Apollo</Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
