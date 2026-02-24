'use client'

import { useEffect, useState } from 'react'
import { Lead, LeadStatus } from '@/types'
import { LeadStatusBadge } from '@/components/lead-status-badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { toast } from 'sonner'

const STATUS_FILTERS: { label: string; value: LeadStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'New', value: 'new' },
  { label: 'Qualified', value: 'qualified' },
  { label: 'Message Drafted', value: 'message_drafted' },
  { label: 'Sent', value: 'sent' },
  { label: 'Responded', value: 'responded' },
  { label: 'Not Interested', value: 'not_interested' },
]

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [filter, setFilter] = useState<LeadStatus | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [enrichingIds, setEnrichingIds] = useState<Set<string>>(new Set())
  const [enrichingAll, setEnrichingAll] = useState(false)

  useEffect(() => {
    fetchLeads()
  }, [])

  async function fetchLeads() {
    setLoading(true)
    const res = await fetch('/api/leads')
    const data = await res.json()
    setLeads(data)
    setLoading(false)
  }

  async function enrichLead(id: string) {
    setEnrichingIds((prev) => new Set(prev).add(id))
    try {
      const res = await fetch(`/api/enrich/${id}`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json()
        toast.error(`Enrichment failed: ${err.error}`)
        return
      }
      const updated = await res.json()
      setLeads((prev) => prev.map((l) => (l.id === id ? updated : l)))
      toast.success(`Enriched: ${updated.name}`)
    } finally {
      setEnrichingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  async function enrichAll() {
    const targets = leads.filter((l) => l.status === 'new')
    if (targets.length === 0) {
      toast.info('No new leads to enrich.')
      return
    }
    setEnrichingAll(true)
    for (const lead of targets) {
      await enrichLead(lead.id)
    }
    setEnrichingAll(false)
    toast.success('All new leads enriched.')
  }

  const filtered = filter === 'all' ? leads : leads.filter((l) => l.status === filter)

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Leads</h1>
          <p className="text-muted-foreground mt-1">{leads.length} total leads</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={enrichAll} disabled={enrichingAll}>
            {enrichingAll ? 'Enriching...' : 'Enrich All New'}
          </Button>
          <Link href="/leads/new">
            <Button>+ Add Leads</Button>
          </Link>
        </div>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
              filter === f.value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border bg-background hover:bg-muted'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-muted-foreground py-12 text-center">Loading leads...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border border-dashed rounded-lg">
          <p className="text-lg">No leads yet.</p>
          <p className="mt-1 text-sm">
            <Link href="/leads/new" className="underline">
              Add your first leads
            </Link>{' '}
            via CSV upload or manual entry.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Title</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Company</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((lead) => (
                <tr key={lead.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/leads/${lead.id}`} className="font-medium hover:underline">
                      {lead.name}
                    </Link>
                    {lead.email && (
                      <div className="text-xs text-muted-foreground">{lead.email}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{lead.title || '—'}</td>
                  <td className="px-4 py-3">
                    {lead.company_website ? (
                      <a href={lead.company_website} target="_blank" rel="noopener noreferrer" className="hover:underline">
                        {lead.company}
                      </a>
                    ) : (
                      lead.company
                    )}
                    {lead.company_size && (
                      <div className="text-xs text-muted-foreground">{lead.company_size}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <LeadStatusBadge status={lead.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {lead.status === 'new' && (
                        <button
                          onClick={() => enrichLead(lead.id)}
                          disabled={enrichingIds.has(lead.id)}
                          className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                        >
                          {enrichingIds.has(lead.id) ? 'Enriching...' : 'Enrich'}
                        </button>
                      )}
                      <Link href={`/leads/${lead.id}`} className="text-xs text-primary hover:underline">
                        View
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
