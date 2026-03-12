#!/usr/bin/env python3
"""Stage and optionally pack the Jasper CLI package."""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import tempfile
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
OVERLAY_ROOT = SCRIPT_DIR.parent
REPO_ROOT = OVERLAY_ROOT.parent
PACKAGE_TEMPLATE_PATH = OVERLAY_ROOT / "package.json"
PACKAGE_SOURCE_DIRS = (
    "jasper-agent",
    "jasper-core",
    "jasper-memory",
    "jasper-tools",
)
DEFAULT_VENDOR_SRC = REPO_ROOT / "codex-cli" / "vendor"
DEFAULT_SEMANTIC_MODEL_SRC = (
    REPO_ROOT / "jasper-core" / "resources" / "semantic-models"
)
DEFAULT_SEMANTIC_RUNTIME_SRC = (
    REPO_ROOT / "jasper-core" / "resources" / "semantic-runtime"
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build or stage the Jasper CLI npm package."
    )
    parser.add_argument(
        "--version",
        required=True,
        help="Version number to write into the staged package.",
    )
    parser.add_argument(
        "--staging-dir",
        type=Path,
        help=(
            "Directory to stage the package contents. Defaults to a new temporary directory "
            "if omitted. The directory must be empty when provided."
        ),
    )
    parser.add_argument(
        "--pack-output",
        type=Path,
        help="Path where the generated npm tarball should be written.",
    )
    parser.add_argument(
        "--vendor-src",
        type=Path,
        help=(
            "Directory containing vendor/<target> trees to bundle into the package. "
            "Use codex-cli/vendor after hydrating native dependencies."
        ),
    )
    parser.add_argument(
        "--semantic-model-src",
        type=Path,
        help=(
            "Directory containing bundled semantic model assets to copy into "
            "jasper-core/resources/semantic-models."
        ),
    )
    parser.add_argument(
        "--semantic-runtime-src",
        type=Path,
        help=(
            "Directory containing bundled semantic runtime assets to copy into "
            "jasper-core/resources/semantic-runtime."
        ),
    )
    return parser.parse_args()


def prepare_staging_dir(staging_dir: Path | None) -> tuple[Path, bool]:
    if staging_dir is not None:
        staging_dir = staging_dir.resolve()
        staging_dir.mkdir(parents=True, exist_ok=True)
        if any(staging_dir.iterdir()):
            raise RuntimeError(f"Staging directory {staging_dir} is not empty.")
        return staging_dir, False

    temp_dir = Path(tempfile.mkdtemp(prefix="jasper-npm-stage-"))
    return temp_dir, True


def copy_tree(src: Path, dst: Path) -> None:
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(src, dst)


def resolve_vendor_src(vendor_src: Path | None) -> Path | None:
    if vendor_src is not None:
        vendor_src = vendor_src.resolve()
        if not vendor_src.exists():
            raise RuntimeError(f"Vendor source directory not found: {vendor_src}")
        return vendor_src

    if DEFAULT_VENDOR_SRC.exists() and any(DEFAULT_VENDOR_SRC.iterdir()):
        return DEFAULT_VENDOR_SRC

    return None


def resolve_semantic_model_src(semantic_model_src: Path | None) -> Path | None:
    if semantic_model_src is not None:
        semantic_model_src = semantic_model_src.resolve()
        if not semantic_model_src.exists():
            raise RuntimeError(
                f"Semantic model source directory not found: {semantic_model_src}"
            )
        return semantic_model_src

    if DEFAULT_SEMANTIC_MODEL_SRC.exists() and any(DEFAULT_SEMANTIC_MODEL_SRC.iterdir()):
        return DEFAULT_SEMANTIC_MODEL_SRC

    return None


def resolve_semantic_runtime_src(semantic_runtime_src: Path | None) -> Path | None:
    if semantic_runtime_src is not None:
        semantic_runtime_src = semantic_runtime_src.resolve()
        if not semantic_runtime_src.exists():
            raise RuntimeError(
                f"Semantic runtime source directory not found: {semantic_runtime_src}"
            )
        return semantic_runtime_src

    if DEFAULT_SEMANTIC_RUNTIME_SRC.exists() and any(DEFAULT_SEMANTIC_RUNTIME_SRC.iterdir()):
        return DEFAULT_SEMANTIC_RUNTIME_SRC

    return None


