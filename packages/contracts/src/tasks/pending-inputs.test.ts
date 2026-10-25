import { expect, it } from 'vitest';
import { compile } from '../validation';
import { RpcMethods } from '../rpc/protocol';
import { uuidv7 } from '../ids';
import { PendingInputsSchema } from './pending-inputs';

it('validates service-owned pending questions, context and unavailable Projects without accepting mutations', () => {
  const id = uuidv7();
  const taskId = uuidv7();
  const snapshot = {
    schemaVersion: 1,
    inputs: [
      {
        kind: 'question',
        projectId: id,
        projectName: 'Fixture',
        taskId,
        taskTitle: 'Scene',
        rootTaskId: taskId,
        rootTaskTitle: 'Scene',
        question: {
          questionId: uuidv7(),
          taskId,
          prompt: 'Choose',
          options: ['', 'Paint'],
          askedAt: '2026-10-24T00:00:00Z',
          answer: null,
          answeredAt: null,
        },
      },
    ],
    unavailableProjects: [{ projectId: uuidv7(), name: 'Disconnected Project' }],
  };
  const validator = compile(PendingInputsSchema);
  expect(validator.check(snapshot)).toBe(true);
  expect(
    validator.check({ ...snapshot, inputs: [{ ...snapshot.inputs[0], kind: 'approve-all' }] }),
  ).toBe(false);
  expect(compile(RpcMethods['broker/pendingInputs'].params).check({})).toBe(true);
  expect(compile(RpcMethods['broker/pendingInputs'].params).check({ approve: true })).toBe(false);
});
