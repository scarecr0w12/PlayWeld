import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { connect } from '@gamecrafter/service-client';
import { PlatformService } from '../service';
import { resolvePaths } from '../paths';
import { uuidv7 } from '@gamecrafter/contracts';
import { Database } from '../db/database';
import { ToolStore } from '../tools/tool-store';

let service: PlatformService | undefined;
let directory: string | undefined;
afterEach(async () => {
  await service?.stop();
  service = undefined;
  if (directory) rmSync(directory, { recursive: true, force: true });
});
it('requires a reviewed cleanup plan before deleting audit history', async () => {
  directory = mkdtempSync(path.join(tmpdir(), 'gc-retention-'));
  const paths = resolvePaths({ GAMECRAFTER_PROFILE_DIR: path.join(directory, 'profile') });
  service = await PlatformService.start({ paths, platformVersion: '0.22.0' });
  const client = await connect({
    socketPath: service.socketPath,
    token: readFileSync(paths.tokenPath, 'utf8').trim(),
    clientName: 'retention-test',
    clientVersion: '0.22.0',
  });
  try {
    await client.call('settings/set', {
      key: 'board.maintenanceEnabled',
      scope: 'platform',
      value: false,
    });
    const project = await client.call('project/create', {
      name: 'Retention fixture',
      parentDirectory: directory,
      engine: { family: 'godot' },
    });
    expect(await client.call('audit/retention', { projectId: project.projectId })).toMatchObject({
      policy: { retentionDays: 0, deletionEnabled: false, autoPrune: false },
      receipts: [],
    });
    const db = Database.open(path.join(project.path, '.gamecrafter', 'project.sqlite'));
    const profile = Database.open(paths.profileDbPath);
    try {
      const tools = new ToolStore(db),
        old = '2020-01-01T00:00:00.000Z';
      const seed = () =>
        tools.finalizeCall({
          callId: uuidv7(),
          projectId: project.projectId,
          taskId: null,
          agentId: null,
          toolId: 'fs/write-file',
          input: { path: 'game/fixture.txt' },
          accessMode: 'full',
          decision: 'allowed',
          decisionReason: 'fixture',
          status: 'completed',
          output: { bytes: 1 },
          error: null,
          evidence: [],
          costUsd: 0,
          costStatus: 'known',
          startedAt: old,
          finishedAt: old,
        });
      const eligible = seed(),
        blocked = seed();
      const approval = (callId: string, resolvedAt: string | null) =>
        tools.insertApproval({
          approvalId: uuidv7(),
          projectId: project.projectId,
          callId,
          toolId: 'fs/write-file',
          sideEffects: 'workspace-write',
          summary: 'Fixture',
          input: {},
          requestedAt: old,
          resolvedAt,
          approved: resolvedAt ? true : null,
          reason: null,
        });
      approval(eligible.callId, old);
      approval(blocked.callId, null);
      const previewArgs = {
        projectId: project.projectId,
        store: 'project' as const,
        before: '2025-01-01T00:00:00.000Z',
      };
      const disabled = await client.call('audit/previewCleanup', previewArgs);
      expect(disabled.counts).toMatchObject({ calls: 1, approvals: 1, events: 1 });
      await expect(
        client.call('audit/applyCleanup', {
          projectId: project.projectId,
          store: 'project',
          previewId: disabled.previewId,
          confirm: true,
        }),
      ).rejects.toThrow('disabled');
      expect(tools.getCall(eligible.callId)).toBeDefined();
      await client.call('audit/setRetention', {
        projectId: project.projectId,
        policy: { retentionDays: 365, deletionEnabled: true, autoPrune: false },
      });
      const stale = await client.call('audit/previewCleanup', previewArgs);
      db.prepare('UPDATE tool_calls SET output=? WHERE call_id=?').run(
        '{"changed":true}',
        eligible.callId,
      );
      await expect(
        client.call('audit/applyCleanup', {
          projectId: project.projectId,
          store: 'project',
          previewId: stale.previewId,
          confirm: true,
        }),
      ).rejects.toThrow('changed');
      expect(tools.getCall(eligible.callId)).toBeDefined();
      const preview = await client.call('audit/previewCleanup', previewArgs);
      const other = await connect({
        socketPath: service.socketPath,
        token: readFileSync(paths.tokenPath, 'utf8').trim(),
        clientName: 'other-retention-client',
        clientVersion: '0.22.0',
      });
      try {
        await expect(
          other.call('audit/applyCleanup', {
            projectId: project.projectId,
            store: 'project',
            previewId: preview.previewId,
            confirm: true,
          }),
        ).rejects.toThrow('session');
      } finally {
        await other.close();
      }
      const previousSeq = db.prepare('SELECT MAX(seq) AS seq FROM events').get<{ seq: number }>()!
        .seq;
      const receipt = await client.call('audit/applyCleanup', {
        projectId: project.projectId,
        store: 'project',
        previewId: preview.previewId,
        confirm: true,
      });
      expect(receipt.counts).toEqual(preview.counts);
      expect(tools.getCall(eligible.callId)).toBeUndefined();
      expect(tools.getCall(blocked.callId)).toBeDefined();
      expect(
        db.prepare('SELECT MAX(seq) AS seq FROM events').get<{ seq: number }>()!.seq,
      ).toBeGreaterThan(previousSeq);
      await expect(
        client.call('audit/applyCleanup', {
          projectId: project.projectId,
          store: 'project',
          previewId: preview.previewId,
          confirm: true,
        }),
      ).rejects.toThrow();
      const retainedIds: string[] = [];
      for (const linked of [true, false]) {
        const id = uuidv7();
        retainedIds.push(id);
        profile
          .prepare(
            "INSERT INTO route_decisions (decision_id,decision,project_id,task_type,model_id,explored,decided_at) VALUES (?,'{}',?,'fixture','fixture-model',0,?)",
          )
          .run(id, project.projectId, old);
        profile
          .prepare(
            "INSERT INTO route_outcomes (decision_id,success,quality_score,source,cost_usd,latency_ms,input_tokens,output_tokens,recorded_at) VALUES (?,1,0.8,'self',1,5,13,7,?)",
          )
          .run(id, old);
        if (linked)
          profile
            .prepare(
              "INSERT INTO model_usage (usage_id,project_id,decision_id,model_id,occurred_at,input_tokens,output_tokens,cache_read_input_tokens,cache_creation_input_tokens,cost_usd,cost_status) VALUES (?,?,?,'fixture-model',?,13,7,0,0,1,'known')",
            )
            .run(uuidv7(), project.projectId, id, old);
      }
      // A different Project's ledger is never a candidate.
      profile
        .prepare(
          "INSERT INTO model_usage (usage_id,project_id,model_id,occurred_at,input_tokens,output_tokens,cache_read_input_tokens,cache_creation_input_tokens,cost_usd,cost_status) VALUES (?,?,'foreign-model',?,13,7,0,0,0,'known')",
        )
        .run(uuidv7(), uuidv7(), old);
      const modelPreview = await client.call('audit/previewCleanup', {
        ...previewArgs,
        store: 'model-usage',
      });
      expect(modelPreview.counts).toMatchObject({ modelUsage: 1, legacyUsage: 0 });
      await client.call('audit/applyCleanup', {
        projectId: project.projectId,
        store: 'model-usage',
        previewId: modelPreview.previewId,
        confirm: true,
      });
      expect(
        (await client.call('audit/read', { projectId: project.projectId })).modelUsage.map(
          (row) => row.decisionId,
        ),
      ).toEqual([retainedIds[1]]);
      expect(
        profile
          .prepare('SELECT quality_score,audit_retained FROM route_outcomes WHERE decision_id=?')
          .get(retainedIds[0]!),
      ).toEqual({ quality_score: 0.8, audit_retained: 0 });
      expect(
        profile
          .prepare("SELECT COUNT(*) AS count FROM model_usage WHERE model_id='foreign-model'")
          .get(),
      ).toEqual({ count: 1 });
      expect(
        (await client.call('audit/retention', { projectId: project.projectId })).receipts,
      ).toHaveLength(2);
    } finally {
      db.close();
      profile.close();
    }
  } finally {
    await client.close();
  }
});
