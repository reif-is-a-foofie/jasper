This directory is reserved for bundled local semantic-model assets.

Installer packages should copy any required `fastembed` embedding-model files here so Jasper can run semantic memory locally without downloading model dependencies at first launch.

Current state:

- Jasper still uses a deterministic placeholder embedder in the live turn loop.
- The packaging path now supports bundling local model assets in advance of the model-based embedder switch.
