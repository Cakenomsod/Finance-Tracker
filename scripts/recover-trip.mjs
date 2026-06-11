import { readFileSync } from 'fs';
import { resolve } from 'path';
import admin from 'firebase-admin';

const TRIP_ID = process.argv[2] || 'BUPBsbjkszgDqSqF6Spy';
const RESTORE = process.argv.includes('--restore');

// Load .env.local
try {
  const envPath = resolve(process.cwd(), '.env.local');
  const envContent = readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
} catch (e) {
  console.warn('Could not load .env.local:', e.message);
}

if (!process.env.FIREBASE_ADMIN_PROJECT_ID) {
  console.error('Missing FIREBASE_ADMIN_* credentials in .env.local');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});

const db = admin.firestore();
const tripRef = db.collection('trips').doc(TRIP_ID);

function toDate(ts) {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  if (ts._seconds) return new Date(ts._seconds * 1000);
  return null;
}

async function main() {
  console.log(`\n=== Trip Recovery: ${TRIP_ID} ===\n`);

  const tripSnap = await tripRef.get();
  console.log('Trip document exists:', tripSnap.exists);
  if (tripSnap.exists) {
    console.log('Trip data:', JSON.stringify(tripSnap.data(), null, 2));
    console.log('\nTrip already exists — no restore needed.');
    return;
  }

  const [expSnap, setSnap, txSnap] = await Promise.all([
    db.collection('trip_expenses').where('tripId', '==', TRIP_ID).get(),
    db.collection('trip_settlements').where('tripId', '==', TRIP_ID).get(),
    db.collection('transactions').where('tripId', '==', TRIP_ID).get(),
  ]);

  console.log(`Orphaned trip_expenses: ${expSnap.size}`);
  console.log(`Orphaned trip_settlements: ${setSnap.size}`);
  console.log(`Orphaned transactions: ${txSnap.size}`);

  if (expSnap.empty && setSnap.empty && txSnap.empty) {
    console.error('\nNo orphaned data found for this trip ID. Cannot recover automatically.');
    process.exit(1);
  }

  const memberSet = new Set();
  const memberProfiles = {};
  let createdBy = null;
  let countryCode = null;
  let tripCurrency = null;
  let homeCurrency = null;
  let exchangeRate = null;
  let immichAlbumId = null;
  const dates = [];

  for (const doc of expSnap.docs) {
    const ex = doc.data();
    if (ex.userId) {
      createdBy = createdBy || ex.userId;
      memberSet.add(ex.userId);
    }
    for (const p of ex.payers || []) {
      memberSet.add(p.userId);
      if (p.displayName) memberProfiles[p.userId] = { displayName: p.displayName, photoURL: null };
    }
    for (const s of ex.shares || []) {
      memberSet.add(s.userId);
      if (s.displayName) memberProfiles[s.userId] = { displayName: s.displayName, photoURL: null };
    }
    if (ex.date) dates.push(toDate(ex.date));
    if (ex.currency) tripCurrency = tripCurrency || ex.currency;
  }

  for (const doc of txSnap.docs) {
    const tx = doc.data();
    if (tx.userId) {
      createdBy = createdBy || tx.userId;
      memberSet.add(tx.userId);
    }
    if (tx.paidBy) memberSet.add(tx.paidBy);
    if (tx.splitWith && tx.splitWith !== 'all') memberSet.add(tx.splitWith);
    if (tx.date) dates.push(toDate(tx.date));
    if (tx.currency) tripCurrency = tripCurrency || tx.currency;
  }

  for (const doc of setSnap.docs) {
    const s = doc.data();
    if (s.fromUserId) memberSet.add(s.fromUserId);
    if (s.toUserId) memberSet.add(s.toUserId);
    if (s.date) dates.push(toDate(s.date));
  }

  // Infer Japan trip if JPY
  if (tripCurrency === 'JPY') {
    countryCode = 'JP';
    homeCurrency = homeCurrency || 'THB';
    exchangeRate = exchangeRate || 0.22;
  } else {
    countryCode = countryCode || 'TH';
    tripCurrency = tripCurrency || 'THB';
    homeCurrency = homeCurrency || 'THB';
  }

  const validDates = dates.filter(Boolean).sort((a, b) => a - b);
  const startDate = validDates[0] || new Date();
  const endDate = validDates[validDates.length - 1] || startDate;

  const restoredTrip = {
    name: 'Restored Trip',
    description: '',
    members: Array.from(memberSet),
    memberProfiles,
    startDate: admin.firestore.Timestamp.fromDate(startDate),
    endDate: admin.firestore.Timestamp.fromDate(endDate),
    status: 'active',
    createdBy: createdBy || Array.from(memberSet)[0],
    createdAt: admin.firestore.Timestamp.now(),
    countryCode,
    tripCurrency,
    homeCurrency,
    exchangeRate,
    ...(immichAlbumId ? { immichAlbumId } : {}),
  };

  console.log('\n--- Reconstructed trip document ---');
  console.log(JSON.stringify({
    ...restoredTrip,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    createdAt: new Date().toISOString(),
    members: restoredTrip.members,
    memberProfiles: restoredTrip.memberProfiles,
  }, null, 2));

  if (!RESTORE) {
    console.log('\nDry run only. Run with --restore to write to Firestore:');
    console.log(`  node scripts/recover-trip.mjs ${TRIP_ID} --restore`);
    return;
  }

  await tripRef.set(restoredTrip);
  console.log(`\n✅ Trip restored with ID: ${TRIP_ID}`);
  console.log('Open the app and rename the trip if needed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
