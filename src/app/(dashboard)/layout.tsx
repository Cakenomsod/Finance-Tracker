import { AppSidebar } from '@/components/app-sidebar'
import { QuickAddProvider } from '@/components/quick-add-context'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <QuickAddProvider>
      <AppSidebar>{children}</AppSidebar>
    </QuickAddProvider>
  )
}
