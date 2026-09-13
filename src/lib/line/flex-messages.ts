import { messagingApi } from '@line/bot-sdk';

export function createReviewExpenseFlexMessage(
  summary: string,
  draftJsonStr: string
): messagingApi.FlexContainer {
  return {
    type: 'bubble',
    size: 'mega',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: 'ตรวจสอบข้อมูล',
          weight: 'bold',
          size: 'xl',
          color: '#1DB446',
        },
        {
          type: 'separator',
          margin: 'md',
        },
        {
          type: 'text',
          text: summary,
          wrap: true,
          margin: 'md',
          color: '#555555',
        },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [
        {
          type: 'button',
          style: 'primary',
          height: 'sm',
          color: '#1DB446',
          action: {
            type: 'postback',
            label: 'บันทึกรายการ',
            data: `action=save&data=${encodeURIComponent(draftJsonStr)}`,
          },
        },
        {
          type: 'button',
          style: 'secondary',
          height: 'sm',
          action: {
            type: 'postback',
            label: 'ยกเลิก',
            data: 'action=cancel',
          },
        },
      ],
      flex: 0,
    },
  };
}

export function createSuccessFlexMessage(message: string): messagingApi.FlexContainer {
  return {
    type: 'bubble',
    size: 'kilo',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: '✅ สำเร็จ',
          weight: 'bold',
          size: 'lg',
          color: '#1DB446',
        },
        {
          type: 'text',
          text: message,
          wrap: true,
          margin: 'md',
          color: '#555555',
        },
      ],
    },
  };
}

export function createLinkPromptFlexMessage(): messagingApi.FlexContainer {
  return {
    type: 'bubble',
    size: 'kilo',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: 'ยังไม่ได้เชื่อมต่อบัญชี',
          weight: 'bold',
          size: 'lg',
          color: '#EF4444',
        },
        {
          type: 'text',
          text: 'กรุณาเชื่อมต่อบัญชี LINE ของคุณผ่านแอปพลิเคชัน Finance Tracker บนเว็บก่อนใช้งานครับ',
          wrap: true,
          margin: 'md',
          color: '#555555',
        },
      ],
    },
  };
}
