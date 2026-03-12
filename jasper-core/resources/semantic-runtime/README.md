This directory is reserved for bundled local semantic-runtime assets.

Jasper's model-based memory path uses `fastembed` with ONNX Runtime loaded from a local library path. Installer packages should copy the platform runtime files here so packaged Jasper can use semantic memory without downloading native inference dependencies at first launch.

Current state:

- Jasper can now prefer model-based embeddings when local model assets and a local ONNX runtime are both bundled.
- If those assets are absent, Jasper falls back to the deterministic local embedder so memory capture and retrieval still work.
