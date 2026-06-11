import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Green for money in, red for money out */
export function amountColorClass(amount: number, neutral = 'text-muted-foreground') {
  if (amount > 0) return 'text-success'
  if (amount < 0) return 'text-destructive'
  return neutral
}
