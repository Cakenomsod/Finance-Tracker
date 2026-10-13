export function getLineConfig() {
  // Secrets pasted into CI/hosting often carry a trailing newline, which breaks
  // signature validation (every webhook → 401) and the Messaging API bearer.
  const channelSecret = process.env.LINE_CHANNEL_SECRET?.trim();
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim();
  const botId = process.env.NEXT_PUBLIC_LINE_BOT_ID?.trim() || '@697lbrom';
  const appUrl = (process.env.APP_URL?.trim() || 'https://financetracker-pk.web.app').replace(/\/$/, '');

  if (!channelSecret || !channelAccessToken) {
    console.warn('LINE Bot credentials missing. LINE webhook/features will not work properly.');
  }

  return {
    channelSecret: channelSecret || '',
    channelAccessToken: channelAccessToken || '',
    botId,
    appUrl,
  };
}
