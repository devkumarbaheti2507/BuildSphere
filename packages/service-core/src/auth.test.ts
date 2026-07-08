import assert from "node:assert/strict";
import test from "node:test";
import {
  hashPassword,
  signToken,
  verifyPassword,
  verifyToken,
} from "./auth.js";

test("password hashes do not expose plaintext and can be verified", async () => {
  const hash = await hashPassword("StrongPassword123");
  assert.equal(hash.includes("StrongPassword123"), false);
  assert.equal(await verifyPassword("StrongPassword123", hash), true);
  assert.equal(await verifyPassword("wrong-password", hash), false);
});

test("signed access tokens retain the authenticated user claims", () => {
  const token = signToken(
    { userId: "user-1", email: "ada@example.com", role: "user" },
    "test-secret-that-is-long-enough",
    "access",
    "15m",
  );
  const payload = verifyToken(
    token,
    "test-secret-that-is-long-enough",
    "access",
  );
  assert.equal(payload.sub, "user-1");
  assert.equal(payload.email, "ada@example.com");
});
