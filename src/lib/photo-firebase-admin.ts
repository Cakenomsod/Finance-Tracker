import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

// ประกาศตัวแปร Firestore รอไว้
export let photoDb: admin.firestore.Firestore;

// ค้นหาว่าเคยสร้างแอปชื่อ photoProject ไว้หรือยัง
const existingApp = admin.apps.find(app => app?.name === 'photoProject');

if (!existingApp) {
  try {
    let photoProjectApp: admin.app.App;

    if (process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL) {
      photoProjectApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
        projectId: "photophetklao", // ไอดีโปรเจกต์รูปภาพของคุณ
      }, 'photoProject');
    } else {
      photoProjectApp = admin.initializeApp({ projectId: "photophetklao" }, 'photoProject');
    }

    console.log("🔥 [Cross-Project] สร้างท่อเชื่อมต่อโปรเจกต์ Photo สำเร็จแล้ว!");
    photoDb = getFirestore(photoProjectApp);

  } catch (error) {
    console.error('Firebase photo project initialization error', error);
    // กรณีพัง ให้ดึงเอาแอปดีฟอลต์มาขัดตาทัพ
    photoDb = getFirestore(admin.apps[0]!);
  }
} else {
  // ถ้ามีแอปนี้อยู่แล้ว ก็สอยเอา Firestore ของแอปตัวนี้มาผูกค่าเลย
  photoDb = getFirestore(existingApp);
}