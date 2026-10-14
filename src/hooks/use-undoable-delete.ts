'use client'

import * as React from 'react'
import { toast } from 'sonner'

const UNDO_WINDOW_MS = 5000

interface ScheduleOptions {
  message: string
  undoLabel: string
  errorMessage?: string
}

/**
 * Hides an item immediately and deletes it after a short undo window.
 * Pending deletes are flushed when the page unmounts so nothing is silently kept.
 */
export function useUndoableDelete() {
  const [pendingIds, setPendingIds] = React.useState<ReadonlySet<string>>(() => new Set())
  const jobs = React.useRef(
    new Map<string, { timer: ReturnType<typeof setTimeout>; execute: () => Promise<void> }>()
  )

  const release = React.useCallback((id: string) => {
    setPendingIds((prev) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  const scheduleDelete = React.useCallback(
    (id: string, run: () => Promise<unknown>, options: ScheduleOptions) => {
      if (jobs.current.has(id)) return

      const execute = async () => {
        jobs.current.delete(id)
        try {
          await run()
        } catch {
          toast.error(options.errorMessage ?? 'ลบไม่สำเร็จ ลองใหม่อีกครั้ง')
        } finally {
          release(id)
        }
      }

      setPendingIds((prev) => new Set(prev).add(id))
      const timer = setTimeout(() => void execute(), UNDO_WINDOW_MS)
      jobs.current.set(id, { timer, execute })

      toast(options.message, {
        duration: UNDO_WINDOW_MS,
        action: {
          label: options.undoLabel,
          onClick: () => {
            const job = jobs.current.get(id)
            if (!job) return
            clearTimeout(job.timer)
            jobs.current.delete(id)
            release(id)
          },
        },
      })
    },
    [release]
  )

  React.useEffect(() => {
    const pending = jobs.current
    const flush = () => {
      for (const job of [...pending.values()]) {
        clearTimeout(job.timer)
        void job.execute()
      }
    }
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [])

  return { pendingIds, scheduleDelete }
}
