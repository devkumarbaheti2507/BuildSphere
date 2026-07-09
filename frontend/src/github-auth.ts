const verifierKey = "buildsphere.github.pkce_verifier";

const base64Url = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
};

export const createGitHubPkce = async (): Promise<{
  verifier: string;
  challenge: string;
}> => {
  const random = crypto.getRandomValues(new Uint8Array(64));
  const verifier = base64Url(random);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return { verifier, challenge: base64Url(new Uint8Array(digest)) };
};

export const storeGitHubVerifier = (verifier: string): void =>
  sessionStorage.setItem(verifierKey, verifier);

export const githubVerifier = (): string | undefined =>
  sessionStorage.getItem(verifierKey) ?? undefined;

export const clearGitHubVerifier = (): void =>
  sessionStorage.removeItem(verifierKey);
