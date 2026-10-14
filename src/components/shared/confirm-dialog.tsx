'use client'

import * as React from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { buttonVariants } from '@/components/ui/button'
import { useLocale } from '@/components/locale-provider'
import { cn } from '@/lib/utils'

export interface ConfirmOptions {
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  destructive?: boolean
}

/** Promise-based confirm: `if (await confirm({...})) doIt()`. Render `dialog` once in the tree. */
export function useConfirm() {
  const { t } = useLocale()
  const [options, setOptions] = React.useState<ConfirmOptions | null>(null)
  const resolverRef = React.useRef<((value: boolean) => void) | null>(null)

  const confirm = React.useCallback((next: ConfirmOptions) => {
    resolverRef.current?.(false)
    setOptions(next)
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
    })
  }, [])

  const settle = (value: boolean) => {
    resolverRef.current?.(value)
    resolverRef.current = null
    setOptions(null)
  }

  const dialog = (
    <AlertDialog open={options !== null} onOpenChange={(open) => !open && settle(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{options?.title}</AlertDialogTitle>
          {options?.description && (
            <AlertDialogDescription asChild={typeof options.description !== 'string'}>
              {typeof options.description === 'string' ? (
                options.description
              ) : (
                <div>{options.description}</div>
              )}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-10">{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            className={cn(
              'h-10',
              options?.destructive && buttonVariants({ variant: 'destructive' })
            )}
            onClick={() => settle(true)}
          >
            {options?.confirmLabel ?? t('common.delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  return { confirm, dialog }
}
