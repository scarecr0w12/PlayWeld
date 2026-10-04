# Decision Models for Routing and Task Policy

**Last researched:** 2026-10-04

## Purpose

Investigate Jev and local decision engines for PlayWeld's [agent, model, and access design](../TECHNICAL_ARCHITECTURE.md#agent-model-and-access-design), especially M05/M06 in the [decision register](../OPEN_DECISIONS.md#5-providers-adaptive-routing-and-budgets). This is research, not a selected backend, implementation specification, authorization change, or commitment to train model weights. The companion [routing-systems survey](local-model-routing-systems.md) covers LLMRouter, RouteLLM, semantic routing, and routing/cascade papers.

## Distinguish the jobs

- **Research distinction:** a task classifier identifies work; a quality predictor estimates candidate performance; a routing policy chooses under constraints; a verifier evaluates supplied evidence; a coordinator owns dependencies and execution. One label-producing model should not be assumed to solve all five jobs. TypeSafe explicitly recommends narrow judgments composed by code. [TypeSafe workflow design](https://docs.typesafe.ai/concepts/how-to-build-with-system-one)
- A typed decision model evaluates supplied state and runtime-defined questions. Jev exposes Choice (category distribution), Noul (probability of yes), and Score (distribution over ordered levels and their expected position), not generated prose or a reasoning trace. [System One](https://docs.typesafe.ai/concepts/system-one)
- A label distribution is not automatically a candidate's expected execution quality: confidence that a task is "coding" does not measure whether a particular coding model will pass its tests. This is an application-level inference from the different prediction targets, not a measured result. [System One](https://docs.typesafe.ai/concepts/system-one)

## Jev: hosted reference, not verified local weights

- TypeSafe documents a hosted HTTP `POST /v1/systemone` service with SDKs. No official downloadable weights or self-hosted Jev runtime were found in the reviewed official pages; offline Jev availability remains unverified. [Models](https://docs.typesafe.ai/models), [System One](https://docs.typesafe.ai/concepts/system-one)
- The direct-service documentation lists `jev-1.13.0`, text/JSON state, a 64k total request budget, and 32k for state plus the longest question. Its stated input price is $0.042/Mtok with free output; listed rate limits are explicitly dynamic. These are vendor metadata as retrieved, not measured latency or a pricing guarantee. [Models](https://docs.typesafe.ai/models)
- OpenRouter exposes `typesafe/jev-1.13` through `POST /api/alpha/decisions` and the TypeSafe-compatible `/api/v1/systemone` surface using an OpenRouter API key. This is a separate decision API, not ordinary Chat Completions. [OpenRouter Jev hub](https://openrouter.ai/docs/guides/community/jev)
- Direct TypeSafe access uses bearer credentials; its docs say customer data does not fine-tune account-specific Jev weights. SDK license, service legal terms, retention, and OpenRouter/upstream routing policy must be checked separately before deployment; a local client is not local inference. [Models](https://docs.typesafe.ai/models), [API](https://docs.typesafe.ai/api)
- Questions are documented as independent and parallel. Dependent questions still require application composition or another stage; asking several questions does not remove their logical dependencies. Claims such as roughly 100 ms are vendor descriptions, not local hardware acceptance evidence. [Workflow design](https://docs.typesafe.ai/concepts/how-to-build-with-system-one)
- **Confidence caveat:** Choice `confidence = (p_max - 1/n) / (1 - 1/n)` measures concentration above a uniform distribution. It is not another learned probability of correctness. Noul has no separate confidence; Score uses an ordered-distance formula. Thresholds cannot be copied across these primitives or option counts without validation. [Confidence](https://docs.typesafe.ai/confidence)
- TypeSafe describes RLCD as training for calibrated probabilities, but calibration is a population property, not a guarantee on one decision or an unseen game-development workload. Record the actual returned model version and pin versions when thresholds depend on them. [AI primer](https://docs.typesafe.ai/introduction/machine-learning-primer), [Models](https://docs.typesafe.ai/models)

## Local decision engines

These are separate projects, not verified reproductions of TypeSafe's proprietary weights. Connection and capability descriptions below are source-reviewed only. Repository activity was not independently checked through commit history in this pass.

### Kev

- Python decision-model family with published Qwen-based weights, typed Choice/Noul/Score, and a local HTTP `/v1/systemone` server. The README documents CUDA/ROCm and Apple Silicon MLX; native Windows runtime acceptance was not performed here. [Repository and serving example](https://github.com/jaredpalmer/kev)
- Current documented sizes are 0.8B, 4B, 9B, and 27B. The smaller models use trained adapters plus a pointer head; 27B uses full-weight fine-tuning. Questions are isolated and the serving path reuses state computation rather than generating an answer sentence. [Architecture and training](https://github.com/jaredpalmer/kev#how-it-works)
- The code/base licenses are described as Apache-2.0; datasets retain their own licenses. Each released checkpoint has a fitted temperature, but a single temperature cannot repair ranking errors or establish calibration on PlayWeld. [License and limitations](https://github.com/jaredpalmer/kev)
- The repository distinguishes development/test sets, new/trained sources, fp32 evaluation/bf16 serving, accepted context/quality-validated context, and measured/expected hardware support. Its accuracy and speed tables are author-reported evidence, not our measurements or proof of best routing quality. [Benchmarks and model cards](https://github.com/jaredpalmer/kev#benchmarks)
- **Candidate fit:** strongest research candidate here for general typed task triage and escalation over a variable option set, subject to local hardware, context, calibration, and licensing checks. Local 0.8B/4B tradeoffs deserve measurement rather than assuming the smallest model is sufficient. [Models and limitations](https://github.com/jaredpalmer/kev)

### Laya

- Python encoder-based, non-autoregressive decision engine with Choice/Noul/Score; documented checkpoints use ModernBERT-large or mmBERT-base, around 421M/322M parameters. Its internal Router chooses its own English/multilingual checkpoint, not the best task-execution model in our registry. [Repository](https://github.com/NandhaKishorM/laya)
- Exposes local `/v1/systemone` HTTP, optional MCP, a TypeScript HTTP client, and a separate ESM-only `laya-ts` ONNX inference path. The README documents Windows/Linux/macOS setup; code and all three inspected checkpoint cards identify Apache-2.0, but exported artifacts still need release-specific review. ONNX conversion parity is not task-quality validation or a complete port of Python behavior. [Repository](https://github.com/NandhaKishorM/laya), [TypeScript runtime](https://github.com/NandhaKishorM/laya/blob/main/laya-ts/README.md), [English card](https://huggingface.co/convaiinnovations/laya), [Multilingual card](https://huggingface.co/convaiinnovations/laya-multilingual), [Typed-decisions card](https://huggingface.co/convaiinnovations/laya-typed-decisions)
- Context budgets are a major screening issue: the documented English checkpoint defaults to 512 tokens, typed-decisions to 1,024, and multilingual to 1,024 with an explicit extension to 8,192. Long-document capability must not be inferred from the encoder family's name. [Checkpoint and long-document notes](https://github.com/NandhaKishorM/laya)
- The project publishes domain training, calibration, abstention, and source-split evaluations, but its headline latency and domain gains are author-reported. Its entropy `confidence` differs from selected-answer probability `answer_confidence`; `min_confidence` gates the latter. Head/state budgets compete, and trimmed options can collapse to identical tokens. Inspect usage diagnostics and fit thresholds per workload/option count rather than transfer Jev thresholds. [Honest limits](https://github.com/NandhaKishorM/laya#honest-limits), [TypeScript usage diagnostics](https://github.com/NandhaKishorM/laya/blob/main/laya-ts/README.md)
- **Candidate fit:** interesting compact/local option for bounded task summaries and stable triage questions; potentially better desktop resource fit than a multi-billion-parameter model, but neither quality nor CPU performance on this machine was measured. [Repository](https://github.com/NandhaKishorM/laya)

### SemIf, formerly OpenJev

- Independent MIT-licensed Python research project that reads option logits from frozen open models. Documents Torch/CUDA/MPS, MLX, and CPU/GGUF llama.cpp backends, a CLI/JSONL interface, and browser WebGPU experiments. It explicitly does not reproduce Jev's undisclosed model or training. [Repository](https://github.com/TheoLeeCJ/SemIf)
- Supports runtime option descriptions and direct/serial-prefix/shared-state execution. The documented fast paths have small numerical/argmax differences; backend, weight revision, quantization, prompt hash, and readout method belong in the evaluation artifact. Do not assume a ready-made service API from the CLI examples. [Method and execution evidence](https://github.com/TheoLeeCJ/SemIf)
- Raw option probabilities are conditional on the supplied choices and uncalibrated. Its temperature-scaling writeup uses group-disjoint cross-validation; a temperature changes probabilities, not the winning option. [Calibration methods and caveats](https://github.com/TheoLeeCJ/SemIf/blob/master/docs/CALIBRATION.md)
- **Candidate fit:** useful experimental baseline for asking whether direct readout improves latency/calibration over generated JSON with the same frozen base model. Its committed fixtures and claim boundaries are more informative than an isolated "Jev-like" label. [Repository and reproduction links](https://github.com/TheoLeeCJ/SemIf)

### daseinlabs/open-jev

- MIT-licensed Python Gemma 3 4B option scorer with MLX and documented Torch Windows/Linux CPU/GPU inference; local FastAPI `/score` and `/v1/systemone` endpoints. Gemma weights require their separate license acceptance. [README](https://github.com/daseinlabs/open-jev), [Code license](https://github.com/daseinlabs/open-jev/blob/main/LICENSE)
- Scores option continuations against shared prefix caches with sum/mean/PMI normalization. The README explicitly shows zero-shot overconfidence and disagreement with Jev examples; its learned-head training remains MLX-specific. Easy synthetic results are not evidence for general task policy. [Scoring, comparison, and training](https://github.com/daseinlabs/open-jev)
- Its entropy-based confidence is not TypeSafe's currently documented formula. The README's claim that TypeSafe does not publish that formula is stale relative to the official confidence page; wire compatibility is not confidence equivalence. [open-jev contract](https://github.com/daseinlabs/open-jev#typesafe-system-one-contract), [TypeSafe confidence](https://docs.typesafe.ai/confidence)
- **Candidate fit:** especially useful Windows-oriented local scoring reference and a warning against treating softmaxed next-token likelihood as calibrated semantic judgment. [README](https://github.com/daseinlabs/open-jev)

### Simpler and generative baselines

- SetFit is a Python sentence-transformer plus classification-head framework with few-shot training, suitable for a fixed task taxonomy. It is not a zero-shot arbitrary-question API; code is Apache-2.0, with separate checkpoint licenses. A local service wrapper would be our integration work, not a documented turnkey endpoint. [README](https://github.com/huggingface/setfit), [License](https://github.com/huggingface/setfit/blob/main/LICENSE)
- TypeSafe's own System One Adapter translates typed questions to ordinary LLM APIs, including custom OpenAI-compatible endpoints, with structured-output/JSON validation and retry diagnostics. This supplies a generative comparison path, not a trained decision model or calibration guarantee. [Adapter](https://github.com/typesafe-ai/system-one-adapter-python)
- LocalJev is an MIT-licensed TypeScript/Bun HTTP bridge, documented against an oMLX-backed DiffusionGemma setup. It generates probability values as JSON and normalizes them; its README explicitly distinguishes these self-reports from direct-logit scoring. Bun/oMLX/default model dependencies are not native PlayWeld integrations. [README](https://github.com/githubnext/localjev), [License](https://github.com/githubnext/localjev/blob/main/LICENSE)

## Examples and technical reading

- **Bounded workflow design:** TypeSafe's guide decomposes broad decisions into narrow questions, combines independent signals in code, and routes uncertainty. It is more relevant to task triage than asking a chat model to act as an unrestricted coordinator. [Guide](https://docs.typesafe.ai/concepts/how-to-build-with-system-one)
- **Draft, verify, escalate:** OpenRouter's cascade cookbook includes TypeScript and captured results, but its tiny support-document benchmark is not evidence for code/asset correctness. Its description of `confidence` as probability of correctness conflicts with TypeSafe's formula; use the latter and re-evaluate thresholds. [Cascade example](https://openrouter.ai/docs/cookbook/evaluate-and-optimize/jev-verified-cascade), [Confidence definition](https://docs.typesafe.ai/confidence)
- **Advisory tool-call judgment:** OpenRouter's gate example separates arithmetic checks from semantic questions and supplies approve/block/review outcomes. Useful decomposition reference, but copying its auto-approval behavior would change PlayWeld's permission policy and is not recommended by this research. [Gate example](https://openrouter.ai/docs/cookbook/building-agents/gate-tool-calls-with-jev)
- **Architecture investigation:** Archer Hume's September 17 essay reports API probes and separates observations from inferred shared-prefix, readout, and sparse-backbone design. It is a primary source for that author's experiment, not authoritative disclosure of Jev's internal architecture. [Essay and linked experiment artifacts](https://archerhume.com/posts/jevs-architecture-unmasked)
- **Calibration experiment:** SemIf documents workload-specific temperature fitting, out-of-fold evaluation, inconclusive comparisons, and limits. This is a useful reproducible writeup even if another engine is selected. [Calibration note](https://github.com/TheoLeeCJ/SemIf/blob/master/docs/CALIBRATION.md)
- **Hosted-router incompatibility:** OpenRouter's packaged `typesafe/jev-router` ignores an include list matching no pool models and uses its whole pool, while exclusions remain binding. This directly conflicts with PlayWeld's empty-pool rule; a hosted router alias is not a drop-in replacement for our selector. [Jev Router list semantics](https://openrouter.ai/docs/guides/routing/routers/jev-router)

## Current PlayWeld seams: source-reviewed

These are repository observations, not new runtime-validation claims:

- [ModelRouter](../../packages/platform-service/src/models/router.ts) receives an explicit task type, synchronously filters enabled accounts/models, work types, roles, declared capabilities, pool intersections, manual selection, and known cost/latency estimates, then scores and optionally explores. It does not currently invoke a prompt-aware decision model.
- Its `estimate()` uses task-type observations when at least two exist, otherwise all model observations, with a cold-start prior. Engine is recorded but not used by that estimator; genres are not part of its persisted decision context. Current scoring is not a learned prompt-conditional performance predictor.
- Unknown cost/latency estimates survive constraint filtering; even the baseline cannot be described as a guaranteed charge/latency cap. Prices use a fixed 2,000-input/1,000-output-token estimate when both rates are known. A future experiment needs request-specific token/caching/decision-call costs.
- [CompletionService](../../packages/platform-service/src/models/completion-service.ts) prepares a selected model synchronously and records completion usage/self outcomes. A remote/local HTTP decision call would require an asynchronous orchestration seam, cancellation/deadline handling, and separate decision usage records, not just inserting an awaited call into `route()`.
- [Agent runtime](../../packages/platform-service/src/agents/agent-runtime.ts) currently derives task type from the role's first work type and prepares capacities before completion. Predicted task subtype could enrich scoring, but must not relabel work to bypass existing pools, privileges, or capability requirements.

## Recommended approach and caveats

Recommendations below are proposals for experiments, not selected architecture or dependency ordering:

- Keep deterministic policy as the authority. A decision engine supplies task subtype, difficulty/risk evidence, missing-context flags, reviewer need, and optionally quality estimates over already-eligible candidates. Recheck eligibility and budgets at dispatch; never widen a pool because a judge failed or recommended an unknown ID.
- Use a small, versioned set of questions rather than "make the right decision." Potential choices: implementation/research/review/asset/narrative/unknown; independent flags: needs live-engine evidence, insufficient context, likely needs decomposition. Dependencies, locks, native test results, and user approvals remain computed or enforced by existing systems.
- Task decisions can suggest role/skill selection, bounded retry-versus-escalation, or collecting missing evidence. They must not invent task dependencies, mark work complete, reinterpret Full/Restricted/Ask always, or automatically approve destructive actions. Creative/canon ambiguity remains product-owned.
- Configure a decision endpoint explicitly; do not recursively Auto-route the decision model through itself. Preserve the current selector as an eligible fallback for routing uncertainty, outage, malformed output, and unsupported questions. Consequential task judgments can defer to existing review rather than authorize execution.
- Prefer direct typed inference for the main local experiment: Kev-0.8B/4B, compact Laya, and SemIf. Compare against current scoring, a fixed-taxonomy classifier, and a small existing local chat model with constrained output. Hosted Jev is an optional reference only when data-sharing and paid calls are authorized.
- Keep routing state minimal: task summary, verified resource/capability facts, constraints, allowed IDs, current estimates, and relevant evidence. Hosted privacy classification already sends its input off-device; it cannot be the sole gate deciding whether that same private input may leave the machine.
- Validate types, known labels, completeness, finite numbers, distributions, and version metadata. Preserve raw probabilities, probability semantics, question/schema version, calibration version, model revision, and deterministic reason codes. A later generated explanation is not the decision model's hidden reasoning.
- Reuse one decision for a stable task/turn and its tool loop where appropriate; reconsider on changed constraints, failure, or new evidence. Avoid judging every token/tool call and account for cache-loss/model-switching overhead. Whether reuse helps is an evaluation question, not a promised optimization.
- Runtime recommendation is an independently managed local HTTP endpoint, consistent with the [existing runtime boundary](../TECHNICAL_ARCHITECTURE.md#agent-model-and-access-design). Embedding ONNX or bundling/supervising weights would require explicitly revisiting that boundary, packaging, licensing, and crash/resource isolation.
- Our confirmed routing learning is policy/outcome learning, not model-weight fine-tuning. Upstream training recipes are informative, but training a PlayWeld-specific decision checkpoint would be a separate proposal requiring a resolved scope and data policy.

## Proposed evaluation, not performed

- Build a labeled screening corpus, provisionally 300-500 distinct tasks spanning engine/code/docs/narrative/assets, easy/hard cases, missing evidence, and ambiguous intent. This size is a starting suggestion, not proof of statistical power. Split by source Project/task family, with separate fitting/calibration/locked evaluation sets.
- Evaluate classification and orchestration advice separately from model selection. Best-model labels need actual comparable executions or independently reviewed paired outcomes; logs of the chosen model alone do not tell us how rejected candidates would have performed. Keep synthetic/teacher labels distinct from human/native validation.
- Measure execution quality, per-slice routing regret, false downgrades, escalation coverage/error, Brier/log loss and reliability curves, unknown-label/malformed/timeout rates, decision and end-to-end p50/p95, cold/warm latency, RAM/VRAM, and total decision-plus-worker-plus-retry cost.
- Exercise option permutations, altered descriptions, irrelevant options, prompt injection, contradictory facts, repeated calls, unfamiliar tasks, long/truncated context, CPU fallback, concurrent GPU work, endpoint failure, unavailable candidates, empty pools, and revoked eligibility. Test deterministic invariants independently of model quality.
- Keep learned outcomes separate from policy-enforcement truth and task-completion evidence. Avoid training and evaluating on the same critic's judgments; do not equate API success, self-rating, model agreement, and independently validated task success.
- Promote only measured improvements at an agreed quality/error budget. Shadow recommendations can be replayed against the current selector without changing dispatch; routing trials do not authorize task-policy or permission automation. No model downloads, services, paid inference, weights training, or performance experiments ran in this research pass.

## Sources

- [TypeSafe System One](https://docs.typesafe.ai/concepts/system-one)
- [TypeSafe workflow design](https://docs.typesafe.ai/concepts/how-to-build-with-system-one)
- [TypeSafe models, limits, and data handling](https://docs.typesafe.ai/models)
- [TypeSafe API](https://docs.typesafe.ai/api)
- [TypeSafe confidence](https://docs.typesafe.ai/confidence)
- [TypeSafe AI primer](https://docs.typesafe.ai/introduction/machine-learning-primer)
- [OpenRouter Jev](https://openrouter.ai/docs/guides/community/jev)
- [OpenRouter Jev Router](https://openrouter.ai/docs/guides/routing/routers/jev-router)
- [Kev](https://github.com/jaredpalmer/kev)
- [Laya](https://github.com/NandhaKishorM/laya)
- [Laya TypeScript runtime](https://github.com/NandhaKishorM/laya/blob/main/laya-ts/README.md)
- [Laya English model card](https://huggingface.co/convaiinnovations/laya)
- [Laya multilingual model card](https://huggingface.co/convaiinnovations/laya-multilingual)
- [Laya typed-decisions model card](https://huggingface.co/convaiinnovations/laya-typed-decisions)
- [SemIf](https://github.com/TheoLeeCJ/SemIf)
- [SemIf calibration](https://github.com/TheoLeeCJ/SemIf/blob/master/docs/CALIBRATION.md)
- [daseinlabs/open-jev](https://github.com/daseinlabs/open-jev)
- [open-jev license](https://github.com/daseinlabs/open-jev/blob/main/LICENSE)
- [SetFit](https://github.com/huggingface/setfit)
- [SetFit license](https://github.com/huggingface/setfit/blob/main/LICENSE)
- [System One Adapter](https://github.com/typesafe-ai/system-one-adapter-python)
- [LocalJev](https://github.com/githubnext/localjev)
- [LocalJev license](https://github.com/githubnext/localjev/blob/main/LICENSE)
- [OpenRouter cascade cookbook](https://openrouter.ai/docs/cookbook/evaluate-and-optimize/jev-verified-cascade)
- [OpenRouter tool gate cookbook](https://openrouter.ai/docs/cookbook/building-agents/gate-tool-calls-with-jev)
- [Jev architecture investigation](https://archerhume.com/posts/jevs-architecture-unmasked)
