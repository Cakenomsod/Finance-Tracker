import { webhook, messagingApi } from '@line/bot-sdk';
import { getLineClient, downloadMessageContent } from './sdk';
import {
  buildReviewFlexMessages,
  createSuccessFlexMessage,
  createLinkPromptFlexMessage,
  type LineReviewDraftView,
  type LineTxType,
} from './flex-messages';
import { parseExpenseTextWithProvider, parseReceiptImageWithProvider } from '@/lib/ai';
import { getUserAiSettings } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { ReceiptParseResult } from '@/lib/ai/receipt-schema';
import { isAppCurrency } from '@/lib/currency';
import { currencySymbol } from '@/lib/currency';

export async function handleLineEvent(event: webhook.Event) {
  if (event.type !== 'message' && event.type !== 'postback') return;
  if (!event.source || !event.source.userId) return;
  const lineUserId = event.source.userId;

  if (!('replyToken' in event) || !event.replyToken) return;
  const replyToken = event.replyToken;

  const client = getLineClient();

  try {
    const usersSnapshot = await adminDb()
      .collection('users')
      .where('lineUserId', '==', lineUserId)
      .limit(1)
      .get();

    const userDoc = usersSnapshot.docs[0];

    if (!userDoc) {
      if (event.type === 'message' && event.message.type === 'text') {
        const text = event.message.text.trim();
        const match = text.match(/^\/link\s+([a-zA-Z0-9-]+)$/i);
        if (match) {
          const tokenStr = match[1];
          const tokenDocs = await adminDb()
            .collection('line_linking_tokens')
            .where('token', '==', tokenStr)
            .get();

          if (!tokenDocs.empty) {
            const tokenDoc = tokenDocs.docs[0];
            const tokenData = tokenDoc.data();

            if (tokenData.expiresAt.toDate() > new Date()) {
              await adminDb().collection('users').doc(tokenData.userId).update({
                lineUserId: lineUserId,
              });

              await tokenDoc.ref.delete();

              await client.replyMessage({
                replyToken,
                messages: [
                  {
                    type: 'text',
                    text: '✅ เชื่อมต่อบัญชีสำเร็จ! ตอนนี้คุณสามารถพิมพ์รายจ่ายหรือส่งสลิปมาได้เลยครับ',
                  },
                ],
              });
              return;
            }
          }
          await client.replyMessage({
            replyToken,
            messages: [
              {
                type: 'text',
                text: '❌ รหัสเชื่อมต่อไม่ถูกต้อง หรือหมดอายุแล้ว กรุณากดสร้างรหัสใหม่ในเว็บครับ',
              },
            ],
          });
          return;
        }
      }

      await client.replyMessage({
        replyToken,
        messages: [
          {
            type: 'flex',
            altText: 'เชื่อมต่อบัญชี',
            contents: createLinkPromptFlexMessage(),
          },
        ],
      });
      return;
    }

    const userId = userDoc.id;
    const userData = userDoc.data();
    const currency = isAppCurrency(userData.currency) ? userData.currency : 'THB';

    if (event.type === 'message') {
      const message = event.message;
      const aiSettings = await getUserAiSettings(userId);
      const providerConfig = {
        provider: aiSettings.provider,
        localAiConfig:
          aiSettings.provider === 'local' && aiSettings.localAiBaseUrl
            ? { baseUrl: aiSettings.localAiBaseUrl }
            : undefined,
      };

      if (message.type === 'text') {
        const text = message.text.trim();
        const drafts = await parseExpenseTextWithProvider(text, providerConfig, { currency });

        if (drafts.length > 0) {
          await sendReviewMessages(client, replyToken, drafts, userId, currency);
        } else {
          await client.replyMessage({
            replyToken,
            messages: [
              {
                type: 'text',
                text: 'ขออภัยครับ ไม่สามารถวิเคราะห์ข้อมูลรายจ่ายได้ ลองพิมพ์ใหม่อีกครั้งครับ',
              },
            ],
          });
        }
      } else if (message.type === 'image') {
        const buffer = await downloadMessageContent(message.id);
        const draft = await parseReceiptImageWithProvider(buffer, 'image/jpeg', providerConfig, {
          currency,
        });
        await sendReviewMessages(client, replyToken, [draft], userId, currency);
      }
    } else if (event.type === 'postback') {
      const data = new URLSearchParams(event.postback.data);
      const action = data.get('action');
      const draftId = data.get('id');
      const batchId = data.get('batch');

      if (action === 'save' && draftId) {
        const result = await saveDraftTransaction(draftId, userId, currency);
        if (result.ok) {
          await client.replyMessage({
            replyToken,
            messages: [
              {
                type: 'flex',
                altText: 'บันทึกสำเร็จ',
                contents: createSuccessFlexMessage(result.message),
              },
            ],
          });
        } else {
          await client.replyMessage({
            replyToken,
            messages: [{ type: 'text', text: result.message }],
          });
        }
      } else if (action === 'cancel' && draftId) {
        const draftRef = adminDb().collection('line_drafts').doc(draftId);
        await draftRef.delete();
        await client.replyMessage({
          replyToken,
          messages: [{ type: 'text', text: 'ยกเลิกรายการเรียบร้อยแล้วครับ' }],
        });
      } else if (action === 'save_all' && batchId) {
        const result = await saveBatchTransactions(batchId, userId, currency);
        await client.replyMessage({
          replyToken,
          messages: [
            {
              type: 'flex',
              altText: 'บันทึกสำเร็จ',
              contents: createSuccessFlexMessage(result.message),
            },
          ],
        });
      } else if (action === 'cancel_all' && batchId) {
        const snap = await adminDb()
          .collection('line_drafts')
          .where('batchId', '==', batchId)
          .where('userId', '==', userId)
          .get();
        const batch = adminDb().batch();
        snap.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
        await client.replyMessage({
          replyToken,
          messages: [
            {
              type: 'text',
              text: `ยกเลิก ${snap.size} รายการเรียบร้อยแล้วครับ`,
            },
          ],
        });
      }
    }
  } catch (error) {
    console.error('Error handling LINE event:', error);
    try {
      await client.replyMessage({
        replyToken,
        messages: [
          {
            type: 'text',
            text: 'เกิดข้อผิดพลาดในการประมวลผล กรุณาลองใหม่อีกครั้งครับ',
          },
        ],
      });
    } catch {
      // Ignore
    }
  }
}

