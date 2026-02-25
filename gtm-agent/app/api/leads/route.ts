import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const body = await request.json()

  // Support both single lead and array of leads
  const leads = Array.isArray(body) ? body : [body]

  const rows = leads.map((lead) => ({
    company: lead.company,
    company_website: lead.company_website || null,
    lead_type: lead.lead_type || null,
    industry: lead.industry || null,
    company_size_employees: lead.company_size_employees || null,
    company_size_revenue: lead.company_size_revenue || null,
    contact_name: lead.contact_name || null,
    contact_role: lead.contact_role || null,
    contact_email: lead.contact_email || null,
    contact_phone: lead.contact_phone || null,
    contact_linkedin: lead.contact_linkedin || null,
    lead_source: lead.lead_source || null,
    lead_status: 'New',
    payments_stack: lead.payments_stack || null,
    crypto_capabilities: lead.crypto_capabilities || null,
    estimated_yearly_volumes: lead.estimated_yearly_volumes || null,
    strategic_priorities: lead.strategic_priorities || null,
    lead_priority: lead.lead_priority || null,
    company_description: lead.company_description || null,
    walletconnect_value_prop: lead.walletconnect_value_prop || null,
  }))

  const { data, error } = await supabase.from('leads').insert(rows).select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
