'use client'

import * as React from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Transaction } from '@/lib/firestore-types'
import { Timestamp } from 'firebase/firestore'

const formSchema = z.object({
  amount: z.string().min(1, 'กรุณากรอกจำนวนเงิน'),
  category: z.string().min(1, 'กรุณาเลือกหมวดหมู่'),
  description: z.string().min(1, 'กรุณากรอกรายละเอียด'),
  date: z.string(),
  paidBy: z.string().min(1, 'กรุณาเลือกผู้จ่าย'),
  splitMode: z.enum(['solo', 'all', 'specific']),
  splitWith: z.string().optional(),
})

type TripExpenseFormValues = z.infer<typeof formSchema>

interface TripExpenseFormProps {
  tripMembers: string[]
  initialData?: Transaction | null
  onSubmit: (data: Omit<Transaction, 'id' | 'createdAt' | 'userId'>) => Promise<void>
  onCancel: () => void
}

const categories = [
  'Food & Dining',
  'Transport',
  'Shopping',
  'Entertainment',
  'Bills & Utilities',
  'Health & Fitness',
  'Accommodation',
  'Activities',
  'Others',
]

function getSplitMode(splitWith: string | null | undefined): 'solo' | 'all' | 'specific' {
  if (!splitWith) return 'solo'
  if (splitWith === 'all') return 'all'
  return 'specific'
}

export function TripExpenseForm({
  tripMembers,
  initialData,
  onSubmit,
  onCancel,
}: TripExpenseFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const defaultDate = initialData?.date?.seconds
    ? new Date(initialData.date.seconds * 1000).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0]

  const initialSplitMode = getSplitMode(initialData?.splitWith)
  const initialSplitWith =
    initialSplitMode === 'specific' ? initialData?.splitWith || '' : ''

  const form = useForm<TripExpenseFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: initialData ? Math.abs(initialData.amount).toString() : '',
      category: initialData?.category || '',
      description: initialData?.description || '',
      date: defaultDate,
      paidBy: initialData?.paidBy || (tripMembers[0] || 'Me'),
      splitMode: initialSplitMode,
      splitWith: initialSplitWith,
    },
  })

  const splitMode = form.watch('splitMode')
  const paidBy = form.watch('paidBy')

  // Other members (for "specific" split — exclude paidBy)
  const otherMembers = tripMembers.filter((m) => m !== paidBy)

  const handleSubmit = async (values: TripExpenseFormValues) => {
    setIsSubmitting(true)
    try {
      let splitWith: string | null = null
      if (values.splitMode === 'all') {
        splitWith = 'all'
      } else if (values.splitMode === 'specific' && values.splitWith) {
        splitWith = values.splitWith
      }
      // solo → splitWith = null

      const data: Omit<Transaction, 'id' | 'createdAt' | 'userId'> = {
        amount: -Math.abs(parseFloat(values.amount)), // trip expenses are always negative
        type: 'expense',
        category: values.category,
        description: values.description,
        date: Timestamp.fromDate(new Date(values.date)),
        paidBy: values.paidBy,
        splitWith,
        tripId: initialData?.tripId || null,
        receiptUrl: initialData?.receiptUrl || null,
        source: initialData?.source || 'manual',
      }
      await onSubmit(data)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-2">
        {/* Description */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>รายละเอียด</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="เช่น อาหารมื้อเย็น, แท็กซี่ไปสนามบิน..."
                  className="resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Amount + Category */}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>จำนวนเงิน (฿)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" placeholder="0.00" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>หมวดหมู่</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="เลือก..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Date */}
        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>วันที่</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Paid By — button selector */}
        <FormField
          control={form.control}
          name="paidBy"
          render={({ field }) => (
            <FormItem>
              <FormLabel>ใครจ่าย?</FormLabel>
              <FormControl>
                <div className="flex flex-wrap gap-2">
                  {tripMembers.map((member) => (
                    <button
                      key={member}
                      type="button"
                      onClick={() => {
                        field.onChange(member)
                        // If current splitWith === this member, reset splitWith
                        if (form.getValues('splitWith') === member) {
                          form.setValue('splitWith', '')
                          form.setValue('splitMode', 'solo')
                        }
                      }}
                      className={cn(
                        'rounded-full border px-4 py-1.5 text-sm font-medium transition-all',
                        field.value === member
                          ? 'bg-primary text-primary-foreground border-primary shadow'
                          : 'bg-background text-foreground border-border hover:border-primary/50'
                      )}
                    >
                      {member}
                    </button>
                  ))}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Split Mode */}
        <FormField
          control={form.control}
          name="splitMode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>แบ่งกับใคร?</FormLabel>
              <FormControl>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'solo', label: '🙋 จ่ายคนเดียว' },
                    { value: 'all', label: '👥 หารทุกคน' },
                    ...(otherMembers.length > 0 ? [{ value: 'specific', label: '🤝 เลือกคน' }] : []),
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        field.onChange(opt.value)
                        if (opt.value !== 'specific') {
                          form.setValue('splitWith', '')
                        }
                      }}
                      className={cn(
                        'rounded-full border px-4 py-1.5 text-sm font-medium transition-all',
                        field.value === opt.value
                          ? 'bg-primary text-primary-foreground border-primary shadow'
                          : 'bg-background text-foreground border-border hover:border-primary/50'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Split With — specific person picker */}
        {splitMode === 'specific' && otherMembers.length > 0 && (
          <FormField
            control={form.control}
            name="splitWith"
            render={({ field }) => (
              <FormItem>
                <FormLabel>เลือกคนที่หารด้วย</FormLabel>
                <FormControl>
                  <div className="flex flex-wrap gap-2">
                    {otherMembers.map((member) => (
                      <button
                        key={member}
                        type="button"
                        onClick={() => field.onChange(member)}
                        className={cn(
                          'rounded-full border px-4 py-1.5 text-sm font-medium transition-all',
                          field.value === member
                            ? 'bg-primary text-primary-foreground border-primary shadow'
                            : 'bg-background text-foreground border-border hover:border-primary/50'
                        )}
                      >
                        {member}
                      </button>
                    ))}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Summary */}
        <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground space-y-1">
          {splitMode === 'solo' && (
            <p>💳 <strong>{paidBy}</strong> จ่ายคนเดียว ไม่มีการหาร</p>
          )}
          {splitMode === 'all' && (
            <p>💳 <strong>{paidBy}</strong> จ่ายก่อน → หารเท่ากันกับทุกคน ({tripMembers.length} คน)</p>
          )}
          {splitMode === 'specific' && form.watch('splitWith') && (
            <p>💳 <strong>{paidBy}</strong> จ่ายก่อน → หารครึ่งกับ <strong>{form.watch('splitWith')}</strong></p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            ยกเลิก
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
