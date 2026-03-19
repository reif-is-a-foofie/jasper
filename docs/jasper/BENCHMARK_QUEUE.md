# Benchmark Queue

## Goal

Jasper needs a benchmark stack that behaves like an index fund:

- broad enough that no single benchmark can dominate the story
- concrete enough that we can actually run it
- ordered enough that integration work happens in the right sequence

## Tier 1

These are the suites Jasper should wire first because they are high signal and relatively actionable.

1. `Terminal-Bench`
2. `SWE-bench Verified`
3. `AppWorld`
4. `tau-bench`

## Tier 2

These broaden Jasper from coding and shell execution into web and general assistant behavior.

5. `GAIA2`
6. `WorkArena`
7. `WebArena Verified`
8. `AssistantBench`

## Tier 3

These are valuable but require more infrastructure or visual interaction support.

9. `VisualWebArena`
10. `OSWorld`
11. `macOSWorld`
12. `AndroidWorld`
13. `Agent Security Bench`

## Why This Order

- `Terminal-Bench` is already wired and is the best current external check on Jasper's terminal execution loop.
- `SWE-bench Verified` is the next most important because it measures repo-level engineering competence.
- `AppWorld` and `tau-bench` expand into tool use, policy following, and multi-app workflows.
- `GAIA2`, `WorkArena`, `WebArena Verified`, and `AssistantBench` deepen general assistant and browser performance.
- `VisualWebArena`, `OSWorld`, `macOSWorld`, and `AndroidWorld` are important, but they need heavier browser, VM, or emulator infrastructure.
- `Agent Security Bench` matters, but it becomes more meaningful after core capability runners are live.

## Shared Harness Strategy

- `Terminal-Bench`: use the checked-in Jasper runner.
- `SWE-bench Verified`: build a Jasper harness around the official SWE-bench tooling.
- `AppWorld`: use the official AppWorld environment.
- `tau-bench`: use the official tau-bench harness.
- `WorkArena`, `WebArena Verified`, and `AssistantBench`: build on `BrowserGym`.
- `VisualWebArena`: add after the non-visual BrowserGym stack is stable.
- `OSWorld`, `macOSWorld`, and `AndroidWorld`: run on dedicated machine, VM, or emulator infrastructure.

## Commands

Inspect the weighted basket:

```bash
jasper audit benchmark-index list
```

Inspect the prioritized queue:

```bash
jasper audit benchmark-index queue
```
