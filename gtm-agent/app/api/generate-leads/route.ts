import { NextRequest, NextResponse } from 'next/server'
import { anthropic, CLAUDE_MODEL } from '@/lib/claude'
import { searchForDecisionMakers } from '@/lib/exa'
import { GeneratedLead } from '@/types'

interface CompanyResult {
  company: string
  website: string
  country: string
  company_size: string
}

async function generateCompanyList(companyProfile: string): Promise<CompanyResult[]> {
  const msg = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 800,
    messages: [
      {
        role: 'user',
        content: `You are a B2B market researcher. Generate a list of 5 real companies that match this profile:

"${companyProfile}"

For each company return:
- company: exact company name
- website: their real website URL (e.g. https://example.com)
- country: headquarters country
- company_size: estimated employee range (e.g. "51-200")

Return ONLY a valid JSON array, no markdown, no explanation.`,
      },
    ],
  })

  const text = msg.content[0].type === 'text' ? msg.content[0].text : '[]'
  try {
    const match = text.match(/\[[\s\S]*\]/)
    return match ? JSON.parse(match[0]) : []
  } catch {
    return []
  }
}

async function extractPersonFromSearchResults(
  searchResults: string,
  company: string,
  titles: string[]
): Promise<{ name: string | null; title: string | null; email: string | null; linkedin_url: string | null; is_inferred: boolean }> {
  if (!searchResults.trim()) {
    return { name: null, title: null, email: null, linkedin_url: null, is_inferred: true }
  }

  const msg = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 300,
    messages: [
      {
        role: 'user',
        content: `From these web search results about ${company}, find ONE person who holds one of these roles: ${titles.join(', ')}.

Search results:
${searchResults.slice(0, 1500)}

Return ONLY valid JSON:
{
  "name": "First Last" or null if not clearly stated,
  "title": "their exact title" or null,
  "email": "their email" or null,
  "linkedin_url": "their LinkedIn URL" or null,
  "is_inferred": false if name is explicitly in the results, true if guessed
}`,
      },
    ],
  })

  const text = msg.content[0].type === 'text' ? msg.content[0].text : '{}'
  try {
    const match = text.match(/\{[\s\S]*\}/)
    return match ? JSON.parse(match[0]) : { name: null, title: null, email: null, linkedin_url: null, is_inferred: true }
  } catch {
    return { name: null, title: null, email: null, linkedin_url: null, is_inferred: true }
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { companyProfile, decisionMakerTitles } = body

  if (!companyProfile || !decisionMakerTitles) {
    return NextResponse.json({ error: 'companyProfile and decisionMakerTitles are required' }, { status: 400 })
  }

  const titles = decisionMakerTitles
    .split(/[,\n]/)
    .map((t: string) => t.trim())
    .filter(Boolean)

  try {
    // Step 1: Claude generates company list
    const companies = await generateCompanyList(companyProfile)

    if (companies.length === 0) {
      return NextResponse.json({ error: 'Could not generate company list. Try a more specific profile description.' }, { status: 400 })
    }

    // Step 2: Exa searches for decision makers at each company (in parallel)
    const searchPromises = companies.map((co) =>
      searchForDecisionMakers(co.company, co.website, titles)
    )
    const searchResults = await Promise.all(searchPromises)

    // Step 3: Claude extracts person from each set of results (in parallel)
    const extractPromises = companies.map((co, i) =>
      extractPersonFromSearchResults(searchResults[i], co.company, titles)
    )
    const people = await Promise.all(extractPromises)

    // Step 4: Combine into lead objects
    const leads: GeneratedLead[] = companies.map((co, i) => {
      const person = people[i]
      return {
        name: person.name || `Decision Maker at ${co.company}`,
        email: person.email || null,
        title: person.title || titles[0] || null,
        company: co.company,
        company_website: co.website || null,
        company_size: co.company_size || null,
        linkedin_url: person.linkedin_url || null,
        is_inferred: person.is_inferred || !person.name,
      }
    })

    return NextResponse.json(leads)
  } catch (error) {
    console.error('Generate leads error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Lead generation failed' },
      { status: 500 }
    )
  }
}
