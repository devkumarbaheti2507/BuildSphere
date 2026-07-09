import { useEffect, useState, type FormEvent } from "react";
import type { AuthSession } from "@buildsphere/shared-types";
import { api, ApiClientError } from "../api";
import {
  clearGitHubVerifier,
  createGitHubPkce,
  storeGitHubVerifier,
} from "../github-auth";
import { navigate } from "../navigation";

export function AuthPage({
  mode,
  onAuthenticated,
}: {
  mode: "login" | "signup";
  onAuthenticated: (session: AuthSession) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [githubEnabled, setGitHubEnabled] = useState(false);
  const [githubBusy, setGitHubBusy] = useState(false);

  useEffect(() => {
    void api
      .authProviders()
      .then((providers) => setGitHubEnabled(providers.github.enabled))
      .catch(() => setGitHubEnabled(false));
  }, []);

  const startGitHubLogin = async () => {
    setGitHubBusy(true);
    setError("");
    try {
      const pkce = await createGitHubPkce();
      storeGitHubVerifier(pkce.verifier);
      const authorization = await api.githubAuthorization(pkce.challenge);
      window.location.assign(authorization.authorizationUrl);
    } catch (caught) {
      clearGitHubVerifier();
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "Unable to start GitHub authentication",
      );
      setGitHubBusy(false);
    }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const session =
        mode === "signup"
          ? await api.register({ name, email, password })
          : await api.login({ email, password });
      onAuthenticated(session);
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "Unable to connect to BuildSphere",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="auth-layout">
      <section className="auth-brand">
        <p className="product-kicker">BuildSphere</p>
        <h1>DevOps workflows, assembled with clarity.</h1>
        <p>
          Configure a stack, generate delivery assets, inspect every stage, and
          improve the result from one workspace.
        </p>
        <div className="tool-line">
          <span>React</span>
          <span>Node.js</span>
          <span>PostgreSQL</span>
          <span>Docker</span>
          <span>Kubernetes</span>
        </div>
      </section>
      <section className="auth-panel">
        <form onSubmit={submit}>
          <div>
            <p className="section-label">
              {mode === "signup" ? "Create workspace" : "Welcome back"}
            </p>
            <h2>{mode === "signup" ? "Start building" : "Sign in"}</h2>
          </div>
          {mode === "signup" && (
            <label>
              Full name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                minLength={2}
                maxLength={100}
                required
                autoComplete="name"
              />
            </label>
          )}
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary-button full" disabled={busy}>
            {busy
              ? "Working..."
              : mode === "signup"
                ? "Create account"
                : "Sign in"}
          </button>
          {githubEnabled && (
            <>
              <div className="auth-divider">
                <span>or</span>
              </div>
              <button
                type="button"
                className="secondary-button full"
                disabled={busy || githubBusy}
                onClick={startGitHubLogin}
              >
                {githubBusy ? "Connecting..." : "Continue with GitHub"}
              </button>
            </>
          )}
          <p className="auth-switch">
            {mode === "signup"
              ? "Already have an account?"
              : "New to BuildSphere?"}{" "}
            <button
              type="button"
              className="inline-button"
              onClick={() => navigate(mode === "signup" ? "/login" : "/signup")}
            >
              {mode === "signup" ? "Sign in" : "Create account"}
            </button>
          </p>
        </form>
      </section>
    </main>
  );
}
