'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Papa from 'papaparse'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { GeneratedLead } from '@/types'

interface CsvRow {
  name?: string
  email?: string
  title?: string
  company?: string
  linkedin_url?: string
  company_website?: string
  company_size?: string
  [key: string]: string | undefined
}

const FIELD_MAP: Record<string, string> = {
  'first name': 'first_name',
  'last name': 'last_name',
  name: 'name',
  'full name': 'name',
  email: 'email',
  'email address': 'email',
  title: 'title',
  'job title': 'title',
  position: 'title',
  company: 'company',
  'company name': 'company',
  organization: 'company',
  'linkedin url': 'linkedin_url',
  linkedin: 'linkedin_url',
  website: 'company_website',
  'company website': 'company_website',
  'company size': 'company_size',
  employees: 'company_size',
}

function normalizeRow(row: CsvRow) {
  const normalized: Record<string, string> = {}
  for (const [key, val] of Object.entries(row)) {
    const mappedKey = FIELD_MAP[key.toLowerCase().trim()] || key.toLowerCase().trim()
    if (val) normalized[mappedKey] = val.trim()
  }
  if (!normalized.name && (normalized.first_name || normalized.last_name)) {
    normalized.name = [normalized.first_name, normalized.last_name].filter(Boolean).join(' ')
  }
  return normalized
}

