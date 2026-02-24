import { Badge } from '@/components/ui/badge'
import { LeadStatus } from '@/types'

const statusConfig: Record<LeadStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  new: { label: 'New', variant: 'secondary' },
  qualified: { label: 'Qualified', variant: 'default' },
  message_drafted: { label: 'Message Drafted', variant: 'default' },
  sent: { label: 'Sent', variant: 'default' },
  followed_up: { label: 'Followed Up', variant: 'default' },
  responded: { label: 'Responded', variant: 'default' },
  not_interested: { label: 'Not Interested', variant: 'destructive' },
}

const statusColors: Record<LeadStatus, string> = {
  new: 'bg-slate-100 text-slate-700 border-slate-200',
  qualified: 'bg-blue-100 text-blue-700 border-blue-200',
  message_drafted: 'bg-purple-100 text-purple-700 border-purple-200',
  sent: 'bg-orange-100 text-orange-700 border-orange-200',
  followed_up: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  responded: 'bg-green-100 text-green-700 border-green-200',
  not_interested: 'bg-red-100 text-red-700 border-red-200',
}

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  const config = statusConfig[status] || { label: status, variant: 'secondary' as const }
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusColors[status] || ''}`}>
      {config.label}
    </span>
  )
}
