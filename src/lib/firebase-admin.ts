import * as admin from 'firebase-admin';

// 1. ประกาศตัวแปรทิ้งไว้ข้างบนก่อน แต่ยังไม่ใส่ค่า (เพื่อไม่ให้มันรันก่อน initializeApp)
export let adminAuth: admin.auth.Auth;
export let adminDb: admin.firestore.Firestore;

if (!admin.apps.length) {
  try {
    if (process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
      console.log("🔥 Firebase Admin SDK ยืนยันสิทธิ์ในเครื่อง Local สำเร็จแล้ว!");
    } else {
      admin.initializeApp();
    }
  } catch (error) {
    console.error('Firebase admin initialization error', error);
  }
}

// 2. พอแน่ใจว่าเครื่องเปิด (initializeApp) เสร็จแล้ว ค่อยยัดค่าใส่ตัวแปร ปลอดภัย 100%
adminAuth = admin.auth();
adminDb = admin.firestore();