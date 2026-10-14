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
import type { DraftCurrencySource } from '@/lib/ai/draft-resolve'
import { useLocale } from '@/components/locale-provider'
import { categoryLabel } from '@/lib/default-categories'
import type { LocalizedText } from '@/lib/i18n'

const DOC_TYPE_LABELS: Record<ReceiptParseResult['documentType'], LocalizedText> = {
  receipt: { th: 'ใบเสร็จ', en: 'Receipt', zh: '收据' },
  transfer_slip: { th: 'สลิปโอนเงิน', en: 'Transfer slip', zh: '转账凭证' },
}

const CURRENCY_SOURCE_LABELS: Record<DraftCurrencySource, LocalizedText> = {
  parsed: { th: 'ตามที่พิมพ์', en: 'as typed', zh: '按输入' },
  account: { th: 'ตามสกุลเงินบัญชี', en: 'account currency', zh: '账户币种' },
  default: { th: 'สกุลเงินหลัก', en: 'main currency', zh: '主币种' },
}

export interface AiReceiptReviewTarget {
  currency: string
  currencySource: DraftCurrencySource
  accountName?: string
  transferToName?: string
}

export interface AiReceiptReviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  result: ReceiptParseResult | null
  defaultCurrency?: string
  /** Account + currency already resolved for this draft */
  target?: AiReceiptReviewTarget
  onConfirm: () => void
}

