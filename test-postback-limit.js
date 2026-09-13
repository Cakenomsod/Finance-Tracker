const json = JSON.stringify({
  totalAmount: 1200,
  category: "shopping",
  description: "จ่ายผ่าน ันีะพรย เวลา ฿ถ:ภ/ ที่ Dฟรหน ซื้อหมวก Hฟยยั ิรพะ้กฟั",
  date: "2026-09-13T10:00:00Z"
});
const encoded = encodeURIComponent(json);
const dataStr = `action=save&data=${encoded}`;
console.log("Length:", dataStr.length);
