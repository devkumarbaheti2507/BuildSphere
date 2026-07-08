#!/usr/bin/env sh
set -eu

PNPM_VERSION="9.15.0"
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "${SCRIPT_DIR}/.." && pwd)

if command -v pnpm >/dev/null 2>&1; then
  exec pnpm "$@"
fi

if command -v corepack >/dev/null 2>&1; then
  corepack enable
  exec pnpm "$@"
fi

NPM_CONFIG_CACHE="${NPM_CONFIG_CACHE:-${REPO_ROOT}/.cache/npm}"
for CACHED_PNPM in "${NPM_CONFIG_CACHE}"/_npx/*/node_modules/pnpm/bin/pnpm.cjs; do
  if [ -f "${CACHED_PNPM}" ] && [ "$(node "${CACHED_PNPM}" --version)" = "${PNPM_VERSION}" ]; then
    exec node "${CACHED_PNPM}" "$@"
  fi
done

if command -v npm >/dev/null 2>&1; then
  export NPM_CONFIG_CACHE
  mkdir -p "${NPM_CONFIG_CACHE}"
  exec npm exec --yes "pnpm@${PNPM_VERSION}" -- "$@"
fi

echo "BuildSphere requires pnpm ${PNPM_VERSION}." >&2
echo "Install Node.js 22 with Corepack, or install pnpm before running workspace commands." >&2
exit 1
