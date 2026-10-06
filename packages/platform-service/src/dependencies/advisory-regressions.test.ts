import { createRequire } from 'node:module';
import { expect, it } from 'vitest';

const requireDependency = createRequire(__filename);
const braces = requireDependency('braces') as {
  compile(value: unknown): string;
  expand(value: unknown): string[];
  parse(value: string): unknown;
  stringify(value: unknown): string;
};
const sprintf = (
  requireDependency('sprintf-js') as { sprintf(format: string, value: number): string }
).sprintf;

it('bounds brace nesting and AST traversal while retaining ordinary glob behavior', () => {
  expect(braces.expand('game/{town,village}/*.json')).toEqual([
    'game/town/*.json',
    'game/village/*.json',
  ]);
  expect(() => braces.parse('{a,'.repeat(2000) + 'b' + '}'.repeat(2000))).toThrow(/depth limit/);
  expect(() => braces.parse('('.repeat(2000) + 'b' + ')'.repeat(2000))).toThrow(/depth limit/);
  let ast: unknown = { type: 'text', value: 'x' };
  for (let index = 0; index < 6000; index += 1) ast = { type: 'root', nodes: [ast] };
  expect(() => braces.compile(ast)).toThrow(/depth limit/);
  expect(() => braces.stringify(ast)).toThrow(/depth limit/);
  expect(() => braces.expand(ast)).toThrow(/depth limit/);
});

it('keeps extreme numeric precision bounded rather than throwing native numeric RangeErrors', () => {
  expect(sprintf('%.2f', 1.25)).toBe('1.25');
  expect(sprintf('%.0f', 1.9)).toBe('2');
  expect(() => sprintf('%.1000000f', 1)).not.toThrow();
  expect(sprintf('%.1000000f', 1)).toHaveLength(102);
  expect(() => sprintf('%.0g', 1)).not.toThrow();
  expect(() => sprintf('%.1000000e', 1)).not.toThrow();
  expect(sprintf('%.2s', 123)).toBe('12');
});
