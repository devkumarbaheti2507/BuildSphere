# Personal free-tier deployment profile

These values prepare BuildSphere for one AMD64 or ARM64 K3s server. They are
provider-neutral and do not create a cloud account, VM, firewall rule, DNS
record, certificate controller, or backup destination.

Files:

- `prerequisites-values.example.yaml` configures the separate PostgreSQL and
  optional cert-manager prerequisite release.
- `buildsphere-values.example.yaml` configures the main application for one
  replica behind K3s Traefik.
- `scripts/create-personal-deployment-secrets.sh` creates the two required
  Secrets only after exact kube-context confirmation.

Before installation, replace the example email, hostname, and GHCR repository
owner. Keep the hostname identical in both values files and in `publicUrl`.
Install the certified release with its generated digest values first and this
profile second:

```bash
helm upgrade --install buildsphere infrastructure/helm/buildsphere \
  --namespace buildsphere \
  --values buildsphere-digest-values.yaml \
  --values infrastructure/deployment/free-tier/buildsphere-values.example.yaml
```

This profile deliberately disables PDBs, HPA, monitoring CRDs, application
NetworkPolicies, and controlled Kubernetes execution. Enable them only after
their cluster prerequisites and operating procedures are in place.
