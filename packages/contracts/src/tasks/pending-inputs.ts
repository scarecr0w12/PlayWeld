import { Type, type Static } from '@sinclair/typebox';
import { ApprovalRequestSchema } from '../tools/schema';
import { TaskQuestionSchema } from './schema';

const context = {
  projectId: Type.String({ format: 'uuid' }),
  projectName: Type.String(),
  taskId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
  taskTitle: Type.Union([Type.String(), Type.Null()]),
  rootTaskId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
  rootTaskTitle: Type.Union([Type.String(), Type.Null()]),
};
export const PendingInputSchema = Type.Union([
  Type.Object(
    { ...context, kind: Type.Literal('approval'), approval: ApprovalRequestSchema },
    { additionalProperties: false },
  ),
  Type.Object(
    { ...context, kind: Type.Literal('question'), question: TaskQuestionSchema },
    { additionalProperties: false },
  ),
]);
export type PendingInput = Static<typeof PendingInputSchema>;
export const PendingInputsSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    inputs: Type.Array(PendingInputSchema),
    unavailableProjects: Type.Array(
      Type.Object(
        { projectId: Type.String({ format: 'uuid' }), name: Type.String() },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);
export type PendingInputs = Static<typeof PendingInputsSchema>;
