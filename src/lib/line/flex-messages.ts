import { messagingApi } from '@line/bot-sdk';
import { currencySymbol, isAppCurrency, type AppCurrency } from '@/lib/currency';
import { categoryLabel } from '@/lib/default-categories';
import { intlLocale, pick } from '@/lib/i18n';
import type { AppLocale } from '@/lib/locale';

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

/** Shorter Thai labels than the app-wide ones; they fit the narrow Flex value column. */
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
  /** Resolved account name (falls back to the raw hint when no account matched) */
  accountHint?: string;
  transferToAccountHint?: string;
  /** Why this currency, already localized: "as typed" / "from account Wise" / "main currency" */
  currencyNote?: string;
  /** 1-based index when showing multiple */
  index?: number;
  total?: number;
}

/** Fallback description for drafts without one. */
export function lineDefaultDescription(locale: AppLocale): string {
  return pick(locale, { th: 'รายการจาก LINE', en: 'LINE entry', zh: 'LINE 记录' });
}

function itemWord(locale: AppLocale): string {
  return pick(locale, { th: 'รายการ', en: 'entry', zh: '记录' });
}

function countLabel(count: number, locale: AppLocale): string {
  return pick(locale, {
    th: `${count} รายการ`,
    en: `${count} ${count === 1 ? 'entry' : 'entries'}`,
    zh: `${count} 笔`,
  });
}

function txMeta(txType: LineTxType = 'expense', locale: AppLocale) {
  if (txType === 'income') {
    return {
      label: pick(locale, { th: 'รายรับ', en: 'Income', zh: '收入' }),
      color: COLORS.mint,
      soft: COLORS.mintSoft,
      amountPrefix: '+',
    };
  }
  if (txType === 'transfer') {
    return {
      label: pick(locale, { th: 'โอนเงิน', en: 'Transfer', zh: '转账' }),
      color: COLORS.transfer,
      soft: COLORS.transferSoft,
      amountPrefix: '',
    };
  }
  return {
    label: pick(locale, { th: 'รายจ่าย', en: 'Expense', zh: '支出' }),
    color: COLORS.expense,
    soft: COLORS.expenseSoft,
    amountPrefix: '−',
  };
}

function formatAmount(amount: number, currency: string, locale: AppLocale, prefix = ''): string {
  const code = isAppCurrency(currency) ? currency : 'THB';
  const symbol = currencySymbol(code as AppCurrency);
  const abs = Math.abs(amount);
  const formatted = new Intl.NumberFormat(intlLocale(locale), {
    maximumFractionDigits: code === 'JPY' || code === 'KRW' ? 0 : 2,
    minimumFractionDigits: 0,
  }).format(abs);
  return `${prefix}${symbol}${formatted}`;
}

function formatDate(locale: AppLocale, iso?: string): string {
  if (!iso) return pick(locale, { th: 'วันนี้', en: 'Today', zh: '今天' });
  const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(intlLocale(locale), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function displayCategory(category: string, locale: AppLocale): string {
  if (!category) return '—';
  if (locale === 'th') return CATEGORY_TH[category] || categoryLabel(category, 'th');
  return categoryLabel(category === 'Other' ? 'Others' : category, locale);
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

function buildReviewBubble(view: LineReviewDraftView, locale: AppLocale): messagingApi.FlexBubble {
  const txType = view.txType ?? 'expense';
  const meta = txMeta(txType, locale);
  const indexLabel =
    view.index && view.total && view.total > 1
      ? ` · ${view.index}/${view.total}`
      : '';

  const rows: messagingApi.FlexComponent[] = [
    infoRow(pick(locale, { th: 'หมวด', en: 'Category', zh: '分类' }), displayCategory(view.category, locale)),
    infoRow(pick(locale, { th: 'วันที่', en: 'Date', zh: '日期' }), formatDate(locale, view.date)),
  ];
  if (view.time) rows.push(infoRow(pick(locale, { th: 'เวลา', en: 'Time', zh: '时间' }), view.time));
  if (view.accountHint) {
    rows.push(
      infoRow(
        txType === 'transfer'
          ? pick(locale, { th: 'จาก', en: 'From', zh: '转出' })
          : pick(locale, { th: 'บัญชี', en: 'Account', zh: '账户' }),
        view.accountHint
      )
    );
  }
  if (txType === 'transfer' && view.transferToAccountHint) {
    rows.push(infoRow(pick(locale, { th: 'ไปยัง', en: 'To', zh: '转入' }), view.transferToAccountHint));
  }
  rows.push(
    infoRow(
      pick(locale, { th: 'สกุลเงิน', en: 'Currency', zh: '币种' }),
      view.currencyNote ? `${view.currency} · ${view.currencyNote}` : view.currency
    )
  );

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
          type: 'text',
          text: `${meta.label}${indexLabel}`,
          weight: 'bold',
          size: 'sm',
          color: meta.color,
        },
        {
          type: 'text',
          text: view.description || lineDefaultDescription(locale),
          weight: 'bold',
          size: 'xl',
          color: COLORS.ink,
          margin: 'md',
          wrap: true,
          maxLines: 2,
        },
        {
          type: 'text',
          text: formatAmount(view.amount, view.currency, locale, meta.amountPrefix),
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
            label: pick(locale, { th: 'บันทึก', en: 'Save', zh: '保存' }),
            data: `action=save&id=${view.draftId}`,
            displayText: pick(locale, {
              th: `บันทึก: ${view.description || 'รายการ'}`,
              en: `Save: ${view.description || 'entry'}`,
              zh: `保存：${view.description || '记录'}`,
            }),
          },
        },
        {
          type: 'button',
          style: 'secondary',
          height: 'sm',
          color: COLORS.border,
          action: {
            type: 'postback',
            label: pick(locale, { th: 'ยกเลิก', en: 'Cancel', zh: '取消' }),
            data: `action=cancel&id=${view.draftId}`,
            displayText: pick(locale, { th: 'ยกเลิกรายการ', en: 'Cancel entry', zh: '取消记录' }),
          },
        },
      ],
    },
  };
}

