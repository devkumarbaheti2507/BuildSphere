# BuildSphere API Latency

Alert: `BuildSphereApiGatewayHighLatency`

## Impact

API Gateway p95 latency has exceeded 750 ms for ten minutes. Requests may still
succeed, but interactive workflows can feel slow and may approach upstream or
client timeout limits.

## Confirm

1. Compare p50, p95, request rate, in-flight requests, memory, and event-loop
   lag for API Gateway and the target services.
2. Break down the duration histogram by safe route template.
3. Check PostgreSQL connection pressure and query latency using the external
   database operator's approved tooling.
4. Check for CPU throttling, memory pressure, restarts, provider latency, or a
   release that changed request volume or work per request.

## Mitigate

1. Pause promotion and reduce avoidable background or test traffic.
2. Restore a degraded dependency or roll back a clearly correlated release.
3. Scale only within approved capacity policy; Phase 11 does not define
   automatic scaling.
4. Escalate before changing database limits, timeouts, or retry policy during
   an active incident.

## Recover

- API Gateway p95 remains at or below 750 ms for at least ten minutes.
- In-flight requests and event-loop lag return to normal ranges.
- No compensating rise in 5xx errors appears.
- Record the bottleneck, mitigation, and capacity or code follow-up.
