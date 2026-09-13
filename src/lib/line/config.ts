export function getLineConfig() {
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const botId = process.env.NEXT_PUBLIC_LINE_BOT_ID || '@697lbrom';

  if (!channelSecret || !channelAccessToken) {
    console.warn('LINE Bot credentials missing. LINE webhook/features will not work properly.');
  }

  return {
    channelSecret: channelSecret || '',
    channelAccessToken: channelAccessToken || '',
    botId,
  };
}
