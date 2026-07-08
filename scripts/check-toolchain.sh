#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "${SCRIPT_DIR}/.." && pwd)
EXPECTED_NODE_MAJOR=$(sed -n '1p' "${REPO_ROOT}/.nvmrc")

if command -v node >/dev/null 2>&1; then
  NODE_VERSION=$(node --version)
  NODE_MAJOR=$(printf '%s' "${NODE_VERSION}" | sed 's/^v//' | sed 's/[.].*//')
  if [ "${NODE_MAJOR}" != "${EXPECTED_NODE_MAJOR}" ]; then
    echo "Warning: BuildSphere prefers Node ${EXPECTED_NODE_MAJOR}; current shell uses ${NODE_VERSION}." >&2
  fi
else
  echo "Warning: node was not found on PATH." >&2
fi

if ! command -v pnpm >/dev/null 2>&1 && ! command -v corepack >/dev/null 2>&1; then
  echo "Info: pnpm/corepack not found; scripts/pnpm-workspace.sh will use npm exec fallback." >&2
fi
