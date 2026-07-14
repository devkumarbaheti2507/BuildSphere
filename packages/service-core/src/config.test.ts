import assert from "node:assert/strict";
import test from "node:test";
import { resolveBuildSphereRoot } from "./config.js";

test("uses an explicit BuildSphere root for flattened production images", () => {
  const previousRoot = process.env.BUILDSPHERE_ROOT;
  process.env.BUILDSPHERE_ROOT = "/opt/buildsphere";

  try {
    assert.equal(resolveBuildSphereRoot(import.meta.url), "/opt/buildsphere");
  } finally {
    if (previousRoot === undefined) delete process.env.BUILDSPHERE_ROOT;
    else process.env.BUILDSPHERE_ROOT = previousRoot;
  }
});

test("falls back to the monorepo root for local modules", () => {
  const previousRoot = process.env.BUILDSPHERE_ROOT;
  delete process.env.BUILDSPHERE_ROOT;

  try {
    assert.match(resolveBuildSphereRoot(import.meta.url), /BuildSphere$/);
  } finally {
    if (previousRoot !== undefined) process.env.BUILDSPHERE_ROOT = previousRoot;
  }
});
