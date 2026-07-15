#!/usr/bin/env sh
set -eu

TRIVY_VERSION="0.70.0"
TRIVY_LINUX_AMD64_SHA256="8b4376d5d6befe5c24d503f10ff136d9e0c49f9127a4279fd110b727929a5aa9"
INSTALL_DIR="${1:-${RUNNER_TEMP:-/tmp}/buildsphere-trivy}"
ARCHIVE="trivy_${TRIVY_VERSION}_Linux-64bit.tar.gz"
DOWNLOAD_URL="https://github.com/aquasecurity/trivy/releases/download/v${TRIVY_VERSION}/${ARCHIVE}"
TEMP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "${TEMP_DIR}"
}
trap cleanup EXIT HUP INT TERM

mkdir -p "${INSTALL_DIR}"
curl --fail --location --silent --show-error \
  --output "${TEMP_DIR}/${ARCHIVE}" \
  "${DOWNLOAD_URL}"
printf '%s  %s\n' \
  "${TRIVY_LINUX_AMD64_SHA256}" \
  "${TEMP_DIR}/${ARCHIVE}" | sha256sum --check --strict
tar --extract --gzip --file "${TEMP_DIR}/${ARCHIVE}" \
  --directory "${TEMP_DIR}" trivy
install -m 0755 "${TEMP_DIR}/trivy" "${INSTALL_DIR}/trivy"

"${INSTALL_DIR}/trivy" --version
