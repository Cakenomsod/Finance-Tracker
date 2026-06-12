'use client';

import { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { Category } from '@/lib/firestore-types';
import {
  createCategory,
  updateCategory,
  deleteCategory,
} from '@/lib/firestore';
import { buildDefaultCategories } from '@/lib/default-categories';

/** Shared across hook instances to prevent parallel default seeding. */
const seedingUsers = new Set<string>();
const dedupingUsers = new Set<string>();

function categoryKey(category: Pick<Category, 'name' | 'type'>): string {
  return `${category.type}:${category.name.trim().toLowerCase()}`;
}

function findDuplicateCategoryIds(items: Category[]): string[] {
  const keepers = new Map<string, Category>();
  const toDelete: string[] = [];

  for (const item of items) {
    if (!item.id) continue;
    const key = categoryKey(item);
    const existing = keepers.get(key);
    if (existing) {
      const existingTime = existing.createdAt?.seconds ?? 0;
      const itemTime = item.createdAt?.seconds ?? 0;
      if (itemTime >= existingTime) {
        toDelete.push(item.id);
      } else {
        toDelete.push(existing.id!);
        keepers.set(key, item);
      }
    } else {
      keepers.set(key, item);
    }
  }

  return toDelete;
}

export function useCategories() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setCategories([]);
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'categories'), where('userId', '==', user.uid));
    const unsub = onSnapshot(
      q,
      async (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Category));

        if (!dedupingUsers.has(user.uid)) {
          const duplicateIds = findDuplicateCategoryIds(items);
          if (duplicateIds.length > 0) {
            dedupingUsers.add(user.uid);
            try {
              await Promise.all(duplicateIds.map((id) => deleteCategory(id)));
            } catch (err) {
              console.error('Failed to deduplicate categories:', err);
            } finally {
              dedupingUsers.delete(user.uid);
            }
            return;
          }
        }

        const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name));
        setCategories(sorted);
        setLoading(false);

        if (items.length === 0 && !seedingUsers.has(user.uid)) {
          seedingUsers.add(user.uid);
          try {
            const defaults = buildDefaultCategories(user.uid);
            await Promise.all(defaults.map((c) => createCategory(c)));
          } catch (err) {
            console.error('Failed to seed default categories:', err);
            seedingUsers.delete(user.uid);
          }
        }
      },
      () => setLoading(false)
    );

    return () => unsub();
  }, [user]);

  const addCategory = useCallback(
    async (data: Omit<Category, 'id' | 'createdAt' | 'userId'>) => {
      if (!user) throw new Error('Not logged in');
      const key = categoryKey({ name: data.name, type: data.type });
      if (categories.some((c) => categoryKey(c) === key)) {
        throw new Error('DUPLICATE_CATEGORY');
      }
      return createCategory({ ...data, userId: user.uid });
    },
    [user, categories]
  );

  const editCategory = useCallback(
    async (
      id: string,
      data: Partial<Omit<Category, 'id' | 'createdAt' | 'userId' | 'monthlyBudget'>> & {
        monthlyBudget?: number | null;
      }
    ) => {
      if (data.name != null && data.type != null) {
        const key = categoryKey({ name: data.name, type: data.type });
        if (categories.some((c) => c.id !== id && categoryKey(c) === key)) {
          throw new Error('DUPLICATE_CATEGORY');
        }
      } else if (data.name != null) {
        const existing = categories.find((c) => c.id === id);
        if (existing) {
          const key = categoryKey({ name: data.name, type: existing.type });
          if (categories.some((c) => c.id !== id && categoryKey(c) === key)) {
            throw new Error('DUPLICATE_CATEGORY');
          }
        }
      } else if (data.type != null) {
        const existing = categories.find((c) => c.id === id);
        if (existing) {
          const key = categoryKey({ name: existing.name, type: data.type });
          if (categories.some((c) => c.id !== id && categoryKey(c) === key)) {
            throw new Error('DUPLICATE_CATEGORY');
          }
        }
      }
      return updateCategory(id, data);
    },
    [categories]
  );

  const removeCategory = useCallback(async (id: string) => {
    return deleteCategory(id);
  }, []);

  const expenseCategories = categories.filter((c) => c.type === 'expense');
  const incomeCategories = categories.filter((c) => c.type === 'income');

  return {
    categories,
    expenseCategories,
    incomeCategories,
    loading,
    addCategory,
    editCategory,
    removeCategory,
  };
}
