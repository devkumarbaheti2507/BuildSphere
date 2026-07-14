#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
kind_bin="${KIND_BIN:-kind}"
helm_bin="${HELM_BIN:-helm}"
cluster_name="buildsphere-phase10-${$}"
namespace="buildsphere"
release_name="buildsphere"
fixture_release="phase10-runtime"
node_image="${KIND_NODE_IMAGE:-kindest/node:v1.34.3@sha256:08497ee19eace7b4b5348db5c6a1591d7752b164530a36f855cb0f2bdcbadd48}"
postgres_base_image="${POSTGRES_BASE_IMAGE:-postgres:16-alpine@sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777}"
postgres_image="${POSTGRES_IMAGE:-buildsphere/phase10-postgres:phase10-local}"
tag="${BUILDSPHERE_IMAGE_TAG:-phase10-local}"
temp_dir="$(mktemp -d)"
kubeconfig="${temp_dir}/kubeconfig"
fixture_values="${temp_dir}/fixture-values.yaml"
buildsphere_values="${temp_dir}/buildsphere-values.yaml"
cluster_created=false

components=(
  ai-service
  analytics-service
  api-gateway
  auth-service
  deployment-service
  frontend
  logging-service
  monitoring-service
  notification-service
  pipeline-service
  project-service
)

cleanup() {
  local status=$?
  if [[ "${status}" -ne 0 && "${cluster_created}" == true ]]; then
    "${helm_bin}" status "${release_name}" --namespace "${namespace}" --kubeconfig "${kubeconfig}" || true
    "${helm_bin}" status "${fixture_release}" --namespace "${namespace}" --kubeconfig "${kubeconfig}" || true
    docker exec "${cluster_name}-control-plane" \
      kubectl --kubeconfig=/etc/kubernetes/admin.conf \
      --namespace "${namespace}" get pods --output wide || true
    docker exec "${cluster_name}-control-plane" \
      kubectl --kubeconfig=/etc/kubernetes/admin.conf \
      --namespace "${namespace}" logs \
      --selector app.kubernetes.io/component=migration \
      --all-containers=true \
      --prefix=true \
      --tail=200 || true
    docker exec "${cluster_name}-control-plane" \
      kubectl --kubeconfig=/etc/kubernetes/admin.conf \
      --namespace "${namespace}" describe job \
      "${release_name}-buildsphere-migrate" || true
  fi
  if [[ "${cluster_created}" == true ]]; then
    "${kind_bin}" delete cluster --name "${cluster_name}" || true
  fi
  rm -rf "${temp_dir}"
  exit "${status}"
}
trap cleanup EXIT

command -v "${kind_bin}" >/dev/null
command -v "${helm_bin}" >/dev/null
command -v docker >/dev/null
command -v openssl >/dev/null

images=()
for component in "${components[@]}"; do
  image="buildsphere/${component}:${tag}"
  docker image inspect "${image}" >/dev/null
  images+=("${image}")
done
docker image inspect "${postgres_base_image}" >/dev/null
docker build \
  --provenance=false \
  --build-arg "POSTGRES_BASE_IMAGE=${postgres_base_image}" \
  --tag "${postgres_image}" \
  --file "${repo_root}/scripts/fixtures/phase10-runtime/Dockerfile.postgres" \
  "${repo_root}/scripts/fixtures/phase10-runtime"
docker image inspect "${postgres_image}" >/dev/null
images+=("${postgres_image}")

umask 077
database_password="$(openssl rand -hex 24)"
jwt_access_secret="$(openssl rand -hex 32)"
jwt_refresh_secret="$(openssl rand -hex 32)"
internal_service_token="$(openssl rand -hex 32)"

cat >"${fixture_values}" <<EOF
image:
  reference: "${postgres_image}"
runtimeSecret:
  name: buildsphere-runtime
  databaseName: buildsphere
  databaseUser: buildsphere
  databasePassword: "${database_password}"
  jwtAccessTokenSecret: "${jwt_access_secret}"
  jwtRefreshTokenSecret: "${jwt_refresh_secret}"
  internalServiceToken: "${internal_service_token}"
EOF

cat >"${buildsphere_values}" <<EOF
publicUrl: http://buildsphere.local
image:
  repositoryPrefix: buildsphere
  tag: "${tag}"
  pullPolicy: Never
runtime:
  existingSecret: buildsphere-runtime
  logLevel: info
  pipelineStageDelayMs: 25
ingress:
  enabled: false
EOF

"${kind_bin}" create cluster \
  --name "${cluster_name}" \
  --image "${node_image}" \
  --kubeconfig "${kubeconfig}" \
  --wait 180s
cluster_created=true

for image in "${images[@]}"; do
  "${kind_bin}" load docker-image --name "${cluster_name}" "${image}"
done

"${helm_bin}" install "${fixture_release}" \
  "${repo_root}/scripts/fixtures/phase10-runtime" \
  --namespace "${namespace}" \
  --create-namespace \
  --kubeconfig "${kubeconfig}" \
  --values "${fixture_values}" \
  --wait \
  --timeout 3m

"${helm_bin}" install "${release_name}" \
  "${repo_root}/infrastructure/helm/buildsphere" \
  --namespace "${namespace}" \
  --kubeconfig "${kubeconfig}" \
  --values "${buildsphere_values}" \
  --wait \
  --timeout 5m

"${helm_bin}" test "${release_name}" \
  --namespace "${namespace}" \
  --kubeconfig "${kubeconfig}" \
  --logs \
  --timeout 2m

"${helm_bin}" upgrade "${release_name}" \
  "${repo_root}/infrastructure/helm/buildsphere" \
  --namespace "${namespace}" \
  --kubeconfig "${kubeconfig}" \
  --values "${buildsphere_values}" \
  --set runtime.pipelineStageDelayMs=26 \
  --wait \
  --timeout 5m

"${helm_bin}" test "${release_name}" \
  --namespace "${namespace}" \
  --kubeconfig "${kubeconfig}" \
  --logs \
  --timeout 2m

"${helm_bin}" history "${release_name}" \
  --namespace "${namespace}" \
  --kubeconfig "${kubeconfig}"

echo "Phase 10 kind install, migration, smoke, and upgrade verification passed."
