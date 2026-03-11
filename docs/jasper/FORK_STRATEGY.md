# Jasper Fork Strategy

## Goal

Keep Jasper aligned with upstream Codex while allowing Jasper-specific systems to evolve independently.

The fork must remain easy to update from `upstream/main` without repeatedly re-solving local integration problems.

## Primary Rule

Keep Jasper code out of upstream Codex directories unless a core patch is strictly necessary.

Default Jasper locations:

- `jasper-overlay/`
- `docs/jasper/`
- `jasper-core/`
- `jasper-memory/`
- `jasper-tools/`
- `jasper-agent/`

Upstream-sensitive directories:

- `codex-rs/`
- `codex-cli/`
- shared root build and packaging files

## Layering Model

### Layer 1: Upstream Codex

Unmodified upstream functionality.

Examples:

- CLI core
- TUI
- sandboxing
- protocol
- packaging

### Layer 2: Jasper Overlay

Thin integration layer that composes Jasper behavior around Codex.

Examples:

- Jasper identity loading
- startup prompt composition
- extension discovery
- operator-facing Jasper commands that do not require core patches

### Layer 3: Jasper Systems

Standalone Jasper modules that can evolve independently.

Examples:

- memory pipeline
- agent runtime loop
- guardian monitors
- environment listeners
- tool registry

## Core Patch Gate

Changes inside `codex-rs/` or `codex-cli/` are allowed only when all of the following are true:

1. An overlay or standalone-module approach was evaluated first.
2. The feature cannot be implemented cleanly outside upstream code.
3. The patch is small and feature-scoped.
4. The patch is documented in the same change.
5. The expected upstream rebase or merge impact is stated clearly.

If those conditions are not met, do not patch core.

## Update Safety Rules

- Prefer composition over modification.
- Keep Jasper configuration and identity files outside upstream code paths when possible.
- Avoid renaming or restructuring upstream directories.
- Avoid long-lived local changes to root build logic unless Jasper delivery depends on them.
- Keep Jasper-specific scripts and docs under Jasper-owned paths.

## Branch Strategy

Recommended operating model:

- `upstream/main`: source of truth for Codex
- local `main`: stays close to upstream and is rebased regularly
- Jasper feature branches: short-lived branches for milestone work

Do not accumulate unrelated Jasper experiments in one branch.

## Sync Workflow

Recommended update routine:

1. Fetch `upstream`.
2. Rebase local `main` onto `upstream/main`.
3. Run targeted validation for any Jasper-owned integration points.
4. Rebase active Jasper feature branches onto the updated `main`.

If an update breaks Jasper, fix the integration in Jasper-owned paths first before considering core edits.

## Validation Baseline After Upstream Sync

At minimum, verify:

- Jasper docs still describe the actual architecture
- `jasper-overlay/` still composes cleanly with current Codex entrypoints
- any Jasper wrapper commands still start successfully
- milestone-owned tests still pass

## Non-Negotiable Outcome

Upstream Codex updates should mostly feel like integration work, not reconstruction work.
