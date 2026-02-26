export type LeadStatus =
  | 'New'
  | 'Enriched'
  | 'Contacted'
  | 'Proposal'
  | 'Negotiating'
  | 'Won'
  | 'Lost'
  | 'Churned'

export interface Lead {
  id: string
  // Company
  company: string
  company_website: string | null
  lead_type: 'PSP' | 'Merchant' | 'Other' | null
  industry: string | null
  company_size_employees: string | null
  company_size_revenue: string | null
  // Contact
  contact_name: string | null
  contact_role: string | null
  contact_email: string | null
  contact_email_inferred: boolean
  contact_phone: string | null
  contact_linkedin: string | null
  // Qualification
  lead_source: 'Inbound' | 'Outbound' | 'Referral' | 'Event' | null
  lead_status: LeadStatus
  payments_stack: string | null
  estimated_yearly_volumes: string | null
  strategic_priorities: string | null
  lead_priority: 'Very High' | 'High' | 'Medium' | 'Low' | null
  key_vp: string | null
  // Secondary contact
  secondary_contact_name: string | null
  secondary_contact_email: string | null
  secondary_contact_linkedin: string | null
  // Internal
  company_description: string | null
  walletconnect_value_prop: string | null
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  lead_id: string
  platform: 'email' | 'linkedin'
  subject: string | null
  body: string
  version: number
  sent_at: string | null
  follow_up_1_due: string | null
  follow_up_2_due: string | null
  follow_up_1_body: string | null
  follow_up_2_body: string | null
  created_at: string
}

export interface OutreachLog {
  id: string
  lead_id: string
  message_id: string | null
  action: 'sent' | 'opened' | 'replied' | 'bounced' | 'follow_up_sent'
  timestamp: string
  notes: string | null
}
