#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "${SCRIPT_DIR}/.." && pwd)
TEMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/buildsphere-phase14-arm64.XXXXXX")

cleanup() {
  rm -rf "${TEMP_DIR}"
}
trap cleanup EXIT HUP INT TERM

command -v docker >/dev/null 2>&1 || {
  printf 'Docker is required for the ARM64 image check.\n' >&2
  exit 1
}
docker buildx version >/dev/null

cd "${REPO_ROOT}"

docker buildx build \
  --platform linux/arm64 \
  --file infrastructure/docker/Dockerfile.backend \
  --build-arg SERVICE=api-gateway \
  --build-arg SERVICE_PORT=8080 \
  --build-arg BUILD_VERSION=phase14-local \
  --build-arg BUILD_REVISION=0000000000000000000000000000000000000000 \
  --build-arg BUILD_SOURCE=https://github.com/example/buildsphere \
  --build-arg BUILD_LICENSES=MIT \
  --provenance=false \
  --sbom=false \
  --output "type=oci,dest=${TEMP_DIR}/api-gateway-linux-arm64.tar" \
  .

docker buildx build \
  --platform linux/arm64 \
  --file infrastructure/docker/Dockerfile.frontend \
  --build-arg VITE_API_URL=/api \
  --build-arg BUILD_VERSION=phase14-local \
  --build-arg BUILD_REVISION=0000000000000000000000000000000000000000 \
  --build-arg BUILD_SOURCE=https://github.com/example/buildsphere \
  --build-arg BUILD_LICENSES=MIT \
  --provenance=false \
  --sbom=false \
  --output "type=oci,dest=${TEMP_DIR}/frontend-linux-arm64.tar" \
  .

test -s "${TEMP_DIR}/api-gateway-linux-arm64.tar"
test -s "${TEMP_DIR}/frontend-linux-arm64.tar"

printf 'Representative backend and frontend linux/arm64 builds passed.\n'
