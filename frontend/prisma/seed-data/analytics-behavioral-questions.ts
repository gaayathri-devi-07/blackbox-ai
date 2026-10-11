import type { SeedQuestion } from "./types";

const ML = "ML_ENGINEER" as const;
const DS = "DATA_SCIENTIST" as const;

/** Statistics & Analytics, Behavioral and Communication. */
export const ANALYTICS_BEHAVIORAL_QUESTIONS: SeedQuestion[] = [
  // ─── Statistics & Analytics ─────────────────────────────────────────────────
  {
    slug: "interpreting-p-values",
    category: "DATA_ANALYTICS",
    roleTargets: [DS, ML],
    difficulty: "EASY",
    question: "What does a p-value actually mean, and what are common misinterpretations?",
    sampleAnswer:
      "A p-value is the probability of observing data at least as extreme as what we saw, assuming the null hypothesis is true. A p-value of 0.03 means that if there were truly no effect, results this extreme would appear about 3 percent of the time. It is not the probability that the null hypothesis is true, not the probability the result is due to chance, and it says nothing about effect size or practical importance — with enough data, a trivial effect can be highly significant. Common mistakes include treating 0.05 as a bright line, running many tests and reporting only the significant ones, and stopping an experiment the moment p dips below 0.05. I report effect sizes with confidence intervals alongside p-values, pre-register the primary metric, and correct for multiple comparisons when testing several hypotheses.",
    weakAnswer: "A p-value below 0.05 means the result is 95 percent likely to be true.",
    explanation:
      "The weak answer states the most common misinterpretation. The strong answer gives the correct definition, explicitly rules out misreadings, and adds practical reporting habits.",
    tip: "Pair every p-value with an effect size and interval in your answer; it shows statistical maturity.",
    tags: ["hypothesis-testing", "p-values", "statistics"],
  },
  {
    slug: "sample-size-and-power",
    category: "DATA_ANALYTICS",
    roleTargets: [DS, ML],
    difficulty: "MEDIUM",
    question: "How do you determine the sample size and duration for an A/B test?",
    sampleAnswer:
      "Sample size comes from four inputs: the baseline rate or variance of the primary metric, the minimum detectable effect worth acting on, the significance level, typically 5 percent, and the desired power, typically 80 percent. For a conversion rate, the required sample per group grows with the variance and shrinks with the square of the effect, so halving the detectable effect roughly quadruples the sample. I choose the minimum detectable effect from business value rather than what I hope to see. Duration is the sample size divided by eligible daily traffic, rounded up to whole weeks to cover weekly seasonality, with a minimum of one to two weeks to dampen novelty effects. If the required duration is impractical, I'd use variance reduction such as CUPED with pre-experiment covariates, choose a more sensitive proxy metric, or accept a larger detectable effect.",
    weakAnswer: "Run the test for two weeks and check if the result is significant.",
    explanation:
      "The strong answer derives sample size from explicit inputs, explains how they interact, and offers credible options when traffic is limited.",
    tip: "Mention CUPED or another variance-reduction technique; it signals experience running real experiments.",
    tags: ["experimentation", "power-analysis", "ab-testing"],
  },
  {
    slug: "experiment-peeking",
    category: "DATA_ANALYTICS",
    roleTargets: [DS],
    difficulty: "HARD",
    question: "A product manager checks the A/B dashboard daily and wants to stop as soon as the result is significant. What's the problem?",
    sampleAnswer:
      "This is the peeking problem. A fixed-horizon test controls the false positive rate at 5 percent only if we look once, at the planned sample size. Checking repeatedly and stopping at the first significant reading gives the noise many chances to cross the threshold, inflating the real false positive rate well above 5 percent — far higher with daily checks over several weeks. I'd explain it to the PM with a simulation of A/A tests, which shows how often 'winners' appear when nothing changed. Then I'd offer methods that permit monitoring: sequential testing designs such as group-sequential boundaries or always-valid inference, which adjust thresholds for repeated looks, or Bayesian approaches with decision rules agreed in advance. Separately, guardrail metrics can still be monitored daily to stop an experiment that is clearly causing harm.",
    weakAnswer: "Stopping early is fine if the result is clearly significant.",
    explanation:
      "Early stopping on a fixed-horizon test inflates false positives. The strong answer explains why, communicates it persuasively, and offers rigorous alternatives that meet the PM's need for speed.",
    tip: "Offer the stakeholder an alternative, not just a no; interviewers assess influence as well as statistics.",
    tags: ["experimentation", "sequential-testing", "stakeholders"],
  },
  {
    slug: "simpsons-paradox",
    category: "DATA_ANALYTICS",
    roleTargets: [DS],
    difficulty: "MEDIUM",
    question: "What is Simpson's paradox? Describe how it could mislead a product analysis.",
    sampleAnswer:
      "Simpson's paradox is when a trend that appears in every subgroup reverses or disappears when the groups are combined, because the subgroups have very different sizes and baseline rates. A product example: a new checkout flow shows a lower overall conversion rate than the old one, yet within both mobile and desktop it converts better. The explanation is mix shift — the new flow happened to get a much larger share of mobile traffic, which converts lower in general, so the aggregate is dragged down by composition rather than the flow itself. The lesson is to look for confounding variables that affect both group membership and outcome, compare within segments, and use proper randomization or stratification so composition is balanced. When combining results across segments, I'd use a weighted comparison with consistent weights rather than raw aggregates.",
    weakAnswer: "It's when statistics give contradictory results.",
    explanation:
      "The strong answer defines the paradox precisely, gives a realistic product scenario, identifies the mechanism — mix shift — and explains how to guard against it.",
    tip: "Use the phrase 'mix shift'; it's how analysts at product companies describe this in practice.",
    tags: ["confounding", "segmentation", "statistics"],
  },
  {
    slug: "causal-inference-without-experiment",
    category: "DATA_ANALYTICS",
    roleTargets: [DS, ML],
    difficulty: "HARD",
    question: "You can't run an A/B test. How would you estimate the causal impact of a feature launch?",
    sampleAnswer:
      "I'd choose a quasi-experimental method based on how the launch happened. If it rolled out to some regions or user groups first, difference-in-differences compares the change in the treated group to the change in an untreated group over the same period, assuming parallel pre-trends, which I'd verify by plotting them. If eligibility depended on a cutoff, such as accounts above a size threshold, regression discontinuity compares users just above and below it. If users opted in, I'd model selection with propensity score matching or weighting on pre-launch characteristics, while being clear that unobserved confounders remain a risk. For a single treated market, synthetic control builds a weighted combination of untreated markets that tracks the treated one before launch. In every case I'd run placebo tests — fake launch dates or unaffected metrics — and present results with explicit assumptions and uncertainty rather than as a definitive number.",
    weakAnswer: "Compare the metric before and after the launch.",
    explanation:
      "A before-and-after comparison confounds the feature with everything else that changed. The strong answer selects methods based on the rollout design and validates assumptions with placebo tests.",
    tip: "State the key identifying assumption of whichever method you pick; that's what makes the answer credible.",
    tags: ["causal-inference", "difference-in-differences", "observational-data"],
  },

  // ─── Behavioral ─────────────────────────────────────────────────────────────
  {
    slug: "disagree-with-manager",
    category: "BEHAVIORAL",
    roleTargets: [],
    difficulty: "MEDIUM",
    question: "Tell me about a time you disagreed with your manager's technical decision.",
    sampleAnswer:
      "Situation: my manager wanted to build our new notification service on a self-hosted message broker to avoid vendor lock-in, with a six-week deadline. Task: I was the engineer leading the build and believed the operational load would put the deadline at risk. Action: rather than arguing in the planning meeting, I wrote a one-page comparison of self-hosting versus a managed queue covering on-call burden, failure modes, cost at our projected volume, and migration effort if we ever needed to leave the vendor. I also built a two-day spike on the managed option to replace opinions with data. I presented it privately first and made clear I would commit to whichever choice we made. Result: we went with the managed queue behind a thin internal interface, which addressed the lock-in concern. We shipped a week early, and the abstraction later let us move one workload off the vendor in two days. I learned to separate the underlying concern from the proposed solution — my manager's real worry was lock-in, and that was solvable.",
    weakAnswer: "My manager wanted to use a tool I didn't like. I explained why it was wrong and eventually they agreed with me.",
    explanation:
      "The strong answer shows evidence over opinion, respect for the decision-maker, commitment, and a result that addressed the other person's concern — not just winning the argument.",
    tip: "Say 'disagree and commit' only if you mean it; interviewers want to hear how you would act if overruled.",
    tags: ["disagreement", "influence", "star"],
  },
  {
    slug: "production-incident-ownership",
    category: "BEHAVIORAL",
    roleTargets: [],
    difficulty: "MEDIUM",
    question: "Describe a production incident you were involved in. What was your role and what changed afterwards?",
    sampleAnswer:
      "A deploy I authored introduced a database migration that locked a large table for several minutes during peak traffic, causing checkout errors for about 12 percent of requests. I was on call and noticed the error-rate alert within two minutes. I declared an incident, rolled back the application, and when errors persisted I identified the still-running migration and coordinated with our database owner to cancel it safely. Customer impact lasted 14 minutes. I wrote the blameless postmortem the same week. Root cause: the migration added a column with a default value in a way that rewrote the table, and our review process had no check for locking behavior. We changed three things: a CI linter that flags blocking migration patterns, a rule that schema migrations deploy separately from application code, and a load-testing step against a production-sized copy for migrations on large tables. We had no migration-related incidents in the following year.",
    weakAnswer: "Our site went down once because of a bug. We fixed it quickly and everything was fine.",
    explanation:
      "The strong answer shows ownership of the mistake, calm execution during the incident, quantified impact, and systemic fixes that prevent recurrence.",
    tip: "Focus most of your time on what changed afterwards; prevention is what interviewers score.",
    tags: ["incidents", "ownership", "postmortem", "star"],
  },
  {
    slug: "ambiguous-project",
    category: "BEHAVIORAL",
    roleTargets: [],
    difficulty: "MEDIUM",
    question: "Tell me about a project where the requirements were unclear. How did you move forward?",
    sampleAnswer:
      "I was asked to 'improve search relevance' for an internal knowledge base with no defined metric or scope. I started by turning the ask into a measurable problem: I interviewed five support leads, analyzed two weeks of search logs, and found that 40 percent of searches ended with no click, concentrated in queries containing product codes. I wrote a short proposal defining success as reducing zero-click searches by a third, scoped a first iteration — exact-match boosting for product codes plus synonym handling — and listed what was explicitly out of scope. I shared it with stakeholders for a 48-hour review so disagreements surfaced early. We shipped the first iteration in three weeks and cut zero-click searches by 38 percent, which earned buy-in for a second phase on semantic search. The habit I took away is to convert vague goals into a metric and a time-boxed first step before writing code.",
    weakAnswer: "I asked my manager for clearer requirements and waited until they were finalized.",
    explanation:
      "Waiting signals low ownership. The strong answer shows the candidate creating clarity through data, defining success, scoping deliberately and aligning stakeholders.",
    tip: "Show how you defined 'done' yourself; that's the core skill this question tests.",
    tags: ["ambiguity", "ownership", "scoping", "star"],
  },
  {
    slug: "decision-you-would-reverse",
    category: "BEHAVIORAL",
    roleTargets: [],
    difficulty: "HARD",
    question: "Tell me about a technical decision you made that turned out to be wrong. What did you learn?",
    sampleAnswer:
      "Two years ago I chose to split our monolith's reporting module into a separate microservice, reasoning that it would scale independently and let a second team own it. In practice the module shared most of its data model with the core app, so we created a chatty API boundary, duplicated validation logic, and doubled our deployment coordination; delivery on reporting features slowed by roughly a third. Within six months the data showed the split wasn't paying off. I raised it myself in our architecture review, presented the metrics, and proposed folding it back into the monolith as a well-bounded module with its own ownership, which we completed over a quarter. What I learned: service boundaries should follow data ownership and change patterns, not team charts, and I now write down the expected benefits of an architectural change with a date to check them, so reversing course is a planned decision instead of an admission of failure.",
    weakAnswer: "I chose the wrong framework once, but it worked out fine in the end.",
    explanation:
      "The strong answer owns a significant mistake, uses evidence to recognize it, acts to correct it, and extracts a principle that changes future behavior.",
    tip: "Pick a real, consequential mistake; trivial examples read as evasive.",
    tags: ["judgment", "learning", "architecture", "star"],
  },
  {
    slug: "influence-without-authority",
    category: "BEHAVIORAL",
    roleTargets: [],
    difficulty: "HARD",
    question: "Describe a time you drove a significant change across teams without formal authority.",
    sampleAnswer:
      "Our eight product teams each built their own logging and alerting, which made cross-service incidents slow to debug — our mean time to resolution was over two hours. I had no authority over the other teams, so I started by quantifying the cost from the last ten incident postmortems and sharing it at the engineering all-hands. I built a small shared library that added structured logging and tracing with two lines of setup, and I migrated my own team first so others could see the before and after. Then I recruited one engineer from each of two influential teams as co-maintainers, which made it a shared project rather than mine. I held office hours, wrote migration guides, and tracked adoption on a public dashboard. Within two quarters, seven of eight teams had adopted it, and median incident resolution time dropped to 50 minutes. The key was lowering the cost of saying yes and making the benefit visible.",
    weakAnswer: "I convinced the other teams to use my tool by explaining why it was better.",
    explanation:
      "The strong answer shows the mechanics of influence: quantifying the problem, leading by example, building coalitions, reducing adoption cost and measuring results.",
    tip: "Explain how you made adoption easy for others; that's where influence actually happens.",
    tags: ["influence", "leadership", "cross-team", "star"],
  },

  // ─── Communication ──────────────────────────────────────────────────────────
  {
    slug: "walk-through-your-system",
    category: "COMMUNICATION",
    roleTargets: [],
    difficulty: "MEDIUM",
    question: "Walk me through the architecture of a system you built, in about two minutes.",
    sampleAnswer:
      "I'd structure it top-down so the listener always knows where we are. First, one sentence on purpose and scale: 'It's a document-ingestion pipeline that processes about two million files a day for our search product.' Second, the main components in the order data flows, three to five boxes at most: an upload API writing to object storage, a queue, a pool of parsing workers, and an indexing service. Third, the one or two decisions that were genuinely interesting and the trade-offs behind them — for example, choosing at-least-once processing with idempotent writes over distributed transactions. Fourth, a concrete result: 'p95 time from upload to searchable dropped from 20 minutes to 90 seconds.' Finally, I'd invite the interviewer to choose where to go deeper, rather than diving into every detail. Throughout, I'd name what I personally owned versus what the team built.",
    weakAnswer: "I'd start explaining all the services and technologies we used, one after another.",
    explanation:
      "A tour of every component loses the listener. The strong answer gives a repeatable structure — purpose, flow, key decisions, results — and hands control back to the interviewer.",
    tip: "Practice this out loud with a timer; two minutes goes by faster than most candidates expect.",
    tags: ["architecture", "storytelling", "structure"],
  },
  {
    slug: "pushing-back-on-deadline",
    category: "COMMUNICATION",
    roleTargets: [],
    difficulty: "MEDIUM",
    question: "Leadership asks for a feature in three weeks that your team estimates at eight. How do you respond?",
    sampleAnswer:
      "I'd avoid both a flat no and a silent yes. First I'd understand the driver behind the date — a customer commitment, a conference, a contract — because that determines which trade-offs are acceptable. Then I'd come back quickly with options rather than a single estimate: a reduced scope that fits three weeks, identifying exactly which capabilities are deferred; the full scope in eight weeks; or an intermediate path, such as adding a specific engineer or dropping a parallel project, with the risk of each spelled out. I'd present the options in writing so the trade-offs are explicit, recommend one, and let leadership make the call with clear information. Once we commit, I'd set checkpoints and raise risks early rather than hoping to catch up at the end.",
    weakAnswer: "I'd tell them it's impossible and that we need eight weeks.",
    explanation:
      "The strong answer seeks the underlying goal, reframes the conversation around scope and risk, and gives decision-makers real options — the hallmark of senior communication.",
    tip: "Always pair a 'no' with options; it turns pushback into partnership.",
    tags: ["stakeholders", "estimation", "negotiation"],
  },
  {
    slug: "communicating-tradeoffs-in-writing",
    category: "COMMUNICATION",
    roleTargets: [],
    difficulty: "MEDIUM",
    question: "How do you write a design document that gets a decision made?",
    sampleAnswer:
      "I write for the decision, not to show effort. The document opens with a short summary: the problem, the recommendation, what it costs, and what I need from readers, with a decision deadline. Next comes context — why now, and what constraints and goals apply, including explicit non-goals so scope debates happen early. The core is the options considered, usually two or three, compared on the same criteria such as complexity, cost, risk and reversibility, with the recommendation and reasoning. I include the risks of the recommended path and how we would detect and mitigate them, plus a rollout and rollback plan. I share a rough draft with the most skeptical stakeholder first, address their concerns in the document, then circulate it widely. After the review, I record the final decision and its rationale at the top so the document remains useful later.",
    weakAnswer: "I describe the solution in as much detail as possible so nobody has questions.",
    explanation:
      "Exhaustive detail hides the decision. The strong answer leads with the recommendation, compares alternatives fairly and manages stakeholders deliberately.",
    tip: "Mention non-goals and reversibility; they show you think about how decisions age.",
    tags: ["design-docs", "writing", "decision-making"],
  },
];
