import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
vi.mock('@theia/core/shared/inversify', () => ({
  injectable: () => () => {},
  inject: () => () => {},
}));
vi.mock('@theia/core/lib/browser/widgets/widget', () => ({ Message: class {} }));
vi.mock('./control-room-react-widget', () => ({ ControlRoomReactWidget: class {} }));
vi.mock('./control-room-client', () => ({ ControlRoomClientEvents: class {} }));
import { AuditWidget } from './audit-widget';

function widget() {
  return Object.assign(Object.create(AuditWidget.prototype), {
    projectId: 'project',
    projects: [{ projectId: 'project', name: 'Fixture' }],
    query: '',
    afterSeq: 0,
    activeSection: 'usage',
    busy: false,
    update: vi.fn(),
    snapshot: {
      limit: 500,
      nextAfterSeq: 0,
      calls: [],
      events: [],
      modelUsage: [
        {
          usageId: 'priced',
          decisionId: 'priced',
          requestId: 'request-1',
          taskId: null,
          modelId: 'priced-model',
          occurredAt: '2026-10-04T00:00:00Z',
          source: 'completion',
          inputTokens: 500,
          outputTokens: 100,
          costUsd: 0.004567,
          costStatus: 'known',
          cacheReadInputTokens: 0,
          cacheCreationInputTokens: 0,
        },
        {
          usageId: 'unpriced',
          decisionId: 'unpriced',
          requestId: 'request-2',
          taskId: null,
          modelId: 'unpriced-model',
          occurredAt: '2026-10-04T00:01:00Z',
          source: 'completion',
          inputTokens: 200,
          outputTokens: 40,
          costUsd: null,
          costStatus: 'unknown',
          cacheReadInputTokens: 0,
          cacheCreationInputTokens: 0,
        },
      ],
    },
  });
}

describe('Audit cost visibility', () => {
  it('downloads the complete service export for the captured Project while preserving the current page and filter', async () => {
    const view = widget();
    view.query = 'request-1';
    view.afterSeq = 700;
    const snapshot = view.snapshot;
    const receipt = {
      path: '/tmp/audit fixture.json',
      counts: { calls: 1201, events: 1500, approvals: 2, modelUsage: 1300 },
      bytes: 42000,
    };
    view.service = {
      exportAudit: vi.fn(async () => {
        view.projectId = 'another-project';
        return receipt;
      }),
    };
    view.downloads = { download: vi.fn(async () => undefined) };
    await view.exportFullHistory();
    expect(view.service.exportAudit).toHaveBeenCalledWith('project');
    expect(view.downloads.download).toHaveBeenCalledOnce();
    expect(view.downloads.download.mock.calls[0][0][0].scheme).toBe('file');
    expect(view.exportNotice).toContain('Fixture');
    expect(view.exportNotice).toContain('4003 records');
    expect(view.snapshot).toBe(snapshot);
    expect(view.query).toBe('request-1');
    expect(view.afterSeq).toBe(700);
    expect(view.exporting).toBe(false);
  });

  it('shows export preparation failures and allows another attempt without discarding the loaded page', async () => {
    const view = widget();
    const snapshot = view.snapshot;
    view.service = { exportAudit: vi.fn().mockRejectedValue(new Error('Fixture disk full')) };
    view.downloads = { download: vi.fn() };
    await view.exportFullHistory();
    expect(view.error).toBe('Fixture disk full');
    expect(view.exporting).toBe(false);
    expect(view.snapshot).toBe(snapshot);
    expect(view.downloads.download).not.toHaveBeenCalled();
  });
  it('offers a complete-history export independently of the current page and filter', () => {
    const view = widget();
    view.query = 'does-not-match';
    view.snapshot = undefined;
    const html = renderToStaticMarkup(view.render());
    expect(html).toContain('Export full history');
    expect(html).not.toContain('disabled="">Export full history');
  });
  it('shows decision inference with unknown tokens and cache counts without inventing zeroes', () => {
    const view = widget();
    view.snapshot.modelUsage = [
      {
        ...view.snapshot.modelUsage[0],
        source: 'decision',
        modelId: 'decision:local-judge',
        inputTokens: null,
        outputTokens: null,
        cacheReadInputTokens: null,
        cacheCreationInputTokens: null,
        costUsd: null,
        costStatus: 'unknown',
      },
    ];
    const html = renderToStaticMarkup(view.render());
    expect(html).toContain('decision:local-judge');
    expect(html).toContain('decision / Unknown in');
    expect(html).toContain('1 request(s) have incomplete token counts');
    expect(html).toContain('Pricing unavailable');
  });
  it('summarizes only matching model usage, not a duplicate linked tool charge', () => {
    const view = widget();
    view.query = 'request-1';
    view.snapshot.calls = [
      {
        callId: 'request-1',
        toolId: 'model/complete',
        costUsd: 99,
        costStatus: 'known',
        startedAt: '2026-10-04T00:00:00Z',
        decisionReason: 'Fixture',
        status: 'completed',
        decision: 'allow',
        accessMode: 'full',
      },
    ];
    const html = renderToStaticMarkup(view.render());
    const summary = html.slice(
      html.indexOf('<dl class="gamecrafter-audit-stats">'),
      html.indexOf('</dl>'),
    );
    expect(summary).toContain('$0.004567');
    expect(summary).not.toContain('$99');
    expect(summary).toContain('1 / 1');
  });
  it('selects a direct completion by usage identity even when decision IDs are absent', () => {
    const view = widget();
    view.snapshot.modelUsage = view.snapshot.modelUsage.map((entry) => ({
      ...entry,
      decisionId: null,
    }));
    view.selectedUsageId = 'unpriced';
    const html = renderToStaticMarkup(view.render());
    const inspector = html.slice(
      html.indexOf('aria-label="Selected model request"'),
      html.indexOf('</article>'),
    );
    expect(inspector).toContain('unpriced-model');
    expect(inspector).toContain('Pricing unavailable');
  });
  it('shows model usage independently of free tool operations and does not flatten small costs to zero', () => {
    const html = renderToStaticMarkup(widget().render());
    expect(html).toContain('Model usage');
    expect(html).toContain('$0.004567');
    expect(html).toContain('Pricing unavailable');
    expect(html).toContain('priced-model');
    expect(html).toContain('unpriced-model');
  });
  it('distinguishes legacy unverifiable records from explicitly priced zero-cost calls', () => {
    const view = widget();
    view.snapshot.modelUsage = [
      {
        ...view.snapshot.modelUsage[0],
        usageId: 'legacy',
        decisionId: 'legacy',
        modelId: 'legacy-model',
        costUsd: 0,
        costStatus: 'unverified',
      },
      {
        ...view.snapshot.modelUsage[0],
        usageId: 'free',
        decisionId: 'free',
        modelId: 'free-model',
        costUsd: 0,
        costStatus: 'known',
      },
    ];
    const html = renderToStaticMarkup(view.render());
    expect(html).toContain('Legacy cost unverified');
    expect(html).toContain('$0.00');
    expect(html).not.toContain('$0.0000');
  });
});
