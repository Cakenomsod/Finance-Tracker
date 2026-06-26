import { adminDb } from '@/lib/firebase-admin';
import { contactKeyForCustom } from '@/lib/contact-order';
import type { AiContact } from '@/lib/ai/contact-resolve';

export async function loadUserContactsForAi(uid: string): Promise<AiContact[]> {
  const db = adminDb();

  const userDoc = await db.collection('users').doc(uid).get();
  const userData = userDoc.data();
  const selfDisplayName = (userData?.displayName as string) || 'Me';
  const friendAliases = (userData?.friendAliases as Record<string, string[]>) || {};

  const [sentSnap, receivedSnap, customSnap] = await Promise.all([
    db.collection('friend_requests').where('fromUserId', '==', uid).where('status', '==', 'accepted').get(),
    db.collection('friend_requests').where('toUserId', '==', uid).where('status', '==', 'accepted').get(),
    db.collection('custom_friends').where('userId', '==', uid).get(),
  ]);

  const friendUids = new Set<string>();
  for (const doc of sentSnap.docs) {
    friendUids.add(doc.data().toUserId as string);
  }
  for (const doc of receivedSnap.docs) {
    friendUids.add(doc.data().fromUserId as string);
  }

  const profileSnaps = await Promise.all(
    [...friendUids].map((friendUid) => db.collection('users').doc(friendUid).get())
  );
  const profileByUid = new Map<string, { displayName: string }>();
  for (const snap of profileSnaps) {
    if (snap.exists) {
      const d = snap.data()!;
      profileByUid.set(snap.id, {
        displayName: (d.displayName as string) || `Friend ${snap.id.slice(0, 6)}`,
      });
    }
  }

  const contacts: AiContact[] = [
    {
      key: 'me',
      displayName: selfDisplayName,
      aliases: ['ผม', 'ฉัน', 'ตัวเอง', 'Me'],
      isSelf: true,
    },
  ];

  for (const friendUid of friendUids) {
    const profile = profileByUid.get(friendUid);
    contacts.push({
      key: friendUid,
      displayName: profile?.displayName || `Friend ${friendUid.slice(0, 6)}`,
      aliases: friendAliases[friendUid] || [],
      isSelf: false,
    });
  }

  for (const doc of customSnap.docs) {
    const data = doc.data();
    const aliases = Array.isArray(data.aliases) ? (data.aliases as string[]) : [];
    contacts.push({
      key: contactKeyForCustom(doc.id),
      displayName: (data.name as string) || 'Contact',
      aliases,
      isSelf: false,
      isCustom: true,
    });
  }

  return contacts;
}

/** Merge trip members into contacts (for trip expense text parsing) */
export async function mergeTripMembersIntoContacts(
  contacts: AiContact[],
  tripId: string
): Promise<AiContact[]> {
  const tripDoc = await adminDb().collection('trips').doc(tripId).get();
  if (!tripDoc.exists) return contacts;

  const trip = tripDoc.data()!;
  const members = (trip.members as string[]) || [];
  const profiles = (trip.memberProfiles as Record<string, { displayName: string }>) || {};

  const byKey = new Map(contacts.map((c) => [c.key, c]));

  for (const memberUid of members) {
    if (byKey.has(memberUid)) continue;
    byKey.set(memberUid, {
      key: memberUid,
      displayName: profiles[memberUid]?.displayName || memberUid,
      aliases: [],
      isSelf: false,
    });
  }

  return [...byKey.values()];
}
