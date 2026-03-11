# Jasper Agent Contract

This repository is a Codex fork for building Jasper without making upstream updates painful.

Load these documents in order before making Jasper changes:

1. `agent.md`
2. `docs/jasper/PROJECT_DETAILS.md`
3. `docs/jasper/FORK_STRATEGY.md`

## Operating Rules

- Treat `docs/jasper/PROJECT_DETAILS.md` as the product source of truth.
- Keep Jasper-specific behavior additive and isolated from upstream Codex code.
- Default all new Jasper work into `jasper-overlay/`, `docs/jasper/`, or new top-level `jasper-*` folders.
- Avoid editing `codex-rs/` and `codex-cli/` unless there is no viable overlay or extension path.
- If a core patch is required, keep it minimal, document why it was unavoidable, and record the expected upstream merge impact.
- Work one milestone at a time.

## Change Routing

Use these locations by default:

- `jasper-overlay/`: launcher hooks, prompt composition, extension manifests, Jasper-specific runtime glue
- `docs/jasper/`: PRD, architecture, operating contracts, sync policy
- `jasper-core/`: Jasper runtime components that should remain outside upstream Codex code
- `jasper-memory/`: memory and retrieval systems
- `jasper-tools/`: tool registry and generated tools
- `jasper-agent/`: continuous runtime loop and agent orchestration

Do not create Jasper behavior inside upstream directories when one of the locations above is sufficient.

## Definition Of Done

A Jasper change is only done when:

- the milestone scope is met
- the change is documented
- the upstream merge path remains clear
- the behavior can be disabled, replaced, or moved without invasive Codex patches
