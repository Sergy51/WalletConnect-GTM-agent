'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { AddLeadModal } from '@/components/add-lead-modal'
import { MessagePanel } from '@/components/message-panel'
import { DashboardTab } from '@/components/dashboard-tab'
import { INDUSTRIES, LEAD_TYPES, WC_VALUE_PROPS } from '@/lib/constants'
import type { Lead, LeadStatus } from '@/types'

const STATUS_OPTIONS: LeadStatus[] = ['New', 'Enriched', 'Contacted', 'Proposal', 'Negotiating', 'Won', 'Lost', 'Churned']

const STATUS_RANK: Record<string, number> = {
  Won: 0,
  Negotiating: 1,
  Proposal: 2,
  Contacted: 3,
  Enriched: 4,
  New: 5,
  Lost: 6,
  Churned: 7,
}

function sortLeads(leads: Lead[]): Lead[] {
  return [...leads].sort((a, b) => {
    const rankDiff = (STATUS_RANK[a.lead_status] ?? 5) - (STATUS_RANK[b.lead_status] ?? 5)
    if (rankDiff !== 0) return rankDiff
    return a.company.localeCompare(b.company)
  })
}
const TYPE_OPTIONS = LEAD_TYPES
const PRIORITY_OPTIONS = ['High', 'Medium'] as const

const STATUS_COLORS: Record<string, string> = {
  New: 'bg-slate-100 text-slate-700',
  Enriched: 'bg-blue-100 text-blue-700',
  Contacted: 'bg-orange-100 text-orange-700',
  Proposal: 'bg-purple-100 text-purple-700',
  Negotiating: 'bg-yellow-100 text-yellow-700',
  Won: 'bg-green-100 text-green-700',
  Lost: 'bg-red-100 text-red-700',
  Churned: 'bg-gray-100 text-gray-500',
}

