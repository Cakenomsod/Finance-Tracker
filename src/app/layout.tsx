import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { AuthProvider } from '@/components/auth-context'
import { LocaleProvider } from '@/components/locale-provider'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

export const metadata: Metadata = {
  title: 'Finance Tracker',
  description: 'จดรายรับรายจ่าย หารค่าใช้จ่ายกับเพื่อน และเคลียร์หนี้ทริปในที่เดียว',
  icons: {
    icon: [
      {
        url: '/favicon.svg',
        type: 'image/svg+xml',
      },
    ],
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f9fb' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1020' },
  ],
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          storageKey="finance-tracker-theme"
          themes={['light', 'dark', 'system']}
        >
          <AuthProvider>
            <LocaleProvider>
              {children}
              <Toaster richColors position="top-center" />
              {process.env.NODE_ENV === 'production' && <Analytics />}
            </LocaleProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