export function AiReceiptReviewDialog({
  open,
  onOpenChange,
  result,
  defaultCurrency = 'THB',
  target,
  onConfirm,
}: AiReceiptReviewDialogProps) {
  const { p, t, locale } = useLocale()
  if (!result) return null

  const currency = target?.currency || result.currency || defaultCurrency
  const accountLabel = target?.accountName
    ? target.transferToName
      ? `${target.accountName} → ${target.transferToName}`
      : target.accountName
    : null
  const hasItems = result.items && result.items.length > 0
  const hasSplit =
    (result.payers?.length ?? 0) > 0 ||
    (result.shares?.length ?? 0) > 0 ||
    !!result.splitMode
  const paymentLabel =
    result.paymentMethod === 'paotang'
      ? p({ th: 'เป๋าตัง', en: 'Paotang', zh: 'Paotang' })
      : result.paymentMethod === 'normal'
        ? p({ th: 'ปกติ', en: 'Regular', zh: '普通' })
        : null
  const splitModeLabel =
    result.splitMode === 'equal'
      ? p({ th: 'หารเท่าๆ กัน', en: 'Split equally', zh: '平均分摊' })
      : result.splitMode === 'custom'
        ? p({ th: 'กำหนดเอง', en: 'Custom', zh: '自定义' })
        : result.splitMode === 'solo'
          ? p({ th: 'คนเดียว', en: 'Just me', zh: '仅自己' })
          : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-5 text-primary" />
            {p({ th: 'ตรวจสอบข้อมูลจาก AI', en: 'Review AI result', zh: '检查 AI 识别结果' })}
          </DialogTitle>
          <DialogDescription>
            {p({
              th: 'AI แยกข้อมูลแล้ว — กรุณาตรวจสอบก่อนเปิดฟอร์มบันทึก',
              en: 'AI has read the details — check them before opening the form',
              zh: 'AI 已识别信息 — 请在打开表单前检查',
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{p(DOC_TYPE_LABELS[result.documentType])}</Badge>
            <Badge variant="outline">
              {currency}
              {target && (
                <span className="font-normal text-muted-foreground">
                  · {p(CURRENCY_SOURCE_LABELS[target.currencySource])}
                </span>
              )}
            </Badge>
            {result.taxMode && (
              <Badge variant="outline">
                {result.taxMode === 'exclusive'
                  ? p({ th: 'ภาษี แยกนอก', en: 'Tax excluded', zh: '税额另计' })
                  : p({ th: 'ภาษี รวมใน', en: 'Tax included', zh: '含税' })}
              </Badge>
            )}
          </div>

          <div className="grid gap-3 rounded-lg border p-4 text-sm">
            <Row label={p({ th: 'รายละเอียด', en: 'Details', zh: '详情' })} value={result.description} />
            <Row
              label={p({ th: 'หมวดหมู่', en: 'Category', zh: '分类' })}
              value={categoryLabel(result.category, locale)}
            />
            <Row label={p({ th: 'วันที่', en: 'Date', zh: '日期' })} value={result.date} />
            <Row label={p({ th: 'เวลา', en: 'Time', zh: '时间' })} value={normalizeAiTime(result.time)} />
            {accountLabel && (
              <Row
                label={p({ th: 'บัญชี', en: 'Account', zh: '账户' })}
                value={accountLabel}
                icon={<Wallet className="size-3.5" />}
              />
            )}
            <Row
              label={p({ th: 'ยอดรวม', en: 'Total', zh: '总额' })}
              value={`${result.totalAmount.toLocaleString()} ${currency}`}
              highlight
            />
            {result.baseAmount != null && (
              <Row
                label={p({ th: 'ยอดก่อนภาษี', en: 'Before tax', zh: '税前金额' })}
                value={result.baseAmount.toLocaleString()}
              />
            )}
            {result.taxAmount != null && (
              <Row label={p({ th: 'ภาษี', en: 'Tax', zh: '税额' })} value={result.taxAmount.toLocaleString()} />
            )}
            {result.discount != null && result.discount > 0 && (
              <Row
                label={p({ th: 'ส่วนลด', en: 'Discount', zh: '折扣' })}
                value={result.discount.toLocaleString()}
              />
            )}
          </div>

          {hasSplit && (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Users className="size-3.5" />
                {p({ th: 'แบ่งจ่าย / หนี้', en: 'Split / debts', zh: '分账 / 欠款' })}
              </p>
              <div className="grid gap-2 rounded-lg border p-4 text-sm">
                {splitModeLabel && (
                  <Row label={p({ th: 'โหมดแบ่ง', en: 'Split mode', zh: '分账方式' })} value={splitModeLabel} />
                )}
                {paymentLabel && (
                  <Row
                    label={p({ th: 'วิธีจ่าย', en: 'Payment', zh: '支付方式' })}
                    value={paymentLabel}
                    icon={<Wallet className="size-3.5" />}
                  />
                )}
                {result.debtTracking != null && (
                  <Row
                    label={p({ th: 'ติดตามหนี้', en: 'Track debts', zh: '记录欠款' })}
                    value={
                      result.debtTracking
                        ? p({ th: 'เปิด', en: 'On', zh: '开' })
                        : p({ th: 'ปิด', en: 'Off', zh: '关' })
                    }
                  />
                )}
                {result.payers && result.payers.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-muted-foreground">
                      {p({ th: 'ผู้จ่าย', en: 'Paid by', zh: '付款人' })}
                    </span>
                    {result.payers.map((payer, i) => (
                      <div key={i} className="flex justify-between gap-4 pl-2">
                        <span className="min-w-0 truncate">{payer.name}</span>
                        <span className="shrink-0 tabular-nums font-medium">
                          {payer.amount.toLocaleString()} {currency}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {result.shares && result.shares.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-muted-foreground">
                      {p({ th: 'ส่วนแบ่ง', en: 'Shares', zh: '分摊' })}
                    </span>
                    {result.shares.map((s, i) => (
                      <div key={i} className="flex justify-between gap-4 pl-2">
                        <span className="min-w-0 truncate">{s.name}</span>
                        <span className="shrink-0 tabular-nums font-medium">
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
                {p({ th: 'รายการสินค้า', en: 'Items', zh: '商品' })} ({result.items!.length})
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
                        <p className="text-xs text-muted-foreground">
                          {categoryLabel(item.category, locale)}
                        </p>
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
            {t('common.cancel')}
          </Button>
          <Button
            className="gap-1"
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
          >
            <Check className="size-4" />
            {p({ th: 'เปิดฟอร์มแก้ไข / บันทึก', en: 'Open form to edit / save', zh: '打开表单编辑 / 保存' })}
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
      <span className={highlight ? 'min-w-0 break-words text-right font-semibold' : 'min-w-0 break-words text-right'}>
        {value}
      </span>
    </div>
  )
}
