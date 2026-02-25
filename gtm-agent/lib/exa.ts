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

export async function searchCompanyNews(company: string, website?: string | null): Promise<string> {
  if (!process.env.EXA_API_KEY) return 'No recent news available (Exa API key not configured).'

  const query = website
    ? `${company} recent news partnerships funding product launch site:${website} OR "${company}"`
    : `${company} recent news partnerships funding product launch`

  const results = await exaSearch(query, {
    start_published_date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
  })

  if (results.length === 0) return 'No recent news found in the last 90 days.'
  return results.map((r) => `- ${r.title}: ${r.text?.slice(0, 200) || ''}`).join('\n')
}

export async function searchForDecisionMakers(
  company: string,
  website: string | null,
  titles: string[]
): Promise<string> {
  if (!process.env.EXA_API_KEY) return ''

  const titleQuery = titles.slice(0, 5).join(' OR ')

  // Run two searches in parallel:
  // 1. Company website's team/about/leadership pages
  // 2. Broader web search for named executives at the company
  const [siteResults, webResults] = await Promise.all([
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
  ])

  const seen = new Set<string>()
  const allResults = [...siteResults, ...webResults].filter((r) => {
    if (seen.has(r.url)) return false
    seen.add(r.url)
    return true
  })

  if (allResults.length === 0) return ''
  return allResults
    .map((r) => `[${r.title}] (${r.url})\n${r.text || ''}`)
    .join('\n\n')
}
