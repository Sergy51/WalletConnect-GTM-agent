'use client'

import { useState, useRef } from 'react'
import Papa from 'papaparse'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
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
  phone: 'contact_phone',
  'phone number': 'contact_phone',
  linkedin: 'contact_linkedin',
  'linkedin url': 'contact_linkedin',
  source: 'lead_source',
  'lead source': 'lead_source',
  type: 'lead_type',
  'lead type': 'lead_type',
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
  const fileRef = useRef<HTMLInputElement>(null)
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([])
  const [uploading, setUploading] = useState(false)

  const [form, setForm] = useState({
    company: '',
    company_website: '',
    contact_name: '',
    contact_role: '',
    contact_email: '',
    contact_phone: '',
    contact_linkedin: '',
    lead_source: '',
    lead_type: '',
  })

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
    if (!form.company) {
      toast.error('Company is required')
      return
    }
    setSubmitting(true)
    try {
      const payload: Record<string, string | null> = {
        company: form.company,
        company_website: form.company_website || null,
        contact_name: form.contact_name || null,
        contact_role: form.contact_role || null,
        contact_email: form.contact_email || null,
        contact_phone: form.contact_phone || null,
        contact_linkedin: form.contact_linkedin || null,
        lead_source: form.lead_source || null,
        lead_type: form.lead_type || null,
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
            <form id="manual-form" onSubmit={submitManual} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                  <label className="text-sm font-medium">Company *</label>
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
                <div className="space-y-1">
                  <label className="text-sm font-medium">Type</label>
                  <Select value={form.lead_type} onValueChange={(v) => setForm({ ...form, lead_type: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PSP">PSP</SelectItem>
                      <SelectItem value="Merchant">Merchant</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
                <div className="space-y-1">
                  <label className="text-sm font-medium">Email</label>
                  <Input
                    type="email"
                    value={form.contact_email}
                    onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                    placeholder="jane@acme.com"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Phone</label>
                  <Input
                    value={form.contact_phone}
                    onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                    placeholder="+1 555 000 0000"
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-sm font-medium">LinkedIn</label>
                  <Input
                    value={form.contact_linkedin}
                    onChange={(e) => setForm({ ...form, contact_linkedin: e.target.value })}
                    placeholder="https://linkedin.com/in/janesmith"
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-sm font-medium">Lead Source</label>
                  <Select value={form.lead_source} onValueChange={(v) => setForm({ ...form, lead_source: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Inbound">Inbound</SelectItem>
                      <SelectItem value="Outbound">Outbound</SelectItem>
                      <SelectItem value="Referral">Referral</SelectItem>
                      <SelectItem value="Event">Event</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
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
