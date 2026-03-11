# Jasper Branding

## Goal

When the operator launches `jasper`, the visible experience should feel like Jasper, not generic Codex.

## Implementation Rule

Branding is switched on through the Jasper launcher by setting `JASPER_BRANDED=1`.

This keeps direct `codex` behavior unchanged while allowing the Jasper path to override visible labels.

## Current Jasper-Branded Surfaces

- launcher banner
- session header title
- status card title and usage note
- startup placeholder prompts
- personality and settings popups
- approval "tell the agent what to do differently" copy
- onboarding welcome and sign-in copy
- startup tooltip text

## Why A Core Patch Was Used

The TUI owns several user-visible labels that cannot be replaced cleanly from the overlay alone.

To avoid a fork-wide permanent rebrand, Jasper branding is gated behind `JASPER_BRANDED=1` and only adjusts visible copy in the TUI layer.

This keeps the patch small, localized, and easy to reapply after upstream updates.
