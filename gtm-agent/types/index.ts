export type LeadStatus =
  | 'new'
  | 'qualified'
  | 'message_drafted'
  | 'sent'
  | 'followed_up'
  | 'responded'
  | 'not_interested'

export interface Lead {
  id: string
  name: string
  email: string | null
  title: string | null
  company: string
  linkedin_url: string | null
  twitter_handle: string | null
  company_website: string | null
  company_description: string | null
  company_size: string | null
  walletconnect_value_prop: string | null
  recent_news: string | null
  enrichment_confidence: 'high' | 'low' | null
  icp_segment: string | null
  fit_score: 'High' | 'Medium' | 'Low' | null
  fit_reason: string | null
  status: LeadStatus
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  lead_id: string
  platform: 'email' | 'linkedin' | 'twitter'
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

export interface FunnelStats {
  total: number
  qualified: number
  message_drafted: number
  sent: number
  responded: number
}

export interface GeneratedLead {
  name: string
  email: string | null
  title: string | null
  company: string
  company_website: string | null
  company_size: string | null
  linkedin_url: string | null
  is_inferred: boolean
}
