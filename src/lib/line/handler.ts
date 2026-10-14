import { webhook, messagingApi } from '@line/bot-sdk';
import { getLineClient, downloadMessageContent } from './sdk';
import { getLineConfig } from './config';
import {
  buildReviewFlexMessages,
  createSuccessFlexMessage,
  createLinkPromptFlexMessage,
  lineDefaultDescription,
  lineLinkPromptTitle,
  lineSavedTitle,
  lineUsageText,
  type LineReviewDraftView,
  type LineTxType,
} from './flex-messages';
import { intlLocale, pick } from '@/lib/i18n';
import { isAppLocale, type AppLocale } from '@/lib/locale';
import { parseExpenseTextWithProvider, parseReceiptImageWithProvider } from '@/lib/ai';
import { getUserAiSettings } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue, Timestamp, type DocumentSnapshot } from 'firebase-admin/firestore';
import type { ReceiptParseResult } from '@/lib/ai/receipt-schema';
import { currencySymbol, isAppCurrency, type AppCurrency } from '@/lib/currency';
import { aiTimeZoneFromContext } from '@/lib/ai/ai-datetime';
import { parseTripLocalDateTime } from '@/lib/trip-currency';
import { loadUserAccountsForAi } from '@/lib/ai/load-user-accounts';
import type { AiAccount } from '@/lib/ai/account-hint';
import { resolveDraftTarget, type DraftCurrencySource } from '@/lib/ai/draft-resolve';
import { deleteSlips, saveSlipForUser } from '@/lib/attachments/server';

type Client = messagingApi.MessagingApiClient;

/** Stored in line_drafts: parsed draft + what it resolved to at review time. */
type StoredDraft = ReceiptParseResult & {
  userId?: string;
  batchId?: string;
  accountId?: string;
  transferToAccountId?: string;
  currencySource?: DraftCurrencySource;
  timeZone?: string;
  /** `fs:` slip photo ids saved to Firebase Storage; copied onto the transaction. */
  attachmentIds?: string[];
};

const HELP_RE = /^(help|\?|วิธีใช้|ช่วยด้วย|เมนู|menu|帮助|菜单|使用说明)$/i;

/** Bot replies follow the app language; unlinked LINE users get Thai. */
function userLocale(userData: { locale?: unknown } | undefined): AppLocale {
  const value = userData?.locale;
  return typeof value === 'string' && isAppLocale(value) ? value : 'th';
}

/**
 * Accept what people actually send: "/link AB12CD", "link ab12cd", "เชื่อม AB12CD",
 * a bare 6-char code, full-width characters or zero-width spaces from copy/paste.
 */
export function extractLinkCode(raw: string): string | null {
  const text = raw.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  const prefixed = text.match(/^\/?\s*(?:link|เชื่อม(?:ต่อ)?)\s*[:：]?\s*([A-Za-z0-9-]{4,32})$/i);
  if (prefixed) return prefixed[1];
  if (/^(?=.*\d)(?=.*[A-Za-z])[A-Za-z0-9]{6}$/.test(text)) return text.toUpperCase();
  return null;
}

async function reply(client: Client, replyToken: string, messages: messagingApi.Message[]) {
  await client.replyMessage({ replyToken, messages });
}

const text = (t: string): messagingApi.TextMessage => ({ type: 'text', text: t });

async function findUserByLineId(lineUserId: string): Promise<DocumentSnapshot | undefined> {
  const snap = await adminDb()
    .collection('users')
    .where('lineUserId', '==', lineUserId)
    .limit(1)
    .get();
  return snap.docs[0];
}

