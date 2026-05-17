import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, or } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { FriendRequest } from '@/lib/firestore-types';
import {
  sendFriendRequest,
  respondFriendRequest,
  deleteFriendRequest,
  searchUserByEmail,
  getUserProfile,
} from '@/lib/firestore';
import { useAuth } from './use-auth';

export interface Friend {
  uid: string;
  displayName: string;
  photoURL: string | null;
}

export function useFriends() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { displayName: string; photoURL: string | null }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setRequests([]); setLoading(false); return; }

    // Listen to all friend requests involving this user
    const q = query(
      collection(db, 'friend_requests'),
      where('fromUserId', '==', user.uid)
    );
    const q2 = query(
      collection(db, 'friend_requests'),
      where('toUserId', '==', user.uid)
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

    return () => { unsub1(); unsub2(); };
  }, [user]);

  // Derived lists
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

  // Friends = accepted requests, extract the "other" person
  const friends: Friend[] = accepted.map(r => {
    const friendUid = r.fromUserId === user?.uid ? r.toUserId : r.fromUserId;
    const cached = profiles[friendUid];

    if (r.fromUserId === user?.uid) {
      // We sent the request; toUser is the friend
      return {
        uid: r.toUserId,
        displayName: cached?.displayName || r.toDisplayName || '—',
        photoURL: cached?.photoURL || r.toPhotoURL || null
      };
    }
    return {
      uid: r.fromUserId,
      displayName: cached?.displayName || r.fromDisplayName || '—',
      photoURL: cached?.photoURL || r.fromPhotoURL || null
    };
  });

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

  const accept = (requestId: string) => respondFriendRequest(requestId, 'accepted');
  const decline = (requestId: string) => respondFriendRequest(requestId, 'declined');
  const remove = (requestId: string) => deleteFriendRequest(requestId);

  return {
    friends,
    pendingReceived,
    pendingSent,
    loading,
    addFriend,
    accept,
    decline,
    remove,
  };
}
