# BuildSphere Nginx Runtime

`frontend.conf` serves the Phase 10 frontend image as the unprivileged Nginx
user on port 8080.

It provides:

- `/healthz` for container and Kubernetes probes.
- SPA fallback to `index.html`.
- Immutable caching for Vite assets.
- No caching for the application shell.
- Basic browser security headers.
- Temporary and PID paths under writable `/tmp` so the root filesystem can be
  read-only.

API traffic is not proxied by this Nginx process. The deployed ingress routes
`/api` directly to API Gateway and `/` to the frontend Service, preserving one
browser origin.
