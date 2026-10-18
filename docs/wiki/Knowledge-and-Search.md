# Knowledge and search

Open **PlayWeld > Plan & Collaborate > Knowledge & Canon**; its tab is **Knowledge**. Retrieve Project material with citations, then inspect original files before making a decision.

## Start lexically

1. Select the Project and **Index status**.
2. After saved edits, choose **Reconcile**. Wait for pending work/timestamps to settle.
3. Open **Search > Search mode and filters**, choose **Lexical** and source such as **docs**.
4. Search a distinctive phrase and inspect citation, path, excerpt and revision.

Lexical search requires no embeddings. Chunks can exist while canon count is zero: ordinary documents are not automatically canon records.

## Add semantic retrieval

Semantic search needs an embedding profile/model and vector storage. Hybrid combines retrieval and can report degraded behavior. **Test vector store** checks storage, not the embedding provider or retrieval quality.

Choices include lexical-only, embedded LanceDB, SQLite exact-vector search and managed/local/remote Qdrant. SQLite exact search is not ANN. Lexical-only is the default; selecting storage does not install model weights.

Remote storage needs its explicit configuration/permission, HTTPS in remote mode and credential references. Embeddings/index metadata can leave the machine. Backend switching schedules reconciliation but retains old backend data; deletion there is separate.

## Diagnose stale results

Save the source, inspect errors/pending work, reconcile, then query an exact new phrase lexically. **Rebuild** queues a full rebuild for a diagnosed issue. Do not delete canon to repair derived data.

See [Knowledge configuration](https://github.com/scarecr0w12/PlayWeld/blob/main/docs/USER_GUIDE.md#knowledge-and-search) and [recovery](https://github.com/scarecr0w12/PlayWeld/blob/main/docs/OPERATIONS_GUIDE.md#recovery-procedures-by-state-owner).
