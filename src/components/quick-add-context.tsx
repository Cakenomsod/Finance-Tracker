'use client'

import * as React from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { TransactionForm } from '@/components/transactions/transaction-form'
import { useTransactions } from '@/hooks/use-transactions-context'
import { useUserSettings } from '@/hooks/use-user-settings'
import { useLocale } from '@/components/locale-provider'
import type { Transaction } from '@/lib/firestore-types'

export const AI_INPUT_ID = 'ai-quick-input'
export const TX_SEARCH_ID = 'tx-search'
const FOCUS_TARGETS = [AI_INPUT_ID, TX_SEARCH_ID]

type TransactionDraft = Omit<Transaction, 'id' | 'createdAt' | 'userId'>

interface QuickAddOptions {
  /** Prefill from an AI parse; the dialog then reads as a review step. */
  draft?: TransactionDraft
  immichAssetIds?: string[]
  onSaved?: () => void
}

interface QuickAddContextValue {
  openQuickAdd: (options?: QuickAddOptions) => void
  /** Jump to the AI capture box on the Transactions page. */
  openAiCapture: () => void
  /** Jump to the transaction search box (also bound to Ctrl/⌘+K). */
  openSearch: () => void
}

const QuickAddContext = React.createContext<QuickAddContextValue | null>(null)

export function useQuickAdd() {
  const ctx = React.useContext(QuickAddContext)
  if (!ctx) {
    throw new Error('useQuickAdd must be used within QuickAddProvider')
  }
  return ctx
}

function focusById(id: string) {
  const el = document.getElementById(id) as HTMLElement | null
  if (!el) return false
  el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  el.focus({ preventScroll: true })
  return true
}

export function QuickAddProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { addTransaction } = useTransactions()
  const { currency } = useUserSettings()
  const { p } = useLocale()
  const [isOpen, setIsOpen] = React.useState(false)
  const [options, setOptions] = React.useState<QuickAddOptions>({})
  const [formKey, setFormKey] = React.useState(0)

  const openQuickAdd = React.useCallback((next?: QuickAddOptions) => {
    setOptions(next ?? {})
    setFormKey((k) => k + 1)
    setIsOpen(true)
  }, [])

  const jumpTo = React.useCallback(
    (id: string) => {
      setIsOpen(false)
      if (pathname === '/' && focusById(id)) return
      router.push(`/#${id}`)
    },
    [pathname, router]
  )
  const openAiCapture = React.useCallback(() => jumpTo(AI_INPUT_ID), [jumpTo])
  const openSearch = React.useCallback(() => jumpTo(TX_SEARCH_ID), [jumpTo])

  React.useEffect(() => {
    const target = window.location.hash.slice(1)
    if (pathname !== '/' || !FOCUS_TARGETS.includes(target)) return
    const timer = window.setTimeout(() => {
      if (focusById(target)) {
        history.replaceState(null, '', window.location.pathname + window.location.search)
      }
    }, 300)
    return () => window.clearTimeout(timer)
  }, [pathname])

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        openSearch()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [openSearch])

  const value = React.useMemo(
    () => ({ openQuickAdd, openAiCapture, openSearch }),
    [openQuickAdd, openAiCapture, openSearch]
  )

  const isDraft = Boolean(options.draft)
  const title = isDraft
    ? p({ th: 'ตรวจรายการจาก AI', en: 'Review AI entry', zh: '检查 AI 识别结果' })
    : p({ th: 'เพิ่มรายการ', en: 'Add entry', zh: '添加记录' })
  const description = isDraft
    ? p({
        th: 'AI กรอกให้แล้ว — แก้ได้ก่อนกดบันทึก',
        en: 'AI filled this in — adjust anything before saving',
        zh: 'AI 已填写，保存前可修改',
      })
    : p({
        th: 'จำนวนเงินกับหมวดหมู่ก็พอ ที่เหลือไม่บังคับ',
        en: 'Amount and category are enough — the rest is optional',
        zh: '只需金额和类别，其余可选',
      })
  const aiLabel = p({
    th: 'พิมพ์หรือสแกนใบเสร็จให้ AI กรอก',
    en: 'Let AI fill it from text or a receipt',
    zh: '让 AI 识别文字或收据',
  })

  const close = () => {
    setIsOpen(false)
    setOptions({})
  }

  return (
    <QuickAddContext.Provider value={value}>
      {children}
      <Dialog open={isOpen} onOpenChange={(open) => (open ? setIsOpen(true) : close())}>
        <DialogContent
          className="max-h-[min(90vh,90dvh)] w-[calc(100vw-1rem)] overflow-y-auto overflow-x-hidden p-4 max-sm:top-[4vh] max-sm:translate-y-0 sm:max-w-[560px] sm:p-6"
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {!isDraft && (
            <Button
              type="button"
              variant="outline"
              className="h-10 w-full justify-start gap-2 text-sm"
              onClick={openAiCapture}
            >
              <Sparkles className="size-4 text-primary" aria-hidden />
              {aiLabel}
            </Button>
          )}
          <TransactionForm
            key={formKey}
            initialData={(options.draft as Transaction | undefined) ?? null}
            pendingImmichAssetIds={options.immichAssetIds}
            currency={currency}
            onSubmit={async (data) => {
              await addTransaction({
                ...data,
                source: data.source || (isDraft ? 'ai' : 'manual'),
              })
              options.onSaved?.()
              close()
            }}
            onCancel={close}
          />
        </DialogContent>
      </Dialog>
    </QuickAddContext.Provider>
  )
}
