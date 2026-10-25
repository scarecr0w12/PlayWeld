import { expect, it } from 'vitest';
import { AuditExportSchema, AuditExportReceiptSchema } from './audit';
import { RpcMethods } from './rpc/protocol';
import { compile } from './validation';
import { uuidv7 } from './ids';

it('requires a specific history store, session preview and literal confirmation for cleanup', () => {
  const projectId = uuidv7(),
    previewId = uuidv7();
  const apply = compile(RpcMethods['audit/applyCleanup'].params);
  expect(apply.check({ projectId, store: 'project', previewId, confirm: true })).toBe(true);
  expect(apply.check({ projectId, store: 'project', previewId, confirm: false })).toBe(false);
  expect(apply.check({ projectId, store: 'all', previewId, confirm: true })).toBe(false);
  expect(
    apply.check({ projectId, store: 'model-usage', previewId, confirm: true, sql: 'DELETE' }),
  ).toBe(false);
  const policy = compile(RpcMethods['audit/setRetention'].params);
  expect(
    policy.check({
      projectId,
      policy: { retentionDays: 0, deletionEnabled: false, autoPrune: false },
    }),
  ).toBe(true);
  expect(
    policy.check({
      projectId,
      policy: { retentionDays: -1, deletionEnabled: true, autoPrune: true },
    }),
  ).toBe(false);
});

it('validates complete export metadata, empty history and bounded RPC receipts', () => {
  const metadata = {
    schemaVersion: 1,
    projectId: uuidv7(),
    exportedAt: '2026-10-24T00:00:00Z',
    counts: { calls: 0, approvals: 0, events: 0, modelUsage: 0 },
  };
  expect(
    compile(AuditExportSchema).check({
      ...metadata,
      scope: 'full-project-audit',
      calls: [],
      approvals: [],
      events: [],
      modelUsage: [],
    }),
  ).toBe(true);
  const receipt = { ...metadata, path: '/fixture/audit.json', bytes: 100, sha256: 'a'.repeat(64) };
  const validator = compile(AuditExportReceiptSchema);
  expect(validator.check(receipt)).toBe(true);
  expect(validator.check({ ...receipt, sha256: 'invalid' })).toBe(false);
  expect(validator.check({ ...receipt, bytes: -1 })).toBe(false);
  expect(compile(RpcMethods['audit/export'].params).check({ projectId: metadata.projectId })).toBe(
    true,
  );
  expect(
    compile(RpcMethods['audit/export'].params).check({
      projectId: metadata.projectId,
      path: '/arbitrary/output',
    }),
  ).toBe(false);
});
