# BuildSphere personal prerequisites

This chart owns the stateful prerequisites for a personal single-node
BuildSphere installation. It is intentionally separate from the main
`buildsphere` chart so database storage and application upgrades have distinct
lifecycles.

Default resources:

- one PostgreSQL 16 StatefulSet and retained 20 GiB PVC;
- one internal headless Service;
- one token-disabled ServiceAccount;
- one ingress-only NetworkPolicy; and
- one authenticated Helm readiness test.

The chart never renders a Secret. Create `buildsphere-database` and
`buildsphere-runtime` with `scripts/create-personal-deployment-secrets.sh`
before installation. The default PostgreSQL image is bound to an immutable
multi-platform digest.

Set `tls.enabled=true` only after cert-manager is installed in the cluster.
That option creates a namespaced ACME Issuer and Certificate; cert-manager
owns the account and certificate Secrets. Supply an email and a DNS hostname
that resolves to the K3s server.

```bash
helm lint --strict infrastructure/helm/buildsphere-personal-prerequisites
helm template buildsphere-prerequisites \
  infrastructure/helm/buildsphere-personal-prerequisites \
  --namespace buildsphere \
  --values infrastructure/deployment/free-tier/prerequisites-values.example.yaml
```

This is personal evaluation infrastructure. It does not provide database high
availability, off-host backup, automated restoration, or Secret rotation.
