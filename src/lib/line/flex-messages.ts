import { messagingApi } from '@line/bot-sdk';
import { currencySymbol, isAppCurrency, type AppCurrency } from '@/lib/currency';

/** LINE Flex needs hex; aligned with DESIGN.md cooperative mint / expense red. */
const COLORS = {
  mint: '#0D9F6E',
  mintSoft: '#E8F7F1',
  expense: '#E11D48',
  expenseSoft: '#FEF1F2',
  transfer: '#2563EB',
  transferSoft: '#EFF6FF',
  ink: '#1A1F2E',
  muted: '#6B7280',
  border: '#E5E7EB',
  white: '#FFFFFF',
  surface: '#F8FAFC',
} as const;

const CATEGORY_TH: Record<string, string> = {
  'Food & Dining': 'อาหาร',
  Transport: 'เดินทาง',
  Shopping: 'ช้อปปิ้ง',
  Entertainment: 'บันเทิง',
  'Bills & Utilities': 'บิล/สาธารณูปโภค',
  'Health & Fitness': 'สุขภาพ',
  Accommodation: 'ที่พัก',
  Activities: 'กิจกรรม',
  Others: 'อื่นๆ',
  Other: 'อื่นๆ',
};

export type LineTxType = 'income' | 'expense' | 'transfer';

export interface LineReviewDraftView {
  draftId: string;
  description: string;
  category: string;
  amount: number;
  currency: string;
  date?: string;
  time?: string;
  txType?: LineTxType;
  accountHint?: string;
  transferToAccountHint?: string;
  /** 1-based index when showing multiple */
  index?: number;
  total?: number;
}

function txMeta(txType: LineTxType = 'expense') {
  if (txType === 'income') {
    return {
      label: 'รายรับ',
      color: COLORS.mint,
      soft: COLORS.mintSoft,
      amountPrefix: '+',
    };
  }
  if (txType === 'transfer') {
    return {
      label: 'โอนเงิน',
      color: COLORS.transfer,
      soft: COLORS.transferSoft,
      amountPrefix: '',
    };
  }
  return {
    label: 'รายจ่าย',
    color: COLORS.expense,
    soft: COLORS.expenseSoft,
    amountPrefix: '−',
  };
}

function formatAmount(amount: number, currency: string, prefix = ''): string {
  const code = isAppCurrency(currency) ? currency : 'THB';
  const symbol = currencySymbol(code as AppCurrency);
  const abs = Math.abs(amount);
  const formatted = new Intl.NumberFormat('th-TH', {
    maximumFractionDigits: code === 'JPY' || code === 'KRW' ? 0 : 2,
    minimumFractionDigits: 0,
  }).format(abs);
  return `${prefix}${symbol}${formatted}`;
}

function formatThaiDate(iso?: string): string {
  if (!iso) return 'วันนี้';
  const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function categoryLabel(category: string): string {
  return CATEGORY_TH[category] || category || '—';
}

function infoRow(label: string, value: string): messagingApi.FlexBox {
  return {
    type: 'box',
    layout: 'baseline',
    spacing: 'sm',
    contents: [
      {
        type: 'text',
        text: label,
        size: 'sm',
        color: COLORS.muted,
        flex: 2,
      },
      {
        type: 'text',
        text: value,
        size: 'sm',
        color: COLORS.ink,
        flex: 5,
        wrap: true,
        align: 'end',
      },
    ],
  };
}

function buildReviewBubble(view: LineReviewDraftView): messagingApi.FlexBubble {
  const txType = view.txType ?? 'expense';
  const meta = txMeta(txType);
  const indexLabel =
    view.index && view.total && view.total > 1
      ? ` · ${view.index}/${view.total}`
      : '';

  const rows: messagingApi.FlexComponent[] = [
    infoRow('หมวด', categoryLabel(view.category)),
    infoRow('วันที่', formatThaiDate(view.date)),
  ];
  if (view.time) rows.push(infoRow('เวลา', view.time));
  if (view.accountHint) rows.push(infoRow('บัญชี', view.accountHint));
  if (txType === 'transfer' && view.transferToAccountHint) {
    rows.push(infoRow('ไปยัง', view.transferToAccountHint));
  }

  return {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '16px',
      backgroundColor: meta.soft,
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            {
              type: 'box',
              layout: 'vertical',
              contents: [
                {
                  type: 'filler',
                },
                {
                  type: 'box',
                  layout: 'vertical',
                  contents: [],
                  width: '4px',
                  height: '14px',
                  backgroundColor: meta.color,
                  cornerRadius: '2px',
                },
                {
                  type: 'filler',
                },
              ],
              width: '4px',
              flex: 0,
            },
            {
              type: 'text',
              text: `${meta.label}${indexLabel}`,
              weight: 'bold',
              size: 'sm',
              color: meta.color,
              margin: 'md',
              flex: 1,
            },
          ],
        },
        {
          type: 'text',
          text: view.description || 'รายการจาก LINE',
          weight: 'bold',
          size: 'xl',
          color: COLORS.ink,
          margin: 'md',
          wrap: true,
          maxLines: 2,
        },
        {
          type: 'text',
          text: formatAmount(view.amount, view.currency, meta.amountPrefix),
          weight: 'bold',
          size: 'xxl',
          color: meta.color,
          margin: 'sm',
        },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      paddingAll: '16px',
      backgroundColor: COLORS.white,
      contents: [
        {
          type: 'separator',
          color: COLORS.border,
        },
        {
          type: 'box',
          layout: 'vertical',
          margin: 'lg',
          spacing: 'md',
          contents: rows,
        },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      paddingAll: '12px',
      backgroundColor: COLORS.surface,
      contents: [
        {
          type: 'button',
          style: 'primary',
          height: 'sm',
          color: meta.color,
          action: {
            type: 'postback',
            label: 'บันทึก',
            data: `action=save&id=${view.draftId}`,
            displayText: `บันทึก: ${view.description || 'รายการ'}`,
          },
        },
        {
          type: 'button',
          style: 'secondary',
          height: 'sm',
          color: COLORS.border,
          action: {
            type: 'postback',
            label: 'ยกเลิก',
            data: `action=cancel&id=${view.draftId}`,
            displayText: 'ยกเลิกรายการ',
          },
        },
      ],
    },
  };
}

