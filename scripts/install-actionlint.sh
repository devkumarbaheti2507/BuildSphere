#!/usr/bin/env sh
set -eu

ACTIONLINT_VERSION="1.7.12"
ACTIONLINT_LINUX_AMD64_SHA256="8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8"
ACTIONLINT_LINUX_ARM64_SHA256="325e971b6ba9bfa504672e29be93c24981eeb1c07576d730e9f7c8805afff0c6"
INSTALL_DIR="${1:-${RUNNER_TEMP:-/tmp}/buildsphere-actionlint}"

case "$(uname -m)" in
  x86_64|amd64)
    ARCHIVE="actionlint_${ACTIONLINT_VERSION}_linux_amd64.tar.gz"
    ARCHIVE_SHA256="${ACTIONLINT_LINUX_AMD64_SHA256}"
    ;;
  aarch64|arm64)
    ARCHIVE="actionlint_${ACTIONLINT_VERSION}_linux_arm64.tar.gz"
    ARCHIVE_SHA256="${ACTIONLINT_LINUX_ARM64_SHA256}"
    ;;
  *)
    printf 'Unsupported architecture: %s\n' "$(uname -m)" >&2
    exit 1
    ;;
esac

DOWNLOAD_URL="https://github.com/rhysd/actionlint/releases/download/v${ACTIONLINT_VERSION}/${ARCHIVE}"
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
  --directory "${TEMP_DIR}" actionlint
install -m 0755 "${TEMP_DIR}/actionlint" "${INSTALL_DIR}/actionlint"

"${INSTALL_DIR}/actionlint" -version
