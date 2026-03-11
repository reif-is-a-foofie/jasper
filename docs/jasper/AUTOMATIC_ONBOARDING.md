# Automatic Onboarding

## Current Goal

Jasper should be installable by a new operator with a short sequence:

```shell
npm install -g jasper-ai
jasper setup
jasper
```

`jasper setup` is responsible for:

- creating the local Jasper home at `~/.jasper/` by default
- copying the default identity configuration into the user's config directory
- creating the local Jasper memory directories
- provisioning a local Qdrant instance through Docker by default
- writing a runtime configuration file that later Jasper commands can reuse

## Current Scope

This onboarding flow intentionally stops short of guided account setup.

Deferred items:

- OpenAI credential entry and validation
- connector consent flows
- mailbox, calendar, and browser onboarding
- remote hosted vector store provisioning

For now, operators still need to complete authentication and connector setup manually after `jasper setup`.

## Qdrant Provisioning Model

Default behavior:

- `jasper setup` attempts to run Qdrant locally through Docker
- storage is persisted under `~/.jasper/data/qdrant/storage`
- runtime config records the resolved Qdrant URL and provisioning mode

Supported setup modes:

- default local Docker provisioning
- `jasper setup --skip-qdrant` for development or CI
- `jasper setup --qdrant-url URL` for an externally managed Qdrant instance

## Expected Runtime Artifacts

`jasper setup` should leave behind:

```text
~/.jasper/
  config/
    identity.yaml
    runtime.json
  data/
    memory/
    qdrant/
      storage/
```

## Near-Term Follow-Up

The next onboarding milestone is not more packaging. It is guided authentication:

1. validate OpenAI credentials after setup
2. store a minimal operator config safely
3. present connector consent steps one system at a time
4. confirm Jasper can read/write its provisioned vector store automatically
