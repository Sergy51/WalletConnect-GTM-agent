'use client'

import { useState, useRef } from 'react'
import Papa from 'papaparse'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { INDUSTRIES, WC_VALUE_PROPS } from '@/lib/constants'
import type { Lead } from '@/types'

interface AddLeadModalProps {
  onClose: () => void
  onAdded: (leads: Lead[]) => void
}

interface CsvRow {
  [key: string]: string | undefined
}

const CSV_FIELD_MAP: Record<string, string> = {
  company: 'company',
  'company name': 'company',
  organization: 'company',
  website: 'company_website',
  'company website': 'company_website',
  url: 'company_website',
  'contact name': 'contact_name',
  'full name': 'contact_name',
  name: 'contact_name',
  'first name': 'first_name',
  'last name': 'last_name',
  role: 'contact_role',
  title: 'contact_role',
  'job title': 'contact_role',
  position: 'contact_role',
  email: 'contact_email',
  'email address': 'contact_email',
  linkedin: 'contact_linkedin',
  'linkedin url': 'contact_linkedin',
  source: 'lead_source',
  'lead source': 'lead_source',
  type: 'lead_type',
  'lead type': 'lead_type',
  industry: 'industry',
  employees: 'company_size_employees',
  headcount: 'company_size_employees',
  revenue: 'company_size_revenue',
}

const VP_COLORS: Record<string, string> = {
  'Lower Fees': 'bg-green-100 text-green-700',
  'Instant Settlement': 'bg-blue-100 text-blue-700',
  'Global Reach': 'bg-purple-100 text-purple-700',
  'Compliance': 'bg-red-100 text-red-700',
  'New Volumes': 'bg-teal-100 text-teal-700',
  'Single API': 'bg-orange-100 text-orange-700',
}

function normalizeCsvRow(row: CsvRow): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, val] of Object.entries(row)) {
    if (!val) continue
    const mapped = CSV_FIELD_MAP[key.toLowerCase().trim()] || key.toLowerCase().trim()
    result[mapped] = val.trim()
  }
  if (!result.contact_name && (result.first_name || result.last_name)) {
    result.contact_name = [result.first_name, result.last_name].filter(Boolean).join(' ')
  }
  return result
}

