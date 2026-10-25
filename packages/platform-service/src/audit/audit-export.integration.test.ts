import { createHash } from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { uuidv7, compile, AuditExportSchema } from '@gamecrafter/contracts';
import { connect } from '@gamecrafter/service-client';
import { Database } from '../db/database';
import { resolvePaths } from '../paths';
import { PlatformService } from '../service';

let service: PlatformService | undefined;
let directory: string | undefined;
afterEach(async () => {
  await service?.stop();
  service = undefined;
  if (directory) rmSync(directory, { recursive: true, force: true });
});

it('exports all retained Project audit records beyond page limits, redacts payloads and preserves usage counts', async () => {
  directory = mkdtempSync(path.join(tmpdir(), 'gc-audit-export-'));
  const paths = resolvePaths({ GAMECRAFTER_PROFILE_DIR: path.join(directory, 'profile') });
  service = await PlatformService.start({ paths, platformVersion: '0.22.0' });
  const client = await connect({
    socketPath: service.socketPath,
    token: readFileSync(paths.tokenPath, 'utf8').trim(),
    clientName: 'audit-export-test',
    clientVersion: '0.22.0',
  });
  try {
    await client.call('settings/set', {
      key: 'board.maintenanceEnabled',
      scope: 'platform',
      value: false,
    });
    const project = await client.call('project/create', {
      name: 'Audit fixture',
      parentDirectory: directory,
      engine: { family: 'godot' },
      genres: ['adventure'],
      description: 'Disposable audit export',
    });
    const projectDb = Database.open(path.join(project.path, '.gamecrafter', 'project.sqlite'));
    const profile = Database.open(paths.profileDbPath);
    const timestamp = '2026-10-24T00:00:00.000Z';
    try {
      projectDb.transaction(() => {
        for (let index = 0; index < 1201; index++) {
          projectDb
            .prepare(
              'INSERT INTO events (event_id, seq, kind, occurred_at, actor, payload) VALUES (?, ?, ?, ?, ?, ?)',
            )
            .run(
              uuidv7(),
              index + 100,
              'fixture.audit',
              timestamp,
              'fixture',
              JSON.stringify({
                index,
                password: 'private-fixture-value',
                nested: { apiKey: 'never-export-this' },
                text: 'Unicode: café 🎮',
              }),
            );
          const callId = uuidv7();
          projectDb
            .prepare(
              `INSERT INTO tool_calls (call_id, project_id, task_id, agent_id, tool_id, input, access_mode, decision, decision_reason, status, output, error, evidence, cost_usd, cost_status, started_at, finished_at) VALUES (?, ?, NULL, NULL, 'fixture/read', ?, 'restricted', 'allowed', 'fixture', 'completed', ?, NULL, '[]', 0, 'known', ?, ?)`,
            )
            .run(
              callId,
              project.projectId,
              JSON.stringify({ token: 'private-call-token' }),
              JSON.stringify({ index }),
              timestamp,
              timestamp,
            );
        }
      });
      const approvalCall = projectDb
        .prepare("SELECT call_id AS id FROM tool_calls WHERE tool_id = 'fixture/read' LIMIT 1")
        .get<{ id: string }>()!.id;
      projectDb
        .prepare(
          `INSERT INTO approvals (approval_id, project_id, call_id, tool_id, side_effects, summary, input, requested_at, resolved_at, approved, reason) VALUES (?, ?, ?, 'fixture/read', 'workspace-write', 'Fixture approval', ?, ?, ?, 0, 'Rejected')`,
        )
        .run(
          uuidv7(),
          project.projectId,
          approvalCall,
          JSON.stringify({ authorization: 'private-approval-token' }),
          timestamp,
          timestamp,
        );
      profile.transaction(() => {
        for (let index = 0; index < 1201; index++)
          profile
            .prepare(
              `INSERT INTO model_usage (usage_id, request_id, project_id, task_id, decision_id, model_id, occurred_at, input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens, cost_usd, cost_status) VALUES (?, ?, ?, NULL, NULL, 'fixture-model', ?, 13, 7, 3, 2, 0, 'known')`,
            )
            .run(uuidv7(), `request-${index}`, project.projectId, timestamp);
        profile
          .prepare(
            `INSERT INTO model_usage (usage_id, project_id, model_id, occurred_at, input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens, cost_usd, cost_status) VALUES (?, ?, 'foreign-model', ?, 99, 99, 0, 0, 0, 'known')`,
          )
          .run(uuidv7(), uuidv7(), timestamp);
        for (const duplicate of [false, true]) {
          const decisionId = uuidv7();
          profile
            .prepare(
              `INSERT INTO route_decisions (decision_id, decision, project_id, task_type, model_id, explored, decided_at) VALUES (?, '{}', ?, 'fixture', 'legacy-fixture', 0, ?)`,
            )
            .run(decisionId, project.projectId, timestamp);
          profile
            .prepare(
              `INSERT INTO route_outcomes (decision_id, success, source, cost_usd, latency_ms, input_tokens, output_tokens, recorded_at) VALUES (?, 1, 'self', 1, 5, 17, 9, ?)`,
            )
            .run(decisionId, timestamp);
          if (duplicate)
            profile
              .prepare(
                'UPDATE model_usage SET decision_id = ? WHERE usage_id = (SELECT usage_id FROM model_usage WHERE project_id = ? LIMIT 1)',
              )
              .run(decisionId, project.projectId);
        }
        for (const status of ['assessed', 'pending']) {
          const assessmentId = uuidv7();
          profile
            .prepare(
              'INSERT INTO decision_assessments (assessment_id, project_id, created_at, assessment_json) VALUES (?, ?, ?, ?)',
            )
            .run(
              assessmentId,
              project.projectId,
              timestamp,
              JSON.stringify({
                assessmentId,
                projectId: project.projectId,
                taskId: null,
                createdAt: timestamp,
                status,
                reasonCodes: [],
                requestedModel: 'fixture-judge',
                returnedModel: null,
                usage: { inputTokens: null, outputTokens: null, costUsd: null },
              }),
            );
        }
      });
      const page = await client.call('audit/read', { projectId: project.projectId });
      expect(page.calls).toHaveLength(500);
      const receipt = await client.call('audit/export', { projectId: project.projectId });
      const bytes = readFileSync(receipt.path);
      const report = JSON.parse(bytes.toString('utf8'));
      expect(
        report.calls.filter((call: { toolId: string }) => call.toolId === 'fixture/read'),
      ).toHaveLength(1201);
      expect(
        report.events.filter((event: { kind: string }) => event.kind === 'fixture.audit'),
      ).toHaveLength(1201);
      expect(report.events.length).toBeGreaterThan(page.events.length);
      compile(AuditExportSchema).assert(report);
      expect(report.modelUsage).toHaveLength(1203);
      expect(
        report.modelUsage.filter(
          (usage: { costStatus: string }) => usage.costStatus === 'unverified',
        ),
      ).toHaveLength(1);
      expect(
        report.modelUsage.filter((usage: { source: string }) => usage.source === 'decision'),
      ).toHaveLength(1);
      expect(report.approvals).toHaveLength(1);
      expect(report.approvals[0]).toMatchObject({
        approved: false,
        input: { authorization: '[REDACTED]' },
      });
      expect(report.modelUsage[0]).toMatchObject({
        inputTokens: 13,
        outputTokens: 7,
        cacheReadInputTokens: 3,
        cacheCreationInputTokens: 2,
        costStatus: 'known',
        costUsd: 0,
      });
      expect(report.counts).toEqual(receipt.counts);
      for (const key of ['calls', 'approvals', 'events', 'modelUsage'])
        expect(report.counts[key]).toBe(report[key].length);
      expect(receipt.bytes).toBe(bytes.length);
      expect(receipt.sha256).toBe(createHash('sha256').update(bytes).digest('hex'));
      expect(bytes.toString()).not.toMatch(
        /private-fixture-value|never-export-this|private-call-token|foreign-model/,
      );
      expect(bytes.toString()).toContain('café 🎮');
      expect(bytes.toString()).toContain('[REDACTED]');
      expect(
        path.relative(
          path.join(project.path, '.gamecrafter', 'cache', 'audit-exports'),
          receipt.path,
        ),
      ).not.toMatch(/^\.\./);
      await expect(client.call('audit/export', { projectId: uuidv7() })).rejects.toThrow();
      expect(readdirSync(path.dirname(receipt.path))).toEqual([path.basename(receipt.path)]);
      expect(
        projectDb
          .prepare("SELECT COUNT(*) AS count FROM tool_calls WHERE tool_id = 'fixture/read'")
          .get<{ count: number }>()?.count,
      ).toBe(1201);
      projectDb
        .prepare("UPDATE tool_calls SET input = 'broken-json' WHERE call_id = ?")
        .run(approvalCall);
      await expect(client.call('audit/export', { projectId: project.projectId })).rejects.toThrow();
      expect(readdirSync(path.dirname(receipt.path))).toEqual([path.basename(receipt.path)]);
      expect(readFileSync(receipt.path)).toEqual(bytes);
      projectDb
        .prepare('UPDATE tool_calls SET input = ? WHERE call_id = ?')
        .run(JSON.stringify({ token: 'private-call-token' }), approvalCall);
      const exportDirectory = path.dirname(receipt.path);
      const outside = path.join(directory, 'outside');
      mkdirSync(outside);
      renameSync(exportDirectory, `${exportDirectory}-saved`);
      symlinkSync(outside, exportDirectory, process.platform === 'win32' ? 'junction' : 'dir');
      await expect(client.call('audit/export', { projectId: project.projectId })).rejects.toThrow(
        'escapes',
      );
      expect(readdirSync(outside)).toEqual([]);
    } finally {
      projectDb.close();
      profile.close();
    }
  } finally {
    await client.close();
  }
});
