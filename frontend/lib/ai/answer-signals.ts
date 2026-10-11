/**
 * Reads what a candidate's answer is doing so the interviewer can react like a
 * person would: coach when they're stuck, dig into a project they mention,
 * encourage when they're brief. Pure functions — shared by the model prompt
 * (as hints) and the offline interviewer.
 */

export interface AnswerSignals {
  wordCount: number;
  /** "I don't know", "not sure", "haven't studied this"… */
  dontKnow: boolean;
  /** "Can you give me a hint / explain / some insight…" */
  asksForHelp: boolean;
  /** Talks about something they built or worked on. */
  mentionsProject: boolean;
  /** Technologies named in the answer, most specific first. */
  technologies: TechFollowUp[];
  /** Apologies, nerves or heavy hedging. */
  seemsNervous: boolean;
  /** "Do you want to hear about my project?", "Shall I explain?" — the interviewer should say yes. */
  offersToElaborate: boolean;
  /** What their project is about, when they say it ("a project on fake news detection"). */
  projectTopic: string | null;
}

const DONT_KNOW =
  /\b(i\s*(do\s*n[o']?t|dont|really\s+don'?t)\s+(really\s+)?(know|remember|have\s+(any\s+)?(idea|clue))|no\s+idea|not\s+(really\s+)?sure|i'?m\s+not\s+familiar|never\s+(heard|worked|used|studied)|have\s*n[o']?t\s+(studied|learned|learnt|worked|used|covered|prepared)|not\s+aware|i\s+can'?t\s+(answer|recall|remember)|no\s+clue|pass\s+on\s+this|skip\s+(this|it))\b/i;
const ASKS_FOR_HELP =
  /\b(can|could|would)\s+you\s+(please\s+)?(give|share|provide|explain|tell|help|walk)|\b(a\s+)?(hint|clue|insight|insights|explanation)\b|\bwhat\s+does\s+.{1,40}\s+mean\b/i;
const PROJECT =
  /\b(my|our|a|the)\s+(final[-\s]year\s+|capstone\s+|side\s+|personal\s+|college\s+|internship\s+)?(project|app|application|system|platform|tool|website|pipeline|model|startup|product)\b|\bi\s+(built|made|developed|created|designed|implemented|worked\s+on|deployed|trained|wrote)\b/i;
const NERVOUS = /\b(sorry|nervous|i\s+think\s+maybe|i\s+guess|not\s+confident|my\s+bad)\b/i;
const OFFER =
  /\b(do|would)\s+(you|u)\s+(want|wanna|like)\s+(me\s+)?(to\s+)?(hear|know|listen|explain|tell)|\b(shall|should|can|may|could)\s+i\s+(explain|tell|share|walk|talk|elaborate|describe|go\s+into)|\bif\s+(you|u)('re|\s+are|r)?\s+interested|\bwant\s+me\s+to\s+(explain|elaborate|go\s+(into|over)|tell|walk)|\bi('d|\s+would)\s+(like|love)\s+to\s+(explain|share|tell|talk|walk)/i;
const PROJECT_TOPIC =
  /\b(?:project|app|application|system|model|tool|website|chatbot|platform)\s+(?:on|based\s+on|about|for|called|named|around)\s+([a-z0-9][\w\s\-+.#/]{2,60}?)(?=[,.?!;]|\s+(?:and|which|where|using|with|so|but|that|in|for)\b|$)/i;

export interface TechFollowUp {
  key: string;
  name: string;
  match: RegExp;
  question: string;
  keyPoints: string[];
}

/**
 * Concepts an interviewer would naturally probe when a candidate mentions a
 * technology. Ordered roughly from most to least specific.
 */
export const TECH_FOLLOW_UPS: TechFollowUp[] = [
  { key: "rag", name: "retrieval-augmented generation", match: /\b(rag|retrieval[-\s]augmented)\b/i, question: "How did you decide on chunk size, and how did you measure whether retrieval was actually returning the right passages?", keyPoints: ["Chunking trade-off: small chunks are precise, large chunks keep context", "Measure retrieval separately with recall@k on a labelled question set", "Hybrid search (BM25 + embeddings) and a reranker usually beat pure vector search", "Check answer faithfulness: is every claim supported by the retrieved text?"] },
  { key: "vector-db", name: "a vector database", match: /\b(vector\s*(db|database|store)|pinecone|weaviate|qdrant|milvus|chroma(db)?|faiss|pgvector)\b/i, question: "What similarity metric and index type did the vector store use, and what happens to latency and recall as the collection grows?", keyPoints: ["Cosine vs dot product vs Euclidean, and normalising embeddings", "Approximate nearest neighbour indexes such as HNSW and IVF trade recall for speed", "Metadata filtering and access control at query time", "Re-embedding cost when the embedding model changes"] },
  { key: "fine-tuning", name: "fine-tuning", match: /\b(fine[-\s]?tun(e|ed|ing)|lora|qlora|peft)\b/i, question: "Why did fine-tuning make more sense than prompting or retrieval there, and how did you know the fine-tuned model was actually better?", keyPoints: ["Fine-tune for behaviour and format; retrieve for knowledge", "LoRA trains small adapter matrices instead of all weights", "Hold out an evaluation set and compare against a prompted baseline", "Watch for overfitting and catastrophic forgetting"] },
  { key: "llm", name: "LLMs", match: /\b(llm|gpt[-\s]?\d?|chatgpt|gemini|claude|llama|mistral|openai|langchain|llamaindex|prompt(s|ing)?)\b/i, question: "How did you evaluate the quality of the model's outputs, and what did you do about hallucinations?", keyPoints: ["Build a small golden test set before changing prompts", "Ground answers in retrieved context and ask for citations", "Use structured output with schema validation where possible", "Track cost and latency per request, not just quality"] },
  { key: "transformer", name: "transformers", match: /\b(transformer|attention|bert|encoder|decoder)\b/i, question: "Can you explain how self-attention works in that model and why it scales quadratically with sequence length?", keyPoints: ["Queries, keys and values; attention = softmax(QKᵀ/√d)·V", "Every token attends to every other token, so cost grows with n²", "Multi-head attention learns different relationships in parallel", "Positional encodings give the model word order"] },
  { key: "cnn", name: "a CNN", match: /\b(cnn|convolution(al)?|resnet|yolo|image\s+classif|object\s+detection|computer\s+vision|opencv)\b/i, question: "How did you handle class imbalance or limited training data in that vision project, and which metric did you report?", keyPoints: ["Data augmentation and transfer learning from pretrained weights", "Precision, recall and F1 or mAP rather than plain accuracy", "Weighted loss or resampling for imbalanced classes", "Check for leakage between train and test images"] },
  { key: "recommendation", name: "a recommender system", match: /\b(recommend(ation|er)s?|collaborative\s+filtering|matrix\s+factori[sz]ation)\b/i, question: "How did you deal with the cold-start problem for new users or items, and how would you evaluate the recommendations offline and online?", keyPoints: ["Cold start: content-based features or popularity fallback", "Offline metrics: precision@k, recall@k, NDCG", "Online: A/B test click-through, conversion and long-term retention", "Beware feedback loops that only show already-popular items"] },
  { key: "model-metrics", name: "model accuracy", match: /\b(accuracy|precision|recall|f1|auc|roc|confusion\s+matrix)\b/i, question: "Why was that the right metric for the problem, and what would the business cost of a false positive versus a false negative be?", keyPoints: ["Accuracy misleads on imbalanced data", "Precision when false positives are expensive, recall when misses are", "Pick the decision threshold from the cost trade-off", "Report a confidence interval or variation across folds"] },
  { key: "overfitting", name: "model training", match: /\b(train(ed|ing)\s+(a|the|my)?\s*model|neural\s+network|deep\s+learning|xgboost|random\s+forest|scikit|sklearn|tensorflow|pytorch|keras)\b/i, question: "How did you check the model wasn't overfitting, and what did you do when validation performance stopped improving?", keyPoints: ["Separate train, validation and test sets; never tune on test", "Regularisation, dropout, early stopping, more data", "Learning curves show bias versus variance", "Cross-validation for small datasets"] },
  { key: "mlops", name: "model deployment", match: /\b(mlops|mlflow|kubeflow|sagemaker|vertex\s*ai|model\s+(deploy|serving|registry|monitoring)|drift)\b/i, question: "Once the model was in production, how did you detect that its performance was degrading?", keyPoints: ["Monitor input data drift and prediction drift", "Delayed labels: use proxy metrics until ground truth arrives", "Version data, code and model together for reproducibility", "Shadow or canary deployments before full rollout"] },
  { key: "kafka", name: "Kafka", match: /\b(kafka|rabbitmq|pub\/?sub|message\s+(queue|broker)|event[-\s]driven|sqs|kinesis)\b/i, question: "What delivery guarantee did you rely on, and how did consumers handle a message being delivered twice?", keyPoints: ["At-most-once, at-least-once and effectively-once delivery", "Idempotent consumers using a unique message key", "Partitions give ordering only within a partition", "Dead-letter queues for poison messages"] },
  { key: "redis", name: "caching", match: /\b(redis|memcached|cach(e|ing|ed))\b/i, question: "How did you keep the cache consistent with the database, and what happened when a popular key expired?", keyPoints: ["Cache-aside, write-through and write-behind patterns", "TTLs plus explicit invalidation on writes", "Cache stampede: request coalescing or jittered expiry", "Measure hit rate; a cache with a low hit rate only adds latency"] },
  { key: "microservices", name: "microservices", match: /\b(micro[-\s]?services?|service\s+mesh|api\s+gateway|grpc)\b/i, question: "How did the services communicate, and how did you handle one of them being slow or down?", keyPoints: ["Synchronous calls versus asynchronous events", "Timeouts, retries with backoff and circuit breakers", "Each service owns its data; avoid a shared database", "Distributed tracing to debug requests across services"] },
  { key: "kubernetes", name: "Kubernetes", match: /\b(kubernetes|k8s|helm|eks|gke|aks)\b/i, question: "How did you configure health checks and scaling for the service on Kubernetes?", keyPoints: ["Liveness versus readiness probes", "Horizontal Pod Autoscaler on CPU or custom metrics", "Resource requests and limits prevent noisy neighbours", "Rolling updates and rollbacks"] },
  { key: "docker", name: "Docker", match: /\b(docker|container(s|ized)?|dockerfile)\b/i, question: "What did containerising the app solve for you, and how did you keep the image small and secure?", keyPoints: ["Same environment in dev, CI and production", "Multi-stage builds keep images small", "Don't run as root; pin base image versions", "Layer caching speeds up builds"] },
  { key: "cloud", name: "the cloud setup", match: /\b(aws|azure|gcp|google\s+cloud|lambda|serverless|ec2|s3|cloud\s+run|firebase)\b/i, question: "How did the architecture handle a sudden spike in traffic, and roughly what did it cost to run?", keyPoints: ["Auto-scaling and stateless services", "Managed services trade control for less operations work", "Cold starts in serverless functions", "Know your main cost drivers: compute, storage, egress"] },
  { key: "sql", name: "the database", match: /\b(sql|postgres(ql)?|mysql|database|schema|query|queries|index(es|ing)?|orm|prisma)\b/i, question: "How did you design the schema, and how did you find and fix a slow query?", keyPoints: ["Normalise first, denormalise deliberately for reads", "Indexes speed reads but slow writes; use EXPLAIN to verify", "Transactions and isolation levels", "N+1 query problem with ORMs"] },
  { key: "nosql", name: "a NoSQL database", match: /\b(mongo(db)?|dynamo(db)?|cassandra|nosql|firestore|couchbase)\b/i, question: "Why did a NoSQL store fit better than a relational one, and how did you model the data around your queries?", keyPoints: ["Model documents around access patterns", "Partition key choice drives scalability", "Eventual consistency and its user-visible effects", "Joins and transactions are limited or costly"] },
  { key: "api", name: "the API", match: /\b(rest(ful)?\s*api|api(s)?|endpoint(s)?|graphql|express|fastapi|flask|django|spring\s*boot|node(\.js)?)\b/i, question: "How did you handle authentication, validation and errors in that API?", keyPoints: ["Validate input at the boundary and return clear status codes", "Token-based auth (e.g. JWT) and authorisation per resource", "Idempotency for retried requests", "Rate limiting and pagination"] },
  { key: "react", name: "React", match: /\b(react|next(\.js)?|redux|hooks|frontend|vue|angular|svelte)\b/i, question: "How did you manage state in that app, and what did you do when a page started re-rendering too much?", keyPoints: ["Local state versus shared state versus server state", "Memoisation, stable keys and splitting components", "Measure with the React profiler before optimising", "Server rendering and code splitting for load time"] },
  { key: "auth", name: "authentication", match: /\b(auth(entication)?|login|oauth|jwt|session(s)?|password(s)?)\b/i, question: "How did you store credentials and sessions securely, and how did you protect against common attacks?", keyPoints: ["Hash passwords with bcrypt or argon2, never encrypt them", "Short-lived tokens and secure, HTTP-only cookies", "CSRF, XSS and injection basics", "Least privilege for every role"] },
  { key: "realtime", name: "real-time features", match: /\b(websocket(s)?|socket\.io|real[-\s]?time|webrtc|live\s+(chat|updates))\b/i, question: "How did you keep real-time connections reliable when users dropped and reconnected?", keyPoints: ["WebSockets versus server-sent events versus polling", "Reconnection with backoff and resuming from the last event", "Scaling connections across servers with a pub/sub layer", "Ordering and duplicate messages"] },
  { key: "data-pipeline", name: "the data pipeline", match: /\b(etl|elt|airflow|spark|pandas|data\s+pipeline|dbt|data\s+warehouse|bigquery|snowflake)\b/i, question: "How did you make the pipeline reliable when bad or late data arrived?", keyPoints: ["Idempotent, re-runnable jobs", "Data quality checks: schema, nulls, ranges, row counts", "Late-arriving data and backfills", "Partitioning for performance and cost"] },
  { key: "ab-test", name: "the experiment", match: /\b(a\/b\s*test(ing)?|experiment(s|ation)?|hypothesis|p[-\s]?value|statistical(ly)?\s+significan)/i, question: "How did you decide the sample size, and how would you explain a p-value to a product manager?", keyPoints: ["Power analysis: effect size, variance, significance, power", "A p-value is the chance of data this extreme if there were no effect", "Don't stop early when results look good (peeking)", "Guardrail metrics and novelty effects"] },
  { key: "dashboard", name: "the dashboard", match: /\b(dashboard|tableau|power\s*bi|looker|visuali[sz]ation|metrics?)\b/i, question: "Which decision was that dashboard meant to drive, and how did you know people actually used it?", keyPoints: ["Start from the decision, then pick the metric", "Leading versus lagging indicators", "Define metrics precisely so teams agree", "Measure adoption and act on stale dashboards"] },
  { key: "testing", name: "testing", match: /\b(unit\s+test(s|ing)?|integration\s+test|jest|pytest|tdd|test\s+coverage|ci\/?cd|github\s+actions|pipeline)\b/i, question: "What did your tests actually protect against, and how did they run in your CI pipeline?", keyPoints: ["Test pyramid: many unit, fewer integration, few end-to-end", "Test behaviour, not implementation details", "Fast, deterministic tests run on every pull request", "Coverage is a signal, not a goal"] },
  { key: "scaling", name: "scaling", match: /\b(scal(e|ed|ing|ability)|load\s+balanc(er|ing)|high\s+traffic|million(s)?\s+(of\s+)?users|latency|throughput)\b/i, question: "What was the bottleneck when you scaled it, and how did you find it?", keyPoints: ["Measure first: profiling, metrics, traces", "Horizontal scaling needs stateless services", "Database is usually the first bottleneck: indexes, replicas, caching", "Know p50 versus p95/p99 latency"] },
  { key: "dsa", name: "the algorithm", match: /\b(algorithm|complexity|big[-\s]?o|graph|tree|hash\s*map|dynamic\s+programming|binary\s+search|sorting)\b/i, question: "What was the time and space complexity of your approach, and could you have done better?", keyPoints: ["State complexity in Big-O for time and space", "Hash maps trade memory for O(1) lookups", "Recognise patterns: two pointers, BFS/DFS, DP", "Discuss edge cases: empty input, duplicates, very large n"] },
];

const HELP_WORDS = /\b(i\s+(do\s*n[o']?t|dont)\s+know|no\s+idea|not\s+sure)\b/gi;

export function readAnswer(answer: string): AnswerSignals {
  const text = answer.trim();
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const dontKnow = DONT_KNOW.test(text);
  // A long answer that merely says "not sure" once is still an attempt.
  const substantive = wordCount - (text.match(HELP_WORDS)?.length ?? 0) * 4;
  const technologies = TECH_FOLLOW_UPS.filter((t) => t.match.test(text));
  const offersToElaborate = OFFER.test(text);
  const topic = PROJECT_TOPIC.exec(text)?.[1]?.trim().replace(/\s+/g, " ") ?? null;
  return {
    wordCount,
    // An offer to explain is the opposite of being stuck.
    dontKnow: dontKnow && substantive < 45 && !offersToElaborate,
    asksForHelp: ASKS_FOR_HELP.test(text) && wordCount < 60 && !offersToElaborate,
    mentionsProject: PROJECT.test(text) && (wordCount >= 12 || offersToElaborate),
    technologies,
    seemsNervous: NERVOUS.test(text) || (wordCount > 0 && wordCount < 12 && !offersToElaborate),
    offersToElaborate,
    projectTopic: topic && topic.split(" ").length <= 8 ? topic : null,
  };
}

export function describeSignals(s: AnswerSignals): string {
  const parts: string[] = [];
  if (s.offersToElaborate) parts.push("the candidate OFFERED to explain more (for example their project) and is waiting for you to say yes");
  if (s.dontKnow) parts.push("the candidate said they don't know this");
  if (s.asksForHelp) parts.push("the candidate asked for a hint or explanation");
  if (s.mentionsProject) parts.push(`the candidate described their own project${s.projectTopic ? ` (${s.projectTopic})` : ""}${s.technologies.length ? ` using ${s.technologies.slice(0, 3).map((t) => t.name).join(", ")}` : ""}`);
  if (s.seemsNervous) parts.push("the candidate sounds unsure or brief");
  if (!parts.length) parts.push(`a normal attempt of about ${s.wordCount} words`);
  return parts.join("; ");
}
