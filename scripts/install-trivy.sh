#!/usr/bin/env sh
set -eu

TRIVY_VERSION="0.70.0"
TRIVY_LINUX_AMD64_SHA256="8b4376d5d6befe5c24d503f10ff136d9e0c49f9127a4279fd110b727929a5aa9"
TRIVY_LINUX_ARM64_SHA256="2f6bb988b553a1bbac6bdd1ce890f5e412439564e17522b88a4541b4f364fc8d"
INSTALL_DIR="${1:-${RUNNER_TEMP:-/tmp}/buildsphere-trivy}"

case "$(uname -m)" in
  x86_64|amd64)
    ARCHIVE="trivy_${TRIVY_VERSION}_Linux-64bit.tar.gz"
    ARCHIVE_SHA256="${TRIVY_LINUX_AMD64_SHA256}"
    ;;
  aarch64|arm64)
    ARCHIVE="trivy_${TRIVY_VERSION}_Linux-ARM64.tar.gz"
    ARCHIVE_SHA256="${TRIVY_LINUX_ARM64_SHA256}"
    ;;
  *)
    printf 'Unsupported architecture: %s\n' "$(uname -m)" >&2
    exit 1
    ;;
esac

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
  "${ARCHIVE_SHA256}" \
  "${TEMP_DIR}/${ARCHIVE}" | sha256sum --check --strict
tar --extract --gzip --file "${TEMP_DIR}/${ARCHIVE}" \
  --directory "${TEMP_DIR}" trivy
install -m 0755 "${TEMP_DIR}/trivy" "${INSTALL_DIR}/trivy"

"${INSTALL_DIR}/trivy" --version
