import { webhook, messagingApi } from '@line/bot-sdk';
import { getLineClient, downloadMessageContent } from './sdk';
import { createReviewExpenseFlexMessage, createSuccessFlexMessage, createLinkPromptFlexMessage } from './flex-messages';
import { parseExpenseText, parseReceiptImage } from '@/lib/ai/gemma';
import { db } from '@/lib/firebase';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { ReceiptParseResult } from '@/lib/ai/receipt-schema';
import { createTransaction } from '@/lib/firestore';

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
                lineUserId: lineUserId
              });
              
              await tokenDoc.ref.delete();
              
              await client.replyMessage({
                replyToken,
                messages: [{ type: 'text', text: '✅ เชื่อมต่อบัญชีสำเร็จ! ตอนนี้คุณสามารถพิมพ์รายจ่ายหรือส่งสลิปมาได้เลยครับ' }]
              });
              return;
            }
          }
          await client.replyMessage({
            replyToken,
            messages: [{ type: 'text', text: '❌ รหัสเชื่อมต่อไม่ถูกต้อง หรือหมดอายุแล้ว กรุณากดสร้างรหัสใหม่ในเว็บครับ' }]
          });
          return;
        }
      }

      await client.replyMessage({
        replyToken,
        messages: [{ type: 'flex', altText: 'เชื่อมต่อบัญชี', contents: createLinkPromptFlexMessage() }]
      });
      return;
    }

    const userId = userDoc.id;
    const userData = userDoc.data();

    if (event.type === 'message') {
      const message = event.message;

      if (message.type === 'text') {
        const text = message.text.trim();
        const drafts = await parseExpenseText(text, { currency: userData.currency || 'THB' });
        
        if (drafts.length > 0) {
          const draft = drafts[0];
          await sendReviewFlexMessage(client, replyToken, draft);
        } else {
          await client.replyMessage({
            replyToken,
            messages: [{ type: 'text', text: 'ขออภัยครับ ไม่สามารถวิเคราะห์ข้อมูลรายจ่ายได้ ลองพิมพ์ใหม่อีกครั้งครับ' }]
          });
        }
      } else if (message.type === 'image') {
        const buffer = await downloadMessageContent(message.id);
        const draft = await parseReceiptImage(buffer, 'image/jpeg', { currency: userData.currency || 'THB' });
        
        await sendReviewFlexMessage(client, replyToken, draft);
      }
    } else if (event.type === 'postback') {
      const data = new URLSearchParams(event.postback.data);
      const action = data.get('action');

      if (action === 'save') {
        const draftJson = data.get('data');
        if (draftJson) {
          const draft = JSON.parse(draftJson) as ReceiptParseResult;
          
          await adminDb().collection('transactions').add({
            userId,
            amount: draft.totalAmount,
            type: 'expense',
            category: draft.category || 'other',
            description: draft.description || 'รายการจาก LINE',
            date: draft.date ? Timestamp.fromDate(new Date(draft.date)) : FieldValue.serverTimestamp(),
            paidBy: userId,
            splitWith: null,
            tripId: null,
            receiptUrl: null,
            source: 'line',
            createdAt: FieldValue.serverTimestamp(),
            currency: userData.currency || 'THB',
          });

          await client.replyMessage({
            replyToken,
            messages: [{ type: 'flex', altText: 'บันทึกสำเร็จ', contents: createSuccessFlexMessage(`บันทึก ${draft.description || 'รายการ'} จำนวน ฿${draft.totalAmount} เรียบร้อยแล้ว`) }]
          });
        }
      } else if (action === 'cancel') {
        await client.replyMessage({
          replyToken,
          messages: [{ type: 'text', text: 'ยกเลิกรายการเรียบร้อยแล้วครับ' }]
        });
      }
    }
  } catch (error) {
    console.error('Error handling LINE event:', error);
    try {
      await client.replyMessage({
        replyToken,
        messages: [{ type: 'text', text: 'เกิดข้อผิดพลาดในการประมวลผล กรุณาลองใหม่อีกครั้งครับ' }]
      });
    } catch (e) {
      // Ignore
    }
  }
}

async function sendReviewFlexMessage(client: messagingApi.MessagingApiClient, replyToken: string, draft: ReceiptParseResult) {
  const dateStr = draft.date ? new Date(draft.date).toLocaleDateString('th-TH') : 'วันนี้';
  const summary = `ประเภท: รายจ่าย\nรายการ: ${draft.description || '-'}\nหมวดหมู่: ${draft.category || '-'}\nวันที่: ${dateStr}\nจำนวนเงิน: ฿${draft.totalAmount}`;
  
  await client.replyMessage({
    replyToken,
    messages: [{ type: 'flex', altText: 'ตรวจสอบข้อมูล', contents: createReviewExpenseFlexMessage(summary, JSON.stringify(draft)) }]
  });
}