async function linkAccount(
  client: Client,
  replyToken: string,
  lineUserId: string,
  code: string,
  currentLocale: AppLocale
): Promise<void> {
  const db = adminDb();
  const candidates = [...new Set([code, code.toUpperCase()])];
  const tokenSnap = await db
    .collection('line_linking_tokens')
    .where('token', 'in', candidates)
    .limit(1)
    .get();
  const tokenDoc = tokenSnap.docs[0];
  const tokenData = tokenDoc?.data();

  if (!tokenDoc || !tokenData || tokenData.expiresAt.toDate() <= new Date()) {
    if (tokenDoc) await tokenDoc.ref.delete();
    await reply(client, replyToken, [
      text(
        pick(currentLocale, {
          th: 'รหัสไม่ถูกต้องหรือหมดอายุแล้วครับ กด "สร้างรหัสใหม่" ในหน้า LINE Bot บนเว็บ แล้วส่งรหัสใหม่มาอีกครั้ง',
          en: 'This code is invalid or has expired. Tap "New code" on the LINE Bot page on the web, then send the new code here.',
          zh: '代码无效或已过期。请在网页的 LINE Bot 页面点击“重新生成代码”，然后重新发送新代码。',
        })
      ),
    ]);
    return;
  }

  const targetUser = await db.collection('users').doc(tokenData.userId).get();
  const locale = userLocale(targetUser.data());

  let displayName: string | undefined;
  let pictureUrl: string | undefined;
  try {
    const profile = await client.getProfile(lineUserId);
    displayName = profile.displayName;
    pictureUrl = profile.pictureUrl;
  } catch (error) {
    console.warn('[LINE] getProfile failed (linking continues):', error);
  }

  // One LINE account → one app user; drop any previous owner of this LINE ID.
  const previous = await db.collection('users').where('lineUserId', '==', lineUserId).get();
  const batch = db.batch();
  for (const doc of previous.docs) {
    if (doc.id === tokenData.userId) continue;
    batch.update(doc.ref, {
      lineUserId: FieldValue.delete(),
      lineDisplayName: FieldValue.delete(),
      linePictureUrl: FieldValue.delete(),
      lineLinkedAt: FieldValue.delete(),
    });
  }
  batch.update(db.collection('users').doc(tokenData.userId), {
    lineUserId,
    lineDisplayName: displayName ?? null,
    linePictureUrl: pictureUrl ?? null,
    lineLinkedAt: FieldValue.serverTimestamp(),
  });
  batch.delete(tokenDoc.ref);
  await batch.commit();

  await reply(client, replyToken, [
    text(pick(locale, { th: '✅ เชื่อมต่อบัญชีสำเร็จ', en: '✅ Account linked', zh: '✅ 账户绑定成功' })),
    text(lineUsageText(locale, displayName)),
  ]);
}

