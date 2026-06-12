export function contactKeyForCustom(id: string) {
  return `custom:${id}`;
}

export function sortByContactOrder<T>(
  items: T[],
  getKey: (item: T) => string,
  order: string[] = [],
): T[] {
  const orderMap = new Map(order.map((key, index) => [key, index]));
  return [...items].sort((a, b) => {
    const aIndex = orderMap.get(getKey(a)) ?? Number.MAX_SAFE_INTEGER;
    const bIndex = orderMap.get(getKey(b)) ?? Number.MAX_SAFE_INTEGER;
    return aIndex - bIndex;
  });
}

export function mergeContactOrder(order: string[], keys: string[]): string[] {
  const validKeys = new Set(keys);
  const filtered = order.filter((key) => validKeys.has(key));
  const existing = new Set(filtered);
  const newKeys = keys.filter((key) => !existing.has(key));
  return [...filtered, ...newKeys];
}
