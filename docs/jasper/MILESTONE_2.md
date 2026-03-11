# Jasper Milestone 2

## Objective

Establish the first persistent Jasper memory layer without increasing merge pressure on upstream Codex.

## Scope

This milestone implements the raw event memory tier described in `docs/jasper/PROJECT_DETAILS.md`.

Delivered here:

- append-only event storage in `jasper-memory/data/events/events.jsonl`
- a Jasper-owned event store API in `jasper-memory/src/event-store.js`
- runtime lifecycle persistence for initialize, start, tick, and stop events
- recent and relevant event retrieval through the Jasper CLI

Deferred to later memory work:

- embeddings
- vector search
- topic clustering
- nightly reflections

## Event Contract

Each stored event includes:

- `id`
- `ts`
- `type`
- `source`
- `tags`
- `session.id`
- `payload`

This keeps the raw event layer stable while later memory tiers derive richer artifacts from the same base log.

## Runtime Integration

`jasper-agent/` now writes lifecycle events into `jasper-memory/` and loads recent context before the runtime loop begins.

The runtime also performs a lightweight relevance lookup on each tick so Jasper can reference prior context before richer retrieval layers exist.

## Upstream Safety

Milestone 2 stays entirely in Jasper-owned paths:

- `jasper-memory/`
- `jasper-agent/`
- `jasper-overlay/`
- `docs/jasper/`

No new upstream Codex patches were required.

## Verification

Targeted validation commands:

```bash
node jasper-agent/src/cli.js start --max-ticks 2 --interval-ms 10 --memory-root /tmp/jasper-memory-check
node jasper-agent/src/cli.js memory recent --memory-root /tmp/jasper-memory-check --limit 5
node jasper-agent/src/cli.js memory search runtime --memory-root /tmp/jasper-memory-check --limit 5
node jasper-overlay/bin/jasper.js memory recent --memory-root /tmp/jasper-memory-check --limit 3
```
