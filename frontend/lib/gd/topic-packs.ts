import type { TargetRole } from "@/lib/domain";

/**
 * Discussion topics with plain-spoken arguments.
 *
 * Without a language model, the AI panelists draw from these so they stay on
 * the actual topic and sound like people in a room: short sentences, everyday
 * words, one idea at a time. `pro` argues for the motion, `con` against it,
 * and `middle` offers a practical compromise the synthesizer can steer toward.
 */
export interface TopicPack {
  text: string;
  roles?: TargetRole[];
  /** Short noun phrase used in spoken lines, e.g. "mandatory code review for AI code". */
  short: string;
  pro: string[];
  con: string[];
  middle: string[];
}

export const TOPIC_PACKS: TopicPack[] = [
  {
    text: "Should AI-generated code require mandatory human review before it reaches production?",
    short: "human review of AI-written code",
    pro: [
      "AI tools write code that looks right but can be subtly wrong, and a person reading it is the cheapest place to catch that.",
      "When something breaks in production, someone has to own it. Review makes sure a real engineer understood the change.",
      "Security is the big one for me. AI can happily copy an insecure pattern, and reviewers are trained to spot those.",
      "Review also spreads knowledge. If nobody reads the AI's code, soon nobody on the team understands the system.",
    ],
    con: [
      "We don't review every line from a compiler or a library either. If tests are strong, a mandatory human gate just slows teams down.",
      "Honestly, reviewers already skim large pull requests. Making review mandatory might give a false sense of safety.",
      "AI writes a lot of boring code, like tests and boilerplate. Forcing a person to read all of it wastes their best hours.",
      "Automated checks are getting better fast. Static analysis plus good tests might catch more than a tired reviewer.",
    ],
    middle: [
      "Maybe the rule should depend on risk: anything touching payments, security or data gets a human, simple changes don't.",
      "What if review stays mandatory, but AI helps the reviewer by summarising the change and flagging the risky parts?",
    ],
  },
  {
    text: "Will autonomous AI agents replace most entry-level software engineering work within five years?",
    short: "AI agents replacing entry-level engineers",
    pro: [
      "A lot of junior work is well-defined tickets, small bug fixes and tests, and that's exactly what agents are getting good at.",
      "Companies follow cost. If an agent can close simple tickets overnight, fewer teams will hire as many juniors.",
      "We've already seen it with support and content work. Software is just next in line.",
      "The tools improved massively in just two or three years, so five more years is a long time.",
    ],
    con: [
      "Junior engineers don't just write code. They learn the system, ask questions and grow into seniors. Agents don't grow into anything.",
      "Most real tickets are messy. The requirements are unclear and you have to talk to people, which agents still struggle with.",
      "Every wave of automation in software created more demand, not less. Cheaper software means people want more software.",
      "If companies stop hiring juniors, where do their seniors come from in ten years? That would hurt them badly.",
    ],
    middle: [
      "I think the job changes rather than disappears. Juniors will review and guide agents instead of typing every line.",
      "Maybe the realistic answer is fewer pure coding roles, but more roles that mix engineering with product and testing.",
    ],
  },
  {
    text: "Open-weight versus proprietary foundation models: which should enterprises bet on?",
    short: "open versus closed AI models",
    pro: [
      "Open models let a company keep its data in-house, which matters a lot in banking or healthcare.",
      "With open weights you're not locked to one vendor's pricing or decisions. If they change the rules, you're not stuck.",
      "You can fine-tune an open model for your exact use case, and often a smaller tuned model beats a giant general one.",
      "Running your own model can be much cheaper at high volume, once the setup is done.",
    ],
    con: [
      "The best proprietary models are still ahead on hard reasoning, and most companies just want the best answers.",
      "Running models yourself needs GPUs, MLOps people and security work. Most enterprises don't have that team.",
      "With a vendor you get support, uptime guarantees and safety work for free. That's worth paying for.",
      "Open models move fast but they also change constantly, and keeping up becomes its own job.",
    ],
    middle: [
      "Most smart companies will do both: a proprietary model for hard tasks, and a small open model for cheap, private, high-volume work.",
      "The real bet should be on an architecture that lets you switch models easily, so you're not betting on one at all.",
    ],
  },
  {
    text: "Should companies be held legally liable for harm caused by the AI systems they deploy?",
    short: "legal liability for AI harm",
    pro: [
      "If a company makes money from an AI system, it should also carry the responsibility when that system hurts someone.",
      "Liability is what makes companies take safety seriously. Without it, testing becomes optional.",
      "Victims need someone to hold accountable. Saying the algorithm did it can't be a valid excuse.",
      "We already hold car makers responsible for faulty brakes. AI shouldn't get a special exemption.",
    ],
    con: [
      "If the rules are too strict, small companies won't dare to build anything, and only the giants will survive.",
      "AI systems are often used in ways the maker never intended. Blaming the company for misuse feels unfair.",
      "Some harm is genuinely hard to predict. Heavy liability might just make companies hide problems instead of fixing them.",
      "Courts don't understand the technology yet, so the outcomes could be random and slow.",
    ],
    middle: [
      "Maybe liability should scale with risk: strict rules for medical or hiring decisions, lighter rules for low-stakes tools.",
      "A fair middle ground could be safe harbour: if a company followed published testing standards, its liability is limited.",
    ],
  },
  {
    text: "Are algorithmic coding interviews an effective way to hire engineers?",
    short: "algorithm-style coding interviews",
    pro: [
      "They're consistent. Every candidate gets a similar problem, so it's fairer than just chatting about someone's background.",
      "Problem solving under a bit of pressure does tell you how someone thinks, and you can see them communicate.",
      "At big companies with thousands of applicants, you need something that scales, and these interviews do.",
      "They don't depend on where you worked before, so a strong student from a small college gets a real chance.",
    ],
    con: [
      "Most day-to-day work isn't inverting trees. It's reading old code, debugging and talking to people.",
      "They reward people who had time to grind practice problems, which isn't the same as being a good engineer.",
      "Some great engineers freeze in that format, so companies lose talent for no good reason.",
      "A take-home project or a code review exercise shows much more about how someone actually works.",
    ],
    middle: [
      "Keep one algorithm round for basic problem solving, but add a practical round like debugging or a small design task.",
      "The problems could at least be realistic, like parsing a log file, instead of puzzles nobody meets at work.",
    ],
  },
  {
    text: "Is remote-first engineering better for innovation than co-located teams?",
    short: "remote-first versus office teams",
    pro: [
      "Remote work lets you hire the best people wherever they live, and more diverse teams come up with more ideas.",
      "Engineers need long stretches of quiet focus, and that's much easier at home than in an open office.",
      "Remote teams write things down, and written design docs often lead to better thinking than hallway chats.",
      "People save hours of commuting, and rested people are more creative.",
    ],
    con: [
      "A lot of good ideas come from random conversations at lunch or by the whiteboard. You lose that on video calls.",
      "Juniors learn much faster by sitting next to seniors and overhearing how they solve problems.",
      "Trust builds faster in person, and teams with trust take more risks, which is where innovation comes from.",
      "Remote meetings tend to be tightly scheduled, so there's less space for messy brainstorming.",
    ],
    middle: [
      "Hybrid with purpose might work best: remote for focused work, but meet in person for planning and brainstorming.",
      "Maybe it's less about location and more about habits, like writing things down and making time for open discussion.",
    ],
  },
  {
    text: "Should data-privacy regulation be allowed to slow down AI innovation?",
    short: "privacy rules slowing AI",
    pro: [
      "Privacy is a basic right. If a product can only work by taking people's data without consent, maybe it shouldn't exist.",
      "Once personal data leaks or gets misused, you can't undo it. Going a bit slower is a small price.",
      "Clear rules actually help companies, because users trust products more when they know their data is protected.",
      "Without regulation, companies race to collect everything, and the people with the least power get hurt most.",
    ],
    con: [
      "If one country makes the rules too strict, the innovation just moves somewhere else.",
      "Big companies can afford armies of lawyers to comply. Startups can't, so strict rules protect the incumbents.",
      "Some of the most useful AI, like in medicine, needs a lot of data to work. Slowing it down costs lives too.",
      "Rules written today will be outdated in two years because the technology changes so fast.",
    ],
    middle: [
      "Techniques like anonymisation and on-device processing could give us both privacy and progress.",
      "Maybe regulation should focus on how data is used, not ban collection outright, with real penalties for misuse.",
    ],
  },
  {
    text: "Is a computer science degree still necessary for a successful engineering career?",
    short: "whether you need a CS degree",
    pro: [
      "A degree gives you fundamentals like algorithms, operating systems and networks that are hard to learn properly alone.",
      "Many companies and visa rules still filter on degrees, so without one you're fighting with one hand tied.",
      "College also gives you a network, internships and time to explore, which shapes a career more than people admit.",
      "When you hit a really hard problem, the theory from a degree is what helps you reason through it.",
    ],
    con: [
      "Plenty of great engineers are self-taught or came from bootcamps. Skills and projects matter more than the paper.",
      "Degrees are expensive and slow, and parts of the syllabus are years behind what the industry uses.",
      "Many companies have dropped degree requirements because they missed talented people.",
      "Today you can learn almost everything online for free, and build a portfolio that proves it.",
    ],
    middle: [
      "The degree isn't necessary, but the fundamentals are. How you learn them matters less than whether you actually learn them.",
      "A degree probably helps you get the first job, and after that your work speaks for itself.",
    ],
  },
  {
    text: "Should startups build on third-party AI APIs or invest in training their own models?",
    roles: ["AI_ENGINEER", "ML_ENGINEER"],
    short: "using AI APIs versus training your own models",
    pro: [
      "For a startup, speed is everything. An API lets you test whether customers even want the product in a few weeks.",
      "Training your own model costs a lot in GPUs and specialists, money a startup should spend on finding customers.",
      "API providers keep improving the models, so you get upgrades for free without doing anything.",
      "The real value is usually in the product and the data, not in the base model itself.",
    ],
    con: [
      "If your whole product is a thin layer over someone else's API, you have no moat. Anyone can copy you.",
      "API costs grow with every user. At scale, a smaller model of your own can be far cheaper.",
      "You depend on the provider's pricing, rate limits and policies, and they can change overnight.",
      "Some customers won't send their data to a third party at all, especially in regulated industries.",
    ],
    middle: [
      "Start on an API to learn fast, but log your data so you can fine-tune your own smaller model once you have traction.",
      "Build an abstraction layer from day one, so switching from an API to your own model is a config change, not a rewrite.",
    ],
  },
  {
    text: "Are benchmark scores a meaningful measure of progress in large language models?",
    roles: ["AI_ENGINEER", "ML_ENGINEER", "DATA_SCIENTIST"],
    short: "benchmark scores for language models",
    pro: [
      "Benchmarks give everyone a shared yardstick. Without them, every company would just say their model is the best.",
      "They've tracked real progress. Models that score higher really do handle harder tasks better.",
      "Good benchmarks are cheap and repeatable, so researchers can test ideas quickly.",
      "They also expose weaknesses, like poor math or reasoning, and that points the field in a useful direction.",
    ],
    con: [
      "Once a benchmark becomes the target, people optimise for it, and the score stops meaning much.",
      "Test questions leak into training data, so a model might just remember the answers.",
      "Benchmarks are clean multiple-choice tests, but real users ask messy, open-ended questions.",
      "A model can top the leaderboard and still be slow, expensive or unpleasant to actually use.",
    ],
    middle: [
      "Benchmarks are a starting point, but every team should build its own evaluation on its real use case.",
      "Maybe we need benchmarks that keep changing and use fresh, private questions so they can't be gamed.",
    ],
  },
  {
    text: "Microservices versus monoliths: has the industry over-corrected?",
    roles: ["BACKEND_ARCHITECT", "FULL_STACK_DEVELOPER"],
    short: "microservices versus monoliths",
    pro: [
      "Yes, a lot of small teams split into twenty services and now spend more time on networking than on features.",
      "A well-structured monolith is easier to test, debug and deploy, especially early on.",
      "Microservices bring distributed systems problems, like partial failures and data consistency, that most teams don't need.",
      "Some well-known companies have moved parts back to a monolith and saved real money doing it.",
    ],
    con: [
      "For big organisations, microservices let many teams ship independently without stepping on each other.",
      "You can scale the busy parts separately instead of scaling the whole app.",
      "A huge monolith can become so tangled that nobody dares to change it.",
      "The tooling for microservices, like containers and service meshes, is much better than it used to be.",
    ],
    middle: [
      "A modular monolith is often the sweet spot: clear boundaries inside one deployable app, split out only when there's a real need.",
      "The decision should follow team size and scaling needs, not what's fashionable at conferences.",
    ],
  },
  {
    text: "Should every product team own its own infrastructure, or should a platform team own it centrally?",
    roles: ["BACKEND_ARCHITECT", "ML_ENGINEER"],
    short: "who should own infrastructure",
    pro: [
      "When a product team owns its infrastructure, it can move fast without waiting in another team's queue.",
      "Teams that run what they build care more about reliability, because they're the ones getting paged.",
      "A central team can become a bottleneck that doesn't understand each product's needs.",
      "Ownership builds skill. Engineers who understand their infrastructure make better design choices.",
    ],
    con: [
      "If every team builds its own setup, you end up with ten different ways of doing the same thing, and security gaps.",
      "Infrastructure is specialised work. A platform team does it once, properly, for everyone.",
      "Product engineers should spend their time on the product, not on certificates and networking.",
      "Costs are easier to control when one team sees the whole picture.",
    ],
    middle: [
      "A platform team can build paved roads, standard templates that product teams use on their own, without tickets.",
      "Central for the shared basics like security and networking, team-owned for the service-specific parts.",
    ],
  },
  {
    text: "Is the modern JavaScript ecosystem too complex for the value it delivers?",
    roles: ["FULL_STACK_DEVELOPER"],
    short: "complexity in modern JavaScript",
    pro: [
      "A simple website now needs a framework, a bundler, a router and fifty dependencies. That's a lot for showing some text.",
      "Things change so fast that a project from two years ago can be painful to upgrade.",
      "Each dependency is a possible security hole, and the tree gets huge.",
      "Newcomers get overwhelmed by tooling before they've even learned the basics of the web.",
    ],
    con: [
      "Today's web apps do things that used to need desktop software, and that needs serious tools.",
      "Frameworks solve real problems like state, routing and performance that you'd otherwise solve badly yourself.",
      "The tooling is actually consolidating, and modern frameworks hide most of the setup.",
      "Nobody forces you to use everything. Plain HTML and a little JavaScript still work perfectly well.",
    ],
    middle: [
      "Maybe the answer is choosing tools per project: a heavy framework for complex apps, something simple for a content site.",
      "Teams should agree on a small, stable stack and resist adding a new library for every problem.",
    ],
  },
  {
    text: "Should product decisions be driven primarily by A/B test results?",
    roles: ["DATA_SCIENTIST", "FULL_STACK_DEVELOPER"],
    short: "A/B tests driving product decisions",
    pro: [
      "A/B tests stop us from arguing opinions. The data shows what users actually do.",
      "Even experienced people are wrong about what users want surprisingly often. Tests catch that.",
      "Testing lets you ship small changes safely and roll back the ones that hurt.",
      "It creates a culture where anyone with a good idea can prove it, not just the loudest person.",
    ],
    con: [
      "Tests measure short-term clicks, but some of the best decisions only pay off over months.",
      "You can't A/B test a big new vision. Tests are good for tweaking, not for big leaps.",
      "If you optimise only for metrics, you can end up with dark patterns that annoy users.",
      "Many teams don't have enough traffic for reliable results, so they read noise as signal.",
    ],
    middle: [
      "Use A/B tests to check ideas, but let product vision and user research decide which ideas are worth testing.",
      "Pair every test metric with a guardrail, like retention or complaints, so short-term wins don't hide long-term damage.",
    ],
  },
  {
    text: "Do dashboards and metrics make organizations smarter, or just busier?",
    roles: ["DATA_SCIENTIST"],
    short: "dashboards and metrics",
    pro: [
      "Good dashboards make problems visible early, before they turn into a crisis.",
      "Shared metrics get everyone talking about the same thing, instead of arguing from different stories.",
      "Without numbers, decisions default to whoever is most senior or most confident.",
      "Tracking things over time shows trends that no single meeting would reveal.",
    ],
    con: [
      "Most companies have hundreds of dashboards that nobody opens. That's busywork, not insight.",
      "When a number becomes a target, people game it instead of improving the real thing.",
      "Metrics can make teams feel informed while they're still missing the why behind the numbers.",
      "Time spent building and arguing about dashboards is time not spent talking to users.",
    ],
    middle: [
      "Every dashboard should be tied to a specific decision. If no decision depends on it, delete it.",
      "Fewer metrics, chosen carefully, plus regular conversations with users to explain what the numbers mean.",
    ],
  },
];
