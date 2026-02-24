import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FunnelStats, Lead, Message } from '@/types'
import Link from 'next/link'
import { LeadStatusBadge } from '@/components/lead-status-badge'

async function getFunnelStats(): Promise<FunnelStats> {
  const { data } = await supabase.from('leads').select('status')
  const leads = data || []
  return {
    total: leads.length,
    qualified: leads.filter((l) =>
      ['qualified', 'message_drafted', 'sent', 'followed_up', 'responded'].includes(l.status)
    ).length,
    message_drafted: leads.filter((l) =>
      ['message_drafted', 'sent', 'followed_up', 'responded'].includes(l.status)
    ).length,
    sent: leads.filter((l) => ['sent', 'followed_up', 'responded'].includes(l.status)).length,
    responded: leads.filter((l) => l.status === 'responded').length,
  }
}

async function getDueFollowUps(): Promise<Array<{ lead: Lead; message: Message }>> {
  const today = new Date()
  today.setHours(23, 59, 59, 999)

  const { data: messages } = await supabase
    .from('messages')
    .select('*, leads(*)')
    .or(`follow_up_1_due.lte.${today.toISOString()},follow_up_2_due.lte.${today.toISOString()}`)
    .is('sent_at', null)
    .limit(10)

  if (!messages) return []

  return messages
    .filter((m) => m.leads)
    .map((m) => ({ lead: m.leads as Lead, message: m as Message }))
}

export default async function DashboardPage() {
  const [stats, followUps] = await Promise.all([getFunnelStats(), getDueFollowUps()])

  const funnelSteps = [
    { label: 'Total Leads', value: stats.total, color: 'bg-slate-500' },
    { label: 'Qualified', value: stats.qualified, color: 'bg-blue-500' },
    { label: 'Message Drafted', value: stats.message_drafted, color: 'bg-purple-500' },
    { label: 'Sent', value: stats.sent, color: 'bg-orange-500' },
    { label: 'Responded', value: stats.responded, color: 'bg-green-500' },
  ]

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">WalletConnect Pay — GTM Outbound Pipeline</p>
      </div>

      {/* Funnel Stats */}
      <div className="grid grid-cols-5 gap-4">
        {funnelSteps.map((step) => (
          <Card key={step.label} className="text-center">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-3xl font-bold">{step.value}</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="text-sm text-muted-foreground">{step.label}</div>
              <div className={`h-1 rounded-full mt-3 ${step.color}`} />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Reply rate bar */}
      {stats.total > 0 && (
        <Card>
          <CardContent className="py-4 flex justify-between text-sm">
            <span className="text-muted-foreground">{stats.total} leads total</span>
            <span className="font-medium">
              {stats.responded > 0 ? ((stats.responded / stats.total) * 100).toFixed(1) : 0}% reply rate
            </span>
          </CardContent>
        </Card>
      )}

      {/* Follow-up queue */}
      <div>
        <h2 className="text-lg font-semibold mb-4">
          Follow-ups Due Today
          {followUps.length > 0 && (
            <span className="ml-2 inline-flex items-center rounded-full bg-orange-100 text-orange-700 border border-orange-200 px-2 py-0.5 text-xs font-semibold">
              {followUps.length}
            </span>
          )}
        </h2>

        {followUps.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No follow-ups due today.{' '}
              <Link href="/followups" className="underline">
                View all follow-ups
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {followUps.map(({ lead, message }) => {
              const due1 = message.follow_up_1_due ? new Date(message.follow_up_1_due) : null
              const due2 = message.follow_up_2_due ? new Date(message.follow_up_2_due) : null
              const now = new Date()

              return (
                <Card key={message.id} className={(due1 && due1 < now) || (due2 && due2 < now) ? 'border-orange-300' : ''}>
                  <CardContent className="py-3 flex items-center justify-between">
                    <div>
                      <Link href={`/leads/${lead.id}`} className="font-medium hover:underline">
                        {lead.name}
                      </Link>
                      <span className="text-muted-foreground"> · {lead.title} at {lead.company}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <LeadStatusBadge status={lead.status} />
                      {due1 && due1 <= now && (
                        <span className="text-xs text-orange-600 font-medium">Follow-up 1 overdue</span>
                      )}
                      {due2 && due2 <= now && (
                        <span className="text-xs text-red-600 font-medium">Follow-up 2 overdue</span>
                      )}
                      <Link href={`/leads/${lead.id}`} className="text-sm text-primary hover:underline">
                        View →
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="flex gap-3">
          <Link
            href="/leads/new"
            className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90"
          >
            + Add Leads
          </Link>
          <Link
            href="/leads"
            className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            View All Leads
          </Link>
        </div>
      </div>
    </div>
  )
}
