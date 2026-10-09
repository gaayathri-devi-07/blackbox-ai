"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { CosmicLayout, FloatingCompanion, useCompanion } from "@/components/use-companion";

// ── Universal Questions (all careers) ───────────────────────────────────────
const UNIVERSAL_QUESTIONS = [
  {
    id: 1, category: "HR & Behavioral", difficulty: "Easy",
    question: "Tell me about yourself.",
    weak: "I'm a developer. I've worked on some projects and studied computer science. I'm good at coding and problem solving.",
    strong: "I'm a full-stack developer with 2 years of experience building scalable web apps. Most recently, I led a team of 3 to deliver a fintech dashboard that reduced reporting time by 40%. I'm passionate about clean code and user-centered design — which is exactly why this role excites me.",
    explanation: "The WEAK answer is vague, generic, and gives no value. The STRONG answer uses the 'Present–Past–Future' formula: who you are now → a measurable achievement → why this specific role.",
    tip: "Keep it under 90 seconds. End by connecting your background to the job.",
  },
  {
    id: 2, category: "HR & Behavioral", difficulty: "Easy",
    question: "What is your greatest strength?",
    weak: "I'm a hard worker. I always try my best and I'm very dedicated.",
    strong: "My greatest strength is breaking down complex technical problems into simple, actionable solutions. In my last internship, I refactored a slow database query from 8 seconds to 300ms by rethinking the data model — saving the team hours every sprint.",
    explanation: "Saying 'hard worker' is forgettable — everyone says it. The STRONG answer names a specific skill, backs it with a quantified story, and shows impact.",
    tip: "Pick a strength that is directly relevant to the job and prove it with a specific example.",
  },
  {
    id: 3, category: "HR & Behavioral", difficulty: "Medium",
    question: "What is your greatest weakness?",
    weak: "I'm a perfectionist. I work too hard sometimes.",
    strong: "I used to struggle with delegating tasks because I wanted full control over quality. I actively fixed this by creating clear code review checklists and trusting teammates with ownership. Now our team ships 30% faster and quality has actually improved.",
    explanation: "The 'perfectionist' cliché is a red flag — interviewers see through it immediately. The STRONG answer names a real weakness, explains the action taken to fix it, and shows measurable improvement.",
    tip: "Choose a weakness you've genuinely worked on. Show growth, not a hidden strength.",
  },
  {
    id: 4, category: "HR & Behavioral", difficulty: "Easy",
    question: "Why do you want to work here?",
    weak: "Because it's a good company and I need a job. The pay is good too.",
    strong: "I've followed your platform's growth closely — specifically how you migrated to microservices last year, which I read about in your engineering blog. I want to contribute to that kind of architecture work and grow alongside a team that values both technical excellence and product impact.",
    explanation: "The WEAK answer signals desperation and lack of research. The STRONG answer shows you did your homework, connects their specific work to your interests, and frames what you bring.",
    tip: "Research the company's tech blog, recent news, and mission. Mention 1 specific thing that genuinely excites you.",
  },
  {
    id: 5, category: "HR & Behavioral", difficulty: "Medium",
    question: "Where do you see yourself in 5 years?",
    weak: "I don't know. Maybe a manager or something.",
    strong: "In 5 years, I want to be a senior engineer who owns critical systems and mentors junior developers. I see this role as the foundation — the scale here will let me tackle distributed systems challenges I can't get elsewhere, accelerating that path significantly.",
    explanation: "Vague answers signal no direction. The STRONG answer shows ambition with a realistic trajectory and ties your 5-year vision back to why this company is the right step.",
    tip: "Align your goals with what this role can realistically offer. Avoid 'your job' as the answer.",
  },
  {
    id: 9, category: "Communication", difficulty: "Medium",
    question: "Tell me about a time you had a conflict with a teammate.",
    weak: "I had a conflict once but we talked it out and it was fine.",
    strong: "During a sprint, a teammate and I disagreed on whether to use REST or GraphQL for our new API. Instead of escalating, I organized a 30-minute technical comparison session with clear criteria: dev speed, mobile performance, and future flexibility. We chose GraphQL together, and both felt heard. The API shipped on time and the mobile team thanked us for the flexibility.",
    explanation: "The WEAK answer is impossibly vague — it gives no signal about your EQ or problem-solving. The STRONG answer uses STAR format (Situation, Task, Action, Result) and shows maturity, initiative, and collaboration.",
    tip: "Use the STAR format. Always end with a positive outcome and what you learned.",
  },
  {
    id: 10, category: "Communication", difficulty: "Medium",
    question: "How do you explain a technical concept to a non-technical stakeholder?",
    weak: "I just try to use simple words and avoid jargon.",
    strong: "I use the 'analogy-first' approach. For example, when explaining why database indexing matters, I told our PM: 'Imagine a library with 10,000 books but no catalog. Finding one book would take hours. An index is the catalog.' Then I showed the query time went from 8 seconds to 300ms — a number they understood immediately. I follow this with what action they need to take or approve.",
    explanation: "Saying 'simple words' is obvious advice. The STRONG answer shows a concrete technique (analogy-first), a real example, and ends with business impact — which is what non-technical stakeholders actually care about.",
    tip: "Lead with an analogy, back it with a number, end with what action is needed.",
  },
  {
    id: 11, category: "Body Language & Confidence", difficulty: "Easy",
    question: "How do you manage interview nervousness?",
    weak: "I just breathe deeply and try to stay calm.",
    strong: "I use three techniques: (1) Box breathing before the call — 4s in, 4s hold, 4s out, 4s hold. (2) Power posing for 2 minutes beforehand to boost confidence. (3) I reframe the interview as a conversation between equals — I'm also evaluating if this company is a fit for me. I also prepare 5 anchor stories covering my biggest achievements so I never blank on content.",
    explanation: "Deep breathing is too generic. The STRONG answer gives 3 specific, named techniques, explains the reframe (conversation vs interrogation), and shows preparation strategy.",
    tip: "Preparation kills nervousness. The more you've practiced, the calmer you'll be — that's the real answer.",
  },
  {
    id: 12, category: "Body Language & Confidence", difficulty: "Easy",
    question: "How do you maintain eye contact in a video interview?",
    weak: "I just look at the screen and try to maintain eye contact.",
    strong: "For video interviews, I look directly into the webcam lens — not at the interviewer's face on screen — which creates the perception of eye contact on their end. I position my camera at eye level and place a sticky note near the lens as a visual anchor. I practice the 3-5 second rule: hold for 3-5 seconds, look away briefly to think, then return.",
    explanation: "'Looking at the screen' actually means you're looking DOWN at their face — which registers as broken eye contact to them. The STRONG answer shows you understand the technical nuance of virtual eye contact.",
    tip: "Camera lens = eye contact. Face on screen = looking down. This single insight changes everything.",
  },
];

