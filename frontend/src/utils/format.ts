// frontend/src/utils/format.ts

/**
 * Formats amount in cents/kobo to Nigerian Naira (₦) display string.
 * e.g., 500000 cents -> ₦5,000.00
 */
export function formatNaira(amountCents: number | string | bigint): string {
  const num = typeof amountCents === 'bigint' ? Number(amountCents) : Number(amountCents);
  if (isNaN(num)) return '₦0.00';
  const naira = num / 100;
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(naira);
}

/**
 * Formats a ISO date string to a human-readable format.
 */
export function formatDate(isoString: string): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  return new Intl.DateTimeFormat('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}
