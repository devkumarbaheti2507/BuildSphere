import { useEffect, useRef, useState } from "react";
import type { AuthSession } from "@buildsphere/shared-types";
import { api, ApiClientError } from "../api";
import { clearGitHubVerifier, githubVerifier } from "../github-auth";
import { navigate } from "../navigation";

export function GitHubCallbackPage({
  onAuthenticated,
}: {
  onAuthenticated: (session: AuthSession) => void;
}) {
  const started = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const parameters = new URLSearchParams(window.location.search);
    const providerError = parameters.get("error");
    const code = parameters.get("code");
    const state = parameters.get("state");
    const verifier = githubVerifier();
    if (providerError || !code || !state || !verifier) {
      clearGitHubVerifier();
      setError(
        providerError
          ? "GitHub authorization was not completed"
          : "The GitHub callback is incomplete or expired",
      );
      return;
    }

    void api
      .githubCallback({ code, state, codeVerifier: verifier })
      .then(onAuthenticated)
      .catch((caught) =>
        setError(
          caught instanceof ApiClientError
            ? caught.message
            : "Unable to complete GitHub authentication",
        ),
      )
      .finally(clearGitHubVerifier);
  }, [onAuthenticated]);

  return (
    <main className="oauth-callback">
      <section>
        <p className="product-kicker">BuildSphere</p>
        <h1>{error ? "GitHub sign-in failed" : "Connecting GitHub"}</h1>
        {error ? (
          <>
            <p className="form-error" role="alert">
              {error}
            </p>
            <button className="primary-button" onClick={() => navigate("/login")}>
              Return to sign in
            </button>
          </>
        ) : (
          <p className="quiet">Completing your secure sign-in...</p>
        )}
      </section>
    </main>
  );
}
