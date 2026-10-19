exports.coordinator = async (context) => {
  const before = await context.refreshTools();
  const result = await context.tool('tasks/await', {
    taskIds: context.input.childIds,
    timeoutMs: context.input.timeoutMs ?? 2000,
  });
  const after = await context.refreshTools();
  if (result.timedOut && !context.input.expectTimeout) throw new Error('Child starved');
  await context.reportUsage({ costUsd: 7, tokens: 99, accountedByService: true });
  return {
    summary: JSON.stringify({
      before: before.map((t) => t.toolId),
      after: after.map((t) => t.toolId),
      timedOut: result.timedOut ?? false,
    }),
    artifacts: [],
    evidence: [],
  };
};
exports.child = async (context) => {
  await new Promise((resolve) => setTimeout(resolve, context.input?.delayMs ?? 50));
  return { summary: 'Child completed', artifacts: [], evidence: [] };
};
