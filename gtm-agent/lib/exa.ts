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
        use_autoprompt: true,
        contents: { text: { max_characters: 500 } },
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

export interface NewsSource {
  title: string
  url: string
}

/**
 * Returns true for generic index/landing pages that don't represent a specific article.
 * e.g. "example.com", "example.com/news", "example.com/en/blog"
 */
function isGenericUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname.replace(/\/+$/, '')
    if (!path) return true // root domain
    const parts = path.split('/').filter(Boolean)
    const indexSegments = new Set([
      'news', 'blog', 'press', 'media', 'updates', 'articles', 'resources',
      'insights', 'newsroom', 'about', 'en', 'fr', 'de', 'nl', 'es', 'it',
      'company', 'feed', 'timeline',
    ])
    // /news or /en/news or /company/mollie (LinkedIn profile) — all generic
    if (parts.length <= 2 && parts.some(p => indexSegments.has(p.toLowerCase()))) return true
    return false
  } catch {
    return false
  }
}

export async function searchCompanyNews(
  company: string,
  website?: string | null
): Promise<{ context: string; sources: NewsSource[] }> {
  if (!process.env.EXA_API_KEY) return {
    context: 'No recent news available (Exa API key not configured).',
    sources: [],
  }

  // Payments-focused query so returned articles are relevant to WC Pay's pitch
  const query = website
    ? `"${company}" payments crypto digital assets stablecoin checkout partnerships product launch news OR site:${website}`
    : `"${company}" payments crypto digital assets stablecoin checkout partnerships product launch news`

  const results = await exaSearch(query, {
    num_results: 6, // fetch more candidates so we have room to filter
    start_published_date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    // Allow LinkedIn posts and tweets — user confirmed these are fine as sources
    exclude_domains: ['facebook.com', 'reddit.com', 'youtube.com'],
  })

  // Keep only specific articles/posts; drop root domains and category index pages
  const specific = results.filter(r => !isGenericUrl(r.url))

  if (specific.length === 0) return { context: 'No recent payments-related news found in the last 90 days.', sources: [] }

  const top = specific.slice(0, 3)
  const sources: NewsSource[] = top.map(r => ({ title: r.title, url: r.url }))
  const context = top.map(r => `- ${r.title}: ${r.text?.slice(0, 200) || ''}`).join('\n')
  return { context, sources }
}

export async function findCompanyWebsite(company: string): Promise<string | null> {
  const results = await exaSearch(`${company} official website`, {
    num_results: 5,
    use_autoprompt: false,
    contents: { text: { max_characters: 100 } },
    exclude_domains: ['linkedin.com', 'twitter.com', 'facebook.com', 'crunchbase.com', 'wikipedia.org'],
  })
  for (const r of results) {
    try {
      const url = new URL(r.url)
      if (url.pathname === '/' || url.pathname === '') return r.url
    } catch { continue }
  }
  return results[0]?.url ?? null
}

/** Extract likely person names (2–3 consecutive capitalised words) from raw text. */
function extractPersonNames(text: string): string[] {
  const seen = new Set<string>()
  const results: string[] = []
  // Match "Firstname [Middle] Lastname" patterns
  const re = /\b([A-Z][a-z]{1,20}(?:\s[A-Z][a-z]{1,20}){1,2})\b/g
  // Words that are almost certainly not person names
  const skipWords = /^(Director|Head|Vice|Global|Senior|Chief|Managing|President|Officer|Executive|The|Inc|Ltd|LLC|Corp|Group|Digital|Payments|Platform|Product|Business|Financial|Operations|Commerce|Partnership|Technology|Innovation|Strategy|Growth|Marketing|Sales|Europe|Asia|America|North|South|East|West)$/
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const name = m[1]
    if (seen.has(name)) continue
    const words = name.split(' ')
    if (words.some(w => skipWords.test(w))) continue
    seen.add(name)
    results.push(name)
    if (results.length >= 5) break
  }
  return results
}

export async function searchForDecisionMakers(
  company: string,
  website: string | null,
  titles: string[]
): Promise<string> {
  if (!process.env.EXA_API_KEY) return ''

  const titleQuery = titles.slice(0, 5).join(' OR ')

  // Phase A — three parallel searches:
  // 1. Company website's team/about/leadership pages
  // 2. Broader web search for named executives at the company
  // 3. LinkedIn profiles filtered by company + title (using includeDomains for reliable domain filtering)
  const [siteResults, webResults, linkedinByTitle] = await Promise.all([
    website
      ? exaSearch(`site:${website} team about leadership people executives`, {
          num_results: 3,
          use_autoprompt: false,
          contents: { text: { max_characters: 1000 } },
        })
      : Promise.resolve([]),
    exaSearch(`"${company}" (${titleQuery}) name email contact`, {
      num_results: 3,
      contents: { text: { max_characters: 800 } },
    }),
    exaSearch(`"${company}" (${titleQuery})`, {
      num_results: 5,
      use_autoprompt: false,
      includeDomains: ['linkedin.com'],
      contents: { text: { max_characters: 600 } },
    }),
  ])

  // Phase B — extract candidate person names from Phase A results, then search LinkedIn
  // by name. This catches cases where the name was found in a news article or press release
  // but no LinkedIn URL came back from the title-based search.
  const phaseAText = [...siteResults, ...webResults, ...linkedinByTitle]
    .map(r => `${r.title} ${r.text || ''}`)
    .join('\n')
  const candidateNames = extractPersonNames(phaseAText)

  let linkedinByName: Awaited<ReturnType<typeof exaSearch>> = []
  if (candidateNames.length > 0) {
    const nameClause = candidateNames.slice(0, 3).map(n => `"${n}"`).join(' OR ')
    linkedinByName = await exaSearch(`(${nameClause}) "${company}"`, {
      num_results: 5,
      use_autoprompt: false,
      includeDomains: ['linkedin.com'],
      contents: { text: { max_characters: 600 } },
    })
  }

  const seen = new Set<string>()
  const allResults = [...siteResults, ...webResults, ...linkedinByTitle, ...linkedinByName].filter((r) => {
    if (seen.has(r.url)) return false
    seen.add(r.url)
    return true
  })

  if (allResults.length === 0) return ''
  return allResults
    .map((r) => `[${r.title}] (${r.url})\n${r.text || ''}`)
    .join('\n\n')
}
