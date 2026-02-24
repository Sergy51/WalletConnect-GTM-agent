'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const nav = [
  { href: '/', label: 'Dashboard', icon: '◉' },
  { href: '/leads', label: 'Leads', icon: '◎' },
  { href: '/leads/new', label: 'Add Leads', icon: '+' },
  { href: '/followups', label: 'Follow-ups', icon: '⏱' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-56 shrink-0 border-r border-border bg-muted/30 flex flex-col min-h-screen">
      <div className="px-5 py-5 border-b border-border">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">WalletConnect</div>
        <div className="font-bold text-base">GTM Agent</div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              pathname === item.href
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <span className="text-base leading-none">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="px-5 py-4 border-t border-border">
        <div className="text-xs text-muted-foreground">Powered by Claude AI</div>
      </div>
    </aside>
  )
}
