import { messagingApi } from '@line/bot-sdk';
import { getLineConfig } from './config';

let client: messagingApi.MessagingApiClient | null = null;
let blobClient: messagingApi.MessagingApiBlobClient | null = null;

export function getLineClient() {
  if (!client) {
    const config = getLineConfig();
    client = new messagingApi.MessagingApiClient({
      channelAccessToken: config.channelAccessToken,
    });
  }
  return client;
}

export function getLineBlobClient() {
  if (!blobClient) {
    const config = getLineConfig();
    blobClient = new messagingApi.MessagingApiBlobClient({
      channelAccessToken: config.channelAccessToken,
    });
  }
  return blobClient;
}

export async function downloadMessageContent(messageId: string): Promise<Buffer> {
  const blobClient = getLineBlobClient();
  const stream = await blobClient.getMessageContent(messageId);
  const chunks: Buffer[] = [];

  for await (const chunk of stream as any) {
    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}
