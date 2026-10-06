import { UpdateStateSchema, type UpdateState } from '@gamecrafter/contracts';
import { compile } from '@gamecrafter/contracts';
import type { Database } from '../db/database';

const updateStateValidator = compile<UpdateState>(UpdateStateSchema);

export class UpdateStore {
  constructor(
    private readonly database: Database,
    private readonly currentVersion: string,
  ) {}

  get(): UpdateState {
    const row = this.database
      .prepare('SELECT state_json AS stateJson FROM update_states WHERE channel = ?')
      .get<{ stateJson: string }>('stable');
    if (row)
      return {
        ...updateStateValidator.assert(JSON.parse(row.stateJson)),
        currentVersion: this.currentVersion,
      };
    return {
      schemaVersion: 1,
      currentVersion: this.currentVersion,
      channel: 'stable',
      lastCheckedAt: null,
      available: null,
      downloaded: null,
      compatibility: { ok: true, reasons: [] },
      previous: null,
      error: null,
    };
  }

  save(state: UpdateState): UpdateState {
    const validated = updateStateValidator.assert(state);
    this.database
      .prepare(
        `INSERT INTO update_states (channel, state_json, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(channel) DO UPDATE SET
          state_json = excluded.state_json,
          updated_at = excluded.updated_at`,
      )
      .run('stable', JSON.stringify(validated), new Date().toISOString());
    return validated;
  }
}
