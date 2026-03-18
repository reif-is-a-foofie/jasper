# Jasper Milestone 10

## Primary Brain Region

Perception & Attention.

## Objective

Move Jasper from a session-only assistant into a continuously observing system that produces proactive daily value.

## Scope

This milestone introduces background monitoring and digest generation for important household streams.

Delivered here:

- scheduled background runs outside active chat sessions
- ongoing ingestion from configured high-value sources
- morning briefing and evening recap generation
- lightweight prioritization and quiet-hours rules
- operator-visible backlog of important unattended findings

## Success Condition

Jasper can produce a useful proactive daily digest without waiting for the operator to ask what happened.

## Upstream Safety

Milestone 10 should stay in Jasper-owned scheduling, memory, and overlay paths:

- `jasper-agent/`
- `jasper-memory/`
- `jasper-overlay/`
- `docs/jasper/`

No broad upstream changes should be required.

## Verification

```bash
jasper agent start
jasper digest morning
jasper digest evening
```

Expected outcome:

- background observations continue while no live chat is open
- Jasper can produce proactive summaries with ranked priorities
- the operator can inspect what Jasper noticed without reading raw event logs

## Task checklist to stay aligned with the product plan

- connectors: document the activation/approval gating so `jasper apps approve` and `jasper apps activate` stay reliable; the goal is that connectors only surface after consent, keeping provider lanes isolated while the terminal still feels native.
- calendar tool: run `check tomorrow's calendar` and `what changed on my schedule this week` while `jasper/calendar` is active, then confirm the daily digest incorporates the most important changes without requiring a manual prompt.
- email gating: run `summarize important unread email` with and without the `jasper/email-read` state so we can see how the tool and gating behave, and capture any self-correction notes when consent or activation is missing.
- monitoring: keep a terminal session where Jasper runs `jasper digest` automatically (morning/evening) while the connectors remain active, and document any judgements about needing new watchers, quiet hours, or digest priorities.
- unattended checklist: log each decision where the automation had to ask for direction, so when we run unattended we can trace why the builder paused or needed a judgement call.
- digest command: use `jasper digest morning` or `jasper digest evening` to read the connector-aware summary; the runtime also auto-generates periodic digests so unattended monitoring keeps going even while you sleep.
