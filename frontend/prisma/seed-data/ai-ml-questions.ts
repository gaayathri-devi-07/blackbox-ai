import type { SeedQuestion } from "./types";

const AI = "AI_ENGINEER" as const;
const ML = "ML_ENGINEER" as const;
const DS = "DATA_SCIENTIST" as const;
const BE = "BACKEND_ARCHITECT" as const;

/** LLM Architectures, ML Fundamentals and MLOps. */
export const AI_ML_QUESTIONS: SeedQuestion[] = [
  // ─── LLM Architectures ──────────────────────────────────────────────────────
  {
    slug: "design-rag-system",
    category: "LLM_ARCHITECTURES",
    roleTargets: [AI, ML],
    difficulty: "HARD",
    question: "Design a retrieval-augmented generation system that answers employee questions over 2 million internal documents.",
    sampleAnswer:
      "I'd start by pinning down requirements: freshness (docs change hourly), access control (users may only see documents they're entitled to), latency (p95 under 3 seconds) and how we'll measure answer quality. Ingestion: parse documents into structure-aware chunks of roughly 300–800 tokens with overlap, keep titles and headings as metadata, and attach the source ACL to every chunk. Index: hybrid retrieval — BM25 for exact terms like error codes plus dense embeddings in a vector store — fused with reciprocal rank fusion, then a cross-encoder reranker over the top 50. Enforce ACLs as a pre-filter in the retrieval query, never as a post-filter in the prompt. Generation: the prompt carries the top 5–8 chunks with citations, and the model is instructed to answer only from context and say when it can't. Evaluation is the core of the design: a golden set of a few hundred real questions scored for retrieval recall@k, answer faithfulness and citation accuracy, run on every index or prompt change, plus online thumbs-up rate and escalation rate. Operationally I'd add incremental re-indexing via change events, embedding-model versioning so re-embeds are atomic, and a semantic cache for repeated questions.",
    weakAnswer: "I'd put the documents in a vector database, embed the user's question, retrieve the most similar chunks and send them to GPT to generate an answer.",
    explanation:
      "The weak answer describes the tutorial version. Interviewers look for chunking strategy, hybrid retrieval and reranking, security-aware filtering, and above all an evaluation plan — that is what separates a demo from a production system.",
    tip: "Always say how you would measure retrieval quality and answer faithfulness separately; it shows you know where RAG systems actually fail.",
    tags: ["rag", "retrieval", "vector-search", "evaluation", "system-design"],
  },
  {
    slug: "kv-cache-inference",
    category: "LLM_ARCHITECTURES",
    roleTargets: [AI, ML],
    difficulty: "MEDIUM",
    question: "What is the KV cache in transformer inference, and what are its practical implications?",
    sampleAnswer:
      "During autoregressive decoding each new token attends to all previous tokens. Without caching we would recompute the key and value projections for the whole prefix at every step, making generation quadratic in sequence length. The KV cache stores each layer's keys and values for tokens already processed, so each step only computes projections for the newest token and attends against the cache. The trade-off is memory: cache size is roughly 2 × layers × KV heads × head dimension × sequence length × batch size × bytes per value, which for long contexts can exceed the model weights themselves. That is why serving systems care about grouped-query and multi-query attention (fewer KV heads), paged attention as in vLLM to avoid fragmentation, cache quantization, and prefix caching to reuse the cache across requests that share a system prompt. It also explains why prefill is compute-bound while decode is memory-bandwidth-bound.",
    weakAnswer: "The KV cache stores previous computations so the model runs faster during inference.",
    explanation:
      "The strong answer explains what is cached and why, quantifies the memory cost, and connects it to real serving techniques, which shows hands-on inference experience.",
    tip: "Be ready to estimate KV cache memory on a whiteboard; walking through the formula is a common follow-up.",
    tags: ["inference", "transformers", "kv-cache", "serving"],
  },
  {
    slug: "finetune-vs-rag-vs-prompting",
    category: "LLM_ARCHITECTURES",
    roleTargets: [AI, ML],
    difficulty: "MEDIUM",
    question: "How do you decide between prompt engineering, retrieval, and fine-tuning for a new LLM use case?",
    sampleAnswer:
      "I separate what the model needs to know from how it needs to behave. If the gap is knowledge — private, fresh or citation-worthy facts — retrieval is the right tool because it updates without retraining and gives provenance. If the gap is behavior — output format, tone, domain-specific reasoning patterns, or getting a smaller model to match a larger one on a narrow task — fine-tuning helps, and parameter-efficient methods like LoRA make that cheap to train and serve as adapters. I always start with prompting and a strong evaluation set because it is the fastest loop and sets a baseline. I move to fine-tuning only when I have a few thousand high-quality examples, a clear eval showing prompting has plateaued, and a cost or latency reason to use a smaller model. In practice the best systems combine them: a fine-tuned model that follows the house format, fed by retrieval for facts.",
    weakAnswer: "Fine-tuning is the most powerful, so I'd fine-tune if we have the budget; otherwise I'd use prompts.",
    explanation:
      "The strong answer gives a decision framework — knowledge versus behavior — and grounds the choice in data availability, evaluation, cost and latency rather than perceived power.",
    tip: "Mention that you would establish an evaluation set before choosing; it reframes the question as an engineering decision.",
    tags: ["fine-tuning", "lora", "rag", "prompting"],
  },
  {
    slug: "evaluate-llm-feature",
    category: "LLM_ARCHITECTURES",
    roleTargets: [AI, ML],
    difficulty: "HARD",
    question: "How would you evaluate an LLM-powered feature before and after launch?",
    sampleAnswer:
      "Offline, I build a versioned evaluation set from real or realistic inputs, stratified by user intent and including adversarial and edge cases. Each case gets criteria rather than a single gold answer: factual correctness, faithfulness to provided context, format compliance and safety. I use deterministic checks wherever possible — schema validation, regex, exact match on extracted fields — and an LLM-as-judge with a written rubric for subjective qualities, calibrated against a few hundred human labels so I know its agreement rate. Every prompt, model or retrieval change runs through this suite in CI with regression thresholds. Online, I track task success proxies such as acceptance or edit rate, explicit feedback, escalation to humans, latency, cost per request and refusal rate, sliced by segment. I sample production traffic for weekly human review, and feed failures back into the offline set so the eval grows with the product.",
    weakAnswer: "I'd test it with some examples to make sure the answers look good, then monitor user feedback after launch.",
    explanation:
      "Strong candidates treat evaluation as infrastructure: versioned datasets, layered metrics, a calibrated judge, CI gates and a feedback loop from production failures.",
    tip: "Say how you validate the LLM judge itself — agreement with human labels — because interviewers often probe that weakness.",
    tags: ["evaluation", "llm-as-judge", "monitoring"],
  },
  {
    slug: "reduce-hallucinations",
    category: "LLM_ARCHITECTURES",
    roleTargets: [AI],
    difficulty: "MEDIUM",
    question: "Users report that your assistant confidently invents facts. How do you reduce hallucinations?",
    sampleAnswer:
      "First I'd measure it: collect the reported cases, classify them — missing knowledge, retrieval miss, ignored context, or a reasoning error — and build a faithfulness eval so fixes are verifiable. Then I work by cause. For knowledge gaps, ground answers in retrieval and require citations. For retrieval misses, improve chunking, hybrid search and reranking, because a model can't be faithful to context it never saw. For ignored context, tighten the instructions, put the evidence close to the question, lower temperature, and allow the model to say it doesn't know. For high-stakes outputs, add a verification step that checks each claim against sources and drops unsupported ones. Finally, design the UX so citations are visible and uncertainty is communicated, because some residual error rate is unavoidable.",
    weakAnswer: "I'd tell the model in the prompt not to make things up and lower the temperature.",
    explanation:
      "Hallucinations have different root causes. The strong answer diagnoses before fixing and applies targeted mitigations, rather than relying on instructions that models often ignore.",
    tip: "Distinguish retrieval failures from generation failures; it shows you can debug a RAG pipeline end to end.",
    tags: ["hallucination", "grounding", "faithfulness"],
  },
  {
    slug: "tokenization-implications",
    category: "LLM_ARCHITECTURES",
    roleTargets: [AI, ML],
    difficulty: "EASY",
    question: "What is tokenization in LLMs and why does it matter to an engineer building on them?",
    sampleAnswer:
      "LLMs operate on tokens, not characters or words. Most modern tokenizers use subword schemes such as byte-pair encoding, which merge frequent character sequences into a fixed vocabulary, so common words are a single token while rare words, code identifiers and many non-English languages split into several. That has direct engineering consequences: context limits and pricing are measured in tokens, so the same text costs different amounts across languages; models struggle with character-level tasks like counting letters because they never see individual characters; and numbers may be split inconsistently, which hurts arithmetic. Practically I count tokens with the model's own tokenizer when budgeting context, and I watch for prompt formats that tokenize poorly.",
    weakAnswer: "Tokenization splits text into words so the model can read it.",
    explanation:
      "Tokens are subwords, not words. The strong answer connects that fact to cost, context limits and known model weaknesses.",
    tip: "Give one concrete failure mode caused by tokenization — it turns a definition into insight.",
    tags: ["tokenization", "bpe", "fundamentals"],
  },
  {
    slug: "decoding-strategies",
    category: "LLM_ARCHITECTURES",
    roleTargets: [AI, ML],
    difficulty: "EASY",
    question: "Explain temperature, top-k and top-p sampling. When would you use each?",
    sampleAnswer:
      "At each step the model outputs a probability distribution over the vocabulary, and decoding decides how to pick from it. Temperature rescales the logits before softmax: below 1 sharpens the distribution toward the most likely tokens, above 1 flattens it for more diversity, and 0 is effectively greedy. Top-k samples only from the k most likely tokens; top-p, or nucleus sampling, samples from the smallest set whose cumulative probability reaches p, which adapts to how confident the model is. For extraction, classification, code and anything that must be reproducible I use temperature near 0. For brainstorming or creative copy I raise temperature and use top-p around 0.9 to stay diverse without sampling garbage from the long tail. Beam search suits closed tasks like translation but tends to produce bland, repetitive text in open-ended generation.",
    weakAnswer: "Temperature controls creativity. Higher is more creative and lower is more accurate.",
    explanation:
      "The strong answer explains the mechanism — reshaping a probability distribution — and maps each strategy to a use case, instead of repeating a slogan.",
    tip: "Mention that temperature 0 is not always perfectly deterministic in practice due to batching and floating-point effects.",
    tags: ["decoding", "sampling", "inference"],
  },
  {
    slug: "llm-latency-cost-optimization",
    category: "LLM_ARCHITECTURES",
    roleTargets: [AI, ML, BE],
    difficulty: "HARD",
    question: "Your LLM endpoint's p95 latency is 9 seconds and costs are growing quickly. How do you bring both down?",
    sampleAnswer:
      "I'd profile first, separating time to first token from generation time, and break down cost by route, prompt size and output size. Then I'd work through levers in order of effort. Request-level: trim prompts and retrieved context, cap output length, stream tokens so perceived latency drops immediately, and cache exact and semantically similar requests. Model-level: route easy requests to a smaller or distilled model and reserve the large one for hard cases, judged by a lightweight classifier or confidence signal. Serving-level, if we self-host: continuous batching, paged KV cache, prefix caching for the shared system prompt, quantization to 8 or 4 bits after checking quality on our eval set, and speculative decoding with a draft model. Every change is gated by the evaluation suite so quality doesn't silently regress, and I'd set per-route latency and cost SLOs on a dashboard so regressions are caught.",
    weakAnswer: "Use a faster model and add more GPUs.",
    explanation:
      "Strong answers start with measurement, separate perceived from actual latency, and present a tiered toolkit — prompts, routing, caching, serving optimizations — each guarded by quality evaluation.",
    tip: "Distinguish time to first token from tokens per second; interviewers notice when candidates conflate them.",
    tags: ["latency", "cost", "quantization", "caching", "routing"],
  },
  {
    slug: "reliable-tool-using-agent",
    category: "LLM_ARCHITECTURES",
    roleTargets: [AI],
    difficulty: "HARD",
    question: "How would you build an LLM agent that calls internal tools reliably enough for production?",
    sampleAnswer:
      "I'd minimize autonomy to what the task needs: a fixed workflow with LLM steps beats an open-ended loop when the path is known. Tools get narrow, well-described interfaces with typed JSON schemas, and every model-produced argument is validated before execution; invalid calls are returned to the model as structured errors it can correct. Side-effecting tools are idempotent, run with the user's permissions rather than a superuser's, and high-impact actions require explicit confirmation. The loop has hard limits on steps, tokens and wall time, and every step is traced — prompt, tool call, result — so failures are debuggable. I treat tool outputs as untrusted data to defend against prompt injection. Evaluation uses scripted scenarios with expected end states rather than expected text, measuring task success, unnecessary tool calls and unsafe actions, and I run it in CI against a sandboxed environment.",
    weakAnswer: "I'd give the model a list of tools and let it decide which ones to call until the task is done.",
    explanation:
      "Production agents need constrained interfaces, validation, permissions, limits, tracing and outcome-based evaluation. The weak answer describes an unbounded loop with no safeguards.",
    tip: "Say \"tool outputs are untrusted input\" — it signals awareness of prompt injection through data.",
    tags: ["agents", "tool-use", "function-calling", "safety"],
  },
  {
    slug: "prompt-injection-defense",
    category: "LLM_ARCHITECTURES",
    roleTargets: [AI],
    difficulty: "MEDIUM",
    question: "What is prompt injection and how do you defend an LLM application against it?",
    sampleAnswer:
      "Prompt injection is when untrusted text — a user message, a retrieved web page, an email the assistant summarizes — contains instructions the model follows instead of the developer's. There is no complete fix at the model level, so I design the system to limit damage. Clearly delimit untrusted content and instruct the model to treat it as data. Apply least privilege: the model only gets the tools and data scopes the current user is entitled to, and actions with side effects need confirmation or run through deterministic policy checks outside the model. Never place secrets in prompts. Validate outputs before acting on them, and filter rendered output to prevent exfiltration through links or images. Finally, red-team with known injection payloads as part of the evaluation suite and monitor for anomalous tool usage.",
    weakAnswer: "I'd add a line to the system prompt telling the model to ignore malicious instructions.",
    explanation:
      "Instructions alone are not a security boundary. The strong answer treats the model as untrusted and enforces safety through architecture: least privilege, validation and confirmation.",
    tip: "Frame the defense as limiting blast radius; it is the mental model security-minded interviewers want.",
    tags: ["security", "prompt-injection", "guardrails"],
  },
  {
    slug: "positional-encoding-long-context",
    category: "LLM_ARCHITECTURES",
    roleTargets: [AI, ML],
    difficulty: "MEDIUM",
    question: "Why do transformers need positional information, and how do approaches like RoPE help with long context?",
    sampleAnswer:
      "Self-attention is permutation-invariant: without positional information a transformer would treat a sentence as a bag of tokens. The original transformer added fixed sinusoidal or learned absolute position embeddings to the inputs, but these generalize poorly beyond the training length. Rotary position embeddings rotate the query and key vectors by an angle proportional to position, so their dot product depends on relative distance — a natural inductive bias for language. Because the encoding is relative and continuous, context can be extended after training with techniques like position interpolation or NTK-aware scaling of the rotation frequencies, typically followed by brief fine-tuning on longer sequences. I'd also note that a long advertised context doesn't guarantee the model uses it well, so I'd evaluate retrieval across positions before relying on it.",
    weakAnswer: "Positional encoding tells the model where each word is. RoPE is a newer version that is better.",
    explanation:
      "The strong answer explains why position matters (permutation invariance), how RoPE encodes relative position, and why that enables context extension — with a practical caveat.",
    tip: "Connecting architecture details to product behavior, such as long-context reliability, shows applied judgment.",
    tags: ["transformers", "rope", "long-context"],
  },

  // ─── ML Fundamentals ────────────────────────────────────────────────────────
  {
    slug: "bias-variance-tradeoff",
    category: "MACHINE_LEARNING",
    roleTargets: [ML, DS, AI],
    difficulty: "EASY",
    question: "Explain the bias-variance trade-off and how you diagnose which one is hurting your model.",
    sampleAnswer:
      "Expected error decomposes into bias — error from overly simple assumptions — variance — sensitivity to the particular training sample — and irreducible noise. I diagnose with learning curves and the train/validation gap. High training error close to validation error means high bias: the model can't fit even the training data, so I add capacity, better features or train longer. Low training error with much higher validation error means high variance: the model memorizes, so I get more data, regularize, simplify, or use bagging. Ensembles map neatly onto this: bagging reduces variance and boosting reduces bias. In deep learning the classic U-shaped curve is complicated by double descent, but the train/validation diagnosis still guides what to try next.",
    weakAnswer: "Bias means the model is wrong and variance means it is inconsistent. You want both to be low.",
    explanation:
      "The strong answer defines both terms precisely and, more importantly, turns them into a diagnostic procedure with specific remedies.",
    tip: "Describe what a learning curve would look like in each case; it proves you have used the concept, not just memorized it.",
    tags: ["bias-variance", "generalization", "diagnostics"],
  },
  {
    slug: "precision-recall-tradeoff",
    category: "MACHINE_LEARNING",
    roleTargets: [ML, DS, AI],
    difficulty: "EASY",
    question: "When would you optimize for precision versus recall? How do you choose a decision threshold?",
    sampleAnswer:
      "Precision is the share of predicted positives that are correct; recall is the share of actual positives we catch. The right balance depends on the cost of each error type. For fraud blocking that declines a customer's card, false positives are expensive, so I favor precision; for cancer screening, missed cases are far worse, so I favor recall and send positives to a second-stage review. I choose the threshold from the business cost matrix rather than defaulting to 0.5: plot the precision-recall curve on a validation set, attach a cost to each false positive and false negative, and pick the threshold that minimizes expected cost or meets a constraint such as recall at least 95 percent. I also check that the model is calibrated if scores are shown to users or combined with other signals, and I revisit the threshold as base rates drift.",
    weakAnswer: "Precision is accuracy of positives and recall is coverage. I usually use F1 to balance both.",
    explanation:
      "F1 assumes both errors cost the same, which is rarely true. The strong answer ties the choice to business costs and explains how to set the threshold.",
    tip: "Always ask what a false positive and a false negative cost in the scenario; it reframes the question around impact.",
    tags: ["metrics", "precision", "recall", "thresholds"],
  },
  {
    slug: "data-leakage",
    category: "MACHINE_LEARNING",
    roleTargets: [ML, DS],
    difficulty: "MEDIUM",
    question: "Your model scores 0.98 AUC offline but performs poorly in production. What might be going on?",
    sampleAnswer:
      "An offline result that good is a red flag for data leakage, so I'd check that first. Common forms: features that are only known after the label is determined, such as a refund flag used to predict churn; target information leaking through aggregates computed over the full dataset; preprocessing like scaling or imputation fit before the train/test split; duplicate or near-duplicate entities spanning train and test; and random splits on time-series data, which let the model see the future. I'd audit feature timestamps against prediction time, re-split by time and by entity, and fit all preprocessing inside the cross-validation pipeline. If leakage is ruled out, I'd look at training-serving skew — features computed differently online — and distribution shift between the training period and today, comparing feature distributions in production logs against training data.",
    weakAnswer: "The model is probably overfitting. I would add regularization and retrain.",
    explanation:
      "Overfitting shows up in validation scores; a near-perfect validation score that collapses in production points to leakage or skew. The strong answer lists concrete leakage patterns and how to detect them.",
    tip: "When results look too good, say so — skepticism about suspiciously high metrics is a valued trait.",
    tags: ["leakage", "validation", "debugging"],
  },
  {
    slug: "l1-vs-l2-regularization",
    category: "MACHINE_LEARNING",
    roleTargets: [ML, DS],
    difficulty: "MEDIUM",
    question: "Compare L1 and L2 regularization. Why does L1 produce sparse solutions?",
    sampleAnswer:
      "Both add a penalty on weight size to the loss to discourage overfitting. L2 adds the sum of squared weights, shrinking all weights smoothly toward zero and handling correlated features by spreading weight across them. L1 adds the sum of absolute values, which drives many weights exactly to zero and so performs feature selection. The geometric intuition: the L1 constraint region is a diamond whose corners lie on the axes, so the loss contours usually first touch it at a corner where some coordinates are zero; the L2 region is a sphere with no corners. Equivalently, L1's gradient has constant magnitude near zero, so it keeps pushing small weights all the way to zero, whereas L2's gradient fades as the weight shrinks. Elastic net combines them, which helps when there are groups of correlated features. In deep learning, weight decay plays the L2 role, and with adaptive optimizers decoupled weight decay as in AdamW behaves better than adding an L2 term to the loss.",
    weakAnswer: "L1 uses absolute values and L2 uses squares. L1 is better when you want fewer features.",
    explanation:
      "The strong answer explains why sparsity happens — geometrically and through the gradient — and adds practical nuance about correlated features and AdamW.",
    tip: "Sketch the diamond and circle constraint regions if you have a whiteboard; it is the classic intuition interviewers expect.",
    tags: ["regularization", "sparsity", "optimization"],
  },
  {
    slug: "random-forest-vs-gradient-boosting",
    category: "MACHINE_LEARNING",
    roleTargets: [ML, DS],
    difficulty: "MEDIUM",
    question: "Compare random forests and gradient-boosted trees. When would you choose each?",
    sampleAnswer:
      "Both are tree ensembles but reduce error differently. A random forest trains deep, independent trees on bootstrap samples with random feature subsets and averages them, which mostly reduces variance; it is robust to hyperparameters, parallelizes trivially and is hard to overfit badly. Gradient boosting trains shallow trees sequentially, each fitting the residual errors — the gradient of the loss — of the ensemble so far, which reduces bias and usually achieves higher accuracy on tabular data. The cost is sensitivity to learning rate, depth and number of trees, plus a greater need for early stopping on a validation set. I default to gradient boosting libraries such as LightGBM or XGBoost for tabular problems where accuracy matters and I have time to tune, and choose a random forest for a strong baseline with minimal tuning or when I want a stable model quickly.",
    weakAnswer: "Random forest uses many trees and gradient boosting is more advanced, so it is usually better.",
    explanation:
      "The strong answer explains the mechanism of each — bagging versus sequential residual fitting — links them to variance and bias, and gives criteria for choosing.",
    tip: "Mention early stopping when discussing boosting; it shows you have trained these models in practice.",
    tags: ["ensembles", "boosting", "tabular"],
  },
  {
    slug: "model-not-learning",
    category: "MACHINE_LEARNING",
    roleTargets: [ML, AI],
    difficulty: "HARD",
    question: "Your neural network's training loss is flat from the first epoch. Walk me through how you debug it.",
    sampleAnswer:
      "I'd go from cheapest checks to most expensive. First, data and labels: visualize a batch after preprocessing to confirm inputs are what I think, labels line up with inputs, and normalization isn't zeroing everything out. Second, try to overfit a single small batch; if the model can't drive loss near zero there, the bug is in the model or the training loop, not the data scale. Third, inspect the loop: is the optimizer stepping the right parameters, are gradients zeroed each step, is the loss function matched to the output — for example, applying softmax before a cross-entropy loss that expects logits — and is any parameter accidentally frozen? Fourth, check gradient norms per layer for vanishing or exploding values and look for dead ReLUs. Fifth, sweep the learning rate across orders of magnitude, since a rate that is too high or too low can both produce a flat curve. I'd fix the random seed so each experiment is comparable.",
    weakAnswer: "I'd try changing the learning rate and maybe use a bigger model.",
    explanation:
      "Strong candidates debug systematically, and the overfit-one-batch test is the key move: it isolates code bugs from optimization issues.",
    tip: "Name the overfit-a-single-batch technique explicitly; experienced interviewers listen for it.",
    tags: ["debugging", "deep-learning", "training"],
  },
  {
    slug: "batchnorm-vs-layernorm",
    category: "MACHINE_LEARNING",
    roleTargets: [ML, AI],
    difficulty: "MEDIUM",
    question: "What is the difference between batch normalization and layer normalization, and why do transformers use layer norm?",
    sampleAnswer:
      "Both normalize activations to stabilize and speed up training, but along different axes. Batch normalization computes the mean and variance of each feature across the batch, so its behavior depends on batch statistics: it needs reasonably large batches, keeps running averages for inference, and is awkward with variable-length sequences and padding. Layer normalization computes statistics across the features of a single example, so it is independent of batch size and behaves identically in training and inference. Transformers use layer norm because sequences vary in length, batch sizes during decoding can be one, and per-token normalization fits the architecture. Modern LLMs typically use pre-norm placement for more stable training of deep stacks, and often RMSNorm, which drops the mean-centering step for a small speed gain with similar quality.",
    weakAnswer: "Batch norm normalizes the batch and layer norm normalizes the layer. Transformers use layer norm because it works better.",
    explanation:
      "The strong answer identifies the normalization axis, the practical consequences of depending on batch statistics, and modern variants used in LLMs.",
    tip: "Mention pre-norm versus post-norm; it is a frequent follow-up for LLM-focused roles.",
    tags: ["normalization", "transformers", "deep-learning"],
  },

  // ─── MLOps ──────────────────────────────────────────────────────────────────
  {
    slug: "training-serving-skew",
    category: "MLOPS",
    roleTargets: [ML, AI],
    difficulty: "MEDIUM",
    question: "What is training-serving skew and how do you prevent it?",
    sampleAnswer:
      "Training-serving skew is any difference between the data or logic a model saw in training and what it sees in production. It usually comes from features computed by two separate code paths — a batch SQL pipeline for training and a service for real-time inference — that drift apart, from data that is available at training time but not at prediction time, or from preprocessing such as tokenizers and vocabularies being versioned differently. Prevention: compute features once and share the definition, typically through a feature store or a shared transformation library; package preprocessing with the model artifact; build training sets from logged serving features where possible, so training sees exactly what production saw; and enforce point-in-time correct joins. Detection: compare feature distributions between training data and live traffic, and replay a sample of production requests through the offline pipeline to check for identical outputs.",
    weakAnswer: "It is when the production data is different from the training data. You fix it by retraining often.",
    explanation:
      "Skew is mostly an engineering problem of duplicated logic, not just data drift. The strong answer identifies its causes and gives concrete prevention and detection mechanisms.",
    tip: "Contrast skew (pipeline mismatch) with drift (the world changing); interviewers often check that you can tell them apart.",
    tags: ["feature-store", "skew", "production-ml"],
  },
  {
    slug: "monitoring-model-drift",
    category: "MLOPS",
    roleTargets: [ML, AI, DS],
    difficulty: "MEDIUM",
    question: "How would you monitor a deployed model and decide when it needs retraining?",
    sampleAnswer:
      "I monitor at three layers. Service health: latency, error rate and throughput, like any API. Data: input feature distributions compared with a training reference using population stability index or KL divergence, null rates and schema violations, plus the distribution of the model's own predictions, which often moves first. Outcomes: once ground-truth labels arrive, the actual business and model metrics such as precision or conversion, sliced by important segments. Because labels are often delayed, prediction drift serves as a leading indicator and outcome metrics confirm the problem. Retraining is triggered either on a schedule matched to how fast the domain changes or by alerts when drift or performance crosses thresholds, and any retrained model must beat the incumbent on a recent holdout and pass a shadow or canary phase before it takes full traffic.",
    weakAnswer: "I would check the accuracy every week and retrain if it goes down.",
    explanation:
      "Accuracy is often unavailable in real time. The strong answer layers service, data and outcome monitoring and defines safe retraining and promotion.",
    tip: "Mention delayed labels explicitly; it is the practical challenge that makes model monitoring hard.",
    tags: ["monitoring", "drift", "retraining"],
  },
  {
    slug: "safe-model-rollout",
    category: "MLOPS",
    roleTargets: [ML, AI],
    difficulty: "MEDIUM",
    question: "Describe how you would roll out a new model version to production safely.",
    sampleAnswer:
      "Before rollout the candidate must pass offline gates: better or non-inferior on a recent holdout, no regressions on critical slices, and acceptable latency and memory in a production-like load test. Then shadow deployment: the new model receives a copy of live traffic and its predictions are logged but not used, which validates feature pipelines and lets me compare outputs at scale. Next a canary with one to five percent of traffic, watching guardrail metrics — errors, latency, business KPIs — with automatic rollback if they breach thresholds. If the change affects user-facing outcomes, I would run a proper A/B test for statistical evidence before ramping to 100 percent. Throughout, model artifacts are versioned in a registry along with their training data snapshot and config, so rollback is a configuration change rather than a rebuild.",
    weakAnswer: "Test it on the validation set, then deploy it and monitor for errors.",
    explanation:
      "The strong answer layers offline gates, shadow, canary and A/B testing with automated rollback, which is how mature teams avoid silent regressions.",
    tip: "Explain what each stage protects against; it shows you understand the risks, not just the vocabulary.",
    tags: ["deployment", "canary", "shadow", "model-registry"],
  },
  {
    slug: "distributed-training-parallelism",
    category: "MLOPS",
    roleTargets: [ML, AI],
    difficulty: "HARD",
    question: "Explain data, tensor and pipeline parallelism. How would you train a model that doesn't fit on one GPU?",
    sampleAnswer:
      "Data parallelism replicates the model on every GPU, splits the batch, and averages gradients with an all-reduce; it scales throughput but requires the full model, gradients and optimizer state to fit on each device. When they don't fit, sharded data parallelism such as ZeRO or FSDP partitions parameters, gradients and optimizer states across GPUs and gathers parameters just in time for each layer, trading communication for memory. Tensor parallelism splits individual matrix multiplications across GPUs; it needs very high-bandwidth interconnect, so it is usually kept within a node. Pipeline parallelism assigns groups of layers to different GPUs and streams micro-batches through them, with scheduling to reduce idle bubbles. For a model that doesn't fit on one GPU I would first try FSDP plus mixed precision and activation checkpointing; for very large models I would combine tensor parallelism within nodes, pipeline parallelism across nodes and data parallelism on top — 3D parallelism — tuning to keep communication off the critical path.",
    weakAnswer: "You split the data across GPUs. If the model is too big, you split the model across GPUs too.",
    explanation:
      "The strong answer explains what each strategy partitions, its communication cost and memory profile, and how they combine in practice.",
    tip: "Mention optimizer state memory — with Adam it can be several times the model weights — because it is why sharding matters.",
    tags: ["distributed-training", "fsdp", "parallelism", "gpu"],
  },
  {
    slug: "reproducible-ml-pipelines",
    category: "MLOPS",
    roleTargets: [ML, AI, DS],
    difficulty: "MEDIUM",
    question: "How do you make model training reproducible across a team?",
    sampleAnswer:
      "Reproducibility needs the same code, data, configuration and environment. Code is versioned in git, and every training run records the commit hash. Data is versioned through immutable snapshots or a tool such as DVC or lakeFS, with the dataset version logged per run. Configuration lives in files rather than notebooks or command-line flags typed by hand, and the full resolved config is saved with the run. The environment is pinned with a lockfile and a container image. Randomness is controlled with seeds, accepting that GPU non-determinism can still cause small differences unless deterministic kernels are enabled. All of this is captured automatically by an experiment tracker such as MLflow or Weights and Biases, and models are promoted through a registry that links each artifact back to its run, so any production model can be traced and retrained from scratch.",
    weakAnswer: "Use the same random seed and save the notebook.",
    explanation:
      "Seeds are a small part of reproducibility. The strong answer covers all four dimensions and automates capture so it does not rely on discipline.",
    tip: "Mention lineage from a production model back to code, data and config; it connects reproducibility to incident response.",
    tags: ["reproducibility", "experiment-tracking", "versioning"],
  },
  {
    slug: "gpu-underutilization",
    category: "MLOPS",
    roleTargets: [ML, AI],
    difficulty: "HARD",
    question: "A training job shows 35 percent GPU utilization. How do you find and fix the bottleneck?",
    sampleAnswer:
      "Low utilization usually means the GPU is waiting on something. I'd profile one training step with the framework profiler and Nsight Systems to see the timeline. The most common culprit is the input pipeline: data loading, decoding or augmentation on too few CPU workers. Fixes include more dataloader workers, pinned memory, prefetching, moving augmentation to the GPU, and storing data in a pre-processed, sequentially readable format rather than many small files. Second, host-device synchronization — calling item() or printing metrics every step forces the CPU to wait for the GPU — so I'd log less often. Third, kernels that are too small: increase batch size, enable mixed precision, and use fused or compiled kernels through torch.compile. In multi-GPU jobs I'd check whether gradient all-reduce overlaps with backward computation and whether the interconnect is saturated. I'd fix one bottleneck at a time and re-measure throughput in samples per second, since utilization alone can mislead.",
    weakAnswer: "Increase the batch size so the GPU has more work to do.",
    explanation:
      "Batch size can help but often isn't the cause. The strong answer profiles first, lists the usual bottlenecks in order of likelihood, and measures the right metric.",
    tip: "Say \"profile before optimizing\" and name a tool; it signals real hands-on experience.",
    tags: ["performance", "gpu", "profiling", "data-loading"],
  },
  {
    slug: "design-recommendation-pipeline",
    category: "MLOPS",
    roleTargets: [ML, DS],
    difficulty: "HARD",
    question: "Design the ML system behind a 'recommended for you' feed serving 50 million users.",
    sampleAnswer:
      "I'd use the standard multi-stage funnel because scoring millions of items per request is infeasible. Candidate generation retrieves a few thousand items from several sources — a two-tower embedding model with approximate nearest neighbor search, collaborative-filtering co-occurrence, and trending or fresh items — to balance relevance and discovery. A ranking model, typically gradient-boosted trees or a deep model over user, item and context features, scores those candidates for a target such as long-term engagement rather than raw clicks. A final re-ranking layer applies business rules, diversity, freshness and de-duplication. Offline, training data comes from impression and engagement logs with careful negative sampling and position-bias correction; features are served from an online feature store with point-in-time correctness. Item embeddings and indexes refresh in batch, while user features update in near real time. Success is measured online through A/B tests on retention and session depth, with guardrails for content diversity and creator coverage, since offline ranking metrics correlate only loosely with business outcomes.",
    weakAnswer: "Train a collaborative filtering model on user ratings and show the top predicted items.",
    explanation:
      "The strong answer addresses scale with retrieval and ranking stages, data and feedback-loop issues such as position bias, and online evaluation, which is what ML system design interviews look for.",
    tip: "Choose the optimization target deliberately and say why; optimizing clicks is a classic trap.",
    tags: ["recommendations", "ml-system-design", "ranking", "retrieval"],
  },
];
