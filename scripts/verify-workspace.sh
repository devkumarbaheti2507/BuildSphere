#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "${SCRIPT_DIR}/.." && pwd)

cd "${REPO_ROOT}"

"${SCRIPT_DIR}/check-toolchain.sh"
"${SCRIPT_DIR}/pnpm-workspace.sh" install --frozen-lockfile=false
"${SCRIPT_DIR}/pnpm-workspace.sh" -r build
"${SCRIPT_DIR}/pnpm-workspace.sh" -r test
