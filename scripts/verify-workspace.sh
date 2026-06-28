#!/usr/bin/env sh
set -eu

corepack enable
pnpm install --frozen-lockfile=false
pnpm -r build
pnpm -r test
