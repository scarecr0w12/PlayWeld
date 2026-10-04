/** Keep sub-cent recorded charges visible without treating missing prices as zero. */
export function formatCostUsd(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value < 0)
    return 'Pricing unavailable';
  if (value > 0 && value < 0.00000001) return '< $0.00000001';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  }).format(value);
}

export function costStatusLabel(value: number | null | undefined, status?: string): string {
  if (status === 'known') return formatCostUsd(value);
  if (status === 'partial') return `${formatCostUsd(value)} + unpriced usage`;
  if (status === 'unknown') return 'Pricing unavailable';
  if (status === 'untracked') return 'No charge reported';
  return value && value > 0 ? `Unverified ${formatCostUsd(value)}` : 'Legacy cost unverified';
}
