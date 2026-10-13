import { adminDb } from '@/lib/firebase-admin';
import type { AiAccount } from '@/lib/ai/account-hint';

/** Active payment sources for server-side AI parsing (LINE bot, parse API). */
export async function loadUserAccountsForAi(uid: string): Promise<AiAccount[]> {
  const snap = await adminDb().collection('payment_sources').where('userId', '==', uid).get();
  return snap.docs
    .map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        name: typeof d.name === 'string' ? d.name : '',
        type: d.type,
        bankCode: typeof d.bankCode === 'string' ? d.bankCode : undefined,
        currency: typeof d.currency === 'string' ? d.currency : undefined,
        archived: d.archived === true,
        isDefault: d.isDefault === true,
      } satisfies AiAccount;
    })
    .filter((s) => s.name.trim() && !s.archived);
}
