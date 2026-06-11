import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
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
} from '@/lib/firestore';
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

export function useFriends() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [customFriends, setCustomFriends] = useState<CustomFriend[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { displayName: string; photoURL: string | null }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setRequests([]); setCustomFriends([]); setLoading(false); return; }

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

    return () => { unsub1(); unsub2(); unsub3(); };
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

  const contacts: Contact[] = [
    { key: 'me', displayName: 'Me', isSelf: true },
    ...friends.map(f => ({
      key: f.uid,
      displayName: f.displayName,
      photoURL: f.photoURL,
    })),
    ...customFriends.map(cf => ({
      key: `custom:${cf.id}`,
      displayName: cf.name,
      isCustom: true,
    })),
  ];

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
    await createCustomFriend(user.uid, trimmed);
  };

  const removeCustomFriendById = async (id: string) => {
    await deleteCustomFriend(id);
  };

  const accept = (requestId: string) => respondFriendRequest(requestId, 'accepted');
  const decline = (requestId: string) => respondFriendRequest(requestId, 'declined');
  const remove = (requestId: string) => deleteFriendRequest(requestId);

  return {
    friends,
    customFriends,
    contacts,
    pendingReceived,
    pendingSent,
    loading,
    addFriend,
    addCustomFriend,
    removeCustomFriend: removeCustomFriendById,
    accept,
    decline,
    remove,
  };
}
