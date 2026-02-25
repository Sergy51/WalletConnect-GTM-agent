'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Lead, Message } from '@/types'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { LeadStatusBadge } from '@/components/lead-status-badge'
import { toast } from 'sonner'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const FIT_SCORE_COLORS: Record<string, string> = {
  High: 'bg-green-100 text-green-700 border-green-200',
  Medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  Low: 'bg-red-100 text-red-700 border-red-200',
}

function toDateInputValue(iso: string | null): string {
  if (!iso) return ''
  return iso.slice(0, 10)
}

export default function LeadDetailPage() {
  const params = useParams()
  const id = params.id as string

  const [lead, setLead] = useState<Lead | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)

  const [enriching, setEnriching] = useState(false)
  const [categorizing, setCategorizing] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState(false)
  const [savingFollowUps, setSavingFollowUps] = useState(false)

  const [platform, setPlatform] = useState<'email' | 'linkedin'>('email')
  const [editedSubject, setEditedSubject] = useState('')
  const [editedBody, setEditedBody] = useState('')
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null)

  // Follow-up editable state
  const [followUp1Date, setFollowUp1Date] = useState('')
  const [followUp2Date, setFollowUp2Date] = useState('')
  const [followUp1Body, setFollowUp1Body] = useState('')
  const [followUp2Body, setFollowUp2Body] = useState('')

  useEffect(() => {
    fetchData()
  }, [id])

  async function fetchData() {
    const [leadRes, msgRes] = await Promise.all([
      supabase.from('leads').select('*').eq('id', id).single(),
      supabase.from('messages').select('*').eq('lead_id', id).order('created_at', { ascending: false }),
    ])
    if (leadRes.data) setLead(leadRes.data)
    if (msgRes.data) {
      setMessages(msgRes.data)
      const latest = msgRes.data[0]
      if (latest) {
        setActiveMessageId(latest.id)
        setEditedSubject(latest.subject || '')
        setEditedBody(latest.body || '')
        setFollowUp1Date(toDateInputValue(latest.follow_up_1_due))
        setFollowUp2Date(toDateInputValue(latest.follow_up_2_due))
        setFollowUp1Body(latest.follow_up_1_body || '')
        setFollowUp2Body(latest.follow_up_2_body || '')
      }
    }
    setLoading(false)
  }

  function selectMessage(msg: Message) {
    setActiveMessageId(msg.id)
    setEditedSubject(msg.subject || '')
    setEditedBody(msg.body || '')
    setFollowUp1Date(toDateInputValue(msg.follow_up_1_due))
    setFollowUp2Date(toDateInputValue(msg.follow_up_2_due))
    setFollowUp1Body(msg.follow_up_1_body || '')
    setFollowUp2Body(msg.follow_up_2_body || '')
  }

  async function enrich() {
    setEnriching(true)
    try {
      const res = await fetch(`/api/enrich/${id}`, { method: 'POST' })
      if (!res.ok) { toast.error((await res.json()).error || 'Enrichment failed'); return }
      setLead(await res.json())
      toast.success('Lead enriched')
    } finally { setEnriching(false) }
  }

  async function categorize() {
    setCategorizing(true)
    try {
      const res = await fetch(`/api/categorize/${id}`, { method: 'POST' })
      if (!res.ok) { toast.error((await res.json()).error || 'Categorization failed'); return }
      setLead(await res.json())
      toast.success('Lead categorized')
    } finally { setCategorizing(false) }
  }

  async function generateMessage() {
    setGenerating(true)
    try {
      const res = await fetch(`/api/generate-message/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform }),
      })
      if (!res.ok) { toast.error((await res.json()).error || 'Generation failed'); return }
      const newMessage = await res.json()
      setMessages((prev) => [newMessage, ...prev])
      setActiveMessageId(newMessage.id)
      setEditedSubject(newMessage.subject || '')
      setEditedBody(newMessage.body || '')
      setFollowUp1Date('')
      setFollowUp2Date('')
      setFollowUp1Body('')
      setFollowUp2Body('')
      const { data } = await supabase.from('leads').select('*').eq('id', id).single()
      if (data) setLead(data)
      toast.success('Message generated')
    } finally { setGenerating(false) }
  }

  async function sendEmail() {
    if (!activeMessageId) return
    setSending(true)
    try {
      await supabase.from('messages').update({ subject: editedSubject, body: editedBody }).eq('id', activeMessageId)
      const res = await fetch(`/api/send/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_id: activeMessageId }),
      })
      if (!res.ok) { toast.error((await res.json()).error || 'Send failed'); return }
      toast.success('Email sent — follow-ups scheduled and drafted.')
      await fetchData()
    } finally { setSending(false) }
  }

  async function saveFollowUps() {
    if (!activeMessageId) return
    setSavingFollowUps(true)
    try {
      const res = await fetch(`/api/update-message/${activeMessageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          follow_up_1_due: followUp1Date ? new Date(followUp1Date).toISOString() : null,
          follow_up_2_due: followUp2Date ? new Date(followUp2Date).toISOString() : null,
          follow_up_1_body: followUp1Body,
          follow_up_2_body: followUp2Body,
        }),
      })
      if (!res.ok) { toast.error('Failed to save follow-ups'); return }
      const updated = await res.json()
      setMessages((prev) => prev.map((m) => (m.id === activeMessageId ? { ...m, ...updated } : m)))
      toast.success('Follow-up schedule saved')
    } finally { setSavingFollowUps(false) }
  }

  async function markStatus(status: Lead['status']) {
    const res = await fetch(`/api/update-lead/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) { setLead(await res.json()); toast.success(`Status: ${status.replace(/_/g, ' ')}`) }
  }

  if (loading) return <div className="p-8 text-muted-foreground">Loading...</div>
  if (!lead) return <div className="p-8 text-muted-foreground">Lead not found.</div>

  const latestMessage = messages.find((m) => m.id === activeMessageId)
  const sentMessage = messages.find((m) => m.sent_at)

  return (
    <div className="p-8 space-y-6 max-w-4xl">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/leads" className="text-sm text-muted-foreground hover:underline">← Leads</Link>
            <LeadStatusBadge status={lead.status} />
            {lead.fit_score && (
              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${FIT_SCORE_COLORS[lead.fit_score]}`}>
                {lead.fit_score} fit
              </span>
            )}
            {lead.icp_segment && (
              <span className="inline-flex items-center rounded-full border bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                {lead.icp_segment}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold">{lead.name}</h1>
          <p className="text-muted-foreground mt-0.5">
            {lead.title && <span>{lead.title} · </span>}
            {lead.company_website ? (
              <a href={lead.company_website} target="_blank" rel="noopener noreferrer" className="hover:underline">{lead.company}</a>
            ) : lead.company}
          </p>
          {lead.email && <p className="text-sm text-muted-foreground mt-1">{lead.email}</p>}
        </div>
        <select
          className="text-sm border rounded px-2 py-1 bg-background"
          value={lead.status}
          onChange={(e) => markStatus(e.target.value as Lead['status'])}
        >
          <option value="new">New</option>
          <option value="qualified">Qualified</option>
          <option value="message_drafted">Message Drafted</option>
          <option value="sent">Sent</option>
          <option value="followed_up">Followed Up</option>
          <option value="responded">Responded</option>
          <option value="not_interested">Not Interested</option>
        </select>
      </div>

      {/* Enrichment Agent */}
      <section className="border rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Enrichment Agent</h2>
          <Button variant="outline" size="sm" onClick={enrich} disabled={enriching}>
            {enriching ? 'Enriching...' : lead.walletconnect_value_prop ? 'Re-enrich' : 'Run Enrichment'}
          </Button>
        </div>

        {lead.enrichment_confidence === 'low' && (
          <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
            ⚠ Limited public data found for &quot;{lead.company}&quot;. The content below is inferred — verify before outreach.
          </div>
        )}

        {lead.company_description ? (
          <div className="space-y-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Company Summary</div>
              <p className="text-sm">{lead.company_description}</p>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">WalletConnect Pay Value Prop</div>
              <p className="text-sm text-blue-900 bg-blue-50 rounded p-3">{lead.walletconnect_value_prop}</p>
            </div>
            {lead.recent_news && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Recent News</div>
                <p className="text-xs text-muted-foreground whitespace-pre-line">{lead.recent_news}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Run enrichment to generate a company summary, WalletConnect value prop, and recent news.</p>
        )}
      </section>

      {/* Categorization Agent */}
      {lead.company_description && (
        <section className="border rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg">Categorization Agent</h2>
            <Button variant="outline" size="sm" onClick={categorize} disabled={categorizing}>
              {categorizing ? 'Categorizing...' : lead.fit_score ? 'Re-categorize' : 'Run Categorization'}
            </Button>
          </div>

          {lead.fit_score ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">ICP Segment</div>
                  <span className="inline-flex items-center rounded-full border bg-slate-50 px-2.5 py-0.5 text-sm font-medium text-slate-700">
                    {lead.icp_segment}
                  </span>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Fit Score</div>
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-sm font-semibold ${FIT_SCORE_COLORS[lead.fit_score]}`}>
                    {lead.fit_score}
                  </span>
                </div>
              </div>
              {lead.fit_reason && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Reasoning</div>
                  <p className="text-sm">{lead.fit_reason}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Run categorization to score this lead&apos;s fit and assign an ICP segment.
            </p>
          )}
        </section>
      )}

      {/* Drafting Agent */}
      <section className="border rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Drafting Agent</h2>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border overflow-hidden">
              <button
                onClick={() => setPlatform('email')}
                className={`px-3 py-1 text-sm ${platform === 'email' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
              >
                Email
              </button>
              <button
                onClick={() => setPlatform('linkedin')}
                className={`px-3 py-1 text-sm border-l ${platform === 'linkedin' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
              >
                LinkedIn DM
              </button>
            </div>
            <Button
              size="sm"
              onClick={generateMessage}
              disabled={generating || !lead.walletconnect_value_prop}
              title={!lead.walletconnect_value_prop ? 'Run enrichment first' : ''}
            >
              {generating ? 'Generating...' : messages.length > 0 ? 'Regenerate' : 'Generate Message'}
            </Button>
          </div>
        </div>

        {!lead.walletconnect_value_prop && (
          <p className="text-sm text-amber-600 bg-amber-50 rounded p-3">
            Run the Enrichment Agent first to generate a personalized message.
          </p>
        )}

        {messages.length > 1 && (
          <div className="flex gap-2">
            {messages.map((msg, i) => (
              <button
                key={msg.id}
                onClick={() => selectMessage(msg)}
                className={`px-2 py-1 rounded border text-xs ${
                  activeMessageId === msg.id ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
                }`}
              >
                v{messages.length - i} ({msg.platform}) {msg.sent_at ? '✓' : ''}
              </button>
            ))}
          </div>
        )}

        {latestMessage && (
          <div className="space-y-3">
            {latestMessage.platform === 'email' && (
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Subject</label>
                <Input value={editedSubject} onChange={(e) => setEditedSubject(e.target.value)} className="font-medium" />
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {latestMessage.platform === 'email' ? 'Email Body' : 'LinkedIn DM'}
              </label>
              <Textarea value={editedBody} onChange={(e) => setEditedBody(e.target.value)} rows={6} className="text-sm" />
            </div>
            {latestMessage.sent_at ? (
              <div className="text-sm text-green-700 bg-green-50 rounded p-3">
                ✓ Sent on {new Date(latestMessage.sent_at).toLocaleDateString()}.
              </div>
            ) : latestMessage.platform === 'email' ? (
              <Button onClick={sendEmail} disabled={sending || !lead.email}>
                {sending ? 'Sending...' : 'Approve & Send Email'}
              </Button>
            ) : (
              <div className="text-sm text-muted-foreground bg-muted rounded p-3">
                LinkedIn DMs must be sent manually. Copy the message above and paste it into LinkedIn.
              </div>
            )}
            {!lead.email && latestMessage.platform === 'email' && (
              <p className="text-xs text-amber-600">No email address on this lead.</p>
            )}
          </div>
        )}

        {messages.length === 0 && lead.walletconnect_value_prop && (
          <p className="text-sm text-muted-foreground">Click &quot;Generate Message&quot; to create a personalized outreach message.</p>
        )}
      </section>

      {/* Follow-up Schedule */}
      {sentMessage && (
        <section className="border rounded-lg p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg">Follow-up Schedule</h2>
            <Button variant="outline" size="sm" onClick={saveFollowUps} disabled={savingFollowUps}>
              {savingFollowUps ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>

          {/* Follow-up 1 */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium w-28 shrink-0">Follow-up 1</span>
              <input
                type="date"
                value={followUp1Date}
                onChange={(e) => setFollowUp1Date(e.target.value)}
                className="text-sm border rounded px-2 py-1 bg-background"
              />
            </div>
            <Textarea
              value={followUp1Body}
              onChange={(e) => setFollowUp1Body(e.target.value)}
              placeholder="Follow-up message text (auto-generated when you send the initial email)..."
              rows={3}
              className="text-sm"
            />
          </div>

          {/* Follow-up 2 */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium w-28 shrink-0">Follow-up 2</span>
              <input
                type="date"
                value={followUp2Date}
                onChange={(e) => setFollowUp2Date(e.target.value)}
                className="text-sm border rounded px-2 py-1 bg-background"
              />
            </div>
            <Textarea
              value={followUp2Body}
              onChange={(e) => setFollowUp2Body(e.target.value)}
              placeholder="Final follow-up message text..."
              rows={3}
              className="text-sm"
            />
          </div>
        </section>
      )}
    </div>
  )
}
