#!/usr/bin/env sh
set -eu

TAG="${PHASE10_IMAGE_TAG:-phase10-local}"
RUN_ID="$$"
containers=""

cleanup() {
  for container in ${containers}; do
    docker rm --force "${container}" >/dev/null 2>&1 || true
  done
}
trap cleanup EXIT INT TERM

start_backend() {
  service="$1"
  name="buildsphere-phase10-${service}-${RUN_ID}"
  docker run --detach --rm \
    --name "${name}" \
    --read-only \
    --tmpfs /tmp:rw,noexec,nosuid,size=64m \
    --cap-drop ALL \
    --security-opt no-new-privileges \
    --env STORAGE_DRIVER=memory \
    --env JWT_ACCESS_TOKEN_SECRET=phase10-smoke-access-secret \
    --env JWT_REFRESH_TOKEN_SECRET=phase10-smoke-refresh-secret \
    --env INTERNAL_SERVICE_TOKEN=phase10-smoke-internal-secret \
    --env KUBERNETES_EXECUTION_ENABLED=false \
    "buildsphere/${service}:${TAG}" >/dev/null
  containers="${containers} ${name}"
}

for service in \
  api-gateway \
  auth-service \
  project-service \
  pipeline-service \
  deployment-service \
  monitoring-service \
  logging-service \
  ai-service \
  analytics-service \
  notification-service; do
  start_backend "${service}"
done

frontend_name="buildsphere-phase10-frontend-${RUN_ID}"
docker run --detach --rm \
  --name "${frontend_name}" \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=32m \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  "buildsphere/frontend:${TAG}" >/dev/null
containers="${containers} ${frontend_name}"

attempt=0
while [ "${attempt}" -lt 45 ]; do
  pending=false
  for container in ${containers}; do
    status="$(docker inspect --format '{{.State.Status}}' "${container}")"
    health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' "${container}")"
    if [ "${status}" = "exited" ] || [ "${status}" = "dead" ] || [ "${health}" = "unhealthy" ]; then
      docker logs "${container}" || true
      echo "${container} failed with status=${status} health=${health}" >&2
      exit 1
    fi
    if [ "${health}" != "healthy" ]; then
      pending=true
    fi
  done

  if [ "${pending}" = "false" ]; then
    break
  fi
  attempt=$((attempt + 1))
  sleep 1
done

if [ "${attempt}" -ge 45 ]; then
  echo "Phase 10 images did not become healthy within 45 seconds" >&2
  exit 1
fi

for service in \
  api-gateway \
  auth-service \
  project-service \
  pipeline-service \
  deployment-service \
  monitoring-service \
  logging-service \
  ai-service \
  analytics-service \
  notification-service \
  frontend; do
  user="$(docker image inspect --format '{{.Config.User}}' "buildsphere/${service}:${TAG}")"
  case "${user}" in
    ""|0|root)
      echo "buildsphere/${service}:${TAG} does not declare a non-root user" >&2
      exit 1
      ;;
  esac
done

printf '%s\n' "Phase 10 image smoke passed for 10 backend services and the frontend."
