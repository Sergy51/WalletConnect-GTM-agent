export const LEAD_TYPES = [
  'Aggregators & Platforms',
  'Bank-based & Open Banking PSPs',
  'Card Networks and Infrastructure',
  'Merchant',
  'Payment Method Aggregators & Commerce Platforms',
  'Payment Gateways, Processors, & Orchestration Platforms',
  'Payment Service Provider',
  'Wallets & Alternative Payment Methods',
  'Crypto Infrastructure',
  'Other',
] as const

export const INDUSTRIES = [
  'PSPs & Acquirers',
  'Banks & FIs',
  'Fintech & Neobanks',
  'E-commerce & Retail',
  'Marketplaces & Platforms',
  'Gaming & Entertainment',
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

export const NON_MERCHANT_VALUE_PROPS = [
  {
    key: 'Integration Simplicity',
    description: 'Single APM-like integration — no changes to settlement or reconciliation flows',
    emailContext: 'WC Pay plugs directly into existing PSP stacks as a familiar APM — single API integration, no crypto-specific logic needed, no changes to settlement or reconciliation. PSPs can add crypto to all their merchants without building anything in-house. Payment intent locking eliminates wrong-chain errors and user mistakes.',
  },
  {
    key: 'Compliance',
    description: 'Built-in travel rule compliance and sanctions screening across jurisdictions',
    emailContext: 'WC Pay has built-in travel rule compliance and sanctions screening — performed automatically on every transaction before settlement. This removes the regulatory burden from PSPs operating across jurisdictions. Most competing crypto payment solutions lack this entirely, forcing PSPs to build or license compliance separately.',
  },
  {
    key: 'Widest Coverage',
    description: '700+ wallets and 500M+ reachable users — largest crypto payment network',
    emailContext: 'WC Pay connects to 700+ wallets reaching 500M+ users globally — the largest crypto payment network. Any wallet, any asset, any chain. Works both online and at POS via QR code. This means merchants get access to the entire crypto user base through a single integration, not just users of one wallet or chain.',
  },
  {
    key: 'Modular',
    description: 'Bring your own on/off-ramp, compliance, or KYC tools — fits into existing PSP stack',
    emailContext: 'WC Pay is modular by design — PSPs can bring their own on/off-ramp, compliance, or KYC tools. In Flow Type 2, settlement lands as stablecoin in a transit account and the partner handles their own offramp and fiat conversion, letting them charge their own margin. This preserves existing partner relationships and revenue streams.',
  },
  {
    key: 'Fee Predictability',
    description: 'Transparent, predictable fee structure — no hidden interchange or scheme fees',
    emailContext: 'WC Pay pricing is all-inclusive and transparent: $0.12 + 80bps per transaction covers gas sponsorship, swap/bridging fees, compliance screening, off-ramping, and settlement. No hidden interchange or scheme fees. PSPs and referral partners can configure additional fees on top. Compare this to card networks at 2.5–3.5% with opaque interchange tiers.',
  },
] as const

export const MERCHANT_VALUE_PROPS = [
  {
    key: 'Faster Settlement',
    description: 'Funds settle in seconds, not 1–3 days (cards) or 30+ days (some APMs)',
    emailContext: 'WC Pay settles in seconds, 24/7 — compared to 2–3 days for Visa/MC, 1–2 days for SEPA, or 3–5 days for ACH. No business-hours dependency. Merchants get instant access to funds, improving cash flow and reducing working capital needs. Settlement can be in fiat (to bank) or crypto (to wallet).',
  },
  {
    key: 'Lower Fees',
    description: '0.5–1% vs 2.5–3.5% for cards — direct margin improvement on every transaction',
    emailContext: 'WC Pay fees are 0.5–1.0% per transaction (all-inclusive) vs 2.5–3.5% for card networks or 2.29–4.5% for PayPal. On every transaction, the merchant keeps more margin. No chargebacks. Pricing covers gas, swaps, compliance, and settlement — no hidden fees.',
  },
  {
    key: 'New Volumes',
    description: 'Attracts crypto-native customers and unlocks higher average order values',
    emailContext: 'Crypto card spending grew 525% in 2025. Crypto customers have 15–25% higher average order values than traditional customers. WC Pay gives merchants access to 500M+ wallet users globally — a customer segment that is growing fast and spending more. Particularly strong in gaming, digital goods, luxury, travel, and real estate where cards struggle.',
  },
  {
    key: 'Best-in-Class UX',
    description: 'One-tap checkout across 700+ wallets — seamless buyer experience',
    emailContext: 'WC Pay eliminates the poor UX of existing crypto payments — no copy-paste addresses, no wrong-chain errors. Customer scans a QR code, payment intent locks asset/chain/amount, and the transaction completes with one tap. Encrypted end-to-end wallet-to-merchant communication. Works across 700+ wallets with a consistent experience.',
  },
] as const

// Combined list for backward-compatible references
export const WC_VALUE_PROPS = [...NON_MERCHANT_VALUE_PROPS, ...MERCHANT_VALUE_PROPS]

export type ValuePropKey = (typeof WC_VALUE_PROPS)[number]['key']
