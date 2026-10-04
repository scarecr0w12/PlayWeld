# Built-in and external vector storage

**Last researched:** 2026-10-04

## Purpose

Support the user-confirmed choice of LanceDB, local Qdrant, remote Qdrant,
and additional local/remote storage in [the architecture](../TECHNICAL_ARCHITECTURE.md#storage-backup-and-recovery).
This note separates documented capabilities from this repository's runtime evidence.

## Qdrant Server

- Rust vector server exposing REST/gRPC; collections contain vectors and payload metadata. [Repository](https://github.com/qdrant/qdrant)
- Qdrant 1.19.1 was released September 4, 2026. [Release](https://github.com/qdrant/qdrant/releases/tag/v1.19.1)
- That release supplies Windows x64 and Linux x64 native executables. Docker is not required to use these binaries. [Release assets](https://api.github.com/repos/qdrant/qdrant/releases/tags/v1.19.1)
- The Windows ZIP is 29,671,153 bytes; this is archive size, not runtime memory or installed size. [Release assets](https://api.github.com/repos/qdrant/qdrant/releases/tags/v1.19.1)
- The Windows archive digest is `9b6f69bd85f6abed4bc13f943099f55c6ffd55f5dd90388635320d8fbb569eb0`. [Release assets](https://api.github.com/repos/qdrant/qdrant/releases/tags/v1.19.1)
- The Linux GNU archive digest is `eef986e769d4d3e806dd2d546e1b4ecdd416211e54d34b4ed764fac7c58e1085`. [Release assets](https://api.github.com/repos/qdrant/qdrant/releases/tags/v1.19.1)
- Service host, HTTP port, API key, CORS, gRPC, cluster settings, data paths, and telemetry are configurable. [Pinned configuration](https://github.com/qdrant/qdrant/blob/v1.19.1/config/config.yaml)
- Defaults include an all-interface service bind, gRPC, CORS, and telemetry; a desktop-managed instance must override them deliberately. [Pinned configuration](https://github.com/qdrant/qdrant/blob/v1.19.1/config/config.yaml)
- Configuration files and environment variables can override embedded defaults; environment variables have highest priority. [Configuration guide](https://qdrant.tech/documentation/guides/configuration/)
- License is Apache-2.0; redistribution requires the applicable license and attribution notices. [Pinned license](https://github.com/qdrant/qdrant/blob/v1.19.1/LICENSE)

## LanceDB OSS

- Embedded Rust storage with JavaScript/TypeScript, Python, and Rust interfaces. Local use connects to a filesystem directory without a database server. [Quickstart](https://docs.lancedb.com/quickstart)
- Official Node SDK ships platform-specific native libraries for Windows, Linux, and macOS. Individual release architecture coverage must be checked rather than assuming all documented targets ship in every release. [SDK README](https://github.com/lancedb/lancedb/blob/main/nodejs/README.md)
- `mergeInsert` provides key-based upsert; ordinary writes do not enforce key uniqueness. [Updating data](https://docs.lancedb.com/tables/update)
- Deletion excludes rows from retrieval but is soft deletion; compaction/cleanup must be managed for embedded OSS use. [Updating data](https://docs.lancedb.com/tables/update)
- Vector search supports cosine, L2 and dot metrics, with exact scans and approximate indexes. [Vector indexes](https://docs.lancedb.com/indexing/vector-index)
- OSS index maintenance is application-managed; new rows may use an unindexed fallback until indexes are refreshed. [Vector indexes](https://docs.lancedb.com/indexing/vector-index)
- License is Apache-2.0. [License](https://github.com/lancedb/lancedb/blob/main/LICENSE)
- Repository selection is pinned Node SDK 0.29.0 with Arrow 18.1.0. The newer 0.39.0 package adds optional Transformers/ONNX/image-processing dependencies unrelated to the existing embedding pipeline. Package metadata was inspected with `npm view`; this is a dependency-footprint choice, not a claim that newer LanceDB is unusable. [0.29.0 metadata](https://registry.npmjs.org/@lancedb/lancedb/0.29.0), [0.39.0 metadata](https://registry.npmjs.org/@lancedb/lancedb/0.39.0)

## SQLite alternatives

- `sqlite-vec` is a C SQLite extension with no external dependencies and support for multiple vector formats. [Repository](https://github.com/asg017/sqlite-vec)
- Its Node documentation supports `node:sqlite` with explicit trusted extension loading. [Node guide](https://alexgarcia.xyz/sqlite-vec/js.html)
- It remains pre-v1 and warns of breaking changes. [Repository](https://github.com/asg017/sqlite-vec)
- Documented vector operations include KNN virtual tables and manual distance scans. [KNN documentation](https://alexgarcia.xyz/sqlite-vec/features/knn.html)
- PlayWeld's initial SQLite adapter is **not sqlite-vec**: it stores versioned vectors in a dedicated SQLite database and performs exact cosine scans in TypeScript using the existing database seam. No ANN claim is made. [Implementation](../../packages/platform-service/src/knowledge/sqlite-vector-store.ts)

## Qdrant Edge

- A genuinely embedded engine exists as Qdrant Edge, distinct from Qdrant Server and Python client local mode. [Edge documentation](https://qdrant.tech/documentation/edge/)
- Current documentation marks it beta and documents Rust and Python interfaces. No first-party Node interface was verified in this pass. [Edge documentation](https://qdrant.tech/documentation/edge/)
- Edge is therefore not selected for this TypeScript integration; maintaining a binding or another runtime would introduce a separate delivery boundary. [Edge documentation](https://qdrant.tech/documentation/edge/)

## Recommended approach and caveats

- Keep backend selection separate from deployment ownership.
- Embedded stores require no server endpoint; managed Qdrant requires supervision.
- Existing local and remote Qdrant use the same data adapter, not separate APIs.
- Preserve lexical-only settings and existing external Qdrant configurations.
- Apply consent and TLS checks to explicit remote mode.
- Legacy external mode retains the prior transport policy for compatibility.
- Store credentials outside Projects and pass only their encrypted references in settings.
- Enforce Project identity before writes and in filtered queries.
- Translate neutral filters inside each adapter; reject unsupported fields.
- Keep embedding generation in the existing provider/model system.
- Rebuild when backend destination or embedding profile changes.
- Retain old destinations rather than silently deleting data during a switch.
- Treat indexes as derived; copying active database files is not a consistent snapshot.
- Validate installed native dependencies separately from development tests.
- Benchmark representative data before choosing ANN thresholds or performance budgets.
- Trusted service registration is not isolated marketplace-plugin support.

## Sources

- https://github.com/qdrant/qdrant
- https://github.com/qdrant/qdrant/releases/tag/v1.19.1
- https://api.github.com/repos/qdrant/qdrant/releases/tags/v1.19.1
- https://github.com/qdrant/qdrant/blob/v1.19.1/config/config.yaml
- https://qdrant.tech/documentation/guides/configuration/
- https://github.com/qdrant/qdrant/blob/v1.19.1/LICENSE
- https://docs.lancedb.com/quickstart
- https://github.com/lancedb/lancedb/blob/main/nodejs/README.md
- https://docs.lancedb.com/tables/update
- https://docs.lancedb.com/indexing/vector-index
- https://github.com/lancedb/lancedb/blob/main/LICENSE
- https://registry.npmjs.org/@lancedb/lancedb/0.29.0
- https://registry.npmjs.org/@lancedb/lancedb/0.39.0
- https://github.com/asg017/sqlite-vec
- https://alexgarcia.xyz/sqlite-vec/js.html
- https://alexgarcia.xyz/sqlite-vec/features/knn.html
- https://qdrant.tech/documentation/edge/
