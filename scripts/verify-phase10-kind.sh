#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
kind_bin="${KIND_BIN:-kind}"
helm_bin="${HELM_BIN:-helm}"
cluster_name="buildsphere-phase10-${$}"
namespace="buildsphere"
release_name="buildsphere"
fixture_release="phase10-runtime"
prerequisite_release="buildsphere-prerequisites"
node_image="${KIND_NODE_IMAGE:-kindest/node:v1.34.3@sha256:08497ee19eace7b4b5348db5c6a1591d7752b164530a36f855cb0f2bdcbadd48}"
postgres_base_image="${POSTGRES_BASE_IMAGE:-postgres:16-alpine@sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777}"
postgres_image="${POSTGRES_IMAGE:-buildsphere/phase10-postgres:phase10-local}"
tag="${BUILDSPHERE_IMAGE_TAG:-phase10-local}"
phase12_reliability="${BUILDSPHERE_PHASE12_RELIABILITY:-false}"
phase13_digest_mode="${BUILDSPHERE_PHASE13_DIGEST_MODE:-false}"
phase14_personal_profile="${BUILDSPHERE_PHASE14_PERSONAL_PROFILE:-false}"
temp_dir="$(mktemp -d)"
kubeconfig="${temp_dir}/kubeconfig"
fixture_values="${temp_dir}/fixture-values.yaml"
prerequisite_values="${temp_dir}/prerequisite-values.yaml"
phase14_secrets="${temp_dir}/phase14-secrets.yaml"
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

if [[ "${phase12_reliability}" != "true" && "${phase12_reliability}" != "false" ]]; then
  echo "BUILDSPHERE_PHASE12_RELIABILITY must be true or false" >&2
  exit 1
fi
if [[ "${phase13_digest_mode}" != "true" && "${phase13_digest_mode}" != "false" ]]; then
  echo "BUILDSPHERE_PHASE13_DIGEST_MODE must be true or false" >&2
  exit 1
fi
if [[ "${phase14_personal_profile}" != "true" && "${phase14_personal_profile}" != "false" ]]; then
  echo "BUILDSPHERE_PHASE14_PERSONAL_PROFILE must be true or false" >&2
  exit 1
fi
if [[ "${phase14_personal_profile}" == "true" && "${phase13_digest_mode}" != "true" ]]; then
  echo "The Phase 14 personal profile requires Phase 13 digest mode" >&2
  exit 1
fi
if [[ "${phase14_personal_profile}" == "true" && "${phase12_reliability}" == "true" ]]; then
  echo "The single-node Phase 14 profile cannot enable Phase 12 reliability mode" >&2
  exit 1
fi

reliability_args=()
if [[ "${phase12_reliability}" == "true" ]]; then
  reliability_args=(
    --set replicaCount=2
    --set availability.podDisruptionBudget.enabled=true
    --set networkPolicy.enabled=true
  )
fi

