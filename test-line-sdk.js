import { messagingApi } from '@line/bot-sdk';
console.log(Object.keys(messagingApi));
try {
  const client = new messagingApi.MessagingApiClient({ channelAccessToken: "test" });
  console.log("Client constructed successfully");
} catch(e) {
  console.error("Error constructing client:", e);
}
