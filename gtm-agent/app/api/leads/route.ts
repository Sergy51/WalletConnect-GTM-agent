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
    name: lead.name,
    email: lead.email || null,
    title: lead.title || null,
    company: lead.company,
    linkedin_url: lead.linkedin_url || null,
    twitter_handle: lead.twitter_handle || null,
    company_website: lead.company_website || null,
    company_description: lead.company_description || null,
    company_size: lead.company_size || null,
    status: 'new',
  }))

  const { data, error } = await supabase.from('leads').insert(rows).select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