export default function NewLeadPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([])
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    name: '',
    email: '',
    title: '',
    company: '',
    company_website: '',
    linkedin_url: '',
    company_size: '',
  })

  // AI generation state
  const [companyProfile, setCompanyProfile] = useState('')
  const [decisionMakerTitles, setDecisionMakerTitles] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generatedLeads, setGeneratedLeads] = useState<GeneratedLead[]>([])
  const [selectedLeads, setSelectedLeads] = useState<Set<number>>(new Set())
  const [importingGenerated, setImportingGenerated] = useState(false)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data.map(normalizeRow).filter((r) => r.name && r.company)
        setCsvRows(rows)
        setUploading(false)
        if (rows.length === 0) {
          toast.error('No valid rows found. CSV must have at least "name" and "company" columns.')
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
      toast.success(`Saved ${saved.length} leads`)
      router.push('/leads')
    } finally {
      setSubmitting(false)
    }
  }

  async function submitManual(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.company) {
      toast.error('Name and Company are required')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || 'Failed to save lead')
        return
      }
      toast.success('Lead added')
      router.push('/leads')
    } finally {
      setSubmitting(false)
    }
  }

  async function generateLeads() {
    if (!companyProfile.trim() || !decisionMakerTitles.trim()) {
      toast.error('Fill in both fields before generating.')
      return
    }
    setGenerating(true)
    setGeneratedLeads([])
    setSelectedLeads(new Set())
    try {
      const res = await fetch('/api/generate-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyProfile, decisionMakerTitles }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || 'Generation failed')
        return
      }
      const leads: GeneratedLead[] = await res.json()
      setGeneratedLeads(leads)
      setSelectedLeads(new Set(leads.map((_, i) => i)))
      toast.success(`Generated ${leads.length} leads`)
    } finally {
      setGenerating(false)
    }
  }

  function toggleLead(index: number) {
    setSelectedLeads((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  async function importGeneratedLeads() {
    const toImport = generatedLeads.filter((_, i) => selectedLeads.has(i))
    if (toImport.length === 0) {
      toast.error('Select at least one lead to import.')
      return
    }
    setImportingGenerated(true)
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toImport),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || 'Failed to import leads')
        return
      }
      const saved = await res.json()
      toast.success(`Imported ${saved.length} leads`)
      router.push('/leads')
    } finally {
      setImportingGenerated(false)
    }
  }

  return (
    <div className="p-8 max-w-3xl space-y-10">
      <div>
        <h1 className="text-2xl font-bold">Add Leads</h1>
        <p className="text-muted-foreground mt-1">Upload a CSV, add manually, or generate with AI.</p>
      </div>

      {/* AI Generation */}
      <section className="border rounded-lg p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">AI Lead Generation</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Describe the companies you want to target and the decision-maker profiles. Claude will generate a list and search the web for relevant contacts.
          </p>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Company profile</label>
            <Textarea
              value={companyProfile}
              onChange={(e) => setCompanyProfile(e.target.value)}
              placeholder="For example: Luxury goods retailers in France with revenues between $5-10 million"
              rows={3}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Decision-maker profiles</label>
            <Textarea
              value={decisionMakerTitles}
              onChange={(e) => setDecisionMakerTitles(e.target.value)}
              placeholder="For example: Sales Lead, Head Operations, Chief Finance Officer"
              rows={2}
            />
          </div>
          <Button onClick={generateLeads} disabled={generating}>
            {generating ? 'Generating — this may take ~30 seconds...' : 'Generate Leads with AI'}
          </Button>
        </div>

        {generatedLeads.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Review the leads below. Unverified contacts (where no specific person was found on the web) are marked with ⚠. Deselect any you don&apos;t want to import.
            </p>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 w-8"></th>
                    <th className="text-left px-3 py-2 font-medium">Name</th>
                    <th className="text-left px-3 py-2 font-medium">Title</th>
                    <th className="text-left px-3 py-2 font-medium">Company</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {generatedLeads.map((lead, i) => (
                    <tr
                      key={i}
                      className={`cursor-pointer transition-colors ${selectedLeads.has(i) ? 'bg-background' : 'bg-muted/30 opacity-50'}`}
                      onClick={() => toggleLead(i)}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selectedLeads.has(i)}
                          onChange={() => toggleLead(i)}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded"
                        />
                      </td>
                      <td className="px-3 py-2">
                        {lead.is_inferred && <span className="text-amber-500 mr-1">⚠</span>}
                        {lead.name}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{lead.title || '—'}</td>
                      <td className="px-3 py-2">
                        {lead.company_website ? (
                          <a href={lead.company_website} target="_blank" rel="noopener noreferrer" className="hover:underline" onClick={(e) => e.stopPropagation()}>
                            {lead.company}
                          </a>
                        ) : lead.company}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={importGeneratedLeads} disabled={importingGenerated || selectedLeads.size === 0}>
                {importingGenerated ? 'Importing...' : `Import ${selectedLeads.size} Selected Lead${selectedLeads.size !== 1 ? 's' : ''}`}
              </Button>
              <button onClick={generateLeads} disabled={generating} className="text-sm text-muted-foreground hover:underline">
                Regenerate
              </button>
            </div>
          </div>
        )}
      </section>

      {/* CSV Upload */}
      <section className="border rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold">CSV Upload</h2>
        <p className="text-sm text-muted-foreground">
          CSV should include columns: <code className="bg-muted px-1 rounded">name</code>,{' '}
          <code className="bg-muted px-1 rounded">company</code>,{' '}
          <code className="bg-muted px-1 rounded">email</code>,{' '}
          <code className="bg-muted px-1 rounded">title</code>,{' '}
          <code className="bg-muted px-1 rounded">company_website</code>. First/last name columns are also supported.
        </p>

        <div
          className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/30 transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
          <p className="text-muted-foreground">
            {uploading ? 'Parsing CSV...' : 'Click to upload CSV'}
          </p>
        </div>

        {csvRows.length > 0 && (
          <div className="space-y-3">
            <div className="rounded-lg border overflow-hidden max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Name</th>
                    <th className="text-left px-3 py-2 font-medium">Company</th>
                    <th className="text-left px-3 py-2 font-medium">Email</th>
                    <th className="text-left px-3 py-2 font-medium">Title</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {csvRows.map((row, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2">{row.name}</td>
                      <td className="px-3 py-2">{row.company}</td>
                      <td className="px-3 py-2 text-muted-foreground">{row.email || '—'}</td>
                      <td className="px-3 py-2 text-muted-foreground">{row.title || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button onClick={submitCsv} disabled={submitting}>
              {submitting ? 'Saving...' : `Import ${csvRows.length} Leads`}
            </Button>
          </div>
        )}
      </section>

      {/* Manual Form */}
      <section className="border rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold">Manual Entry</h2>
        <form onSubmit={submitManual} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Name *</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Jane Smith"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="jane@company.com"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Title</label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="VP of Partnerships"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Company *</label>
              <Input
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                placeholder="Acme Payments Inc."
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Company Website</label>
              <Input
                value={form.company_website}
                onChange={(e) => setForm({ ...form, company_website: e.target.value })}
                placeholder="https://acmepayments.com"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">LinkedIn URL</label>
              <Input
                value={form.linkedin_url}
                onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })}
                placeholder="https://linkedin.com/in/janesmith"
              />
            </div>
            <div className="space-y-1 col-span-2">
              <label className="text-sm font-medium">Company Size</label>
              <Input
                value={form.company_size}
                onChange={(e) => setForm({ ...form, company_size: e.target.value })}
                placeholder="e.g. 50-200"
              />
            </div>
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving...' : 'Add Lead'}
          </Button>
        </form>
      </section>
    </div>
  )
}
