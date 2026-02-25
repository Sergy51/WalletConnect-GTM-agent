'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { AddLeadModal } from '@/components/add-lead-modal'
import { MessagePanel } from '@/components/message-panel'
import type { Lead, LeadStatus } from '@/types'

const STATUS_OPTIONS: LeadStatus[] = ['New', 'Qualified', 'Contacted', 'Proposal', 'Negotiating', 'Won', 'Lost', 'Churned']
const TYPE_OPTIONS = ['PSP', 'Merchant', 'Other'] as const
const SOURCE_OPTIONS = ['Inbound', 'Outbound', 'Referral', 'Event'] as const
const PRIORITY_OPTIONS = ['High', 'Medium', 'Low'] as const
const CRYPTO_OPTIONS = ['None', 'Basic', 'Advanced'] as const

const STATUS_COLORS: Record<string, string> = {
  New: 'bg-slate-100 text-slate-700',
  Qualified: 'bg-blue-100 text-blue-700',
  Contacted: 'bg-orange-100 text-orange-700',
  Proposal: 'bg-purple-100 text-purple-700',
  Negotiating: 'bg-yellow-100 text-yellow-700',
  Won: 'bg-green-100 text-green-700',
  Lost: 'bg-red-100 text-red-700',
  Churned: 'bg-gray-100 text-gray-500',
}

const PRIORITY_COLORS: Record<string, string> = {
  High: 'bg-red-100 text-red-700',
  Medium: 'bg-yellow-100 text-yellow-700',
  Low: 'bg-gray-100 text-gray-600',
}

function Spinner() {
  return (
    <div className="inline-block h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin opacity-60" />
  )
}

interface InlineSelectProps {
  value: string | null
  options: readonly string[]
  placeholder?: string
  colorMap?: Record<string, string>
  onChange: (value: string) => void
}

