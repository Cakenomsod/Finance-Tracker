'use client';



import { useCallback, useEffect, useRef, useState } from 'react';

import {

  collection,

  getDocs,

  limit,

  onSnapshot,

  orderBy,

  query,

  QueryDocumentSnapshot,

  startAfter,

  where,

} from 'firebase/firestore';

import { db } from '@/lib/firebase';

import type { Transaction } from '@/lib/firestore-types';

import { mergeSnapshots } from '@/lib/firestore-query/merge-snapshots';

import {

  captureWindowedState,

  purgeWindowedId,

  syncOlderItemsAfterRemovals,

  upsertWindowedItem,

} from '@/lib/firestore-query/windowed-list-cache';

import {

  createTransaction,

  deleteTransaction,

  updateTransaction,

} from '@/lib/firestore';

import { useAuth } from '@/hooks/use-auth';

import { collectImmichAssetIds } from '@/lib/immich/asset-ids';

import { requestDeleteImmichAssets } from '@/lib/immich/delete-from-browser';

import {

  deleteTransactionDebts,

  syncTransactionDebts,

} from '@/lib/transaction-debt';



const PAGE_SIZE = 50;



export function useWindowedTransactions(userId: string | undefined) {

  const { user } = useAuth();

  const [items, setItems] = useState<Transaction[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<Error | null>(null);

  const [loadingOlder, setLoadingOlder] = useState(false);

  const [hasMoreOlder, setHasMoreOlder] = useState(true);



  const liveMapRef = useRef<Map<string, Transaction>>(new Map());

  const olderItemsRef = useRef<Transaction[]>([]);

  const lastDocRef = useRef<QueryDocumentSnapshot | null>(null);

  const hasMoreOlderRef = useRef(true);

  const loadingOlderRef = useRef(false);

  const itemsRef = useRef<Transaction[]>([]);



  useEffect(() => {

    itemsRef.current = items;

  }, [items]);



  const rebuildItems = useCallback(() => {

    setItems(mergeSnapshots(olderItemsRef.current, liveMapRef.current));

  }, []);



  const purgeId = useCallback(

    (id: string) => {

      const next = purgeWindowedId(liveMapRef.current, olderItemsRef.current, id);

      liveMapRef.current = next.liveMap;

      olderItemsRef.current = next.olderItems;

      rebuildItems();

    },

    [rebuildItems]

  );



  const upsertLocal = useCallback(

    (item: Transaction) => {

      const next = upsertWindowedItem(liveMapRef.current, olderItemsRef.current, item);

      liveMapRef.current = next.liveMap;

      olderItemsRef.current = next.olderItems;

      rebuildItems();

    },

    [rebuildItems]

  );



  const resetPagination = useCallback(() => {

    liveMapRef.current = new Map();

    olderItemsRef.current = [];

    lastDocRef.current = null;

    hasMoreOlderRef.current = true;

    setHasMoreOlder(true);

    setItems([]);

    setLoading(true);

    setError(null);

  }, []);



  useEffect(() => {

    if (!userId) {

      liveMapRef.current = new Map();

      olderItemsRef.current = [];

      lastDocRef.current = null;

      hasMoreOlderRef.current = false;

      setHasMoreOlder(false);

      setItems([]);

      setLoading(false);

      return;

    }

    resetPagination();

  }, [userId, resetPagination]);



  useEffect(() => {

    if (!userId) return;



    const q = query(

      collection(db, 'transactions'),

      where('userId', '==', userId),

      orderBy('date', 'desc'),

      limit(PAGE_SIZE)

    );



    const unsub = onSnapshot(

      q,

      (snapshot) => {

        olderItemsRef.current = syncOlderItemsAfterRemovals(

          olderItemsRef.current,

          snapshot.docChanges()

        );



        const map = new Map<string, Transaction>();

        snapshot.docs.forEach((doc) => {

          map.set(doc.id, { id: doc.id, ...doc.data() } as Transaction);

        });

        liveMapRef.current = map;



        if (olderItemsRef.current.length === 0) {

          lastDocRef.current =

            snapshot.docs.length > 0

              ? snapshot.docs[snapshot.docs.length - 1]

              : null;

          if (snapshot.docs.length < PAGE_SIZE) {

            hasMoreOlderRef.current = false;

            setHasMoreOlder(false);

          }

        }



        rebuildItems();

        setLoading(false);

        setError(null);

      },

      (err) => {

        console.error('Transactions listener error:', err);

        setError(err);

        setLoading(false);

      }

    );



    return () => unsub();

  }, [userId, rebuildItems]);



  const loadOlder = useCallback(async (): Promise<number> => {

    if (

      !userId ||

      loadingOlderRef.current ||

      !hasMoreOlderRef.current ||

      !lastDocRef.current

    ) {

      return 0;

    }



    loadingOlderRef.current = true;

    setLoadingOlder(true);



    try {

      const q = query(

        collection(db, 'transactions'),

        where('userId', '==', userId),

        orderBy('date', 'desc'),

        startAfter(lastDocRef.current),

        limit(PAGE_SIZE)

      );



      const snapshot = await getDocs(q);

      if (snapshot.docs.length === 0) {

        hasMoreOlderRef.current = false;

        setHasMoreOlder(false);

        return 0;

      }



      const existingIds = new Set([

        ...olderItemsRef.current.map((item) => item.id),

        ...liveMapRef.current.keys(),

      ]);



      const newItems: Transaction[] = [];

      snapshot.docs.forEach((doc) => {

        if (!existingIds.has(doc.id)) {

          newItems.push({ id: doc.id, ...doc.data() } as Transaction);

        }

      });



      olderItemsRef.current = mergeSnapshots(olderItemsRef.current, newItems);

      lastDocRef.current = snapshot.docs[snapshot.docs.length - 1];



      if (snapshot.docs.length < PAGE_SIZE) {

        hasMoreOlderRef.current = false;

        setHasMoreOlder(false);

      }



      rebuildItems();

      return newItems.length;

    } catch (err) {

      console.error('Load older transactions error:', err);

      setError(err instanceof Error ? err : new Error(String(err)));

      return 0;

    } finally {

      loadingOlderRef.current = false;

      setLoadingOlder(false);

    }

  }, [userId, rebuildItems]);



  const addTransaction = useCallback(

    async (data: Omit<Transaction, 'id' | 'createdAt' | 'userId'>) => {

      if (!user) throw new Error('Must be logged in to add a transaction');

      const txData = { ...data, userId: user.uid, currency: 'THB' as const };

      const txRef = await createTransaction(txData);

      await syncTransactionDebts(user.uid, txRef.id, txData);

      upsertLocal({ id: txRef.id, ...txData } as Transaction);

      return txRef;

    },

    [user, upsertLocal]

  );



  const editTransaction = useCallback(

    async (

      id: string,

      data: Partial<Omit<Transaction, 'id' | 'createdAt' | 'userId'>>

    ) => {

      if (!user) throw new Error('Must be logged in to edit a transaction');

      const existing = itemsRef.current.find((t) => t.id === id);

      if (!existing) throw new Error('Transaction not found');

      const merged = { ...existing, ...data, currency: 'THB' as const };

      const cacheBefore = captureWindowedState(

        liveMapRef.current,

        olderItemsRef.current

      );

      upsertLocal(merged);

      try {

        await updateTransaction(id, { ...data, currency: 'THB' });

        await syncTransactionDebts(user.uid, id, merged);

      } catch (err) {

        liveMapRef.current = cacheBefore.liveMap;

        olderItemsRef.current = cacheBefore.olderItems;

        rebuildItems();

        throw err;

      }

    },

    [user, upsertLocal, rebuildItems]

  );



  const removeTransaction = useCallback(

    async (

      id: string,

      override?: {

        immichAssetId?: string | null;

        immichAssetIds?: string[] | null;

      } | null

    ) => {

      if (!user) throw new Error('Must be logged in to delete a transaction');

      const tx = itemsRef.current.find((t) => t.id === id);

      const ids = collectImmichAssetIds({

        immichAssetId: override?.immichAssetId ?? tx?.immichAssetId,

        immichAssetIds: override?.immichAssetIds ?? tx?.immichAssetIds,

      });

      const cacheBefore = captureWindowedState(

        liveMapRef.current,

        olderItemsRef.current

      );

      purgeId(id);

      try {

        if (ids.length > 0) {

          await requestDeleteImmichAssets(ids);

        }

        await deleteTransactionDebts(id);

        await deleteTransaction(id);

      } catch (err) {

        liveMapRef.current = cacheBefore.liveMap;

        olderItemsRef.current = cacheBefore.olderItems;

        rebuildItems();

        throw err;

      }

    },

    [user, purgeId, rebuildItems]

  );



  return {

    items,

    loading,

    error,

    hasMoreOlder,

    loadOlder,

    loadingOlder,

    addTransaction,

    editTransaction,

    removeTransaction,

  };

}


