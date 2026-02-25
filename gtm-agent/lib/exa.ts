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

export async function searchForDecisionMakers(company: string, website: string | null, titles: string[]): Promise<string> {
  if (!process.env.EXA_API_KEY) return ''

  const titleQuery = titles.slice(0, 3).join(' OR ')
  const query = website
    ? `site:${website} team OR leadership OR about OR "${titleQuery}"`
    : `"${company}" ${titleQuery} executive leadership team`

  const results = await exaSearch(query)
  if (results.length === 0) return ''
  return results.map((r) => `[${r.title}]\n${r.text || ''}`).join('\n\n')
}
