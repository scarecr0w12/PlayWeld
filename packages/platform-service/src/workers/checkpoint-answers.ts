/** Answer cursor survives agent compaction and skips already-consumed answers. */
export function checkpointAnswerOffset(value: unknown): number {
  if (!value || typeof value !== 'object') return 0;
  const checkpoint = value as {
    evidence?: Array<{ kind?: string; ref?: string }>;
    transcript?: Array<{ role?: string; name?: string; toolCallId?: string }>;
  };
  const durable = checkpoint.evidence?.filter((entry) => entry.kind === 'user-answer') ?? [];
  if (durable.length) return new Set(durable.map((entry) => entry.ref)).size;
  return new Set(
    (checkpoint.transcript ?? [])
      .filter((message) => message.role === 'tool' && message.name === 'tasks/ask_user')
      .map((message) => message.toolCallId),
  ).size;
}