// ── Career-specific Technical Questions ──────────────────────────────────────
const CAREER_QUESTIONS: Record<string, { id: number; category: string; difficulty: string; question: string; weak: string; strong: string; explanation: string; tip: string }[]> = {
  "software-dev": [
    {
      id: 101, category: "Technical", difficulty: "Medium",
      question: "What is the difference between == and === in JavaScript?",
      weak: "== checks equality and === is stricter. I usually use ===.",
      strong: "== performs type coercion before comparing — so '5' == 5 returns true. === checks both value AND type without coercion, so '5' === 5 returns false. In practice, === is almost always preferred because implicit coercion leads to subtle bugs. For example, null == undefined is true with ==, which can cause unexpected behavior in conditional checks.",
      explanation: "Just saying 'stricter' shows surface knowledge. The STRONG answer explains the mechanism (type coercion), gives concrete examples, and shows judgment.",
      tip: "For technical questions: explain the mechanism → give an example → describe when it matters in practice.",
    },
    {
      id: 102, category: "Technical", difficulty: "Hard",
      question: "Explain the concept of closures in JavaScript.",
      weak: "A closure is when a function remembers its outer variables even after the outer function has returned.",
      strong: "A closure is a function that retains access to its lexical scope even when executed outside that scope. JavaScript creates a reference to the outer scope, not a snapshot. A classic use case is the module pattern — encapsulating private state. For example, a counter function returns increment/decrement methods: the inner functions close over the `count` variable, keeping it private but accessible.",
      explanation: "The WEAK answer is correct but generic. The STRONG answer explains the WHY (lexical scope, reference vs snapshot), gives a practical use case, and shows depth.",
      tip: "Follow: definition → mechanism → real-world use case → code example (mention it even without writing it).",
    },
    {
      id: 103, category: "Technical", difficulty: "Hard",
      question: "How would you design a URL shortener like bit.ly?",
      weak: "I'd create a table with the original URL and a short code, then redirect when someone visits the short URL.",
      strong: "I'd design it in layers: (1) API Gateway + Load Balancer → (2) Web servers with Rate Limiting → (3) Short code generation using base62 encoding on an auto-incremented ID, stored in PostgreSQL → (4) Redis cache for hot URLs (80/20 rule) → (5) CDN for edge redirection. Key decisions: 7-char codes give 3.5 trillion combinations, Redis TTL-based cache handles peak load, Cassandra for write-heavy horizontal scaling.",
      explanation: "The WEAK answer shows only the happy path at MVP scale. System design needs to address scale, caching, hashing strategy, and trade-offs.",
      tip: "For system design: always mention scale → components → data model → trade-offs. Never just describe CRUD.",
    },
    {
      id: 104, category: "Technical", difficulty: "Medium",
      question: "What is the difference between REST and GraphQL?",
      weak: "REST uses URLs for endpoints and GraphQL uses queries. GraphQL is newer.",
      strong: "REST is resource-based: each endpoint returns a fixed shape of data, which can lead to over-fetching or under-fetching. GraphQL lets clients specify exactly what data they need in a single request, reducing payload size and round-trips. REST is simpler to cache at the HTTP layer; GraphQL is better for complex, nested data with multiple consumers like mobile clients. I choose REST for simple CRUD APIs and GraphQL when clients have diverse or dynamic data needs.",
      explanation: "The WEAK answer only describes mechanics. The STRONG answer explains trade-offs, when to use each, and shows engineering judgment.",
      tip: "Always discuss trade-offs and when you'd choose one over the other — not just what they are.",
    },
    {
      id: 105, category: "Technical", difficulty: "Hard",
      question: "Explain time complexity. What is the difference between O(n) and O(log n)?",
      weak: "O(n) means it takes n steps and O(log n) means it's faster, like in binary search.",
      strong: "Time complexity describes how an algorithm's runtime grows relative to input size. O(n) means runtime grows linearly — doubling the input doubles the time, like iterating through an array. O(log n) means runtime grows logarithmically — doubling the input only adds one more step, like binary search which halves the search space each iteration. For 1 million elements, O(n) takes ~1M operations; O(log n) takes only ~20. This is why we prefer binary search trees and hash maps for large datasets.",
      explanation: "The WEAK answer knows the definition but can't quantify it. The STRONG answer gives concrete numbers, explains the mechanism, and ties it to practical data structure choices.",
      tip: "Always illustrate with a real number (e.g., 1M elements) to show you understand the practical impact.",
    },
  ],
  "ai-ml": [
    {
      id: 201, category: "Technical", difficulty: "Medium",
      question: "What is the difference between supervised and unsupervised learning?",
      weak: "Supervised learning uses labeled data and unsupervised doesn't have labels.",
      strong: "Supervised learning trains on labeled (input, output) pairs — the model learns a mapping function. Examples: classification (spam detection), regression (house prices). Unsupervised learning finds hidden patterns in unlabeled data — no ground truth. Examples: clustering (customer segments with K-Means), dimensionality reduction (PCA). The key trade-off: supervised needs expensive labeled data but gives directly measurable performance; unsupervised is cheaper to set up but harder to evaluate.",
      explanation: "Just stating 'labels vs no labels' is entry-level. The STRONG answer gives concrete algorithm examples, use cases, and discusses the trade-off — showing you've applied both in practice.",
      tip: "Name specific algorithms for each type and explain a real-world scenario where you'd choose one over the other.",
    },
    {
      id: 202, category: "Technical", difficulty: "Hard",
      question: "Explain overfitting. How would you prevent it?",
      weak: "Overfitting is when the model memorizes training data and does poorly on new data. You can add more data to fix it.",
      strong: "Overfitting occurs when a model learns the noise and specific patterns of training data rather than the underlying signal, resulting in high training accuracy but poor generalization. Prevention strategies: (1) Regularization — L1 (Lasso) for feature selection, L2 (Ridge) for weight penalty. (2) Dropout layers in neural networks — randomly zeroing neurons during training. (3) Early stopping — halt training when validation loss increases. (4) Data augmentation to artificially expand the training set. (5) Cross-validation to detect overfitting early. I always monitor the train/validation loss gap as a key signal.",
      explanation: "The WEAK answer knows the concept but gives only one naive solution. The STRONG answer gives 5 concrete techniques with explanations and mentions the monitoring strategy.",
      tip: "For any ML problem, always mention how you'd detect it (metrics) and then how you'd address it (multiple techniques).",
    },
    {
      id: 203, category: "Technical", difficulty: "Medium",
      question: "What is gradient descent and how does it work?",
      weak: "Gradient descent is an optimization algorithm that finds the minimum of a loss function by taking steps in the direction of the gradient.",
      strong: "Gradient descent minimizes a loss function by iteratively updating model parameters in the negative direction of the gradient — because the gradient points uphill, so we go opposite to descend. The learning rate controls step size: too large causes overshooting (divergence), too small causes slow convergence. Variants: Batch GD uses all data per step (stable but slow); Stochastic GD uses one sample (fast but noisy); Mini-batch GD (the standard) balances both. Adaptive optimizers like Adam combine momentum and per-parameter learning rates, which is why Adam is the default choice for deep learning.",
      explanation: "The textbook definition is the bare minimum. The STRONG answer explains variants, the learning rate trade-off, and why Adam is the default — showing you've actually trained models.",
      tip: "Always mention learning rate challenges and at least one adaptive optimizer like Adam or RMSProp.",
    },
    {
      id: 204, category: "Technical", difficulty: "Hard",
      question: "What is the attention mechanism in transformers?",
      weak: "Attention allows the model to focus on relevant parts of the input when generating each output token.",
      strong: "Attention computes a weighted sum of Value vectors, where weights are determined by the compatibility between Query and Key vectors (dot product, scaled by √d_k, softmaxed). This allows every token to attend to every other token in the sequence simultaneously, unlike RNNs which process sequentially. Multi-head attention runs this in parallel with different learned projections, capturing different types of relationships. Self-attention in BERT enables bidirectional context; causal attention in GPT masks future tokens. The O(n²) complexity is the main bottleneck for long sequences.",
      explanation: "The WEAK answer is too high-level. The STRONG answer explains the QKV mechanism, why it's better than RNNs, the multi-head variant, and the known limitation — showing you've read the Attention Is All You Need paper.",
      tip: "For transformer questions: explain QKV → multi-head → complexity trade-offs → mention BERT vs GPT variants.",
    },
    {
      id: 205, category: "Technical", difficulty: "Medium",
      question: "How would you handle imbalanced datasets in a classification problem?",
      weak: "You can oversample the minority class or undersample the majority class.",
      strong: "Imbalanced data requires both data-level and algorithm-level strategies. Data-level: (1) SMOTE — generates synthetic minority samples by interpolating between existing ones, better than random oversampling. (2) Random undersampling of the majority. Algorithm-level: (1) Class weights — penalize misclassifying the minority class more heavily in the loss function. (2) Threshold tuning — instead of 0.5 default, find the optimal threshold using the precision-recall curve. Evaluation: never use accuracy on imbalanced data — use F1-score, AUC-ROC, or macro-averaged metrics. I always check the confusion matrix to understand which type of error matters more.",
      explanation: "Mentioning oversample/undersample is correct but basic. The STRONG answer adds SMOTE, class weighting, threshold tuning, and — critically — explains why accuracy is a bad metric.",
      tip: "Always discuss evaluation metrics alongside handling techniques — interviewers want to see you understand the full pipeline.",
    },
  ],
  "data-scientist": [
    {
      id: 301, category: "Technical", difficulty: "Medium",
      question: "What is the difference between correlation and causation? Give an example.",
      weak: "Correlation means two things move together, but causation means one causes the other.",
      strong: "Correlation measures the strength of linear relationship between two variables (Pearson r from -1 to +1). Causation means one variable directly influences another. Classic pitfall: ice cream sales and drowning rates are positively correlated — both rise in summer — but ice cream doesn't cause drowning; the confounder is warm weather. In data science this matters enormously: you might find that users who see a feature have higher retention, but that's likely selection bias — engaged users opt into features. To establish causation you need A/B testing or causal inference methods like Difference-in-Differences.",
      explanation: "Every data scientist knows the definition. The STRONG answer gives a concrete example, names the confounder, and connects it to a real DS scenario — A/B testing.",
      tip: "Always give a specific example with a confounder and explain how you'd establish actual causality in a product context.",
    },
    {
      id: 302, category: "Technical", difficulty: "Hard",
      question: "Walk me through your approach to a new data analysis project.",
      weak: "I'd first understand the problem, then explore the data, build a model, and present the results.",
      strong: "My process has 5 phases: (1) Problem framing — define the business question and success metric before touching data. (2) Data audit — schema review, missing values, distributions, and outlier detection using descriptive stats and visualizations. (3) Feature engineering — domain-driven transformations, handling nulls (imputation vs. dropping), encoding categoricals. (4) Modeling — baseline first (logistic regression, decision tree), then iterate. Always split train/val/test upfront. (5) Communication — tailor findings to the audience: technical details for engineers, business impact (revenue/time saved) for stakeholders. I document every decision in a notebook so the analysis is reproducible.",
      explanation: "The WEAK answer is a generic 4-word pipeline. The STRONG answer gives specific techniques at each phase, emphasizes business framing first, and mentions reproducibility.",
      tip: "Lead with problem framing and end with communication — analysts who skip these two phases produce analyses no one acts on.",
    },
    {
      id: 303, category: "Technical", difficulty: "Medium",
      question: "What is A/B testing? How do you determine statistical significance?",
      weak: "A/B testing is comparing two versions of something to see which performs better. You use a p-value to check significance.",
      strong: "A/B testing is a controlled experiment where users are randomly assigned to control (A) or treatment (B) to measure the causal impact of a change. To determine significance: I set α = 0.05 before the test (not after), calculate the required sample size using a power analysis (typically 80% power to detect a minimum detectable effect), run the test for the pre-determined duration to avoid peeking bias, and use a t-test or z-test for means, or chi-squared for proportions. I also check for novelty effects and segment results — a metric can be significant overall but harm a key user cohort. Practical significance (effect size) matters as much as statistical significance.",
      explanation: "Saying 'p-value' shows surface knowledge. The STRONG answer covers the full methodology: pre-registration, sample size, peeking bias, segmentation, and the distinction between statistical and practical significance.",
      tip: "Mention sample size calculation and peeking bias — these are the most common mistakes and interviewers test for them specifically.",
    },
    {
      id: 304, category: "Technical", difficulty: "Medium",
      question: "Explain the difference between mean, median, and mode. When do you use each?",
      weak: "Mean is the average, median is the middle value, and mode is the most frequent. Mean is usually best.",
      strong: "Mean is sensitive to outliers — a single extreme value skews it significantly. Median is the 50th percentile and is robust to outliers. Mode is the most frequent value, useful for categorical data. When to use each: Mean for symmetric distributions without extreme outliers (e.g., test scores in a normal population). Median for skewed distributions or when outliers are present (e.g., income data, house prices — Bill Gates walks into a bar and the mean income skyrockets, the median barely moves). Mode for categorical data (most popular product category) or bimodal distributions. In data science, always plot the distribution first before deciding which central tendency measure to report.",
      explanation: "Saying 'mean is usually best' is wrong — in skewed data (which is most real-world data), it's misleading. The STRONG answer explains when each fails and why.",
      tip: "Income and house prices are classic examples of skewed data where median > mean. Always reference a real-world skewed distribution.",
    },
    {
      id: 305, category: "Technical", difficulty: "Hard",
      question: "How would you detect and handle outliers in a dataset?",
      weak: "I would use a boxplot to find outliers and remove them if they seem wrong.",
      strong: "Detection methods: (1) Statistical — Z-score (|z| > 3) for normally distributed data; IQR method (< Q1 - 1.5×IQR or > Q3 + 1.5×IQR) for skewed data. (2) Visual — boxplots, scatter plots, histogram tails. (3) Model-based — Isolation Forest or LOF for multivariate outliers. Handling: removal only if the outlier is a data error (typo, sensor glitch). For genuine extreme values, options include: Winsorization (cap at 5th/95th percentile), log transformation to compress the scale, or using robust models like tree-based methods that are naturally resistant. Always ask why the outlier exists — sometimes it's your most important data point (fraud detection, rare events).",
      explanation: "Just 'remove them' is dangerous — you could delete legitimate extreme events. The STRONG answer gives multiple detection methods and explains different handling strategies with justifications.",
      tip: "Never automatically remove outliers — always investigate the root cause first. In fraud or anomaly detection, outliers ARE the signal.",
    },
  ],
  "cloud-engineer": [
    {
      id: 401, category: "Technical", difficulty: "Medium",
      question: "What is the difference between horizontal and vertical scaling?",
      weak: "Vertical scaling means adding more resources to a server and horizontal means adding more servers.",
      strong: "Vertical scaling (scale up) means increasing a single server's resources — more CPU, RAM, storage. It's simple but has a hard ceiling (the largest available instance) and creates a single point of failure. Horizontal scaling (scale out) adds more instances behind a load balancer. It's more complex — you need stateless services, distributed session management (e.g., Redis), and a load balancer — but it offers near-infinite capacity and high availability. In AWS, vertical = resizing an EC2 instance; horizontal = Auto Scaling Groups. For databases, vertical is simpler; horizontal requires sharding or read replicas. Stateless microservices should always be designed for horizontal scaling.",
      explanation: "Knowing the definition is table stakes. The STRONG answer covers trade-offs, SPOF, statelessness requirements, and ties it to real AWS services.",
      tip: "Always connect scaling to statelessness — horizontal scaling only works if your service doesn't store state locally.",
    },
    {
      id: 402, category: "Technical", difficulty: "Hard",
      question: "What is Kubernetes and why is it used?",
      weak: "Kubernetes is a container orchestration platform. It manages Docker containers and makes deployments easier.",
      strong: "Kubernetes is an open-source container orchestration system that automates deployment, scaling, and management of containerized applications. Core primitives: Pods (smallest deployable unit, 1+ containers), Deployments (declarative updates with rollback), Services (stable network endpoint via label selectors), and ConfigMaps/Secrets for configuration. Why use it: (1) Self-healing — crashed pods are automatically restarted. (2) Horizontal Pod Autoscaler scales based on CPU/custom metrics. (3) Rolling deployments with zero downtime. (4) Namespace-based multi-tenancy. The trade-off: K8s has significant operational complexity — for small teams, managed services like ECS Fargate or Cloud Run are often a better choice.",
      explanation: "Saying 'manages Docker containers' is the absolute minimum. The STRONG answer names core K8s primitives, explains specific capabilities, and critically — mentions when NOT to use it.",
      tip: "Mention HPA (autoscaling), self-healing, and when Kubernetes is overkill. Showing trade-off awareness impresses interviewers.",
    },
    {
      id: 403, category: "Technical", difficulty: "Hard",
      question: "Explain the concept of Infrastructure as Code (IaC). How does Terraform work?",
      weak: "IaC means managing infrastructure using code instead of manually clicking in the AWS console. Terraform is a tool for this.",
      strong: "IaC treats infrastructure provisioning like software — version-controlled, repeatable, and auditable. Terraform uses HashiCorp Configuration Language (HCL) to declare the desired state. It works in 3 phases: (1) Write — define resources (EC2, S3, VPC) in .tf files. (2) Plan — terraform plan shows a diff between current state (tracked in terraform.tfstate) and desired state. (3) Apply — executes the changes. Key concepts: providers (AWS, GCP, Azure plugins), modules for reusability, and remote state backends (S3 + DynamoDB lock) for team collaboration. The main advantage over CloudFormation: multi-cloud support and a cleaner DSL. I always keep state in a remote backend and never commit it to Git.",
      explanation: "Terraform is much more than 'code for AWS'. The STRONG answer covers the plan/apply workflow, state management, and remote backends — these are the interview topics that separate practitioners from readers.",
      tip: "Always mention remote state (never local in production), state locking, and modules — these show you've used Terraform in a team environment.",
    },
    {
      id: 404, category: "Technical", difficulty: "Medium",
      question: "What is the difference between a Dockerfile and a Docker image vs a container?",
      weak: "A Dockerfile is instructions to build an image, and a container is a running image.",
      strong: "A Dockerfile is a script of instructions (FROM, RUN, COPY, CMD) that defines how to build an image — it's the blueprint. A Docker image is an immutable, layered snapshot built from those instructions; each instruction creates a new layer, enabling caching. A container is a runtime instance of an image — isolated via Linux namespaces (process, network, filesystem) and cgroups (resource limits). Analogy: Dockerfile = recipe, Image = packaged meal kit, Container = the meal being cooked. Key implications: images are shared and pushed to registries (ECR, DockerHub); containers are ephemeral and stateless — persistent data must use volumes.",
      explanation: "The WEAK answer is correct but shallow. The STRONG answer explains image layers (important for caching and size optimization), the Linux primitives under the hood, and the statelessness implication.",
      tip: "Mention image layers and caching — understanding that COPY and RUN create layers is critical for writing efficient Dockerfiles.",
    },
    {
      id: 405, category: "Technical", difficulty: "Hard",
      question: "Walk me through how you would set up a CI/CD pipeline.",
      weak: "I'd use Jenkins or GitHub Actions to automate building and deploying code when someone pushes to main.",
      strong: "My CI/CD pipeline has distinct stages: (1) CI — on every PR: lint → unit tests → integration tests → build Docker image → push to ECR with git SHA tag. (2) CD — on merge to main: pull image from ECR → deploy to staging (ECS/K8s) → run smoke tests → manual approval gate → deploy to production with rolling update strategy. Key design decisions: separate build and deploy jobs for reusability; use git SHA tags not 'latest' for traceability; feature flags to decouple deploy from release; rollback via re-deploying the previous image tag. I use GitHub Actions for the workflow and store secrets in AWS Secrets Manager, never in environment variables or code.",
      explanation: "Naming a tool isn't a pipeline design. The STRONG answer covers the full workflow, explains git SHA tagging, approval gates, rollback strategy, and secrets management.",
      tip: "Never use 'latest' tag in production — always use git SHA or semantic version for traceability and rollback capability.",
    },
  ],
  "product-analyst": [
    {
      id: 501, category: "Technical", difficulty: "Medium",
      question: "What metrics would you track to measure the success of a new feature?",
      weak: "I'd look at user engagement and revenue to see if the feature is doing well.",
      strong: "I use a North Star Metric (NSM) framework. First, I define the primary metric tied directly to the feature's purpose (e.g., for a search feature: search-to-result-click rate). Then I instrument guardrail metrics — things I must NOT break (page load time, error rate, core retention). Secondary metrics provide diagnostic depth (query refinement rate, zero-result searches). I also track leading indicators (Day-1 adoption rate) vs lagging indicators (30-day retention lift). Finally, I set pre-defined success thresholds before launch — not after — to avoid p-hacking. I'd monitor with a 95% confidence A/B test for at least 2 weeks to account for novelty effects.",
      explanation: "Vague metrics like 'engagement' are meaningless without definition. The STRONG answer introduces the NSM framework, guardrail metrics, and shows rigorous pre-registration — exactly how product analysts think.",
      tip: "Always define metrics before launch, not after. Post-hoc metric selection is a form of analysis bias that leads to wrong decisions.",
    },
    {
      id: 502, category: "Technical", difficulty: "Hard",
      question: "How would you diagnose a 20% drop in DAU (Daily Active Users)?",
      weak: "I'd check if there was a bug or a bad deployment. Maybe look at the logs.",
      strong: "I'd follow a structured diagnostic framework: (1) Validate — confirm it's real (not a tracking bug, timezone issue, or dashboard error). (2) Segment — break down by platform (iOS/Android/Web), geography, user cohort (new vs retained), and acquisition channel to isolate the affected group. (3) Funnel analysis — where in the user journey are people dropping off? (4) Timing — correlate with deploys, push notification changes, or external events (holidays, competitor launches). (5) Hypothesis testing — form a ranked list of hypotheses by impact × likelihood. In one case, a 15% DAU drop was entirely in one geography during a carrier outage — segmentation found it in 20 minutes.",
      explanation: "Checking for bugs is one step, not a methodology. The STRONG answer gives a systematic 5-step framework and backs it with a real-world example — showing you've actually diagnosed these problems before.",
      tip: "Always validate data accuracy first — 30% of metric drops turn out to be tracking bugs. Never skip this step.",
    },
    {
      id: 503, category: "Technical", difficulty: "Medium",
      question: "What is cohort analysis and when would you use it?",
      weak: "Cohort analysis groups users by when they signed up and tracks their behavior over time.",
      strong: "Cohort analysis groups users by a shared characteristic — most commonly acquisition date — and tracks a metric over time for each group. It's essential for separating the effect of time-in-product from calendar effects. Use cases: (1) Retention analysis — do users acquired in Jan retain better than Feb? If so, what changed? (2) LTV calculation — comparing revenue curves by cohort reveals which acquisition channels produce high-value users. (3) Feature impact — compare behavior of pre-feature cohorts vs post-feature cohorts. Key insight: aggregate metrics hide cohort degradation. A flat retention curve overall can mask new cohorts churning faster while old cohorts compensate — cohort analysis exposes this. I build these in SQL using window functions with a user's first_event_date as the cohort anchor.",
      explanation: "The textbook definition ignores the 'why'. The STRONG answer explains when aggregate metrics lie, gives 3 use cases, and mentions the SQL implementation — showing you've built these in practice.",
      tip: "Show how aggregate metrics can be misleading and how cohort analysis reveals the truth — this is the key insight interviewers want to see.",
    },
    {
      id: 504, category: "Technical", difficulty: "Medium",
      question: "How do you prioritize competing features/requests from stakeholders?",
      weak: "I'd talk to stakeholders to understand what's most important and then decide based on impact.",
      strong: "I use a structured framework, most commonly ICE (Impact × Confidence × Ease) or RICE (Reach × Impact × Confidence ÷ Effort). Each request gets scored on these dimensions with explicit assumptions documented. For Impact, I estimate the metric lift and how many users are affected. For Confidence, I use evidence quality: strong = A/B test data; medium = user research; low = gut feeling. I also apply strategic filters: does this align with the current OKR? Does it create technical debt? I present the ranked backlog with scores in a shared doc so stakeholders can see the reasoning — this moves the conversation from opinions to data and reduces politics.",
      explanation: "Saying 'talk to stakeholders' is how a junior analyst thinks. The STRONG answer introduces scoring frameworks, explains the evidence-quality weighting, and addresses stakeholder alignment.",
      tip: "Name a framework (RICE or ICE), explain how you assign scores, and mention how you document assumptions — this shows analytical rigor.",
    },
    {
      id: 505, category: "Technical", difficulty: "Hard",
      question: "Write a SQL query to find the top 3 products by revenue in each category.",
      weak: "I'd use GROUP BY and ORDER BY to get the top products, then filter by category.",
      strong: "I'd use a window function: SELECT category, product_name, revenue FROM (SELECT category, product_name, revenue, RANK() OVER (PARTITION BY category ORDER BY revenue DESC) AS rnk FROM sales) ranked WHERE rnk <= 3; The PARTITION BY category resets the rank within each category. I use RANK() instead of ROW_NUMBER() to handle ties — if two products are tied for 2nd, both should appear. For very large tables I'd also consider whether category is indexed, and whether a CTE or subquery is clearer for the team maintaining this query.",
      explanation: "GROUP BY + ORDER BY can't solve this correctly without window functions. The STRONG answer uses PARTITION BY correctly, chooses RANK over ROW_NUMBER for ties, and considers performance.",
      tip: "Always explain WHY you chose RANK vs ROW_NUMBER vs DENSE_RANK — tie handling is a common follow-up question.",
    },
  ],
};