const PRIORITY_COLORS: Record<string, string> = {
  High: 'bg-orange-100 text-orange-700',
  Medium: 'bg-yellow-100 text-yellow-700',
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

function Spinner() {
  return <div className="inline-block h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin opacity-60" />
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
          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function KeyVpCell({ value }: { value: string | null }) {
  if (!value) return <span className="text-muted-foreground">—</span>
  const vps = value.split(',').map(v => v.trim()).filter(Boolean)
  return (
    <div className="flex flex-wrap gap-1">
      {vps.map(vp => (
        <span key={vp} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap ${VP_COLORS[vp] || 'bg-gray-100 text-gray-600'}`}>
          {vp}
        </span>
      ))}
    </div>
  )
}

interface InlineEditCellProps {
  value: string | null
  leadId: string
  field: string
  placeholder?: string
  maxWidth?: string
  multiline?: boolean
  textClassName?: string
  onSave: (id: string, field: string, val: string) => void
}

function InlineEditCell({ value, leadId, field, placeholder = '—', maxWidth = '140px', multiline = false, textClassName = '', onSave }: InlineEditCellProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  function start() { setDraft(value || ''); setEditing(true) }
  function commit() {
    setEditing(false)
    if (draft !== (value || '')) onSave(leadId, field, draft)
  }

  if (editing) {
    if (multiline) {
      return (
        <textarea
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Escape') { setEditing(false); setDraft(value || '') } }}
          rows={3}
          className="text-xs px-1 py-0.5 border border-blue-400 rounded w-full min-w-[120px] bg-background outline-none resize-none"
        />
      )
    }
    return (
      <input
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') { setEditing(false); setDraft(value || '') }
        }}
        className="text-xs px-1 py-0.5 border border-blue-400 rounded w-full min-w-[80px] bg-background outline-none"
      />
    )
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={start}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') start() }}
      className="cursor-pointer text-left w-full hover:bg-muted/40 rounded px-0.5 -mx-0.5 min-h-[1.25rem] flex items-center"
      title="Click to edit"
    >
      {value
        ? <span className={`truncate block ${textClassName}`} style={{ maxWidth }}>{value}</span>
        : <span className="text-muted-foreground">{placeholder}</span>
      }
    </div>
  )
}

function InlineKeyVpCell({ value, leadId, onSave }: { value: string | null; leadId: string; onSave: (id: string, field: string, val: string) => void }) {
  const [open, setOpen] = useState(false)
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  const selected = value ? value.split(',').map(v => v.trim()).filter(Boolean) : []

  function openMenu() {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setDropPos({ top: rect.bottom + 2, left: rect.left })
    }
    setOpen(true)
  }

  function toggle(vp: string) {
    let next: string[]
    if (selected.includes(vp)) {
      next = selected.filter(v => v !== vp)
    } else if (selected.length < 2) {
      next = [...selected, vp]
    } else {
      return
    }
    onSave(leadId, 'key_vp', next.join(', '))
  }

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      const target = e.target as Node
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        dropRef.current && !dropRef.current.contains(target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  return (
    <>
      <div
        ref={triggerRef}
        role="button"
        tabIndex={0}
        onClick={openMenu}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') openMenu() }}
        className="cursor-pointer w-full hover:bg-muted/40 rounded min-h-[1.25rem] py-0.5"
      >
        <KeyVpCell value={value} />
      </div>
      {open && (
        <div
          ref={dropRef}
          style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, zIndex: 9999 }}
          className="bg-background border rounded-lg shadow-lg p-2 w-52"
        >
          <div className="text-[10px] text-muted-foreground mb-1.5 px-1">
            Select up to 2 · {selected.length}/2 selected
          </div>
          {WC_VALUE_PROPS.map(({ key: vp }) => {
            const isSelected = selected.includes(vp)
            const isDisabled = !isSelected && selected.length >= 2
            return (
              <label
                key={vp}
                className={`flex items-center gap-2 px-1.5 py-1 rounded text-xs ${
                  isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-muted/50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={isDisabled}
                  onChange={() => toggle(vp)}
                  className="rounded"
                />
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${VP_COLORS[vp] || 'bg-gray-100 text-gray-600'}`}>
                  {vp}
                </span>
              </label>
            )
          })}
        </div>
      )}
    </>
  )
}

export default function HomePage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [enriching, setEnriching] = useState<Set<string>>(new Set())
  const [showAddModal, setShowAddModal] = useState(false)
  const [panelLeads, setPanelLeads] = useState<Lead[]>([])
  const [panelIndex, setPanelIndex] = useState(0)
  const [showApolloDialog, setShowApolloDialog] = useState(false)
  const [activeTab, setActiveTab] = useState<'leads' | 'dashboard'>('leads')
  const apolloEnabled = process.env.NEXT_PUBLIC_APOLLO_ENABLED === 'true'

  const fetchLeads = useCallback(async () => {
    try {
      const res = await fetch('/api/leads')
      if (!res.ok) throw new Error('Failed to fetch leads')
      const data: Lead[] = await res.json()
      setLeads(sortLeads(data))
    } catch {
      toast.error('Failed to load leads')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    setSelected(selected.size === leads.length ? new Set() : new Set(leads.map(l => l.id)))
  }

  async function updateLeadField(id: string, field: string, value: string) {
    setLeads(prev => sortLeads(prev.map(l => l.id === id ? { ...l, [field]: value } : l)))
    try {
      const res = await fetch(`/api/update-lead/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
      if (!res.ok) { toast.error('Failed to update lead'); fetchLeads() }
    } catch {
      toast.error('Failed to update lead')
      fetchLeads()
    }
  }

  function handleEnrichClick() {
    const toEnrich = selected.size > 0
      ? leads.filter(l => selected.has(l.id))
      : leads.filter(l => l.lead_status === 'New')

    if (toEnrich.length === 0) { toast.info('No leads to enrich'); return }

    if (apolloEnabled) {
      setShowApolloDialog(true)
    } else {
      enrichLeads(false)
    }
  }

  async function enrichLeads(useApollo: boolean) {
    setShowApolloDialog(false)
    const toEnrich = selected.size > 0
      ? leads.filter(l => selected.has(l.id))
      : leads.filter(l => l.lead_status === 'New')

    if (toEnrich.length === 0) { toast.info('No leads to enrich'); return }

    const ids = toEnrich.map(l => l.id)
    setEnriching(new Set(ids))

    const results: Array<{ id: string; success: boolean; error?: string }> = []
    for (const id of ids) {
      try {
        const res = await fetch(`/api/qualify/${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ useApollo }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          results.push({ id, success: false, error: err.error || `HTTP ${res.status}` })
        } else {
          const updated: Lead = await res.json()
          setLeads(prev => sortLeads(prev.map(l => l.id === id ? updated : l)))
          results.push({ id, success: true })
        }
      } catch (e) {
        results.push({ id, success: false, error: e instanceof Error ? e.message : 'Unknown error' })
      } finally {
        setEnriching(prev => { const next = new Set(prev); next.delete(id); return next })
      }
    }

    const succeeded = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length
    if (succeeded > 0) toast.success(`Enriched ${succeeded} lead${succeeded !== 1 ? 's' : ''}`)
    if (failed > 0) toast.error(`${failed} lead${failed !== 1 ? 's' : ''} failed to enrich`)
  }

  async function deleteAllLeads() {
    if (!window.confirm('Delete ALL leads? This cannot be undone.')) return
    try {
      const res = await fetch('/api/leads', { method: 'DELETE' })
      if (!res.ok) { toast.error('Failed to delete leads'); return }
      const { deleted } = await res.json()
      setLeads([])
      setSelected(new Set())
      toast.success(`Deleted ${deleted} lead${deleted !== 1 ? 's' : ''}`)
    } catch {
      toast.error('Failed to delete leads')
    }
  }

  async function deleteSelectedLeads() {
    const count = selected.size
    if (!window.confirm(`Delete ${count} selected lead${count !== 1 ? 's' : ''}? This cannot be undone.`)) return
    const ids = [...selected]
    try {
      await Promise.all(ids.map(id => fetch(`/api/update-lead/${id}`, { method: 'DELETE' }).catch(() => null)))
      setLeads(prev => prev.filter(l => !selected.has(l.id)))
      setSelected(new Set())
      toast.success(`Deleted ${count} lead${count !== 1 ? 's' : ''}`)
    } catch {
      toast.error('Failed to delete leads')
    }
  }

  function openDraftPanel() {
    const selectedLeads = leads.filter(l => selected.has(l.id))
    if (selectedLeads.length === 0) return
    setPanelLeads(selectedLeads)
    setPanelIndex(0)
  }

  function openPanelForSingleLead(lead: Lead) {
    setPanelLeads([lead])
    setPanelIndex(0)
  }

  function handlePanelClose() {
    setPanelLeads([])
    setPanelIndex(0)
    fetchLeads()
  }

  function handleNavigateToLead(leadId: string) {
    setActiveTab('leads')
    const lead = leads.find(l => l.id === leadId)
    if (lead) setPanelLeads([lead])
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
          <Button variant="outline" size="sm" onClick={handleEnrichClick} disabled={enriching.size > 0}>
            {enriching.size > 0
              ? <span className="flex items-center gap-1.5"><Spinner /> Enriching...</span>
              : selected.size > 0 ? `Enrich (${selected.size})` : 'Enrich New'}
          </Button>
          <Button size="sm" variant="outline" onClick={openDraftPanel} disabled={selected.size === 0}>
            Draft Emails{selected.size > 0 ? ` (${selected.size})` : ''}
          </Button>
          <Button size="sm" onClick={() => setShowAddModal(true)}>Add Lead</Button>
          <Button size="sm" variant="outline"
            onClick={selected.size > 0 ? deleteSelectedLeads : deleteAllLeads}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200">
            {selected.size > 0 ? `Delete (${selected.size})` : 'Delete All'}
          </Button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center border-b shrink-0 px-4 bg-background">
        {(['leads', 'dashboard'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`capitalize text-sm px-3 py-2 border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-foreground font-medium text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >{tab}</button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'leads' ? (
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">Loading leads...</div>
          ) : leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm gap-2">
              <p>No leads yet.</p>
              <Button size="sm" onClick={() => setShowAddModal(true)}>Add your first lead</Button>
            </div>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur-sm">
                <tr className="border-b">
                  {/* Sticky columns */}
                  <th className="sticky left-0 z-20 bg-muted/90 px-2 py-2.5 w-8 text-left">
                    <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="rounded" />
                  </th>
                  <th className="sticky left-8 z-20 bg-muted/90 px-2 py-2.5 text-left font-medium whitespace-nowrap min-w-[120px]">Company</th>
                  <th className="sticky left-[152px] z-20 bg-muted/90 px-2 py-2.5 text-left font-medium whitespace-nowrap">Type</th>
                  {/* Scrollable columns */}
                  <th className="px-2 py-2.5 text-left font-medium whitespace-nowrap">Website</th>
                  <th className="px-2 py-2.5 text-left font-medium whitespace-nowrap">Industry</th>
                  <th className="px-2 py-2.5 text-left font-medium whitespace-nowrap">Emp.</th>
                  <th className="px-2 py-2.5 text-left font-medium whitespace-nowrap">Rev.</th>
                  <th className="px-2 py-2.5 text-left font-medium whitespace-nowrap">Contact</th>
                  <th className="px-2 py-2.5 text-left font-medium whitespace-nowrap">Role</th>
                  <th className="px-2 py-2.5 text-left font-medium whitespace-nowrap">Email</th>
                  <th className="px-2 py-2.5 text-left font-medium whitespace-nowrap">LinkedIn</th>
                  <th className="px-2 py-2.5 text-left font-medium whitespace-nowrap">Status</th>
                  <th className="px-2 py-2.5 text-left font-medium whitespace-nowrap">Crypto Priority</th>
                  <th className="px-2 py-2.5 text-left font-medium whitespace-nowrap">Key VP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {leads.map((lead) => {
                  const isSelected = selected.has(lead.id)
                  const isEnriching = enriching.has(lead.id)

                  return (
                    <tr key={lead.id}
                      className={`hover:bg-muted/30 transition-colors ${isSelected ? 'bg-blue-50/50' : ''} ${isEnriching ? 'opacity-60' : ''}`}
                    >
                      {/* Sticky cells */}
                      <td className={`sticky left-0 z-10 px-2 py-1.5 w-8 ${isSelected ? 'bg-blue-50/90' : 'bg-background'}`}>
                        {isEnriching ? <Spinner /> : (
                          <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(lead.id)} className="rounded" />
                        )}
                      </td>
                      <td className={`sticky left-8 z-10 px-2 py-1.5 font-medium min-w-[120px] max-w-[160px] ${isSelected ? 'bg-blue-50/90' : 'bg-background'}`}>
                        <button
                          onClick={() => openPanelForSingleLead(lead)}
                          className="truncate block text-left text-blue-600 hover:underline font-medium w-full"
                          title={`Open ${lead.company}`}
                        >
                          {lead.company}
                        </button>
                      </td>
                      <td className={`sticky left-[152px] z-10 px-2 py-1.5 ${isSelected ? 'bg-blue-50/90' : 'bg-background'}`}>
                        <InlineSelect value={lead.lead_type} options={TYPE_OPTIONS} onChange={v => updateLeadField(lead.id, 'lead_type', v)} />
                      </td>

                      {/* Scrollable cells */}
                      <td className="px-2 py-1.5">
                        {lead.company_website
                          ? <a href={lead.company_website} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline font-medium">Website</a>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-2 py-1.5">
                        <InlineSelect value={lead.industry} options={INDUSTRIES} onChange={v => updateLeadField(lead.id, 'industry', v)} />
                      </td>
                      <td className="px-2 py-1.5">
                        <InlineEditCell value={lead.company_size_employees} leadId={lead.id} field="company_size_employees" maxWidth="70px" onSave={updateLeadField} />
                      </td>
                      <td className="px-2 py-1.5">
                        <InlineEditCell value={lead.company_size_revenue} leadId={lead.id} field="company_size_revenue" maxWidth="80px" onSave={updateLeadField} />
                      </td>
                      <td className="px-2 py-1.5">
                        <InlineEditCell value={lead.contact_name} leadId={lead.id} field="contact_name" maxWidth="120px" onSave={updateLeadField} />
                      </td>
                      <td className="px-2 py-1.5">
                        <InlineEditCell value={lead.contact_role} leadId={lead.id} field="contact_role" maxWidth="120px" onSave={updateLeadField} />
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-1">
                          <InlineEditCell
                            value={lead.contact_email}
                            leadId={lead.id}
                            field="contact_email"
                            maxWidth="120px"
                            textClassName={lead.contact_email_inferred ? 'text-orange-500' : ''}
                            onSave={updateLeadField}
                          />
                          {lead.contact_email_inferred && lead.contact_email && (
                            <span
                              className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-orange-100 text-orange-600 text-[10px] font-bold cursor-help leading-none shrink-0"
                              title="This email was AI-generated and may not be real. Verify before sending."
                            >!</span>
                          )}
                          {lead.contact_email_verified && lead.contact_email && (
                            <span
                              className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-green-100 text-green-600 text-[10px] font-bold cursor-help leading-none shrink-0"
                              title="This email was verified by Apollo.io."
                            >✓</span>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-1.5">
                        {lead.contact_linkedin
                          ? <a href={lead.contact_linkedin} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline font-medium">LinkedIn</a>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-2 py-1.5">
                        <InlineSelect value={lead.lead_status} options={STATUS_OPTIONS} colorMap={STATUS_COLORS}
                          onChange={v => updateLeadField(lead.id, 'lead_status', v)} />
                      </td>
                      <td className="px-2 py-1.5">
                        <InlineSelect value={lead.lead_priority} options={PRIORITY_OPTIONS} colorMap={PRIORITY_COLORS}
                          onChange={v => updateLeadField(lead.id, 'lead_priority', v)} />
                      </td>
                      <td className="px-2 py-1.5 min-w-[140px]">
                        <InlineKeyVpCell value={lead.key_vp} leadId={lead.id} onSave={updateLeadField} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <DashboardTab onNavigateToLead={handleNavigateToLead} />
        </div>
      )}

      {showApolloDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-background rounded-lg shadow-lg p-6 max-w-sm mx-4">
            <div className="font-medium text-sm mb-1">Use Apollo.io for email lookup?</div>
            <p className="text-xs text-muted-foreground mb-4">
              Apollo can find verified email addresses using API credits. Each enrichment uses at most 1 API call. This choice will apply to all leads in this batch.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => enrichLeads(false)}>Skip Apollo</Button>
              <Button size="sm" onClick={() => enrichLeads(true)}>Use Apollo</Button>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <AddLeadModal onClose={() => setShowAddModal(false)} onAdded={newLeads => setLeads(prev => sortLeads([...newLeads, ...prev]))} />
      )}

      {panelLeads.length > 0 && (
        <MessagePanel leads={panelLeads} index={panelIndex}
          onNext={() => setPanelIndex(i => i + 1)} onClose={handlePanelClose} />
      )}
    </div>
  )
}
