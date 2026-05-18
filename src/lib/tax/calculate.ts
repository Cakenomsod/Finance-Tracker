import type { TaxCategoryId, TaxMode } from './countries';
import { getTaxRule } from './countries';

export interface LineTaxResult {
  base: number;
  tax: number;
  total: number;
  rate: number;
}

export function calculateLineTax(
  priceInput: number,
  taxCategoryId: TaxCategoryId,
  countryCode: string,
  mode: TaxMode
): LineTaxResult {
  if (!priceInput || priceInput <= 0) {
    return { base: 0, tax: 0, total: 0, rate: 0 };
  }

  const rule = getTaxRule(countryCode, taxCategoryId);
  const rate = rule?.rate ?? 0;

  if (mode === 'exclusive') {
    const base = priceInput;
    const tax = base * rate;
    return { base, tax, total: base + tax, rate };
  }

  const total = priceInput;
  const base = rate > 0 ? total / (1 + rate) : total;
  const tax = total - base;
  return { base, tax, total, rate };
}

export function roundMoney(n: number): number {
  return parseFloat(n.toFixed(2));
}
