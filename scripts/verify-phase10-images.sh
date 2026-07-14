#!/usr/bin/env sh
set -eu

TAG="${PHASE10_IMAGE_TAG:-phase10-local}"
BACKEND_DOCKERFILE="infrastructure/docker/Dockerfile.backend"

while read -r service port; do
  [ -n "${service}" ] || continue
  docker build \
    --file "${BACKEND_DOCKERFILE}" \
    --build-arg "SERVICE=${service}" \
    --build-arg "SERVICE_PORT=${port}" \
    --tag "buildsphere/${service}:${TAG}" \
    .
done <<'SERVICES'
api-gateway 8080
auth-service 8081
project-service 8082
pipeline-service 8083
deployment-service 8084
monitoring-service 8085
logging-service 8086
ai-service 8087
analytics-service 8088
notification-service 8089
SERVICES

docker build \
  --file infrastructure/docker/Dockerfile.frontend \
  --build-arg VITE_API_URL=/api \
  --tag "buildsphere/frontend:${TAG}" \
  .
