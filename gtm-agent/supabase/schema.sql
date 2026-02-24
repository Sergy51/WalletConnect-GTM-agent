-- WalletConnect GTM Agent — Supabase Schema
-- Run this in the Supabase SQL editor: https://supabase.com/dashboard

-- Leads table
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  title text,
  company text NOT NULL,
  linkedin_url text,
  twitter_handle text,
  company_website text,
  company_description text,
  company_size text,
  walletconnect_value_prop text,
  recent_news text,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  platform text NOT NULL,
  subject text,
  body text NOT NULL,
  version int DEFAULT 1,
  sent_at timestamptz,
  follow_up_1_due timestamptz,
  follow_up_2_due timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Outreach log table
CREATE TABLE IF NOT EXISTS outreach_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  message_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  action text NOT NULL,
  timestamp timestamptz DEFAULT now(),
  notes text
);

-- Auto-update updated_at on leads
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS leads_status_idx ON leads(status);
CREATE INDEX IF NOT EXISTS messages_lead_id_idx ON messages(lead_id);
CREATE INDEX IF NOT EXISTS outreach_log_lead_id_idx ON outreach_log(lead_id);
CREATE INDEX IF NOT EXISTS messages_follow_up_1_due_idx ON messages(follow_up_1_due);
CREATE INDEX IF NOT EXISTS messages_follow_up_2_due_idx ON messages(follow_up_2_due);
