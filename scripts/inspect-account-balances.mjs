/**
 * Inspect payment source balances for a user (read-only).
 * Usage: node scripts/inspect-account-balances.mjs [uid]
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
import admin from 'firebase-admin'

const TARGET_UID = process.argv[2] || 'kKJO7pXaRsefd6z7LYkYPwIOyg33'

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

function resolveLedgerSourceId(sourceId, sourcesById) {
  if (!sourceId) return null
  const source = sourcesById.get(sourceId)
  if (!source) return sourceId
  if (source.type === 'debit_card' && source.linkedSourceId) {
    return source.linkedSourceId
  }
  return sourceId
}

function computeBalanceDeltas(transactions, sourcesById) {
  const accountDeltas = new Map()
  const poolDeltas = new Map()
  const apply = (map, id, delta) => {
    if (!id || delta === 0) return
    map.set(id, (map.get(id) ?? 0) + delta)
  }

  for (const tx of transactions) {
    const amount = Math.abs(tx.amount)
    if (amount <= 0) continue
    const fromAccount = resolveLedgerSourceId(tx.accountId, sourcesById)
    const toAccount = resolveLedgerSourceId(tx.transferToAccountId, sourcesById)

    if (tx.type === 'transfer') {
      if (fromAccount) apply(accountDeltas, fromAccount, -amount)
      if (toAccount) apply(accountDeltas, toAccount, amount)
      if (tx.moneyPoolId) apply(poolDeltas, tx.moneyPoolId, -amount)
      if (tx.transferToPoolId) apply(poolDeltas, tx.transferToPoolId, amount)
      continue
    }
    if (tx.type === 'income') {
      if (fromAccount) apply(accountDeltas, fromAccount, amount)
      if (tx.moneyPoolId) apply(poolDeltas, tx.moneyPoolId, amount)
    } else if (tx.type === 'expense') {
      if (fromAccount) apply(accountDeltas, fromAccount, -amount)
      if (tx.moneyPoolId) apply(poolDeltas, tx.moneyPoolId, -amount)
    }
  }
  return { accountDeltas, poolDeltas }
}

async function main() {
  console.log(`\nInspecting balances for ${TARGET_UID}\n`)

  const [srcSnap, poolSnap, txSnap] = await Promise.all([
    db.collection('payment_sources').where('userId', '==', TARGET_UID).get(),
    db.collection('money_pools').where('userId', '==', TARGET_UID).get(),
    db.collection('transactions').where('userId', '==', TARGET_UID).get(),
  ])

  const sources = srcSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
  const pools = poolSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
  const transactions = txSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
  const sourcesById = new Map(sources.map((s) => [s.id, s]))

  const { accountDeltas, poolDeltas } = computeBalanceDeltas(
    transactions,
    sourcesById
  )

  const withAccount = transactions.filter(
    (t) => t.accountId || t.transferToAccountId || t.moneyPoolId || t.transferToPoolId
  )

  console.log(`Sources: ${sources.length}`)
  console.log(`Pools: ${pools.length}`)
  console.log(`Transactions: ${transactions.length}`)
  console.log(`Still tagged with account/pool: ${withAccount.length}`)

  if (withAccount.length) {
    console.log('\nTagged txs (should be 0 after reset):')
    for (const t of withAccount.slice(0, 20)) {
      console.log(
        `  ${t.id} | ${t.type} | ${t.description} | acct=${t.accountId || '-'} pool=${t.moneyPoolId || '-'} to=${t.transferToAccountId || '-'}`
      )
    }
  }

  console.log('\n--- Payment sources ---')
  let openingSum = 0
  let shownSum = 0
  for (const s of sources.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'th'))) {
    const opening = Number(s.openingBalance ?? 0)
    const ledgerId =
      s.type === 'debit_card' && s.linkedSourceId ? s.linkedSourceId : s.id
    const delta = accountDeltas.get(ledgerId) ?? accountDeltas.get(s.id) ?? 0
    // Mirror computeSourceBalance roughly
    let shown = opening + (accountDeltas.get(s.id) ?? 0)
    if (s.type === 'debit_card' && s.linkedSourceId) {
      const linked = accountDeltas.get(s.linkedSourceId)
      shown = opening + (linked ?? 0)
    } else {
      shown = opening + (accountDeltas.get(s.id) ?? 0)
    }
    if (!s.archived && s.type !== 'debit_card') {
      openingSum += opening
      shownSum += opening + (accountDeltas.get(s.id) ?? 0)
    }
    console.log(
      [
        s.archived ? '[ARCHIVED]' : '[active]',
        s.type.padEnd(12),
        `"${s.name}"`.padEnd(24),
        `opening=${opening}`,
        `delta=${delta}`,
        `shown≈${shown}`,
        s.bankCode ? `bank=${s.bankCode}` : '',
        s.linkedSourceId ? `linked=${s.linkedSourceId}` : '',
        `id=${s.id}`,
      ]
        .filter(Boolean)
        .join(' | ')
    )
  }

  console.log(`\nOpening sum (non-debit, non-archived): ${openingSum}`)
  console.log(`Shown sum (non-debit, non-archived):   ${shownSum}`)

  console.log('\n--- Deltas by account id (non-zero) ---')
  for (const [id, delta] of [...accountDeltas.entries()].sort((a, b) => b[1] - a[1])) {
    if (delta === 0) continue
    const s = sourcesById.get(id)
    console.log(`  ${id} (${s?.name || 'UNKNOWN'}): ${delta}`)
  }

  console.log('\n--- Money pools ---')
  for (const p of pools) {
    const opening = Number(p.openingBalance ?? 0)
    const delta = poolDeltas.get(p.id) ?? 0
    console.log(
      `${p.archived ? '[ARCHIVED]' : '[active]'} "${p.name}" opening=${opening} delta=${delta} shown=${opening + delta}`
    )
  }

  // Recent txs that might have been re-tagged after reset
  const recentTagged = withAccount
    .map((t) => ({
      ...t,
      _ms: t.createdAt?.toMillis?.() || t.date?.toMillis?.() || 0,
    }))
    .sort((a, b) => b._ms - a._ms)
    .slice(0, 15)
  if (recentTagged.length) {
    console.log('\n--- Most recent tagged txs ---')
    for (const t of recentTagged) {
      const d = t.date?.toDate?.() || null
      console.log(
        `  ${d ? d.toISOString().slice(0, 10) : '?'} | ${t.type} | ${t.amount} | ${t.description} | acct=${t.accountId}`
      )
    }
  }

  // Find Kplus-like sources
  console.log('\n--- Kplus / KBANK candidates ---')
  for (const s of sources) {
    const label = `${s.name} ${s.bankCode || ''}`.toLowerCase()
    if (
      label.includes('kplus') ||
      label.includes('kbank') ||
      label.includes('กสิกร') ||
      label.includes('k+')
    ) {
      console.log(JSON.stringify({ id: s.id, name: s.name, type: s.type, openingBalance: s.openingBalance, bankCode: s.bankCode, linkedSourceId: s.linkedSourceId, archived: s.archived }, null, 2))
      // txs affecting this id
      const affecting = transactions.filter(
        (t) =>
          t.accountId === s.id ||
          t.transferToAccountId === s.id ||
          (s.linkedSourceId &&
            (t.accountId === s.linkedSourceId ||
              t.transferToAccountId === s.linkedSourceId))
      )
      console.log(`  txs still pointing at this source: ${affecting.length}`)
      let sum = 0
      for (const t of affecting) {
        const amt = Math.abs(t.amount)
        const sign = t.type === 'income' ? 1 : t.type === 'expense' ? -1 : 0
        sum += sign * amt
        console.log(
          `    ${t.type} ${sign * amt} | ${t.description} | ${t.id}`
        )
      }
      console.log(`  net delta from those txs: ${sum}`)
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
