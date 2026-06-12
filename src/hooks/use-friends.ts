import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { FriendRequest, CustomFriend } from '@/lib/firestore-types';
import {
  sendFriendRequest,
  respondFriendRequest,
  deleteFriendRequest,
  searchUserByEmail,
  getUserProfile,
  createCustomFriend,
  deleteCustomFriend,
  updateContactOrder,
} from '@/lib/firestore';
import { contactKeyForCustom, mergeContactOrder, sortByContactOrder } from '@/lib/contact-order';
import { useAuth } from './use-auth';

export interface Friend {
  uid: string;
  displayName: string;
  photoURL: string | null;
}

export interface Contact {
  key: string;
  displayName: string;
  photoURL?: string | null;
  isCustom?: boolean;
  isSelf?: boolean;
}

export interface FriendListItem {
  key: string;
  type: 'friend' | 'custom';
  displayName: string;
  photoURL?: string | null;
  customId?: string;
}

export function useFriends() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [customFriends, setCustomFriends] = useState<CustomFriend[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { displayName: string; photoURL: string | null }>>({});
  const [contactOrder, setContactOrder] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setRequests([]); setCustomFriends([]); setContactOrder([]); setLoading(false); return; }

    const q = query(
      collection(db, 'friend_requests'),
      where('fromUserId', '==', user.uid)
    );
    const q2 = query(
      collection(db, 'friend_requests'),
      where('toUserId', '==', user.uid)
    );
    const q3 = query(
      collection(db, 'custom_friends'),
      where('userId', '==', user.uid)
    );

    const unsub1 = onSnapshot(q, (snap) => {
      const sent = snap.docs.map(d => ({ id: d.id, ...d.data() } as FriendRequest));
      setRequests(prev => {
        const incoming = prev.filter(r => r.toUserId === user.uid);
        return [...sent, ...incoming];
      });
      setLoading(false);
    });

    const unsub2 = onSnapshot(q2, (snap) => {
      const received = snap.docs.map(d => ({ id: d.id, ...d.data() } as FriendRequest));
      setRequests(prev => {
        const sent = prev.filter(r => r.fromUserId === user.uid);
        return [...sent, ...received];
      });
      setLoading(false);
    });

    const unsub3 = onSnapshot(q3, (snap) => {
      setCustomFriends(snap.docs.map(d => ({ id: d.id, ...d.data() } as CustomFriend)));
      setLoading(false);
    });

    const unsub4 = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      const data = snap.data();
      setContactOrder(Array.isArray(data?.contactOrder) ? data.contactOrder : []);
    });

    return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
  }, [user]);

  const accepted = requests.filter(r => r.status === 'accepted');

  useEffect(() => {
    if (!user || accepted.length === 0) return;
    
    const fetchProfiles = async () => {
      const pendingUids = accepted
        .map(r => r.fromUserId === user.uid ? r.toUserId : r.fromUserId)
        .filter(uid => !profiles[uid]);
      
      if (pendingUids.length === 0) return;
      
      const newProfiles = { ...profiles };
      let updated = false;
      
      for (const uid of pendingUids) {
        if (!newProfiles[uid]) {
          try {
            const profile = await getUserProfile(uid);
            if (profile) {
              newProfiles[uid] = {
                displayName: profile.displayName || 'User',
                photoURL: profile.photoURL,
              };
              updated = true;
            }
          } catch (e) {
            console.error("Error loading user profile:", e);
          }
        }
      }
      
      if (updated) {
        setProfiles(newProfiles);
      }
    };
    
    fetchProfiles();
  }, [accepted, user]);

  const pendingReceived = requests.filter(
    r => r.status === 'pending' && r.toUserId === user?.uid
  );
  const pendingSent = requests.filter(
    r => r.status === 'pending' && r.fromUserId === user?.uid
  );

  const friends: Friend[] = accepted.map(r => {
    const friendUid = r.fromUserId === user?.uid ? r.toUserId : r.fromUserId;
    const cached = profiles[friendUid];

    if (r.fromUserId === user?.uid) {
      return {
        uid: r.toUserId,
        displayName: cached?.displayName || r.toDisplayName || `Friend ${r.toUserId.slice(0, 6)}`,
        photoURL: cached?.photoURL || r.toPhotoURL || null
      };
    }
    return {
      uid: r.fromUserId,
      displayName: cached?.displayName || r.fromDisplayName || `Friend ${r.fromUserId.slice(0, 6)}`,
      photoURL: cached?.photoURL || r.fromPhotoURL || null
    };
  });

  const allContactKeys = useMemo(
    () => [
      ...friends.map((f) => f.uid),
      ...customFriends.map((cf) => contactKeyForCustom(cf.id!)),
    ],
    [friends, customFriends],
  );

  const mergedContactOrder = useMemo(
    () => mergeContactOrder(contactOrder, allContactKeys),
    [contactOrder, allContactKeys],
  );

  const friendListItems: FriendListItem[] = useMemo(() => {
    const items: FriendListItem[] = [
      ...friends.map((f) => ({
        key: f.uid,
        type: 'friend' as const,
        displayName: f.displayName,
        photoURL: f.photoURL,
      })),
      ...customFriends.map((cf) => ({
        key: contactKeyForCustom(cf.id!),
        type: 'custom' as const,
        displayName: cf.name,
        customId: cf.id,
      })),
    ];
    return sortByContactOrder(items, (item) => item.key, mergedContactOrder);
  }, [friends, customFriends, mergedContactOrder]);

  const sortedFriends = useMemo(
    () => sortByContactOrder(friends, (f) => f.uid, mergedContactOrder),
    [friends, mergedContactOrder],
  );

  const sortedCustomFriends = useMemo(
    () => sortByContactOrder(customFriends, (cf) => contactKeyForCustom(cf.id!), mergedContactOrder),
    [customFriends, mergedContactOrder],
  );

  const contacts: Contact[] = useMemo(() => [
    { key: 'me', displayName: 'Me', isSelf: true },
    ...friendListItems.map((item) => ({
      key: item.key,
      displayName: item.displayName,
      photoURL: item.photoURL,
      isCustom: item.type === 'custom',
    })),
  ], [friendListItems]);

  const appendContactKey = useCallback(async (key: string) => {
    if (!user) return;
    const nextOrder = mergeContactOrder(contactOrder, [...allContactKeys, key]);
    if (!nextOrder.includes(key)) {
      nextOrder.push(key);
    }
    await updateContactOrder(user.uid, nextOrder);
  }, [user, contactOrder, allContactKeys]);

  const reorderContacts = useCallback(async (keys: string[]) => {
    if (!user) return;
    const validKeys = new Set(allContactKeys);
    const nextOrder = keys.filter((key) => validKeys.has(key));
    const missing = allContactKeys.filter((key) => !nextOrder.includes(key));
    await updateContactOrder(user.uid, [...nextOrder, ...missing]);
  }, [user, allContactKeys]);

  const addFriend = async (email: string) => {
    if (!user) throw new Error('Not logged in');
    const found = await searchUserByEmail(email);
    if (!found) throw new Error('ไม่พบผู้ใช้นี้');
    if (found.uid === user.uid) throw new Error('ไม่สามารถเพิ่มตัวเองได้');
    await sendFriendRequest(
      user.uid, found.uid,
      user.displayName || user.email || 'User',
      user.photoURL || null,
      found.displayName || found.email || 'User',
      found.photoURL || null
    );
    return found;
  };

  const addCustomFriend = async (name: string) => {
    if (!user) throw new Error('Not logged in');
    const trimmed = name.trim();
    if (!trimmed) throw new Error('กรุณากรอกชื่อ');
    const lower = trimmed.toLowerCase();
    if (customFriends.some(cf => cf.name.toLowerCase() === lower)) {
      throw new Error('มีชื่อนี้อยู่แล้ว');
    }
    if (friends.some(f => f.displayName.toLowerCase() === lower)) {
      throw new Error('มีชื่อนี้ในรายชื่อเพื่อนแล้ว');
    }
    const id = await createCustomFriend(user.uid, trimmed);
    await appendContactKey(contactKeyForCustom(id));
  };

  const removeCustomFriendById = async (id: string) => {
    if (!user) return;
    await deleteCustomFriend(id);
    const key = contactKeyForCustom(id);
    await updateContactOrder(
      user.uid,
      contactOrder.filter((k) => k !== key),
    );
  };

  const accept = async (requestId: string) => {
    const req = requests.find((r) => r.id === requestId);
    await respondFriendRequest(requestId, 'accepted');
    if (req && user) {
      const friendUid = req.fromUserId === user.uid ? req.toUserId : req.fromUserId;
      await appendContactKey(friendUid);
    }
  };
  const decline = (requestId: string) => respondFriendRequest(requestId, 'declined');
  const remove = (requestId: string) => deleteFriendRequest(requestId);

  return {
    friends: sortedFriends,
    customFriends: sortedCustomFriends,
    friendListItems,
    contacts,
    pendingReceived,
    pendingSent,
    loading,
    addFriend,
    addCustomFriend,
    removeCustomFriend: removeCustomFriendById,
    reorderContacts,
    accept,
    decline,
    remove,
  };
}
