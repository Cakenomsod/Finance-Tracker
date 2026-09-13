const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
require('dotenv').config({ path: '.env.local' });

try {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
  const db = getFirestore();
  const token = "test_token";
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  
  db.collection('line_linking_tokens').add({
    userId: "test_uid",
    token,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromDate(expiresAt),
  }).then(res => {
    console.log("Success:", res.id);
    process.exit(0);
  }).catch(err => {
    console.error("Firestore Add Error:", err);
    process.exit(1);
  });
} catch (error) {
  console.error("Init Error:", error);
}
