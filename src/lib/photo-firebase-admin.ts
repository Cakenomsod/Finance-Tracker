import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

// 🎯 ฟังก์ชันภายในสำหรับดึงหรือสร้าง Instance แอปชื่อ photoProject
function getPhotoProjectApp(): admin.app.App {
  const existingApp = admin.apps.find(app => app?.name === 'photoProject');
  
  // เจอบ้านเก่า ส่งบ้านเก่ากลับไปใช้ทันที
  if (existingApp) return existingApp;

  try {
    if (process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL) {
      // เครื่อง Local (ใช้สิทธิ์คีย์ Finance บังคับพิกัดไปโปรเจกต์ Photo)
      return admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
        projectId: "photophetklao", 
      }, 'photoProject');
    } else {
      // เซิร์ฟเวอร์จริง (Production)
      return admin.initializeApp({
        projectId: "photophetklao",
      }, 'photoProject');
    }
  } catch (error) {
    console.error('Failed to initialize photo project app:', error);
    return admin.apps[0]!; // ถ้าพังวินาศจริงให้ดึงแอปตัวแรกมากันเหนียว
  }
}

// 🎯 คีย์เวิร์ดสำคัญ: ดึง Firestore ผ่านฟังก์ชันด้านบนเสมอ 
// ท่านี้จะการันตีว่า ไม่ว่าจะเรียกใช้งานจากไฟล์ไหน หรือกดโหลดหน้ารัวๆ จะไม่มีทางได้ค่า undefined แน่นอน!
export const photoDb = getFirestore(getPhotoProjectApp());