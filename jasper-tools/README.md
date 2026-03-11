# Jasper Tools

`jasper-tools/` owns Jasper's tool registry and generated tools.

Current contents:

- `src/registry.js`: Jasper-owned tool registry
- `src/tools/identity-summary.js`: returns Jasper identity state
- `src/tools/recent-memory.js`: returns recent memory events
- `src/tools/semantic-memory-search.js`: runs semantic memory retrieval

The registry remains outside upstream Codex so Jasper tools can evolve independently and later be packaged as an open extension surface.
