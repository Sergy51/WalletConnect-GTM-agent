export async function searchCompanyPriorities(
  company: string,
  website: string | null
): Promise<string[]> {
  const apiKey = process.env.PERPLEXITY_API_KEY
  if (!apiKey) return []

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: 'You are a concise business analyst. Return ONLY a JSON array of strings, no markdown, no explanation.',
          },
          {
            role: 'user',
            content: `What are the top 3-5 specific strategic priorities of ${company}${website ? ` (${website})` : ''} related to payments, fintech, digital transformation, crypto, or blockchain? Return a JSON array of concise bullet-point strings. Example: ["Expanding stablecoin payment rails in Europe", "Launched crypto checkout for enterprise merchants"]. If you cannot find specific information, return an empty array [].`,
          },
        ],
        max_tokens: 400,
      }),
    })

    if (!response.ok) return []

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''

    // Parse JSON array from response
    const match = content.match(/\[[\s\S]*\]/)
    if (!match) return []

    const parsed = JSON.parse(match[0])
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter((item: unknown): item is string => typeof item === 'string' && item.length > 0)
      .slice(0, 5)
  } catch {
    return []
  }
}
