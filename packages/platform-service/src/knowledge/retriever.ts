import type {
  EmbeddingProfile,
  KnowledgeSearchResult,
  SearchHit,
  SearchRequest,
} from '@gamecrafter/contracts';
import type { KnowledgeStore, KnowledgeSearchFilter, LexicalCandidate } from './knowledge-store';
import type { VectorStore } from './vector-store';

export interface KnowledgeRetrieverOptions {
  store(projectId: string): KnowledgeStore;
  embeddingProfile(projectId: string): EmbeddingProfile | null;
  vectorStore(projectId: string): VectorStore;
  embed(modelId: string, inputs: string[]): Promise<{ vectors: number[][] }>;
  taskContext?(projectId: string, taskId: string): { goal: string; resources: string[] };
}

interface RankedCandidate {
  candidate: LexicalCandidate;
  lexicalRank: number | null;
  semanticRank: number | null;
  score: number;
  recency: number;
}

export class KnowledgeRetriever {
  constructor(private readonly options: KnowledgeRetrieverOptions) {}

  async search(request: SearchRequest): Promise<KnowledgeSearchResult> {
    const task = request.taskId
      ? this.options.taskContext?.(request.projectId, request.taskId)
      : undefined;
    const mode = request.mode ?? 'hybrid';
    const limit = request.limit ?? 10;
    const filter: KnowledgeSearchFilter = {
      ...(request.sources ? { sources: request.sources } : {}),
      ...(request.recordTypes ? { recordTypes: request.recordTypes } : {}),
      ...(request.statuses ? { statuses: request.statuses } : {}),
      includeInactive: request.includeInactive ?? false,
    };
    const store = this.options.store(request.projectId);
    const lexicalCandidates = store.searchLexical(
      request.projectId,
      request.query,
      filter,
      Math.max(limit * 4, limit),
    );
    let lexical = mode === 'semantic' ? [] : lexicalCandidates;
    let degraded: string | null = null;
    const semantic: Array<{ candidate: LexicalCandidate; rank: number }> = [];

    if (mode !== 'lexical') {
      try {
        const profile = this.options.embeddingProfile(request.projectId);
        const vectorStore = this.options.vectorStore(request.projectId);
        if (!profile) {
          degraded = 'Embedding profile missing; lexical results only.';
        } else if (vectorStore.kind === 'none') {
          degraded = 'Vector store disabled; lexical results only.';
        } else {
          const health = await vectorStore.health(profile);
          if (!health.reachable) {
            degraded = health.error ?? 'Vector store unreachable; lexical results only.';
          } else {
            const embedding = await this.options.embed(profile.modelId, [request.query]);
            const queryVector = embedding.vectors[0];
            if (!queryVector || queryVector.length !== profile.dimensions) {
              degraded =
                'Embedding dimensions do not match the active profile; lexical results only.';
            } else {
              const hits = await vectorStore.search(
                profile,
                queryVector,
                filter,
                Math.max(limit * 4, limit),
              );
              const chunkIds = hits.flatMap((hit) =>
                typeof hit.payload.chunkId === 'string' ? [hit.payload.chunkId] : [],
              );
              const candidates = store.chunkCandidatesByIds(request.projectId, chunkIds, filter);
              const byId = new Map(
                candidates.map((candidate) => [candidate.chunk.chunkId, candidate]),
              );
              const vectorMappings = new Map(
                store
                  .vectorMappings(request.projectId, profile.version)
                  .map((mapping) => [mapping.chunkId, mapping.pointId]),
              );
              const seen = new Set<string>();
              for (const hit of hits) {
                const chunkId = typeof hit.payload.chunkId === 'string' ? hit.payload.chunkId : '';
                const candidate = byId.get(chunkId);
                if (!candidate || vectorMappings.get(chunkId) !== hit.id || seen.has(chunkId))
                  continue;
                seen.add(chunkId);
                semantic.push({ candidate, rank: semantic.length + 1 });
              }
            }
          }
        }
      } catch (error) {
        degraded = `${error instanceof Error ? error.message : String(error)}; lexical results only.`;
      }
    }

    if (mode === 'semantic' && degraded) lexical = lexicalCandidates;
    const ranked = this.combine(lexical, semantic, request.query, store, mode);
    if (task) {
      const terms = [...new Set(task.goal.toLocaleLowerCase().match(/[\p{L}\p{N}_-]{3,}/gu) ?? [])];
      for (const entry of ranked) {
        const text =
          `${entry.candidate.recordTitle ?? ''} ${entry.candidate.chunk.text}`.toLocaleLowerCase();
        const overlap = terms.filter((term) => text.includes(term)).length;
        entry.score *= 1 + (terms.length ? (0.3 * overlap) / terms.length : 0);
        const chunk = entry.candidate.chunk;
        if (
          task.resources.includes(`file:${chunk.path}`) ||
          (chunk.recordId && task.resources.includes(`canon:${chunk.recordId}`))
        )
          entry.score *= 2;
      }
      ranked.sort(
        (left, right) =>
          right.score - left.score ||
          right.recency - left.recency ||
          left.candidate.chunk.path.localeCompare(right.candidate.chunk.path) ||
          left.candidate.chunk.startLine - right.candidate.chunk.startLine,
      );
    }
    let remainingTokens = request.maxTokens ?? Infinity;
    const hits: SearchHit[] = ranked
      .filter(({ candidate }) => {
        const cost =
          Math.max(candidate.chunk.tokensEstimate, Math.ceil(candidate.chunk.text.length / 4), 1) +
          Math.ceil((candidate.chunk.path.length + candidate.chunk.revision.length) / 4) +
          16;
        if (cost > remainingTokens) return false;
        remainingTokens -= cost;
        return true;
      })
      .slice(0, limit)
      .map(({ candidate, lexicalRank, semanticRank, score }) => {
        const chunk = candidate.chunk;
        const recordId = chunk.recordId;
        const suffix = recordId ? ` [${recordId}]` : '';
        return {
          chunkId: chunk.chunkId,
          score,
          lexicalRank,
          semanticRank,
          path: chunk.path,
          revision: chunk.revision,
          recordId,
          recordTitle: candidate.recordTitle,
          recordStatus: candidate.recordStatus,
          source: chunk.source,
          quote: {
            text: chunk.text,
            startLine: chunk.startLine,
            endLine: chunk.endLine,
          },
          citation: `${chunk.path}@${chunk.revision}#L${chunk.startLine}-L${chunk.endLine}${suffix}`,
        };
      });
    return { hits, mode, degraded };
  }

