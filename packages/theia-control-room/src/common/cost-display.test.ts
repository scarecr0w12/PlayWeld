import { describe, expect, it } from 'vitest';
import { costStatusLabel, formatCostUsd } from './cost-display';
describe('cost evidence labels', () => {
  it('preserves small positive costs while keeping genuine zero distinct', () => {
    expect(formatCostUsd(0.004567)).toBe('$0.004567');
    expect(formatCostUsd(0.000001)).toBe('$0.000001');
    expect(formatCostUsd(0.000000001)).toBe('< $0.00000001');
    expect(formatCostUsd(0)).toBe('$0.00');
  });
  it('does not label missing or unverifiable pricing as free', () => {
    expect(costStatusLabel(null, 'unknown')).toBe('Pricing unavailable');
    expect(costStatusLabel(0, 'unverified')).toBe('Legacy cost unverified');
    expect(costStatusLabel(0, 'untracked')).toBe('No charge reported');
    expect(costStatusLabel(0, 'known')).toBe('$0.00');
    expect(costStatusLabel(0.1, 'partial')).toBe('$0.10 + unpriced usage');
  });
});
