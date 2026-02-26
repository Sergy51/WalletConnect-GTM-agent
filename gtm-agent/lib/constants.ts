export const INDUSTRIES = [
  'Payment Processing & Acquiring',
  'Banking & Financial Services',
  'Fintech & Neobanks',
  'E-commerce & Retail',
  'Marketplaces & Platforms',
  'Gaming & Digital Entertainment',
  'Travel & Hospitality',
  'Healthcare & Wellness',
  'Real Estate & PropTech',
  'Logistics & Supply Chain',
  'SaaS & Enterprise Software',
  'Media & Content',
  'Education & EdTech',
  'Telecommunications',
  'Other',
] as const

export type Industry = (typeof INDUSTRIES)[number]

export const WC_VALUE_PROPS = [
  {
    key: 'Lower Fees',
    description: '0.5–1% vs 2.5–3.5% for cards — direct margin improvement on every transaction',
  },
  {
    key: 'Instant Settlement',
    description: 'Funds settle in seconds, not 1–3 days (cards) or 30+ days (some APMs)',
  },
  {
    key: 'Global Reach',
    description: '500M+ reachable wallet users across 700+ wallets — no card network required',
  },
  {
    key: 'Compliance',
    description: 'Enables travel rule compliance and sanctions screening — reduces regulatory risk for PSPs operating across jurisdictions',
  },
  {
    key: 'New Volumes',
    description: 'Attracts new crypto-native customers and unlocks larger basket sizes — crypto purchases average 15–20% higher than card transactions',
  },
  {
    key: 'Single API',
    description: 'One integration with built-in KYC/AML compliance, plugs into existing PSP stacks',
  },
] as const

export type ValuePropKey = (typeof WC_VALUE_PROPS)[number]['key']
