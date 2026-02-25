import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'

const geist = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'WalletConnect Pay GTM',
  description: 'AI-powered outbound sales pipeline for WalletConnect Pay',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${geist.variable} font-sans antialiased`}>
        <div className="min-h-screen w-full">
          {children}
        </div>
        <Toaster />
      </body>
    </html>
  )
}