export function AddLeadModal({ onClose, onAdded }: AddLeadModalProps) {
  const [tab, setTab] = useState<'manual' | 'csv'>('manual')
  const [submitting, setSubmitting] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([])
  const [uploading, setUploading] = useState(false)
  const [selectedVps, setSelectedVps] = useState<string[]>([])

  const [form, setForm] = useState({
    company: '',
    company_website: '',
    contact_name: '',
    contact_role: '',
    contact_email: '',
    lead_type: '',
    industry: '',
    company_size_employees: '',
    company_size_revenue: '',
    contact_linkedin: '',
  })

  function toggleVp(vp: string) {
    setSelectedVps(prev =>
      prev.includes(vp)
        ? prev.filter(v => v !== vp)
        : prev.length < 2 ? [...prev, vp] : prev
    )
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data.map(normalizeCsvRow).filter((r) => r.company)
        setCsvRows(rows)
        setUploading(false)
        if (rows.length === 0) {
          toast.error('No valid rows found. CSV must have at least a "company" column.')
        } else {
          toast.success(`Parsed ${rows.length} leads from CSV`)
        }
      },
      error: () => {
        toast.error('Failed to parse CSV')
        setUploading(false)
      },
    })
  }

  async function submitManual(e: React.FormEvent) {
    e.preventDefault()
    if (!form.company) { toast.error('Company is required'); return }
    setSubmitting(true)
    try {
      const payload: Record<string, string | null> = {
        company: form.company,
        company_website: form.company_website || null,
        contact_name: form.contact_name || null,
        contact_role: form.contact_role || null,
        contact_email: form.contact_email || null,
        lead_type: form.lead_type || null,
        industry: form.industry || null,
        company_size_employees: form.company_size_employees || null,
        company_size_revenue: form.company_size_revenue || null,
        contact_linkedin: form.contact_linkedin || null,
        key_vp: selectedVps.length > 0 ? selectedVps.join(', ') : null,
      }
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || 'Failed to save lead')
        return
      }
      const saved = await res.json()
      toast.success('Lead added')
      onAdded(saved)
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  async function submitCsv() {
    if (csvRows.length === 0) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(csvRows),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || 'Failed to save leads')
        return
      }
      const saved = await res.json()
      toast.success(`Imported ${saved.length} leads`)
      onAdded(saved)
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Add Lead</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">&times;</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b px-6">
          <button
            onClick={() => setTab('manual')}
            className={`py-3 mr-4 text-sm font-medium border-b-2 transition-colors ${tab === 'manual' ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            Manual
          </button>
          <button
            onClick={() => setTab('csv')}
            className={`py-3 text-sm font-medium border-b-2 transition-colors ${tab === 'csv' ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            CSV Upload
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {tab === 'manual' && (
            <form id="manual-form" onSubmit={submitManual} className="space-y-3">

              {/* Upfront fields */}
              <div className="space-y-1">
                <label className="text-sm font-medium">Company <span className="text-red-500">*</span></label>
                <Input
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  placeholder="Acme Payments Inc."
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Website</label>
                <Input
                  value={form.company_website}
                  onChange={(e) => setForm({ ...form, company_website: e.target.value })}
                  placeholder="https://acme.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Contact Name</label>
                  <Input
                    value={form.contact_name}
                    onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                    placeholder="Jane Smith"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Role</label>
                  <Input
                    value={form.contact_role}
                    onChange={(e) => setForm({ ...form, contact_role: e.target.value })}
                    placeholder="VP Payments"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  value={form.contact_email}
                  onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                  placeholder="jane@acme.com"
                />
              </div>

              {/* More fields toggle */}
              <button
                type="button"
                onClick={() => setShowMore(v => !v)}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors pt-1"
              >
                <span className={`text-xs transition-transform inline-block ${showMore ? 'rotate-90' : ''}`}>▶</span>
                {showMore ? 'Fewer fields' : 'More fields'}
              </button>

              {showMore && (
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Type</label>
                      <Select value={form.lead_type} onValueChange={(v) => setForm({ ...form, lead_type: v })}>
                        <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PSP">PSP</SelectItem>
                          <SelectItem value="Merchant">Merchant</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Industry</label>
                      <Select value={form.industry} onValueChange={(v) => setForm({ ...form, industry: v })}>
                        <SelectTrigger><SelectValue placeholder="Select industry" /></SelectTrigger>
                        <SelectContent>
                          {INDUSTRIES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Employees</label>
                      <Select value={form.company_size_employees} onValueChange={(v) => setForm({ ...form, company_size_employees: v })}>
                        <SelectTrigger><SelectValue placeholder="Headcount range" /></SelectTrigger>
                        <SelectContent>
                          {['1-10', '10-100', '100-500', '500-5000', '5000+'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Revenue</label>
                      <Select value={form.company_size_revenue} onValueChange={(v) => setForm({ ...form, company_size_revenue: v })}>
                        <SelectTrigger><SelectValue placeholder="Revenue range" /></SelectTrigger>
                        <SelectContent>
                          {['<$1M', '$1-10M', '$10-100M', '$100-500M', '$500M+'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium">LinkedIn</label>
                    <Input
                      value={form.contact_linkedin}
                      onChange={(e) => setForm({ ...form, contact_linkedin: e.target.value })}
                      placeholder="linkedin.com/in/janesmith"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Key VP <span className="text-xs font-normal text-muted-foreground">(up to 2)</span></label>
                    <div className="flex flex-wrap gap-2">
                      {WC_VALUE_PROPS.map(({ key: vp }) => {
                        const isSelected = selectedVps.includes(vp)
                        const isDisabled = !isSelected && selectedVps.length >= 2
                        return (
                          <button
                            key={vp}
                            type="button"
                            disabled={isDisabled}
                            onClick={() => toggleVp(vp)}
                            className={`text-[11px] px-2 py-1 rounded-full font-medium border transition-opacity ${
                              isSelected
                                ? (VP_COLORS[vp] || 'bg-gray-100 text-gray-600') + ' border-transparent'
                                : 'bg-transparent border-border text-muted-foreground'
                            } ${isDisabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer hover:opacity-80'}`}
                          >
                            {vp}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </form>
          )}

          {tab === 'csv' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                CSV must have a <code className="bg-muted px-1 rounded">company</code> column. Optional:{' '}
                <code className="bg-muted px-1 rounded">contact_name</code>,{' '}
                <code className="bg-muted px-1 rounded">contact_email</code>,{' '}
                <code className="bg-muted px-1 rounded">company_website</code>, etc.
              </p>
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
                <p className="text-sm text-muted-foreground">
                  {uploading ? 'Parsing...' : 'Click to upload CSV'}
                </p>
              </div>

              {csvRows.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">{csvRows.length} leads parsed. Preview (first 5):</p>
                  <div className="rounded-lg border overflow-hidden text-sm max-h-48 overflow-y-auto">
                    <table className="w-full">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">Company</th>
                          <th className="text-left px-3 py-2 font-medium">Contact</th>
                          <th className="text-left px-3 py-2 font-medium">Email</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {csvRows.slice(0, 5).map((row, i) => (
                          <tr key={i}>
                            <td className="px-3 py-1.5">{row.company}</td>
                            <td className="px-3 py-1.5 text-muted-foreground">{row.contact_name || '—'}</td>
                            <td className="px-3 py-1.5 text-muted-foreground">{row.contact_email || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          {tab === 'manual' ? (
            <Button type="submit" form="manual-form" disabled={submitting}>
              {submitting ? 'Adding...' : 'Add Lead'}
            </Button>
          ) : (
            <Button onClick={submitCsv} disabled={submitting || csvRows.length === 0}>
              {submitting ? 'Importing...' : `Import ${csvRows.length} Leads`}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
