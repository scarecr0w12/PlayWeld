import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import { AuditRetentionPanel } from './audit-retention-panel';

const views: Array<{ componentWillUnmount(): void }> = [];
afterEach(() => {
  for (const view of views.splice(0)) view.componentWillUnmount();
  vi.useRealTimers();
});
function fixture(enabled = true) {
  const data = {
    schemaVersion: 1,
    projectId: 'project-a',
    policy: { retentionDays: 365, deletionEnabled: enabled, autoPrune: false },
    receipts: [],
  };
  const counts = {
    calls: 1,
    approvals: 1,
    events: 1,
    modelUsage: 0,
    decisionAssessments: 0,
    legacyUsage: 0,
  };
  const preview = {
    schemaVersion: 1,
    projectId: 'project-a',
    previewId: 'preview-a',
    store: 'project',
    before: '2025-01-01T00:00:00.000Z',
    expiresAt: new Date(Date.now() + 300000).toISOString(),
    counts,
    hasMore: false,
  };
  const service = {
    auditRetention: vi.fn(async () => data),
    setAuditRetention: vi.fn(async () => data),
    previewAuditCleanup: vi.fn(async () => preview),
    applyAuditCleanup: vi.fn(async () => ({
      ...preview,
      cleanupId: 'cleanup-a',
      completedAt: new Date().toISOString(),
      origin: 'manual',
    })),
  };
  const onCleanup = vi.fn();
  const view = Object.assign(Object.create(AuditRetentionPanel.prototype), {
    props: { projectId: 'project-a', service, onCleanup },
    state: {
      data,
      draft: { ...data.policy },
      store: 'project',
      before: '',
      confirmed: false,
      busy: false,
    },
    alive: true,
    running: false,
    setState: (patch: object) => Object.assign(view.state, patch),
  });
  views.push(view);
  return { view, service, preview, onCleanup };
}
it('previews without deleting and requires explicit confirmation plus an enabled policy', async () => {
  const f = fixture();
  await f.view.preview();
  await f.view.apply();
  expect(f.service.applyAuditCleanup).not.toHaveBeenCalled();
  const html = renderToStaticMarkup(React.createElement(f.view.render.bind(f.view)));
  expect(html).toContain('Confirm audit deletion');
  expect(html).toContain('Permanently delete previewed records');
  const blocked = fixture(false);
  await blocked.view.preview();
  blocked.view.state.confirmed = true;
  await blocked.view.apply();
  expect(blocked.service.applyAuditCleanup).not.toHaveBeenCalled();
});
it('applies only the confirmed Project/store/preview and refreshes history after success', async () => {
  const f = fixture();
  await f.view.preview();
  f.view.state.confirmed = true;
  await f.view.apply();
  expect(f.service.applyAuditCleanup).toHaveBeenCalledWith({
    projectId: 'project-a',
    store: 'project',
    previewId: 'preview-a',
    confirm: true,
  });
  expect(f.onCleanup).toHaveBeenCalledOnce();
  expect(f.view.state.preview).toBeUndefined();
  expect(f.view.state.confirmed).toBe(false);
  expect(f.view.state.notice).toContain('3 audit records');
  await f.view.apply();
  expect(f.service.applyAuditCleanup).toHaveBeenCalledTimes(1);
});
it('invalidates review when policy changes and saves all policy fields through one operation', async () => {
  const f = fixture();
  await f.view.preview();
  f.view.state.confirmed = true;
  f.view.edit({ retentionDays: 0 });
  expect(f.view.state.preview).toBeUndefined();
  expect(f.view.state.confirmed).toBe(false);
  await f.view.preview();
  expect(f.service.previewAuditCleanup).toHaveBeenCalledTimes(1);
  await f.view.save();
  expect(f.service.setAuditRetention).toHaveBeenCalledWith('project-a', {
    retentionDays: 0,
    deletionEnabled: true,
    autoPrune: false,
  });
});
it('expires the visible confirmation and never submits an expired preview', async () => {
  vi.useFakeTimers();
  const f = fixture();
  await f.view.preview();
  f.view.state.confirmed = true;
  await vi.advanceTimersByTimeAsync(300001);
  expect(f.view.state.preview).toBeUndefined();
  expect(f.view.state.confirmed).toBe(false);
  await f.view.apply();
  expect(f.service.applyAuditCleanup).not.toHaveBeenCalled();
});
it('discards failed review state without retrying mutations', async () => {
  const f = fixture();
  await f.view.preview();
  f.view.state.confirmed = true;
  f.service.applyAuditCleanup.mockRejectedValueOnce(new Error('History changed; preview again'));
  await f.view.apply();
  expect(f.view.state.error).toContain('History changed');
  expect(f.view.state.preview).toBeUndefined();
  expect(f.view.state.confirmed).toBe(false);
  expect(f.onCleanup).not.toHaveBeenCalled();
  expect(f.service.applyAuditCleanup).toHaveBeenCalledTimes(1);
});
it('ignores a late preview after its Project panel unmounts', async () => {
  const f = fixture();
  let resolve!: (value: typeof f.preview) => void;
  f.service.previewAuditCleanup.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const pending = f.view.preview();
  f.view.componentWillUnmount();
  resolve(f.preview);
  await pending;
  expect(f.view.state.preview).toBeUndefined();
  expect(f.service.applyAuditCleanup).not.toHaveBeenCalled();
});
