# BuildSphere Production Runbooks

These runbooks support the Phase 11 alert rules in the production Helm chart.
They are environment-neutral; alert routing, dashboards, cluster access, and
credentials remain operator responsibilities.

## Service-level objectives

The primary API SLO is evaluated at API Gateway over a rolling 30-day window:

- Availability: 99.9% of eligible requests do not return 5xx.
- Latency: 95% of eligible requests complete within 750 ms.
- Health checks and unmatched routes are excluded from the API SLO.

The 99.9% availability objective allows approximately 43 minutes and 12 seconds
of equivalent full unavailability in a 30-day period. The critical error-ratio
alert threshold is `0.0144`, representing a 14.4-times fast burn of the 0.1%
error budget over the five-minute signal.

## Alert index

| Alert                                       | Runbook                      |
| ------------------------------------------- | ---------------------------- |
| `BuildSphereServiceDown`                    | `BUILDSHERE_SERVICE_DOWN.md` |
| `BuildSphereApiGatewayHighServerErrorRatio` | `BUILDSHERE_API_ERRORS.md`   |
| `BuildSphereApiGatewayHighLatency`          | `BUILDSHERE_API_LATENCY.md`  |

Record incident timestamps, affected environment, release revision, observable
impact, mitigations, and recovery evidence. Never paste secrets, tokens,
kubeconfig, request bodies, or database URLs into incident notes.