function formatTotals(totals: Map<string, number>, prefix: string, locale: AppLocale): string {
  return [...totals.entries()]
    .filter(([, amt]) => amt > 0)
    .map(([cur, amt]) => formatAmount(amt, cur, locale, prefix))
    .join(' · ');
}

function buildBatchSummaryBubble(opts: {
  batchId: string;
  count: number;
  /** Totals per currency — never summed across currencies */
  expenseTotals: Map<string, number>;
  incomeTotals: Map<string, number>;
  locale: AppLocale;
}): messagingApi.FlexBubble {
  const { batchId, count, expenseTotals, incomeTotals, locale } = opts;
  const summaryRows: messagingApi.FlexComponent[] = [
    infoRow(pick(locale, { th: 'จำนวน', en: 'Count', zh: '数量' }), countLabel(count, locale)),
  ];
  const expenseText = formatTotals(expenseTotals, '−', locale);
  const incomeText = formatTotals(incomeTotals, '+', locale);
  if (expenseText) summaryRows.push(infoRow(pick(locale, { th: 'รายจ่าย', en: 'Expense', zh: '支出' }), expenseText));
  if (incomeText) summaryRows.push(infoRow(pick(locale, { th: 'รายรับ', en: 'Income', zh: '收入' }), incomeText));

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
          text: pick(locale, { th: 'ตรวจสอบรายการ', en: 'Review entries', zh: '核对记录' }),
          weight: 'bold',
          size: 'sm',
          color: COLORS.mint,
        },
        {
          type: 'text',
          text: pick(locale, {
            th: `พบ ${count} รายการ`,
            en: `Found ${countLabel(count, 'en')}`,
            zh: `识别到 ${count} 笔记录`,
          }),
          weight: 'bold',
          size: 'xl',
          color: COLORS.ink,
          margin: 'md',
        },
        {
          type: 'text',
          text: pick(locale, {
            th: 'เลื่อนดูแต่ละใบ แล้วกดบันทึกทีละรายการ หรือบันทึกทั้งหมด',
            en: 'Swipe through the cards and save them one by one, or save all.',
            zh: '左右滑动查看，逐笔保存或全部保存。',
          }),
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
            label: pick(locale, { th: 'บันทึกทั้งหมด', en: 'Save all', zh: '全部保存' }),
            data: `action=save_all&batch=${batchId}`,
            displayText: pick(locale, {
              th: `บันทึกทั้งหมด ${count} รายการ`,
              en: `Save all ${countLabel(count, 'en')}`,
              zh: `全部保存 ${count} 笔`,
            }),
          },
        },
        {
          type: 'button',
          style: 'secondary',
          height: 'sm',
          color: COLORS.border,
          action: {
            type: 'postback',
            label: pick(locale, { th: 'ยกเลิกทั้งหมด', en: 'Cancel all', zh: '全部取消' }),
            data: `action=cancel_all&batch=${batchId}`,
            displayText: pick(locale, { th: 'ยกเลิกทั้งหมด', en: 'Cancel all', zh: '全部取消' }),
          },
        },
      ],
    },
  };
}

