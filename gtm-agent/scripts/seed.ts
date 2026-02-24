/**
 * Seed script: inserts 5 realistic demo leads for the CEO presentation.
 * Run with: npx tsx scripts/seed.ts
 * Requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const DEMO_LEADS = [
  {
    name: 'Marcus Chen',
    email: 'mchen@strikegateway.com',
    title: 'VP of Partnerships',
    company: 'Strike Gateway',
    company_website: 'https://strikegateway.com',
    company_size: '201-500 employees',
    linkedin_url: 'https://linkedin.com/in/marcuschen',
    status: 'qualified',
    company_description:
      'Strike Gateway is a B2B payment orchestration platform serving e-commerce merchants in the US and EU, processing over $2B in annual volume through integrations with 40+ payment methods.',
    walletconnect_value_prop:
      'WalletConnect Pay would let Strike Gateway add crypto and stablecoin acceptance to their merchant stack in a single integration — charging 0.5–1.0% vs the 2.5–3% card fees, which is a direct selling point for their cost-sensitive merchant base. With 500M+ reachable wallet users, it unlocks a segment Strike Gateway currently can\'t serve.',
    recent_news:
      '- Strike Gateway raises $45M Series B to expand EU payment infrastructure\n- Launches new multi-currency settlement dashboard for enterprise merchants',
  },
  {
    name: 'Sofia Adekunle',
    email: 'sofia.a@payflowpro.io',
    title: 'Head of Product',
    company: 'PayFlow Pro',
    company_website: 'https://payflowpro.io',
    company_size: '51-200 employees',
    linkedin_url: 'https://linkedin.com/in/sofiaadekunle',
    status: 'message_drafted',
    company_description:
      'PayFlow Pro provides white-label payment infrastructure for fintech startups in sub-Saharan Africa and Southeast Asia, with a focus on mobile-first markets where card penetration is low.',
    walletconnect_value_prop:
      'In markets where PayFlow Pro operates, stablecoin payments (USDC/USDT) are already mainstream for cross-border transfers. Integrating WalletConnect Pay gives their fintech clients a regulated, low-fee settlement layer that works without local card rails — directly addressing the infrastructure gap they\'re built to solve.',
    recent_news:
      '- PayFlow Pro expands into Indonesia and Vietnam, targeting unbanked population\n- Partners with local mobile wallet providers in Nigeria',
  },
  {
    name: 'James Whitfield',
    email: 'j.whitfield@nexuspayments.co',
    title: 'CTO',
    company: 'Nexus Payments',
    company_website: 'https://nexuspayments.co',
    company_size: '501-1000 employees',
    linkedin_url: 'https://linkedin.com/in/jameswhitfield',
    status: 'new',
    company_description:
      'Nexus Payments is a UK-based PSP specializing in high-risk and gaming verticals, processing payments for iGaming, digital goods, and subscription businesses across Europe and LATAM.',
    walletconnect_value_prop:
      null,
    recent_news: null,
  },
  {
    name: 'Priya Nair',
    email: 'priya@commercestack.dev',
    title: 'CEO',
    company: 'CommerceStack',
    company_website: 'https://commercestack.dev',
    company_size: '11-50 employees',
    linkedin_url: 'https://linkedin.com/in/priyanair',
    status: 'sent',
    company_description:
      'CommerceStack builds checkout and payment tooling for luxury e-commerce brands, powering the payment experience for 200+ high-end fashion and watch retailers globally.',
    walletconnect_value_prop:
      'Luxury e-commerce buyers — particularly in Asia — increasingly prefer crypto payments for high-value purchases. WalletConnect Pay gives CommerceStack a zero-fraud-chargeback crypto checkout that settles in seconds, which is a premium differentiator for their high-ticket merchants who currently pay 2.8% on card transactions.',
    recent_news:
      '- CommerceStack launches AI-powered checkout personalization for luxury brands\n- Signs partnership with Shopify Plus to offer premium checkout to enterprise merchants',
  },
  {
    name: 'Lena Hartmann',
    email: 'lhartmann@travelpayhub.com',
    title: 'VP of Business Development',
    company: 'TravelPay Hub',
    company_website: 'https://travelpayhub.com',
    company_size: '201-500 employees',
    linkedin_url: 'https://linkedin.com/in/lenahartmann',
    status: 'new',
    company_description:
      'TravelPay Hub is a payment technology company serving online travel agencies (OTAs) and tour operators, specializing in multi-currency checkout and cross-border payment routing for travel bookings.',
    walletconnect_value_prop: null,
    recent_news: null,
  },
]

async function seed() {
  console.log('Seeding demo leads...')

  for (const lead of DEMO_LEADS) {
    const { data, error } = await supabase.from('leads').insert(lead).select().single()
    if (error) {
      console.error(`Failed to insert ${lead.name}:`, error.message)
    } else {
      console.log(`✓ ${data.name} (${data.company}) — ${data.status}`)
    }
  }

  console.log('\nDone. Open your app to see the demo leads.')
}

seed().catch(console.error)
