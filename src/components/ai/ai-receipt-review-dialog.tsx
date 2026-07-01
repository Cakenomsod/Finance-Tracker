'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, FileText, Receipt, Users, Wallet } from 'lucide-react'
import { ReceiptParseResult } from '@/lib/ai/receipt-schema'
import { normalizeAiTime } from '@/lib/ai/receipt-mapper'

const DOC_TYPE_LABELS: Record<ReceiptParseResult['documentType'], string> = {
  receipt: 'ใบเสร็จ',
  transfer_slip: 'สลิปโอนเงิน',
}

export interface AiReceiptReviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  result: ReceiptParseResult | null
  defaultCurrency?: 'THB' | 'JPY'
  onConfirm: () => void
}

export function AiReceiptReviewDialog({
  open,
  onOpenChange,
  result,
  defaultCurrency = 'THB',
  onConfirm,
}: AiReceiptReviewDialogProps) {
  if (!result) return null

  const currency = result.currency || defaultCurrency
  const hasItems = result.items && result.items.length > 0
  const hasSplit =
    (result.payers?.length ?? 0) > 0 ||
    (result.shares?.length ?? 0) > 0 ||
    !!result.splitMode
  const paymentLabel =
    result.paymentMethod === 'paotang' ? 'เป๋าตัง' : result.paymentMethod === 'normal' ? 'ปกติ' : null
  const splitModeLabel =
    result.splitMode === 'equal'
      ? 'หารเท่าๆ กัน'
      : result.splitMode === 'custom'
        ? 'กำหนดเอง'
        : result.splitMode === 'solo'
          ? 'คนเดียว'
          : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-5 text-primary" />
            ตรวจสอบข้อมูลจาก AI
          </DialogTitle>
          <DialogDescription>
            {result
              ? 'AI แยกข้อมูลแล้ว — กรุณาตรวจสอบก่อนเปิดฟอร์มบันทึก'
              : 'กรุณาตรวจสอบก่อนเปิดฟอร์มบันทึก'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{DOC_TYPE_LABELS[result.documentType]}</Badge>
            <Badge variant="outline">{currency}</Badge>
            {result.taxMode && (
              <Badge variant="outline">
                ภาษี {result.taxMode === 'exclusive' ? 'แยกนอก' : 'รวมใน'}
              </Badge>
            )}
          </div>

          <div className="grid gap-3 rounded-lg border p-4 text-sm">
            <Row label="รายละเอียด" value={result.description} />
            <Row label="หมวดหมู่" value={result.category} />
            <Row label="วันที่" value={result.date} />
            <Row label="เวลา" value={normalizeAiTime(result.time)} />
            <Row
              label="ยอดรวม"
              value={`${result.totalAmount.toLocaleString()} ${currency}`}
              highlight
            />
            {result.baseAmount != null && (
              <Row label="ยอดก่อนภาษี" value={result.baseAmount.toLocaleString()} />
            )}
            {result.taxAmount != null && (
              <Row label="ภาษี" value={result.taxAmount.toLocaleString()} />
            )}
            {result.discount != null && result.discount > 0 && (
              <Row label="ส่วนลด" value={result.discount.toLocaleString()} />
            )}
          </div>

          {hasSplit && (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Users className="size-3.5" />
                แบ่งจ่าย / หนี้
              </p>
              <div className="grid gap-2 rounded-lg border p-4 text-sm">
                {splitModeLabel && <Row label="โหมดแบ่ง" value={splitModeLabel} />}
                {paymentLabel && (
                  <Row label="วิธีจ่าย" value={paymentLabel} icon={<Wallet className="size-3.5" />} />
                )}
                {result.debtTracking != null && (
                  <Row
                    label="ติดตามหนี้"
                    value={result.debtTracking ? 'เปิด' : 'ปิด'}
                  />
                )}
                {result.payers && result.payers.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-muted-foreground">ผู้จ่าย</span>
                    {result.payers.map((p, i) => (
                      <div key={i} className="flex justify-between gap-4 pl-2">
                        <span>{p.name}</span>
                        <span className="tabular-nums font-medium">
                          {p.amount.toLocaleString()} {currency}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {result.shares && result.shares.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-muted-foreground">ส่วนแบ่ง</span>
                    {result.shares.map((s, i) => (
                      <div key={i} className="flex justify-between gap-4 pl-2">
                        <span>{s.name}</span>
                        <span className="tabular-nums font-medium">
                          {s.amount.toLocaleString()} {currency}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {hasItems && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                รายการสินค้า ({result.items!.length})
              </p>
              <div className="max-h-40 space-y-2 overflow-y-auto">
                {result.items!.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Receipt className="size-3.5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.category}</p>
                      </div>
                    </div>
                    <span className="ml-2 shrink-0 font-semibold tabular-nums">
                      {item.price.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ยกเลิก
          </Button>
          <Button
            className="gap-1"
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
          >
            <Check className="size-4" />
            เปิดฟอร์มแก้ไข / บันทึก
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Row({
  label,
  value,
  highlight,
  icon,
}: {
  label: string
  value: string
  highlight?: boolean
  icon?: React.ReactNode
}) {
  return (
    <div className="flex justify-between gap-4">
      <span className="shrink-0 text-muted-foreground flex items-center gap-1.5">
        {icon}
        {label}
      </span>
      <span className={highlight ? 'text-right font-semibold' : 'text-right'}>{value}</span>
    </div>
  )
}
