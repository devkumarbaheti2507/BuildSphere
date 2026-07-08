import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { signToken } from "@buildsphere/service-core";
import { createAiApp } from "./app.js";
import { InMemorySuggestionRepository } from "./repository.js";
import { analyzeWithRules } from "./rules.js";

test("rule engine identifies known delivery gaps", () => {
  const suggestions = analyzeWithRules("project-1", {
    architectureType: "microservices",
    visibility: "private",
    toolSelections: [],
    files: [],
  });
  assert.ok(suggestions.some((item) => item.category === "docker"));
  assert.ok(suggestions.some((item) => item.category === "testing"));
  assert.ok(suggestions.some((item) => item.category === "observability"));
});

test("analysis stores suggestions and prompt loading uses repository prompt files", async () => {
  const secret = "ai-test-secret";
  const token = signToken(
    {
      userId: "b2ca65a0-0e18-4bd3-8491-14a918767ff9",
      email: "user@example.com",
      role: "user",
    },
    secret,
    "access",
    "15m",
  );
  const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");
  const server = createAiApp(
    new InMemorySuggestionRepository(),
    repoRoot,
    secret,
  ).listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const headers = {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };
  try {
    const analyzed = await fetch(
      `${baseUrl}/projects/project-1/suggestions/analyze`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          architectureType: "microservices",
          toolSelections: [],
          files: [],
        }),
      },
    );
    assert.equal(analyzed.status, 201);
    assert.ok(
      ((await analyzed.json()) as { data: unknown[] }).data.length >= 3,
    );
    const prompt = await fetch(`${baseUrl}/suggestions/prompts/security`, {
      headers,
    });
    assert.equal(prompt.status, 200);
    assert.match(
      ((await prompt.json()) as { data: { content: string } }).data.content,
      /security/i,
    );
  } finally {
    server.close();
  }
});
