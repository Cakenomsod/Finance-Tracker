import { AppSidebar } from '@/components/app-sidebar'
import { QuickAddProvider } from '@/components/quick-add-context'
import { FinanceDataProvider } from '@/providers/finance-data-provider'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <FinanceDataProvider>
      <QuickAddProvider>
        <AppSidebar>{children}</AppSidebar>
      </QuickAddProvider>
    </FinanceDataProvider>
  )
}