  private combine(
    lexical: LexicalCandidate[],
    semantic: Array<{ candidate: LexicalCandidate; rank: number }>,
    query: string,
    store: KnowledgeStore,
    mode: SearchRequest['mode'],
  ): RankedCandidate[] {
    const candidates = new Map<string, RankedCandidate>();
    lexical.forEach((candidate, index) => {
      const rank = index + 1;
      candidates.set(candidate.chunk.chunkId, {
        candidate,
        lexicalRank: rank,
        semanticRank: null,
        score: reciprocalRank(rank),
        recency: recency(store, candidate),
      });
    });
    if (mode !== 'lexical') {
      for (const result of semantic) {
        const id = result.candidate.chunk.chunkId;
        const existing = candidates.get(id) ?? {
          candidate: result.candidate,
          lexicalRank: null,
          semanticRank: null,
          score: 0,
          recency: recency(store, result.candidate),
        };
        existing.semanticRank = result.rank;
        existing.score += reciprocalRank(result.rank);
        candidates.set(id, existing);
      }
    }
    const normalizedQuery = query.trim().toLocaleLowerCase();
    for (const ranked of candidates.values()) {
      const status = ranked.candidate.recordStatus;
      if (status === 'accepted') ranked.score *= 1.25;
      if (status === 'deprecated' || status === 'retconned') ranked.score *= 0.5;
      if (
        normalizedQuery &&
        ranked.candidate.chunk.text.toLocaleLowerCase().includes(normalizedQuery)
      ) {
        ranked.score *= 1.2;
      }
    }
    return [...candidates.values()].sort(
      (left, right) =>
        right.score - left.score ||
        right.recency - left.recency ||
        left.candidate.chunk.path.localeCompare(right.candidate.chunk.path) ||
        left.candidate.chunk.startLine - right.candidate.chunk.startLine,
    );
  }
}

function reciprocalRank(rank: number): number {
  return 1 / (60 + rank);
}

function recency(store: KnowledgeStore, candidate: LexicalCandidate): number {
  const state = store.indexState(candidate.chunk.path);
  return !state || Array.isArray(state) ? 0 : Date.parse(state.indexedAt) || 0;
}