// ── Build question list based on career ─────────────────────────────────────
function getQuestionsForCareer(career: string | null) {
  const technical = career && CAREER_QUESTIONS[career] ? CAREER_QUESTIONS[career] : CAREER_QUESTIONS["software-dev"];
  return [...UNIVERSAL_QUESTIONS, ...technical];
}

const CAREER_LABELS: Record<string, string> = {
  "software-dev": "Software Developer",
  "ai-ml": "AI / ML Engineer",
  "data-scientist": "Data Scientist",
  "cloud-engineer": "Cloud Engineer",
  "product-analyst": "Product Analyst",
};

const CATEGORIES = ["All", "HR & Behavioral", "Technical", "Communication", "Body Language & Confidence"];
const DIFFICULTY_COLORS: Record<string, string> = { Easy: "#34d399", Medium: "#fbbf24", Hard: "#f87171" };

// ── Chat types ───────────────────────────────────────────────────────────────
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface Question {
  id: number; category: string; difficulty: string;
  question: string; weak: string; strong: string; explanation: string; tip: string;
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function PracticeHub() {
  const router = useRouter();
  const companion = useCompanion();
  const [activeCategory, setActiveCategory] = useState("All");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"weak" | "strong" | "why">("strong");
  const [search, setSearch] = useState("");
  const [career, setCareer] = useState<string | null>(null);

  // Load career from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      setCareer(localStorage.getItem("career"));
    }
  }, []);

  // Use only local hardcoded questions (API generation disabled for stability)
  const hardcoded = getQuestionsForCareer(career);
  const QUESTIONS: Question[] = (() => {
    if (activeCategory === "All") {
      return hardcoded;
    }
    return hardcoded.filter((q) => q.category === activeCategory);
  })();

  // AI Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: `Hi! I'm ${companion?.name ?? "your AI companion"} 🌟 Ask me anything about interview answers, or paste your own answer and I'll help you improve it!`,
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Update welcome message when companion loads
  useEffect(() => {
    if (companion) {
      setChatMessages([{
        role: "assistant",
        content: `Hi! I'm ${companion.name} 🌟 Ask me anything about interview answers, or paste your own answer and I'll help you improve it!`,
      }]);
    }
  }, [companion?.name]);

  const filtered = QUESTIONS.filter((q) => {
    const matchSearch = search === "" || q.question.toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });

  const sendChat = async (text?: string) => {
    const msg = text ?? chatInput.trim();
    if (!msg) return;
    setChatInput("");

    const userMsg: ChatMessage = { role: "user", content: msg };
    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages);
    setChatLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.slice(-10), // last 10 messages for context
          companionId: companion?.id ?? "luna",
          context: `You are helping with interview preparation for a ${career ? CAREER_LABELS[career] ?? career : "tech"} role. Tailor all advice and examples to this specific career domain.`,
        }),
      });
      const data = await res.json();
      setChatMessages((prev) => [...prev, { role: "assistant", content: data.message }]);
    } catch {
      setChatMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I had trouble responding. Please try again." }]);
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const companionColor = companion
    ? { luna: "#a78bfa", nova: "#60a5fa", stella: "#f472b6", orion: "#34d399", cosmo: "#fbbf24" }[companion.id] ?? "#a78bfa"
    : "#a78bfa";

  return (
    <CosmicLayout>
      <div className="flex flex-col min-h-screen">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between px-6 py-5"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <button onClick={() => router.push("/journey")} className="text-slate-500 dark:text-white/40 hover:text-slate-900 dark:hover:text-white text-xs transition-colors">
            ← Journey
          </button>
          <div className="text-center">
            <p className="text-[10px] tracking-[0.4em] text-purple-400/70 uppercase mb-0.5">Practice Hub</p>
            <h1 className="text-xl font-extrabold tracking-widest bg-gradient-to-r from-blue-300 to-purple-300 bg-clip-text text-transparent">
              Interview Q&A Bank
            </h1>
            {career && (
              <p className="text-[10px] text-slate-500 dark:text-white/40 mt-0.5">
                🎯 {CAREER_LABELS[career] ?? career} · domain-specific questions
              </p>
            )}
          </div>
          <div className="text-xs text-slate-500 dark:text-white/30">{QUESTIONS.length} questions</div>
        </motion.div>

        {/* Main layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Questions */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Filters */}
            <div className="px-6 py-4 space-y-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <input
                className="w-full bg-slate-100 dark:bg-white/[0.06] border border-slate-300 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-white/30 outline-none focus:border-purple-500/50 transition-colors"
                placeholder="🔍 Search questions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className="flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all"
                    style={{
                      background: activeCategory === cat ? `${companionColor}33` : "rgba(255,255,255,0.06)",
                      border: `1px solid ${activeCategory === cat ? companionColor + "88" : "rgba(255,255,255,0.1)"}`,
                      color: activeCategory === cat ? companionColor : "rgba(255,255,255,0.5)",
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Question list */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {filtered.map((q, i) => (
                <motion.div
                  key={q.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="rounded-2xl overflow-hidden"
                  style={{
                    background: expandedId === q.id ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${expandedId === q.id ? companionColor + "44" : "rgba(255,255,255,0.08)"}`,
                    transition: "all 0.2s",
                  }}
                >
                  {/* Question header */}
                  <button
                    className="w-full flex items-start gap-3 px-5 py-4 text-left"
                    onClick={() => {
                      setExpandedId(expandedId === q.id ? null : q.id);
                      setActiveTab("strong");
                    }}
                  >
                    <span className="text-lg mt-0.5">⭐</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}>
                          {q.category}
                        </span>
                        <span className="text-[9px] font-bold" style={{ color: DIFFICULTY_COLORS[q.difficulty] }}>
                          {q.difficulty}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white/90">{q.question}</p>
                    </div>
                    <span className="text-slate-500 dark:text-white/30 text-xs mt-1">{expandedId === q.id ? "▲" : "▼"}</span>
                  </button>

                  {/* Expanded content */}
                  <AnimatePresence>
                    {expandedId === q.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-5">
                          {/* Tabs */}
                          <div className="flex gap-2 mb-4">
                            {(["strong", "weak", "why"] as const).map((tab) => (
                              <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className="px-3 py-1.5 rounded-xl text-[11px] font-bold capitalize transition-all"
                                style={{
                                  background:
                                    activeTab === tab
                                      ? tab === "strong" ? "#34d39933" : tab === "weak" ? "#f8717133" : "#a78bfa33"
                                      : "rgba(255,255,255,0.06)",
                                  color:
                                    activeTab === tab
                                      ? tab === "strong" ? "#34d399" : tab === "weak" ? "#f87171" : "#a78bfa"
                                      : "rgba(255,255,255,0.4)",
                                  border: `1px solid ${activeTab === tab ? (tab === "strong" ? "#34d39966" : tab === "weak" ? "#f8717166" : "#a78bfa66") : "rgba(255,255,255,0.08)"}`,
                                }}
                              >
                                {tab === "strong" ? "✅ Strong Answer" : tab === "weak" ? "❌ Weak Answer" : "💡 Why"}
                              </button>
                            ))}
                          </div>

                          {/* Tab content */}
                          <div
                            className="rounded-xl p-4 text-sm leading-relaxed"
                            style={{
                              background:
                                activeTab === "strong" ? "rgba(52,211,153,0.08)" :
                                activeTab === "weak" ? "rgba(248,113,113,0.08)" :
                                "rgba(167,139,250,0.08)",
                              border: `1px solid ${activeTab === "strong" ? "#34d39930" : activeTab === "weak" ? "#f8717130" : "#a78bfa30"}`,
                              color: "rgba(255,255,255,0.82)",
                            }}
                          >
                            {activeTab === "strong" && q.strong}
                            {activeTab === "weak" && q.weak}
                            {activeTab === "why" && (
                              <div>
                                <p className="mb-3">{q.explanation}</p>
                                <div className="flex items-start gap-2 mt-3 p-3 rounded-lg bg-white/[0.05]">
                                  <span>💡</span>
                                  <p className="text-xs text-slate-600 dark:text-white/60">{q.tip}</p>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Ask AI button */}
                          <button
                            onClick={() => sendChat(`Explain this interview question to me: "${q.question}". What makes a great answer?`)}
                            className="mt-3 text-[11px] px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
                            style={{
                              background: `${companionColor}22`,
                              border: `1px solid ${companionColor}44`,
                              color: companionColor,
                            }}
                          >
                            🤖 Ask {companion?.name ?? "AI"} to explain this
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}

              {filtered.length === 0 && (
                <div className="text-center py-12 text-slate-500 dark:text-white/30">
                  <p className="text-3xl mb-3">🔭</p>
                  <p>No questions found for "{search}"</p>
                </div>
              )}
            </div>
          </div>

          {/* Right: AI Chat panel */}
          <div
            className="w-[340px] flex flex-col"
            style={{ borderLeft: "1px solid rgba(255,255,255,0.07)" }}
          >
            {/* Chat header */}
            <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-base"
                  style={{
                    background: `radial-gradient(circle, ${companionColor}cc, ${companionColor}44)`,
                    boxShadow: `0 0 12px ${companionColor}44`,
                    border: `1px solid ${companionColor}66`,
                  }}
                >
                  {{ luna: "🌙", nova: "⭐", stella: "✨", orion: "🌟", cosmo: "🪐" }[companion?.id ?? ""] ?? "🤖"}
                </div>
                <div>
                  <p className="text-xs font-bold" style={{ color: companionColor }}>
                    {companion?.name ?? "AI Companion"}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-white/35">Ask anything · Paste your answer for review</p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {chatMessages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className="max-w-[88%] rounded-2xl px-3 py-2.5 text-xs leading-relaxed"
                    style={
                      msg.role === "user"
                        ? { background: `${companionColor}33`, border: `1px solid ${companionColor}44`, color: "rgba(255,255,255,0.9)" }
                        : { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.82)" }
                    }
                  >
                    {msg.content}
                  </div>
                </motion.div>
              ))}

              {chatLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="flex gap-1.5 px-3 py-2.5 rounded-2xl bg-white/[0.06] border border-white/10">
                    {[0, 0.15, 0.3].map((d) => (
                      <motion.div
                        key={d}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: companionColor }}
                        animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                        transition={{ duration: 0.8, repeat: Infinity, delay: d }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Quick prompts */}
            <div className="px-4 pb-2 flex gap-2 overflow-x-auto">
              {["How to nail STAR answers?", "Tips for confidence?", "Rate my answer"].map((p) => (
                <button
                  key={p}
                  onClick={() => sendChat(p)}
                  className="flex-shrink-0 text-[10px] px-2.5 py-1 rounded-full transition-all hover:opacity-80"
                  style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.5)" }}
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="px-4 pb-4 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex gap-2">
                <input
                  className="flex-1 bg-slate-100 dark:bg-white/[0.06] border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-white/30 outline-none focus:border-purple-500/50 transition-colors"
                  placeholder="Ask a doubt or paste your answer..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendChat()}
                />
                <button
                  onClick={() => sendChat()}
                  disabled={!chatInput.trim() || chatLoading}
                  className="w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-30"
                  style={{ background: `${companionColor}44`, border: `1px solid ${companionColor}66`, color: companionColor }}
                >
                  ↑
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <FloatingCompanion />
    </CosmicLayout>
  );
}
