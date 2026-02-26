export interface TweetResult {
  text: string
  url: string
}

async function exaSearch(query: string, options: Record<string, unknown> = {}): Promise<Array<{ title: string; text?: string; url: string }>> {
  const apiKey = process.env.EXA_API_KEY
  if (!apiKey) return []

  try {
    const response = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({
        query,
        num_results: 3,
        use_autoprompt: false,
        contents: { text: { max_characters: 600 } },
        ...options,
      }),
    })
    if (!response.ok) return []
    const data = await response.json()
    return data.results || []
  } catch {
    return []
  }
}

/** Returns true only for actual social media domains we want in this section. */
function isSocialDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '')
    return hostname === 'twitter.com' || hostname === 'x.com' || hostname === 'linkedin.com'
  } catch {
    return false
  }
}

/**
 * Cleans raw Exa text for a social media result.
 * - LinkedIn posts are often login-walled — detect and prefer the title instead
 * - Decodes HTML entities, strips navigation boilerplate, trims to 220 chars
 */
function cleanText(raw: string, title: string, url: string): string | null {
  const isLinkedIn = url.includes('linkedin.com')

  // LinkedIn login wall — always use the title
  if (isLinkedIn && (raw.startsWith('Agree & Join') || raw.includes('Sign in to view') || raw.includes('Skip to main content'))) {
    return title && title.length > 10 ? title : null
  }

  let text = raw
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')

  // Drop lines dominated by bracket nav tokens (e.g. [Sign Up] [Login] [Skip])
  const lines = text.split('\n').filter(line => {
    const bracketTokens = (line.match(/\[[^\]]{1,40}\]/g) || []).length
    const words = line.trim().split(/\s+/).length
    if (bracketTokens > 3 && bracketTokens / words > 0.4) return false
    if (/^#{1,3}\s/.test(line.trim()) && words < 6) return false
    return line.trim().length > 0
  })

  text = lines.join(' ').replace(/\s+/g, ' ').trim()

  // Still too noisy — fall back to title
  const noisyBrackets = (text.slice(0, 300).match(/\[[^\]]{1,40}\]/g) || []).length
  if (noisyBrackets > 5 || text.includes('`` ``')) {
    return title && title.length > 10 ? title : null
  }

  if (text.length > 220) {
    text = text.slice(0, 220).replace(/\s+\S*$/, '') + '…'
  }

  return text.length > 20 ? text : (title.length > 10 ? title : null)
}

export async function searchRelevantTweets(
  company: string,
  contactName?: string | null,
  secondaryContactName?: string | null
): Promise<TweetResult[]> {
  if (!process.env.EXA_API_KEY) return []

  const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const twitterOptions = {
    includeDomains: ['twitter.com', 'x.com'],
    start_published_date: startDate,
    num_results: 3,
  }

  const queries: string[] = [
    `"${company}" payments crypto stablecoin blockchain digital assets`,
  ]
  if (contactName) queries.push(`"${contactName}" payments crypto blockchain`)
  if (secondaryContactName) queries.push(`"${secondaryContactName}" payments crypto blockchain`)

  try {
    const batches = await Promise.all(
      queries.slice(0, 3).map(q => exaSearch(q, twitterOptions))
    )

    const seen = new Set<string>()
    const results: TweetResult[] = []

    for (const batch of batches) {
      for (const r of batch) {
        if (seen.has(r.url)) continue
        seen.add(r.url)
        // Strictly reject anything that isn't twitter.com, x.com, or linkedin.com
        if (!isSocialDomain(r.url)) continue
        const cleaned = cleanText(r.text || '', r.title || '', r.url)
        if (cleaned) results.push({ text: cleaned, url: r.url })
      }
    }

    const top = results.slice(0, 5)
    console.log(`[Twitter] ${company}: ${top.length} results`, top.map(t => t.text.slice(0, 80)))
    return top
  } catch {
    return []
  }
}
