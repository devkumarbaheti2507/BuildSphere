#!/usr/bin/env sh
set -eu

KUBECTL_BIN="${KUBECTL_BIN:-kubectl}"
NAMESPACE="${BUILDSPHERE_NAMESPACE:-buildsphere}"
DATABASE_SECRET="buildsphere-database"
RUNTIME_SECRET="buildsphere-runtime"
POSTGRES_SERVICE="buildsphere-postgres"

fail() {
  printf 'Error: %s\n' "$1" >&2
  exit 1
}

command -v "${KUBECTL_BIN}" >/dev/null 2>&1 || fail "kubectl is required"
command -v openssl >/dev/null 2>&1 || fail "openssl is required"
command -v base64 >/dev/null 2>&1 || fail "base64 is required"

case "${NAMESPACE}" in
  ''|*[!a-z0-9-]*|-*|*-) fail "BUILDSPHERE_NAMESPACE must be a lowercase DNS label" ;;
esac
[ "${#NAMESPACE}" -le 63 ] || fail "BUILDSPHERE_NAMESPACE must be at most 63 characters"

CURRENT_CONTEXT="$(${KUBECTL_BIN} config current-context 2>/dev/null)" ||
  fail "kubectl has no readable current context"
[ -n "${CURRENT_CONTEXT}" ] || fail "kubectl current context is empty"
[ "${BUILDSPHERE_CONFIRM_CONTEXT:-}" = "${CURRENT_CONTEXT}" ] ||
  fail "set BUILDSPHERE_CONFIRM_CONTEXT exactly to '${CURRENT_CONTEXT}'"

if [ -n "${GITHUB_CLIENT_ID:-}" ] && [ -z "${GITHUB_CLIENT_SECRET:-}" ]; then
  fail "GITHUB_CLIENT_SECRET is required with GITHUB_CLIENT_ID"
fi
if [ -z "${GITHUB_CLIENT_ID:-}" ] && [ -n "${GITHUB_CLIENT_SECRET:-}" ]; then
  fail "GITHUB_CLIENT_ID is required with GITHUB_CLIENT_SECRET"
fi

if ! "${KUBECTL_BIN}" get namespace "${NAMESPACE}" >/dev/null 2>&1; then
  "${KUBECTL_BIN}" create namespace "${NAMESPACE}" >/dev/null
fi

for secret in "${DATABASE_SECRET}" "${RUNTIME_SECRET}"; do
  if "${KUBECTL_BIN}" --namespace "${NAMESPACE}" get secret "${secret}" >/dev/null 2>&1; then
    fail "Secret ${NAMESPACE}/${secret} already exists; refusing implicit rotation"
  fi
done

random_hex() {
  openssl rand -hex "$1"
}

encode() {
  printf '%s' "$1" | base64 | tr -d '\n'
}

POSTGRES_DB="buildsphere"
POSTGRES_USER="buildsphere"
POSTGRES_PASSWORD="$(random_hex 24)"
DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_SERVICE}:5432/${POSTGRES_DB}"
JWT_ACCESS_TOKEN_SECRET="$(random_hex 32)"
JWT_REFRESH_TOKEN_SECRET="$(random_hex 32)"
INTERNAL_SERVICE_TOKEN="$(random_hex 32)"

DB_DATA=$(printf '"POSTGRES_DB":"%s","POSTGRES_USER":"%s","POSTGRES_PASSWORD":"%s"' \
  "$(encode "${POSTGRES_DB}")" \
  "$(encode "${POSTGRES_USER}")" \
  "$(encode "${POSTGRES_PASSWORD}")")

RUNTIME_DATA=$(printf '"DATABASE_URL":"%s","POSTGRES_DB":"%s","POSTGRES_USER":"%s","POSTGRES_PASSWORD":"%s","JWT_ACCESS_TOKEN_SECRET":"%s","JWT_REFRESH_TOKEN_SECRET":"%s","INTERNAL_SERVICE_TOKEN":"%s"' \
  "$(encode "${DATABASE_URL}")" \
  "$(encode "${POSTGRES_DB}")" \
  "$(encode "${POSTGRES_USER}")" \
  "$(encode "${POSTGRES_PASSWORD}")" \
  "$(encode "${JWT_ACCESS_TOKEN_SECRET}")" \
  "$(encode "${JWT_REFRESH_TOKEN_SECRET}")" \
  "$(encode "${INTERNAL_SERVICE_TOKEN}")")

if [ -n "${GITHUB_CLIENT_ID:-}" ]; then
  GITHUB_OAUTH_STATE_SECRET="$(random_hex 32)"
  GITHUB_TOKEN_ENCRYPTION_KEY="$(openssl rand -base64 32 | tr -d '\n')"
  RUNTIME_DATA="${RUNTIME_DATA},$(printf '"GITHUB_CLIENT_ID":"%s","GITHUB_CLIENT_SECRET":"%s","GITHUB_OAUTH_STATE_SECRET":"%s","GITHUB_TOKEN_ENCRYPTION_KEY":"%s"' \
    "$(encode "${GITHUB_CLIENT_ID}")" \
    "$(encode "${GITHUB_CLIENT_SECRET}")" \
    "$(encode "${GITHUB_OAUTH_STATE_SECRET}")" \
    "$(encode "${GITHUB_TOKEN_ENCRYPTION_KEY}")")"
fi

SECRET_LIST=$(printf '{"apiVersion":"v1","kind":"List","items":[{"apiVersion":"v1","kind":"Secret","metadata":{"name":"%s","namespace":"%s"},"type":"Opaque","data":{%s}},{"apiVersion":"v1","kind":"Secret","metadata":{"name":"%s","namespace":"%s"},"type":"Opaque","data":{%s}}]}\n' \
  "${DATABASE_SECRET}" "${NAMESPACE}" "${DB_DATA}" \
  "${RUNTIME_SECRET}" "${NAMESPACE}" "${RUNTIME_DATA}")

if ! printf '%s\n' "${SECRET_LIST}" |
  "${KUBECTL_BIN}" create --dry-run=server -f - >/dev/null; then
  fail "Kubernetes rejected the generated Secrets during server dry-run"
fi
if ! printf '%s\n' "${SECRET_LIST}" |
  "${KUBECTL_BIN}" create -f - >/dev/null; then
  fail "Secret creation failed; no existing Secret was modified"
fi

unset POSTGRES_PASSWORD DATABASE_URL JWT_ACCESS_TOKEN_SECRET
unset JWT_REFRESH_TOKEN_SECRET INTERNAL_SERVICE_TOKEN DB_DATA RUNTIME_DATA
unset GITHUB_OAUTH_STATE_SECRET GITHUB_TOKEN_ENCRYPTION_KEY SECRET_LIST

printf 'Created %s and %s in namespace %s on context %s.\n' \
  "${DATABASE_SECRET}" "${RUNTIME_SECRET}" "${NAMESPACE}" "${CURRENT_CONTEXT}"
