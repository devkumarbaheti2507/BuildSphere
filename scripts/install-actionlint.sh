#!/usr/bin/env sh
set -eu

ACTIONLINT_VERSION="1.7.12"
ACTIONLINT_LINUX_AMD64_SHA256="8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8"
INSTALL_DIR="${1:-${RUNNER_TEMP:-/tmp}/buildsphere-actionlint}"
ARCHIVE="actionlint_${ACTIONLINT_VERSION}_linux_amd64.tar.gz"
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
  "${ACTIONLINT_LINUX_AMD64_SHA256}" \
  "${TEMP_DIR}/${ARCHIVE}" | sha256sum --check --strict
tar --extract --gzip --file "${TEMP_DIR}/${ARCHIVE}" \
  --directory "${TEMP_DIR}" actionlint
install -m 0755 "${TEMP_DIR}/actionlint" "${INSTALL_DIR}/actionlint"

"${INSTALL_DIR}/actionlint" -version