export async function handleLineEvent(event: webhook.Event) {
  if (event.type !== 'message' && event.type !== 'postback' && event.type !== 'follow') return;
  const lineUserId = event.source?.userId;
  if (!lineUserId) return;
  if (!('replyToken' in event) || !event.replyToken) return;
  const replyToken = event.replyToken;

  const client = getLineClient();
  const { appUrl } = getLineConfig();
  let locale: AppLocale = 'th';

  try {
    const incomingText =
      event.type === 'message' && event.message.type === 'text' ? event.message.text.trim() : '';

    // Linking works whether or not this LINE ID is already linked (re-link / switch account).
    const code = incomingText ? extractLinkCode(incomingText) : null;
    const userDoc = await findUserByLineId(lineUserId);
    locale = userLocale(userDoc?.data());

    if (code && (!userDoc || /link|เชื่อม/i.test(incomingText))) {
      await linkAccount(client, replyToken, lineUserId, code, locale);
      return;
    }

    if (!userDoc) {
      await reply(client, replyToken, [
        {
          type: 'flex',
          altText: lineLinkPromptTitle(locale),
          contents: createLinkPromptFlexMessage(locale, appUrl),
        },
      ]);
      return;
    }

    const userId = userDoc.id;
    const userData = userDoc.data() ?? {};
    const currency: AppCurrency = isAppCurrency(userData.currency) ? userData.currency : 'THB';
    const timeZone = aiTimeZoneFromContext({ currency });

    if (event.type === 'follow' || (incomingText && HELP_RE.test(incomingText))) {
      await reply(client, replyToken, [text(lineUsageText(locale, userData.lineDisplayName ?? undefined))]);
      return;
    }

    if (event.type === 'message') {
      const message = event.message;
      if (message.type !== 'text' && message.type !== 'image') {
        await reply(client, replyToken, [
          text(
            pick(locale, {
              th: 'ส่งเป็นข้อความหรือรูปสลิป/ใบเสร็จได้เลยครับ',
              en: 'Please send a text message or a photo of a slip/receipt.',
              zh: '请发送文字消息或凭证/收据照片。',
            })
          ),
        ]);
        return;
      }

      const [aiSettings, accounts] = await Promise.all([
        getUserAiSettings(userId),
        userData.accountsEnabled === true
          ? loadUserAccountsForAi(userId).catch(() => [] as AiAccount[])
          : Promise.resolve([] as AiAccount[]),
      ]);
      const providerConfig = {
        provider: aiSettings.provider,
        localAiConfig:
          aiSettings.provider === 'local' && aiSettings.localAiBaseUrl
            ? { baseUrl: aiSettings.localAiBaseUrl }
            : undefined,
      };

      const imageBuffer =
        message.type === 'image' ? await downloadMessageContent(message.id) : null;
      // Keep the slip alongside the parse; a storage failure must not block the entry itself.
      const slipUpload = imageBuffer
        ? saveSlipForUser(userId, imageBuffer, { source: 'line' }).catch((error) => {
            console.error('[LINE] slip upload failed:', error);
            return null;
          })
        : Promise.resolve(null);

      let drafts: ReceiptParseResult[];
      try {
        drafts = imageBuffer
          ? [
              await parseReceiptImageWithProvider(imageBuffer, 'image/jpeg', providerConfig, {
                currency,
              }),
            ]
          : await parseExpenseTextWithProvider(
              incomingText,
              providerConfig,
              { currency },
              undefined,
              accounts
            );
      } catch (error) {
        const orphan = await slipUpload;
        if (orphan) await deleteSlips([orphan]);
        throw error;
      }
      const slipId = await slipUpload;

      if (drafts.length === 0) {
        if (slipId) await deleteSlips([slipId]);
        await reply(client, replyToken, [
          text(
            pick(locale, {
              th: 'ยังอ่านรายการไม่ออกครับ ลองพิมพ์แบบ "ชื่อรายการ จำนวนเงิน" เช่น ข้าวมันไก่ 60 (พิมพ์ help ดูตัวอย่าง)',
              en: "Couldn't read an entry. Try \"name amount\", e.g. Chicken rice 60 (type help for examples).",
              zh: '无法识别记录。请按“名称 金额”输入，例如：海南鸡饭 60（输入 help 查看示例）。',
            })
          ),
        ]);
        return;
      }

      await sendReviewMessages(client, replyToken, drafts, {
        userId,
        currency,
        timeZone,
        accounts,
        accountsEnabled: userData.accountsEnabled === true,
        attachmentIds: slipId ? [slipId] : [],
        locale,
      });
      return;
    }

    if (event.type === 'postback') {
      const data = new URLSearchParams(event.postback.data);
      const action = data.get('action');
      const draftId = data.get('id');
      const batchId = data.get('batch');

      if (action === 'save' && draftId) {
        const result = await saveDraftTransaction(draftId, userId, currency, timeZone, locale);
        await reply(client, replyToken, [
          result.ok
            ? {
                type: 'flex',
                altText: lineSavedTitle(locale),
                contents: createSuccessFlexMessage(result.message, locale),
              }
            : text(result.message),
        ]);
      } else if (action === 'cancel' && draftId) {
        const draftRef = adminDb().collection('line_drafts').doc(draftId);
        const snap = await draftRef.get();
        if (snap.exists && snap.data()?.userId === userId) {
          await draftRef.delete();
          await deleteSlips((snap.data() as StoredDraft).attachmentIds);
        }
        await reply(client, replyToken, [
          text(pick(locale, { th: 'ยกเลิกรายการเรียบร้อยแล้วครับ', en: 'Entry cancelled.', zh: '记录已取消。' })),
        ]);
      } else if (action === 'save_all' && batchId) {
        const result = await saveBatchTransactions(batchId, userId, currency, timeZone, locale);
        await reply(client, replyToken, [
          result.ok
            ? {
                type: 'flex',
                altText: lineSavedTitle(locale),
                contents: createSuccessFlexMessage(result.message, locale),
              }
            : text(result.message),
        ]);
      } else if (action === 'cancel_all' && batchId) {
        const snap = await adminDb()
          .collection('line_drafts')
          .where('batchId', '==', batchId)
          .where('userId', '==', userId)
          .get();
        const batch = adminDb().batch();
        snap.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
        await deleteSlips([
          ...new Set(snap.docs.flatMap((doc) => (doc.data() as StoredDraft).attachmentIds ?? [])),
        ]);
        await reply(client, replyToken, [
          text(
            pick(locale, {
              th: `ยกเลิก ${snap.size} รายการเรียบร้อยแล้วครับ`,
              en: `Cancelled ${snap.size} ${snap.size === 1 ? 'entry' : 'entries'}.`,
              zh: `已取消 ${snap.size} 笔记录。`,
            })
          ),
        ]);
      }
    }
  } catch (error) {
    console.error('[LINE] handle event failed:', {
      type: event.type,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    try {
      await reply(client, replyToken, [
        text(
          pick(locale, {
            th: 'เกิดข้อผิดพลาดในการประมวลผล กรุณาลองใหม่อีกครั้งครับ',
            en: 'Something went wrong while processing. Please try again.',
            zh: '处理时出错，请重试。',
          })
        ),
      ]);
    } catch {
      // reply token may already be used
    }
  }
}

function toTxType(raw: unknown): LineTxType {
  if (raw === 'income' || raw === 'transfer') return raw;
  return 'expense';
}

/** Firestore rejects `undefined`; drafts from the AI pipeline carry plenty of them. */
function stripUndefined<T extends object>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function currencyNote(
  source: DraftCurrencySource | undefined,
  locale: AppLocale,
  accountName?: string
): string {
  if (source === 'parsed') return pick(locale, { th: 'ตามที่พิมพ์', en: 'as typed', zh: '按输入' });
  if (source === 'account') {
    return accountName
      ? pick(locale, { th: `ตามบัญชี ${accountName}`, en: `from ${accountName}`, zh: `按账户 ${accountName}` })
      : pick(locale, { th: 'ตามบัญชี', en: 'from account', zh: '按账户' });
  }
  return pick(locale, { th: 'สกุลหลัก', en: 'main currency', zh: '主币种' });
}

function txTypeLabel(txType: LineTxType, locale: AppLocale): string {
  if (txType === 'income') return pick(locale, { th: 'รายรับ', en: 'income', zh: '收入' });
  if (txType === 'transfer') return pick(locale, { th: 'โอน', en: 'transfer', zh: '转账' });
  return pick(locale, { th: 'รายจ่าย', en: 'expense', zh: '支出' });
}

function resolveDate(draft: StoredDraft, fallbackTz: string): Timestamp | FieldValue {
  if (draft.date) {
    const time = draft.time && /^\d{1,2}:\d{2}$/.test(draft.time) ? draft.time : '12:00';
    const parsed = parseTripLocalDateTime(draft.date, time, draft.timeZone || fallbackTz);
    if (!Number.isNaN(parsed.getTime())) return Timestamp.fromDate(parsed);
  }
  return FieldValue.serverTimestamp();
}

/** Transaction doc in the same shape the web form writes. */
function buildTransaction(draft: StoredDraft, userId: string, fallbackCurrency: string, fallbackTz: string, locale: AppLocale) {
  const txType = toTxType(draft.txType);
  const rawAmount = Math.abs(draft.totalAmount);
  // Same sign conventions as the web form: expense negative, income/transfer positive.
  const amount = txType === 'expense' ? -rawAmount : rawAmount;
  const currency = isAppCurrency(draft.currency) ? draft.currency : fallbackCurrency;

  const items = (draft.items ?? [])
    .filter((i) => i?.name?.trim() && Number.isFinite(i.price) && i.price > 0)
    .map((i) => ({ name: i.name.trim(), category: i.category || draft.category || 'Others', price: i.price }));

  const fields = stripUndefined({
    userId,
    amount,
    type: txType,
    category: txType === 'transfer' ? 'Transfer' : draft.category || 'Others',
    description: draft.description || lineDefaultDescription(locale),
    paidBy: txType === 'income' ? '' : 'Me',
    splitWith: null,
    tripId: null,
    receiptUrl: null,
    source: 'line' as const,
    currency,
    accountId: draft.accountId,
    transferToAccountId: txType === 'transfer' ? draft.transferToAccountId : undefined,
    items: items.length > 1 ? items : undefined,
    discount: draft.discount && draft.discount > 0 ? draft.discount : undefined,
    baseAmount: draft.baseAmount,
    taxAmount: draft.taxAmount,
    immichAssetIds: draft.attachmentIds?.length ? draft.attachmentIds : undefined,
  });
  // Sentinels/Timestamps are added after stripUndefined (JSON would mangle them).
  return {
    ...fields,
    date: resolveDate(draft, fallbackTz),
    createdAt: FieldValue.serverTimestamp(),
  };
}

async function saveDraftTransaction(
  draftId: string,
  userId: string,
  fallbackCurrency: string,
  timeZone: string,
  locale: AppLocale
): Promise<{ ok: boolean; message: string }> {
  const draftRef = adminDb().collection('line_drafts').doc(draftId);
  const draftSnap = await draftRef.get();
  if (!draftSnap.exists) {
    return {
      ok: false,
      message: pick(locale, {
        th: 'รายการนี้ถูกบันทึกหรือยกเลิกไปแล้วครับ',
        en: 'This entry was already saved or cancelled.',
        zh: '该记录已保存或已取消。',
      }),
    };
  }

  const draft = draftSnap.data() as StoredDraft;
  if (draft.userId && draft.userId !== userId) {
    return {
      ok: false,
      message: pick(locale, {
        th: 'ไม่มีสิทธิ์บันทึกรายการนี้ครับ',
        en: "You don't have permission to save this entry.",
        zh: '无权保存该记录。',
      }),
    };
  }

  await adminDb().collection('transactions').add(buildTransaction(draft, userId, fallbackCurrency, timeZone, locale));
  await draftRef.delete();

  const label = txTypeLabel(toTxType(draft.txType), locale);
  const cur = isAppCurrency(draft.currency) ? draft.currency : (fallbackCurrency as AppCurrency);
  const amount = `${currencySymbol(cur)}${Math.abs(draft.totalAmount).toLocaleString(intlLocale(locale))}`;
  return {
    ok: true,
    message: pick(locale, {
      th: `บันทึก${label}「${draft.description || 'รายการ'}」 ${amount} เรียบร้อยแล้ว`,
      en: `Saved ${label} "${draft.description || 'entry'}" ${amount}.`,
      zh: `已保存${label}「${draft.description || '记录'}」 ${amount}。`,
    }),
  };
}

async function saveBatchTransactions(
  batchId: string,
  userId: string,
  fallbackCurrency: string,
  timeZone: string,
  locale: AppLocale
): Promise<{ ok: boolean; message: string }> {
  const snap = await adminDb()
    .collection('line_drafts')
    .where('batchId', '==', batchId)
    .where('userId', '==', userId)
    .get();
  if (snap.empty) {
    return {
      ok: false,
      message: pick(locale, {
        th: 'รายการชุดนี้ถูกบันทึกหรือยกเลิกไปแล้วครับ',
        en: 'These entries were already saved or cancelled.',
        zh: '这批记录已保存或已取消。',
      }),
    };
  }

  const writeBatch = adminDb().batch();
  for (const doc of snap.docs) {
    const draft = doc.data() as StoredDraft;
    writeBatch.set(
      adminDb().collection('transactions').doc(),
      buildTransaction(draft, userId, fallbackCurrency, timeZone, locale)
    );
    writeBatch.delete(doc.ref);
  }
  await writeBatch.commit();
  return {
    ok: true,
    message: pick(locale, {
      th: `บันทึก ${snap.size} รายการเรียบร้อยแล้ว`,
      en: `Saved ${snap.size} ${snap.size === 1 ? 'entry' : 'entries'}.`,
      zh: `已保存 ${snap.size} 笔记录。`,
    }),
  };
}

async function sendReviewMessages(
  client: Client,
  replyToken: string,
  drafts: ReceiptParseResult[],
  ctx: {
    userId: string;
    currency: AppCurrency;
    timeZone: string;
    accounts: AiAccount[];
    accountsEnabled: boolean;
    attachmentIds: string[];
    locale: AppLocale;
  }
) {
  const db = adminDb();
  const batchId = drafts.length > 1 ? db.collection('line_drafts').doc().id : undefined;
  const nameOf = (id?: string) => (id ? ctx.accounts.find((a) => a.id === id)?.name : undefined);

  const writes = db.batch();
  const views: LineReviewDraftView[] = drafts.map((draft, i) => {
    const target = resolveDraftTarget(draft, ctx.accounts, ctx.currency, {
      fallbackToDefaultAccount: ctx.accountsEnabled,
    });
    const ref = db.collection('line_drafts').doc();
    const stored: StoredDraft = {
      ...draft,
      currency: target.currency,
      accountId: target.accountId,
      transferToAccountId: target.transferToAccountId,
      currencySource: target.currencySource,
      timeZone: ctx.timeZone,
      userId: ctx.userId,
      batchId,
      attachmentIds: ctx.attachmentIds,
    };
    writes.set(ref, { ...stripUndefined(stored), createdAt: FieldValue.serverTimestamp() });

    const accountName = nameOf(target.accountId);
    const txType = toTxType(draft.txType);
    return {
      draftId: ref.id,
      description: draft.description || lineDefaultDescription(ctx.locale),
      category: draft.category || 'Others',
      amount: Math.abs(draft.totalAmount),
      currency: target.currency,
      date: draft.date || undefined,
      time: draft.time || undefined,
      txType,
      accountHint: accountName ?? draft.accountHint,
      transferToAccountHint: nameOf(target.transferToAccountId) ?? draft.transferToAccountHint,
      currencyNote: currencyNote(target.currencySource, ctx.locale, accountName),
      index: drafts.length > 1 ? i + 1 : undefined,
      total: drafts.length,
    };
  });
  await writes.commit();

  await reply(
    client,
    replyToken,
    buildReviewFlexMessages(views, ctx.locale, { batchId, currency: ctx.currency })
  );
}