cleanup() {
  local status=$?
  if [[ "${status}" -ne 0 && "${cluster_created}" == true ]]; then
    "${helm_bin}" status "${release_name}" --namespace "${namespace}" --kubeconfig "${kubeconfig}" || true
    if [[ "${phase14_personal_profile}" == "true" ]]; then
      "${helm_bin}" status "${prerequisite_release}" --namespace "${namespace}" --kubeconfig "${kubeconfig}" || true
    else
      "${helm_bin}" status "${fixture_release}" --namespace "${namespace}" --kubeconfig "${kubeconfig}" || true
    fi
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
declare -A image_digests=()
for component in "${components[@]}"; do
  image="buildsphere/${component}:${tag}"
  docker image inspect "${image}" >/dev/null
  image_digest="$(docker image inspect --format '{{.Id}}' "${image}")"
  if [[ ! "${image_digest}" =~ ^sha256:[0-9a-f]{64}$ ]]; then
    echo "Local image ${image} does not expose a sha256 manifest digest" >&2
    exit 1
  fi
  image_digests["${component}"]="${image_digest}"
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
postgres_image_digest="$(docker image inspect --format '{{.Id}}' "${postgres_image}")"
if [[ ! "${postgres_image_digest}" =~ ^sha256:[0-9a-f]{64}$ ]]; then
  echo "Local PostgreSQL image does not expose a sha256 manifest digest" >&2
  exit 1
fi
postgres_repository="${postgres_image%:*}"
postgres_tag="${postgres_image##*:}"
if [[ "${postgres_repository}" == "${postgres_image}" || -z "${postgres_tag}" ]]; then
  echo "POSTGRES_IMAGE must include an explicit tag" >&2
  exit 1
fi
images+=("${postgres_image}")

umask 077
database_password="$(openssl rand -hex 24)"
jwt_access_secret="$(openssl rand -hex 32)"
jwt_refresh_secret="$(openssl rand -hex 32)"
internal_service_token="$(openssl rand -hex 32)"

if [[ "${phase14_personal_profile}" == "true" ]]; then
  cat >"${prerequisite_values}" <<EOF
fullnameOverride: buildsphere-postgres
postgresql:
  image:
    repository: "${postgres_repository}"
    tag: "${postgres_tag}"
    digest: "${postgres_image_digest}"
    pullPolicy: Never
  existingSecret: buildsphere-database
  persistence:
    size: 1Gi
tls:
  enabled: false
EOF

  cat >"${phase14_secrets}" <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: buildsphere-database
  namespace: ${namespace}
type: Opaque
stringData:
  POSTGRES_DB: buildsphere
  POSTGRES_USER: buildsphere
  POSTGRES_PASSWORD: "${database_password}"
---
apiVersion: v1
kind: Secret
metadata:
  name: buildsphere-runtime
  namespace: ${namespace}
type: Opaque
stringData:
  POSTGRES_DB: buildsphere
  POSTGRES_USER: buildsphere
  POSTGRES_PASSWORD: "${database_password}"
  DATABASE_URL: "postgresql://buildsphere:${database_password}@buildsphere-postgres:5432/buildsphere"
  JWT_ACCESS_TOKEN_SECRET: "${jwt_access_secret}"
  JWT_REFRESH_TOKEN_SECRET: "${jwt_refresh_secret}"
  INTERNAL_SERVICE_TOKEN: "${internal_service_token}"
EOF
else
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
fi

cat >"${buildsphere_values}" <<EOF
publicUrl: http://buildsphere.local
image:
  repositoryPrefix: buildsphere
  tag: "${tag}"
  pullPolicy: Never
  digestMode: ${phase13_digest_mode}
  digests:
EOF
for component in "${components[@]}"; do
  printf '    %s: "%s"\n' "${component}" "${image_digests[${component}]}" >>"${buildsphere_values}"
done
cat >>"${buildsphere_values}" <<EOF
runtime:
  existingSecret: buildsphere-runtime
  logLevel: info
  pipelineStageDelayMs: 25
ingress:
  enabled: false
EOF

application_profile_args=()
if [[ "${phase14_personal_profile}" == "true" ]]; then
  application_profile_args=(
    --values "${repo_root}/infrastructure/deployment/free-tier/buildsphere-values.example.yaml"
  )
fi

"${kind_bin}" create cluster \
  --name "${cluster_name}" \
  --image "${node_image}" \
  --kubeconfig "${kubeconfig}" \
  --wait 180s
cluster_created=true

for image in "${images[@]}"; do
  "${kind_bin}" load docker-image --name "${cluster_name}" "${image}"
done
if [[ "${phase13_digest_mode}" == "true" ]]; then
  for component in "${components[@]}"; do
    docker exec "${cluster_name}-control-plane" \
      ctr --namespace k8s.io images tag \
      "docker.io/buildsphere/${component}:${tag}" \
      "docker.io/buildsphere/${component}@${image_digests[${component}]}"
  done
fi
if [[ "${phase14_personal_profile}" == "true" ]]; then
  docker exec "${cluster_name}-control-plane" \
    ctr --namespace k8s.io images tag \
    "docker.io/${postgres_image}" \
    "docker.io/${postgres_repository}@${postgres_image_digest}"
fi

if [[ "${phase14_personal_profile}" == "true" ]]; then
  docker exec "${cluster_name}-control-plane" \
    kubectl --kubeconfig=/etc/kubernetes/admin.conf \
    create namespace "${namespace}"
  docker exec --interactive "${cluster_name}-control-plane" \
    kubectl --kubeconfig=/etc/kubernetes/admin.conf \
    apply --filename - <"${phase14_secrets}"
  "${helm_bin}" install "${prerequisite_release}" \
    "${repo_root}/infrastructure/helm/buildsphere-personal-prerequisites" \
    --namespace "${namespace}" \
    --kubeconfig "${kubeconfig}" \
    --values "${prerequisite_values}" \
    --wait \
    --timeout 3m
  "${helm_bin}" test "${prerequisite_release}" \
    --namespace "${namespace}" \
    --kubeconfig "${kubeconfig}" \
    --logs \
    --timeout 2m
else
  "${helm_bin}" install "${fixture_release}" \
    "${repo_root}/scripts/fixtures/phase10-runtime" \
    --namespace "${namespace}" \
    --create-namespace \
    --kubeconfig "${kubeconfig}" \
    --values "${fixture_values}" \
    --wait \
    --timeout 3m
fi

"${helm_bin}" install "${release_name}" \
  "${repo_root}/infrastructure/helm/buildsphere" \
  --namespace "${namespace}" \
  --kubeconfig "${kubeconfig}" \
  "${application_profile_args[@]}" \
  --values "${buildsphere_values}" \
  "${reliability_args[@]}" \
  --wait \
  --timeout 5m

"${helm_bin}" test "${release_name}" \
  --namespace "${namespace}" \
  --kubeconfig "${kubeconfig}" \
  --logs \
  --timeout 2m

if [[ "${phase14_personal_profile}" == "true" ]]; then
  "${helm_bin}" upgrade "${prerequisite_release}" \
    "${repo_root}/infrastructure/helm/buildsphere-personal-prerequisites" \
    --namespace "${namespace}" \
    --kubeconfig "${kubeconfig}" \
    --values "${prerequisite_values}" \
    --wait \
    --timeout 3m
  "${helm_bin}" test "${prerequisite_release}" \
    --namespace "${namespace}" \
    --kubeconfig "${kubeconfig}" \
    --logs \
    --timeout 2m
fi

"${helm_bin}" upgrade "${release_name}" \
  "${repo_root}/infrastructure/helm/buildsphere" \
  --namespace "${namespace}" \
  --kubeconfig "${kubeconfig}" \
  "${application_profile_args[@]}" \
  --values "${buildsphere_values}" \
  "${reliability_args[@]}" \
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

if [[ "${phase14_personal_profile}" == "true" ]]; then
  echo "Phase 14 personal prerequisites, digest-pinned install, smoke, and upgrade verification passed."
elif [[ "${phase13_digest_mode}" == "true" ]]; then
  echo "Phase 13 digest-pinned install, reliability, smoke, and upgrade verification passed."
elif [[ "${phase12_reliability}" == "true" ]]; then
  echo "Phase 12 two-replica, disruption-budget, network-policy, smoke, and upgrade verification passed."
else
  echo "Phase 10 kind install, migration, smoke, and upgrade verification passed."
fi