function InlineSelect({ value, options, placeholder = '—', colorMap, onChange }: InlineSelectProps) {
  return (
    <Select value={value || ''} onValueChange={onChange}>
      <SelectTrigger
        size="sm"
        className={`h-6 text-xs border-0 shadow-none px-1.5 min-w-0 w-fit gap-1 ${
          value && colorMap ? (colorMap[value] || '') + ' rounded-full' : ''
        }`}
      >
        <SelectValue placeholder={<span className="text-muted-foreground">{placeholder}</span>} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt} value={opt}>
            {opt}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function TruncatedCell({ text }: { text: string | null }) {
  if (!text) return <span className="text-muted-foreground">—</span>
  return (
    <span className="truncate block max-w-[140px]" title={text}>
      {text}
    </span>
  )
}

export default function HomePage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [qualifying, setQualifying] = useState<Set<string>>(new Set())
  const [showAddModal, setShowAddModal] = useState(false)
  const [panelLeads, setPanelLeads] = useState<Lead[]>([])
  const [panelIndex, setPanelIndex] = useState(0)
  const [expandedPriorities, setExpandedPriorities] = useState<Set<string>>(new Set())

  const fetchLeads = useCallback(async () => {
    try {
      const res = await fetch('/api/leads')
      if (!res.ok) throw new Error('Failed to fetch leads')
      const data: Lead[] = await res.json()
      setLeads(data)
    } catch {
      toast.error('Failed to load leads')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === leads.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(leads.map((l) => l.id)))
    }
  }

  async function updateLeadField(id: string, field: string, value: string) {
    setLeads((prev) =>
      prev.map((l) => (l.id === id ? { ...l, [field]: value } : l))
    )
    try {
      const res = await fetch(`/api/update-lead/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
      if (!res.ok) {
        toast.error('Failed to update lead')
        fetchLeads()
      }
    } catch {
      toast.error('Failed to update lead')
      fetchLeads()
    }
  }

  async function qualifyLeads() {
    const toQualify =
      selected.size > 0
        ? leads.filter((l) => selected.has(l.id))
        : leads.filter((l) => l.lead_status === 'New')

    if (toQualify.length === 0) {
      toast.info('No leads to qualify')
      return
    }

    const ids = toQualify.map((l) => l.id)
    setQualifying(new Set(ids))

    const results: Array<{ id: string; success: boolean; error?: string }> = []
    for (const id of ids) {
      try {
        const res = await fetch(`/api/qualify/${id}`, { method: 'POST' })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          results.push({ id, success: false, error: err.error || `HTTP ${res.status}` })
        } else {
          const updated: Lead = await res.json()
          setLeads((prev) => prev.map((l) => (l.id === id ? updated : l)))
          results.push({ id, success: true })
        }
      } catch (e) {
        results.push({ id, success: false, error: e instanceof Error ? e.message : 'Unknown error' })
      } finally {
        setQualifying((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      }
    }

    const succeeded = results.filter((r) => r.success).length
    const failed = results.filter((r) => !r.success).length
    if (succeeded > 0) toast.success(`Qualified ${succeeded} lead${succeeded !== 1 ? 's' : ''}`)
    if (failed > 0) toast.error(`${failed} lead${failed !== 1 ? 's' : ''} failed to qualify`)
  }

  function openDraftPanel() {
    const selectedLeads = leads.filter((l) => selected.has(l.id))
    if (selectedLeads.length === 0) return
    setPanelLeads(selectedLeads)
    setPanelIndex(0)
  }

  function openDraftForLead(lead: Lead) {
    setPanelLeads([lead])
    setPanelIndex(0)
  }

  function handlePanelNext() {
    setPanelIndex((i) => i + 1)
  }

  function handlePanelClose() {
    setPanelLeads([])
    setPanelIndex(0)
    fetchLeads()
  }

  function togglePriorityExpanded(id: string) {
    setExpandedPriorities((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allSelected = leads.length > 0 && selected.size === leads.length

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0 gap-3">
        <h1 className="text-sm font-semibold whitespace-nowrap">WalletConnect Pay GTM</h1>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Button variant="outline" size="sm" onClick={toggleSelectAll}>
            {allSelected ? 'Deselect All' : 'Select All'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={qualifyLeads}
            disabled={qualifying.size > 0}
          >
            {qualifying.size > 0 ? (
              <span className="flex items-center gap-1.5"><Spinner /> Qualifying...</span>
            ) : (
              selected.size > 0 ? `Qualify (${selected.size})` : 'Qualify New'
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={openDraftPanel}
            disabled={selected.size === 0}
          >
            Draft Emails{selected.size > 0 ? ` (${selected.size})` : ''}
          </Button>
          <Button size="sm" onClick={() => setShowAddModal(true)}>
            Add Lead
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            Loading leads...
          </div>
        ) : leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm gap-2">
            <p>No leads yet.</p>
            <Button size="sm" onClick={() => setShowAddModal(true)}>Add your first lead</Button>
          </div>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur-sm">
              <tr className="border-b">
                <th className="sticky left-0 z-20 bg-muted/90 px-2 py-2.5 w-8 text-left">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="rounded"
                  />
                </th>
                <th className="sticky left-8 z-20 bg-muted/90 px-2 py-2.5 text-left font-medium whitespace-nowrap min-w-[120px]">Company</th>
                <th className="sticky left-[152px] z-20 bg-muted/90 px-2 py-2.5 text-left font-medium whitespace-nowrap">Type</th>
                <th className="px-2 py-2.5 text-left font-medium whitespace-nowrap">Website</th>
                <th className="px-2 py-2.5 text-left font-medium whitespace-nowrap">Industry</th>
                <th className="px-2 py-2.5 text-left font-medium whitespace-nowrap">Emp.</th>
                <th className="px-2 py-2.5 text-left font-medium whitespace-nowrap">Rev.</th>
                <th className="px-2 py-2.5 text-left font-medium whitespace-nowrap">Contact</th>
                <th className="px-2 py-2.5 text-left font-medium whitespace-nowrap">Role</th>
                <th className="px-2 py-2.5 text-left font-medium whitespace-nowrap">Email</th>
                <th className="px-2 py-2.5 text-left font-medium whitespace-nowrap">Phone</th>
                <th className="px-2 py-2.5 text-left font-medium whitespace-nowrap">LinkedIn</th>
                <th className="px-2 py-2.5 text-left font-medium whitespace-nowrap">Source</th>
                <th className="px-2 py-2.5 text-left font-medium whitespace-nowrap">Status</th>
                <th className="px-2 py-2.5 text-left font-medium whitespace-nowrap">Payments Stack</th>
                <th className="px-2 py-2.5 text-left font-medium whitespace-nowrap">Crypto</th>
                <th className="px-2 py-2.5 text-left font-medium whitespace-nowrap">Est. Volume</th>
                <th className="px-2 py-2.5 text-left font-medium whitespace-nowrap">Priorities</th>
                <th className="px-2 py-2.5 text-left font-medium whitespace-nowrap">Priority</th>
                <th className="px-2 py-2.5 text-left font-medium whitespace-nowrap w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {leads.map((lead) => {
                const isSelected = selected.has(lead.id)
                const isQualifying = qualifying.has(lead.id)
                const prioritiesExpanded = expandedPriorities.has(lead.id)

                return (
                  <tr
                    key={lead.id}
                    className={`hover:bg-muted/30 transition-colors ${isSelected ? 'bg-blue-50/50' : ''} ${isQualifying ? 'opacity-60' : ''}`}
                  >
                    <td className={`sticky left-0 z-10 px-2 py-1.5 w-8 ${isSelected ? 'bg-blue-50/90' : 'bg-background'}`}>
                      {isQualifying ? (
                        <Spinner />
                      ) : (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(lead.id)}
                          className="rounded"
                        />
                      )}
                    </td>
                    <td className={`sticky left-8 z-10 px-2 py-1.5 font-medium min-w-[120px] max-w-[160px] ${isSelected ? 'bg-blue-50/90' : 'bg-background'}`}>
                      <span className="truncate block" title={lead.company}>{lead.company}</span>
                    </td>
                    <td className={`sticky left-[152px] z-10 px-2 py-1.5 ${isSelected ? 'bg-blue-50/90' : 'bg-background'}`}>
                      <InlineSelect
                        value={lead.lead_type}
                        options={TYPE_OPTIONS}
                        onChange={(v) => updateLeadField(lead.id, 'lead_type', v)}
                      />
                    </td>

                    <td className="px-2 py-1.5 max-w-[120px]">
                      {lead.company_website ? (
                        <a
                          href={lead.company_website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline truncate block max-w-[120px]"
                          title={lead.company_website}
                        >
                          {lead.company_website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                        </a>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-2 py-1.5"><TruncatedCell text={lead.industry} /></td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{lead.company_size_employees || <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{lead.company_size_revenue || <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-2 py-1.5"><TruncatedCell text={lead.contact_name} /></td>
                    <td className="px-2 py-1.5"><TruncatedCell text={lead.contact_role} /></td>
                    <td className="px-2 py-1.5">
                      {lead.contact_email ? (
                        <span className="truncate block max-w-[140px]" title={lead.contact_email}>{lead.contact_email}</span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-2 py-1.5"><TruncatedCell text={lead.contact_phone} /></td>
                    <td className="px-2 py-1.5">
                      {lead.contact_linkedin ? (
                        <a
                          href={lead.contact_linkedin}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                          title={lead.contact_linkedin}
                        >
                          LinkedIn
                        </a>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-2 py-1.5">
                      <InlineSelect
                        value={lead.lead_source}
                        options={SOURCE_OPTIONS}
                        onChange={(v) => updateLeadField(lead.id, 'lead_source', v)}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <InlineSelect
                        value={lead.lead_status}
                        options={STATUS_OPTIONS}
                        colorMap={STATUS_COLORS}
                        onChange={(v) => updateLeadField(lead.id, 'lead_status', v)}
                      />
                    </td>
                    <td className="px-2 py-1.5"><TruncatedCell text={lead.payments_stack} /></td>
                    <td className="px-2 py-1.5">
                      <InlineSelect
                        value={lead.crypto_capabilities}
                        options={CRYPTO_OPTIONS}
                        onChange={(v) => updateLeadField(lead.id, 'crypto_capabilities', v)}
                      />
                    </td>
                    <td className="px-2 py-1.5"><TruncatedCell text={lead.estimated_yearly_volumes} /></td>
                    <td className="px-2 py-1.5 max-w-[160px]">
                      {lead.strategic_priorities ? (
                        <button
                          onClick={() => togglePriorityExpanded(lead.id)}
                          className="text-left w-full"
                          title={lead.strategic_priorities}
                        >
                          <span className={`block text-xs ${prioritiesExpanded ? '' : 'truncate max-w-[150px]'}`}>
                            {lead.strategic_priorities}
                          </span>
                          {!prioritiesExpanded && lead.strategic_priorities.length > 60 && (
                            <span className="text-muted-foreground text-xs">more</span>
                          )}
                        </button>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-2 py-1.5">
                      <InlineSelect
                        value={lead.lead_priority}
                        options={PRIORITY_OPTIONS}
                        colorMap={PRIORITY_COLORS}
                        onChange={(v) => updateLeadField(lead.id, 'lead_priority', v)}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <button
                        onClick={() => openDraftForLead(lead)}
                        className="text-xs px-2 py-1 rounded border hover:bg-muted transition-colors whitespace-nowrap"
                        title="Draft email"
                      >
                        Draft
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {showAddModal && (
        <AddLeadModal
          onClose={() => setShowAddModal(false)}
          onAdded={(newLeads) => setLeads((prev) => [...newLeads, ...prev])}
        />
      )}

      {panelLeads.length > 0 && (
        <MessagePanel
          leads={panelLeads}
          index={panelIndex}
          onNext={handlePanelNext}
          onClose={handlePanelClose}
        />
      )}
    </div>
  )
}
