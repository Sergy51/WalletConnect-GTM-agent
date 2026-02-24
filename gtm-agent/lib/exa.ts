export async function searchCompanyNews(company: string, website?: string | null): Promise<string> {
  const apiKey = process.env.EXA_API_KEY
  if (!apiKey) {
    return 'No recent news available (Exa API key not configured).'
  }

  const query = website
    ? `${company} recent news partnerships funding product launch site:${website} OR "${company}"`
    : `${company} recent news partnerships funding product launch`

  try {
    const response = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        query,
        num_results: 3,
        use_autoprompt: true,
        start_published_date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        contents: {
          text: { max_characters: 500 },
        },
      }),
    })

    if (!response.ok) {
      return 'No recent news found.'
    }

    const data = await response.json()
    const results = data.results as Array<{ title: string; text?: string; url: string }>

    if (!results || results.length === 0) {
      return 'No recent news found in the last 90 days.'
    }

    return results
      .map((r) => `- ${r.title}: ${r.text?.slice(0, 200) || ''}`)
      .join('\n')
  } catch {
    return 'Unable to fetch recent news.'
  }
}
