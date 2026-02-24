'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Lead, Message } from '@/types'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { LeadStatusBadge } from '@/components/lead-status-badge'
import { toast } from 'sonner'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function LeadDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [lead, setLead] = useState<Lead | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [enriching, setEnriching] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState(false)
  const [platform, setPlatform] = useState<'email' | 'linkedin'>('email')

  // Editable message state
  const [editedSubject, setEditedSubject] = useState('')
  const [editedBody, setEditedBody] = useState('')
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [id])

  async function fetchData() {
    const [leadRes, msgRes] = await Promise.all([
      supabase.from('leads').select('*').eq('id', id).single(),
      supabase.from('messages').select('*').eq('lead_id', id).order('created_at', { ascending: false }),
    ])

    if (leadRes.data) {
      setLead(leadRes.data)
    }
    if (msgRes.data) {
      setMessages(msgRes.data)
      const latest = msgRes.data[0]
      if (latest) {
        setActiveMessageId(latest.id)
        setEditedSubject(latest.subject || '')
        setEditedBody(latest.body || '')
      }
    }
    setLoading(false)
  }

  function selectMessage(msg: Message) {
    setActiveMessageId(msg.id)
    setEditedSubject(msg.subject || '')
    setEditedBody(msg.body || '')
  }

  async function enrich() {
    setEnriching(true)
    try {
      const res = await fetch(`/api/enrich/${id}`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || 'Enrichment failed')
        return
      }
      const updated = await res.json()
      setLead(updated)
      toast.success('Lead enriched successfully')
    } finally {
      setEnriching(false)
    }
  }

  async function generateMessage() {
    setGenerating(true)
    try {
      const res = await fetch(`/api/generate-message/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || 'Message generation failed')
        return
      }
      const newMessage = await res.json()
      setMessages((prev) => [newMessage, ...prev])
      setActiveMessageId(newMessage.id)
      setEditedSubject(newMessage.subject || '')
      setEditedBody(newMessage.body || '')
      // Refetch lead for updated status
      const { data } = await supabase.from('leads').select('*').eq('id', id).single()
      if (data) setLead(data)
      toast.success('Message generated')
    } finally {
      setGenerating(false)
    }
  }

  async function sendEmail() {
    if (!activeMessageId) return
    setSending(true)
    try {
      // Save edits first
      await supabase
        .from('messages')
        .update({ subject: editedSubject, body: editedBody })
        .eq('id', activeMessageId)

      const res = await fetch(`/api/send/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_id: activeMessageId }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || 'Send failed')
        return
      }
      const result = await res.json()
      toast.success('Email sent! Follow-up scheduled.')
      // Refresh data
      await fetchData()
      const { data } = await supabase.from('leads').select('*').eq('id', id).single()
      if (data) setLead(data)
    } finally {
      setSending(false)
    }
  }

  async function markStatus(status: Lead['status']) {
    const res = await fetch(`/api/update-lead/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      const updated = await res.json()
      setLead(updated)
      toast.success(`Status updated to: ${status.replace('_', ' ')}`)
    }
  }

  if (loading) return <div className="p-8 text-muted-foreground">Loading...</div>
  if (!lead) return <div className="p-8 text-muted-foreground">Lead not found.</div>

  const latestMessage = messages.find((m) => m.id === activeMessageId)

  return (
    <div className="p-8 space-y-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/leads" className="text-sm text-muted-foreground hover:underline">← Leads</Link>
            <LeadStatusBadge status={lead.status} />
          </div>
          <h1 className="text-2xl font-bold">{lead.name}</h1>
          <p className="text-muted-foreground mt-0.5">
            {lead.title && <span>{lead.title} · </span>}
            {lead.company_website ? (
              <a href={lead.company_website} target="_blank" rel="noopener noreferrer" className="hover:underline">
                {lead.company}
              </a>
            ) : (
              lead.company
            )}
          </p>
          {lead.email && <p className="text-sm text-muted-foreground mt-1">{lead.email}</p>}
        </div>
        <div className="flex gap-2">
          {lead.status === 'responded' ? null : (
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
          )}
        </div>
      </div>

      {/* Agent 2: Enrichment */}
      <section className="border rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Agent 2 — Enrichment</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={enrich}
            disabled={enriching}
          >
            {enriching ? 'Enriching...' : lead.walletconnect_value_prop ? 'Re-enrich' : 'Run Enrichment'}
          </Button>
        </div>

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
          <p className="text-sm text-muted-foreground">
            Run enrichment to generate a company summary, WalletConnect value prop, and recent news.
          </p>
        )}
      </section>

      {/* Agent 3: Message Generation */}
      <section className="border rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Agent 3 — Message Generation</h2>
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
            Run enrichment above first to generate a personalized message.
          </p>
        )}

        {messages.length > 0 && (
          <div className="space-y-3">
            {/* Message version tabs */}
            {messages.length > 1 && (
              <div className="flex gap-2 text-xs">
                {messages.map((msg, i) => (
                  <button
                    key={msg.id}
                    onClick={() => selectMessage(msg)}
                    className={`px-2 py-1 rounded border text-xs ${
                      activeMessageId === msg.id
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    v{messages.length - i} ({msg.platform}) {msg.sent_at ? '✓ Sent' : ''}
                  </button>
                ))}
              </div>
            )}

            {/* Editable message */}
            {latestMessage && (
              <div className="space-y-3">
                {latestMessage.platform === 'email' && (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Subject</label>
                    <Input
                      value={editedSubject}
                      onChange={(e) => setEditedSubject(e.target.value)}
                      className="font-medium"
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {latestMessage.platform === 'email' ? 'Email Body' : 'LinkedIn DM'}
                  </label>
                  <Textarea
                    value={editedBody}
                    onChange={(e) => setEditedBody(e.target.value)}
                    rows={6}
                    className="text-sm"
                  />
                </div>
                {latestMessage.sent_at ? (
                  <div className="text-sm text-green-700 bg-green-50 rounded p-3">
                    ✓ Sent on {new Date(latestMessage.sent_at).toLocaleDateString()}.
                    {latestMessage.follow_up_1_due && (
                      <span> Follow-up 1 due: {new Date(latestMessage.follow_up_1_due).toLocaleDateString()}</span>
                    )}
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
                  <p className="text-xs text-amber-600">No email address on this lead. Add one to send.</p>
                )}
              </div>
            )}
          </div>
        )}

        {messages.length === 0 && lead.walletconnect_value_prop && (
          <p className="text-sm text-muted-foreground">
            Click &quot;Generate Message&quot; to create a personalized outreach message.
          </p>
        )}
      </section>

      {/* Agent 4: Follow-up info */}
      {messages.some((m) => m.sent_at) && (
        <section className="border rounded-lg p-6 space-y-3">
          <h2 className="font-semibold text-lg">Agent 4 — Follow-up Schedule</h2>
          {messages
            .filter((m) => m.sent_at)
            .map((m) => (
              <div key={m.id} className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Follow-up 1</span>
                  <span>{m.follow_up_1_due ? new Date(m.follow_up_1_due).toLocaleDateString() : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Follow-up 2</span>
                  <span>{m.follow_up_2_due ? new Date(m.follow_up_2_due).toLocaleDateString() : '—'}</span>
                </div>
              </div>
            ))}
        </section>
      )}
    </div>
  )
}
