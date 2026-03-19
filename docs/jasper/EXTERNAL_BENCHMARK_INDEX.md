# External Benchmark Index

## Purpose

Jasper should not grade itself only against internal benchmarks.

The external benchmark index is the public-benchmark basket Jasper uses to anchor itself against third-party evaluation suites.

It behaves like an index fund:

- Jasper tracks a weighted basket of public benchmarks
- each benchmark contributes according to a deliberate default weight
- the composite score shows both performance and coverage

This is meant to reduce benchmark cherry-picking.

## Default Basket

The current default basket is:

- `Terminal-Bench` — terminal execution
- `SWE-bench Verified` — software engineering task resolution
- `AppWorld` — multi-app workflow execution
- `tau-bench` — tool-agent-user interaction
- `GAIA2` — broad assistant reasoning and tool use
- `WorkArena` — browser-based knowledge work
- `WebArena Verified` — general browser task execution
- `AssistantBench` — practical open-web assistant tasks
- `VisualWebArena` — visual browser task execution
- `OSWorld` — open-ended computer use
- `macOSWorld` — macOS-native computer use
- `AndroidWorld` — mobile computer use
- `Agent Security Bench` — agent security and attack resistance

## Scoring

The index reports two related numbers:

- `indexScore`: the weighted full-basket score, where missing benchmarks count as zero evidence
- `coveredScore`: the weighted average across only the benchmarks that currently have imported results

This distinction matters:

- `indexScore` answers: how strong is Jasper across the full benchmark basket right now
- `coveredScore` answers: how strong is Jasper on the subset we have actually measured

The report also includes `coveragePercent`, which measures how much of the basket has live results.

## Commands

List the default basket:

```bash
jasper audit benchmark-index list
```

Print the prioritized benchmark integration queue:

```bash
jasper audit benchmark-index queue
```

Print a template import file:

```bash
jasper audit benchmark-index scaffold
```

Compute the current weighted index from recorded results:

```bash
jasper audit benchmark-index
```

Import new results from JSON:

```bash
jasper audit benchmark-index import results.json
```

Run Jasper against a real Terminal-Bench task and optionally import the resulting score:

```bash
python3 scripts/run_terminal_bench_with_jasper.py --task-id hello-world
python3 scripts/run_terminal_bench_with_jasper.py --task-id hello-world --import-benchmark-index
```

Optionally override weights from a JSON file:

```bash
jasper audit benchmark-index --weights-file weights.json
```

## Queue

Jasper now tracks not just the weighted basket, but also the recommended integration order.

Current order:

1. `Terminal-Bench`
2. `SWE-bench Verified`
3. `AppWorld`
4. `tau-bench`
5. `GAIA2`
6. `WorkArena`
7. `WebArena Verified`
8. `AssistantBench`
9. `VisualWebArena`
10. `OSWorld`
11. `macOSWorld`
12. `AndroidWorld`
13. `Agent Security Bench`

The intent is:

- wire high-signal, high-reproducibility suites first
- reuse shared harnesses where possible, especially `BrowserGym`
- delay the most infrastructure-heavy GUI suites until browser and terminal runners are stable

## Import Format

Jasper accepts either:

- a top-level array of result objects
- or an object with `results` and optional `weights`

Example:

```json
{
  "weights": {
    "terminal_bench": 20,
    "swe_bench_verified": 20
  },
  "results": [
    {
      "benchmarkId": "terminal_bench",
      "passed": 82,
      "total": 100,
      "runAt": "2026-03-19T00:00:00.000Z",
      "sourceName": "local-run"
    },
    {
      "benchmarkId": "gaia",
      "accuracy": 0.61,
      "runAt": "2026-03-18T00:00:00.000Z"
    }
  ]
}
```

Supported score fields include:

- `scorePercent`
- `score`
- `accuracy`
- `successRate`
- `passRate`
- `passed` and `total`
- `rawScore` and `maxScore`

## Storage

Imported external benchmark results are stored under Jasper home in:

```text
~/.jasper/data/evals/external-benchmark-results.jsonl
```

Each imported result also records a memory event so Jasper can reason about evaluation history over time.

## Supporting Docs

- [Terminal-Bench Runner](/Users/reif/Desktop/not-secret-projects/jasper/docs/jasper/TERMINAL_BENCH_RUNNER.md)
- [Benchmark Queue](/Users/reif/Desktop/not-secret-projects/jasper/docs/jasper/BENCHMARK_QUEUE.md)
