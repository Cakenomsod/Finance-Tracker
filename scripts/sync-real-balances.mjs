/**
 * Sync real wallet balances + Taiwan pool allocation.
 * Usage: node scripts/sync-real-balances.mjs [--apply]
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
import admin from 'firebase-admin'

const APPLY = process.argv.includes('--apply')
const UID = 'kKJO7pXaRsefd6z7LYkYPwIOyg33'

const TARGETS = {
  Kplus: 265.39,
  'Make By Kbank': 62.26,
  SCB: 0.44,
  เป๋าตังค์: 0.6,
  Truemoney: 0.58,
  ออมสิน: 166295,
  เงินสด: 407, // 290 + 117
  YouTrips: 15.75,
}

const POOL_TARGET = 135381.07

try {
  const envPath = resolve(process.cwd(), '.env.local')
  const envContent = readFileSync(envPath, 'utf8')
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
} catch (e) {
  console.warn('Could not load .env.local:', e.message)
}

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
})

const db = admin.firestore()
const del = admin.firestore.FieldValue.delete()

const ACCOUNT_FIELDS = [
  'accountId',
  'moneyPoolId',
  'transferToAccountId',
  'transferToPoolId',
]

async function resetLinks() {
  const txSnap = await db.collection('transactions').where('userId', '==', UID).get()
  const ops = []
  let transfers = 0
  let cleared = 0

  for (const doc of txSnap.docs) {
    const data = doc.data()
    if (data.type === 'transfer') {
      transfers++
      ops.push({ type: 'delete', ref: doc.ref })
      continue
    }
    if (ACCOUNT_FIELDS.some((f) => data[f] != null && data[f] !== '')) {
      cleared++
      ops.push({
        type: 'update',
        ref: doc.ref,
        data: {
          accountId: del,
          moneyPoolId: del,
          transferToAccountId: del,
          transferToPoolId: del,
        },
      })
    }
  }

  const recurringSnap = await db
    .collection('recurring_expenses')
    .where('userId', '==', UID)
    .get()
  for (const doc of recurringSnap.docs) {
    const a = doc.data().accountId
    if (a != null && a !== '') {
      ops.push({ type: 'update', ref: doc.ref, data: { accountId: del } })
    }
  }

  console.log(`Reset: delete ${transfers} transfers, clear ${cleared} txs`)

  if (!APPLY) return { transfers, cleared }

  const CHUNK = 400
  for (let i = 0; i < ops.length; i += CHUNK) {
    const batch = db.batch()
    for (const op of ops.slice(i, i + CHUNK)) {
      if (op.type === 'delete') batch.delete(op.ref)
      else batch.update(op.ref, op.data)
    }
    await batch.commit()
  }
  return { transfers, cleared }
}

async function setBalances() {
  const [srcSnap, poolSnap] = await Promise.all([
    db.collection('payment_sources').where('userId', '==', UID).get(),
    db.collection('money_pools').where('userId', '==', UID).get(),
  ])

  const sources = srcSnap.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }))
  const pools = poolSnap.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }))

  console.log('\n--- Payment source updates ---')
  const matched = new Set()
  let total = 0

  for (const s of sources) {
    if (s.type === 'debit_card') {
      console.log(`  skip debit "${s.name}" (keep opening=${s.openingBalance ?? 0})`)
      continue
    }
    const target = TARGETS[s.name]
    if (target == null) {
      console.log(`  UNMATCHED "${s.name}" id=${s.id} opening=${s.openingBalance}`)
      continue
    }
    matched.add(s.name)
    total += target
    console.log(`  "${s.name}": ${s.openingBalance ?? 0} → ${target}`)
    if (APPLY) {
      await s.ref.update({ openingBalance: target })
    }
  }

  for (const name of Object.keys(TARGETS)) {
    if (!matched.has(name)) console.log(`  MISSING account named "${name}"`)
  }

  const gsb = sources.find((s) => s.name === 'ออมสิน')
  const pool =
    pools.find((p) => /YZU|ไต้|เทอม/i.test(p.name)) || pools[0]

  console.log('\n--- Money pool update ---')
  if (!pool) {
    console.log('  NO POOL FOUND')
  } else if (!gsb) {
    console.log('  NO ออมสิน account for allocation')
  } else {
    console.log(`  pool "${pool.name}"`)
    console.log(`  opening: ${pool.openingBalance ?? 0} → ${POOL_TARGET}`)
    console.log(`  allocation: all ${POOL_TARGET} in ออมสิน (${gsb.id})`)
    if (APPLY) {
      await pool.ref.update({
        openingBalance: POOL_TARGET,
        accountAllocations: [{ accountId: gsb.id, amount: POOL_TARGET }],
      })
    }
  }

  console.log(`\nExpected total (ledger accounts): ${total}`)
  return { total }
}

async function main() {
  console.log(APPLY ? '\n!!! APPLY MODE !!!\n' : '\nDry-run (pass --apply to write)\n')
  await resetLinks()
  await setBalances()
  if (!APPLY) console.log('\nRe-run with --apply to commit.')
  else console.log('\nDone.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
