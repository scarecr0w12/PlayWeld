# Local Model-Routing Systems and Decision Models

**Last researched:** 2026-10-04

## Purpose

Compare locally runnable model/task decision approaches that could inform PlayWeld's adaptive router, as described in [Technical Architecture: Agent, model, and access design](../TECHNICAL_ARCHITECTURE.md#agent-model-and-access-design) and [Model routing](../TECHNICAL_ARCHITECTURE.md#engineering-defaults-for-remaining-technology-choices). This is evidence for later design work, not a selection or implementation proposal. "Local router" means the decision computation may run locally; it does not imply candidate inference, training data, embeddings, or model evaluation are offline. The companion [decision-model survey](decision-models-and-task-policy.md) covers TypeSafe's Jev, local typed inference, and task-policy applications.

## Summary distinctions

- LLMRouter is a Python routing research framework with many router algorithms, a CLI, optional serving integrations, and support for local OpenAI-compatible candidate-model endpoints; its data generation and some router paths still call hosted APIs. [LLMRouter README](https://github.com/ulab-uiuc/LLMRouter/blob/main/README.md)
- RouteLLM is a Python library/framework that can run a learned binary strong/weak-model router in-process or expose it as an OpenAI-compatible server; local candidate inference is supported, but MF and similarity-weighted router variants require query embeddings, and the documented default uses OpenAI embeddings. [RouteLLM README](https://github.com/lm-sys/RouteLLM), [local-model guide](https://github.com/lm-sys/RouteLLM/blob/main/examples/routing_to_local_models.md)
- vLLM Semantic Router is a Go-based routing service/gateway layer with local classifier runtimes and learned candidate selectors; the chat models it selects remain separate endpoints unless the operator runs those endpoints locally. [Repository](https://github.com/vllm-project/semantic-router), [System Overview](https://vllm-sr.ai/docs/overview/semantic-router-overview), [in-process models](https://vllm-sr.ai/docs/installation/runtime/in-process)
- RouterBench is chiefly a dataset, offline evaluation framework, and research benchmark, not a general-purpose model-routing service. [Paper](https://arxiv.org/abs/2403.12031), [code README](https://github.com/withmartian/routerbench)
- FrugalGPT is a research cascade method that calls candidates sequentially and scores generated answers; its paper reports experiments through commercial LLM APIs rather than specifying a current local router service. [Paper](https://arxiv.org/abs/2305.05176)
- BEST-Route is research code for a locally executable learned router plus proxy reward model, selecting both a candidate model and best-of-n sampling count; paper experiments include hosted APIs, while some latency experiments locally deploy candidate LLMs. [Paper](https://arxiv.org/abs/2506.22716), [code README](https://github.com/microsoft/best-route-llm)

## LLMRouter (ulab-uiuc)

- The official README describes 16+ methods spanning KNN, SVM, MLP, matrix factorization, Elo, graph-based, BERT, causal-LLM, multimodal, personalized, and multi-round routers; training and inference are available through a Python CLI. [README](https://github.com/ulab-uiuc/LLMRouter)
- The repository is Python (README specifies Python 3.10); learned routers can be trained and run in a local Python process, while optional Router-R1 support documents a GPU/vLLM dependency. [README](https://github.com/ulab-uiuc/LLMRouter), [project configuration](https://github.com/ulab-uiuc/LLMRouter/blob/main/pyproject.toml)
- Candidate generation can target local Ollama, vLLM, or SGLang servers through OpenAI-compatible `/v1` APIs; this is a separate model-serving endpoint, not the router running the candidate LLM weights. [README](https://github.com/ulab-uiuc/LLMRouter)
- The training-data pipeline separately generates query data, model embeddings, and candidate responses plus quality scores; its API-calling/evaluation step requires configured API keys, so the complete preparation path is not necessarily offline. [README](https://github.com/ulab-uiuc/LLMRouter)
- The README also documents `--route-only`, which returns a routing choice without calling a candidate model API; embeddings and router artifacts still need to be available to the selected algorithm. [README](https://github.com/ulab-uiuc/LLMRouter)
- Its xRouteBench pipeline says it locally trains/evaluates 13 local routers over pre-recorded outputs for 8 datasets, including query embeddings from Qwen3-Embedding-0.6B; replay avoids paid candidate inference but dataset/model downloads and embedding computation remain prerequisites. [Benchmark pipeline README](https://github.com/ulab-uiuc/LLMRouter/blob/main/benchmark_pipeline/README.md), [xRouteBench dataset](https://huggingface.co/datasets/ulab-ai/xRouteBench)
- The project paper describes joint assessment of response quality and inference cost across generic, memory, vision, time-series, and personalized routing settings; its abstract reports learned-router results relative to a fixed-model baseline, which is an author-reported benchmark result, not independent validation. [LLMRouter paper](https://arxiv.org/abs/2608.06867)
- The current repository README identifies an MIT license; its commit history shows activity through 2026-09-30. [LICENSE](https://github.com/ulab-uiuc/LLMRouter/blob/main/LICENSE), [commit history](https://github.com/ulab-uiuc/LLMRouter/commits/main)

## RouteLLM (lm-sys)

- RouteLLM frames routing as predicting whether a strong model beats a weak model for a query, then using a threshold to trade off quality and cost; its included approaches are matrix factorization, similarity-weighted ranking, BERT classifier, causal-LLM classifier, and random baseline. [Paper](https://arxiv.org/abs/2406.18665), [README](https://github.com/lm-sys/RouteLLM)
- The paper trains on Chatbot Arena preference data, optionally augmented with ground-truth benchmark labels or GPT-4-judge labels; it evaluates on MT-Bench, MMLU, and GSM8K and reports significant distribution-dependent differences, including weak results on some tasks without in-domain augmentation. [Paper](https://arxiv.org/abs/2406.18665)
- The paper's reported gains are the authors' experiments: for example, matrix factorization with preference-plus-judge augmentation reports 0.802 APGR on MT-Bench; the benchmark set, data construction, model pair, and augmentation regime matter, so this is not evidence that a new PlayWeld workload will inherit that score. [Paper](https://arxiv.org/abs/2406.18665)
- The paper reports an embedding dependency for MF and similarity-weighted routing: experiments use OpenAI `text-embedding-3-small`; the repository README explicitly says an OpenAI key is currently required for embeddings for MF and SW-ranking even when the candidate model pair is changed. [Paper](https://arxiv.org/abs/2406.18665), [README](https://github.com/lm-sys/RouteLLM)
- The official Ollama guide shows local Llama 3 as the weak candidate while GPT-4 remains the strong candidate; the candidate endpoint can therefore be local without making the entire policy/data/inference path local. [Local-model guide](https://github.com/lm-sys/RouteLLM/blob/main/examples/routing_to_local_models.md)
- RouteLLM can be embedded through its Python `Controller` client or run as a separate Uvicorn/OpenAI-compatible service, with the README's server example listening on port 6060. [README](https://github.com/lm-sys/RouteLLM)
- The project is Python and licensed Apache-2.0; a last repository activity date was not verified in this pass. [README](https://github.com/lm-sys/RouteLLM), [LICENSE](https://github.com/lm-sys/RouteLLM/blob/main/LICENSE)

## vLLM Semantic Router

- The current system is a policy and request-routing layer between clients and inference backends. Its documented data plane uses Envoy External Processing; the router extracts signals, evaluates decisions, and chooses/coordinates backends, while the model servers execute response generation. [System Overview](https://vllm-sr.ai/docs/overview/semantic-router-overview)
- Its policy layers separate signals, projections, decisions, algorithms, plugins, and model pools; deterministic rules and hard eligibility conditions can precede selection. The docs explicitly distinguish semantic model selection from backend replica scheduling. [Routing Pipeline](https://vllm-sr.ai/docs/overview/signal-driven-decisions), [System Overview](https://vllm-sr.ai/docs/overview/semantic-router-overview)
- The latest documented learned selectors are KNN, KMeans, SVM, and MLP. They choose only among a decision's already-configured candidates; they do not discover or deploy models. The model-selection guide requires using the same embedding model/feature layout at training and inference. [ML-Based Model Selection](https://vllm-sr.ai/docs/training/ml-model-selection)
- The Python training workflow benchmarks two or more OpenAI-compatible candidate endpoints against labeled/otherwise-scored examples, records output/quality/latency, then writes selector artifacts; candidate endpoints can include `http://localhost:...`, but training all candidates can still use remote providers and sensitive data. [ML-Based Model Selection](https://vllm-sr.ai/docs/training/ml-model-selection)
- The router service is primarily Go (the repository advertises Go); ML selector training is Python, and model inference bindings include Candle and ONNX Runtime/OpenVINO options. [Repository](https://github.com/vllm-project/semantic-router), [ML selection](https://vllm-sr.ai/docs/training/ml-model-selection), [in-process models](https://vllm-sr.ai/docs/installation/runtime/in-process)
- Router-side Vela classifiers can execute in-process on CPU through Candle or ONNX Runtime; this local classifier predicts request signals, distinct from the separately routed answer model. [In-process models](https://vllm-sr.ai/docs/installation/runtime/in-process)
- The documented local quickstart exposes an OpenAI-compatible HTTP endpoint; current quickstart requirements include Linux/macOS/WSL2 and Docker (Linux may use Podman). This is a separate service topology rather than an in-process TypeScript library. [Quickstart](https://vllm-sr.ai/docs/installation/), [deployment choices](https://vllm-sr.ai/docs/installation/deployment-options)
- The repository is Apache-2.0; its main-branch commit history shows activity on 2026-10-04, including runtime and routing changes. [LICENSE](https://github.com/vllm-project/semantic-router/blob/main/LICENSE), [commit history](https://github.com/vllm-project/semantic-router/commits/main)
- Its latest ML-selection docs require held-out evaluation against fixed-default, random, and best-single-model baselines, including quality by workload slice, model-use distribution, cost, latency, regret, failures, and exclusions; the docs warn that model rank on the evaluation set does not prove production ranking. [ML-Based Model Selection](https://vllm-sr.ai/docs/training/ml-model-selection), [model evaluation](https://vllm-sr.ai/docs/training/model-performance-eval)

## RouterBench

- RouterBench is an offline benchmark framework and dataset with over 405,000 precomputed model outcomes from 11 models across eight datasets/tasks, intended to let predictive routers train/evaluate without repeating every model inference. [Paper](https://arxiv.org/abs/2403.12031)
- The paper's predictive baselines include KNN and MLP performance predictors; it also evaluates cascades, but the paper's oracle/ideal cascade uses perfect knowledge of response quality and is an upper bound rather than an implementable decision model. [Paper](https://arxiv.org/abs/2403.12031)
- The authors report that predictive routers generally did not significantly outperform their Zero router baseline, with outcomes varying by task; cascades were sensitive to judge error. These results caution against treating the existence of a benchmark or a complex router as evidence of reliable decision quality. [Paper](https://arxiv.org/abs/2403.12031)
- The code is Python, can evaluate local precomputed files, and uses Martian's model gateway for regenerating model results; its README says MongoDB is optional for embedding cache, with local-file cache available. [Code README](https://github.com/withmartian/routerbench)
- The code repository is MIT-licensed; last activity date was not verified in this pass. [LICENSE](https://github.com/withmartian/routerbench/blob/main/LICENSE), [repository](https://github.com/withmartian/routerbench)

## FrugalGPT

- FrugalGPT combines a scorer estimating the reliability of a generated answer with a learned sequence/list of models and thresholds; a query calls models in sequence until an answer passes the score threshold or the chain is exhausted. This is a cascade, unlike a one-shot pre-generation router. [Paper](https://arxiv.org/abs/2305.05176)
- The paper reports an experimental cascade on three datasets and 12 commercial APIs, with DistilBERT as an example scoring function; on the HEADLINES dataset it reports 98.3% cost savings at matching the best individual model's performance. These are paper-author results using 2023-era models/prices, not an independent replication or current price prediction. [Paper](https://arxiv.org/abs/2305.05176)
- Its learned cascade and scorer can conceptually run locally, but the reported candidate APIs and current official research source do not define a current installable router service, typed plugin contract, or local serving integration. [Paper](https://arxiv.org/abs/2305.05176)
- Training depends on labeled/in-domain samples and scorer quality; the authors identify distribution similarity and upfront data/optimization cost as limitations. [Paper](https://arxiv.org/abs/2305.05176)
- This paper source does not state a software license or last repository activity; neither was established in this research pass. [Paper](https://arxiv.org/abs/2305.05176)

## BEST-Route

- BEST-Route selects both a candidate model and a best-of-n sample count, predicting whether the selected candidate's best response meets a quality threshold relative to a reference model; a proxy reward model ranks that candidate's generated responses. [Paper](https://arxiv.org/abs/2506.22716)
- The authors report 60% inference-cost reduction with a 0.8% armoRM quality drop on their setup, using 10,000 examples split into train/validation/test, eight candidate/reference models, and 20 samples per example for dataset construction. [Paper](https://arxiv.org/abs/2506.22716)
- The paper uses a 44M DeBERTa-v3-small multi-head router and a 300M DeBERTa-v3-large-derived proxy reward model; model/router experiments use paid APIs, while the latency section also describes locally deploying Llama-3.1-8B, Mistral-7B, and Phi-3-mini. [Paper](https://arxiv.org/abs/2506.22716)
- The public implementation is Python research scripts/notebooks with a `train_router.py` entrypoint and MIT license; it documents no general OpenAI-compatible router server protocol. Its last repository activity date was not verified in this pass. [Code README](https://github.com/microsoft/best-route-llm), [LICENSE](https://github.com/microsoft/best-route-llm/blob/main/LICENSE.md)
- BEST-Route is heavier than a single selection decision because best-of-n also requires multiple generations and a proxy reward scorer; its reported quality measure is armoRM, so validation with PlayWeld-specific test/reviewer/user outcomes would be separate evidence. [Paper](https://arxiv.org/abs/2506.22716)

## Design-Relevant Observations

- These sources distinguish pre-generation selection (RouteLLM, predictive RouterBench routers, learned selectors in vLLM Semantic Router) from post-generation cascade/selection (FrugalGPT and BEST-Route); the latter spend extra calls or scoring compute to decide whether to accept or escalate. [RouteLLM](https://arxiv.org/abs/2406.18665), [RouterBench](https://arxiv.org/abs/2403.12031), [FrugalGPT](https://arxiv.org/abs/2305.05176), [BEST-Route](https://arxiv.org/abs/2506.22716)
- A locally executing router is not synonymous with offline routing: RouteLLM MF/SW may call a hosted embedding API, training/evaluation may invoke candidate endpoints, and research reports often mix locally hosted open models with paid API models. [RouteLLM](https://github.com/lm-sys/RouteLLM), [LLMRouter](https://github.com/ulab-uiuc/LLMRouter), [BEST-Route](https://arxiv.org/abs/2506.22716)
- vLLM Semantic Router has the clearest documented explicit separation of eligibility/policy from learned ranking, and its ML selector is constrained to a decision's declared candidate set; it is nevertheless a full gateway/runtime architecture rather than a small in-process decision-model dependency. [Routing Pipeline](https://vllm-sr.ai/docs/overview/signal-driven-decisions), [ML selection](https://vllm-sr.ai/docs/training/ml-model-selection), [System Overview](https://vllm-sr.ai/docs/overview/semantic-router-overview)
- RouterBench, RouteLLM, and BEST-Route provide research evaluation patterns and candidate learned methods, but their reported metrics and workloads are not PlayWeld outcome evidence; the architecture's task eligibility, privacy, budgets, validation outcomes, and rollback requirements remain distinct system constraints. [RouterBench](https://arxiv.org/abs/2403.12031), [RouteLLM](https://arxiv.org/abs/2406.18665), [BEST-Route](https://arxiv.org/abs/2506.22716), [PlayWeld architecture](../TECHNICAL_ARCHITECTURE.md#agent-model-and-access-design)
- Jev is TypeSafe's typed decision model, a different kind of component from these routing frameworks. Its hosted API and independent local alternatives are examined in the [companion survey](decision-models-and-task-policy.md); it should not be conflated with LLMRouter or RouteLLM. [TypeSafe System One](https://docs.typesafe.ai/concepts/system-one)

## Sources

- [LLMRouter repository and README](https://github.com/ulab-uiuc/LLMRouter)
- [LLMRouter MIT license](https://github.com/ulab-uiuc/LLMRouter/blob/main/LICENSE)
- [LLMRouter commit activity](https://github.com/ulab-uiuc/LLMRouter/commits/main)
- [LLMRouter paper](https://arxiv.org/abs/2608.06867)
- [LLMRouter xRouteBench data](https://huggingface.co/datasets/ulab-ai/xRouteBench)
- [RouteLLM repository and README](https://github.com/lm-sys/RouteLLM)
- [RouteLLM local model guide](https://github.com/lm-sys/RouteLLM/blob/main/examples/routing_to_local_models.md)
- [RouteLLM Apache-2.0 license](https://github.com/lm-sys/RouteLLM/blob/main/LICENSE)
- [RouteLLM paper](https://arxiv.org/abs/2406.18665)
- [vLLM Semantic Router repository](https://github.com/vllm-project/semantic-router)
- [vLLM Semantic Router license](https://github.com/vllm-project/semantic-router/blob/main/LICENSE)
- [vLLM Semantic Router commit activity](https://github.com/vllm-project/semantic-router/commits/main)
- [vLLM Semantic Router system overview](https://vllm-sr.ai/docs/overview/semantic-router-overview)
- [vLLM Semantic Router routing pipeline](https://vllm-sr.ai/docs/overview/signal-driven-decisions)
- [vLLM Semantic Router ML-based model selection](https://vllm-sr.ai/docs/training/ml-model-selection)
- [vLLM Semantic Router model performance evaluation](https://vllm-sr.ai/docs/training/model-performance-eval)
- [vLLM Semantic Router in-process models](https://vllm-sr.ai/docs/installation/runtime/in-process)
- [vLLM Semantic Router quickstart](https://vllm-sr.ai/docs/installation/)
- [vLLM Semantic Router deployment options](https://vllm-sr.ai/docs/installation/deployment-options)
- [RouterBench paper](https://arxiv.org/abs/2403.12031)
- [RouterBench code and README](https://github.com/withmartian/routerbench)
- [RouterBench MIT license](https://github.com/withmartian/routerbench/blob/main/LICENSE)
- [FrugalGPT paper](https://arxiv.org/abs/2305.05176)
- [BEST-Route paper](https://arxiv.org/abs/2506.22716)
- [BEST-Route code and README](https://github.com/microsoft/best-route-llm)
- [BEST-Route MIT license](https://github.com/microsoft/best-route-llm/blob/main/LICENSE.md)
- [PlayWeld technical architecture: agent/model routing](../TECHNICAL_ARCHITECTURE.md#agent-model-and-access-design)
- [TypeSafe System One](https://docs.typesafe.ai/concepts/system-one)
