import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { ids } = body as { ids: string[] }

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids must be a non-empty array' }, { status: 400 })
  }

  const results: Array<{ id: string; success: boolean; error?: string }> = []

  for (const id of ids) {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/qualify/${id}`, {
        method: 'POST',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        results.push({ id, success: false, error: err.error || `HTTP ${res.status}` })
      } else {
        results.push({ id, success: true })
      }
    } catch (error) {
      results.push({
        id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  return NextResponse.json(results)
}
