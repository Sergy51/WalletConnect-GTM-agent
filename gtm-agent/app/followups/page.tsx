import { supabase } from '@/lib/supabase'
import { Lead, Message } from '@/types'
import { LeadStatusBadge } from '@/components/lead-status-badge'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'

async function getAllFollowUps(): Promise<Array<{ lead: Lead; message: Message; dueDate: Date; followUpNumber: 1 | 2 }>> {
  const { data: messages } = await supabase
    .from('messages')
    .select('*, leads(*)')
    .not('sent_at', 'is', null)
    .order('follow_up_1_due', { ascending: true })

  if (!messages) return []

  const items: Array<{ lead: Lead; message: Message; dueDate: Date; followUpNumber: 1 | 2 }> = []
  const now = new Date()

  for (const m of messages) {
    if (!m.leads) continue
    if (m.follow_up_1_due) {
      items.push({
        lead: m.leads as Lead,
        message: m as Message,
        dueDate: new Date(m.follow_up_1_due),
        followUpNumber: 1,
      })
    }
    if (m.follow_up_2_due) {
      items.push({
        lead: m.leads as Lead,
        message: m as Message,
        dueDate: new Date(m.follow_up_2_due),
        followUpNumber: 2,
      })
    }
  }

  return items.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
}

function formatDue(date: Date): string {
  const now = new Date()
  const diff = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diff < 0) return `${Math.abs(diff)}d overdue`
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  return `In ${diff} days`
}

export default async function FollowUpsPage() {
  const followUps = await getAllFollowUps()
  const now = new Date()
  const overdue = followUps.filter((f) => f.dueDate < now)
  const upcoming = followUps.filter((f) => f.dueDate >= now)

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Follow-ups</h1>
        <p className="text-muted-foreground mt-1">
          {overdue.length} overdue · {upcoming.length} upcoming
        </p>
      </div>

      {followUps.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No follow-ups scheduled. Send some emails first.{' '}
            <Link href="/leads" className="underline">View leads</Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {overdue.length > 0 && (
            <section>
              <h2 className="text-base font-semibold mb-3 text-orange-600">Overdue</h2>
              <div className="space-y-2">
                {overdue.map((item, i) => (
                  <Card key={`${item.message.id}-${item.followUpNumber}-${i}`} className="border-orange-200">
                    <CardContent className="py-3 flex items-center justify-between">
                      <div>
                        <Link href={`/leads/${item.lead.id}`} className="font-medium hover:underline">
                          {item.lead.name}
                        </Link>
                        <span className="text-muted-foreground"> · {item.lead.company}</span>
                        <span className="ml-2 text-xs bg-orange-100 text-orange-700 rounded px-1.5 py-0.5">
                          Follow-up {item.followUpNumber}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-orange-600">{formatDue(item.dueDate)}</span>
                        <LeadStatusBadge status={item.lead.status} />
                        <Link href={`/leads/${item.lead.id}`} className="text-sm text-primary hover:underline">
                          View →
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {upcoming.length > 0 && (
            <section>
              <h2 className="text-base font-semibold mb-3">Upcoming</h2>
              <div className="space-y-2">
                {upcoming.map((item, i) => (
                  <Card key={`${item.message.id}-${item.followUpNumber}-upcoming-${i}`}>
                    <CardContent className="py-3 flex items-center justify-between">
                      <div>
                        <Link href={`/leads/${item.lead.id}`} className="font-medium hover:underline">
                          {item.lead.name}
                        </Link>
                        <span className="text-muted-foreground"> · {item.lead.company}</span>
                        <span className="ml-2 text-xs bg-slate-100 text-slate-600 rounded px-1.5 py-0.5">
                          Follow-up {item.followUpNumber}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">{formatDue(item.dueDate)}</span>
                        <span className="text-xs text-muted-foreground">
                          {item.dueDate.toLocaleDateString()}
                        </span>
                        <LeadStatusBadge status={item.lead.status} />
                        <Link href={`/leads/${item.lead.id}`} className="text-sm text-primary hover:underline">
                          View →
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
