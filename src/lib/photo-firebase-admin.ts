import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

function getPhotoProjectApp(): admin.app.App {
  const existingApp = admin.apps.find(app => app?.name === 'photoProject');
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
        projectId: process.env.PHOTO_FIREBASE_PROJECT_ID || "photophetklao", 
      }, 'photoProject');
    } else {
      // 🚀 บนเซิร์ฟเวอร์จริง (Production): 
      // ดึงสิทธิ์ของเครื่อง (Application Default) ยัดให้แอปตัวรอง และชี้เป้าไปบ้าน Photo ตัวจริง
      return admin.initializeApp({
        credential: admin.credential.applicationDefault(), // 🎯 ป้องกันคีย์บอทพังบน Cloud Run
        projectId: process.env.PHOTO_FIREBASE_PROJECT_ID || "photophetklao",
      }, 'photoProject');
    }
  } catch (error) {
    console.error('Failed to initialize photo project app:', error);
    return admin.apps[0]!; 
  }
}

// 🎯 คีย์เวิร์ดสำคัญ: ปรับให้เป็น Getter Function เหมือนกัน
// จากเดิมที่เป็นตัวแปรลอยดิ่ง ให้กลายเป็นฟังก์ชันเรียกใช้ไดนามิก
export const photoDb = () => getFirestore(getPhotoProjectApp());