function toTxType(raw: unknown): LineTxType {
  if (raw === 'income' || raw === 'transfer') return raw;
  return 'expense';
}

function draftToView(
  draft: ReceiptParseResult,
  draftId: string,
  fallbackCurrency: string,
  index?: number,
  total?: number
): LineReviewDraftView {
  return {
    draftId,
    description: draft.description || 'รายการจาก LINE',
    category: draft.category || 'Others',
    amount: Math.abs(draft.totalAmount),
    currency: draft.currency || fallbackCurrency,
    date: draft.date || undefined,
    time: draft.time || undefined,
    txType: toTxType(draft.txType),
    accountHint: draft.accountHint,
    transferToAccountHint: draft.transferToAccountHint,
    index,
    total,
  };
}

function buildTransactionPayload(
  draftData: ReceiptParseResult,
  userId: string,
  fallbackCurrency: string
) {
  const txType = toTxType(draftData.txType);
  const rawAmount = Math.abs(draftData.totalAmount);
  const amount = txType === 'income' ? rawAmount : -rawAmount;
  const type = txType === 'income' ? 'income' : txType === 'transfer' ? 'transfer' : 'expense';
  const currency = draftData.currency || fallbackCurrency;

  let date: Timestamp | ReturnType<typeof FieldValue.serverTimestamp> =
    FieldValue.serverTimestamp();
  if (draftData.date) {
    const timePart =
      draftData.time && /^\d{1,2}:\d{2}$/.test(draftData.time) ? draftData.time : '12:00';
    const parsed = new Date(`${draftData.date}T${timePart}:00`);
    if (!Number.isNaN(parsed.getTime())) {
      date = Timestamp.fromDate(parsed);
    }
  }

  return {
    userId,
    amount,
    type,
    category: draftData.category || 'Others',
    description: draftData.description || 'รายการจาก LINE',
    date,
    paidBy: userId,
    splitWith: null,
    tripId: null,
    receiptUrl: null,
    source: 'line' as const,
    createdAt: FieldValue.serverTimestamp(),
    currency,
    ...(draftData.accountHint ? { accountHint: draftData.accountHint } : {}),
    ...(draftData.transferToAccountHint
      ? { transferToAccountHint: draftData.transferToAccountHint }
      : {}),
  };
}