/** Single review card (legacy-compatible entry). */
export function createReviewExpenseFlexMessage(
  summaryOrView: string | LineReviewDraftView,
  locale: AppLocale,
  draftId?: string
): messagingApi.FlexContainer {
  if (typeof summaryOrView === 'string') {
    return buildReviewBubble(
      {
        draftId: draftId || '',
        description:
          summaryOrView.split('\n').find((l) => l.startsWith('รายการ:'))?.replace('รายการ:', '').trim() ||
          lineDefaultDescription(locale),
        category:
          summaryOrView.split('\n').find((l) => l.startsWith('หมวดหมู่:'))?.replace('หมวดหมู่:', '').trim() ||
          'Others',
        amount: Number(summaryOrView.match(/฿([\d,.]+)/)?.[1]?.replace(/,/g, '') || 0) || 0,
        currency: 'THB',
      },
      locale
    );
  }
  return buildReviewBubble(summaryOrView, locale);
}

/** Carousel of review cards; prepends batch summary when batchId is set. */
export function createReviewCarouselFlexMessage(
  views: LineReviewDraftView[],
  locale: AppLocale,
  opts?: { batchId?: string; currency?: string; allViews?: LineReviewDraftView[] }
): messagingApi.FlexContainer {
  const bubbles: messagingApi.FlexBubble[] = [];
  const fallbackCurrency = opts?.currency || 'THB';

  if (opts?.batchId && views.length > 1) {
    const expenseTotals = new Map<string, number>();
    const incomeTotals = new Map<string, number>();
    for (const v of opts.allViews ?? views) {
      const t = v.txType ?? 'expense';
      if (t === 'transfer') continue;
      const totals = t === 'income' ? incomeTotals : expenseTotals;
      const cur = v.currency || fallbackCurrency;
      totals.set(cur, (totals.get(cur) ?? 0) + Math.abs(v.amount));
    }
    bubbles.push(
      buildBatchSummaryBubble({
        batchId: opts.batchId,
        count: (opts.allViews ?? views).length,
        expenseTotals,
        incomeTotals,
        locale,
      })
    );
  }

  const maxItems = Math.max(0, 12 - bubbles.length);
  for (const view of views.slice(0, maxItems)) {
    bubbles.push(buildReviewBubble(view, locale));
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
  locale: AppLocale,
  opts?: { batchId?: string; currency?: string }
): messagingApi.Message[] {
  if (views.length === 0) return [];

  if (views.length === 1) {
    return [
      {
        type: 'flex',
        altText: pick(locale, {
          th: `ตรวจสอบ: ${views[0].description || 'รายการ'}`,
          en: `Review: ${views[0].description || itemWord('en')}`,
          zh: `核对：${views[0].description || itemWord('zh')}`,
        }),
        contents: buildReviewBubble(views[0], locale),
      },
    ];
  }

  const count = views.length;
  const messages: messagingApi.Message[] = [
    {
      type: 'text',
      text: pick(locale, {
        th: `พบ ${count} รายการ — เลื่อนดูการ์ดแล้วกดบันทึกได้ทีละใบ หรือบันทึกทั้งหมด`,
        en: `Found ${countLabel(count, 'en')} — swipe through the cards and save one by one, or save all.`,
        zh: `识别到 ${count} 笔记录 — 滑动查看卡片，逐笔保存或全部保存。`,
      }),
    },
  ];

  // First carousel: summary + up to 11 items
  const firstChunkSize = opts?.batchId ? 11 : 12;
  const firstChunk = views.slice(0, firstChunkSize);
  messages.push({
    type: 'flex',
    altText: pick(locale, {
      th: `ตรวจสอบ ${count} รายการ`,
      en: `Review ${countLabel(count, 'en')}`,
      zh: `核对 ${count} 笔记录`,
    }),
    contents: createReviewCarouselFlexMessage(firstChunk, locale, { ...opts, allViews: views }),
  });

  // Remaining carousels (no summary), leave room under 5-message reply limit
  let offset = firstChunkSize;
  while (offset < views.length && messages.length < 5) {
    const chunk = views.slice(offset, offset + 12);
    const range = `${offset + 1}–${offset + chunk.length}`;
    messages.push({
      type: 'flex',
      altText: pick(locale, {
        th: `รายการต่อ (${range})`,
        en: `More entries (${range})`,
        zh: `更多记录（${range}）`,
      }),
      contents: {
        type: 'carousel',
        contents: chunk.map((view) => buildReviewBubble(view, locale)),
      },
    });
    offset += 12;
  }

  if (offset < views.length && messages[0]?.type === 'text') {
    messages[0] = {
      type: 'text',
      text: pick(locale, {
        th: `พบ ${count} รายการ (แสดง ${offset} รายการแรก) — พิมพ์ช่วงที่เหลือแยกส่งอีกครั้งได้ครับ`,
        en: `Found ${countLabel(count, 'en')} (showing the first ${offset}) — please send the rest in a separate message.`,
        zh: `识别到 ${count} 笔记录（仅显示前 ${offset} 笔）— 剩余部分请另发一条消息。`,
      }),
    };
  }

  return messages;
}

export function createSuccessFlexMessage(message: string, locale: AppLocale): messagingApi.FlexContainer {
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
          text: lineSavedTitle(locale),
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

/** Title / altText of the success card. */
export function lineSavedTitle(locale: AppLocale): string {
  return pick(locale, { th: 'บันทึกสำเร็จ', en: 'Saved', zh: '已保存' });
}

/** Title / altText of the link prompt. */
export function lineLinkPromptTitle(locale: AppLocale): string {
  return pick(locale, { th: 'เชื่อมบัญชีก่อนเริ่มใช้', en: 'Link your account first', zh: '请先绑定账户' });
}

export function createLinkPromptFlexMessage(locale: AppLocale, appUrl?: string): messagingApi.FlexContainer {
  return {
    type: 'bubble',
    size: 'kilo',
    header: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '16px',
      backgroundColor: COLORS.surface,
      contents: [
        {
          type: 'text',
          text: lineLinkPromptTitle(locale),
          weight: 'bold',
          size: 'lg',
          color: COLORS.ink,
        },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '16px',
      spacing: 'sm',
      contents: [
        {
          type: 'text',
          text: pick(locale, {
            th: '1. เปิดหน้า LINE Bot บนเว็บ แล้วกด "สร้างรหัส"',
            en: '1. Open the LINE Bot page on the web and tap "Create code".',
            zh: '1. 在网页上打开 LINE Bot 页面，点击“生成代码”。',
          }),
          wrap: true,
          color: COLORS.ink,
          size: 'sm',
        },
        {
          type: 'text',
          text: pick(locale, {
            th: '2. ส่งรหัส 6 ตัวมาในแชทนี้ (พิมพ์แค่รหัส หรือ /link รหัส ก็ได้)',
            en: '2. Send the 6-character code in this chat (just the code, or /link CODE).',
            zh: '2. 在此聊天中发送 6 位代码（直接发代码，或 /link 代码）。',
          }),
          wrap: true,
          color: COLORS.ink,
          size: 'sm',
        },
      ],
    },
    ...(appUrl
      ? {
          footer: {
            type: 'box' as const,
            layout: 'vertical' as const,
            paddingAll: '12px',
            contents: [
              {
                type: 'button' as const,
                style: 'primary' as const,
                height: 'sm' as const,
                color: COLORS.mint,
                action: {
                  type: 'uri' as const,
                  label: pick(locale, { th: 'เปิดหน้าเชื่อมต่อ', en: 'Open link page', zh: '打开绑定页面' }),
                  uri: `${appUrl}/line`,
                },
              },
            ],
          },
        }
      : {}),
  };
}

/** Plain-text usage tips (linked users, "help", follow). */
export function lineUsageText(locale: AppLocale, name?: string): string {
  if (locale === 'en') {
    return [
      name ? `Hi ${name} 👋` : 'Ready to record 👋',
      'Just type entries like:',
      '• Chicken rice 60',
      '• Ramen 1200 yen Wise  (currency + account)',
      '• Coffee 80 kbank\n  Snacks 45 cash  (several lines = several entries)',
      '• Transfer 500 from scb to kbank',
      'Or send a photo of a slip/receipt.',
      "If you don't type a currency, the account's currency is used automatically.",
    ].join('\n');
  }
  if (locale === 'zh') {
    return [
      name ? `你好，${name} 👋` : '可以开始记账了 👋',
      '直接输入记录，例如：',
      '• 海南鸡饭 60',
      '• 拉面 1200 日元 Wise  （币种 + 账户）',
      '• 咖啡 80 kbank\n  零食 45 现金  （多行 = 多笔记录）',
      '• 转账 500 从 scb 到 kbank',
      '也可以直接发送凭证/收据照片。',
      '未输入币种时，将自动使用该账户的币种。',
    ].join('\n');
  }
  return [
    name ? `สวัสดีครับคุณ ${name} 👋` : 'พร้อมบันทึกแล้วครับ 👋',
    'พิมพ์รายการแบบนี้ได้เลย:',
    '• ข้าวมันไก่ 60',
    '• ราเมน 1200 เยน Wise  (สกุลเงิน + บัญชี)',
    '• กาแฟ 80 kbank\n  ขนม 45 เงินสด  (หลายบรรทัด = หลายรายการ)',
    '• โอน 500 จาก scb ไป kbank',
    'หรือส่งรูปสลิป/ใบเสร็จมาได้เลย',
    'ถ้าไม่พิมพ์สกุลเงิน จะใช้สกุลของบัญชีนั้นให้อัตโนมัติ',
  ].join('\n');
}
