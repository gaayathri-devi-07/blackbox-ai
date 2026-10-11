import type { SeedQuestion } from "./types";

const AI = "AI_ENGINEER" as const;
const ML = "ML_ENGINEER" as const;
const BE = "BACKEND_ARCHITECT" as const;
const FS = "FULL_STACK_DEVELOPER" as const;

/** System Design, Data Structures & Algorithms, Backend and Frontend Engineering. */
export const ENGINEERING_QUESTIONS: SeedQuestion[] = [
  // ─── System Design ──────────────────────────────────────────────────────────
  {
    slug: "design-rate-limiter",
    category: "SYSTEM_DESIGN",
    roleTargets: [BE, FS],
    difficulty: "MEDIUM",
    question: "Design a distributed rate limiter for a public API.",
    sampleAnswer:
      "I'd clarify the policy first: limits per API key, per user or per IP; a few hundred thousand requests per second across many gateway instances; and whether slight over-admission is acceptable. Algorithm: a token bucket per key allows controlled bursts and is cheap to store — a token count and last-refill timestamp. Sliding-window counters are an alternative when burst behavior must be stricter. Because gateways are horizontally scaled, state must be shared, so I'd keep buckets in Redis and perform refill-and-decrement atomically in a Lua script to avoid race conditions between read and write. To cut latency and Redis load, each gateway can hold a small local allowance and sync in batches, accepting bounded over-admission. Rejected requests return 429 with Retry-After and rate-limit headers. For resilience, if Redis is unavailable I would fail open for authenticated traffic with a conservative local limit rather than take the API down, and I'd shard keys across a Redis cluster to scale.",
    weakAnswer: "Count the requests per user in a database and reject them once they pass the limit.",
    explanation:
      "The strong answer picks an algorithm deliberately, handles atomicity across distributed gateways, and covers failure modes — the core of the problem.",
    tip: "State whether you fail open or closed when the limiter's store is down, and why; interviewers usually ask.",
    tags: ["rate-limiting", "redis", "token-bucket", "api-gateway"],
  },
  {
    slug: "design-news-feed",
    category: "SYSTEM_DESIGN",
    roleTargets: [BE, FS],
    difficulty: "HARD",
    question: "Design the home feed for a social network with 300 million daily active users.",
    sampleAnswer:
      "Core requirements: fast feed reads (p99 under 200 ms), posts appearing within seconds, and reads vastly outnumbering writes. The key decision is fan-out. Fan-out on write pushes each new post ID into followers' precomputed feed lists in a cache like Redis, making reads cheap; it breaks down for accounts with millions of followers. Fan-out on read assembles the feed at request time from followed accounts, which is expensive for users who follow many people. I'd use a hybrid: fan-out on write for normal accounts, and merge posts from high-follower accounts at read time. Posts live in a sharded store keyed by post ID, the social graph in its own service, and media on object storage behind a CDN. Feed lists store only IDs; the read path hydrates them with batched lookups from a post cache. Ranking can run as a separate service over a candidate set. A message queue decouples posting from fan-out workers so write spikes don't affect the poster, and pagination uses cursors rather than offsets.",
    weakAnswer: "When a user opens the app, query all the posts from the people they follow, sort by time and return them.",
    explanation:
      "The weak answer works for a few thousand users. The strong answer identifies the fan-out trade-off, handles celebrity accounts, and separates storage, caching and async processing.",
    tip: "Name the celebrity problem explicitly; handling skewed follower counts is what most interviewers are waiting for.",
    tags: ["fan-out", "caching", "feeds", "scalability"],
  },
  {
    slug: "design-chat-system",
    category: "SYSTEM_DESIGN",
    roleTargets: [BE, FS],
    difficulty: "HARD",
    question: "Design a real-time chat system supporting one-to-one and group conversations.",
    sampleAnswer:
      "Clients hold persistent WebSocket connections to a fleet of stateless gateway servers, and a presence service records which gateway each user is connected to. When a message is sent, the chat service assigns a per-conversation sequence number, persists it, then routes it to recipients' gateways through a pub/sub layer; offline recipients get push notifications. Storage suits a wide-column store such as Cassandra partitioned by conversation ID and clustered by sequence number, which makes loading recent history a single-partition read. Delivery is at-least-once with client-generated message IDs for idempotency, so retries never create duplicates, and clients acknowledge the highest sequence received so they can fetch gaps after reconnecting. Ordering is guaranteed per conversation, not globally. For large groups I'd fan out through the pub/sub topic per conversation rather than per member. Read receipts and typing indicators are ephemeral and go over the same channel without durable storage.",
    weakAnswer: "Clients poll the server every second for new messages, which are stored in a SQL table.",
    explanation:
      "Polling doesn't scale and gives poor latency. The strong answer covers connection management, ordering, idempotent delivery, offline handling and a storage layout matched to access patterns.",
    tip: "Discuss ordering guarantees per conversation; it shows you understand that global ordering is unnecessary and expensive.",
    tags: ["websockets", "messaging", "ordering", "idempotency"],
  },
  {
    slug: "consistency-tradeoffs-cap",
    category: "SYSTEM_DESIGN",
    roleTargets: [BE],
    difficulty: "MEDIUM",
    question: "Explain the CAP theorem and how consistency choices show up in real system design.",
    sampleAnswer:
      "CAP says that during a network partition a distributed system must choose between consistency — every read sees the latest write — and availability — every request gets a non-error response. Since partitions can't be ruled out, the real choice is how the system behaves when one happens. PACELC adds the everyday trade-off: even without partitions, you trade latency against consistency. In practice I choose per use case rather than per system. Account balances, inventory reservations and uniqueness constraints need strong consistency, so I use a single-leader or consensus-based store and accept higher latency or unavailability during failures. Social counters, feeds and recommendations tolerate eventual consistency, so I can use asynchronous replication and caches. Patterns such as read-your-writes, routing a user's reads to the leader after they write, give a good experience without paying for global strong consistency.",
    weakAnswer: "CAP means you can only have two of consistency, availability and partition tolerance, so you pick two.",
    explanation:
      "The 'pick two' framing is a common oversimplification. The strong answer explains the partition-time choice, adds latency trade-offs, and maps consistency needs to concrete features.",
    tip: "Give an example of a session guarantee like read-your-writes; it shows nuance beyond strong versus eventual.",
    tags: ["cap", "consistency", "distributed-systems"],
  },
  {
    slug: "caching-strategies",
    category: "SYSTEM_DESIGN",
    roleTargets: [BE, FS, AI],
    difficulty: "MEDIUM",
    question: "Walk me through caching strategies and the problems caches introduce.",
    sampleAnswer:
      "The common patterns are cache-aside, where the application reads the cache, falls back to the database on a miss and populates it; write-through, which writes the cache and database together so the cache is never stale; and write-behind, which writes the cache first and persists asynchronously for speed at the risk of data loss. Cache-aside with a TTL is the default for read-heavy data. The hard problems are invalidation, deciding when cached data is stale, which I handle with TTLs plus explicit deletes on writes, or change-data-capture events for cross-service caches; stampedes, when a hot key expires and thousands of requests hit the database at once, mitigated with request coalescing, early probabilistic refresh, or locks; hot keys overloading a single cache node, solved with replication or local in-process caches; and cold starts after deploys. I'd also cache negative results briefly to stop repeated lookups for missing keys, and monitor hit ratio and eviction rate.",
    weakAnswer: "Put Redis in front of the database to make reads faster.",
    explanation:
      "The strong answer compares patterns by consistency and durability, then addresses the operational failure modes that make caching hard.",
    tip: "Mention cache stampedes by name; it is one of the most common follow-up questions.",
    tags: ["caching", "redis", "invalidation"],
  },
  {
    slug: "design-job-scheduler",
    category: "SYSTEM_DESIGN",
    roleTargets: [BE],
    difficulty: "HARD",
    question: "Design a distributed job scheduler that runs millions of scheduled and recurring tasks reliably.",
    sampleAnswer:
      "Requirements: at-least-once execution, no lost jobs during failures, minimal duplicate runs, and horizontal scale. Job definitions and their next-run times live in a durable store partitioned by time bucket or shard. Scheduler nodes each own a set of partitions, assigned via leases in a coordination service such as etcd or a database row lock, so exactly one node is polling each partition at a time; if a node dies, its lease expires and another takes over. Due jobs are claimed with an atomic compare-and-set from scheduled to queued and pushed onto a work queue, then executed by a separate worker pool so scheduling and execution scale independently. Workers send heartbeats; jobs whose heartbeat stops are requeued after a visibility timeout. Because duplicates remain possible, jobs carry an idempotency key and handlers must be idempotent. Retries use exponential backoff with a dead-letter queue, recurring jobs compute their next run only after a successful claim, and metrics cover schedule lag, the gap between due time and start time.",
    weakAnswer: "Use cron on a server and store the jobs in a database.",
    explanation:
      "A single cron host is a single point of failure. The strong answer covers partition ownership, atomic claiming, worker failure detection, idempotency and retry semantics.",
    tip: "Admit that exactly-once execution is impractical and design for idempotency instead; that honesty scores well.",
    tags: ["scheduling", "leases", "queues", "reliability"],
  },
  {
    slug: "design-llm-serving-platform",
    category: "SYSTEM_DESIGN",
    roleTargets: [AI, BE, ML],
    difficulty: "HARD",
    question: "Design an internal platform that lets product teams call several LLMs with quotas, observability and fallbacks.",
    sampleAnswer:
      "I'd build an LLM gateway as the single entry point. It exposes one provider-agnostic API, authenticates the calling service, and enforces per-team quotas and token budgets using a distributed rate limiter. A routing layer maps a logical model name such as 'fast-chat' to providers and versions, so teams aren't coupled to vendors, and it handles fallback: on timeouts or 5xx from one provider, retry with backoff and fail over to an equivalent model, with circuit breakers to avoid hammering a degraded provider. Streaming is supported end to end. Every request is logged with team, model, token counts, latency and cost, with prompts redacted or sampled according to data policy, feeding cost dashboards and chargeback. Shared services sit behind the gateway: response caching, PII redaction, safety filters and an evaluation hook teams can attach to sampled traffic. Self-hosted models run on a separate inference tier with autoscaling on queue depth. Configuration changes such as model upgrades roll out gradually with per-route canaries.",
    weakAnswer: "Give each team an API key for the LLM provider and let them call it directly.",
    explanation:
      "Direct provider access leads to uncontrolled cost, no failover and no visibility. The strong answer centralizes policy, routing, resilience and observability without slowing teams down.",
    tip: "Talk about cost attribution per team; platform interviews care about governance as much as throughput.",
    tags: ["llm-gateway", "platform", "observability", "resilience"],
  },
  {
    slug: "design-content-moderation-pipeline",
    category: "SYSTEM_DESIGN",
    roleTargets: [AI, ML],
    difficulty: "HARD",
    question: "Design a pipeline that moderates 20 million user posts a day using machine learning models.",
    sampleAnswer:
      "I'd clarify policy categories, latency needs — must a post be checked before it is visible, or can it be removed after — and the acceptable error trade-off per category, since missing child-safety content is far worse than over-flagging spam. Architecture: a synchronous path for high-severity categories runs fast classifiers, such as distilled text and image models plus hash matching against known-bad content, within the posting request and blocks only on high-confidence violations. Everything else goes onto a queue for asynchronous review by larger, slower models, including an LLM for nuanced policy reasoning on the ambiguous middle band. Thresholds are set per category from precision-recall curves: auto-action above a high-confidence threshold, human review in the uncertain band, allow below it. Human decisions are logged as labels that feed retraining, with sampling of auto-allowed content to estimate what we miss. I'd monitor prevalence of violating content, reviewer queue depth and appeal overturn rates, shadow-test new models before promotion, and add rate limits and adversarial-pattern detection, because bad actors adapt to the classifier.",
    weakAnswer: "Run every post through a classifier and delete anything it flags.",
    explanation:
      "The strong answer balances latency and severity with sync and async paths, uses calibrated thresholds with a human-in-the-loop band, closes the labeling loop, and plans for adversarial adaptation.",
    tip: "Explain how you'd measure what the system misses — prevalence sampling — not just what it catches.",
    tags: ["ml-system-design", "moderation", "human-in-the-loop", "thresholds"],
  },
  {
    slug: "idempotent-payment-api",
    category: "SYSTEM_DESIGN",
    roleTargets: [BE, FS],
    difficulty: "HARD",
    question: "How would you make a payment API safe against retries and network failures?",
    sampleAnswer:
      "Clients will retry after timeouts, so the API must make retries harmless. Each create-payment request carries a client-generated idempotency key. The server stores the key with a hash of the request and the eventual response in a table with a unique constraint. On a new request it inserts the key in a pending state inside the same transaction that creates the payment record; a retry with the same key returns the stored response, a retry with a different payload under the same key is rejected, and a retry while the original is still pending gets a conflict response telling the client to try later. Calls to the external payment processor also use idempotency keys, and the payment record moves through an explicit state machine — created, authorized, captured, failed — so partial failures are resumable. A reconciliation job compares our records with the processor's ledger to catch anything stuck. Keys expire after a retention window such as 24 hours.",
    weakAnswer: "Check whether a payment with the same amount already exists for the user before creating a new one.",
    explanation:
      "Matching on amount causes false positives and races. The strong answer uses idempotency keys with database-enforced uniqueness, a state machine and reconciliation.",
    tip: "Mention reconciliation; real payment systems assume something will eventually go wrong and plan for it.",
    tags: ["idempotency", "payments", "reliability", "transactions"],
  },
  {
    slug: "database-sharding",
    category: "SYSTEM_DESIGN",
    roleTargets: [BE],
    difficulty: "HARD",
    question: "When and how would you shard a relational database?",
    sampleAnswer:
      "Sharding adds significant complexity, so I'd exhaust simpler options first: query and index optimization, read replicas for read-heavy load, caching, vertical scaling, and archiving cold data. I shard when write throughput or data size exceeds what a single primary can handle. The most important decision is the shard key: it should spread load evenly, and most queries should touch a single shard. A tenant ID or user ID is usually a good choice because it keeps related rows together. Hash-based sharding distributes evenly but makes range queries scatter; range-based sharding supports ranges but risks hotspots. I'd map keys to many virtual shards and those to physical nodes, so rebalancing moves virtual shards without rehashing everything. Costs to plan for include cross-shard queries and transactions, which require application-level aggregation or sagas, global uniqueness, which needs ID schemes such as Snowflake-style IDs, and resharding operations, which need dual writes or online migration tooling.",
    weakAnswer: "When the database gets slow, split the tables across several databases.",
    explanation:
      "The strong answer treats sharding as a last resort, centers on shard-key choice, and names the operational costs that come with it.",
    tip: "Always list the alternatives you'd try first; it signals judgment rather than enthusiasm for complexity.",
    tags: ["sharding", "databases", "scalability", "partitioning"],
  },

  // ─── Data Structures & Algorithms ───────────────────────────────────────────
  {
    slug: "hash-map-internals",
    category: "DATA_STRUCTURES",
    roleTargets: [BE, FS, ML],
    difficulty: "MEDIUM",
    question: "How does a hash map work internally, and what determines its performance?",
    sampleAnswer:
      "A hash map stores entries in an array of buckets. A hash function maps each key to an integer, reduced modulo the array size to choose a bucket. Collisions are resolved either by chaining, where each bucket holds a list or, as in Java 8+, a balanced tree once it grows, or by open addressing, where we probe other slots using linear probing or Robin Hood hashing. Average lookup, insert and delete are O(1), assuming a good hash function and a bounded load factor — the ratio of entries to buckets. When the load factor exceeds a threshold such as 0.75, the table resizes, typically doubling and rehashing everything; that single operation is O(n) but amortizes to O(1) per insert. Worst case degrades to O(n) when many keys collide, which attackers can exploit with crafted inputs, so languages use randomized or keyed hash functions. Keys must also have consistent equality and hashing, and mutable keys break the structure.",
    weakAnswer: "It stores key-value pairs and lookups are O(1).",
    explanation:
      "The strong answer explains hashing, collision handling, load factor and amortized resizing, and when the O(1) promise breaks.",
    tip: "Mention amortized analysis of resizing; it is the precise reason inserts are still O(1) on average.",
    tags: ["hashing", "complexity", "data-structures"],
  },
  {
    slug: "implement-lru-cache",
    category: "DATA_STRUCTURES",
    roleTargets: [BE, FS],
    difficulty: "MEDIUM",
    question: "Design an LRU cache with O(1) get and put operations.",
    sampleAnswer:
      "I'd combine a hash map with a doubly linked list. The map goes from key to list node for O(1) lookup; the list orders entries by recency, with the most recently used at the head and the least recently used at the tail. On get, look up the node; if present, unlink it and move it to the head — O(1) because the node holds prev and next pointers — then return its value. On put, if the key exists, update the value and move the node to the head; otherwise create a node, insert it at the head and add it to the map, and if the size exceeds capacity, remove the tail node and delete its key from the map. Sentinel head and tail nodes remove null-check edge cases. For a concurrent version I'd guard operations with a lock or use striped segments, and note that many languages offer this directly, such as LinkedHashMap with access order in Java or OrderedDict in Python.",
    weakAnswer: "Store items in a list and remove the oldest one when it's full.",
    explanation:
      "A plain list makes moving and removing O(n). The strong answer pairs a hash map with a doubly linked list and walks through each operation.",
    tip: "Mention sentinel nodes; they simplify the code and interviewers notice clean implementations.",
    tags: ["lru", "linked-list", "hash-map", "design"],
  },
  {
    slug: "sliding-window-longest-substring",
    category: "DATA_STRUCTURES",
    roleTargets: [BE, FS, ML],
    difficulty: "MEDIUM",
    question: "Find the length of the longest substring without repeating characters. Explain your approach and complexity.",
    sampleAnswer:
      "A brute force check of every substring is O(n squared) or worse, so I'd use a sliding window with two pointers. Maintain a window from left to right containing no duplicates, and a map from character to its most recent index. Move the right pointer through the string; for each character, if it was last seen at an index inside the current window, move left to one past that index — never backwards. Then record the window length, right minus left plus one, and update the character's last index. Each character is visited a constant number of times, so time is O(n) and space is O(k), where k is the alphabet size. I'd test the edge cases: an empty string, all identical characters, all unique characters, and a repeat that lies outside the current window, which is why left must use the maximum of its current value and the jump target.",
    weakAnswer: "Check every substring and keep the longest one that has unique characters.",
    explanation:
      "The strong answer recognizes the sliding-window pattern, justifies the O(n) bound and calls out the subtle bug of moving the left pointer backwards.",
    tip: "Name the pattern — sliding window — before coding; it shows you reason in reusable techniques.",
    tags: ["sliding-window", "two-pointers", "strings"],
  },
  {
    slug: "bfs-vs-dfs",
    category: "DATA_STRUCTURES",
    roleTargets: [BE, FS, ML],
    difficulty: "EASY",
    question: "When would you use breadth-first search versus depth-first search?",
    sampleAnswer:
      "Both visit every reachable node in O(V + E) time, but they explore in different orders. BFS uses a queue and explores level by level, so in an unweighted graph it finds the shortest path in number of edges — useful for minimum steps in a grid or degrees of separation in a social graph. Its memory is proportional to the widest level, which can be large. DFS uses a stack or recursion and goes as deep as possible before backtracking; it is natural for exhaustive search and backtracking problems, cycle detection, topological sorting and finding connected components, and uses memory proportional to depth, though recursion can overflow on deep graphs, so I'd switch to an explicit stack. For weighted shortest paths neither is correct: Dijkstra's algorithm with non-negative weights, or Bellman-Ford with negative weights.",
    weakAnswer: "BFS goes wide and DFS goes deep. Either works for most problems.",
    explanation:
      "The strong answer ties each traversal to the problems it solves best and covers memory characteristics and the weighted-graph caveat.",
    tip: "Mention that BFS gives shortest paths only for unweighted graphs; it's a common trap.",
    tags: ["graphs", "bfs", "dfs", "traversal"],
  },
  {
    slug: "top-k-with-heap",
    category: "DATA_STRUCTURES",
    roleTargets: [BE, ML, FS],
    difficulty: "MEDIUM",
    question: "How would you find the top K most frequent items in a stream of 10 billion events?",
    sampleAnswer:
      "On a single machine with enough memory for the distinct keys, I'd count frequencies with a hash map and then keep a min-heap of size K: for each key, push it, and if the heap exceeds K, pop the minimum. That is O(n log K) time, better than sorting all keys when K is small. At 10 billion events with potentially huge numbers of distinct keys, exact counting may not fit in memory. Then I'd either shard the stream by key hash so each worker owns a subset of keys, computes a local top K, and a final merge takes the top K of those — exact, because each key lives on exactly one shard — or use approximate structures: a Count-Min Sketch for frequency estimates combined with a heap of candidates, or the Space-Saving algorithm, which bounds error with fixed memory. For a sliding time window I'd keep counts per time bucket and expire old buckets.",
    weakAnswer: "Count everything in a hash map, sort by count and take the first K.",
    explanation:
      "The strong answer improves the single-machine approach with a bounded heap and then addresses scale with partitioning or probabilistic sketches.",
    tip: "Explain why sharding by key keeps the merged result exact; it shows you reason about correctness, not just speed.",
    tags: ["heap", "streaming", "count-min-sketch", "top-k"],
  },
  {
    slug: "dynamic-programming-approach",
    category: "DATA_STRUCTURES",
    roleTargets: [BE, FS],
    difficulty: "HARD",
    question: "How do you recognize and solve a dynamic programming problem? Use an example.",
    sampleAnswer:
      "Dynamic programming applies when a problem has optimal substructure — the answer is built from answers to smaller subproblems — and overlapping subproblems that a naive recursion would solve repeatedly. My process: define the state precisely, write the recurrence, set the base cases, choose the evaluation order, then optimize space. Take the minimum coins needed to make an amount. The state dp[a] is the fewest coins to make amount a. The recurrence is dp[a] = 1 + min over coins c, where c ≤ a, of dp[a − c]. The base case is dp[0] = 0, with unreachable amounts marked as infinity. Filling the table from 0 to the target gives O(amount × number of coins) time and O(amount) space, versus exponential time for plain recursion. I often start with top-down recursion plus memoization because it maps directly to the recurrence, then convert to bottom-up iteration to avoid recursion depth limits.",
    weakAnswer: "Dynamic programming means storing results so you don't recompute them.",
    explanation:
      "Memoization is only the mechanism. The strong answer gives a repeatable method for defining state and recurrence and demonstrates it with complexity analysis.",
    tip: "Say the state definition out loud before writing code; most DP mistakes come from a fuzzy state.",
    tags: ["dynamic-programming", "recursion", "memoization"],
  },

  // ─── Backend Engineering ────────────────────────────────────────────────────
  {
    slug: "database-indexing",
    category: "BACKEND_ENGINEERING",
    roleTargets: [BE, FS],
    difficulty: "MEDIUM",
    question: "How do database indexes work, and how do you decide which ones to create?",
    sampleAnswer:
      "Most relational indexes are B-trees: balanced trees of sorted keys pointing to rows, which turn a full table scan into an O(log n) lookup and support range queries and ordering. Indexes have costs — every insert, update and delete must maintain them, and they consume memory and disk — so I create them from real query patterns. I look at slow query logs and EXPLAIN ANALYZE output for sequential scans on large tables. For composite indexes, column order matters: equality-filtered columns first, then range or sort columns, following the leftmost-prefix rule. A covering index that includes all selected columns enables index-only scans. Low-cardinality columns rarely benefit alone, though partial indexes such as WHERE status = 'pending' are very effective. Postgres also offers GIN indexes for arrays and JSON and BRIN for very large, naturally ordered tables. Finally, I watch for unused indexes and remove them, because they only add write cost.",
    weakAnswer: "Indexes make queries faster, so I add an index on columns that are queried a lot.",
    explanation:
      "The strong answer explains the data structure, the write-cost trade-off, composite column ordering and how to choose indexes using evidence.",
    tip: "Mention EXPLAIN ANALYZE; it shows you validate index decisions instead of guessing.",
    tags: ["databases", "indexes", "postgres", "performance"],
  },
  {
    slug: "transaction-isolation-levels",
    category: "BACKEND_ENGINEERING",
    roleTargets: [BE],
    difficulty: "HARD",
    question: "Explain transaction isolation levels and the anomalies each one prevents.",
    sampleAnswer:
      "Isolation levels trade concurrency for protection against anomalies. Read uncommitted allows dirty reads of uncommitted data. Read committed, the Postgres default, prevents dirty reads but allows non-repeatable reads: the same query can return different results within a transaction. Repeatable read gives each transaction a consistent snapshot; in Postgres it also prevents phantom reads, but it still allows write skew — two transactions read overlapping data and each writes a different row based on what it read, breaking an invariant like 'at least one doctor stays on call'. Serializable prevents all of these; Postgres implements it with serializable snapshot isolation, aborting transactions that would form a dangerous dependency cycle, so the application must retry on serialization failures. In practice I use read committed by default, add explicit row locks with SELECT FOR UPDATE or optimistic version columns for read-modify-write paths, and use serializable for complex invariants spanning multiple rows, with a retry loop.",
    weakAnswer: "Higher isolation levels are safer but slower. Serializable is the safest.",
    explanation:
      "The strong answer names the specific anomalies, explains write skew, and describes how to handle concurrency practically, including retries.",
    tip: "Write skew is the anomaly that separates strong candidates; have a concrete example ready.",
    tags: ["transactions", "isolation", "concurrency", "postgres"],
  },
  {
    slug: "n-plus-one-queries",
    category: "BACKEND_ENGINEERING",
    roleTargets: [BE, FS],
    difficulty: "EASY",
    question: "What is the N+1 query problem and how do you fix it?",
    sampleAnswer:
      "It happens when code fetches a list of N records with one query and then issues one more query per record to load related data — for example, loading 50 orders and then querying the customer for each order in a loop. That is 51 round trips where one or two would do, and latency grows linearly with list size. ORMs make it easy to introduce because lazy-loaded relations look like plain property access. Fixes: eager-load the relation with a join or the ORM's include or preload option; batch the follow-up lookups with WHERE id IN (...), which is what the DataLoader pattern does for GraphQL resolvers; or denormalize when the read pattern justifies it. I detect it with query logging in development, counting queries per request in tests, and APM traces that show many identical queries in one request.",
    weakAnswer: "It is when you run too many queries. You fix it by caching.",
    explanation:
      "Caching hides the symptom. The strong answer explains the cause, gives a concrete example and lists the correct fixes and detection methods.",
    tip: "Mention DataLoader if the role involves GraphQL; N+1 is the classic GraphQL performance issue.",
    tags: ["orm", "performance", "databases"],
  },
  {
    slug: "message-queue-delivery-semantics",
    category: "BACKEND_ENGINEERING",
    roleTargets: [BE],
    difficulty: "MEDIUM",
    question: "Explain at-most-once, at-least-once and exactly-once delivery. How do you build reliable consumers?",
    sampleAnswer:
      "At-most-once acknowledges a message before processing, so a crash loses it. At-least-once acknowledges after processing, so a crash causes redelivery and possible duplicates. Exactly-once delivery across arbitrary systems isn't achievable in general; what systems like Kafka offer is exactly-once processing within their own boundary through transactions and idempotent producers. So I build consumers for at-least-once delivery and make processing idempotent: each message carries a unique ID, and the consumer records processed IDs in the same database transaction as its side effects, or uses natural idempotency such as upserts. To publish events reliably after a database write, I use the transactional outbox pattern: write the event to an outbox table in the same transaction as the business change, and have a relay publish it. Poison messages go to a dead-letter queue after bounded retries with backoff, and I monitor consumer lag.",
    weakAnswer: "Use a message queue that supports exactly-once delivery so you don't have to worry about duplicates.",
    explanation:
      "Relying on exactly-once guarantees is fragile. The strong answer designs for duplicates with idempotency and the outbox pattern, which is how production systems stay correct.",
    tip: "Mention the transactional outbox; it solves the dual-write problem and interviewers often probe for it.",
    tags: ["queues", "kafka", "idempotency", "outbox"],
  },
  {
    slug: "sessions-vs-jwt",
    category: "BACKEND_ENGINEERING",
    roleTargets: [FS, BE],
    difficulty: "MEDIUM",
    question: "Compare server-side sessions with JWT-based authentication. Which would you choose for a web app?",
    sampleAnswer:
      "With server-side sessions, the server stores session state and gives the browser an opaque ID in an HttpOnly, Secure, SameSite cookie. Revocation is immediate — delete the session — and the cookie leaks nothing, but every request needs a session store lookup. JWTs are signed, self-contained tokens that services verify without a lookup, which suits distributed services and third-party APIs, but they can't be revoked before expiry without a denylist, they grow large, and storing them in localStorage exposes them to XSS. For a typical first-party web app I'd use session cookies, or short-lived JWTs in HttpOnly cookies with refresh-token rotation if services must verify tokens independently. Either way: protect against CSRF with SameSite cookies plus tokens for unsafe methods, set short lifetimes, rotate on privilege changes, and never put sensitive data in JWT payloads, since they are only encoded, not encrypted.",
    weakAnswer: "JWTs are more modern and stateless, so they're better than sessions.",
    explanation:
      "Statelessness has real costs, especially revocation. The strong answer compares the two on security and operations and gives a reasoned recommendation.",
    tip: "Raise token storage and revocation unprompted; those are the security details interviewers test.",
    tags: ["authentication", "jwt", "sessions", "security"],
  },
  {
    slug: "observability-production",
    category: "BACKEND_ENGINEERING",
    roleTargets: [BE, FS, AI],
    difficulty: "MEDIUM",
    question: "How would you make a microservice observable, and how would you debug a latency spike with it?",
    sampleAnswer:
      "I instrument the three signals and correlate them. Metrics: request rate, error rate and latency percentiles per endpoint — the RED method — plus resource saturation, with alerts on SLO burn rate rather than raw thresholds. Logs: structured JSON with a request ID and trace ID on every line, so logs can be joined to traces. Traces: distributed tracing with OpenTelemetry propagated across service calls, queues and database clients, so one request's full path is visible. For a p99 latency spike, I start with the dashboard to scope it — which endpoints, which instances, when it started and whether it lines up with a deploy or traffic change. Then I pull exemplar traces from the slow tail to see which span grew: a database query, a downstream service, or time spent queuing for a connection pool. Finally, I use logs from those traces for detail, such as a query plan change or retries. I'd close with a fix plus an alert or test that would catch the regression earlier.",
    weakAnswer: "Add logging everywhere and check the logs when something goes wrong.",
    explanation:
      "Logs alone make latency investigations slow. The strong answer uses correlated metrics, traces and logs and describes a concrete top-down debugging workflow.",
    tip: "Debug from percentiles, not averages; saying so shows production experience.",
    tags: ["observability", "tracing", "slo", "debugging"],
  },

  // ─── Frontend Engineering ───────────────────────────────────────────────────
  {
    slug: "react-rendering-model",
    category: "FRONTEND_ENGINEERING",
    roleTargets: [FS],
    difficulty: "MEDIUM",
    question: "Explain how React decides what to re-render, and how you would fix a slow component tree.",
    sampleAnswer:
      "A component re-renders when its state changes, when its parent re-renders, or when a context it consumes changes. Rendering produces a new element tree, and reconciliation diffs it against the previous one to apply the minimal DOM updates; list keys tell React which items are the same across renders. Re-rendering isn't automatically expensive — the cost comes from heavy render work or very large subtrees. To fix a slow tree I'd profile with the React Profiler to find what re-renders and why, then apply targeted fixes: move state down so updates affect smaller subtrees, split large contexts or pass selectors so consumers don't update on unrelated changes, memoize expensive children with React.memo and stable props via useMemo and useCallback, virtualize long lists, and defer non-urgent updates with useTransition. The React Compiler now automates much of the memoization, but state placement and context design remain architectural decisions.",
    weakAnswer: "Wrap components in React.memo and use useMemo everywhere to stop re-renders.",
    explanation:
      "Blanket memoization adds complexity without addressing structure. The strong answer explains the render triggers, measures first, and applies fixes matched to the cause.",
    tip: "Say that you profile before memoizing; it distinguishes engineering judgment from cargo-culting.",
    tags: ["react", "rendering", "performance"],
  },
  {
    slug: "core-web-vitals",
    category: "FRONTEND_ENGINEERING",
    roleTargets: [FS],
    difficulty: "MEDIUM",
    question: "A product page loads slowly on mobile. How do you diagnose and improve it?",
    sampleAnswer:
      "I'd measure with field data first — Core Web Vitals from real users — then use Lighthouse and the browser's performance panel for diagnosis. LCP, the largest contentful paint, is usually the hero image or heading; I'd make sure the LCP resource is discoverable in the initial HTML, preloaded, served in a modern format at the right size, and not lazy-loaded, and reduce server response time with caching or server rendering. INP, interaction to next paint, suffers from long JavaScript tasks, so I'd code-split by route, defer third-party scripts, remove unused dependencies and break up long tasks. CLS, cumulative layout shift, is fixed by reserving space for images, ads and embeds and avoiding late-loading fonts that reflow text. I'd add a performance budget to CI so bundle size regressions fail the build, and track the vitals per release.",
    weakAnswer: "Minify the JavaScript and compress the images.",
    explanation:
      "The strong answer measures with field data, maps symptoms to specific metrics, applies targeted fixes, and prevents regressions with budgets.",
    tip: "Name the three Core Web Vitals and what usually drives each; it structures your answer instantly.",
    tags: ["performance", "web-vitals", "lcp", "inp"],
  },
  {
    slug: "rendering-strategies-ssr-csr",
    category: "FRONTEND_ENGINEERING",
    roleTargets: [FS],
    difficulty: "MEDIUM",
    question: "Compare client-side rendering, server-side rendering, static generation and React Server Components.",
    sampleAnswer:
      "Client-side rendering ships a minimal HTML shell and builds the page in the browser; it is simple to host and good for highly interactive, authenticated apps, but first paint and SEO suffer. Server-side rendering produces HTML per request, giving fast first contentful paint and crawlable content, at the cost of server work and time to first byte, followed by hydration to make it interactive. Static generation renders at build time and serves from a CDN — the fastest option for content that changes rarely — and incremental regeneration refreshes pages in the background. React Server Components render on the server and send no component JavaScript to the client, so data fetching and heavy dependencies stay server-side, while client components handle interactivity. In a framework like Next.js I'd mix them per route: static for marketing pages, server components with streaming for data-heavy pages, and client components only where interaction requires them.",
    weakAnswer: "SSR is better for SEO and CSR is better for apps.",
    explanation:
      "The strong answer explains each model's mechanics and trade-offs and recommends mixing them per route based on content and interactivity.",
    tip: "Mention hydration cost; it's the hidden price of SSR that experienced engineers bring up.",
    tags: ["ssr", "rendering", "nextjs", "server-components"],
  },
  {
    slug: "frontend-state-management",
    category: "FRONTEND_ENGINEERING",
    roleTargets: [FS],
    difficulty: "MEDIUM",
    question: "How do you decide where state should live in a frontend application?",
    sampleAnswer:
      "I classify state first. Server state — data owned by the backend — belongs in a data-fetching cache such as TanStack Query or the framework's server components, which handle caching, deduplication, revalidation and loading states; copying it into a global store creates stale duplicates. URL state — filters, tabs, pagination — goes in the URL so it is shareable and survives refreshes. Form state stays local or in a form library. Purely UI state, like whether a modal is open, lives in the closest component that needs it. Only genuinely cross-cutting client state, such as an editor's document or a multi-step wizard spanning routes, goes in a global store like Zustand or Redux, kept small and normalized. This keeps components simple and avoids most re-render and synchronization bugs.",
    weakAnswer: "Put everything in Redux so all components can access it.",
    explanation:
      "A single global store for everything creates coupling and stale server data. The strong answer classifies state and puts each kind where it belongs.",
    tip: "Distinguish server state from client state up front; most modern frontend interviews hinge on it.",
    tags: ["state-management", "react", "architecture"],
  },
  {
    slug: "web-security-xss-csrf",
    category: "FRONTEND_ENGINEERING",
    roleTargets: [FS, BE],
    difficulty: "MEDIUM",
    question: "Explain XSS and CSRF and how you protect a web application against them.",
    sampleAnswer:
      "Cross-site scripting is injecting script into a page that runs with the victim's privileges, through stored user content, reflected parameters, or DOM manipulation. Defenses: rely on framework escaping and avoid raw HTML injection such as dangerouslySetInnerHTML, sanitizing with a vetted library like DOMPurify when HTML is required; set a strict Content-Security-Policy, ideally nonce-based, to block inline and third-party scripts; and keep session tokens in HttpOnly cookies so stolen script can't read them. Cross-site request forgery tricks a logged-in user's browser into sending an authenticated request from another site. Defenses: SameSite=Lax or Strict cookies, anti-CSRF tokens for state-changing requests, verifying the Origin header, and never changing state on GET. Tokens sent in an Authorization header rather than cookies aren't vulnerable to CSRF, but they shift risk to XSS if stored in JavaScript-readable storage.",
    weakAnswer: "Validate user input and use HTTPS.",
    explanation:
      "HTTPS doesn't stop either attack. The strong answer explains each attack's mechanism and the layered defenses that actually address it.",
    tip: "Mention Content-Security-Policy; it's the defense-in-depth layer interviewers like to hear.",
    tags: ["security", "xss", "csrf", "csp"],
  },
  {
    slug: "web-accessibility",
    category: "FRONTEND_ENGINEERING",
    roleTargets: [FS],
    difficulty: "EASY",
    question: "How do you make a web application accessible?",
    sampleAnswer:
      "I start with semantic HTML, because native buttons, links, headings, lists and form labels give keyboard support and screen-reader meaning for free; ARIA is for gaps, not a replacement. Every interactive element must be reachable and operable by keyboard with a visible focus indicator, and focus must be managed in dialogs and route changes. Images need meaningful alt text, or empty alt text when decorative. Text needs sufficient contrast — 4.5 to 1 for body text under WCAG AA — and information should never rely on color alone. Forms need associated labels and error messages announced to assistive technology. I respect reduced-motion preferences. For verification I combine automated checks such as axe in CI, which catch around a third of issues, with manual keyboard testing and periodic screen-reader passes using VoiceOver or NVDA.",
    weakAnswer: "Add alt text to images and ARIA labels to elements.",
    explanation:
      "The strong answer prioritizes semantic HTML, covers keyboard and visual accessibility, and combines automated and manual testing.",
    tip: "Say 'semantic HTML first, ARIA second'; it's the principle accessibility-minded interviewers look for.",
    tags: ["accessibility", "wcag", "html"],
  },
];