def stage_package(
    staging_dir: Path,
    version: str,
    vendor_src: Path | None,
    semantic_model_src: Path | None,
    semantic_runtime_src: Path | None,
) -> None:
    bin_dir = staging_dir / "bin"
    bin_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(OVERLAY_ROOT / "bin" / "jasper.js", bin_dir / "jasper.js")

    for source_dir in PACKAGE_SOURCE_DIRS:
        copy_tree(REPO_ROOT / source_dir, staging_dir / source_dir)

    readme_src = OVERLAY_ROOT / "README.md"
    if readme_src.exists():
        shutil.copy2(readme_src, staging_dir / "README.md")

    license_src = REPO_ROOT / "LICENSE"
    if license_src.exists():
        shutil.copy2(license_src, staging_dir / "LICENSE")

    if vendor_src is not None:
        copy_tree(vendor_src, staging_dir / "vendor")

    if semantic_model_src is not None:
        semantic_model_dst = (
            staging_dir / "jasper-core" / "resources" / "semantic-models"
        )
        semantic_model_dst.parent.mkdir(parents=True, exist_ok=True)
        copy_tree(semantic_model_src, semantic_model_dst)

    if semantic_runtime_src is not None:
        semantic_runtime_dst = (
            staging_dir / "jasper-core" / "resources" / "semantic-runtime"
        )
        semantic_runtime_dst.parent.mkdir(parents=True, exist_ok=True)
        copy_tree(semantic_runtime_src, semantic_runtime_dst)

    with open(PACKAGE_TEMPLATE_PATH, "r", encoding="utf-8") as handle:
        package_json = json.load(handle)
    package_json["version"] = version

    with open(staging_dir / "package.json", "w", encoding="utf-8") as handle:
        json.dump(package_json, handle, indent=2)
        handle.write("\n")


def run_npm_pack(staging_dir: Path, output_path: Path) -> Path:
    output_path = output_path.resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    result = subprocess.run(
        ["npm", "pack"],
        cwd=staging_dir,
        check=True,
        capture_output=True,
        text=True,
    )
    package_name = result.stdout.strip().splitlines()[-1]
    if not package_name:
        raise RuntimeError("npm pack did not return a package filename.")

    packed_file = staging_dir / package_name
    if not packed_file.exists():
        raise RuntimeError(f"Expected npm pack output was not created: {packed_file}")

    shutil.move(str(packed_file), output_path)
    return output_path


def main() -> int:
    args = parse_args()
    staging_dir, created_temp = prepare_staging_dir(args.staging_dir)
    vendor_src = resolve_vendor_src(args.vendor_src)
    semantic_model_src = resolve_semantic_model_src(args.semantic_model_src)
    semantic_runtime_src = resolve_semantic_runtime_src(args.semantic_runtime_src)

    if args.pack_output is not None and vendor_src is None:
        raise RuntimeError(
            "Cannot emit an installable Jasper package without a bundled native runtime. "
            "Hydrate codex-cli/vendor or pass --vendor-src explicitly."
        )

    try:
        stage_package(
            staging_dir,
            args.version,
            vendor_src,
            semantic_model_src,
            semantic_runtime_src,
        )
        print(f"Staged Jasper package in {staging_dir}")

        if vendor_src is not None:
            print(f"Bundled vendor payload from {vendor_src}")
        else:
            print(
                "No vendor payload was bundled. Identity, memory, tool, and dream commands "
                "will work, but the default Jasper TUI launch requires vendor/ or "
                "JASPER_CODEX_BIN."
            )

        if semantic_model_src is not None:
            print(f"Bundled semantic model assets from {semantic_model_src}")
        else:
            print(
                "No semantic model assets were bundled. Current deterministic memory will work, "
                "but packaged model-based embeddings should ship with local assets."
            )

        if semantic_runtime_src is not None:
            print(f"Bundled semantic runtime assets from {semantic_runtime_src}")
        else:
            print(
                "No semantic runtime assets were bundled. Packaged model-based embeddings will "
                "still need a bundled ONNX runtime before they can replace the deterministic "
                "fallback."
            )

        if args.pack_output is not None:
            output_path = run_npm_pack(staging_dir, args.pack_output)
            print(f"npm pack output written to {output_path}")
    finally:
        if created_temp:
            # Preserve the staging directory for inspection after the command finishes.
            pass

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
