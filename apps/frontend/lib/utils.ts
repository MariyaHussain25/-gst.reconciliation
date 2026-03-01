/**
 * @file apps/frontend/lib/utils.ts
 * @description Utility functions for the frontend.
 * Includes the `cn` helper for merging Tailwind CSS class names.
 */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges Tailwind CSS class names, resolving conflicts intelligently.
 * Uses clsx for conditional class names and tailwind-merge for deduplication.
 *
 * @param inputs - Class name strings, arrays, or conditional objects
 * @returns Merged class name string
 *
 * @example
 * cn('px-4 py-2', isActive && 'bg-blue-500', 'text-white')
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Formats a YYYY-MM period string into a human-readable month/year label.
 *
 * @param period - Period string in YYYY-MM format
 * @returns Formatted string (e.g. "March 2024")
 */
export function formatPeriod(period: string): string {
  const parts = period.split('-');
  const yearStr = parts[0];
  const monthStr = parts[1];

  if (!yearStr || !monthStr) {
    return period; // Return as-is if format is invalid
  }

  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return period; // Return as-is if values are out of range
  }

  const date = new Date(year, month - 1);
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

/**
 * Formats a number as Indian currency (INR).
 *
 * @param amount - Numeric amount
 * @returns Formatted string (e.g. "₹1,23,456.78")
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount);
}
