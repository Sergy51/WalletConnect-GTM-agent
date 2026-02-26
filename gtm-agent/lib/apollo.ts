interface ApolloPersonResult {
  email: string
  linkedin_url: string | null
  title: string | null
}

export async function searchPersonEmail(
  name: string,
  company: string,
  domain: string | null,
  linkedinUrl?: string | null
): Promise<ApolloPersonResult | null> {
  const apiKey = process.env.APOLLO_API_KEY
  if (!apiKey) return null

  try {
    const params = new URLSearchParams({
      name: name.trim(),          // full name including initials — Apollo handles matching
      organization_name: company,
      reveal_personal_emails: 'true',
    })
    if (domain) params.set('domain', domain)
    if (linkedinUrl) params.set('linkedin_url', linkedinUrl)  // most reliable identifier

    const response = await fetch(`https://api.apollo.io/api/v1/people/match?${params.toString()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
    })

    if (!response.ok) {
      console.error(`[Apollo] HTTP ${response.status}:`, await response.text().catch(() => ''))
      return null
    }

    const data = await response.json()
    const person = data.person
    console.log(`[Apollo] match for "${name}" @ ${company}:`, {
      found: !!person,
      email: person?.email ?? null,
      email_status: person?.email_status ?? null,
      title: person?.title ?? null,
      personal_emails: person?.personal_emails ?? [],
    })
    if (!person) return null

    const email = person.email
    if (!email) return null

    return {
      email,
      linkedin_url: person.linkedin_url || null,
      title: person.title || null,
    }
  } catch (err) {
    console.error('[Apollo] error:', err)
    return null
  }
}
