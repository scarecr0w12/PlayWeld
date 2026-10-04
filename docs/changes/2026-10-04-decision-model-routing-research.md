# Investigate decision models and local routing systems

**Release:** 0.9.0

**Impact:** none

**Category:** Documentation

## Summary

Research-only investigation of Jev, local typed decision engines, LLMRouter, comparable model-routing systems, and technical evaluation methods for PlayWeld model selection and task-policy advice.

## Details

- Add a dated primary-source survey of Jev, Kev, Laya, SemIf, Gemma option scoring, fixed-taxonomy classifiers, and generative adapters. Distinguish hosted services from local inference, typed protocol compatibility from probability semantics, vendor/author measurements from repository acceptance, and code licenses from checkpoint/data obligations.
- Add a companion routing-system survey of LLMRouter, RouteLLM, vLLM Semantic Router, routing benchmarks, and cascade methods, with deployment/training dependencies and source-linked examples and technical papers.
- Inspect the current synchronous routing/completion seam, explicit role-derived task types, task-type/global outcome estimator, eligibility enforcement, and limitations of estimated cost constraints. Propose bounded advisory decisions and a separate calibration/quality/cost evaluation rather than replacing policy or permissions with a model.
- Record incompatible hosted-router include-list fallback behavior, inconsistent confidence definitions across implementations and cookbooks, privacy-gate disclosure risks, task-relabeling risks, and missing counterfactual outcome labels.
- Add research pointers to M05/M06 without resolving them, choosing a backend, changing confirmed runtime ownership, modifying application behavior, adding dependencies, or authorizing model-weight training. Refresh the generated changelog only; release version stays unchanged and no migration is required.

## Validation

- Source-reviewed official API documentation, repository READMEs, selected model cards/licenses, technical writeups, and current PlayWeld source. Upstream benchmark results were not independently reproduced.
- `bash scripts/check-links.sh` passed with all relative links and anchors valid; external source pages were retrieved during research, not exhaustively link-crawled by this script.
- `npm run format:check` and `git diff --check` passed.
- `npm run changelog:update` and `npm run changelog:check -- --base HEAD` passed with the research paths covered by this work record.
- `node scripts/generate-documentation-inventory.cjs --check`, `node scripts/generate-system-reference.cjs --check`, and `node scripts/check-documentation-evidence.cjs` passed; these check generated references and artifact integrity, not the truth of upstream benchmark claims.
- No model downloads, local inference servers, paid model requests, training, GPU measurements, or application changes were performed. Proposed experiments remain unperformed.
- Application build/typecheck/lint/tests were not rerun for this documentation-only investigation.

## Files

- `docs/research/decision-models-and-task-policy.md`
- `docs/research/local-model-routing-systems.md`
- `docs/OPEN_DECISIONS.md`
- `docs/changes/2026-10-04-decision-model-routing-research.md`
