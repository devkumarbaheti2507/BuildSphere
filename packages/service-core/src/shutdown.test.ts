import assert from "node:assert/strict";
import test from "node:test";
import { createGracefulShutdownHandler } from "./shutdown.js";

test("graceful shutdown closes the server and resources only once", async () => {
  let closeCalls = 0;
  let closeCallback: ((error?: Error) => void) | undefined;
  let resourceEndCalls = 0;
  const errors: unknown[] = [];
  const shutdown = createGracefulShutdownHandler(
    {
      close(callback) {
        closeCalls += 1;
        closeCallback = callback;
        return this;
      },
    },
    [
      {
        async end() {
          resourceEndCalls += 1;
        },
      },
    ],
    (error) => errors.push(error),
  );

  shutdown();
  shutdown();
  closeCallback?.();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(closeCalls, 1);
  assert.equal(resourceEndCalls, 1);
  assert.deepEqual(errors, []);
});

test("graceful shutdown reports resource cleanup failures", async () => {
  const expected = new Error("database close failed");
  const errors: unknown[] = [];
  const shutdown = createGracefulShutdownHandler(
    {
      close(callback) {
        callback?.();
        return this;
      },
    },
    [
      {
        async end() {
          throw expected;
        },
      },
    ],
    (error) => errors.push(error),
  );

  shutdown();
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(errors, [expected]);
});
