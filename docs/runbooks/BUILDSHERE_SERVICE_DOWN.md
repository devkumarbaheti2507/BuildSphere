# BuildSphere Service Down

Alert: `BuildSphereServiceDown`

## Impact

Monitoring Service has failed to reach one backend health endpoint for at least
five minutes. User impact depends on the named service; API Gateway or Auth
Service failures can block most workflows, while a specialized service may
degrade only its owning feature.

## Confirm

1. Identify the `service`, `namespace`, `pod`, and release revision from the
   alert and dashboard.
2. Compare `buildsphere_service_up` with Kubernetes readiness and restart
   state.
3. Check recent structured logs using the correlation IDs around the failure
   window.
4. Check external PostgreSQL reachability and the affected service's configured
   internal dependencies without printing credentials.

## Mitigate

1. If only one replica is unhealthy, remove it from service and allow the
   Deployment controller to replace it.
2. If failure began with the latest Helm revision, pause further promotion and
   follow the approved release rollback procedure.
3. If a dependency is unavailable, restore that dependency before repeatedly
   restarting healthy application pods.
4. Escalate when data integrity, credential rotation, or an external provider
   is implicated.

## Recover

- The affected Deployment is available and ready.
- Its `/health` endpoint is stable for at least ten minutes.
- `buildsphere_service_up` returns to `1` from Monitoring Service.
- API errors and latency return to their pre-incident range.
- Record the root cause, mitigation, and follow-up action.
