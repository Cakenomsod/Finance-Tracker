/**
 * Reset account/pool linkage on historical transactions so opening balances
 * can be set manually without past txs affecting ledger math.
 *
 * - Delete all type === 'transfer' transactions for the user
 * - Clear accountId, moneyPoolId, transferToAccountId, transferToPoolId
 *   on remaining transactions (+ recurring_expenses accountId)
 *
 * Usage:
 *   node scripts/reset-account-links.mjs              # dry-run
 *   node scripts/reset-account-links.mjs --apply      # write changes
 *   node scripts/reset-account-links.mjs --uid <uid>  # target one user
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
import admin from 'firebase-admin'

const APPLY = process.argv.includes('--apply')
const uidIdx = process.argv.indexOf('--uid')
const TARGET_UID = uidIdx >= 0 ? process.argv[uidIdx + 1] : null

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

if (!process.env.FIREBASE_ADMIN_PROJECT_ID) {
  console.error('Missing FIREBASE_ADMIN_* credentials in .env.local')
  process.exit(1)
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

function hasAnyAccountField(data) {
  return ACCOUNT_FIELDS.some((f) => data[f] != null && data[f] !== '')
}

async function resolveUserIds() {
  if (TARGET_UID) return [TARGET_UID]

  const usersSnap = await db.collection('users').get()
  if (!usersSnap.empty) {
    return usersSnap.docs.map((d) => d.id)
  }

  // Fallback: distinct userIds from transactions
  const txSnap = await db.collection('transactions').select('userId').get()
  return [...new Set(txSnap.docs.map((d) => d.data().userId).filter(Boolean))]
}

async function commitBatches(ops) {
  const CHUNK = 400
  for (let i = 0; i < ops.length; i += CHUNK) {
    const batch = db.batch()
    for (const op of ops.slice(i, i + CHUNK)) {
      if (op.type === 'delete') batch.delete(op.ref)
      else batch.update(op.ref, op.data)
    }
    await batch.commit()
  }
}

async function processUser(userId) {
  console.log(`\n=== User ${userId} ===`)

  const txSnap = await db
    .collection('transactions')
    .where('userId', '==', userId)
    .get()

  const transfers = []
  const toClear = []
  let alreadyClean = 0

  for (const doc of txSnap.docs) {
    const data = doc.data()
    if (data.type === 'transfer') {
      transfers.push(doc)
      continue
    }
    if (hasAnyAccountField(data)) {
      toClear.push(doc)
    } else {
      alreadyClean++
    }
  }

  const recurringSnap = await db
    .collection('recurring_expenses')
    .where('userId', '==', userId)
    .get()
  const recurringClear = recurringSnap.docs.filter((d) => {
    const a = d.data().accountId
    return a != null && a !== ''
  })

  console.log(`Transactions total:     ${txSnap.size}`)
  console.log(`  transfers to DELETE:  ${transfers.length}`)
  console.log(`  clear account/pool:   ${toClear.length}`)
  console.log(`  already clean:        ${alreadyClean}`)
  console.log(`Recurring clear acct:   ${recurringClear.length}`)

  if (transfers.length > 0) {
    console.log('  sample transfers:')
    for (const d of transfers.slice(0, 5)) {
      const t = d.data()
      console.log(
        `    - ${d.id} | ${t.description || '(no desc)'} | ${t.amount} | acct=${t.accountId || '-'} → ${t.transferToAccountId || '-'}`
      )
    }
  }
  if (toClear.length > 0) {
    console.log('  sample clears:')
    for (const d of toClear.slice(0, 5)) {
      const t = d.data()
      const fields = ACCOUNT_FIELDS.filter((f) => t[f] != null && t[f] !== '')
      console.log(
        `    - ${d.id} | ${t.type} | ${t.description || '(no desc)'} | fields=${fields.join(',')}`
      )
    }
  }

  if (!APPLY) {
    console.log('  (dry-run — pass --apply to write)')
    return {
      transfers: transfers.length,
      cleared: toClear.length,
      recurring: recurringClear.length,
    }
  }

  const ops = [
    ...transfers.map((d) => ({ type: 'delete', ref: d.ref })),
    ...toClear.map((d) => ({
      type: 'update',
      ref: d.ref,
      data: {
        accountId: del,
        moneyPoolId: del,
        transferToAccountId: del,
        transferToPoolId: del,
      },
    })),
    ...recurringClear.map((d) => ({
      type: 'update',
      ref: d.ref,
      data: { accountId: del },
    })),
  ]

  await commitBatches(ops)
  console.log(`  APPLIED ${ops.length} ops`)
  return {
    transfers: transfers.length,
    cleared: toClear.length,
    recurring: recurringClear.length,
  }
}

async function main() {
  console.log(
    APPLY
      ? '\n!!! APPLY MODE — writing to Firestore !!!\n'
      : '\nDry-run mode (no writes). Re-run with --apply to commit.\n'
  )

  const userIds = await resolveUserIds()
  if (userIds.length === 0) {
    console.error('No users found')
    process.exit(1)
  }
  console.log(`Users to process: ${userIds.length}`)

  let totals = { transfers: 0, cleared: 0, recurring: 0 }
  for (const uid of userIds) {
    const r = await processUser(uid)
    totals.transfers += r.transfers
    totals.cleared += r.cleared
    totals.recurring += r.recurring
  }

  console.log('\n=== Totals ===')
  console.log(`Transfers deleted:     ${totals.transfers}`)
  console.log(`Transactions cleared:  ${totals.cleared}`)
  console.log(`Recurring cleared:     ${totals.recurring}`)
  if (!APPLY) {
    console.log('\nNext: node scripts/reset-account-links.mjs --apply')
  } else {
    console.log(
      '\nDone. Set opening balances in Settings → Money / Accounts.'
    )
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
