# WalletConnect Pay — Product Overview

> End-to-end crypto and stablecoin payment method for global commerce.
> CEO: Jess Houlgrave (jess@walletconnect.com)

---

## What It Is

WalletConnect Pay is an end-to-end payment method that lets businesses accept crypto and stablecoin payments — both in-store (POS) and online — via the WalletConnect wallet network, through a single integration. It is designed to plug into existing PSP (Payment Service Provider) stacks as an Alternative Payment Method (APM).

---

## Market Opportunity

- Crypto card spending grew **525%** in 2025
- Crypto customers have **15–25% higher AOV** than traditional customers
- Strong fit for sectors where cards struggle: gaming, digital goods, luxury, travel, real estate
- Emerging markets with low card penetration are seeing accelerating stablecoin adoption

### Current Pain Points (What WC Pay Solves)

- Poor UX in existing crypto payments (copy-paste addresses, wrong-chain errors)
- Fragmentation across wallets, assets, tokens, and chains
- Most crypto payment solutions lack compliance (sanctions screening, travel rule)
- Fiat settlement requires licensed partners and complex infrastructure
- Long build times for PSPs wanting to add crypto

---

## Product — Key Value Props

- **Seamless**: Fits directly into existing PSP payment stacks as a familiar APM
- **Proven**: Built on WalletConnect network, trusted by millions of users
- **Scalable**: $400B+ volume processed through WalletConnect infrastructure in 2025

### What It Delivers

| Pillar | Details |
|---|---|
| **Growth** | Any wallet, any asset; 700+ wallets, 500M+ users; works globally (POS + online); built-in user incentives |
| **Simplicity** | Single APM-style integration; no crypto-specific logic needed; no changes to settlement/reconciliation; compliance built in |
| **Trust** | Built on WalletConnect network; clear payment states; APM-like behavior for PSP-grade reliability |
| **Cost** | Lower acceptance costs than card networks; fast, predictable settlement; transparent fees |

---

## How It Works

### Flow Type 1 — WC Pay Handles Offramp

1. **PSP** creates payment via API integration
2. **Merchant** displays QR code
3. **Buyer** scans QR and opens wallet
4. **User wallet** signs transaction → WC Pay performs **travel rule & sanctions screening**
5. WC Pay executes **swap/asset conversion**
6. Funds go to **transit account** → **offramp** (fiat conversion) → **fees** deducted
7. **Payout** to merchant bank (fiat) OR merchant wallet (crypto)

### Flow Type 2 — Partner-Managed Offramp

- Steps 1–6 same as above, but settlement lands as **stablecoin in transit account**
- **Handoff point**: stablecoin goes to partner
- Partner handles their own offramp (fiat conversion) and payout to merchant bank
- Partner can charge their own offramp margin/fee

### POS Experience

- Merchant initiates payment on POS device
- Customer scans QR code with their mobile wallet
- Payment intent locks asset, chain, and amount (no user error possible)
- Encrypted end-to-end wallet-to-merchant communication

---

## Competitive Positioning

### vs Traditional Rails (Visa/MC, SEPA, ACH, PayPal)

| | Visa/MC | SEPA | ACH | PayPal | **WC Pay** |
|---|---|---|---|---|---|
| Crypto | No | No | No | Limited | **Any asset** |
| Region | Global | Europe | US | Global | **Global** |
| Speed | 2–3 days | 1–2 days | 3–5 days | Instant | **Seconds** |
| Availability | Business hrs | Business hrs | Business hrs | 24/7 | **24/7** |
| Fees | 2.5–3.5% | 0.2–0.5% | 0.5–1.5% | 2.29–4.5% | **0.5–1.0%** |

### vs Other Crypto Solutions & Building In-House

WC Pay differentiates with: built-in compliance, best-in-class UX, purpose-built for PSP stacks, widest wallet coverage (700+ wallets), future-proofed for new chains/assets, modular (bring your own offramp), encrypted comms, and payment intent locking (no user errors).

---

## Commercial Model

- **Pricing**: Volume-based, starting at **$0.12 + 80bps per transaction**
- **All-inclusive** — covers gas sponsorship, swap/bridging fees, compliance screening, off-ramping, and settlement
- PSPs and referral partners can configure additional fees on top
- Transparent and predictable fee structure

---

## Key Stats & Proof Points

- **700+** wallets supported
- **500M+** users reachable
- **$400B+** volume on WalletConnect infrastructure in 2025
- **525%** growth in crypto card spending (2025)
- **15–25%** higher AOV from crypto customers
- Settlement in **seconds**, available **24/7**
