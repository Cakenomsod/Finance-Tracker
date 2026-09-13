import { handleLineEvent } from './src/lib/line/handler';
import { webhook } from '@line/bot-sdk';

const mockEvent = {
  type: 'message',
  message: {
    type: 'text',
    id: '123',
    text: '/link invalid_token'
  },
  timestamp: Date.now(),
  source: {
    type: 'user',
    userId: 'U1234567890'
  },
  replyToken: 'mock_reply_token',
  mode: 'active',
  webhookEventId: 'mock_id',
  deliveryContext: { isRedelivery: false }
};

handleLineEvent(mockEvent as any).then(() => {
  console.log("Handler finished");
}).catch(err => {
  console.error("Handler error:", err);
});
