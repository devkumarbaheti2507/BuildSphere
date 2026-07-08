export interface ShutdownResource {
  end(): Promise<void>;
}

export interface ShutdownServer {
  close(callback?: (error?: Error) => void): unknown;
}

type ShutdownErrorHandler = (error: unknown) => void;

export const createGracefulShutdownHandler = (
  server: ShutdownServer,
  resources: readonly ShutdownResource[],
  onError: ShutdownErrorHandler,
): (() => void) => {
  let shuttingDown = false;

  return () => {
    if (shuttingDown) return;
    shuttingDown = true;

    server.close((error) => {
      if (error) onError(error);
      void Promise.all(resources.map((resource) => resource.end())).catch(
        onError,
      );
    });
  };
};

export const registerGracefulShutdown = (
  server: ShutdownServer,
  resources: readonly ShutdownResource[],
  onError: ShutdownErrorHandler,
): void => {
  const shutdown = createGracefulShutdownHandler(server, resources, onError);
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
};
