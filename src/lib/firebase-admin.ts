import * as admin from 'firebase-admin';

// 🎯 ฟังก์ชันเช็กและสร้างแอปหลัก [DEFAULT] 
function getMainApp(): admin.app.App {
  const defaultApp = admin.apps.find(app => app?.name === '[DEFAULT]');
  if (defaultApp) return defaultApp;

  try {
    if (process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL) {
      console.log("🔥 Firebase Admin SDK ยืนยันสิทธิ์ในเครื่อง Local สำเร็จแล้ว!");
      return admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
    } else {
      // 🚀 บน Cloud Run ตัวจริง ใช้สิทธิ์แวดล้อมสากลเปิดตัวแอปหลัก
      return admin.initializeApp();
    }
  } catch (error) {
    console.error('Firebase admin initialization error', error);
    throw error;
  }
}

// 🎯 คีย์เวิร์ดสำคัญ: เปลี่ยนมาใช้ Getter Function 
// เวลาไฟล์อื่นจะเรียกใช้ ให้เรียกเป็นฟังก์ชันแทน เช่น adminDb() หรือ adminAuth()
// ท่านี้จะการันตีว่าแอปหลักจะถูกเช็กความพร้อม "ทุกครั้ง" ก่อนใช้งาน ไม่มีการลัดคิวพังอีกต่อไป
export const adminAuth = () => admin.auth(getMainApp());
export const adminDb = () => admin.firestore(getMainApp());