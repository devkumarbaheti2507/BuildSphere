import type { ErrorRequestHandler, RequestHandler } from "express";

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const asyncHandler =
  (
    handler: (...args: Parameters<RequestHandler>) => Promise<unknown>,
  ): RequestHandler =>
  (request, response, next) => {
    void handler(request, response, next).catch(next);
  };

export const notFoundHandler: RequestHandler = (request, _response, next) => {
  next(
    new ApiError(
      404,
      "NOT_FOUND",
      `Route ${request.method} ${request.originalUrl} was not found`,
    ),
  );
};

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  _next,
) => {
  if (error instanceof ApiError) {
    response.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
    return;
  }

  const logger = response.locals.logger;
  if (logger && typeof logger.error === "function") {
    logger.error({ error }, "Unhandled request error");
  }

  response.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
      details: {},
    },
  });
};