function buildBatchSummaryBubble(opts: {
  batchId: string;
  count: number;
  expenseTotal: number;
  incomeTotal: number;
  currency: string;
}): messagingApi.FlexBubble {
  const { batchId, count, expenseTotal, incomeTotal, currency } = opts;
  const summaryRows: messagingApi.FlexComponent[] = [
    infoRow('จำนวน', `${count} รายการ`),
  ];
  if (expenseTotal > 0) {
    summaryRows.push(infoRow('รายจ่าย', formatAmount(expenseTotal, currency, '−')));
  }
  if (incomeTotal > 0) {
    summaryRows.push(infoRow('รายรับ', formatAmount(incomeTotal, currency, '+')));
  }

  return {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '16px',
      backgroundColor: COLORS.mintSoft,
      contents: [
        {
          type: 'text',
          text: 'ตรวจสอบรายการ',
          weight: 'bold',
          size: 'sm',
          color: COLORS.mint,
        },
        {
          type: 'text',
          text: `พบ ${count} รายการ`,
          weight: 'bold',
          size: 'xl',
          color: COLORS.ink,
          margin: 'md',
        },
        {
          type: 'text',
          text: 'เลื่อนดูแต่ละใบ แล้วกดบันทึกทีละรายการ หรือบันทึกทั้งหมด',
          size: 'sm',
          color: COLORS.muted,
          wrap: true,
          margin: 'sm',
        },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      paddingAll: '16px',
      contents: [
        {
          type: 'separator',
          color: COLORS.border,
        },
        {
          type: 'box',
          layout: 'vertical',
          margin: 'lg',
          spacing: 'md',
          contents: summaryRows,
        },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      paddingAll: '12px',
      backgroundColor: COLORS.surface,
      contents: [
        {
          type: 'button',
          style: 'primary',
          height: 'sm',
          color: COLORS.mint,
          action: {
            type: 'postback',
            label: 'บันทึกทั้งหมด',
            data: `action=save_all&batch=${batchId}`,
            displayText: `บันทึกทั้งหมด ${count} รายการ`,
          },
        },
        {
          type: 'button',
          style: 'secondary',
          height: 'sm',
          color: COLORS.border,
          action: {
            type: 'postback',
            label: 'ยกเลิกทั้งหมด',
            data: `action=cancel_all&batch=${batchId}`,
            displayText: 'ยกเลิกทั้งหมด',
          },
        },
      ],
    },
  };
}

/** Single review card (legacy-compatible entry). */
export function createReviewExpenseFlexMessage(
  summaryOrView: string | LineReviewDraftView,
  draftId?: string
): messagingApi.FlexContainer {
  if (typeof summaryOrView === 'string') {
    return buildReviewBubble({
      draftId: draftId || '',
      description: summaryOrView.split('\n').find((l) => l.startsWith('รายการ:'))?.replace('รายการ:', '').trim() || 'รายการจาก LINE',
      category: summaryOrView.split('\n').find((l) => l.startsWith('หมวดหมู่:'))?.replace('หมวดหมู่:', '').trim() || 'Others',
      amount: Number(summaryOrView.match(/฿([\d,.]+)/)?.[1]?.replace(/,/g, '') || 0) || 0,
      currency: 'THB',
    });
  }
  return buildReviewBubble(summaryOrView);
}

/** Carousel of review cards; prepends batch summary when batchId is set. */
export function createReviewCarouselFlexMessage(
  views: LineReviewDraftView[],
  opts?: { batchId?: string; currency?: string }
): messagingApi.FlexContainer {
  const bubbles: messagingApi.FlexBubble[] = [];
  const currency = opts?.currency || views[0]?.currency || 'THB';

  if (opts?.batchId && views.length > 1) {
    let expenseTotal = 0;
    let incomeTotal = 0;
    for (const v of views) {
      const t = v.txType ?? 'expense';
      const amt = Math.abs(v.amount);
      if (t === 'income') incomeTotal += amt;
      else if (t !== 'transfer') expenseTotal += amt;
    }
    bubbles.push(
      buildBatchSummaryBubble({
        batchId: opts.batchId,
        count: views.length,
        expenseTotal,
        incomeTotal,
        currency,
      })
    );
  }

  const maxItems = Math.max(0, 12 - bubbles.length);
  for (const view of views.slice(0, maxItems)) {
    bubbles.push(buildReviewBubble(view));
  }

  if (bubbles.length === 1) return bubbles[0];

  return {
    type: 'carousel',
    contents: bubbles,
  };
}

/** Chunk views into carousel FlexMessages (LINE allows ≤12 bubbles / carousel, ≤5 messages). */
export function buildReviewFlexMessages(
  views: LineReviewDraftView[],
  opts?: { batchId?: string; currency?: string }
): messagingApi.Message[] {
  if (views.length === 0) return [];

  if (views.length === 1) {
    return [
      {
        type: 'flex',
        altText: `ตรวจสอบ: ${views[0].description || 'รายการ'}`,
        contents: buildReviewBubble(views[0]),
      },
    ];
  }

  const messages: messagingApi.Message[] = [
    {
      type: 'text',
      text: `พบ ${views.length} รายการ — เลื่อนดูการ์ดแล้วกดบันทึกได้ทีละใบ หรือบันทึกทั้งหมด`,
    },
  ];

  // First carousel: summary + up to 11 items
  const firstChunkSize = opts?.batchId ? 11 : 12;
  const firstChunk = views.slice(0, firstChunkSize);
  messages.push({
    type: 'flex',
    altText: `ตรวจสอบ ${views.length} รายการ`,
    contents: createReviewCarouselFlexMessage(firstChunk, opts),
  });

  // Remaining carousels (no summary), leave room under 5-message reply limit
  let offset = firstChunkSize;
  while (offset < views.length && messages.length < 5) {
    const chunk = views.slice(offset, offset + 12);
    messages.push({
      type: 'flex',
      altText: `รายการต่อ (${offset + 1}–${offset + chunk.length})`,
      contents: {
        type: 'carousel',
        contents: chunk.map(buildReviewBubble),
      },
    });
    offset += 12;
  }

  if (offset < views.length && messages[0]?.type === 'text') {
    messages[0] = {
      type: 'text',
      text: `พบ ${views.length} รายการ (แสดง ${offset} รายการแรก) — พิมพ์ช่วงที่เหลือแยกส่งอีกครั้งได้ครับ`,
    };
  }

  return messages;
}

export function createSuccessFlexMessage(message: string): messagingApi.FlexContainer {
  return {
    type: 'bubble',
    size: 'kilo',
    header: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '16px',
      backgroundColor: COLORS.mintSoft,
      contents: [
        {
          type: 'text',
          text: 'บันทึกสำเร็จ',
          weight: 'bold',
          size: 'lg',
          color: COLORS.mint,
        },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '16px',
      contents: [
        {
          type: 'text',
          text: message,
          wrap: true,
          color: COLORS.ink,
          size: 'md',
        },
      ],
    },
  };
}

export function createLinkPromptFlexMessage(): messagingApi.FlexContainer {
  return {
    type: 'bubble',
    size: 'kilo',
    header: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '16px',
      backgroundColor: COLORS.expenseSoft,
      contents: [
        {
          type: 'text',
          text: 'ยังไม่ได้เชื่อมต่อ',
          weight: 'bold',
          size: 'lg',
          color: COLORS.expense,
        },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '16px',
      contents: [
        {
          type: 'text',
          text: 'เปิด Finance Tracker บนเว็บ → หน้า LINE Bot → สร้างรหัส แล้วพิมพ์ /link รหัส ในแชทนี้',
          wrap: true,
          color: COLORS.ink,
          size: 'md',
        },
      ],
    },
  };
}
