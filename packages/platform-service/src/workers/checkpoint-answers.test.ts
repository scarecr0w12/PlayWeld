import { expect, it } from 'vitest';
import { checkpointAnswerOffset } from './checkpoint-answers';

it('retains consumed answer position after compaction without counting an unanswered call', () => {
  expect(checkpointAnswerOffset(null)).toBe(0);
  expect(
    checkpointAnswerOffset({
      transcript: [
        { role: 'assistant', toolCalls: [{ name: 'tasks/ask_user' }] },
        { role: 'tool', name: 'tasks/ask_user', toolCallId: 'answered' },
        { role: 'assistant', toolCalls: [{ name: 'tasks/ask_user' }] },
      ],
    }),
  ).toBe(1);
  expect(
    checkpointAnswerOffset({
      transcript: [],
      evidence: [
        { kind: 'user-answer', ref: 'first' },
        { kind: 'user-answer', ref: 'first' },
        { kind: 'user-answer', ref: 'second' },
      ],
    }),
  ).toBe(2);
});
