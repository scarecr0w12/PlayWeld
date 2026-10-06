import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { expect, it } from 'vitest';
import { gte } from 'semver';

it('resolves the declared patched MCP fixture SDK rather than a stale nested install', () => {
  const localRequire = createRequire(__filename);
  const entry = localRequire.resolve('@modelcontextprotocol/sdk/client/index.js');
  const installed = JSON.parse(
    readFileSync(path.resolve(path.dirname(entry), '../../../package.json'), 'utf8'),
  ) as { version: string };
  const workspace = JSON.parse(
    readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8'),
  ) as { devDependencies: Record<string, string> };
  expect(installed.version).toBe(workspace.devDependencies['@modelcontextprotocol/sdk']);
  expect(gte(installed.version, '1.31.0')).toBe(true);
});
