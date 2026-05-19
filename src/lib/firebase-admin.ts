import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    // 🚀 ถ้าเราเซตค่าใน .env ครบ บล็อก if ตรงนี้จะทำงานทันทีในเครื่องคอมคุณ!
    if (process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          // โค้ดของคุณมีการจัดการเรื่องการขึ้นบรรทัดใหม่ (\n) ไว้ให้แล้วอย่างถูกต้อง
          privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
      console.log("🔥 Firebase Admin SDK ยืนยันสิทธิ์ในเครื่อง Local สำเร็จแล้ว!");
    } else {
      // สำหรับรันบนเซิร์ฟเวอร์ Production จริง (Cloud Run / Cloud Functions)
      admin.initializeApp();
    }
  } catch (error) {
    console.error('Firebase admin initialization error', error);
  }
}

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();