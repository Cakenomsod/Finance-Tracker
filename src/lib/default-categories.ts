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

/** First choice for a brand-new user before any category has been used. */
export const PREFERRED_FIRST_EXPENSE_CATEGORY = 'Food & Dining';

const DEFAULT_CATEGORY_ORDER = [
  ...DEFAULT_EXPENSE_CATEGORIES.map((c) => c.name),
  'Income',
];

/** Seeded names stay English in Firestore (AI, LINE and analytics match on them); only the label is localized. */
const DEFAULT_CATEGORY_LABELS: Record<string, { th: string; zh: string }> = {
  'Food & Dining': { th: 'อาหารและเครื่องดื่ม', zh: '餐饮' },
  Transport: { th: 'เดินทาง', zh: '交通' },
  Shopping: { th: 'ช้อปปิ้ง', zh: '购物' },
  Entertainment: { th: 'บันเทิง', zh: '娱乐' },
  'Bills & Utilities': { th: 'บิลและค่าน้ำไฟ', zh: '账单水电' },
  'Health & Fitness': { th: 'สุขภาพ', zh: '健康健身' },
  Accommodation: { th: 'ที่พัก', zh: '住宿' },
  Activities: { th: 'กิจกรรม', zh: '活动' },
  Others: { th: 'อื่นๆ', zh: '其他' },
  Income: { th: 'รายรับ', zh: '收入' },
  Transfer: { th: 'โอน', zh: '转账' },
};

/** System categories stored under a Thai name (e.g. auto-created debt payments). */
const THAI_SYSTEM_CATEGORY_LABELS: Record<string, { en: string; zh: string }> = {
  'หนี้': { en: 'Debt', zh: '欠款' },
};

export function categoryLabel(name: string, locale: 'en' | 'th' | 'zh'): string {
  const thaiSystem = THAI_SYSTEM_CATEGORY_LABELS[name];
  if (thaiSystem) return locale === 'th' ? name : thaiSystem[locale];
  if (locale === 'en') return name;
  return DEFAULT_CATEGORY_LABELS[name]?.[locale] ?? name;
}

/** Seeded categories in their intended order, then the user's own alphabetically. */
export function compareCategories(a: { name: string }, b: { name: string }): number {
  const ai = DEFAULT_CATEGORY_ORDER.indexOf(a.name);
  const bi = DEFAULT_CATEGORY_ORDER.indexOf(b.name);
  if (ai !== -1 || bi !== -1) {
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  }
  return a.name.localeCompare(b.name);
}

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
