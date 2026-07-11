import {
  ApiException,
  KubeConfig,
  KubernetesObjectApi,
  PatchStrategy,
  type KubernetesObject,
} from "@kubernetes/client-node";

export type KubernetesRequestErrorCode =
  | "KUBERNETES_REQUEST_TIMEOUT"
  | "KUBERNETES_AUTHENTICATION_FAILED"
  | "KUBERNETES_AUTHORIZATION_FAILED"
  | "KUBERNETES_RESOURCE_CONFLICT"
  | "KUBERNETES_RESOURCE_REJECTED"
  | "KUBERNETES_RATE_LIMITED"
  | "KUBERNETES_API_UNAVAILABLE"
  | "KUBERNETES_REQUEST_FAILED";

export class KubernetesRequestError extends Error {
  constructor(
    public readonly code: KubernetesRequestErrorCode,
    message: string,
    public readonly statusCode: number | undefined,
    public readonly transient: boolean,
  ) {
    super(message);
  }
}

export interface KubernetesResourceClient {
  read(resource: KubernetesObject): Promise<KubernetesObject | undefined>;
  apply(resource: KubernetesObject): Promise<void>;
  delete(resource: KubernetesObject): Promise<void>;
}

export interface KubernetesResourceClientFactory {
  create(kubeconfig: string): KubernetesResourceClient;
}

const requestError = (error: unknown): KubernetesRequestError => {
  if (error instanceof KubernetesRequestError) return error;
  const statusCode =
    error instanceof ApiException
      ? error.code
      : typeof error === "object" &&
          error !== null &&
          "code" in error &&
          typeof (error as { code?: unknown }).code === "number"
        ? (error as { code: number }).code
        : undefined;
  if (statusCode === 401) {
    return new KubernetesRequestError(
      "KUBERNETES_AUTHENTICATION_FAILED",
      "The Kubernetes API rejected the stored credential.",
      statusCode,
      false,
    );
  }
  if (statusCode === 403) {
    return new KubernetesRequestError(
      "KUBERNETES_AUTHORIZATION_FAILED",
      "The Kubernetes credential is not authorized for this resource.",
      statusCode,
      false,
    );
  }
  if (statusCode === 409) {
    return new KubernetesRequestError(
      "KUBERNETES_RESOURCE_CONFLICT",
      "Kubernetes reported a resource or field ownership conflict.",
      statusCode,
      false,
    );
  }
  if (statusCode === 400 || statusCode === 422) {
    return new KubernetesRequestError(
      "KUBERNETES_RESOURCE_REJECTED",
      "Kubernetes rejected the validated resource.",
      statusCode,
      false,
    );
  }
  if (statusCode === 408 || statusCode === 429) {
    return new KubernetesRequestError(
      statusCode === 429
        ? "KUBERNETES_RATE_LIMITED"
        : "KUBERNETES_REQUEST_TIMEOUT",
      statusCode === 429
        ? "The Kubernetes API rate limit was reached."
        : "The Kubernetes API request timed out.",
      statusCode,
      true,
    );
  }
  if (statusCode && statusCode >= 500) {
    return new KubernetesRequestError(
      "KUBERNETES_API_UNAVAILABLE",
      "The Kubernetes API is temporarily unavailable.",
      statusCode,
      true,
    );
  }
  return new KubernetesRequestError(
    "KUBERNETES_REQUEST_FAILED",
    "The Kubernetes API request failed.",
    statusCode,
    statusCode === undefined,
  );
};

const withTimeout = async <T>(
  operation: Promise<T>,
  timeoutMs: number,
): Promise<T> => {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () =>
            reject(
              new KubernetesRequestError(
                "KUBERNETES_REQUEST_TIMEOUT",
                "The Kubernetes API request timed out.",
                undefined,
                true,
              ),
            ),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
};

class OfficialKubernetesResourceClient implements KubernetesResourceClient {
  constructor(
    private readonly api: KubernetesObjectApi,
    private readonly timeoutMs: number,
  ) {}

  async read(
    resource: KubernetesObject,
  ): Promise<KubernetesObject | undefined> {
    try {
      return await withTimeout(
        this.api.read(
          resource as KubernetesObject & {
            metadata: { name: string; namespace?: string };
          },
        ),
        this.timeoutMs,
      );
    } catch (error) {
      if (error instanceof ApiException && error.code === 404) return undefined;
      throw requestError(error);
    }
  }

  async apply(resource: KubernetesObject): Promise<void> {
    try {
      await withTimeout(
        this.api.patch(
          resource,
          undefined,
          undefined,
          "buildsphere-deployment-service",
          false,
          PatchStrategy.ServerSideApply,
        ),
        this.timeoutMs,
      );
    } catch (error) {
      throw requestError(error);
    }
  }

  async delete(resource: KubernetesObject): Promise<void> {
    try {
      await withTimeout(
        this.api.delete(
          resource,
          undefined,
          undefined,
          undefined,
          undefined,
          "Background",
        ),
        this.timeoutMs,
      );
    } catch (error) {
      if (error instanceof ApiException && error.code === 404) return;
      throw requestError(error);
    }
  }
}

export class OfficialKubernetesResourceClientFactory implements KubernetesResourceClientFactory {
  constructor(private readonly timeoutMs: number) {}

  create(kubeconfig: string): KubernetesResourceClient {
    const config = new KubeConfig();
    config.loadFromString(kubeconfig);
    return new OfficialKubernetesResourceClient(
      KubernetesObjectApi.makeApiClient(config),
      this.timeoutMs,
    );
  }
}
