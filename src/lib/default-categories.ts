import { Category } from '@/lib/firestore-types';

export const DEFAULT_CATEGORY_COLORS = [
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#3B82F6',
  '#EC4899',
  '#14B8A6',
  '#F97316',
];

export const DEFAULT_EXPENSE_CATEGORIES: Array<{
  name: string;
  icon: string;
  color: string;
}> = [
  { name: 'Food & Dining', icon: '🍜', color: '#10B981' },
  { name: 'Transport', icon: '🚇', color: '#F59E0B' },
  { name: 'Shopping', icon: '🛍️', color: '#EF4444' },
  { name: 'Entertainment', icon: '🎬', color: '#8B5CF6' },
  { name: 'Bills & Utilities', icon: '📄', color: '#3B82F6' },
  { name: 'Health & Fitness', icon: '💪', color: '#EC4899' },
  { name: 'Accommodation', icon: '🏨', color: '#14B8A6' },
  { name: 'Activities', icon: '🎯', color: '#F97316' },
  { name: 'Others', icon: '📋', color: '#6B7280' },
];

export const DEFAULT_INCOME_CATEGORY = {
  name: 'Income',
  icon: '💰',
  color: '#22C55E',
};

export function buildDefaultCategories(userId: string): Omit<Category, 'id' | 'createdAt'>[] {
  const expense = DEFAULT_EXPENSE_CATEGORIES.map((c) => ({
    userId,
    name: c.name,
    icon: c.icon,
    color: c.color,
    type: 'expense' as const,
  }));
  return [
    ...expense,
    {
      userId,
      name: DEFAULT_INCOME_CATEGORY.name,
      icon: DEFAULT_INCOME_CATEGORY.icon,
      color: DEFAULT_INCOME_CATEGORY.color,
      type: 'income' as const,
    },
  ];
}