async function saveDraftTransaction(
  draftId: string,
  userId: string,
  fallbackCurrency: string
): Promise<{ ok: boolean; message: string }> {
  const draftRef = adminDb().collection('line_drafts').doc(draftId);
  const draftSnap = await draftRef.get();

  if (!draftSnap.exists) {
    return {
      ok: false,
      message: '❌ ไม่พบรายการนี้ หรือรายการนี้ถูกบันทึก/ยกเลิกไปแล้วครับ',
    };
  }

  const draftData = draftSnap.data() as ReceiptParseResult & { userId?: string };
  if (draftData.userId && draftData.userId !== userId) {
    return { ok: false, message: '❌ ไม่มีสิทธิ์บันทึกรายการนี้ครับ' };
  }

  await adminDb()
    .collection('transactions')
    .add(buildTransactionPayload(draftData, userId, fallbackCurrency));
  await draftRef.delete();

  const txType = toTxType(draftData.txType);
  const rawCur = draftData.currency || fallbackCurrency;
  const symbol = currencySymbol(isAppCurrency(rawCur) ? rawCur : 'THB');
  const label =
    txType === 'income' ? 'รายรับ' : txType === 'transfer' ? 'โอน' : 'รายจ่าย';

  return {
    ok: true,
    message: `บันทึก${label}「${draftData.description || 'รายการ'}」 ${symbol}${Math.abs(draftData.totalAmount)} เรียบร้อยแล้ว`,
  };
}

async function saveBatchTransactions(
  batchId: string,
  userId: string,
  fallbackCurrency: string
): Promise<{ ok: boolean; message: string }> {
  const snap = await adminDb()
    .collection('line_drafts')
    .where('batchId', '==', batchId)
    .where('userId', '==', userId)
    .get();

  if (snap.empty) {
    return {
      ok: false,
      message: '❌ ไม่พบรายการชุดนี้ หรือบันทึกไปแล้วครับ',
    };
  }

  const writeBatch = adminDb().batch();
  for (const doc of snap.docs) {
    const draftData = doc.data() as ReceiptParseResult;
    const txRef = adminDb().collection('transactions').doc();
    writeBatch.set(txRef, buildTransactionPayload(draftData, userId, fallbackCurrency));
    writeBatch.delete(doc.ref);
  }
  await writeBatch.commit();

  return {
    ok: true,
    message: `บันทึก ${snap.size} รายการเรียบร้อยแล้ว`,
  };
}

async function sendReviewMessages(
  client: messagingApi.MessagingApiClient,
  replyToken: string,
  drafts: ReceiptParseResult[],
  userId: string,
  currency: string
) {
  const batchId = drafts.length > 1 ? adminDb().collection('line_drafts').doc().id : undefined;

  const views: LineReviewDraftView[] = [];
  for (let i = 0; i < drafts.length; i++) {
    const draft = drafts[i];
    const draftRef = await adminDb().collection('line_drafts').add({
      ...draft,
      userId,
      ...(batchId ? { batchId } : {}),
      createdAt: FieldValue.serverTimestamp(),
    });
    views.push(
      draftToView(draft, draftRef.id, currency, drafts.length > 1 ? i + 1 : undefined, drafts.length)
    );
  }

  const messages = buildReviewFlexMessages(views, { batchId, currency });
  await client.replyMessage({ replyToken, messages });
}
