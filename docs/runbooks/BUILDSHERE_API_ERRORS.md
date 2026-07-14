# BuildSphere API Server Errors

Alert: `BuildSphereApiGatewayHighServerErrorRatio`

## Impact

The API Gateway five-minute 5xx ratio has exceeded the configured fast-burn
threshold for ten minutes. The platform is consuming its 30-day availability
error budget much faster than planned.

## Confirm

1. Check the API availability and request-rate dashboard panels to distinguish
   a real error spike from near-zero traffic.
2. Break down `buildsphere_http_requests_total` by safe route template and
   status code.
3. Correlate Gateway `SERVICE_UNAVAILABLE` responses with the target service's
   health, restart, and latency metrics.
4. Compare the incident start with Helm revisions, migrations, dependency
   changes, and provider status.

## Mitigate

1. Stop release promotion while the alert is active.
2. Restore or isolate the failing internal dependency when errors are
   concentrated behind one proxy route.
3. Roll back the latest approved release when evidence ties it to the spike.
4. Protect data integrity first; do not retry mutating requests manually unless
   their documented idempotency contract permits it.

## Recover

- The five-minute server-error ratio remains below `0.0144` for ten minutes.
- Service health and Gateway p95 latency are normal.
- Representative authenticated read and write workflows pass.
- The incident record includes consumed error budget and corrective action.
