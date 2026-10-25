import { describe, expect, it } from 'vitest';
import { endpoint, safeExcerpt, trimTrailingSlashes } from './http-utils';

describe('provider endpoint normalization', () => {
  it('handles a long trailing slash run without a backtracking expression', () => {
    expect(trimTrailingSlashes(`https://fixture.test/v1${'/'.repeat(100_000)}`)).toBe(
      'https://fixture.test/v1',
    );
    expect(endpoint('https://fixture.test/v1///', '/models')).toBe(
      'https://fixture.test/v1/models',
    );
    expect(trimTrailingSlashes('///')).toBe('');
    expect(trimTrailingSlashes('')).toBe('');
    expect(trimTrailingSlashes('https://fixture.test')).toBe('https://fixture.test');
  });
});

describe('provider error excerpts', () => {
  it('redacts a credential before truncating an error body', () => {
    const credential = 'private-provider-credential-with-no-recognizable-prefix';
    const excerpt = safeExcerpt(`${'x'.repeat(500)}${credential}`, credential);
    expect(excerpt).not.toContain('private-prov');
    expect(excerpt).toHaveLength(510);
    expect(excerpt).toContain('[REDACTED]');
  });
});
