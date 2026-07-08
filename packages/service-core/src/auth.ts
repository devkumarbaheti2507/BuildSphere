import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import type { AuthenticatedUser, UserRole } from "@buildsphere/shared-types";
import type { RequestHandler, Response } from "express";
import { ApiError } from "./errors.js";

const scrypt = promisify(scryptCallback);

type TokenType = "access" | "refresh";

interface TokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  type: TokenType;
  iat: number;
  exp: number;
  jti: string;
}

const encode = (value: string): string =>
  Buffer.from(value).toString("base64url");

const parseDuration = (duration: string): number => {
  const match = /^(\d+)(s|m|h|d)$/.exec(duration);
  if (!match) {
    throw new Error(`Unsupported token duration: ${duration}`);
  }

  const value = Number(match[1]);
  const multiplier = { s: 1, m: 60, h: 3_600, d: 86_400 }[
    match[2] as "s" | "m" | "h" | "d"
  ];
  return value * multiplier;
};

export const signToken = (
  user: AuthenticatedUser,
  secret: string,
  type: TokenType,
  duration: string,
): string => {
  const now = Math.floor(Date.now() / 1_000);
  const header = encode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = encode(
    JSON.stringify({
      sub: user.userId,
      email: user.email,
      role: user.role,
      type,
      iat: now,
      exp: now + parseDuration(duration),
      jti: randomUUID(),
    } satisfies TokenPayload),
  );
  const signature = createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
};

export const verifyToken = (
  token: string,
  secret: string,
  expectedType: TokenType,
): TokenPayload => {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new ApiError(
      401,
      "INVALID_TOKEN",
      "The authentication token is invalid",
    );
  }

  const [header, payload, signature] = parts;
  const expectedSignature = createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest();
  const receivedSignature = Buffer.from(signature, "base64url");

  if (
    receivedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(receivedSignature, expectedSignature)
  ) {
    throw new ApiError(
      401,
      "INVALID_TOKEN",
      "The authentication token is invalid",
    );
  }

  try {
    const parsedHeader = JSON.parse(
      Buffer.from(header, "base64url").toString("utf8"),
    ) as { alg?: string };
    const parsedPayload = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as TokenPayload;
    if (
      parsedHeader.alg !== "HS256" ||
      parsedPayload.type !== expectedType ||
      parsedPayload.exp <= Date.now() / 1_000
    ) {
      throw new Error("Token claims are invalid");
    }
    return parsedPayload;
  } catch {
    throw new ApiError(
      401,
      "INVALID_TOKEN",
      "The authentication token is invalid or expired",
    );
  }
};

export const requireAuthentication =
  (secret: string): RequestHandler =>
  (request, response, next) => {
    const authorization = request.header("authorization");
    if (!authorization?.startsWith("Bearer ")) {
      next(
        new ApiError(
          401,
          "AUTHENTICATION_REQUIRED",
          "A bearer access token is required",
        ),
      );
      return;
    }

    try {
      const payload = verifyToken(authorization.slice(7), secret, "access");
      response.locals.auth = {
        userId: payload.sub,
        email: payload.email,
        role: payload.role,
      } satisfies AuthenticatedUser;
      next();
    } catch (error) {
      next(error);
    }
  };

export const authenticatedUser = (response: Response): AuthenticatedUser => {
  const auth = response.locals.auth as AuthenticatedUser | undefined;
  if (!auth) {
    throw new ApiError(
      401,
      "AUTHENTICATION_REQUIRED",
      "Authentication context is unavailable",
    );
  }
  return auth;
};

export const hashPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(16);
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt.toString("base64url")}$${derivedKey.toString("base64url")}`;
};

export const verifyPassword = async (
  password: string,
  storedHash: string,
): Promise<boolean> => {
  const [algorithm, encodedSalt, encodedHash] = storedHash.split("$");
  if (algorithm !== "scrypt" || !encodedSalt || !encodedHash) {
    return false;
  }

  const expectedHash = Buffer.from(encodedHash, "base64url");
  const actualHash = (await scrypt(
    password,
    Buffer.from(encodedSalt, "base64url"),
    expectedHash.length,
  )) as Buffer;
  return (
    actualHash.length === expectedHash.length &&
    timingSafeEqual(actualHash, expectedHash)
  );
};

export const hashToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");
