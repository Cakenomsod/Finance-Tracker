import { AppSidebar } from '@/components/app-sidebar'
import { QuickAddProvider } from '@/components/quick-add-context'
import { WelcomeDialog } from '@/components/onboarding/welcome-dialog'
import { FinanceDataProvider } from '@/providers/finance-data-provider'
import { ImmichUploadProvider } from '@/providers/immich-upload-context'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <FinanceDataProvider>
      <ImmichUploadProvider>
        <QuickAddProvider>
          <AppSidebar>{children}</AppSidebar>
          <WelcomeDialog />
        </QuickAddProvider>
      </ImmichUploadProvider>
    </FinanceDataProvider>
  )
}
