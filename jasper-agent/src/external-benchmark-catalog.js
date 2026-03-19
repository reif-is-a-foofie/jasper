const EXTERNAL_BENCHMARK_CATALOG = [
  {
    id: "terminal_bench",
    label: "Terminal-Bench",
    weight: 12,
    area: "terminal_execution",
    priority: 1,
    integrationStatus: "running",
    runMode: "local_docker_harness",
    setupEffort: "medium",
    sourceUrl: "https://github.com/laude-institute/terminal-bench",
    runnerGuideUrl: "https://github.com/laude-institute/terminal-bench",
    runnerPath: "scripts/run_terminal_bench_with_jasper.py",
    description: "Verifier-backed terminal task execution in containerized environments.",
    whyItMatters:
      "This is the closest public benchmark to Jasper's real terminal operating loop: edit files, run commands, and satisfy an external verifier.",
    nextAction:
      "Expand from smoke tests and stable slices to a recurring curated pack, then a broader rolling pack.",
  },
  {
    id: "swe_bench_verified",
    label: "SWE-bench Verified",
    weight: 14,
    area: "software_engineering",
    priority: 2,
    integrationStatus: "next",
    runMode: "local_docker_harness",
    setupEffort: "high",
    sourceUrl: "https://www.swebench.com/",
    runnerGuideUrl: "https://github.com/SWE-bench/SWE-bench",
    runnerPath: null,
    description:
      "Repository-level software engineering tasks on a human-verified solvable subset.",
    whyItMatters:
      "Jasper has to be strong at real repo maintenance, bug fixing, and patch verification, not only single-shell tasks.",
    nextAction:
      "Build a Jasper runner around the official SWE-bench harness and start with a small Verified subset.",
  },
  {
    id: "appworld",
    label: "AppWorld",
    weight: 10,
    area: "multi_app_workflows",
    priority: 3,
    integrationStatus: "next",
    runMode: "local_python_harness",
    setupEffort: "high",
    sourceUrl: "https://appworld.dev/",
    runnerGuideUrl: "https://github.com/StonyBrookNLP/appworld",
    runnerPath: null,
    description:
      "Function-calling and coding tasks across a controllable world of apps and APIs.",
    whyItMatters:
      "A life assistant needs multi-app workflows, not only coding or shell tasks.",
    nextAction:
      "Create a Jasper AppWorld runner and start with API-first tasks before the broader suite.",
  },
  {
    id: "tau3_bench",
    label: "tau-bench",
    weight: 8,
    area: "tool_agent_interaction",
    priority: 4,
    integrationStatus: "next",
    runMode: "tool_policy_harness",
    setupEffort: "medium",
    sourceUrl: "https://github.com/sierra-research/tau-bench",
    runnerGuideUrl: "https://github.com/sierra-research/tau-bench",
    runnerPath: null,
    description:
      "Tool-agent-user interaction benchmark with realistic policy and API constraints.",
    whyItMatters:
      "Jasper has to follow user intent while handling tools, policies, and ambiguous instructions correctly.",
    nextAction:
      "Wire Jasper into tau-bench and capture transcripts so policy failures are diagnosable.",
  },
  {
    id: "gaia",
    label: "GAIA2",
    weight: 8,
    area: "general_assistant",
    priority: 5,
    integrationStatus: "queued",
    runMode: "agent_research_harness",
    setupEffort: "medium",
    sourceUrl: "https://huggingface.co/blog/gaia2",
    runnerGuideUrl: "https://huggingface.co/gaia-benchmark",
    runnerPath: null,
    description:
      "General agent benchmark for multi-step reasoning, retrieval, and tool use.",
    whyItMatters:
      "Jasper cannot just be a coding or browser agent; it has to be broadly useful on open-ended assistant tasks.",
    nextAction:
      "Integrate the GAIA2 task format and preserve answer traces for error analysis.",
  },
  {
    id: "workarena",
    label: "WorkArena",
    weight: 8,
    area: "browser_knowledge_work",
    priority: 6,
    integrationStatus: "queued",
    runMode: "browsergym",
    setupEffort: "high",
    sourceUrl: "https://github.com/ServiceNow/WorkArena",
    runnerGuideUrl: "https://github.com/ServiceNow/BrowserGym",
    runnerPath: null,
    description: "Browser-based enterprise knowledge-work tasks.",
    whyItMatters:
      "This is closer to real assistant operations than toy browsing tasks because it requires form filling, navigation, and stateful web work.",
    nextAction:
      "Use BrowserGym as the first browser harness integration and start with WorkArena because it is structured and reproducible.",
  },
  {
    id: "webarena_verified",
    label: "WebArena Verified",
    weight: 7,
    area: "browser_web_tasks",
    priority: 7,
    integrationStatus: "queued",
    runMode: "browsergym",
    setupEffort: "high",
    sourceUrl: "https://github.com/ServiceNow/webarena-verified",
    runnerGuideUrl: "https://github.com/ServiceNow/BrowserGym",
    runnerPath: null,
    description:
      "Verified browser tasks over web interactions with stronger reproducibility than the original release.",
    whyItMatters:
      "Jasper needs a general web task benchmark, not only enterprise UI or API environments.",
    nextAction:
      "Add BrowserGym-backed WebArena Verified support after WorkArena is stable.",
  },
  {
    id: "assistantbench",
    label: "AssistantBench",
    weight: 5,
    area: "open_web_assistance",
    priority: 8,
    integrationStatus: "queued",
    runMode: "browsergym",
    setupEffort: "medium",
    sourceUrl: "https://hal.cs.princeton.edu/assistantbench/",
    runnerGuideUrl: "https://github.com/ServiceNow/BrowserGym",
    runnerPath: null,
    description:
      "Open-web assistant benchmark focused on practical user-facing web assistance tasks.",
    whyItMatters:
      "It tests whether Jasper can behave like a useful web assistant, not just navigate benchmark-specific sites.",
    nextAction:
      "Add AssistantBench through BrowserGym once the shared browser runner is in place.",
  },
  {
    id: "visualwebarena",
    label: "VisualWebArena",
    weight: 5,
    area: "visual_browser_tasks",
    priority: 9,
    integrationStatus: "later",
    runMode: "browsergym",
    setupEffort: "high",
    sourceUrl: "https://github.com/web-arena-x/visualwebarena",
    runnerGuideUrl: "https://github.com/ServiceNow/BrowserGym",
    runnerPath: null,
    description:
      "Multimodal browser benchmark that requires visual perception during web interaction.",
    whyItMatters:
      "A serious co-founder-grade assistant cannot rely only on DOM text; it needs a path into visual web reasoning too.",
    nextAction:
      "Integrate only after the non-visual browser stack is stable and benchmark runs are reproducible.",
  },
  {
    id: "osworld",
    label: "OSWorld",
    weight: 8,
    area: "computer_use",
    priority: 10,
    integrationStatus: "later",
    runMode: "desktop_vm_harness",
    setupEffort: "very_high",
    sourceUrl: "https://os-world.github.io/",
    runnerGuideUrl: "https://github.com/xlang-ai/OSWorld",
    runnerPath: null,
    description: "Open-ended multimodal computer-use benchmark for desktop agents.",
    whyItMatters:
      "This is the clearest public measure of whether Jasper can operate like a real computer-use agent beyond terminal and browser sandboxes.",
    nextAction:
      "Stand up a dedicated machine or VM-based runner before attempting full OSWorld coverage.",
  },
  {
    id: "macosworld",
    label: "macOSWorld",
    weight: 5,
    area: "mac_computer_use",
    priority: 11,
    integrationStatus: "later",
    runMode: "mac_vm_harness",
    setupEffort: "very_high",
    sourceUrl: "https://github.com/showlab/macosworld",
    runnerGuideUrl: "https://github.com/showlab/macosworld",
    runnerPath: null,
    description: "macOS-native GUI benchmark for interactive agents.",
    whyItMatters:
      "Jasper is being built and used on macOS, so Mac-native computer use matters more than generic desktop capability alone.",
    nextAction:
      "Use this after OSWorld fundamentals exist so the Mac-specific harness is not the first GUI integration.",
  },
  {
    id: "androidworld",
    label: "AndroidWorld",
    weight: 5,
    area: "mobile_computer_use",
    priority: 12,
    integrationStatus: "later",
    runMode: "android_emulator_harness",
    setupEffort: "very_high",
    sourceUrl: "https://github.com/google-research/android_world",
    runnerGuideUrl: "https://github.com/google-research/android_world",
    runnerPath: null,
    description: "Android emulator benchmark for interactive mobile agents.",
    whyItMatters:
      "A life assistant eventually needs a mobile surface, not only desktop and browser control.",
    nextAction:
      "Defer until browser and desktop benchmark runners are already reliable.",
  },
  {
    id: "asb",
    label: "Agent Security Bench",
    weight: 5,
    area: "agent_security",
    priority: 13,
    integrationStatus: "later",
    runMode: "security_harness",
    setupEffort: "medium",
    sourceUrl: "https://github.com/agiresearch/ASB",
    runnerGuideUrl: "https://github.com/agiresearch/ASB",
    runnerPath: null,
    description: "Security benchmark for attacks and defenses in LLM agents.",
    whyItMatters:
      "Jasper should not get stronger without getting harder to exploit.",
    nextAction:
      "Run after the main task-execution suites are wired so security results reflect real agent capabilities, not missing infrastructure.",
  },
];

function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function listExternalBenchmarkCatalog() {
  return EXTERNAL_BENCHMARK_CATALOG.map((benchmark) => ({ ...benchmark }));
}

export function listExternalBenchmarkQueue() {
  return [...EXTERNAL_BENCHMARK_CATALOG]
    .sort((left, right) => left.priority - right.priority)
    .map((benchmark) => ({ ...benchmark }));
}

export function effectiveExternalBenchmarks(weightOverrides = {}) {
  return EXTERNAL_BENCHMARK_CATALOG.map((benchmark) => ({
    ...benchmark,
    weight: toFiniteNumber(weightOverrides[benchmark.id]) ?? benchmark.weight,
  }));
}

export function findExternalBenchmark(benchmarkId) {
  return EXTERNAL_BENCHMARK_CATALOG.find(
    (entry) => entry.id === benchmarkId,
  ) || null;
}
