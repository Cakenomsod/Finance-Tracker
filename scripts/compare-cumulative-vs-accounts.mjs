import { readFileSync } from 'fs'
import { resolve } from 'path'
import admin from 'firebase-admin'

const TARGET_UID = 'kKJO7pXaRsefd6z7LYkYPwIOyg33'

const envContent = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
for (const line of envContent.split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eq = trimmed.indexOf('=')
  if (eq === -1) continue
  const key = trimmed.slice(0, eq).trim()
  let val = trimmed.slice(eq + 1).trim()
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1)
  }
  if (!process.env[key]) process.env[key] = val
}

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
})

const db = admin.firestore()

const txSnap = await db.collection('transactions').where('userId', '==', TARGET_UID).get()
let income = 0
let expense = 0
const byYear = {}
for (const d of txSnap.docs) {
  const t = d.data()
  if (t.type === 'transfer') continue
  const amt = Math.abs(Number(t.amount) || 0)
  const date = t.date?.toDate?.()
  const y = date ? String(date.getFullYear()) : '?'
  byYear[y] ??= { income: 0, expense: 0, n: 0 }
  byYear[y].n++
  if (t.type === 'income') {
    income += amt
    byYear[y].income += amt
  } else if (t.type === 'expense') {
    expense += amt
    byYear[y].expense += amt
  }
}

const srcSnap = await db.collection('payment_sources').where('userId', '==', TARGET_UID).get()
let opening = 0
for (const d of srcSnap.docs) {
  const s = d.data()
  if (s.archived || s.type === 'debit_card') continue
  opening += Number(s.openingBalance || 0)
}

console.log('All-time income:', income)
console.log('All-time expense:', expense)
console.log('เงินสะสมทั้งหมด ≈ income - expense:', income - expense)
console.log('ผลรวมเงินเริ่มต้นบัญชี (ไม่รวมบัตรเดบิต):', opening)
console.log('ส่วนต่าง:', income - expense - opening)
console.log('\nBy year:')
for (const y of Object.keys(byYear).sort()) {
  const b = byYear[y]
  console.log(
    `${y}: n=${b.n} in=${b.income.toFixed(0)} out=${b.expense.toFixed(0)} net=${(b.income - b.expense).toFixed(0)}`
  )
}
